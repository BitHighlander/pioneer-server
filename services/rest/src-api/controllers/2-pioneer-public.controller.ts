/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

//rango SDK for markets
import {
    RangoClient
} from "rango-sdk"

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
const midgard = require("@pioneer-platform/midgard-client")
const axios = require('axios')
let connection = require("@pioneer-platform/default-mongo")
const markets = require('@pioneer-platform/markets')
let usersDB = connection.get('users')
let pubkeysDB = connection.get('pubkeys')
let txsDB = connection.get('transactions')
let invocationsDB = connection.get('invocations')
let utxosDB = connection.get('utxo')
let devsDB = connection.get('developers')
let blockchainsDB = connection.get('blockchains')
let dappsDB = connection.get('apps')
let nodesDB = connection.get('nodes')
let assetsDB = connection.get('assets')

usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

const RANGO_API_KEY = process.env['RANGO_API_KEY'] || '4a624ab5-16ff-4f96-90b7-ab00ddfc342c'
const rangoClient = new RangoClient(RANGO_API_KEY)

/*
    Feature Flags per blockchain
 */

let blockchains = []
const networks:any = {}

if(process.env['FEATURE_BITCOIN_BLOCKCHAIN']){
    blockchains.push('bitcoin')
    //all utxo's share
    networks['ANY'] = require('@pioneer-platform/utxo-network')
    networks['ANY'].init('full')
}

if(process.env['FEATURE_BITCOINCASH_BLOCKCHAIN']){
    blockchains.push('bitcoincash')
}

if(process.env['FEATURE_DASH_BLOCKCHAIN']){
    blockchains.push('dash')
}

if(process.env['FEATURE_LITECOIN_BLOCKCHAIN']){
    blockchains.push('litecoin')
}

if(process.env['FEATURE_DOGECOIN_BLOCKCHAIN']){
    blockchains.push('dogecoin')
}

if(process.env['FEATURE_ETHEREUM_BLOCKCHAIN']){
    blockchains.push('ethereum')
    networks['ETH'] = require('@pioneer-platform/eth-network')
    networks['ETH'].init()
}

if(process.env['FEATURE_COSMOS_BLOCKCHAIN']){
    blockchains.push('cosmos')
    networks['ATOM'] = require('@pioneer-platform/cosmos-network')
}

if(process.env['FEATURE_BINANCE_BLOCKCHAIN']){
    blockchains.push('binance')
    networks['BNB'] = require('@pioneer-platform/binance-network')
}

if(process.env['FEATURE_THORCHAIN_BLOCKCHAIN']){
    blockchains.push('thorchain')
    networks['RUNE'] = require('@pioneer-platform/thor-network')
}

if(process.env['FEATURE_OSMOSIS_BLOCKCHAIN']){
    blockchains.push('osmosis')
    networks['OSMO'] = require('@pioneer-platform/osmosis-network')
}

if(process.env['FEATURE_RIPPLE_BLOCKCHAIN']){
    blockchains.push('ripple')
    networks['XRP'] = require('@pioneer-platform/ripple-network')
    networks['XRP'].init()
}

//Cache time
let CACHE_TIME = process.env['CACHE_EXPIRE_TIME'] || 99999999
if(typeof(CACHE_TIME) === 'string') CACHE_TIME = parseInt(CACHE_TIME)
let CACHE_OVERRIDE = true
//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';
// import * as express from 'express';

//globals
const ADMIN_PUBLIC_ADDRESS = process.env['ADMIN_PUBLIC_ADDRESS']
if(!ADMIN_PUBLIC_ADDRESS) throw Error("Invalid ENV missing ADMIN_PUBLIC_ADDRESS")

import {
    Error,
    ApiError,
    BroadcastBody,
    GetFeesWithMemoBody,
    EstimateFeeBody,
    BodyAllowance
} from "@pioneer-platform/pioneer-types";

let {
    PoSchains,
    UTXO_COINS,
    COIN_MAP,
    get_address_from_xpub,
    COIN_MAP_LONG,
    getExplorerTxUrl
} = require('@pioneer-platform/pioneer-coins')

const parseThorchainAssetString = function(input:string){
    try{
        let parts = input.split(".")
        let network = parts[0]
        let asset
        let symbol
        let contract
        if(parts[1].indexOf("-") >= 0){
            //is Token
            let parts2 = parts[1].split("-")
            contract = parts2[1]
            asset = parts2[0]
            symbol = parts2[0]
        }else{
            //is Native asset
            asset = parts[0]
            symbol = parts[0]
        }
        return {
            asset,
            symbol,
            network,
            contract
        }
    }catch(e){
        log.error(e)
    }
}

//route
@Tags('Public Endpoints')
@Route('')
export class atlasPublicController extends Controller {

    /*
     * globals
     * */
    @Get('/globals')
    public async globals() {
        let tag = TAG + " | globals | "
        try{
            let globals = await redis.hgetall('globals')
            let online = await redis.smembers('online')


            let info = await redis.hgetall("info:dbs")

            if(Object.keys(info).length === 0){
                //populate
                let countUsers = await usersDB.count()
                let countDevs = await devsDB.count()
                let countDapps = await dappsDB.count()
                let countAssets = await assetsDB.count()
                let countBlockchains = await blockchainsDB.count()
                let countNodes = await nodesDB.count()
                log.debug(tag,"countDevs: ",countDevs)
                log.debug(tag,"countDapps: ",countDapps)
                globals.info = {
                    users:countUsers,
                    assets:countAssets,
                    blockchains:countBlockchains,
                    nodes:countNodes,
                    devs:countDevs,
                    dapps:countDapps
                }
                redis.hmset("info:dbs",globals.info)
                redis.expire("info:dbs",CACHE_TIME)
            } else {
                globals.info = info
            }

            //get downloads
            let getDownloads = async function() {
                const url = "https://api.github.com/repos/keepkey/keepkey-desktop/releases";
                const response = await axios.get(url);
                const releases = response.data;
                let output = []
                let totalDownloads = 0
                releases.forEach(release => {
                    //console.log(`Version ${release.tag_name} has been downloaded ${release.assets[0].download_count} times.`);
                    totalDownloads = totalDownloads + parseInt(release.assets[0].download_count)
                    output.push({
                        version:release.tag_name,
                        count:release.assets[0].download_count
                    })
                });
                return {
                    total:totalDownloads,
                    breakdown:output
                }
            }

            let result = await getDownloads();
            console.log("result: ",result)
            globals.downloads = result
            //add MOTD
            let motd = await redis.get("MOTD")
            globals.motd = motd


            globals.online = online
            globals.blockchains = blockchains
            globals.root = ADMIN_PUBLIC_ADDRESS
            return(globals)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    @Get('/online')
    public async online() {
        let tag = TAG + " | online | "
        try{
            let online = await redis.smembers('online')
            return(online)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    @Get('/status')
    public async status() {
        let tag = TAG + " | status | "
        try{
            let pools = await redis.get('thorchain:pools')
            if(!pools){
                pools = await midgard.getPoolAddress()
                redis.setex('thorchain:pools',CACHE_TIME,JSON.stringify(pools))
            } else {
                pools = JSON.parse(pools)
            }

            //markets

            let output:any = {}
            output.protocals = ['thorchain','0x','osmosis']
            output.exchanges = {}
            output.exchanges.thorchain = {}
            output.exchanges.thorchain.status = []
            output.exchanges.thorchain.markets = []
            output.exchanges.thorchain.assets = []
            output.exchanges.thorchain.pools = pools

            output.rango = await redis.get('rango:markets')
            output.rango = JSON.parse(output.rango)

            let updateRango = async function(){
                let metaInfo = await rangoClient.getAllMetadata()
                if(metaInfo){
                    let updateRedis = await redis.set('rango:markets',JSON.stringify(metaInfo))
                    log.debug(tag,"updateRedis: ",updateRedis)
                }
            }
            try{
                updateRango()
            }catch(e){
                log.info("failed to get rango markets! ",e)
            }


            // for(let i = 0; i < pools.length; i++){
            //     let pool = pools[i]
            //     output.exchanges.thorchain.assets.push(pool.chain)
            //     let entry:any = {
            //         blockchain:COIN_MAP_LONG[pool.chain].toLowerCase(),
            //     }
            //     if(pool.halted === false){
            //         entry.online = true
            //     } else {
            //         entry.online = false
            //     }
            //     output.exchanges.thorchain.status.push(entry)
            // }

            //get rate for every market
            // let marketsCache = await redis.get('thorchain:markets')
            // if(!marketsCache){
            //     marketsCache = await midgard.getPools()
            //     redis.setex('thorchain:markets',CACHE_TIME,JSON.stringify(marketsCache))
            // } else {
            //     marketsCache = JSON.parse(marketsCache)
            // }
            //
            // //normalize market info
            // let normalizedMarketInfo:any = []
            // for(let i = 0; i < marketsCache.length; i++){
            //     let market = marketsCache[i]
            //     log.debug("market: ",market)
            //     market.assetThorchain = market.asset
            //     let assetParsed = parseThorchainAssetString(market.asset)
            //     let normalized = {...assetParsed,...market}
            //     normalizedMarketInfo.push(normalized)
            // }
            //
            // //add tokens and pairs to exchange map
            // let allMarketPairs = getPermutations(output.exchanges.thorchain.assets,2)
            //
            // //iterate over markets
            // log.debug("normalizedMarketInfo: ",normalizedMarketInfo)
            // for(let i = 0; i < allMarketPairs.length; i++){
            //     let pair = allMarketPairs[i]
            //     log.debug(tag,"pair: ",pair)
            //     let pairParts = pair.split("_")
            //     let inputSymbol = pairParts[0]
            //     let outputSymbol = pairParts[1]
            //     let inputMarketInfo = normalizedMarketInfo.filter((e:any) => e.symbol === inputSymbol)
            //     let outputMarketInfo = normalizedMarketInfo.filter((e:any) => e.symbol === outputSymbol)
            //     if(inputMarketInfo && outputMarketInfo && inputMarketInfo[0] && outputMarketInfo[0]){
            //         //TODO handle symbol collision
            //         //if network !==
            //         if(inputMarketInfo.length > 1){
            //             //filter out correct ETH
            //         }
            //         //hack
            //         inputMarketInfo = inputMarketInfo[0]
            //         outputMarketInfo = outputMarketInfo[0]
            //         log.debug(tag,"inputMarketInfo: ",inputMarketInfo)
            //         log.debug(tag,"outputMarketInfo: ",outputMarketInfo)
            //         log.debug(tag,"inputMarketInfo: ",inputMarketInfo.assetPriceUSD)
            //         log.debug(tag,"outputMarketInfo: ",outputMarketInfo.assetPriceUSD)
            //         //usd value input
            //         //usd value output
            //         //rate of input / output
            //         let rate = inputMarketInfo.assetPriceUSD / outputMarketInfo.assetPriceUSD
            //         log.debug(tag,"rate: ",rate)
            //         let market = {
            //             protocal:'thorchain',
            //             pair,
            //             rate
            //         }
            //         output.exchanges.thorchain.markets.push(market)
            //     }
            // }

            //osmo
            if(networks['OSMO']){
                let poolsOsmosis = await redis.get('osmosis:pools')
                if(!pools){
                    poolsOsmosis = await networks['OSMO'].getPools()
                    redis.setex('osmosis:pools',CACHE_TIME,JSON.stringify(poolsOsmosis))
                } else {
                    poolsOsmosis = JSON.parse(poolsOsmosis)
                }
                log.debug(tag,"poolsOsmosis: ",poolsOsmosis)
                output.exchanges.osmosis = {}
                output.exchanges.thorchain.status = []
                output.exchanges.osmosis.markets = []
                output.exchanges.osmosis.assets = ['OSMO','ATOM']
                output.exchanges.osmosis.pools = poolsOsmosis

                //force 1 market OSMO_ATOM
                let market = {
                    protocal:'osmosis',
                    pair:"OSMO_ATOM",
                    rate: '7.036' //TODO dont do this, get rate
                }
                output.exchanges.osmosis.markets.push(market)

                //TODO calulateMe pools/permutations/rates
                // for(let i = 0; i < poolsOsmosis.length; i++){
                //     let pool = poolsOsmosis[i]
                //     //get price
                //     let amountBase = pool.poolAssets[0].token.amount
                //     let amountQuote = pool.poolAssets[1].token.amount
                //     let rate = amountBase / amountQuote
                //     let pair = pool.poolAssets[0].token.denom + "_" + pool.poolAssets[1].token.denom
                //     let market = {
                //         protocal:'osmosis',
                //         pair,
                //         rate
                //     }
                //     output.exchanges.osmosis.markets.push(market)
                // }
            }


            //TODO 0x assets/including tokens?
            redis.set("cache:status",JSON.stringify(output))
            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    @Get('/blockchains')
    public async blockchains() {
        let tag = TAG + " | coins | "
        try{
            //nerf chains under development

            let livechains = [
                'bitcoin',
                'ethereum',
                'thorchain'
            ]

            let coins = {
                live:livechains,
                all:blockchains
            }

            //TODO assets/including tokens

            return(coins)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     *
     * */
    @Get('/blockHeights')
    public async blockHeights() {
        let tag = TAG + " | blockHeights | "
        try{

            let output:any = await redis.hgetall("blockHeights")

            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     *     Get block height
     * */
    @Get('/blockHeight/{network}')
    public async blockHeight(network:string) {
        let tag = TAG + " | blockHeights | "
        try{
            //TODO coin to network
            //stop using asset for network
            if(!networks[network]) throw Error("102: network not supported! ")
            if(!networks[network].getBlockHeight) throw Error("102: getBlockHeight not supported! network: "+network)
            let output:any = await networks[network].getBlockHeight()

            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    * getBlockHeight
    * */
    @Get('/blocks/{coin}/{height}')
    public async getBlockHash(coin:string,height:number) {
        let tag = TAG + " | blockHeights | "
        try{
            if(!networks[coin]) throw Error("102: network not supported! ")
            let output:any = await networks[coin].getBlockHash(height)

            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  get public user info
     * @param account
     */
    @Get('/username/{username}')
    public async username(username:string) {
        let tag = TAG + " | getUsername | "
        try{
            let output:any = {}
            if(!username) throw Error("102: username required! ")

            //get from cache
            let accountInfo = await redis.hgetall(username)
            log.debug(tag,"cache info:",accountInfo)

            if(Object.keys(accountInfo).length === 0){
                //pioneer domain
                try{
                    //TODO add fio back
                    //let domain = "@scatter"
                    //let isAvailable = await networks['FIO'].isAvailable(username+domain)
                    //TODO opt out fio

                    output.available = true
                    output.username = username
                }catch(e){
                    output.isValid = false
                    output.username = username
                }
            } else if (accountInfo.isPublic){
                //TODO what do we want to share?
            } else {
                output.isTaken = true
                output.created = accountInfo.created
                output.isPrivate = true
            }

            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**

     Status codes
     ===============
        -1: errored
         0: unknown
         1: built
         2: broadcasted
         3: confirmed
         4: fullfilled (swap completed)

     * @param invocation
     */
    @Get('/invocation/{invocationId}')
    public async invocation(invocationId:string) {
        let tag = TAG + " | getInvocation | "
        try{
            if(!invocationId) throw Error("102: invocationId required! ")
            let output = await invocationsDB.findOne({invocationId})
            log.info(tag,"invocation MONGO: ",output)

            //hack, if a disagreement in txid, use broadcast (bad hash bug) TODO FIXME
            if(
                output &&
                output.signedTx?.txid &&
                output.broadcast &&
                output.broadcast?.result?.txid){
                if(output.signedTx?.txid !== output.broadcast?.result?.txid){
                    //replace
                    output.signedTx.txid = output.broadcast?.result?.txid
                    let mongoSave = await invocationsDB.update(
                        {invocationId:output.invocationId},
                        {$set:{signedTx:output.signedTx}})
                    log.debug(tag,"updated incorrect txid: ",mongoSave)
                }
                //replace
                output.signedTx.txid = output.broadcast?.result?.txid
            }

            let txid
            if(output && output.broadcast && output.broadcast.txid) txid = output.broadcast.txid
            if(!txid && output.signedTx && output.signedTx.txid) txid = output.signedTx.txid


            //if type is swap get blockchain info for fullfillment
            if(output && output.state === 'broadcasted'){
                if(!output.isConfirmed){
                    log.info(tag,"Checkpoint broadcasted but NOT confirmed!")
                    //get confirmation status
                    // let txid = output.signedTx.txid || output.broadcast.txid
                    // if(!txid && output?.broadcast && output?.broadcast.result && output?.broadcast?.result?.txid) txid = output?.broadcast?.result?.txid
                    // log.info(tag,"***** txid: ",txid)

                    let txInfo
                    //TODO normalize tx response between ALL blockchains

                    log.info(tag,"txid: ",txid)
                    if(txid){
                        try{
                            log.info(tag,"txid: ",txid)
                            if(output?.invocation?.swap?.input?.blockchain){
                                //get block explorer for txid
                                let explorerUrl = getExplorerTxUrl(output?.invocation?.swap?.input?.blockchain,txid,false)
                                console.log("explorerUrl: ",explorerUrl)
                                output.depositUrl = explorerUrl

                                //update entry
                                let mongoSave = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{depositUrl:explorerUrl}})
                            }

                            if(UTXO_COINS.indexOf(output.network) >= 0){
                                txInfo = await networks['ANY'].getTransaction(output.network,txid)
                                log.info(tag,"UTXO txInfo: ",txInfo)
                            } else {
                                if(!networks[output.network]) throw Error("102: coin not supported! coin: "+output.network)
                                txInfo = await networks[output.network].getTransaction(txid)
                                log.debug(tag,"txInfo: ",txInfo)
                            }
                            //@TODO standardize getTransaction in network

                            if(txInfo && txInfo.blockHeight && parseInt(txInfo.blockHeight) > 0){
                                log.info(tag,"Confirmed!")
                                output.isConfirmed = true

                                //update entry
                                let mongoSave3 = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{state:"confirmed"}})
                                log.info(tag,"mongoSave3: ",mongoSave3)
                                output.resultUpdateState = mongoSave3

                                //update entry
                                let mongoSave = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{isConfirmed:true}})
                                output.resultUpdate = mongoSave
                                //push event
                                publisher.publish('invocationUpdate',JSON.stringify(output))
                            }

                            if(txInfo && txInfo.height){
                                log.debug(tag,"Confirmed!")
                                output.isConfirmed = true

                                //update entry
                                let mongoSave3 = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{state:"confirmed"}})
                                log.info(tag,"mongoSave3: ",mongoSave3)
                                output.resultUpdateState = mongoSave3

                                //update entry
                                let mongoSave = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{isConfirmed:true}})
                                output.resultUpdate = mongoSave
                                //push event
                                publisher.publish('invocationUpdate',JSON.stringify(output))
                            }

                            if(txInfo && txInfo.tx_response && txInfo.tx_response.height){
                                log.debug(tag,"Confirmed!")
                                output.isConfirmed = true

                                //update entry
                                let mongoSave3 = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{state:"confirmed"}})
                                log.info(tag,"mongoSave3: ",mongoSave3)
                                output.resultUpdateState = mongoSave3

                                //update entry
                                let mongoSave = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{isConfirmed:true}})
                                output.resultUpdate = mongoSave
                                //push event
                                publisher.publish('invocationUpdate',JSON.stringify(output))
                            }

                            if(txInfo && txInfo.txInfo && txInfo.txInfo.blockNumber){
                                log.debug(tag,"Confirmed!")
                                output.isConfirmed = true

                                //update entry
                                let mongoSave3 = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{state:"confirmed"}})
                                log.info(tag,"mongoSave3: ",mongoSave3)
                                output.resultUpdateState = mongoSave3

                                //update entry
                                let mongoSave = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{isConfirmed:true}})
                                output.resultUpdate = mongoSave
                                //push event
                                publisher.publish('invocationUpdate',JSON.stringify(output))
                            }
                        }catch(e){
                            log.error(e)
                            log.debug(tag,"Tx not found!")
                        }
                    } else {
                        log.error("Unable to deturmine the TXID for invocation! can not lookup!")
                    }
                }

            }

            if(output.type === 'swap' && output.isConfirmed){
                //txid
                try{
                    log.info(tag,"Checkpoint thorchain swap check ID")
                    //parse tx
                    txid = txid.replace("0X","")
                    log.info(tag,"txid: ",txid)
                    let midgardInfo = await midgard.getTransaction(txid)
                    log.info(tag,"midgardInfo: ",midgardInfo)

                    if(midgardInfo && midgardInfo.actions && midgardInfo.actions[0]){
                        let depositInfo = midgardInfo.actions[0].in
                        log.debug(tag,"deposit: ",depositInfo)

                        let fullfillmentInfo = midgardInfo.actions[0]
                        log.debug(tag,"fullfillmentInfo: ",JSON.stringify(fullfillmentInfo))

                        if(fullfillmentInfo.status === 'success'){
                            if(fullfillmentInfo.type === 'refund'){
                                //refund
                                output.isRefunded = true
                                output.refundTxid = fullfillmentInfo.out[0].txID

                                //update entry
                                let mongoSave3 = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{state:"refunded"}})
                                log.info(tag,"mongoSave3: ",mongoSave3)
                                output.resultUpdateState = mongoSave3

                                //
                                let mongoSave = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{isRefunded:true,refundTxid:output.refundTxid}})
                                output.resultUpdateFullment = mongoSave

                            } else {
                                //@TODO handle explcitly
                                log.debug(tag,"fullfillmentInfo: ",fullfillmentInfo)
                                log.debug(tag,"fullfillmentInfo: ",fullfillmentInfo.out[0].txID)


                                output.isFullfilled = true
                                output.fullfillmentTxid = fullfillmentInfo.out[0].txID

                                //get block explorer for txid
                                log.info(tag,"output?.invocation?.swap?.output?.blockchain: ",output?.invocation?.swap?.output?.blockchain)
                                let explorerUrl = getExplorerTxUrl(output?.invocation?.swap?.output?.blockchain,output.fullfillmentTxid,false)
                                log.info(tag,"explorerUrl: ",explorerUrl)
                                output.withdrawalUrl = explorerUrl

                                //update entry
                                let mongoSave3 = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{state:"fullfilled"}})
                                log.info(tag,"mongoSave3: ",mongoSave3)
                                output.resultUpdateState = mongoSave3

                                //update entry
                                let mongoSave2 = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{withdrawalUrl:output.withdrawalUrl}})
                                log.info(tag,"mongoSave2: ",mongoSave2)
                                output.resultUpdateWithdrawalUrl = mongoSave2

                                //
                                let mongoSave = await invocationsDB.update(
                                    {invocationId:output.invocationId},
                                    {$set:{isFullfilled:true,fullfillmentTxid:output.fullfillmentTxid}})
                                output.resultUpdateFullment = mongoSave
                            }

                        }
                    } else {
                        log.debug(tag,"not fullfilled!")
                    }
                }catch(e){
                    log.error(" txid Not found!")
                }
            } else {
                log.info(tag,"Not a swap! ")
                log.info(tag,"Not a swap! ",output.type)
                log.info(tag,"Not a swap! ",output.isConfirmed)
            }
            //
            // if(!output){
            //     output = {
            //         error:true,
            //         message:"No invocation found with ID: "+invocationId
            //     }
            // }
            log.info("output: ",output)
            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }


    /**
     *  get balance of an address
     */
    @Get('/getPubkeyBalance/{asset}/{pubkey}')
    public async getPubkeyBalance(asset:string,pubkey:string) {
        let tag = TAG + " | getPubkeyBalance | "
        try{
            log.info(tag,{asset,pubkey})
            let output = await redis.get("cache:balance:"+pubkey+":"+asset)
            networks.ETH.init()
            if(!output || CACHE_OVERRIDE){
                //if coin = token, network = ETH
                if(false){
                    //TODO
                    output = await networks['ETH'].getBalanceToken(pubkey,asset)
                } else if(asset === 'ETH'){
                    log.info(tag,"asset ETH path")
                    output = await networks['ETH'].getBalanceAddress(pubkey)
                } else if(UTXO_COINS.indexOf(asset) >= 0){
                    log.info(tag,"UTXO_COINS path")
                    //get xpub/zpub
                    output = await networks['ANY'].getBalanceByXpub(asset,pubkey)
                } else {
                    if(!networks[asset]) {
                        throw Error("109: asset not supported! coin: "+asset)
                    } else {
                        log.info(tag,"default path")
                        log.info(tag,"default asset: ",asset)
                        log.info(tag,"default pubkey: ",pubkey)
                        output = await networks[asset].getBalance(pubkey)
                    }
                }
            }

            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  getTransaction
     */
    @Get('{network}/getTransaction/{txid}/{type}')
    public async getTransaction(network:string,txid:string,type?:string) {
        let tag = TAG + " | getTransaction | "
        try{
            if(!txid) throw Error("102: txid required! ")

            log.debug(tag,"network: ",network)
            log.debug(tag,"txid: ",txid)
            let output:any = {}
            output.coin = network
            output.asset = network
            output.network = network
            output.txid = txid
            if(type) output.type = type
            //if UXTO coin = any
            if(UTXO_COINS.indexOf(network) >= 0){
                output = await networks['ANY'].getTransaction(network,txid)
            } else {
                if(!networks[network]) throw Error("102: coin not supported! coin: "+network)
                output = await networks[network].getTransaction(txid)
            }

            //get midgard info
            if(type === 'thorchain'){
                let midgardInfo = midgard.getTransaction(txid)
                output.midgardInfo = midgardInfo
            }

            //TODO if dex?
            //TODO if nft

            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    @Get('/getFeeInfo/{coin}')
    public async getFeeInfo(coin:string) {
        let tag = TAG + " | getFee | "
        try{
            let output
            if(UTXO_COINS.indexOf(coin) >= 0){
                //TODO supported assets
                output = await networks['ANY'].getFee(coin)
                log.debug("output:",output)
                //else error
            }else{
                output = await networks[coin].getFee(coin)
            }

            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  getValidators
     */
    @Get('/{network}/getValidators')
    public async getValidators(network:string) {
        let tag = TAG + " | getValidators | "
        try{
            if(PoSchains[network.toLowerCase()] >= 0){
                //support symbol instead of network
                if(!networks[network]){
                    //lookup symbol by long
                    network = COIN_MAP[network]
                }

                let output = await networks[network].getValidators()
                log.debug("getValidators: output:",output)
                //else error

                return(output)
            }else{
                throw Error(network+" is not a PoS chain!")
            }
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  getValidators
     */
    @Get('/{network}/getDelegations/{address}/{validator}')
    public async getDelegations(network:string,address:string,validator:string) {
        let tag = TAG + " | getDelegations | "
        try{
            if(PoSchains[network.toLowerCase()] >= 0){
                //support symbol instead of network
                if(!networks[network]){
                    //lookup symbol by long
                    network = COIN_MAP[network]
                }

                let output = await networks[network].getDelegations(address,validator)
                log.debug("getValidators: output:",output)
                //else error

                return(output)
            }else{
                throw Error(network+" is not a PoS chain!")
            }
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  Retrieve account info
     */
    @Get('/getChangeAddress/{network}/{xpub}')
    public async getChangeAddress(network:string,xpub:string) {
        let tag = TAG + " | getChangeAddress | "
        try{
            log.debug(tag,"network: ",network)
            log.debug(tag,"xpub: ",xpub)
            await networks.ANY.init()
            //log.debug("networks: ",networks)
            //log.debug("networks: ",networks.ANY)
            let data = await networks.ANY.getPubkeyInfo(network,xpub)
            log.debug("data: ",data)
            let changeIndex: number = 0
            let receiveIndex: number = 0

            //iterate
            if (data.tokens) {
                console.log(tag, "checkpoint tokens: ",data.tokens)
                for(let i = 0; i < data.tokens.length; i++){
                    let token = data.tokens[i]
                    const splitPath = token.path?.split('/') || []
                    let [, , , , change, index] = splitPath
                    console.log(tag, "splitPath: ",splitPath)
                    console.log(tag, "change: ",change)
                    console.log(tag, "index: ",index)
                    index = parseInt(index)
                    change = parseInt(change)

                    //
                    if (change === 0) {
                        if (index >= receiveIndex) {
                            receiveIndex = Number(index) + 1
                        } else {
                            if (receiveIndex < Number(index)) {
                                receiveIndex = Number(index) + 1
                            }
                        }
                    }

                    if (change === 1) {
                        if (index >= changeIndex) {
                            changeIndex = Number(index) + 1
                        } else {
                            if (changeIndex < Number(index)) {
                                changeIndex = Number(index) + 1
                            }
                        }
                    }

                    // if(token.changeIndex > changeIndex) changeIndex = token.changeIndex
                    // if(token.receiveIndex > receiveIndex) receiveIndex = token.receiveIndex
                }

                // for (let i = data.tokens.length - 1; i >= 0 && (changeIndex === null || receiveIndex === null); i--) {
                //     const splitPath = data.tokens[i].path?.split('/') || []
                //     console.log(tag, "splitPath: ",splitPath)
                //     const [, , , , change, index] = splitPath
                //
                //     if (index === '0') {
                //         if (receiveIndex === null) {
                //             receiveIndex = Number(index) + 1
                //         } else {
                //             if (receiveIndex < Number(index)) {
                //                 receiveIndex = Number(index) + 1
                //             }
                //         }
                //     }
                //     if (change === '1') {
                //         if (changeIndex === null) {
                //             changeIndex = Number(index) + 1
                //         } else {
                //             if (changeIndex < Number(index)) {
                //                 changeIndex = Number(index) + 1
                //             }
                //         }
                //     }
                // }
            }

            return {
                changeIndex,
                receiveIndex
            }
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  Retrieve account info
     */
    @Get('/getNewAddress/{network}/{xpub}')
    public async getNewAddress(network:string,xpub:string) {
        let tag = TAG + " | getNewAddress | "
        try{
            let output:any = []
            //TODO if UTXO coin else error

            log.debug(tag,"network: ",network)
            log.debug(tag,"xpub: ",xpub)
            await networks.ANY.init()
            //log.debug("networks: ",networks)
            //log.debug("networks: ",networks.ANY)
            let data = await networks.ANY.getPubkeyInfo(network,xpub)

            let changeIndex: number | null = null
            let receiveIndex: number | null = null

            //iterate
            if (data.tokens) {
                for (let i = data.tokens.length - 1; i >= 0 && (changeIndex === null || receiveIndex === null); i--) {
                    const splitPath = data.tokens[i].path?.split('/') || []
                    const [, , , , change, index] = splitPath

                    if (change === '0') {
                        if (receiveIndex === null) {
                            receiveIndex = Number(index) + 1
                        } else {
                            if (receiveIndex < Number(index)) {
                                receiveIndex = Number(index) + 1
                            }
                        }
                    }
                    if (change === '1') {
                        if (changeIndex === null) {
                            changeIndex = Number(index) + 1
                        } else {
                            if (changeIndex < Number(index)) {
                                changeIndex = Number(index) + 1
                            }
                        }
                    }
                }
            }

            return {
                receiveIndex
            }
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  Retrieve account info
     */
    @Get('/listUnspent/{network}/{xpub}')
    public async listUnspent(network:string,xpub:string) {
        let tag = TAG + " | listUnspent | "
        try{
            let output:any = []
            //TODO if UTXO coin else error
            //TODO does this scale on large xpubs?
            log.debug(tag,"network: ",network)
            log.debug(tag,"xpub: ",xpub)
            await networks.ANY.init()
            //log.debug("networks: ",networks)
            //log.debug("networks: ",networks.ANY)
            let inputs = await networks.ANY.utxosByXpub(network,xpub)
            log.debug("inputs: ",inputs)
            //for each get hex
            for(let i = 0; i < inputs.length; i++){
                let input = inputs[i]
                log.debug(tag,"input: ",input)
                //get hex info
                let rawInfo = await networks.ANY.getTransaction(network,input.txid)
                log.debug(tag,"rawInfo: ",rawInfo)
                log.debug(tag,"rawInfo: ",rawInfo.vin[0].addresses)
                //TODO type from hdwallet-code txInput:
                //TODO move this into module
                //format inputs
                let normalized_inputs = []
                for(let i = 0; i < rawInfo.vin.length; i++){
                    let vin = rawInfo.vin[i]
                    let rawInfoInput = await networks.ANY.getTransaction(network,vin.txid)
                    log.debug(tag,"rawInfoInput: ",JSON.stringify(rawInfoInput))
                    let input = {
                        txid:vin.txid,
                        vout:vin.vout,
                        addr:vin.addresses[0], //TODO if multi? multisig?
                        scriptSig:{
                            hex:"0014459a4d8600bfdaa52708eaae5be1dcf959069efc" //from input? //TODO wtf is this hex?
                        },
                        valueSat:parseInt(vin.value),
                        value:parseInt(vin.value) / 100000000,
                    }
                    normalized_inputs.push(input)
                }

                //
                let normalized_outputs = []
                for(let i = 0; i < rawInfo.vout.length; i++){
                    let vout = rawInfo.vout[i]
                    let output = {
                        value:vout.value,
                        scriptPubKey:{
                            hex:vout.hex
                        },
                    }
                    normalized_outputs.push(output)
                }

                input.tx = {
                    txid:rawInfo.txid,
                    hash:rawInfo.txid,
                    version:rawInfo.version,
                    locktime:rawInfo.lockTime,
                    vin:normalized_inputs,
                    vout:normalized_outputs,
                    hex:rawInfo.hex
                }
                input.hex = rawInfo.hex
                input.coin = network
                input.network = network
                output.push(input)
            }

            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  Retrieve account info
     */
    @Get('/utxo/getBalance/{network}/{xpub}')
    public async getBalance(network:string,xpub:string) {
        let tag = TAG + " | getBalance | "
        try{
            let output:any = []
            //TODO if UTXO coin else error
            //TODO does this scale on large xpubs?
            log.debug(tag,"network: ",network)
            log.debug(tag,"xpub: ",xpub)
            await networks.ANY.init()
            //log.debug("networks: ",networks)
            //log.debug("networks: ",networks.ANY)
            let balances = await networks.ANY.getBalanceByXpub(network,xpub)

            return balances
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     *  Retrieve information on a specific address given the address
     */
    @Get('/getAccountInfo/{network}/{address}')
    public async getAccountInfo(network:string,address:string) {
        let tag = TAG + " | accountsFromPubkey | "
        try{
            log.debug(tag,"network: ",network)
            log.debug(tag,"address: ",address)
            log.debug(tag,"networks: ",networks)
            if(!networks[network]) throw Error("103: network not supported! network: "+network)
            let accounts = await networks[network].getAccount(address)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  Retrieve accounts for EOS pubkey
     */
    @Get('/eos/accountsFromPubkey/{pubkey}')
    public async accountsFromEosPubkey(pubkey:string) {
        let tag = TAG + " | accountsFromEosPubkey | "
        try{
            let accounts = await networks['FIO'].getAccountsFromPubkey(pubkey)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  Retrieve public user info
     */
    @Get('/eos/accountInfo/{username}')
    public async eosAccountInfo(username:string) {
        let tag = TAG + " | eosAccountInfo* | "
        try{
            let accounts = await networks['EOS'].getAccount(username)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  Tokens balance check
     */
    @Get('/eth/getBalanceToken/{address}/{token}')
    public async getBalanceToken(address:string,token:string) {
        let tag = TAG + " | getBalanceToken | "
        try{
            let accounts = await networks['ETH'].getBalanceToken(token,address)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }



    /**
     *  ETH nonce check
     */
    @Get('/eth/getNonce/{address}')
    public async getNonce(address:string) {
        let tag = TAG + " | getNonce | "
        try{
            //if cached
            //get last tx index
            console.log("networks['ETH']: ",networks['ETH'])
            console.log("address: ",address)
            let accounts = await networks['ETH'].getNonce(address)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  ETH getGasPrice
     */
    @Get('/eth/getGasPrice')
    public async getGasPrice() {
        let tag = TAG + " | getGasPrice | "
        try{
            let accounts = await networks['ETH'].getGasPrice()
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  ETH getTransferData
     */
    @Get('/eth/getTransferData/{coin}/{address}/{amount}')
    public async getTransferData(coin:string,address:string,amount:number) {
        let tag = TAG + " | getGasPrice | "
        try{
            let accounts = await networks['ETH'].getTransferData(coin,address,amount)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  ETH get tx count info (for nonce calculations)
     */
    @Get('/eth/txCount/{address}')
    public async getTxCount(address:string) {
        let tag = TAG + " | get_tx_count | "
        try{
            let accounts = await networks['ETH'].getTxCount(address)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  ETH get token balance and info
     */
    @Get('/eth/getTokens/{address}')
    public async getTokenInfo(address:string) {
        let tag = TAG + " | getGasPrice | "
        try{
            let accounts = await networks['ETH'].getAddressInfo(address)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  EOS get token balance and info
     */
    @Get('/eos/validateEosUsername/{username}')
    public async validateEosUsername(username:string) {
        let tag = TAG + " | validateEosUsername | "
        try{
            let accounts = await networks['EOS'].getAccount(username)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     *  EOS get token balance and info
     */
    @Get('/eos/getEosAccountsByPubkey/{pubkey}')
    public async getEosAccountsByPubkey(pubkey:string) {
        let tag = TAG + " | getEosAccountsByPubkey | "
        try{
            let accounts = await networks['EOS'].getAccountsFromPubkey(pubkey)
            return accounts
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    //TODO
    /**
     * Mempool intake (blocknative)
     *
     */

    @Post('/eth/getAllowance')
    public async getAllowance(@Body() body: BodyAllowance): Promise<any> {
        let tag = TAG + " | getAllowance | "
        try{

            log.debug(tag,"body: ",body)
            let result = await networks['ETH'].getAllowance(body.token,body.spender,body.sender)


            return(result);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    //multi chain
    @Post('/getFee')
    public async getFee(@Body() body: any): Promise<any> {
        let tag = TAG + " | getFee | "
        try{
            log.debug(tag,"mempool tx: ",body)

            //TODO filter by body.asset.chain
            //if()

            let feeResult = networks['ETH'].getFees(body)

            //save to mongo


            return(feeResult);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    //ETH only
    @Post('/estimateFeesWithGasPricesAndLimits')
    public async estimateFeesWithGasPricesAndLimits(@Body() body: any): Promise<any> {
        let tag = TAG + " | getFee | "
        try{
            log.debug(tag,"mempool tx: ",body)
            if(!body.amount) throw Error(" amount field required! ")
            if(!body.asset) throw Error(" asset field required! ")
            if(!body.asset.symbol) throw Error(" asset symbol field required! ")
            if(body.asset.symbol !== 'ETH') throw Error("Unhandled asset! "+body.asset.symbol)

            //TODO handle mainnet/testnet switch
            await networks.ETH.init()

            console.log("networks['ETH']: ",networks['ETH'])
            let feeResult = networks['ETH'].getFees(body)

            //save to mongo


            return(feeResult);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    @Post('/estimateFee')
    public async estimateFee(@Body() body: EstimateFeeBody): Promise<any> {
        let tag = TAG + " | estimateFee | "
        try{
            let output:any = {}
            log.debug(tag,"body: ",body)

            let asset = {
                chain:"ETH",
                symbol:"ETH",
                ticker:"ETH",
            }
            let params = [
                body.contract,
                "0x0000000000000000000000000000000000000000",
                body.amount,
                body.memo
            ]


            //TODO if not eth
            networks.ETH.init({testnet:true})
            let response = await networks['ETH'].estimateFee(asset,params)

            return(response.data)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }
    /*
            let swap = {
                inboundAddress: {
                    chain: 'ETH',
                    pub_key: 'tthorpub1addwnpepqvuy8vh6yj4h28xp6gfpjsztpj6p46y2rs0763t6uw9f6lkky0ly5uvwla6',
                    address: '0x36286e570c412531aad366154eea9867b0e71755',
                    router: '0x9d496De78837f5a2bA64Cb40E62c19FBcB67f55a',
                    halted: false
                },
                asset: {
                    chain: 'ETH',
                    symbol: 'ETH',
                    ticker: 'ETH',
                    iconPath: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/ETH-1C9/logo.png'
                },
                memo: '=:THOR.RUNE:tthor1veu9u5h4mtdq34fjgu982s8pympp6w87ag58nh',
                amount: "0.01"
            }

     */
    @Post('/getThorchainMemoEncoded')
    public async getThorchainMemoEncoded(@Body() body: any): Promise<any> {
        let tag = TAG + " | getThorchainMemoEncoded | "
        try{
            //TODO handle mainnet
            networks.ETH.init()
            log.debug(tag,"body: ",body)

            let resp = await networks['ETH'].getMemoEncoded(body)
            return(resp)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    @Post('/getFeesWithMemo')
    public async getFeesWithMemo(@Body() body: GetFeesWithMemoBody): Promise<any> {
        let tag = TAG + " | getFeesWithMemo | "
        try{
            let output:any = {}
            log.debug(tag,"body: ",body)

            if(UTXO_COINS.indexOf(body.network) >= 0){
                //TODO supported assets
                let resp = await networks['ANY'].getFeesWithRates(body.network,body.memo)
                log.debug("resp:",resp)
                //else error
                output = resp
            }else{
                //not supported
                throw Error("coin not supported! coin: "+body.network)
            }

            return(output)
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    @Post('/pushTx')
    public async pushTx(@Body() body: any): Promise<any> {
        let tag = TAG + " | pushTx | "
        try{
            log.debug(tag,"mempool tx: ",body)

            //push to redis
            publisher.publish("mempool",JSON.stringify(body))

            //save to mongo


            return(true);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    //TODO
    // /**
    //  * UTXO Tooles
    //  *
    //  *
    //  *
    //  * Create Unsigned Transaction
    //  *
    //  */
    //
    // @Post('/createUnsignedTransaction')
    // public async createUnsignedTransaction(@Body() body: UnsignedUtxoRequest): Promise<any> {
    //     let tag = TAG + " | createUnsignedTransaction | "
    //     try{
    //         log.debug(tag,"")
    //
    //         let result = await network.createUnsignedTransaction(body)
    //
    //         return(result);
    //     }catch(e){
    //         let errorResp:Error = {
    //             success:false,
    //             tag,
    //             e
    //         }
    //         log.error(tag,"e: ",{errorResp})
    //         throw new ApiError("error",503,"error: "+e.toString());
    //     }
    // }

    /**
     * BroadCast a signed transaction
     */
    @Post('/broadcast')
    public async broadcast(@Body() body: BroadcastBody): Promise<any> {
        let tag = TAG + " | broadcast | "
        try{
            log.info(tag,"************************** CHECKPOINT *******************88 ")
            log.info(tag,"body: ",body)
            if(!body.network) throw Error("104: network required! ")
            if(!body.serialized) throw Error("105: must have serialized payload! ")

            let output:any = {
                success:false
            }
            let network = body.network

            //if(!networks[coin]) throw Error("102: unknown network coin:"+coin)
            let updateResult2 = await invocationsDB.update({invocationId:body.invocationId},{$set:{state:'broadcasted'}})
            log.info(tag,"updateResult2: ********* ",updateResult2)

            //if
            let invocationInfo:any = {}
            if(body.invocationId){
                log.info(tag,"invocationId: ",body.invocationId)
                //get invocation
                let invocationInfoQuery = await invocationsDB.findOne({invocationId:body.invocationId})
                log.debug(tag,"invocationInfoQuery: ",invocationInfoQuery)
                if(invocationInfoQuery){
                    invocationInfo = invocationInfoQuery
                }
                log.debug(tag,"invocationInfo: ",invocationInfo)
                log.debug(tag,"Release InvocationId: ",body.invocationId)
                log.debug(tag,"Release body.txid: ",body.txid)
                redis.lpush(body.invocationId,body.txid)

                let updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{state:'broadcasted'}})
                log.info(tag,"invocation updateResult: ",updateResult)
            } else {
                log.error(tag,"No invocationId on body.")
                throw Error('invocationId required!')
            }

            //broadcast
            if(!body.noBroadcast){
                log.debug(tag,"broadcasting!")
                let result
                try{
                    if(network === 'EOS'){
                        throw Error("103: EOS not finished!")
                        //result = await networks[network].broadcast(body.broadcastBody)
                    } else if(network === 'FIO'){
                        let broadcast = {
                            signatures:
                                [ body.signature ],
                            compression: "none",
                            packed_context_free_data: '',
                            packed_trx:
                            body.serialized
                        }
                        if(!body.type) {
                            log.error(tag,"invalid payload!: ",broadcast)
                            throw Error("Fio txs require type!")
                        }

                        //broadcast based on tx
                        switch(body.type) {
                            case "fioSignAddPubAddressTx":
                                log.debug(tag,"checkpoint: fioSignAddPubAddressTx ")
                                log.debug(tag,"broadcast: ",broadcast)
                                result = await networks[network].broadcastAddPubAddressTx(broadcast)
                                break;
                            case "fioSignRegisterDomainTx":
                                //TODO
                                break;
                            case "fioSignRegisterFioAddressTx":
                                //TODO
                                break;
                            case "fioSignNewFundsRequestTx":
                                log.debug(tag,"checkpoint: broadcastNewFundsRequestTx ")
                                log.debug(tag,"broadcast: ",broadcast)
                                result = await networks[network].broadcastNewFundsRequestTx(broadcast)
                                break;
                            default:
                                throw Error("Type not supported! "+body.type)
                        }
                    } else if(UTXO_COINS.indexOf(network) >= 0){
                        log.debug(tag,"123 UXTO DETECTED!: ",network)
                        //normal broadcast
                        await networks.ANY.init('full')
                        try{
                            if(!body.serialized) throw Error("signature required!")
                            if(!body.network) throw Error("network required!")
                            log.debug(tag,"network: ",network)
                            log.debug(tag,"body.serialized: ",body.serialized)
                            result = await networks['ANY'].broadcast(network,body.serialized)
                            log.debug(tag,"result: ",result)
                            // if(result && result.txid)
                            if(result.success){
                                output.success = true
                                output.txid = result.txid
                            }
                            if(result.error){
                                output.success = false
                                output.error = result.error
                            }
                            if(!output.error && !output.success) output.error = "unknown error"
                            if(!output.success) output.success = false
                            log.info(tag,"result: ",result)
                        }catch(e){
                            log.error(tag,"ERRROR ON BROADCAST e: ",e)
                            result = {
                                error:true,
                                errorMsg: e.toString()
                            }
                        }
                    } else {
                        log.info(tag,"normal broadcast! ")
                        //All over coins
                        //normal broadcast
                        await networks[network].init()
                        try{
                            log.info(tag,"body: ",body)
                            log.info(tag,"body.serialized: ",body.serialized)
                            log.info(tag,"network: ",network)

                            let result = await networks[network].broadcast(body.serialized)
                            log.info(tag,"BROADCASAT RESULT: ",result)
                            output.result = result
                            if(result.success){
                                output.success = true
                                if(result.txid) {
                                    output.txid = result.txid
                                    //update txid URL
                                    output.explorerUrl = getExplorerTxUrl(network,output.txid)
                                }
                            } else {
                                if(result.error) output.error = result.error
                            }
                            log.info(tag,"output: ",output)
                            log.info(tag,"result: ",result)
                        }catch(e){
                            log.error(tag,"Failed to broadcast!: ",e)
                            result = {
                                error:true,
                                errorMsg: e.toString()
                            }
                        }
                    }
                }catch(e){
                    result.error = true
                    result.errorMsg = e.toString()
                }
                let updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{broadcast:output}})
                log.debug(tag,"updateResult: ",updateResult)
            } else {
                log.notice(tag,"Not broadcasting!")
                output.success = true
                output.broadcast = false
                //result = body.invocationId
                let updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{broadcast:{noBroadcast:true}}})
                log.debug(tag,"updateResult: ",updateResult)
            }

            // let mongoEntry:any = body
            // //add to txsDB
            // let tags = ['internal',network,'pending']
            // if(invocationInfo.username) tags.push(invocationInfo.username)
            // if(invocationInfo.context) tags.push(invocationInfo.context)
            // if(invocationInfo.type) tags.push(invocationInfo.type)
            // if(invocationInfo.invocation && invocationInfo.invocation.address) tags.push(invocationInfo.invocation.address)
            // mongoEntry.tags = tags
            // //mongoEntry.result = result
            // mongoEntry.pending = true
            // mongoEntry.broadcasted = new Date().getTime()
            // try{
            //     if(mongoEntry.txid && mongoEntry.txid !== "" && mongoEntry.txid !== "unknown")output.saveTx = await txsDB.insert(mongoEntry)
            // }catch(e){
            //     log.error(tag,"e: ",e)
            //     //duplicate
            // }

            return(output);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }
}
