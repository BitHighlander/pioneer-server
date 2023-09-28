/*

    Pioneer Skills endpoints



 */
import axios from "axios";

let TAG = ' | Skills | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()

import {
    Error,
    ApiError,
} from "@pioneer-platform/pioneer-types";

import { SwapKitApi, QuoteResponse, CachedPricesParams, CachedPricesResponse, QuoteParams, GasRatesResponse, TxnResponse, TokenlistProvidersResponse, ThornameResponse } from '@thorswap-lib/swapkit-api';


let connection  = require("@pioneer-platform/default-mongo")


//rest-ts
import {Body, Controller, Get, Post, Route, Tags, Example, Header} from 'tsoa';
//route
@Tags('thorswap Endpoint (3rd party)')
@Route('')
export class thorswapController extends Controller {

    /*
     * thorswap API
     *
     *
     *
     * */

    //global Info
    @Get('/thorswap/getThornameRlookup/:address/:chain')
    public async getThornameRlookup(address:string, chain:string){
        let tag = TAG + " | getThornameRlookup | "
        try{

            //txs history
            let output = await SwapKitApi.getThornameRlookup(address, chain);

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

    //global Info
    @Get('/thorswap/getThornameRegisteredChains/:address')
    public async getThornameRegisteredChains(address:string) {
        let tag = TAG + " | getThornameRegisteredChains | "
        try{

            //txs history
            let output = await SwapKitApi.getThornameRegisteredChains(address);

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

    //global Info
    @Get('/thorswap/getThornameAddresses/:address')
    public async getThornameAddresses(address:string) {
        let tag = TAG + " | getThornameAddresses | "
        try{

            //txs history
            let output = await SwapKitApi.getThornameAddresses(address);

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

    //global Info
    @Get('/thorswap/getTokenList/:tokenlist')
    public async getTokenList(tokenlist:string) {
        let tag = TAG + " | getTokenlistProviders | "
        try{

            //txs history
            let output = await SwapKitApi.getTokenList(tokenlist);

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

    //global Info
    @Get('/thorswap/getTokenlistProviders')
    public async getTokenlistProviders() {
        let tag = TAG + " | getTokenlistProviders | "
        try{

            //txs history
            let output = await SwapKitApi.getTokenlistProviders();

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

    //global Info
    @Get('/thorswap/getTxnDetails/:txid')
    public async getTxnDetails(txid:string) {
        let tag = TAG + " | getTxnDetails | "
        try{

            //txs history
            let output = await SwapKitApi.getTxnDetails(txid);

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

    //Submit review
    @Post('/thorswap/getCachedPrices')
    //CreateAppBody
    public async getCachedPrices(@Body() body: CachedPricesParams): Promise<CachedPricesResponse[]> {
        let tag = TAG + " | getCachedPrices | "
        try{
            log.debug(tag,"body: ",body)

            //txs history
            let output = await SwapKitApi.getCachedPrices(body);

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

    //Submit review
    @Post('/thorswap/getQuote')
    //CreateAppBody
    public async getQuote(@Body() body: QuoteParams): Promise<QuoteResponse> {
        let tag = TAG + " | getQuote | "
        try{
            log.debug(tag,"body: ",body)

            //txs history
            let output = await SwapKitApi.getQuote(body);

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
