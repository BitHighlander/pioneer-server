/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

// const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
// const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
// const midgard = require("@pioneer-platform/midgard-client")
// const uuid = require('short-uuid');
// const queue = require('@pioneer-platform/redis-queue');
import {
    Error,
    ApiError,
    Chart,
} from "@pioneer-platform/pioneer-types";
//
// let connection  = require("@pioneer-platform/default-mongo")
//
// let usersDB = connection.get('users')
// let pubkeysDB = connection.get('pubkeys')
// let txsDB = connection.get('transactions')
// let invocationsDB = connection.get('invocations')
// let utxosDB = connection.get('utxo')
//
// usersDB.createIndex({id: 1}, {unique: true})
// usersDB.createIndex({username: 1}, {unique: true})
// txsDB.createIndex({txid: 1}, {unique: true})
// utxosDB.createIndex({txid: 1}, {unique: true})
// pubkeysDB.createIndex({pubkey: 1}, {unique: true})
// invocationsDB.createIndex({invocationId: 1}, {unique: true})
// txsDB.createIndex({invocationId: 1})
//
// const fakeUa = require('fake-useragent');
// console.log(fakeUa());
//
//rest-ts
import { Body, Controller, Get, Post, Route, Tags } from 'tsoa';
//
// const axios = require('axios')
// const sdk = require('api')('@opensea/v1.0#jblb1ukzswdj7x');

let zapper = require("@pioneer-platform/zapper-client")


//route
@Tags('NFT Endpoints')
@Route('')
export class nftPublicController extends Controller {

    /*
     * get bufficorn
     *
     *
     *
     * */
    @Get('/nft/{address}')
    public async getNfts(address:string) {
        let tag = TAG + " | nfts | "
        try{
            try{
                let tokens = await zapper.getTokens(address)
                return tokens
            }catch(e){
                return {
                    success:false,
                    msg:"zapper failed to provide data!",
                    error:e.toString()
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

    @Get('/portfolio/{address}')
    public async getPortfolio(address:string) {
        let tag = TAG + " | getPortfolio | "
        try{
            try{
                let tokens = await zapper.getPortfolio(address)
                return tokens
            }catch(e){
                return {
                    success:false,
                    msg:"zapper failed to provide data!",
                    error:e.toString()
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
}
