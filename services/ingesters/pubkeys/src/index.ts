/*
      update tx's by address worker

      Start

 */
require('dotenv').config()
require('dotenv').config({path:"../../../.env"})
require('dotenv').config({path:"./../../.env"})
require('dotenv').config({path:"../../../../.env"})

// console.log(process.env)

let packageInfo = require("../package.json")
const TAG = " | "+packageInfo.name+" | "
const log = require('@pioneer-platform/loggerdog')()
const {subscriber,publisher,redis,redisQueue} = require('@pioneer-platform/default-redis')
const blockbook = require('@pioneer-platform/blockbook')
const {baseAmountToNative,nativeToBaseAmount} = require('@pioneer-platform/pioneer-coins')
const foxitar = require("@pioneer-platform/foxitar-client")
let zapper = require("@pioneer-platform/zapper-client")

let servers:any = {}
if(process.env['BTC_BLOCKBOOK_URL']) servers['BTC'] = process.env['BTC_BLOCKBOOK_URL']
if(process.env['ETH_BLOCKBOOK_URL']) servers['ETH'] = process.env['ETH_BLOCKBOOK_URL']
if(process.env['DOGE_BLOCKBOOK_URL']) servers['DOGE'] = process.env['DOGE_BLOCKBOOK_URL']
if(process.env['BCH_BLOCKBOOK_URL']) servers['BCH'] = process.env['BCH_BLOCKBOOK_URL']
if(process.env['LTC_BLOCKBOOK_URL']) servers['LTC'] = process.env['LTC_BLOCKBOOK_URL']
blockbook.init(servers)

let queue = require("@pioneer-platform/redis-queue")
let connection  = require("@pioneer-platform/default-mongo")
let wait = require('wait-promise');
let sleep = wait.sleep;

const networks:any = {
    'ETH' : require('@pioneer-platform/eth-network'),
    'ATOM': require('@pioneer-platform/cosmos-network'),
    'OSMO': require('@pioneer-platform/osmosis-network'),
    'BNB' : require('@pioneer-platform/binance-network'),
    // 'EOS' : require('@pioneer-platform/eos-network'),
    'FIO' : require('@pioneer-platform/fio-network'),
    'ANY' : require('@pioneer-platform/utxo-network'),
    'RUNE' : require('@pioneer-platform/thor-network'),
}
networks.ANY.init('full')
networks.ETH.init()
try{
    //Moralas sucks and keepkey breaking their API handle downtime
    //TODO dynamic node failovers
    networks['AVAX'] = require('@pioneer-platform/avax-network'),
    networks.AVAX.init()
}catch(e){
    log.error("failed to init avax! e: ",e)
}

let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let utxosDB = connection.get('utxo')
let pubkeysDB = connection.get('pubkeys')
let unspentDB = connection.get('unspent')
let assetsDB = connection.get('assets')
usersDB.createIndex({id: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
unspentDB.createIndex({txid: 1}, {unique: true})

let FORCE_RESCAN: boolean
if(process.env['FORCE_RESCAN_PUBKEYS']) FORCE_RESCAN = true

let push_balance_event = async function(work:any,balance:string){
    let tag = TAG+" | push_balance_event | "
    try{
        let balanceEvent = {
            username:work.username,
            symbol:work.symbol,
            network:work.symbol,
            balance
        }
        //TODO
        //publisher.publish('',JSON.stringify(balanceEvent))
    }catch(e){
        log.error(tag,e)
    }
}


/*
    User comes online

    1. check if user has pubkey
    load pubkeys into redis set "online/watching"

    for each blockchain
    event block comes in
    check if any pubkey is in block

    if pubkey in block give insights on tx

    push message to events

 */

let do_work = async function(){
    let tag = TAG+" | do_work | "
    let work:any
    try{
        // console.time('start2mongo');
        // console.time('start2node');
        // console.time('start2end');

        //TODO normalize queue names
        let allWork = await queue.count("pioneer:pubkey:ingest")
        log.debug(tag,"allWork: ",allWork)

        work = await queue.getWork("pioneer:pubkey:ingest", 1)
        if(work){
            //setTimeout 1s TODO on flag?
            let release = function(){
                redis.lpush(work.queueId,JSON.stringify({success:true}))
            }
            setTimeout(release,1000)
            //note: this will still update cache on slow coins. but accepts a 0

            log.debug("work: ",work)
            if(!work.symbol && work.asset) work.symbol = work.asset
            if(!work.type && work.address) work.type = "address"
            if(!work.context) throw Error("100: invalid work! missing context")
            if(!work.symbol) throw Error("101: invalid work! missing symbol")
            if(!work.username) throw Error("102: invalid work! missing username")
            if(!work.pubkey) throw Error("103: invalid work! missing pubkey")
            if(!work.type) throw Error("105: invalid work! missing type")
            if(!work.queueId) throw Error("106: invalid work! missing queueId")
            if(work.type !== 'address' && work.type !== 'xpub' && work.type !== 'zpub' && work.type !== 'contract') throw Error("Unknown type! "+work.type)

            //TODO lookup last update
            //if < x time, refuse to do work

            //pubkey Balance
            let balances:any = []
            let nfts:any = []
            let positions:any = []

            if(work.type === "xpub" || work.type === "zpub"){

                //get balance
                let balance = await blockbook.getBalanceByXpub(work.symbol,work.pubkey)
                log.debug(tag,work.username + " Balance ("+work.symbol+"): ",balance)

                balances.push({
                    network:work.symbol,
                    asset:work.symbol,
                    isToken:false,
                    lastUpdated:new Date().getTime(),
                    balance
                })

                //update balance cache
                let updateResult = await redis.hset(work.username+":assets:"+work.context,work.symbol,balance)
                if(updateResult) push_balance_event(work,balance)
                log.debug(tag,"updateResult: ",updateResult)

                //TODO if change push new balance over socket to user

                //TODO if BCH get slp tokens

            } else if(work.type === "address") {
                log.debug(tag,"address ingestion")
                // if ETH get tokens
                if(work.symbol === 'ETH'){
                    //if eth use master

                    //register to blocknative
                    //blocknative.submitAddress("ETH", pubkeyInfo.master)

                    // get ethPlorer list
                    // let ethInfo = await networks['ETH'].getBalanceTokens(work.pubkey)
                    // log.debug(tag,"ethInfo: ",ethInfo)

                    //forEach
                    // let tokens = Object.keys(ethInfo.balances)
                    // if(tokens){
                    //     for(let i = 0; i < tokens.length; i++){
                    //         let token = tokens[i]
                    //         let balance = ethInfo.balances[token]
                    //         if(token !== 'ETH' && token){
                    //             log.debug("token: ",token)
                    //             log.debug("token info: ",ethInfo.coinInfo[token])
                    //             let tokenInfo = ethInfo.coinInfo[token]
                    //             let balanceInfo:any = {
                    //                 network:"ETH",
                    //                 asset:token || tokenInfo.address,
                    //                 symbol:token || tokenInfo.address,
                    //                 contract:ethInfo.coinInfo[token].address,
                    //                 isToken:true,
                    //                 protocal:'erc20',
                    //                 lastUpdated:new Date().getTime(),
                    //                 balance,
                    //                 source:"ethplorer" //TODO get this network module
                    //             }
                    //             if(tokenInfo.holdersCount === 1){
                    //                 balanceInfo.nft = true
                    //             }
                    //
                    //             balances.push(balanceInfo)
                    //         }
                    //     }
                    // }

                    //get zapper dashboard
                    let zapperInfo = await zapper.getPortfolio(work.pubkey)
                    log.debug(tag,"zapperInfo: ",zapperInfo)

                    // forEach tokens
                    if (zapperInfo && zapperInfo.tokens && zapperInfo.tokens.length > 0) {
                        for (let i = 0; i < zapperInfo.tokens.length; i++) {
                            let token = zapperInfo.tokens[i];

                            // zapper map
                            let balanceInfo = token.token;
                            balanceInfo.network = token.network;
                            balanceInfo.asset = token.token.symbol;
                            balanceInfo.symbol = token.token.symbol;
                            balanceInfo.contract = token.token.address;
                            if (token.token.address !== '0x0000000000000000000000000000000000000000') {
                                balanceInfo.isToken = true;
                                balanceInfo.protocal = 'erc20';
                            }
                            balanceInfo.lastUpdated = new Date().getTime();
                            balanceInfo.balance = token.token.balance.toString();
                            balances.push(balanceInfo);
                        }
                    }
                    if (zapperInfo && zapperInfo.nfts.length > 0) {
                        nfts = zapperInfo.nfts;
                    }

                    //isPioneer
                    let allPioneers = await networks['ETH'].getAllPioneers()
                    log.debug(tag,"allPioneers: ",allPioneers)

                    let isPioneer = false
                    if(allPioneers.owners.indexOf(work.pubkey.toLowerCase()) > -1){
                        log.debug("Pioneer detected!")
                        //mark user as pioneer

                        // Mark user as pioneer
                        isPioneer = true;
                        //work.username
                        let updatedUsername = await usersDB.update({username:work.username}, { $set: { isPioneer: true } }, { multi: true });
                        log.debug("Updated username PIONEER: ", updatedUsername);

                        // Get art for nft
                        const pioneerImage = allPioneers.images.find((image: { address: string }) => image.address.toLowerCase() === work.pubkey.toLowerCase());
                        if (pioneerImage) {
                            let updatedUsername2 = await usersDB.update({username:work.username}, { $set: { pioneerImage: pioneerImage.image } }, { multi: true });
                            log.debug("updatedUsername2 PIONEER: ", updatedUsername2);
                            nfts.push({
                                name: "Pioneer",
                                description: "Pioneer",
                                number:allPioneers.owners.indexOf(work.pubkey.toLowerCase()),
                                image: pioneerImage.image
                            });
                        }
                    }

                    //isFox
                    let isFox = await foxitar.isFoxOwner(work.pubkey)
                    if(isFox > 0){
                        //get foxitar
                        let foxInfo:any = {}
                        let addressInfo = await redis.hgetall(work.pubkey.toLowerCase())
                        if(addressInfo.id) foxInfo.foxId = addressInfo.id
                        if(addressInfo.image) foxInfo.foxImage = addressInfo.image
                        if(addressInfo.xp) foxInfo.foxXp = addressInfo.xp

                        //updatedUsername
                        let updatedUsername = await usersDB.update(
                            { username: work.username },
                            { $set: { isFox: true, ...foxInfo } },
                            { multi: true }
                        );
                        log.debug("updatedUsername FOX: ", updatedUsername);
                    }

                    //blockbookInfo
                    let blockbookInfo = await blockbook.getAddressInfo('ETH',work.pubkey)
                    log.debug(tag,'blockbookInfo: ',blockbookInfo)
                    if(blockbookInfo.tokens){
                        for(let i = 0; i < blockbookInfo.tokens.length; i++){
                            let tokenInfo = blockbookInfo.tokens[i]
                            if(tokenInfo.symbol && tokenInfo.symbol !== 'ETH'){
                                log.debug("tokenInfo.symbol: ",tokenInfo.symbol)
                                let balanceInfo:any = {
                                    network:"ETH",
                                    type:tokenInfo.type,
                                    asset:tokenInfo.symbol,
                                    symbol:tokenInfo.symbol,
                                    name:tokenInfo.name,
                                    image:"https://pioneers.dev/coins/ethereum.png",
                                    contract:tokenInfo.contract,
                                    isToken:true,
                                    protocal:'erc20',
                                    lastUpdated:new Date().getTime(),
                                    decimals:tokenInfo.decimals,
                                    balance:tokenInfo.balance / Math.pow(10, Number(tokenInfo.decimals)),
                                    balanceNative:tokenInfo.balance / Math.pow(10, Number(tokenInfo.decimals)),
                                    source:"blockbook" //TODO get this network module
                                }
                                if(tokenInfo.holdersCount === 1){
                                    balanceInfo.nft = true
                                }

                                if(balanceInfo.balance > 0){
                                    balances.push(balanceInfo)
                                }
                            }
                        }
                    }


                    if(blockbookInfo.txids){
                        if(blockbookInfo.totalPages > 1){
                            //get last scanned page cache

                            for(let i = 0; i <= blockbookInfo.totalPages; i++ ){
                                let page = i
                                let isNotScanned = await redis.sadd(work.pubkey+":blockbook:ETH:info","page:"+page)
                                if(isNotScanned || FORCE_RESCAN){
                                    log.debug(tag,"page: ",page)
                                    let blockbookInfoPage = await blockbook.txidsByAddress('ETH',work.pubkey,page)
                                    log.debug(tag,'blockbookInfoPage: ',blockbookInfoPage.page)
                                    await sleep(10000)
                                    for(let j = 0; j < blockbookInfoPage.txids.length; j++){
                                        log.debug(tag,"page: "+page+ " txid: ",blockbookInfoPage.txids[j])
                                        let work = {
                                            txid:blockbookInfoPage.txids[j],
                                            network:'ETH'
                                        }
                                        //log.debug(tag,'work: ',work)
                                        let isUnknownTxid = await redis.sadd("cache:txid:",work.txid)
                                        if(isUnknownTxid || FORCE_RESCAN) await queue.createWork("ETH:transaction:queue:ingest:HIGH",work)
                                    }
                                }
                            }
                        } else {
                            for(let i = 0; i < blockbookInfo.txids.length; i++){
                                log.debug(tag,"txid: ",blockbookInfo.txids[i])
                                let work = {
                                    txid:blockbookInfo.txids[i],
                                    network:'ETH'
                                }
                                let isUnknownTxid = await redis.sadd("cache:txid:",work.txid)
                                if(isUnknownTxid || FORCE_RESCAN) await queue.createWork("ETH:transaction:queue:ingest:HIGH",work)
                            }
                        }
                    }

                    //get txid diff from mongo
                        //push new tx's

                    //do lookup on mongo/ find unknown

                    //batch lookup unknown txids

                    //get payment streams

                    //get nfts

                    // get blockbook tokens
                    // validate ethPlorer

                    // filter LP positions

                    // Price LP positions

                }

                // if(work.symbol === 'AVAX'){
                //     try{
                //         log.debug(tag,"avax detected! pubkey: ",work.pubkey)
                //
                //         let balanceAvax = await networks['AVAX'].getBalance(work.pubkey)
                //         log.debug(tag,"balanceAvax: ",balanceAvax)
                //         if(!balanceAvax) balanceAvax = 0
                //         balances.push({
                //             network:work.symbol,
                //             asset:work.symbol,
                //             symbol:work.symbol,
                //             isToken:false,
                //             lastUpdated:new Date().getTime(), //TODO use block heights
                //             balance:balanceAvax,
                //             source:"network"
                //         })
                //     }catch(e){
                //         log.error(tag,"Failed to query AVAX! e: ",e)
                //     }
                // }

                // TODO if BSC get tokens

                // TODO if BNB get tokens

                // TODO get tx history

                // if OSMO get tokens/ibc channels
                if(work.network === 'OSMO'){
                    log.debug(tag,"work.symbol: ",work.symbol)
                    log.debug(tag,"networks[work.symbol]: ",networks[work.symbol])
                    let balancesResp = await networks[work.symbol].getBalances(work.pubkey)
                    log.debug(tag,"balancesResp: ",balancesResp)
                    for(let i =0; i < balancesResp.length; i++){
                        let balanceInfo = balancesResp[i]
                        if(balanceInfo.asset){
                            balanceInfo.network = 'OSMO'
                            balanceInfo.isToken = false
                            balanceInfo.symbol = balanceInfo.asset
                            balanceInfo.source = "network"
                            balanceInfo.lastUpdated = new Date().getTime() //TODO use block heights
                            balances.push(balanceInfo)
                        }
                    }
                }


                //get balance
                if(!networks[work.symbol] || !networks[work.symbol].getBalance) throw Error("102: coin not supported! "+work.symbol)

                log.debug(tag,"getBalance: ")
                let balance = await networks[work.symbol].getBalance(work.pubkey)
                log.debug(tag,"balance: ",balance)
                if(!balance) balance = 0
                balances.push({
                    network:work.symbol,
                    asset:work.symbol,
                    symbol:work.symbol,
                    isToken:false,
                    lastUpdated:new Date().getTime(), //TODO use block heights
                    balance,
                    source:"network"
                })

                let updateResult = await redis.hset(work.username+":assets:"+work.context,work.symbol,balance)
                if(updateResult) push_balance_event(work,balance)
                //if eth get info
                //TODO if change push new balance over socket to user

            } else if(work.type === "contract"){
                //TODO non ETH network contracts
                //blockbookInfo
                let blockbookInfo = await blockbook.getAddressInfo('ETH',work.pubkey)
                log.debug(tag,'blockbookInfo: ',blockbookInfo)

                for(let i = 0; i < blockbookInfo.txids.length; i++){
                    let work = {
                        txid:blockbookInfo.txids[i],
                        network:'ETH'
                    }
                    await queue.createWork("ETH:transaction:queue:ingest:HIGH",work)
                }

                if(blockbookInfo.totalPages > 1){
                    for(let i = 0; i <= blockbookInfo.totalPages; i++ ){
                        let page = i
                        log.debug(tag,"page: ",page)
                        let blockbookInfoPage = await blockbook.getAddressInfo('ETH',work.pubkey,page)
                        log.debug(tag,'blockbookInfoPage: ',blockbookInfoPage.page)
                        for(let j = 0; j < blockbookInfo.txids.length; j++){
                            let work = {
                                txid:blockbookInfo.txids[j],
                                network:'ETH'
                            }
                            await queue.createWork("ETH:transaction:queue:ingest:HIGH",work)
                        }
                    }
                }

            }else {
                //unhandled work!
                log.error(work)
            }

            log.debug(tag,"balances: ",balances)

            let pubkeyInfo = await pubkeysDB.findOne({pubkey:work.pubkey})
            if(!pubkeyInfo || !pubkeyInfo.balances) {
                pubkeyInfo = {
                    balances: []
                }
            }
            if(!pubkeyInfo.nfts) pubkeyInfo.nfts = []
            log.debug(tag,"pubkeyInfo: ",pubkeyInfo)
            log.debug(tag,"pubkeyInfo: ",pubkeyInfo.balances)
            log.debug(tag,"nfts: ",pubkeyInfo.nfts)
            let saveActions = []

            //push update
            // saveActions.push({updateOne: {
            //         "filter": {pubkey:work.pubkey},
            //         "update": { lastUpdated: new Date().getTime() }
            //     }})

            for(let i = 0; i < balances.length; i++){
                let balance = balances[i]

                //find balance with symbol
                let balanceMongo = pubkeyInfo.balances.filter((e:any) => e.symbol === balance.symbol)
                log.debug(tag,"balanceMongo: ",balanceMongo)

                //get asset info
                let assetInfo = await assetsDB.findOne({symbol:balance.symbol})
                log.debug("assetInfo: ",assetInfo)
                if(assetInfo){
                    balance.caip = assetInfo.caip
                    balance.image = assetInfo.image
                    balance.description = assetInfo.description
                    balance.website = assetInfo.website
                    balance.explorer = assetInfo.explorer
                } else {
                    //missing asset info
                    log.error(tag,"Missing asset info for: ",balance.symbol)
                }
                //if update
                if(balanceMongo.length > 0){
                    //if value is diff
                    log.debug(tag,"balanceMongo: ",balanceMongo[0])
                    log.debug(tag,"balance: ",balance)
                    //TODO verify this actually works
                    if(balanceMongo[0].balance !== balance.balance){
                        log.debug(tag,"Update balance~!")

                        //TODO events
                        // push_balance_event(work,balance)
                        // //push event
                        // saveActions.push({updateOne: {
                        //         "filter": {"pubkey.balances.":work.pubkey},
                        //         "update": {$Set: { balances: balance }},
                        //     }})
                    }
                } else {
                    //if new push
                    saveActions.push({updateOne: {
                            "filter": {pubkey:work.pubkey},
                            "update": {$addToSet: { balances: balance }}
                    }})
                }
            }

            for(let i = 0; i < nfts.length; i++){
                let nft = nfts[i]

                //find balance with symbol
                let balanceMongo = pubkeyInfo.nfts.filter((e:any) => e.symbol === nft.token.name)
                log.debug(tag,"balanceMongo: ",balanceMongo)

                //if update
                if(balanceMongo.length > 0){
                    //if value is diff
                    log.debug(tag,"balanceMongo: ",balanceMongo[0])
                    //TODO verify this actually works
                    saveActions.push({updateOne: {
                            "filter": {"pubkey.nfts.":work.pubkey},
                            "update": {$Set: { nfts: nft }},
                        }})
                } else {
                    //if new push
                    saveActions.push({updateOne: {
                            "filter": {pubkey:work.pubkey},
                            "update": {$addToSet: { nfts: nft }}
                        }})
                }
            }

            if(saveActions.length > 0){
                log.debug(tag,"saveActions: ",JSON.stringify(saveActions))
                let updateSuccess = await pubkeysDB.bulkWrite(saveActions,{ordered:false})
                log.debug(tag,"updateSuccess: ",updateSuccess)
            }

            //release
            redis.lpush(work.queueId,JSON.stringify({success:true}))

        }
    } catch(e) {
        log.error(tag,"e: ",e)
        log.error(tag,"e: ",e.message)
        work.error = e.message
        queue.createWork("pioneer:pubkey:ingest:deadletter",work)
        //TODO dead letter queue?
        //TODO fix errors dont shh them (need cointainers)
        //log.debug(tag,"Error checking for blocks: ", e)
        //toss back into work queue? (at end)
        //await sleep(10000)
    }
    //dont stop working even if error
    do_work()
}

//start working on install
log.debug(TAG," worker started! ","")
do_work()
