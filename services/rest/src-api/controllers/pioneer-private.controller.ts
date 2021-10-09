/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
log.info(TAG,"PIONEER VERSION: ",pjson.version)
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
const connection  = require("@pioneer-platform/default-mongo")
const queue = require("@pioneer-platform/redis-queue")
const randomstring = require("randomstring");
const markets = require('@pioneer-platform/markets')
const usersDB = connection.get('users')
const pubkeysDB = connection.get('pubkeys')
const txsDB = connection.get('transactions')
const utxosDB = connection.get('utxo')
const invocationsDB = connection.get('invocations')
usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

const axios = require('axios')
const network = require("@pioneer-platform/network")
import { v4 as uuidv4 } from 'uuid';
const short = require('short-uuid');
let pioneer = require('../pioneer')

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';

let PIONEER_INFO_CACHE_TIME = process.env['PIONEER_INFO_CACHE_TIME'] || 60 * 5

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

if(process.env['FEATURE_OSMOSIS_BLOCKCHAIN']){
    blockchains.push('osmosis')
    networks['OSMO'] = require('@pioneer-platform/osmosis-network')
}

if(process.env['FEATURE_BINANCE_BLOCKCHAIN']){
    blockchains.push('binance')
    networks['BNB'] = require('@pioneer-platform/binance-network')
}

if(process.env['FEATURE_THORCHAIN_BLOCKCHAIN']){
    blockchains.push('thorchain')
    networks['RUNE'] = require('@pioneer-platform/thor-network')
}

import {
    Error,
    ApiError,
    PairBody,
    SetContextBody,
    RegisterEosUsername,
    UpdateInvocationBody,
    DeleteInvocationBody,
    IgnoreShitcoins,
    TransactionsBody,
    ImportBody,
    CreateApiKeyBody,
    RegisterBody,
    CreatePairingCodeBody
} from "@pioneer-platform/pioneer-types";



//route
@Tags('Private Endpoints')
/**
 *  Test
 */
@Route('')
export class pioneerPrivateController extends Controller {

    /**
            Forget Account
                Clear transactions
     */
    @Get('/forget')
    public async forget(@Header('Authorization') authorization: string): Promise<any> {
        let tag = TAG + " | forget | "
        try{
            log.debug(tag,"queryKey: ",authorization)
            let output:any = {}
            let accountInfo = await redis.hgetall(authorization)
            let username = accountInfo.username
            if(!username) throw Error("unknown token! token: "+authorization)
            log.debug(tag,"accountInfo: ",accountInfo)

            //del redis
            output.cacheWallet = await redis.del(accountInfo.username+":cache:walletInfo")
            output.cacheAuth = await redis.del(authorization)
            output.cacheUser = await redis.del(accountInfo.username)

            //delete mongo
            output.userDelete = await usersDB.remove({username})

            //remove all pubkeys
            output.pubkeysDelete = await pubkeysDB.remove({tags:{ $all: [accountInfo.username]}})

            //remove all txs
            output.txsDelete = await txsDB.remove({tags:{ $all: [accountInfo.username]}})

            //remove all invocations
            output.invocationsDelete = await invocationsDB.remove({tags:{ $all: [accountInfo.username]}})

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

    /*
        Get user info for queryKey
     */

    @Get('/user')
    public async user(@Header('Authorization') authorization: string): Promise<any> {
        let tag = TAG + " | user | "
        try{
            log.info(tag,"queryKey: ",authorization)

            let accountInfo = await redis.hgetall(authorization)
            if(Object.keys(accountInfo).length === 0) {
                return {
                    success:false,
                    error:"QueryKey not registerd!"
                }
            } else {
                log.info(tag,"accountInfo: ",accountInfo)
                let username = accountInfo.username
                if(!username){
                    throw Error("103: invalid user info, missing username!")
                }
                let userInfo = await redis.hgetall(username)
                log.info(tag,"userInfo: ",userInfo)

                if(Object.keys(userInfo).length === 0){
                    return {
                        success:false,
                        error:"QueryKey not paired!"
                    }
                }else{
                    //wallets
                    let userInfoMongo = await usersDB.findOne({username})
                    if(!userInfoMongo) {
                        throw Error("102: unknown user! username: "+username)
                    }
                    if(userInfoMongo.context) userInfo.context = userInfoMongo.context
                    if(userInfoMongo.assetContext) userInfo.assetContext = userInfoMongo.assetContext
                    userInfo.wallets = userInfoMongo.wallets
                    log.info(tag,"userInfoMongo: ",userInfoMongo)
                    log.info(tag,"userInfo: ",userInfo)

                    //asset context
                    if(!userInfo.assetContext) userInfo.assetContext = 'ETH'

                    //context
                    if(!userInfo.context){
                        if(userInfoMongo.wallets && userInfoMongo.wallets.length > 0){
                            userInfo.context = userInfoMongo.wallets[0]
                        } else {
                            log.info(tag,"Invalid Mongo userInfoMongo: ",userInfoMongo.wallets)
                            log.info(tag,"Invalid Mongo userInfoMongo: ",typeof(userInfoMongo.wallets))
                            log.error(tag,"Invalid Mongo entry: ",userInfoMongo)
                            throw Error("102: invalid mongo user! ")
                        }
                    }

                    //get market data from markets
                    let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
                    let marketCacheCoincap = await redis.get('markets:Coincap')

                    if(!marketCacheCoinGecko){
                        let marketInfoCoinGecko = await markets.getAssetsCoingecko()
                        if(marketInfoCoinGecko){
                            //market info found for
                            marketInfoCoinGecko.updated = new Date().getTime()
                            redis.setex('markets:CoinGecko',60 * 15,JSON.stringify(marketInfoCoinGecko))
                            marketCacheCoinGecko = marketInfoCoinGecko
                        }
                    }

                    if(!marketCacheCoincap){
                        let marketInfoCoincap = await markets.getAssetsCoincap()
                        if(marketInfoCoincap){
                            //market info found for
                            marketInfoCoincap.updated = new Date().getTime()
                            redis.setex('markets:CoinGecko',60 * 15,JSON.stringify(marketInfoCoincap))
                            marketCacheCoincap = marketInfoCoincap
                        }
                    }

                    //get value map
                    userInfo.walletDescriptions = []
                    let totalValueUsd = 0
                    for(let i = 0; i < userInfoMongo.wallets.length; i++){
                        let context = userInfoMongo.wallets[i]
                        let walletInfo:any = userInfoMongo.walletDescriptions[i]
                        log.info(tag,"walletDescription: ",walletInfo)
                        log.info(tag,"building walletDescription for context: ",context)
                        let { pubkeys } = await pioneer.getPubkeys(username,context)
                        log.info(tag,"pubkeys: ",JSON.stringify(pubkeys))
                        //build wallet info
                        walletInfo.pubkeys = pubkeys
                        if(!walletInfo.pubkeys) throw Error("102: pioneer failed to collect pubkeys!")
                        //hydrate market data for all pubkeys
                        log.info(tag,"pubkeys: ",pubkeys)
                        let responseMarkets = await markets.buildBalances(marketCacheCoincap, marketCacheCoincap, pubkeys, context)
                        log.info(tag,"responseMarkets: ",responseMarkets)
                        let walletDescription = {
                            context:walletInfo.context,
                            type:walletInfo.type,
                            pubkeys,
                            balances:responseMarkets.balances,
                            valueUsdContext:responseMarkets.total
                        }
                        totalValueUsd = totalValueUsd + totalValueUsd
                        //walletDescription
                        userInfo.walletDescriptions.push(walletDescription)
                    }

                    userInfo.totalValueUsd = totalValueUsd


                    return userInfo
                }
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
     *
     Get the balances for a given username

     protect mongo with redis cache

     protect nodes with mongo data

     All events push OUT in production

        nodes ->  mongo -> redis -> (ws) user local db


     */
    @Get('/info/{context}')
    public async info(context:string,@Header('Authorization') authorization: string): Promise<any> {
        let tag = TAG + " | info | "
        try{
            log.info(tag,"queryKey: ",authorization)
            if(!context) throw Error("103: context required!")
            log.info(tag,"context: ",context)

            let accountInfo = await redis.hgetall(authorization)
            log.info(tag,"accountInfo: ",accountInfo)

            let walletInfo:any = {}
            if(accountInfo){
                log.info(tag,"accountInfo: ",accountInfo)
                let username = accountInfo.username
                if(!username){
                    log.error(tag,"invalid accountInfo: ",accountInfo)
                    throw Error("unknown token. token:"+authorization)
                }
                //sismember
                let isKnownWallet = await redis.sismember(username+':wallets',context)
                log.info(tag,"isKnownWallet: ",isKnownWallet)

                //TODO add balances
                //throw error if every balance does NOT have a true > 0  balance AND and icon
                //verify date on balance, if old mark old
                //make schema verbose and repetitive, and optimize later
                let { pubkeys, masters } = await pioneer.getPubkeys(username,context)
                //build wallet info
                walletInfo.masters = masters
                //hydrate market data for all pubkeys
                log.info(tag,"pubkeys: ",JSON.stringify(pubkeys))

                //
                //get market data from markets
                let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
                let marketCacheCoincap = await redis.get('markets:Coincap')

                if(!marketCacheCoinGecko){
                    let marketInfoCoinGecko = await markets.getAssetsCoingecko()
                    if(marketInfoCoinGecko){
                        //market info found for
                        marketInfoCoinGecko.updated = new Date().getTime()
                        redis.setex('markets:CoinGecko',60 * 15,JSON.stringify(marketInfoCoinGecko))
                        marketCacheCoinGecko = marketInfoCoinGecko
                    }
                }

                if(!marketCacheCoincap){
                    let marketInfoCoincap = await markets.getAssetsCoincap()
                    if(marketInfoCoincap){
                        //market info found for
                        marketInfoCoincap.updated = new Date().getTime()
                        redis.setex('markets:CoinGecko',60 * 15,JSON.stringify(marketInfoCoincap))
                        marketCacheCoincap = marketInfoCoincap
                    }
                }

                log.info(tag,"pubkeys: ",JSON.stringify(pubkeys))
                let responseMarkets = await markets.buildBalances(marketCacheCoincap, marketCacheCoinGecko, pubkeys, context)
                log.info(tag,"responseMarkets: ",responseMarkets)
                walletInfo.pubkeys = pubkeys
                walletInfo.balances = responseMarkets.balances
                walletInfo.totalValueUsd = responseMarkets.total
                walletInfo.username = username
                walletInfo.context = context
                walletInfo.apps = await redis.smembers(username+":apps")
                //Hydrate userInfo
                let userInfoMongo = await usersDB.findOne({username})
                log.info(tag,"userInfoMongo: ",userInfoMongo)
                //migrations
                if(!userInfoMongo) throw Error("102: unknown user! username: "+username)
                if(!userInfoMongo.walletDescriptions) throw Error("Invalid user! missing walletDescriptions")
                walletInfo.wallets = userInfoMongo.wallets
                walletInfo.blockchains = userInfoMongo.blockchains

                return walletInfo
            }else{
                return {
                    error:true,
                    errorCode:1,
                    message:"Token not Registered!"
                }
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

    @Get('/invocations')
    public async invocations(@Header('Authorization') authorization: string): Promise<any> {
        let tag = TAG + " | unapproved | "
        try{
            log.info(tag,"queryKey: ",authorization)

            let accountInfo = await redis.hgetall(authorization)
            if(!accountInfo) {
                return {
                    success:false,
                    error:"QueryKey not registerd!"
                }
            } else {
                log.info(tag,"accountInfo: ",accountInfo)
                let username = accountInfo.username
                let userInfo = await redis.hgetall(username)
                log.info(tag,"userInfo: ",userInfo)
                if(Object.keys(userInfo).length === 0){
                    return {
                        success:false,
                        error:"QueryKey not paired!"
                    }
                }else{
                    //unapproved
                    let invocations = await invocationsDB.find({tags:{ $all: [accountInfo.username]}})
                    return invocations
                }
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
     Get the refresh on for a given username
     */
    @Get('/refresh')
    public async refresh(@Header('Authorization') authorization): Promise<any> {
        let tag = TAG + " | balance | "
        try{
            log.debug(tag,"queryKey: ",authorization)


            let accountInfo = await redis.hgetall(authorization)
            if(!accountInfo) throw Error("unknown token! token:"+authorization)
            log.info(tag,"accountInfo: ",accountInfo)

            if(accountInfo){
                let refreshedTime = await redis.get(accountInfo.username+":lastRefresh")
                if(!refreshedTime){
                    //get all pubkeys for username

                    //re-submit to pubkey ingester
                }
            } else {
                throw Error("102: invalid auth token!")
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
     Get the context for a given username
     */
    @Get('/context')
    public async context(@Header('Authorization') authorization): Promise<any> {
        let tag = TAG + " | balance | "
        try{
            log.debug(tag,"queryKey: ",authorization)


            let accountInfo = await redis.hgetall(authorization)
            if(!accountInfo) throw Error("unknown token! token:"+authorization)
            log.info(tag,"accountInfo: ",accountInfo)

            let walletInfo:any
            if(accountInfo){
                let username = accountInfo.username
                if(!username){
                    log.error(tag,"invalid accountInfo: ",accountInfo)
                    throw Error("unknown token. token:"+authorization)
                }
                let userInfo = await redis.hgetall(username)
                log.info(tag,"userInfo: ",userInfo)
                return userInfo.context
            } else {
                throw Error("102: invalid auth token!")
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
        Get the balances for a given username on current context for asset
     */
    @Get('/balance/{asset}')
    public async balance(asset:string,@Header('Authorization') authorization): Promise<any> {
        let tag = TAG + " | balance | "
        try{
            log.debug(tag,"queryKey: ",authorization)
            log.debug(tag,"asset: ",asset)

            let accountInfo = await redis.hgetall(authorization)
            let username = accountInfo.username
            if(!username) throw Error("unknown token! token:"+authorization)

            //get cache
            log.debug(tag,"cache path: ",accountInfo.username+":cache:"+asset+":balance")
            let balance = await redis.get(accountInfo.username+":cache:"+asset+":balance")
            log.debug(tag,"balance: ",balance)
            if(balance){
                return(JSON.parse(balance));
            }else{
                log.debug(tag,"username: ",username)
                //get pubkeys from mongo
                let userInfo = await usersDB.findOne({username})
                if(!userInfo) {
                    throw Error("102: unknown user! username: "+username)
                }
                log.debug(tag,"userInfo: ",userInfo)

                //reformat
                let pubkeys = {}
                for(let i = 0; i < userInfo.pubkeys.length; i++){
                    let pubkeyInfo = userInfo.pubkeys[i]
                    pubkeys[pubkeyInfo.coin] = pubkeyInfo
                }

                //import into wallet
                await network.init('full',{
                    pubkeys
                })
                //get wallet info
                balance = await network.getBalance(asset)

                //write to cache
                await redis.setex(accountInfo.username+":cache:"+asset+":balance",1000 * 5,JSON.stringify(balance))
            }

            return balance
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
     * Update current account asset context
     * @param request This is an application pairing submission
     */

    @Post('/setAssetContext')
    //TODO bump and add type back
    public async setAssetContext(@Body() body: any, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | setAssetContext | "
        try{
            log.info(tag,"account: ",body)
            log.info(tag,"Authorization: ",Authorization)
            let output:any = {}
            // get auth info
            let authInfo = await redis.hgetall(Authorization)
            log.info(tag,"authInfo: ",authInfo)
            if(!authInfo) throw Error("108: unknown token! ")
            if(!body.asset) throw Error("1011: invalid body missing asset")

            // get user info
            let userInfo = await redis.hgetall(authInfo.username)
            if(!userInfo) throw Error("109: unknown username! ")
            log.info(tag,"userInfo: ",userInfo)
            output.username = authInfo.username

            if(userInfo.assetContext !== body.asset) {
                let contextSwitch = {
                    type:"assetContext",
                    username:userInfo.username,
                    asset:body.asset
                }
                publisher.publish('context',JSON.stringify(contextSwitch))
                output.success = true
                //update Redis to new context
                let updateRedis = await redis.hset(authInfo.username,'assetContext',body.context)
                output.updateDB = updateRedis
            } else {
                output.success = false
                output.error = 'context already set to body.context:'+body.context
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
     * Update current account context
     * @param request This is an application pairing submission
     */

    @Post('/setContext')
    public async setContext(@Body() body: SetContextBody, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | setContext | "
        try{
            log.info(tag,"account: ",body)
            log.info(tag,"Authorization: ",Authorization)
            let output:any = {}
            // get auth info
            let authInfo = await redis.hgetall(Authorization)
            log.info(tag,"authInfo: ",authInfo)
            if(!authInfo) throw Error("108: unknown token! ")

            // get user info
            let userInfo = await redis.hgetall(authInfo.username)
            if(!userInfo) throw Error("109: unknown username! ")
            log.info(tag,"userInfo: ",userInfo)
            output.username = authInfo.username
            //get wallets
            let allWallets = await redis.smembers(authInfo.username+":wallets")
            log.info(tag,"allWallets: ",allWallets)
            output.wallets = allWallets
            if(allWallets.indexOf(body.context) >= 0){
                //if context is not current
                if(userInfo.context !== body.context) {
                    let contextSwitch = {
                        type:"context",
                        username:userInfo.username,
                        context:body.context
                    }
                    publisher.publish('context',JSON.stringify(contextSwitch))
                    output.success = true
                    //update Redis to new context
                    let updateRedis = await redis.hset(authInfo.username,'context',body.context)
                    output.updateDB = updateRedis
                } else {
                    log.info(tag,"DEBUG: publish on false context switch")
                    let contextSwitch = {
                        type:"context",
                        note:"context already "+body.context,
                        username:userInfo.username,
                        context:body.context
                    }
                    publisher.publish('context',JSON.stringify(contextSwitch))
                    //TODO debug/removeme
                    output.success = false
                    output.error = 'context already set to body.context:'+body.context
                }

                return(output);
            } else {
                return {
                    success: false,
                    error: "invalid context! context: "+body.context,
                    options:allWallets
                }
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
     * updateInvocation an sdk with app
     * @param request This is an application pairing submission
     */

    @Post('/updateInvocation')
    public async updateInvocation(@Body() body: UpdateInvocationBody, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | updateInvocation | "
        try{
            log.info(tag,"account: ",body)
            log.info(tag,"Authorization: ",Authorization)
            //TODO auth?

            //update database
            let updateResult
            if(body.unsignedTx){
                //update state to
                updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{unsignedTx:body.unsignedTx,state:'builtTx'}})
            }

            if(body.signedTx){
                updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{signedTx:body.signedTx,state:'signedTx'}})
            }

            return(updateResult);
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
     * Ignore a Coin from a users view
     * @param request This is an application pairing submission
     */

    @Post('/ignoreShitcoin')
    public async ignoreShitcoin(@Body() body: IgnoreShitcoins, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | ignoreShitcoin | "
        try{
            let output:any = {}
            log.info(tag,"account: ",body)
            log.info(tag,"Authorization: ",Authorization)
            let coins = body.coins || body.shitcoins

            // get auth info
            let authInfo = await redis.hgetall(Authorization)
            log.info(tag,"authInfo: ",authInfo)
            if(!authInfo) throw Error("108: unknown token! ")

            if(authInfo.username){
                output.updateDBUser = await usersDB.update({},{ $addToSet: { "hidden": coins } })
            }else{
                output.success = false
                output.error = "No username tied to queryKey"
            }

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

    /**
     * deleteInvocation
     * @param
     */

    @Post('/deleteInvocation')
    public async deleteInvocation(@Body() body: DeleteInvocationBody, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | deleteInvocation | "
        try{
            log.info(tag,"account: ",body)
            log.info(tag,"Authorization: ",Authorization)

            //TODO auth
            //update database
            let updateResult = await invocationsDB.remove({invocationId:body.invocationId})

            return({success:true,result:updateResult.result});
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
     * Pair an sdk with app
     * @param request This is an application pairing submission
     */

    @Post('/pair')
    public async pair(@Body() body: PairBody, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | pair | "
        try{
            log.info(tag,"account: ",body)
            log.info(tag,"Authorization: ",Authorization)

            // get user info
            let userInfo = await redis.hgetall(Authorization)
            log.info(tag,"userInfo: ",userInfo)
            //if no info throw
            if(!userInfo) throw Error("User not known!")
            if(!userInfo.username) throw Error("invalid user!")

            // get queryKey for code sdk user
            let sdkQueryKey = await redis.hget(body.code,"pairing")
            if(sdkQueryKey) {
                log.info(tag,"sdkQueryKey: ",sdkQueryKey)
                let userInfoSdk = await redis.hgetall(sdkQueryKey)
                log.info(tag,"userInfoSdk: ",userInfoSdk)

                //if username sdk
                if(userInfoSdk.wallets){
                    //TODO handle if multiple?
                    let walletId = userInfoSdk.wallets
                    log.info(tag,"walletId: ",walletId)

                    let userInfoOfSdkKey = await usersDB.findOne({username:userInfoSdk.username})
                    log.info(tag,"userInfoOfSdkKey: ",userInfoOfSdkKey)

                    //add metamask wallet to user
                    let updateDBPubkey = await usersDB.update({username:userInfo.username},{ $addToSet: { "wallets": walletId } })
                    log.info(tag,"updateDBPubkey: ",updateDBPubkey)

                    //for wallet on sdkUserInfo
                    for(let i = 0; i < userInfoOfSdkKey.walletDescriptions.length; i++){
                        //add metamask description to walletDescriptions
                        let updateDBuser = await usersDB.update({username:userInfo.username},{ $addToSet: { "walletDescriptions": userInfoOfSdkKey.walletDescriptions[i] } })
                        log.info(tag,"updateDBuser: ",updateDBuser)
                    }

                    //add wallet to user


                    //if owned by username
                    let pubkeysOwnedBySdk = await pubkeysDB.find({tags:{ $all: [userInfoSdk.username]}})
                    log.info(tag,"pubkeysOwnedBySdk: ",pubkeysOwnedBySdk)

                    for(let i = 0; i < pubkeysOwnedBySdk.length; i++){
                        let pubkey = pubkeysOwnedBySdk[i]
                        log.info(tag,"pubkey: ",pubkey)
                        let updateDBPubkey = await pubkeysDB.update({pubkey:pubkey.pubkey},{ $addToSet: { "tags": userInfo.username } })
                        log.info(tag,"updateDBPubkey: ",updateDBPubkey)

                        //push app username to pubkey

                    }


                }

                //add context to app username

                // get url
                let url = await redis.hget(body.code,"url")

                // if in whitelist
                let isWhitelisted = await redis.sismember('serviceUrls',url)



                // let app = {
                //     added:new Date().getTime(),
                //     url
                //     //More?
                // }

                //push to username cache
                redis.sadd(userInfo.username+":apps",url)

                //push to pairings
                redis.sadd(userInfo.username+":pairings",Authorization)
                redis.sadd(userInfo.username+":pairings",sdkQueryKey)

                //add to userInfo
                let pushAppMongo = await usersDB.update({ username: userInfo.username },
                    { $addToSet: { apps: url } })
                log.info(tag,"pushAppMongo: ",pushAppMongo)

                // sdkUser
                let sdkUser = {
                    username:userInfo.username,
                    paired: new Date().getTime(),
                    queryKey: sdkQueryKey,
                    url
                }
                log.info(tag,"pairing sdkUser: ",sdkUser)
                publisher.publish('pairings',JSON.stringify(sdkUser))


                //save queryKey code
                let saveRedis = await redis.hmset(sdkQueryKey,sdkUser)

                let output = {
                    user:sdkUser,
                    url,
                    saveRedis,
                    trusted:isWhitelisted
                }

                return(output);
            } else {
                return {
                    success:false,
                    error:"unknown code!"
                }
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
     * Pair an sdk with app
     * @param request This is an application pairing request
     */

    @Post('/createPairingCode')
    public async createPairingCode(@Body() body: CreatePairingCodeBody, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | createPairingCode | "
        try{
            log.debug(tag,"account: ",body)
            log.debug(tag,"Authorization: ",Authorization)

            //is key known
            let userInfo = await redis.hgetall(Authorization)
            log.info(tag,"userInfo: ",userInfo)

            // if known return username (already paired)

            // is service known
                //if new service save to db

            //create random code
            let code = randomstring.generate(6)
            code = code.toUpperCase()
            log.info(tag,"code: ",code)

            //save code to key
            let saveRedis = await redis.hset(code,"pairing",Authorization)
            redis.hset(code,"url",body.url)

            let output = {
                code,
                saveRedis
            }

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

    /**
     * Create an api key
     * @param request This is a user creation request description
     */

    @Post('/createApiKey')
    public async createApiKey(@Body() body: CreateApiKeyBody, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | createApiKey | "
        try{
            log.debug(tag,"account: ",body)
            log.debug(tag,"Authorization: ",Authorization)

            //username
            if(!body.account) throw Error("102: missing account")
            let account = body.account

            //is known account?
            let accountInfo = await redis.hgetall(body.account)
            log.debug(tag,"accountInfo: ",accountInfo)

            //create key
            let newKey = short.generate()
            log.debug(tag,"newKey: ",newKey)

            let isMember = false

            let createdDate = new Date().getTime()
            await redis.hset(newKey,'account',account)
            await redis.hset(newKey,'username',account)
            if(isMember)await redis.hset(newKey,'isMember',"true")
            await redis.hset(newKey,'created',createdDate)

            let output = {
                queryKey:newKey,
                created: createdDate,
                isMember,
                permissions:['READ','SUBSCRIBE']
            }

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

    /**
     * get utxos
     * @param request This is a users unspent txs
     */

    @Post('/utxos')
    public async getUtxos(@Body() body: any, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | getUtxos | "
        try{
            log.debug(tag,"account: ",body)
            log.debug(tag,"Authorization: ",Authorization)

            let accountInfo = await redis.hgetall(Authorization)
            log.debug(tag,"accountInfo: ",accountInfo)

           if(accountInfo){
               //TODO filter by coin

               let utxos = await utxosDB.find({accounts:{ $all: [accountInfo.username]}})
               log.info(tag,"utxos: ",utxos)

               return(utxos);
           } else {
               throw Error("user not found!")
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
     * Get transaction history
     *
     * start block
     * end block
     * coin
     *
     */
    @Post('/transactions')
    public async transactions(@Header('Authorization') authorization: string,@Body() body: TransactionsBody): Promise<any> {
        let tag = TAG + " | transactions | "
        try{
            log.debug("************************** CHECKPOINT *******************88 ")
            log.debug(tag,"body: ",body)
            log.debug(tag,"queryKey: ",authorization)
            //
            let accountInfo = await redis.hgetall(authorization)
            if(Object.keys(accountInfo).length === 0) throw Error("102: Unknown Api key! ")
            log.debug(tag,"accountInfo: ",accountInfo)

            let username = accountInfo.username
            let coin = body.coin
            let startBlock = body.startBlock
            if(!startBlock) startBlock = 0

            let query = {
                $and:[
                    {asset:coin},
                    {height:{ $gt: startBlock }},
                    {accounts:username}
                ]
            }

            /*
                How to do range
                db.users.count({
                    marks: {$elemMatch: {$gte: 20, $lt: 30}}
                })
             */

            log.debug(tag,"query: ",JSON.stringify(query))
            //get transactions
            let txs = await txsDB.find(query,{limit:300,maxTimeMS:30 * 1000})

            log.debug("txs: ",txs)

            let output = []


            for(let i = 0; i < txs.length; i++){
                //TODO DOUP CODE
                // move to audit?
                // link main.ts (socket events)
                let tx = txs[i]
                let type
                let from
                let to
                let amount
                let fee
                log.debug(tag,"tx: ",tx)
                for(let j = 0; j < tx.events.length; j++){

                    let event = tx.events[j]
                    log.debug(tag,"event: ",event)
                    let addressInfo = await redis.smembers(event.address+":accounts")

                    if(addressInfo.indexOf(username) >= 0 && event.type === 'debit'){
                        type = 'send'
                    }
                    if(addressInfo.indexOf(username) >= 0 && event.type === 'credit'){
                        type = 'receive'
                    }

                    if(event.type === 'debit' && !event.fee){
                        from = event.address
                    }
                    if(event.type === 'debit' && event.fee){
                        fee = {
                            asset:tx.asset
                        }
                    }
                    if(event.type === 'credit'){
                        to = event.address
                        amount = event.amount
                    }
                }

                //default (TODO dont do this)
                if(!fee){
                    fee = {
                        "amount": 0.0002,
                        "asset": "ETH"
                    }
                }

                let summary = {
                    type,
                    asset:tx.asset,
                    from,
                    to,
                    amount,
                    fee,
                    txid:tx.txid,
                    height:tx.height,
                    time:tx.time
                }

                output.push(summary)
            }



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

    /**
     *  Create a user account on Pioneer
     *
     *  Auth providers
     *
     *     * Shapeshift
     *
     *     * Keypair
     *
     *
     *
     *
     *  NOTE:
     *
     *  Any already REGISTERED user may use this name to register additional coins/pubkeys or update context or state
     *
     *
     *  Output:
     *      QueryToken: (SUBSCRIBE permissions)
     *          Blockchain and payment info
     *
     *  Auth providers may issue/revoke Query tokens
     *
     * @param request This is a user creation
     */

    @Post('/register')
    public async register(@Header('Authorization') authorization: string, @Body() body: RegisterBody): Promise<any> {
        let tag = TAG + " | register | "
        try{
            let output:any = {}
            let newKey
            log.info(tag,"body: ",body)
            if(!body.context) throw Error("102: context required on body!")
            if(!body.blockchains) throw Error("103: blockchains required on body!")
            if(typeof(body.walletDescription) === 'string') throw Error("104: Invalid Wallet Description!")

            //if auth found in redis
            const authInfo = await redis.hgetall(authorization)
            log.info(tag,"authInfo: ",authInfo)
            let isTestnet = authInfo.isTestnet || false
            if(body.isTestnet && Object.keys(authInfo).length != 0 && !isTestnet) throw Error(" Username already registerd on mainnet! please create a new")
            log.debug(tag,"authInfo: ",authInfo)

            let username
            if(Object.keys(authInfo).length > 0){
                log.debug(tag,"checkpoint 1 auth key known")

                username = authInfo.username
                if(!username) throw Error("102: invalid auth data!")

                //does username match register request
                if(username !== body.username){
                    //is username taken?
                    let userInfo = await redis.hgetall(body.username)
                    if(Object.keys(userInfo).length > 0){
                        throw Error("103: unable create new user, username taken!")
                    } else {
                        log.error(tag,"authInfo.username: ",authInfo.username)
                        log.error(tag,"username: ",body.username)
                        output.success = false
                        output.error = "104: username transfers on tokens not supported! owned username:"+username
                        output.code = 104
                        return output
                    }
                } else {
                    log.info("username available! checkpoint 1a")
                }
            } else {
                log.info(tag,"checkpoint 1a auth key NOT known")
                newKey = true
            }
            if(!username) username = body.username

            let userInfoMongo:any = await usersDB.findOne({username})
            log.info(tag,"userInfoMongo: ",userInfoMongo)

            if(newKey){
                //create user
                let userInfo:any = {
                    registered: new Date().getTime(),
                    id:"pioneer:"+pjson.version+":"+uuidv4(), //user ID versioning!
                    username:body.username,
                    verified:true,
                    blockchains:body.blockchains,
                    wallets:[body.context], // just one wallet for now
                    walletDescriptions:[body.walletDescription]
                }

                if(!userInfoMongo){
                    output.resultSaveUserDB = await usersDB.insert(userInfo)
                }
                //delete descriptions
                delete userInfo.walletDescriptions
                let redisSuccess = await redis.hmset(body.username,userInfo)
                log.info(tag,"redisSuccess: ",redisSuccess)

                let redisSuccessKey = await redis.hmset(authorization,userInfo)
                log.info(tag,"redisSuccessKey: ",redisSuccessKey)

                //Continue and register wallet
                userInfoMongo = userInfo

                //Assume wallet new
                output.result = await pioneer.register(body.username, body.data.pubkeys,body.context)
                log.info(tag,"resultPioneer: ",output.result)

                //set user context to only wallet
                await redis.hset(body.username,'context',body.context)

                //add to wallet set
                await redis.sadd(username+':wallets',body.context)
            }

            //get wallets
            let userWallets = userInfoMongo.wallets
            if(!userWallets) throw Error("No wallets found!")

            //add to wallet set
            await redis.sadd(username+':wallets',body.context)

            //if current ! found
            if(userWallets.indexOf(body.context) < 0){
                log.info(tag,"Registering new wallet! context:",body.context)
                //Register wallet! (this ONLY hits when already registered
                output.newWallet = true
                let pubkeys = body.data.pubkeys
                output.result = await pioneer.register(body.username, pubkeys, body.context)
                log.info(tag,"resultPioneer: ",output.result)

                //set current context to newly registred wallet
                //TODO flag to leave context? (silent register new wallet?)
                //await redis.hset(body.username,'context',body.context)

                //push new wallet to wallets
                output.updateDBUser = await usersDB.update({username:body.username},{ $addToSet: { "wallets": body.context } })
                output.updateDBUser = await usersDB.update({username:body.username},{ $addToSet: { "walletDescriptions": body.walletDescription } })
            } else {
                //wallet already known!
                log.info(tag,"Wallet already known! context: ",body.context)

                //get pubkey array
                output.result = await pioneer.update(body.username, body.data.pubkeys,body.context)
            }

            log.info("checkpoint 3")
            let userInfoRedis = await redis.hgetall(username)
            log.info(tag,"userInfoRedis: ",userInfoRedis)
            log.info("checkpoint 4 final ")

            //if no context, set
            if(!userInfoRedis.context){
                userInfoRedis.context = body.context
                redis.hset(username,'context',body.context)
            }
            output.context = userInfoRedis.context

            //if no asset context
            //set bitcoin
            if(!userInfoRedis.assetContext){
                userInfoRedis.assetContext = 'ETH'
                redis.hset(username,'assetContext',userInfoRedis.assetContext)
            }
            output.assetContext = userInfoRedis.assetContext

            //verify user
            //get market data from markets
            let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
            let marketCacheCoincap = await redis.get('markets:Coincap')

            if(!marketCacheCoinGecko){
                let marketInfoCoinGecko = await markets.getAssetsCoingecko()
                if(marketInfoCoinGecko){
                    //market info found for
                    marketInfoCoinGecko.updated = new Date().getTime()
                    redis.setex('markets:CoinGecko',60 * 15,JSON.stringify(marketInfoCoinGecko))
                    marketCacheCoinGecko = marketInfoCoinGecko
                }
            }

            if(!marketCacheCoincap){
                let marketInfoCoincap = await markets.getAssetsCoincap()
                if(marketInfoCoincap){
                    //market info found for
                    marketInfoCoincap.updated = new Date().getTime()
                    redis.setex('markets:CoinGecko',60 * 15,JSON.stringify(marketInfoCoincap))
                    marketCacheCoincap = marketInfoCoincap
                }
            }

            let { pubkeys, masters } = await pioneer.getPubkeys(username,output.context)
            log.info(tag,"pubkeys: ",JSON.stringify(pubkeys))
            let responseMarkets = await markets.buildBalances(marketCacheCoincap, marketCacheCoinGecko, pubkeys, output.context)
            log.info(tag,"responseMarkets: ",responseMarkets)
            output.masters = masters
            output.pubkeys = pubkeys
            output.balances = responseMarkets.balances
            output.totalValueUsd = responseMarkets.total

            //get
            // info on context
            output.username = username
            output.success = true
            output.userInfo = userInfoRedis

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
     *  Import Pubkeys
     *
     *  Bulk add address's to be tracked under a username
     *
     */

    @Post('/import')
    public async import(@Header('Authorization') authorization: string, @Body() body: ImportBody): Promise<any> {
        let tag = TAG + " | import | "
        try{
            let output:any = {}
            let newKey
            log.debug(tag,"body: ",body)

            //if auth found in redis
            const authInfo = await redis.hgetall(authorization)
            log.debug(tag,"authInfo: ",authInfo)

            let username
            if(Object.keys(authInfo).length > 0){
                log.debug(tag,"checkpoint 1 auth key known")

                username = authInfo.username
                if(!username) throw Error("102: invalid auth data!")
            } else {
                log.info(tag,"checkpoint 1a auth key NOT known")
                newKey = true
            }
            if(!username) throw Error("104: unable to find username!")

            let userInfoMongo = await usersDB.findOne({username})
            log.info(tag,"userInfoMongo: ",userInfoMongo)

            log.info("checkpoint 2 post mongo query!")
            if(!userInfoMongo || newKey){
                log.info("checkpoint 2a no mongo info!")
                throw Error("unable to import until AFTER registered!")

            } else {

                let saveActions = []
                //bulk update mongo
                for(let i = 0; i < body.pubkeys.length; i++){
                    let pubkeyInfo:any = body.pubkeys[i]
                    log.debug(tag,"pubkey: ",pubkeyInfo)

                    if(!pubkeyInfo.address) throw Error("105: invalid pubkeyInfo!")
                    let entry = {
                        coin:body.coin,
                        path:pubkeyInfo.path,
                        created:new Date().getTime(),
                        tags:[body.source,username],
                        pubkey:pubkeyInfo.address
                    }

                    //add to address ingester
                    let work = {
                        address:pubkeyInfo.address,
                        account:username
                    }
                    queue.createWork(body.coin+":address:queue:ingest",work)

                    //save all
                    if(entry.pubkey){
                        saveActions.push({insertOne:entry})
                    }


                }
                output.count = saveActions.length
                try{
                    output.resultSaveDB = await pubkeysDB.bulkWrite(saveActions)
                }catch(e){
                    output.resultSaveDB = e
                }


                //TODO bulkwrite to postgress finance
            }

            log.info("checkpoint 3")
            let userInfoRedis = await redis.hgetall(username)
            log.info(tag,"userInfoRedis: ",userInfoRedis)
            log.info("checkpoint 4 final ")

            output.success = true
            output.userInfo = userInfoRedis

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

}
