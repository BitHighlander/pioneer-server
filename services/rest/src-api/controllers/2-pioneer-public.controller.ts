/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
const midgard = require("@pioneer-platform/midgard-client")

let connection  = require("@pioneer-platform/default-mongo")
const markets = require('@pioneer-platform/markets')
let usersDB = connection.get('users')
let pubkeysDB = connection.get('pubkeys')
let txsDB = connection.get('transactions')
let invocationsDB = connection.get('invocations')
let utxosDB = connection.get('utxo')

usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

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

if(process.env['FEATURE_LITECOIN_BLOCKCHAIN']){
    blockchains.push('litecoin')
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

//Cache time
let CACHE_TIME = 1000 * 60 * 1
let CACHE_OVERRIDE = true
//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';
// import * as express from 'express';

import {
    Error,
    ApiError,
    Asset,
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
    COIN_MAP_LONG
} = require('@pioneer-platform/pioneer-coins')



const getPermutations = function(list, maxLen) {
    // Copy initial values as arrays
    let perm = list.map(function(val) {
        return [val];
    });
    // Our permutation generator
    let generate = function(perm, maxLen, currLen) {
        // Reached desired length
        if (currLen === maxLen) {
            return perm;
        }
        // For each existing permutation
        for (let i = 0, len = perm.length; i < len; i++) {
            let currPerm = perm.shift();
            // Create new permutation
            for (let k = 0; k < list.length; k++) {
                let pair = currPerm.concat(list[k])
                if(pair[0] !== pair[1]){
                    perm.push(pair[0]+"_"+pair[1]);
                }
            }
        }
        // Recurse
        return generate(perm, maxLen, currLen + 1);
    };
    // Start with size 1 because of initial values
    return generate(perm, maxLen, 1);
};


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
            globals.online = online
            globals.blockchains = blockchains
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
                redis.setex('thorchain:pools',400,JSON.stringify(pools))
            } else {
                pools = JSON.parse(pools)
            }

            //markets

            let output:any = {}
            output.thorchain = []
            output.exchanges = {}
            output.exchanges.protocals = ['thorchain','0x','osmosis']
            output.exchanges.assets = []
            output.exchanges.pools = pools
            for(let i = 0; i < pools.length; i++){
                let pool = pools[i]
                output.exchanges.assets.push(pool.chain)
                let entry:any = {
                    blockchain:COIN_MAP_LONG[pool.chain].toLowerCase(),
                }
                if(pool.halted === false){
                    entry.online = true
                } else {
                    entry.online = false
                }
                output.thorchain.push(entry)
            }

            //get rate for every market
            let marketsCache = await redis.get('thorchain:markets')
            if(!marketsCache){
                marketsCache = await midgard.getPools()
                redis.setex('thorchain:markets',400,JSON.stringify(marketsCache))
            } else {
                marketsCache = JSON.parse(marketsCache)
            }

            let parseThorchainAssetString = function(input){
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
            log.info("markets: ",markets)

            //normalize market info
            let normalizedMarketInfo:any = []
            for(let i = 0; i < marketsCache.length; i++){
                let market = marketsCache[i]
                log.info("market: ",market)
                market.assetThorchain = market.asset
                let assetParsed = parseThorchainAssetString(market.asset)
                let normalized = {...assetParsed,...market}
                normalizedMarketInfo.push(normalized)
            }

            //add tokens and pairs to exchange map
            let allMarketPairs = getPermutations(output.exchanges.assets,2)

            //iterate over markets
            output.exchanges.markets = []
            log.info("normalizedMarketInfo: ",normalizedMarketInfo)
            for(let i = 0; i < allMarketPairs.length; i++){
                let pair = allMarketPairs[i]
                log.info(tag,"pair: ",pair)
                let pairParts = pair.split("_")
                let inputSymbol = pairParts[0]
                let outputSymbol = pairParts[1]
                let inputMarketInfo = normalizedMarketInfo.filter((e:any) => e.symbol === inputSymbol)
                let outputMarketInfo = normalizedMarketInfo.filter((e:any) => e.symbol === outputSymbol)
                if(inputMarketInfo && outputMarketInfo && inputMarketInfo[0] && outputMarketInfo[0]){
                    //TODO handle symbol collision
                    //if network !==
                    if(inputMarketInfo.length > 1){
                        //filter out correct ETH
                    }
                    //hack
                    inputMarketInfo = inputMarketInfo[0]
                    outputMarketInfo = outputMarketInfo[0]
                    log.info(tag,"inputMarketInfo: ",inputMarketInfo)
                    log.info(tag,"outputMarketInfo: ",outputMarketInfo)
                    log.info(tag,"inputMarketInfo: ",inputMarketInfo.assetPriceUSD)
                    log.info(tag,"outputMarketInfo: ",outputMarketInfo.assetPriceUSD)
                    //usd value input
                    //usd value output
                    //rate of input / output
                    let rate = inputMarketInfo.assetPriceUSD / outputMarketInfo.assetPriceUSD
                    log.info(tag,"rate: ",rate)
                    let market = {
                        protocal:'thorchain',
                        pair,
                        rate
                    }
                    output.exchanges.markets.push(market)
                }
            }
            //TODO why did I move this here?
            //get market data from markets
            // let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
            // let marketCacheCoincap = await redis.get('markets:Coincap')
            //
            // if(!marketCacheCoinGecko){
            //     let marketInfoCoinGecko = await markets.getAssetsCoingecko()
            //     if(marketInfoCoinGecko){
            //         //market info found for
            //         marketInfoCoinGecko.updated = new Date().getTime()
            //         redis.setex('markets:CoinGecko',60 * 15,JSON.stringify(marketInfoCoinGecko))
            //         marketCacheCoinGecko = marketInfoCoinGecko
            //     }
            // }
            //
            // if(!marketCacheCoincap){
            //     let marketInfoCoincap = await markets.getAssetsCoincap()
            //     if(marketInfoCoincap){
            //         //market info found for
            //         marketInfoCoincap.updated = new Date().getTime()
            //         redis.setex('markets:CoinGecko',60 * 15,JSON.stringify(marketInfoCoincap))
            //         marketCacheCoincap = marketInfoCoincap
            //     }
            // }

            //TODO osmosis status?

            //TODO 0x assets/including tokens?

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

    @Get('/coins')
    public async coins() {
        let tag = TAG + " | coins | "
        try{
            let coins = blockchains

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
            log.info(tag,"cache info:",accountInfo)

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

            //if type is swap get blockchain info for fullfillment
            if(output && output.state === 'broadcasted'){
                if(!output.isConfirmed){
                    //get confirmation status
                    let txInfo
                    if(UTXO_COINS.indexOf(output.network) >= 0){
                        txInfo = await networks['ANY'].getTransaction(output.network,output.signedTx.txid)
                    } else {
                        if(!networks[output.network]) throw Error("102: coin not supported! coin: "+output.network)
                        txInfo = await networks[output.network].getTransaction(output.signedTx.txid)
                    }

                    if(txInfo && txInfo.txInfo && txInfo.txInfo.blockNumber){
                        log.info(tag,"Confirmed!")
                        output.isConfirmed = true

                        //update entry
                        let mongoSave = await invocationsDB.update(
                            {invocationId:output.invocationId},
                            {$set:{isConfirmed:true}})
                        output.resultUpdate = mongoSave
                        //push event
                        publisher.publish('invocationUpdate',JSON.stringify(output))
                    }
                }

                if(output.type === 'swap' && output.isConfirmed && !output.isFullfilled){
                    //txid
                    log.info(tag,"output.signedTx.txid: ",output.signedTx.txid)
                    let midgardInfo = await midgard.getTransaction(output.signedTx.txid)
                    log.info(tag,"midgardInfo: ",midgardInfo)

                    if(midgardInfo && midgardInfo.actions && midgardInfo.actions[0]){
                        let depositInfo = midgardInfo.actions[0].in
                        log.info(tag,"deposit: ",depositInfo)

                        let fullfillmentInfo = midgardInfo.actions[0]
                        log.info(tag,"fullfillmentInfo: ",JSON.stringify(fullfillmentInfo))

                        if(fullfillmentInfo.status === 'success'){
                            log.info(tag,"fullfillmentInfo: ",fullfillmentInfo)
                            log.info(tag,"fullfillmentInfo: ",fullfillmentInfo.out[0].txID)


                            output.isFullfilled = true
                            output.fullfillmentTxid = fullfillmentInfo.out[0].txID

                            //
                            let mongoSave = await invocationsDB.update(
                                {invocationId:output.invocationId},
                                {$set:{isFullfilled:true,fullfillmentTxid:output.fullfillmentTxid}})
                            output.resultUpdateFullment = mongoSave
                        }
                    } else {
                        log.info(tag,"not fullfilled!")
                    }
                }
            }

            if(!output){
                output = {
                    error:true,
                    message:"No invocation found with ID: "+invocationId
                }
            }
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
    @Get('/getPubkeyBalance/{coin}/{pubkey}')
    public async getPubkeyBalance(coin:string,pubkey:string) {
        let tag = TAG + " | getPubkeyBalance | "
        try{
            log.info(tag,{coin,pubkey})
            let output = await redis.get("cache:balance:"+pubkey+":"+coin)
            networks.ETH.init({testnet:true})
            if(!output || CACHE_OVERRIDE){
                //if coin = token, network = ETH
                if(false){
                    //TODO
                    output = await networks['ETH'].getBalanceToken(pubkey,coin)
                } else if(coin === 'ETH'){
                    output = await networks['ETH'].getBalanceAddress(pubkey)
                } else if(UTXO_COINS.indexOf(coin) >= 0){
                    //get xpub/zpub
                    output = await networks['ANY'].getBalanceByXpub(coin,pubkey)
                } else {
                    if(!networks[coin]) {
                        throw Error("109: coin not supported! coin: "+coin)
                    } else {
                        output = await networks[coin].getBalance(pubkey)
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

            log.info(tag,"network: ",network)
            log.info(tag,"txid: ",txid)
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

    @Get('/osmosis/pools')
    public async getOsmosisPools() {
        let tag = TAG + " | getOsmosisPools | "
        try{
            let output
            output = await networks['OSMO'].getPools()
            log.debug("output:",output)

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
        let tag = TAG + " | listUnspent | "
        try{
            log.info(tag,"network: ",network)
            log.info(tag,"xpub: ",xpub)
            await networks.ANY.init()
            //log.info("networks: ",networks)
            //log.info("networks: ",networks.ANY)
            let data = await networks.ANY.getPubkeyInfo(network,xpub)

            let changeIndex: number = 0
            let receiveIndex: number = 0

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
                changeIndex
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
        let tag = TAG + " | listUnspent | "
        try{
            let output:any = []
            //TODO if UTXO coin else error

            log.info(tag,"network: ",network)
            log.info(tag,"xpub: ",xpub)
            await networks.ANY.init()
            //log.info("networks: ",networks)
            //log.info("networks: ",networks.ANY)
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
            log.info(tag,"network: ",network)
            log.info(tag,"xpub: ",xpub)
            await networks.ANY.init()
            //log.info("networks: ",networks)
            //log.info("networks: ",networks.ANY)
            let inputs = await networks.ANY.utxosByXpub(network,xpub)

            //for each get hex
            for(let i = 0; i < inputs.length; i++){
                let input = inputs[i]
                log.info(tag,"input: ",input)
                //get hex info
                let rawInfo = await networks.ANY.getTransaction(network,input.txid)
                log.info(tag,"rawInfo: ",rawInfo)
                log.info(tag,"rawInfo: ",rawInfo.vin[0].addresses)
                //TODO type from hdwallet-code txInput:
                //TODO move this into module
                //format inputs
                let normalized_inputs = []
                for(let i = 0; i < rawInfo.vin.length; i++){
                    let vin = rawInfo.vin[i]
                    let rawInfoInput = await networks.ANY.getTransaction(network,vin.txid)
                    log.info(tag,"rawInfoInput: ",JSON.stringify(rawInfoInput))
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

            return inputs
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
    @Get('/getAccountInfo/{network}/{address}')
    public async getAccountInfo(network:string,address:string) {
        let tag = TAG + " | accountsFromPubkey | "
        try{
            log.info(tag,"network: ",network)
            log.info(tag,"address: ",address)
            log.info(tag,"networks: ",networks)
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

            log.info(tag,"body: ",body)
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
            log.info(tag,"mempool tx: ",body)

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
            log.info(tag,"mempool tx: ",body)
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
            log.info(tag,"body: ",body)

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
            log.info(tag,"body: ",body)

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
            log.info(tag,"body: ",body)

            if(UTXO_COINS.indexOf(body.network) >= 0){
                //TODO supported assets
                let resp = await networks['ANY'].getFeesWithRates(body.network,body.memo)
                log.info("resp:",resp)
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
            log.info(tag,"mempool tx: ",body)

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
    //         log.info(tag,"")
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
            log.info("************************** CHECKPOINT *******************88 ")
            log.info(tag,"body: ",body)
            if(!body.txid) throw Error("103: must known txid BEFORE broadcast! ")
            if(!body.network) throw Error("104: network required! ")

            let result:any = {
                success:false
            }
            let network = body.network

            //if(!networks[coin]) throw Error("102: unknown network coin:"+coin)

            //if
            let invocationInfo:any = {}
            if(body.invocationId){
                log.info(tag,"invocationId: ",body.invocationId)
                //get invocation
                let invocationInfoQuery = await invocationsDB.findOne({invocationId:body.invocationId})
                log.info(tag,"invocationInfoQuery: ",invocationInfoQuery)
                if(invocationInfoQuery){
                    invocationInfo = invocationInfoQuery
                }
                log.info(tag,"invocationInfo: ",invocationInfo)
                log.info(tag,"Release InvocationId: ",body.invocationId)
                log.info(tag,"Release body.txid: ",body.txid)
                redis.lpush(body.invocationId,body.txid)

                let updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{state:'broadcasted'}})
                log.info(tag,"invocation updateResult: ",updateResult)
            } else {
                log.error(tag,"No invocationId on body.")
                throw Error('invocationId required!')
            }

            //broadcast
            if(!body.noBroadcast){
                log.info(tag,"broadcasting!")
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
                                log.info(tag,"checkpoint: fioSignAddPubAddressTx ")
                                log.info(tag,"broadcast: ",broadcast)
                                result = await networks[network].broadcastAddPubAddressTx(broadcast)
                                break;
                            case "fioSignRegisterDomainTx":
                                //TODO
                                break;
                            case "fioSignRegisterFioAddressTx":
                                //TODO
                                break;
                            case "fioSignNewFundsRequestTx":
                                log.info(tag,"checkpoint: broadcastNewFundsRequestTx ")
                                log.info(tag,"broadcast: ",broadcast)
                                result = await networks[network].broadcastNewFundsRequestTx(broadcast)
                                break;
                            default:
                                throw Error("Type not supported! "+body.type)
                        }
                    } else if(UTXO_COINS.indexOf(network) >= 0){
                        //normal broadcast
                        await networks.ANY.init('full')
                        try{
                            result = await networks['ANY'].broadcast(network,body.serialized)
                        }catch(e){
                            result = {
                                error:true,
                                errorMsg: e.toString()
                            }
                        }
                    } else {
                        //All over coins
                        //normal broadcast
                        await networks[network].init()
                        try{
                            result = await networks[network].broadcast(body.serialized)
                        }catch(e){
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
                let resultSave:any = {}
                resultSave.success = true
                resultSave.broadcast = true
                resultSave.result = result
                let updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{broadcast:resultSave}})
                log.info(tag,"updateResult: ",updateResult)
            } else {
                log.info(tag,"Not broadcasting!")
                result.success = true
                result.broadcast = false
                //result = body.invocationId
                let updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{broadcast:{noBroadCast:true}}})
                log.info(tag,"updateResult: ",updateResult)
            }

            let mongoEntry:any = body
            //add to txsDB
            let tags = ['internal',network,'pending']
            if(invocationInfo.username) tags.push(invocationInfo.username)
            if(invocationInfo.context) tags.push(invocationInfo.context)
            if(invocationInfo.type) tags.push(invocationInfo.type)
            if(invocationInfo.invocation && invocationInfo.invocation.address) tags.push(invocationInfo.invocation.address)
            mongoEntry.tags = tags
            //mongoEntry.result = result
            mongoEntry.pending = true
            mongoEntry.broadcasted = new Date().getTime()
            try{
                result.saveTx = await txsDB.insert(mongoEntry)
            }catch(e){
                log.error(tag,"e: ",e)
                //duplicate
            }

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
}
