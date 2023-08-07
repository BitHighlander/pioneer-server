/*

    Pioneer REST endpoints



 */

let TAG = ' | API | '
import { recoverPersonalSignature } from 'eth-sig-util';
import { bufferToHex } from 'ethereumjs-util';
import {sign} from 'jsonwebtoken';
const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
log.debug(TAG,"PIONEER VERSION: ",pjson.version)
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
const connection  = require("@pioneer-platform/default-mongo")
const queue = require("@pioneer-platform/redis-queue")
const randomstring = require("randomstring");
const markets = require('@pioneer-platform/markets')
const usersDB = connection.get('users')
const pubkeysDB = connection.get('pubkeys')
const txsDB = connection.get('transactions')
const utxosDB = connection.get('utxo')
const redemptionsDB = connection.get('redemptions')
const assetsDB = connection.get('assets')
const blockchainsDB = connection.get('blockchains')
let dappsDB = connection.get('apps')
let nodesDB = connection.get('nodes')

const invocationsDB = connection.get('invocations')
usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
redemptionsDB.createIndex({txid: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

let config = {
    algorithms: ['HS256' as const],
    secret: 'shhhh', // TODO Put in process.env
};

const axios = require('axios')
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
    // networks['ANY'].init('full')
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

interface Pubkey {
    context: string;
    pubkey: string;
    blockchain: string;
    symbol: string;
    asset: string;
    path: string;
    pathMaster: string;
    script_type: string;
    network: string;
    master: string;
    type: string;
    address: string;
}

let onStart = async function(){
    let tag = TAG+" | onStart | "
    try{
        //get nodes
        let unchainedNodes = await nodesDB.find({ tags: { $in: ['unchained'] } },{limit:100})
        log.debug(tag,"unchainedNodes: ",unchainedNodes)
        //init networks with gaurenteed live nodes
        networks['ANY'].init(unchainedNodes)
    }catch(e){
        console.error(e)
    }
}
onStart()

//route
@Tags('Private Endpoints')
/**
 *  Test
 */
@Route('')
export class pioneerPrivateController extends Controller {



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
        let tag = TAG + " | register | ";
        try {
            log.info(tag,"register body: ", body);
            log.info(tag,"register body: ", JSON.stringify(body));
            if (!body.context) throw new Error("Missing context parameter!");
            if (!body.blockchains) throw new Error("Missing blockchains parameter!");
            if (!body.walletDescription || typeof body.walletDescription === 'string') throw new Error("Invalid walletDescription parameter! Expected a non-string value.");
            if (!body.data || !body.data.pubkeys) throw new Error("Missing or Invalid pubkeys parameter in the data object!");

            let username;
            const authInfo = await redis.hgetall(authorization);
            if (Object.keys(authInfo).length === 0) {
                log.debug("New user!");
                // Generate a unique identifier for each registration if the user hasn't chosen a username
                username = body.username || "user:" + uuidv4();
                let userInfo = {
                    username,
                    queryKey: authorization,
                    publicAddress: body.publicAddress,
                    verified: false,
                    wallets: [body.context],
                    pubkeys: ([] as any[]).concat(...body.data.pubkeys.map((pubkey: any) => ({ ...pubkey, context: body.context })))
                };
                await redis.hmset(authorization, userInfo);
            } else {
                log.debug(tag,"Existing user!");
                if(body.username !== authInfo.username){
                    //update username
                    log.debug(tag,"Updating username!");
                    redis.hset(authorization,"username",body.username)
                    username = body.username
                } else {
                    username = authInfo.username;
                }
            }

            let redisSuccessKey = await redis.hmset(authorization, { username });
            let redisSuccessUser = await redis.hmset(username, { username, queryKey: authorization });
            log.debug("redisSuccessKey: ", redisSuccessKey);
            log.debug("redisSuccessUser: ", redisSuccessUser);

            let userInfoMongo = await usersDB.findOne({ username });
            if (!userInfoMongo) {
                // New user in MongoDB
                let code = randomstring.generate(6).toUpperCase();
                let pubkeys = []
                for(let i = 0; i < body.data.pubkeys.length; i++){
                    let pubkey = body.data.pubkeys[i]
                    pubkey.context = body.context
                    pubkeys.push(pubkey)
                }
                let userInfo = {
                    username,
                    publicAddress: body.publicAddress,
                    verified: false,
                    code,
                    auth: authorization,
                    id: "pioneer:" + pjson.version + ":" + uuidv4(),
                    registered: new Date().getTime(),
                    nonce: Math.floor(Math.random() * 10000),
                    wallets: [body.context],
                    isSynced: false,
                    pubkeys
                };
                userInfoMongo = userInfo
                try {
                    await usersDB.insert(userInfo);
                } catch (error) {
                    if (error.code === 11000) {
                        // Duplicate key error, handle it gracefully
                        throw new Error("103: Unable to create a new user, the username is already taken!");
                    } else {
                        throw error;
                    }
                }
            }

            let isNewWallet = userInfoMongo && userInfoMongo.wallets ? !userInfoMongo.wallets.some(wallet => wallet === body.context) : true;
            let isNewWalletDescription = userInfoMongo && userInfoMongo.walletDescriptions ? !userInfoMongo.walletDescriptions.some(walletDesc => walletDesc.context === body.context) : true;

            if (isNewWallet) {
                // Update the existing user's information with the new pubkeys/wallet
                await usersDB.update({ username }, { $addToSet: { "wallets": body.context, "pubkeys": { $each: ([] as Pubkey[]).concat(...body.data.pubkeys.map((pubkey: Pubkey) => ({ ...pubkey, context: body.context }))) } } });
            }

            if (isNewWalletDescription) {
                // Add a new wallet description if it doesn't already exist
                let walletDescription = {
                    context: body.context,
                    type: body.walletDescription.type,
                    valueUsdContext: 0 // Placeholder value for responseMarkets.total
                };
                await usersDB.update({ username }, { $addToSet: { "walletDescriptions": walletDescription } });
            }

            if (isNewWallet) {
                await redis.sadd(username + ':wallets', body.context);
            }

            // Register with pioneer and get balances
            if (!body.data.pubkeys) throw new Error("Cannot register an empty wallet!");
            // pioneer.register(username, ([] as Pubkey[]).concat(...body.data.pubkeys.map((pubkey: Pubkey) => ({ ...pubkey, context: body.context }))), body.context);

            // Add any pubkeys missing from the user
            log.debug(tag, "userInfoMongo: ", userInfoMongo);
            let pubkeysMongo = userInfoMongo.pubkeys || [];
            //only new keys? untested
            let pubkeysRegistering = ([] as Pubkey[]).concat(...body.data.pubkeys.map((pubkey: Pubkey) => ({ ...pubkey, context: body.context }))); // Flatten the pubkeys array and add the context
            //let pubkeysRegistering = body.data.pubkeys
            log.debug(tag, "pubkeysMongo: ", pubkeysMongo);
            log.debug(tag, "pubkeysRegistering: ", pubkeysRegistering);
            log.info(tag, "pubkeysMongo: ", pubkeysMongo.length);
            log.info(tag, "pubkeysRegistering: ", pubkeysRegistering.length);
            //register new pubkeys

            //get balances
            let allBalances:any = [];
            let allNfts = [];

            // Validate pubkeys are in pubkeys
            // let missingPubkeys = body.data.pubkeys.flat().filter(pubkey =>
            //     !userInfoFinal.pubkeys.some(existingPubkey => existingPubkey.pubkey === pubkey.pubkey)
            // );
            //
            // if (missingPubkeys.length > 0) {
            //     missingPubkeys.forEach(pubkey => console.log("Pubkey not found:", pubkey.pubkey));
            //     for(let i = 0; i < missingPubkeys.length; i++){
            //         let pubkey = missingPubkeys[i]
            //         let resultRegister = await pioneer.register(username, [pubkey], body.context)
            //         allBalances = resultRegister.balances
            //         allNfts = resultRegister.nfts || []
            //     }
            // }

            //add raw pubkeys to mongo
            if(pubkeysRegistering.length > 0){
                log.info("register newPubkeys: ", pubkeysRegistering.length);
                //pioneer.register(username, pubkeysRegistering, body.context)
                let resultRegister = await pioneer.register(username, pubkeysRegistering, body.context)
                log.info("resultRegister: ", resultRegister);
                allBalances = resultRegister.balances
                log.debug("Adding pubkey to the user: ", pubkeysRegistering);
                // await usersDB.update(
                //     { username: userInfoMongo.username },
                //     {
                //         $addToSet: { pubkeys: pubkeysRegistering },
                //         $set: { isSynced: false }
                //     }
                // );
            } else {
                log.debug("No new pubkeys to register!");
            }

            let userInfoFinal = await usersDB.findOne({ username });
            log.debug("userInfoFinal: ", userInfoFinal);

            // Validate the context is in wallets
            if (!userInfoFinal.wallets.includes(body.context)) {
                throw new Error("Invalid wallet context!");
            }

            // Validate the wallet is in walletDescriptions
            let walletExistsInDescriptions = userInfoFinal.walletDescriptions.some(walletDesc => walletDesc.context === body.context);
            if (!walletExistsInDescriptions) {
                throw new Error("Wallet description not found!");
            }

            //TODO bring this back, broke in MM adding new pubkeys
            // Validate pubkeys are in pubkeys
            // let missingPubkeysFinal = body.data.pubkeys.flat().filter(pubkey =>
            //     !userInfoFinal.pubkeys.some(existingPubkey => existingPubkey.pubkey === pubkey.pubkey)
            // );
            //
            // if (missingPubkeysFinal.length > 0) {
            //     missingPubkeysFinal.forEach(pubkey => console.log("Pubkey not found:", pubkey.pubkey));
            //     log.error(tag,"Failed to register: missingPubkeysFinal: ", missingPubkeysFinal);
            //     throw new Error("Failed to register pubkey!");
            // }

            let { pubkeys } = await pioneer.getPubkeys(username);
            if(!pubkeys) throw new Error("No pubkeys found!")
            log.debug("pubkeys returned from pioneer: ", pubkeys.length);


            for (let i = 0; i < pubkeys.length; i++) {
                let pubkey = pubkeys[i];
                let balances = await pubkey.balances || []
                for (let j = 0; j < balances.length; j++) {
                    let balance = balances[j];
                    allBalances.push(balance);
                }

                let nfts = await pubkey.nfts || [];
                for (let j = 0; j < nfts.length; j++) {
                    let nft = nfts[j];
                    allNfts.push(nft);
                }
            }

            userInfoFinal.balances = allBalances;
            userInfoFinal.nfts = allNfts;

            for (let i = 0; i < allNfts.length; i++) {
                let nft = allNfts[i];
                if (nft.name === "Pioneer") {
                    userInfoFinal.isPioneer = true;
                    userInfoFinal.pioneerImage = nft.image;
                }
                if (nft.name === "Foxitar") {
                    userInfoFinal.isFox = true;
                }
                // Add other conditions for different nft names if needed
            }

            if (!userInfoFinal.balances) userInfoFinal.balances = [];

            //if no context, set to wallet0
            if (!userInfoFinal.context) {
                userInfoFinal.context = userInfoFinal.wallets[0]
            }

            return userInfoFinal;
        } catch (e) {
            log.error(tag,"Error: ", e);
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }



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
        Get user info
        get the users bitcoin address

        This is the primary way to get your bitcoin address
        This is the primary way to get a users info

        @route GET /user/info
        @param {string} authorization - queryKey
        @returns {object} userInfo


        example return:

     */

    @Get('/user')
    public async user(@Header('Authorization') authorization: string): Promise<any> {
        let tag = TAG + " | user | "
        try{
            log.debug(tag,"queryKey: ",authorization)
            let accountInfo = await redis.hgetall(authorization)
            if(Object.keys(accountInfo).length === 0) {
                return {
                    success:false,
                    error:"QueryKey not registered!"
                }
            } else {
                log.debug(tag,"accountInfo: ",accountInfo)
                let username = accountInfo.username
                if(!username){
                    return {
                        success:false,
                        error:"QueryKey has no username registered!"
                    }
                } else {
                    //TODO maybe refresh mongo balances here?
                    //wallets
                    let userInfoMongo = await usersDB.findOne({username})
                    if(!userInfoMongo){
                        return {
                            success:false,
                            error:"username registered!"
                        }
                    } else {
                        //get balances
                        let allBalances = [];
                        let allNfts = [];
                        let { pubkeys, balances } = await pioneer.getPubkeys(username);
                        //let pubkeys = userInfoMongo.pubkeys
                        log.debug(tag, "pubkeys: ", pubkeys.length);
                        log.debug(tag, "balances: ", balances.length);

                        userInfoMongo.balances = balances;
                        userInfoMongo.nfts = allNfts;

                        for (let i = 0; i < allNfts.length; i++) {
                            let nft = allNfts[i];
                            if (nft.name === "Pioneer") {
                                userInfoMongo.isPioneer = true;
                                userInfoMongo.pioneerImage = nft.image;
                            }
                            if (nft.name === "Foxitar") {
                                userInfoMongo.isFox = true;
                            }
                            // Add other conditions for different nft names if needed
                        }

                        //is synced

                        if (!userInfoMongo.balances) userInfoMongo.balances = [];
                        //if no context, set to wallet0
                        if (!userInfoMongo.context) {
                            userInfoMongo.context = userInfoMongo.wallets[0]
                        }

                        return userInfoMongo
                    }
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
    // @Get('/info/{context}')
    // public async info(context:string,@Header('Authorization') authorization: string): Promise<any> {
    //     let tag = TAG + " | info | "
    //     try{
    //         log.debug(tag,"queryKey: ",authorization)
    //         if(!context) throw Error("103: context required!")
    //         log.debug(tag,"context: ",context)
    //
    //         let accountInfo = await redis.hgetall(authorization)
    //         log.debug(tag,"accountInfo: ",accountInfo)
    //
    //         let walletInfo:any = {}
    //         if(accountInfo){
    //             log.debug(tag,"accountInfo: ",accountInfo)
    //             let username = accountInfo.username
    //             if(!username){
    //                 log.error(tag,"invalid accountInfo: ",accountInfo)
    //                 throw Error("unknown token. token:"+authorization)
    //             }
    //             //sismember
    //             let isKnownWallet = await redis.sismember(username+':wallets',context)
    //             log.debug(tag,"isKnownWallet: ",isKnownWallet)
    //
    //             //TODO add balances
    //             //throw error if every balance does NOT have a true > 0  balance AND and icon
    //             //verify date on balance, if old mark old
    //             //make schema verbose and repetitive, and optimize later
    //             let { pubkeys, balances } = await pioneer.getPubkeys(username,context)
    //             //build wallet info
    //             walletInfo.masters = masters
    //             //hydrate market data for all pubkeys
    //             log.debug(tag,"pubkeys: ",JSON.stringify(pubkeys))
    //
    //             //
    //             //get market data from markets
    //             let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
    //             let marketCacheCoinCap = await redis.get('markets:CoinCap')
    //
    //             if(!marketCacheCoinGecko){
    //                 let marketInfoCoinGecko = await markets.getAssetsCoingecko()
    //                 if(marketInfoCoinGecko){
    //                     //market info found for
    //                     marketInfoCoinGecko.updated = new Date().getTime()
    //                     // redis.setex('markets:CoinGecko',60 * 15,JSON.stringify(marketInfoCoinGecko))
    //                     redis.set('markets:CoinGecko',JSON.stringify(marketInfoCoinGecko))
    //                     marketCacheCoinGecko = marketInfoCoinGecko
    //                 }
    //             }
    //
    //             if(!marketCacheCoinCap){
    //                 let marketInfoCoinCap = await markets.getAssetsCoinCap()
    //                 if(marketInfoCoinCap){
    //                     //market info found for
    //                     marketInfoCoinCap.updated = new Date().getTime()
    //                     redis.set('markets:CoinCap',JSON.stringify(marketInfoCoinCap))
    //                     marketCacheCoinCap = marketInfoCoinCap
    //                 }
    //             }
    //
    //             log.debug(tag,"pubkeys: ",JSON.stringify(pubkeys))
    //             log.debug(tag,"Checkpoint pre-build balances: (pre)")
    //             let responseMarkets = await markets.buildBalances(marketCacheCoinCap, marketCacheCoinGecko, pubkeys, context)
    //             log.debug(tag,"responseMarkets: ",responseMarkets)
    //
    //             let statusNetwork = await redis.get('cache:status')
    //             if(statusNetwork){
    //                 statusNetwork = JSON.parse(statusNetwork)
    //                 log.debug(tag,"statusNetwork: ",statusNetwork)
    //                 //mark swapping protocols for assets
    //                 for(let i = 0; i < responseMarkets.balances.length; i++){
    //                     let balance = responseMarkets.balances[i]
    //                     responseMarkets.balances[i].protocols = []
    //
    //                     //thorchain
    //                     if(statusNetwork.exchanges.thorchain.assets.indexOf(balance.symbol) >= 0){
    //                         responseMarkets.balances[i].protocols.push('thorchain')
    //                     }
    //                     //osmosis
    //                     if(statusNetwork.exchanges.osmosis.assets.indexOf(balance.symbol) >= 0){
    //                         responseMarkets.balances[i].protocols.push('osmosis')
    //                     }
    //                     //0x
    //                     if(balance.network === 'ETH'){
    //                         responseMarkets.balances[i].protocols.push('0x')
    //                     }
    //                     log.debug(tag,"balance: ",balance)
    //                 }
    //             } else {
    //                 log.error(tag,'Missing cache for network status!')
    //             }
    //
    //
    //             walletInfo.pubkeys = pubkeys
    //             walletInfo.balances = responseMarkets.balances
    //             walletInfo.totalValueUsd = responseMarkets.total
    //             walletInfo.username = username
    //             walletInfo.context = context
    //             walletInfo.apps = await redis.smembers(username+":apps")
    //             //Hydrate userInfo
    //             let userInfoMongo = await usersDB.findOne({username})
    //             log.debug(tag,"userInfoMongo: ",userInfoMongo)
    //             //migrations
    //             if(!userInfoMongo) throw Error("103: unknown user! username: "+username)
    //             walletInfo.wallets = userInfoMongo?.wallets
    //             walletInfo.blockchains = userInfoMongo?.blockchains
    //
    //             return walletInfo
    //         }else{
    //             return {
    //                 error:true,
    //                 errorCode:1,
    //                 message:"Token not Registered!"
    //             }
    //         }
    //
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

    @Get('/invocations')
    public async invocations(@Header('Authorization') authorization: string): Promise<any> {
        let tag = TAG + " | invocations | "
        try{
            log.debug(tag,"queryKey: ",authorization)

            let accountInfo = await redis.hgetall(authorization)
            if(!accountInfo || Object.keys(accountInfo).length === 0) {
                return {
                    success:false,
                    error:"QueryKey not registered!"
                }
            } else {
                log.debug(tag,"accountInfo: ",accountInfo)
                let username = accountInfo.username
                if(!username) throw Error("invalid accountInfo: missing username!")
                let userInfo = await redis.hgetall(username)
                log.debug(tag,"userInfo: ",userInfo)
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
            log.debug(tag,"accountInfo: ",accountInfo)


            if(accountInfo){
                //TODO
                // let refreshedTime = await redis.get(accountInfo.username+":lastRefresh")
                // if(!refreshedTime){
                // }


                //get all pubkeys for username
                let pubkeysOwnedBySdk = await pubkeysDB.find({tags:{ $all: [accountInfo.username]}})
                log.debug(tag,"pubkeysOwnedBySdk: ",pubkeysOwnedBySdk)

                //for each wallet
                let wallets = accountInfo.wallets || ""
                if(wallets)wallets = wallets.split(",")
                log.debug(tag,"wallets: ",wallets)

                let output:any = {
                    success:true,
                    results:[]
                }
                for(let i = 0; i < wallets.length; i++){
                    let wallet = wallets[i]
                    log.debug(tag,"wallet: ",wallet)

                    //pubkeys filter by wallet

                    //TODO if wallet not in redis add to redis

                    //re-submit to pubkey ingester
                    let result = await pioneer.register(accountInfo.username, pubkeysOwnedBySdk,wallet)
                    log.debug(tag,"resultPioneer: ",result)
                    output.results.push(result)
                }

                return output
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
            log.debug(tag,"accountInfo: ",accountInfo)

            let walletInfo:any
            if(accountInfo){
                let username = accountInfo.username
                if(!username){
                    log.error(tag,"invalid accountInfo: ",accountInfo)
                    throw Error("unknown token. token:"+authorization)
                }
                let userInfo = await redis.hgetall(username)
                log.debug(tag,"userInfo: ",userInfo)
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

    /*
        Redeem

         */

    /** POST /users */
    @Post('/redemption')
    //CreateAppBody
    public async redemption(@Body() body: any): Promise<any> {
        let tag = TAG + " | redeem | "
        try{
            log.debug(tag,"body: ",body)
            let publicAddress = body.publicAddress
            let signature = body.signature
            let message = body.message
            if(!publicAddress) throw Error("Missing publicAddress!")
            if(!signature) throw Error("Missing signature!")
            if(!message) throw Error("Missing message!")

            log.debug(tag,{publicAddress,signature,message})
            //get user
            let user = await usersDB.findOne({publicAddress})
            log.debug(tag,"user: ",user)
            if(!user) throw Error("User not found! publicAddress: "+publicAddress)
            if(!user.nonce) throw Error("Invalid user saved!")
            log.debug(tag,"user: ",user.nonce)

            //@TODO validate nonce

            //validate sig
            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)

            //if valid sign and return token
            if(addressFromSig === publicAddress){
                log.debug(tag,"valid signature: ")
                //validate last time a redemption occurred

                //if < 1 week ago allow redemption

                //credits 100 * balance fox

                // await redis.hmset(token,{
                //     publicAddress
                // })
                // log.debug("token: ",token)
                // return(token)
            } else {
                throw Error("Invalid signature")
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

    /*
    LOGIN

     */

    /** POST /users */
    @Post('/login')
    //CreateAppBody
    public async login(@Body() body: any): Promise<any> {
        let tag = TAG + " | login | "
        try{
            log.debug(tag,"body: ",body)
            let publicAddress = body.publicAddress
            let signature = body.signature
            let message = body.message
            if(!publicAddress) throw Error("Missing publicAddress!")
            if(!signature) throw Error("Missing signature!")
            if(!message) throw Error("Missing message!")

            log.debug(tag,{publicAddress,signature,message})
            //get user
            let user = await usersDB.findOne({publicAddress})
            log.debug(tag,"user: ",user)
            //if no user create one
            if(!user) throw Error("User not found! publicAddress: "+publicAddress)
            if(!user.nonce) throw Error("Invalid user saved!")
            log.debug(tag,"user: ",user.nonce)

            //@TODO validate nonce

            //validate sig
            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)

            //if valid sign and return token
            if(addressFromSig === publicAddress){
                log.debug(tag,"valid signature: ")
                let token = sign({
                        payload: {
                            id: "bla",
                            publicAddress,
                        },
                    },
                    config.secret,
                    {
                        algorithm: config.algorithms[0],
                    })

                //generate new nonce
                let nonceNew = Math.floor(Math.random() * 10000);
                let updateUser = await usersDB.update({publicAddress},{$set:{nonce:nonceNew}})
                log.debug("updateUser: ",updateUser)

                await redis.hmset(token,{
                    publicAddress
                })
                log.debug("token: ",token)
                return(token)
            } else {
                throw Error("Invalid signature")
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
    //depricated?
    @Get('/balance/{network}')
    public async syncPubkeys(network:string, @Header('Authorization') authorization): Promise<any> {
        let tag = TAG + " | balance | "
        try{
            log.debug(tag,"queryKey: ",authorization)
            log.debug(tag,"network: ",network)

            let accountInfo = await redis.hgetall(authorization)
            let username = accountInfo.username
            if(!username) throw Error("unknown token! token:"+authorization)

            log.debug(tag,"username: ",username)
            //get pubkeys from mongo
            let userInfo = await usersDB.findOne({username})
            if(!userInfo) {
                throw Error("102: unknown user! username: "+username)
            }
            log.debug(tag,"userInfo: ",userInfo)
            log.debug(tag,"pubkeys: ",userInfo.pubkeys)
            //get pubkey for asset
            let pubkeyAsset = userInfo.pubkeys.filter((pubkey) => pubkey.network === network);
            log.debug("pubkeyAsset: ",pubkeyAsset)
            log.debug("pubkey: ",pubkeyAsset[0].pubkey)
            log.debug("context: ",pubkeyAsset[0].context)
            let pubkeys = []
            for(let i = 0; i < pubkeyAsset.length; i++){
                let pubkey = pubkeyAsset[i]
                pubkey.username = username
                pubkey.queueId = "placeholder"
                let balances = await pioneer.balances(pubkey)
                log.debug("balances: ",balances)
                //update pubkey
                pubkey.balances = balances.balances
                pubkey.nfts = balances.nfts
                pubkeys.push(pubkey)
            }
            return pubkeys
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
            log.debug(tag,"account: ",body)
            log.debug(tag,"Authorization: ",Authorization)
            let output:any = {}
            // get auth info
            let authInfo = await redis.hgetall(Authorization)
            log.debug(tag,"authInfo: ",authInfo)
            if(!authInfo) throw Error("108: unknown token! ")
            if(!body.asset) throw Error("1011: invalid body missing asset")

            // get user info
            let userInfo = await redis.hgetall(authInfo.username)
            if(!userInfo) throw Error("109: unknown username! ")
            log.debug(tag,"userInfo: ",userInfo)
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
     * Update current account blockchain context
     * @param request This is an application pairing submission
     */

    @Post('/setBlockchainContext')
    //TODO bump and add type back
    public async setBlockchainContext(@Body() body: any, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | setBlockchainContext | "
        try{
            log.debug(tag,"account: ",body)
            log.debug(tag,"Authorization: ",Authorization)
            let output:any = {}
            // get auth info
            let authInfo = await redis.hgetall(Authorization)
            log.debug(tag,"authInfo: ",authInfo)
            if(!authInfo) throw Error("108: unknown token! ")
            if(!body.blockchain) throw Error("1011: invalid body missing blockchain")

            // get user info
            let userInfo = await redis.hgetall(authInfo.username)
            if(!userInfo) throw Error("109: unknown username! ")
            log.debug(tag,"userInfo: ",userInfo)
            output.username = authInfo.username

            if(userInfo.blockchainContext !== body.blockchain) {
                let contextSwitch = {
                    type:"blockchainContext",
                    username:userInfo.username,
                    blockchain:body.asset
                }
                publisher.publish('context',JSON.stringify(contextSwitch))
                output.success = true
                //update Redis to new context
                let updateRedis = await redis.hset(authInfo.username,'blockchainContext',body.blockchain)
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
            log.debug(tag,"account: ",body)
            log.debug(tag,"Authorization: ",Authorization)
            let output:any = {}
            // get auth info
            let authInfo = await redis.hgetall(Authorization)
            log.debug(tag,"authInfo: ",authInfo)
            if(!authInfo) throw Error("108: unknown token! ")

            // get user info
            let userInfo = await redis.hgetall(authInfo.username)
            if(!userInfo) throw Error("109: unknown username! ")
            log.debug(tag,"userInfo: ",userInfo)
            output.username = authInfo.username
            //get wallets
            let allWallets = await redis.smembers(authInfo.username+":wallets")
            log.debug(tag,"allWallets: ",allWallets)
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
                    log.debug(tag,"DEBUG: publish on false context switch")
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
            log.debug(tag,"body: ",body)
            log.debug(tag,"Authorization: ",Authorization)
            let userInfo = await redis.hgetall(Authorization)
            log.debug(tag,"userInfo: ",userInfo)
            //TODO auth
            //get invocation owner
            let invocationInfo = await invocationsDB.findOne({invocationId:body.invocationId})
            if(invocationInfo.username === userInfo.username){
                log.debug(tag," auth success")
                //TODO use auth
                //update database
                let updateResult
                if(body.unsignedTx){
                    //update state to
                    updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{unsignedTx:body.unsignedTx,state:'builtTx'}})
                }

                if(body.signedTx){
                    if(!invocationInfo.signTx){
                        //push signedTx event
                        let event = {
                            type:'update',
                            username:userInfo.username,
                            invocation:body
                        }
                        publisher.publish('invocations',JSON.stringify(event))
                        updateResult = await invocationsDB.update({invocationId:body.invocationId},{$set:{signedTx:body.signedTx,state:'signedTx'}})
                    }

                }
                return(updateResult);
            } else {
                log.error(tag,"auth failure!")
                log.error(tag,"owned: ",invocationInfo.username)
                log.error(tag,"given: ",userInfo.username)
                throw Error("Failed to auth! owned: "+invocationInfo.username+" given: "+userInfo.username)
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
     * Ignore a Coin from a users view
     * @param request This is an application pairing submission
     */

    @Post('/ignoreShitcoin')
    public async ignoreShitcoin(@Body() body: IgnoreShitcoins, @Header() Authorization: any): Promise<any> {
        let tag = TAG + " | ignoreShitcoin | "
        try{
            let output:any = {}
            log.debug(tag,"account: ",body)
            log.debug(tag,"Authorization: ",Authorization)
            let coins = body.coins || body.shitcoins

            // get auth info
            let authInfo = await redis.hgetall(Authorization)
            log.debug(tag,"authInfo: ",authInfo)
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
            log.debug(tag,"account: ",body)
            log.debug(tag,"Authorization: ",Authorization)

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
            log.debug(tag,"account: ",body)
            log.debug(tag,"Authorization: ",Authorization)

            // get user info
            let userInfo = await redis.hgetall(Authorization)
            log.debug(tag,"userInfo: ",userInfo)
            //if no info throw
            if(!userInfo) throw Error("User not known!")
            if(!userInfo.username) throw Error("pair: invalid user!")

            // get queryKey for code sdk user
            let sdkQueryKey = await redis.hget(body.code,"pairing")
            if(sdkQueryKey) {
                log.debug(tag,"sdkQueryKey: ",sdkQueryKey)
                let userInfoSdk = await redis.hgetall(sdkQueryKey)
                log.debug(tag,"userInfoSdk: ",userInfoSdk)

                //if username sdk
                if(userInfoSdk && userInfoSdk.wallets){
                    //TODO handle if multiple?
                    let context = userInfoSdk.wallets
                    log.debug(tag,"context: ",context)

                    let userInfoOfSdkKey = await usersDB.findOne({username:userInfoSdk.username})
                    log.debug(tag,"userInfoOfSdkKey: ",userInfoOfSdkKey)

                    //add metamask wallet to user
                    let updateDBPubkey = await usersDB.update({username:userInfo.username},{ $addToSet: { "wallets": context } })
                    log.debug(tag,"updateDBPubkey: ",updateDBPubkey)

                    //for wallet on sdkUserInfo
                    for(let i = 0; i < userInfoOfSdkKey.walletDescriptions.length; i++){
                        //add metamask description to walletDescriptions
                        let updateDBuser = await usersDB.update({username:userInfo.username},{ $addToSet: { "walletDescriptions": userInfoOfSdkKey.walletDescriptions[i] } })
                        log.debug(tag,"updateDBuser: ",updateDBuser)
                    }

                    //add wallet to user


                    //if owned by username
                    let pubkeysOwnedBySdk = await pubkeysDB.find({tags:{ $all: [userInfoSdk.username]}})
                    log.debug(tag,"pubkeysOwnedBySdk: ",pubkeysOwnedBySdk)

                    for(let i = 0; i < pubkeysOwnedBySdk.length; i++){
                        let pubkey = pubkeysOwnedBySdk[i]
                        log.debug(tag,"pubkey: ",pubkey)
                        let updateDBPubkey = await pubkeysDB.update({pubkey:pubkey.pubkey},{ $addToSet: { "tags": userInfo.username } })
                        log.debug(tag,"updateDBPubkey: ",updateDBPubkey)

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
                log.debug(tag,"pushAppMongo: ",pushAppMongo)

                // sdkUser
                let sdkUser = {
                    username:userInfo.username,
                    paired: new Date().getTime(),
                    queryKey: sdkQueryKey,
                    url
                }
                log.debug(tag,"pairing sdkUser: ",sdkUser)
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
            log.debug(tag,"userInfo: ",userInfo)

            // if known return username (already paired)

            // is service known
                //if new service save to db

            //create random code
            let code = randomstring.generate(6)
            code = code.toUpperCase()
            log.debug(tag,"code: ",code)

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
               log.debug(tag,"utxos: ",utxos)

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
                log.debug(tag,"checkpoint 1a auth key NOT known")
                newKey = true
            }
            if(!username) throw Error("104: unable to find username!")

            let userInfoMongo = await usersDB.findOne({username})
            log.debug(tag,"userInfoMongo: ",userInfoMongo)

            log.debug("checkpoint 2 post mongo query!")
            if(!userInfoMongo || newKey){
                log.debug("checkpoint 2a no mongo info!")
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

            log.debug("checkpoint 3")
            let userInfoRedis = await redis.hgetall(username)
            log.debug(tag,"userInfoRedis: ",userInfoRedis)
            log.debug("checkpoint 4 final ")

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
