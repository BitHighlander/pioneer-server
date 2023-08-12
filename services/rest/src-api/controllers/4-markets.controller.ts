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

const markets = require('@pioneer-platform/markets')

//rest-ts
import { Body, Controller, Get, Post, Route, Tags } from 'tsoa';

//route
@Tags('Atlas Endpoints')
@Route('')
export class pioneerMarketsController extends Controller {

    /*
     * Market Info
     *
     *    Cache Market info
     *
     * */

    @Get('/market/top')
    public async market() {
        let tag = TAG + " | market | "
        try{

            //Get tracked contracts
            let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
            let marketCacheCoincap = await redis.get('markets:Coincap')

            if(!marketCacheCoinGecko){
                let marketInfoCoinGecko = await markets.getAssetsCoingecko()
                if(marketInfoCoinGecko){
                    //market info found for
                    marketInfoCoinGecko.updated = new Date().getTime()
                    redis.setex('markets:CoinGecko',JSON.stringify(marketInfoCoinGecko),60 * 15)
                    marketCacheCoinGecko = marketInfoCoinGecko
                }
            }

            if(!marketCacheCoincap){
                let marketInfoCoincap = await markets.getAssetsCoincap()
                if(marketInfoCoincap){
                    //market info found for
                    marketInfoCoincap.updated = new Date().getTime()
                    redis.setex('markets:CoinGecko',JSON.stringify(marketInfoCoincap),60 * 15)
                    marketCacheCoincap = marketInfoCoincap
                }
            }


            return {
                "type":"topListVerbose",
                success:true,
                "coincap":marketCacheCoinGecko,
                "coingecko":marketCacheCoincap
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


}
