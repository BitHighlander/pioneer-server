/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
const midgard = require("@pioneer-platform/midgard-client")
const uuid = require('short-uuid');
const queue = require('@pioneer-platform/redis-queue');
import {
    Error,
    ApiError,
    Chart,
} from "@pioneer-platform/pioneer-types";

let connection  = require("@pioneer-platform/default-mongo")

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


//Cache time
let CACHE_TIME = 1000 * 60 * 1
let CACHE_OVERRIDE = true
//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';
// import * as express from 'express';



//TODO move this to coins module!
let UTXO_COINS = [
    'BTC',
    'BCH',
    'LTC',
    'TEST'
]

//route
@Tags('Public Endpoints')
@Route('')
export class pioneerPublicController extends Controller {

    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/list')
    public async atlas() {
        let tag = TAG + " | atlas | "
        try{

            //Get tracked contracts



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
     * CHART
     *
     *    Build an atlas
     *
     * */
    @Post('atlas/chart')
    public async chart(@Body() body: Chart): Promise<any> {
        let tag = TAG + " | pushTx | "
        try{
            log.info(tag,"mempool tx: ",body)
            let output:any = {}
            //create queueId
            let queueId = uuid.generate()
            output.queueId = queueId

            //add contract pubkey to work
            //TODO type Chart
            let work:any = {
                symbol: body.network,
                network: body.network,
                queueId,
                type:"contract",
                tags:body.tags,
                username: body.contractName,
                walletId: "contract:"+body.contractName,
                pubkey: body.pubkey,
                charted: new Date().getTime()
            }

            //save to queue
            output.result = await queue.createWork("pioneer:pubkey:ingest",work)

            //track
            let savedRedis = await redis.hmset(body.pubkey.toLowerCase(),work)
            output.savedRedis = savedRedis

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
