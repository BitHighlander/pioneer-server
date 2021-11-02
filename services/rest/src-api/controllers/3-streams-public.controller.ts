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
@Tags('Streams Endpoints')
@Route('')
export class streamsPublicController extends Controller {

    /*
     * Streams
     *
     *    get payment streams by address
     *
     * */
    @Get('/streams/{address}')
    public async streams(address:string) {
        let tag = TAG + " | streams | "
        try{
            address = address.toLowerCase()
            log.debug(tag,"address: ",address)
            //Get tracked contracts
            let allStreamInfo = await txsDB.find({ $and: [ {tags:{ $all: [address]}}, {tags:{ $all: ["streamCreate"]}} ] })
            log.debug(tag,"allStreamInfo: ",allStreamInfo)

            let output:any = {}
            output.saleryIds = []
            output.streams = {}
            output.streamInfo = []
            for(let i = 0; i < allStreamInfo.length; i++){
                let streamInfo = allStreamInfo[i].events[0]
                log.debug(tag,"streamInfo: ",streamInfo)
                streamInfo = streamInfo.stream
                output.saleryIds.push(streamInfo.saleryId)
                log.debug(tag,"streamInfo.stream: ",streamInfo)
                //getSymbolForContract
                let streamAsset = await networks['ETH'].getSymbolFromContract(streamInfo.streamAsset)
                output.streams['stream:'+streamInfo.streamId+':'+streamAsset] = streamInfo.streamAmount

                //get verbose stream info
                let verboseInfo = await networks['ETH'].getStreamInfo(streamInfo.saleryId)
                output.streamInfo.push(verboseInfo)
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


}
