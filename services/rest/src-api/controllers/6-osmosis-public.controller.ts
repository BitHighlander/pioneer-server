/*

    Pioneer REST endpoints



 */
import axios from "axios";

let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
const midgard = require("@pioneer-platform/midgard-client")
const uuid = require('short-uuid');
const queue = require('@pioneer-platform/redis-queue');
import BigNumber from 'bignumber.js'
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

let blockchains = []
const networks:any = {}
if(process.env['FEATURE_OSMOSIS_BLOCKCHAIN']){
    blockchains.push('osmosis')
    networks['OSMO'] = require('@pioneer-platform/osmosis-network')
}

//rest-ts
import { Body, Controller, Get, Post, Route, Tags } from 'tsoa';

//route
@Tags('Atlas Endpoints')
@Route('')
export class pioneerOsmosisController extends Controller {

    /*
     * Market Info
     *
     *    Cache Market info
     *
     * */

    @Get('/osmosis/pools')
    public async pools() {
        let tag = TAG + " | pools | "
        try{
            return networks['OSMO'].getPools()
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

    @Get('/osmosis/imperator/pools')
    public async imperatorPools() {
        let tag = TAG + " | price | "
        try{
            //https://api-osmosis.imperator.co/tokens/v2/CRBRUS
            let result = await axios.get('https://api-osmosis.imperator.co/api/v1/osmosis/price/pools/v2/all?low_liquidity=true')
            return result.data
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

    @Get('/osmosis/price/{token}')
    public async tokenPrice(token:string) {
        let tag = TAG + " | price | "
        try{
            //https://api-osmosis.imperator.co/tokens/v2/CRBRUS
            let result = await axios.get('https://api-osmosis.imperator.co/tokens/v2/'+token)
            return result.data
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

    @Get('/osmosis/pool/{pair}')
    public async pool(pair:string) {
        let tag = TAG + " | pair | "
        try{
            return networks['OSMO'].getPool(pair)
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

    @Get('/osmosis/quoteSwap/{pair}/{amountIn}')
    public async quoteSwap(pair:string,amountIn:string) {
        let tag = TAG + " | pair | "
        try{
            log.debug(tag,"pair: ",pair)
            log.debug(tag,"amountIn: ",amountIn)

            let pool = await networks['OSMO'].getPool(pair)

            const constantProduct = new BigNumber(pool.poolAssets[0].token.amount).times(
                pool.poolAssets[1].token.amount
            )
            if(pair.indexOf("_") == -1) throw new Error("pair requires _ example: (ATOM_OSMO)")
            let assets = pair.split("_")

            let sellAssetInitialPoolSize
            let buyAssetInitialPoolSize

            if(pair === "ATOM_OSMO"){
                sellAssetInitialPoolSize = new BigNumber(pool.poolAssets[0].token.amount)
                buyAssetInitialPoolSize = new BigNumber(pool.poolAssets[1].token.amount)
            }else if(pair === "OSMO_ATOM"){
                sellAssetInitialPoolSize = new BigNumber(pool.poolAssets[1].token.amount)
                buyAssetInitialPoolSize = new BigNumber(pool.poolAssets[0].token.amount)
            }else{
                throw new Error("Pair not supported!")
            }

            log.debug(tag,"sellAssetInitialPoolSize: ",sellAssetInitialPoolSize)
            log.debug(tag,"buyAssetInitialPoolSize: ",buyAssetInitialPoolSize)
            let amountInNumber = new BigNumber(amountIn)

            const initialMarketPrice = sellAssetInitialPoolSize.dividedBy(buyAssetInitialPoolSize)
            log.debug(tag,"initialMarketPrice: ",initialMarketPrice)

            const sellAssetFinalPoolSize = sellAssetInitialPoolSize.plus(amountInNumber)
            log.debug(tag,"sellAssetFinalPoolSize: ",sellAssetFinalPoolSize)

            const buyAssetFinalPoolSize = constantProduct.dividedBy(sellAssetFinalPoolSize)
            log.debug(tag,"buyAssetFinalPoolSize: ",buyAssetFinalPoolSize)

            const finalMarketPrice = sellAssetFinalPoolSize.dividedBy(buyAssetFinalPoolSize)
            log.debug(tag,"finalMarketPrice: ",finalMarketPrice)

            const buyAmount = buyAssetInitialPoolSize.minus(buyAssetFinalPoolSize)
            log.debug(tag,"buyAmount: ",buyAmount)

            const rate = new BigNumber(buyAmount).dividedBy(amountInNumber)
            log.debug(tag,"rate: ",rate)

            const priceImpact = new BigNumber(1).minus(initialMarketPrice.dividedBy(finalMarketPrice)).abs()
            return {
                rate: rate.toString(),
                priceImpact: priceImpact.toString(),
                tradeFee: pool.poolParams.swapFee,
                buyAmount: buyAmount.toString()
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
