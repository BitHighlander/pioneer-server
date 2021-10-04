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

let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let utxosDB = connection.get('utxo')
let pubkeysDB = connection.get('pubkeys')
let unspentDB = connection.get('unspent')

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
        //publisher.publish('',JSON.stringify(balanceEvent))
    }catch(e){
        log.error(tag,e)
    }
}

let do_work = async function(){
    let tag = TAG+" | do_work | "
    let work:any
    try{

        //TODO normalize queue names
        let allWork = await queue.count("pioneer:pubkey:ingest")
        log.debug(tag,"allWork: ",allWork)

        work = await queue.getWork("pioneer:pubkey:ingest", 1)
        if(work){

            //setTimeout 1s
            let release = function(){
                redis.lpush(work.queueId,JSON.stringify({success:true}))
            }
            setTimeout(release,1000)
            //note: this will still update cache on slow coins. but accepts a 0

            log.info("work: ",work)
            if(!work.symbol && work.asset) work.symbol = work.asset
            if(!work.type && work.address) work.type = "address"
            if(!work.walletId) throw Error("100: invalid work! missing walletId")
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

            if(work.type === "xpub" || work.type === "zpub"){

                //get balance
                let balance = await blockbook.getBalanceByXpub(work.symbol,work.pubkey)
                log.info(tag,work.username + " Balance ("+work.symbol+"): ",balance)

                balances.push({
                    network:work.symbol,
                    asset:work.symbol,
                    isToken:false,
                    lastUpdated:new Date().getTime(),
                    balance
                })

                //update balance cache
                let updateResult = await redis.hset(work.username+":assets:"+work.walletId,work.symbol,balance)
                if(updateResult) push_balance_event(work,balance)
                log.info(tag,"updateResult: ",updateResult)

                //TODO if change push new balance over socket to user

                //TODO if BCH get slp tokens

            } else if(work.type === "address") {
                log.info(tag,"address ingestion")
                // if ETH get tokens
                if(work.symbol === 'ETH'){
                    //if eth use master

                    //register to blocknative
                    //blocknative.submitAddress("ETH", pubkeyInfo.master)

                    // get ethPlorer list
                    let ethInfo = await networks['ETH'].getBalanceTokens(work.pubkey)
                    log.info(tag,"ethInfo: ",ethInfo)

                    //forEach
                    let tokens = Object.keys(ethInfo.balances)
                    if(tokens){
                        for(let i = 0; i < tokens.length; i++){
                            let token = tokens[i]
                            let balance = ethInfo.balances[token]
                            if(token !== 'ETH'){
                                log.info("token info: ",ethInfo.coinInfo[token])
                                balances.push({
                                    network:"ETH",
                                    asset:token,
                                    symbol:token,
                                    contract:ethInfo.coinInfo[token].address,
                                    isToken:true,
                                    protocal:'erc20',
                                    lastUpdated:new Date().getTime(),
                                    balance,
                                    source:"ethplorer" //TODO get this network module
                                })
                            }
                        }
                    }

                    //blockbookInfo
                    let blockbookInfo = await blockbook.getAddressInfo('ETH',work.pubkey)
                    log.info(tag,'blockbookInfo: ',blockbookInfo)

                    if(blockbookInfo.txids){
                        if(blockbookInfo.totalPages > 1){
                            //get last scanned page cache

                            for(let i = 0; i <= blockbookInfo.totalPages; i++ ){
                                let page = i
                                let isNotScanned = await redis.sadd(work.pubkey+":blockbook:ETH:info","page:"+page)
                                if(isNotScanned || FORCE_RESCAN){
                                    log.info(tag,"page: ",page)
                                    let blockbookInfoPage = await blockbook.txidsByAddress('ETH',work.pubkey,page)
                                    log.info(tag,'blockbookInfoPage: ',blockbookInfoPage.page)
                                    await sleep(10000)
                                    for(let j = 0; j < blockbookInfoPage.txids.length; j++){
                                        log.info(tag,"page: "+page+ " txid: ",blockbookInfoPage.txids[j])
                                        let work = {
                                            txid:blockbookInfoPage.txids[j],
                                            network:'ETH'
                                        }
                                        //log.info(tag,'work: ',work)
                                        let isUnknownTxid = await redis.sadd("cache:txid:",work.txid)
                                        if(isUnknownTxid || FORCE_RESCAN) await queue.createWork("ETH:transaction:queue:ingest:HIGH",work)
                                    }
                                }
                            }
                        } else {
                            for(let i = 0; i < blockbookInfo.txids.length; i++){
                                log.info(tag,"txid: ",blockbookInfo.txids[i])
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

                // TODO if BSC get tokens

                // TODO if BNB get tokens

                // TODO get tx history

                // if OSMO get tokens/ibc channels
                if(work.network === 'OSMO'){
                    //

                }


                //get balance
                if(!networks[work.symbol] || !networks[work.symbol].getBalance) throw Error("102: coin not supported! "+work.symbol)

                log.info(tag,"getBalance: ")
                let balance = await networks[work.symbol].getBalance(work.pubkey)
                log.info(tag,"balance: ",balance)

                balances.push({
                    network:work.symbol,
                    asset:work.symbol,
                    symbol:work.symbol,
                    isToken:false,
                    lastUpdated:new Date().getTime(),
                    balance,
                    source:"network"
                })

                let updateResult = await redis.hset(work.username+":assets:"+work.walletId,work.symbol,balance)
                if(updateResult) push_balance_event(work,balance)
                //if eth get info
                //TODO if change push new balance over socket to user

            } else if(work.type === "contract"){
                //TODO non ETH network contracts
                //blockbookInfo
                let blockbookInfo = await blockbook.getAddressInfo('ETH',work.pubkey)
                log.info(tag,'blockbookInfo: ',blockbookInfo)

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
                        log.info(tag,"page: ",page)
                        let blockbookInfoPage = await blockbook.getAddressInfo('ETH',work.pubkey,page)
                        log.info(tag,'blockbookInfoPage: ',blockbookInfoPage.page)
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

            log.info(tag,"balances: ",balances)

            let pubkeyInfo = await pubkeysDB.findOne({pubkey:work.pubkey})
            if(!pubkeyInfo.balances) pubkeyInfo.balances = []
            log.info(tag,"pubkeyInfo: ",pubkeyInfo)
            log.info(tag,"pubkeyInfo: ",pubkeyInfo.balances)
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
                log.info(tag,"balanceMongo: ",balanceMongo)

                //if update
                if(balanceMongo.length > 0){
                    //if value is diff
                    log.info(tag,"balanceMongo: ",balanceMongo[0])
                    log.info(tag,"balance: ",balance)
                    //TODO verify this actually works
                    if(balanceMongo[0].balance !== balance.balance){
                        //TODO events
                        //push_balance_event(work,balance)
                        //push event
                        //TODO get position in array and force update
                        // saveActions.push({updateOne: {
                        //         "filter": {pubkey:work.pubkey},
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

            if(saveActions.length > 0){
                log.info(tag,"saveActions: ",saveActions)
                let updateSuccess = await pubkeysDB.bulkWrite(saveActions,{ordered:false})
                log.info(tag,"updateSuccess: ",updateSuccess)
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
log.info(TAG," worker started! ","")
do_work()
