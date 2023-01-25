/*

    Pioneer REST endpoints



 */

let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const { subscriber, publisher, redis} = require('@pioneer-platform/default-redis')
let queue = require("@pioneer-platform/redis-queue")
// let client = require("@pioneer-platform/cosmos-network")
// let connection  = require("@pioneer-platform/mongo-default-env")
//
// let usersDB = connection.get('users')
// let txsDB = connection.get('transactions')
// let txsRawDB = connection.get('transactions-raw')
const axios = require('axios')
const short = require('short-uuid');
const { queryString } = require("object-query-string");
const os = require("os")
let connection  = require("@pioneer-platform/default-mongo")
//globals
let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let txsRawDB = connection.get('transactions-raw')
let devsDB = connection.get('developers')
let dapsDB = connection.get('dapps')
//modules

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';
import * as express from 'express';

//import { User, UserCreateRequest, UserUpdateRequest } from '../models/user';

//types
import {
    Health,
    ApiError,
    Error
} from "@pioneer-platform/pioneer-types";

//route
@Tags('Status Endpoints')
@Route('')
export class pioneerController extends Controller {

    //remove api key


    /*
        Get articles
    */



    /*
     * CHART Dapp
     *
     *    Build an atlas on a new Dapp
     *
     * */
    @Post('pioneer/query')
    public async query(@Header('Authorization') authorization: string, @Body() body: any): Promise<any> {
        let tag = TAG + " | query | "
        try{
            log.info(tag,"mempool tx: ",body)
            if(!body.query) throw Error("query is required!")
            const authInfo = await redis.hgetall(authorization)
            if(Object.keys(authInfo).length === 0) throw Error("You must register to use Query!")
            log.info("authInfo: ",authInfo)
            let queryId = short.generate()
            //save to mongo
            let work = {
                username: authInfo.username,
                query: body.query,
                queryId,
            }
            //add to work
            let result = await queue.createWork('bots:pioneer:ingest',work)
            log.debug(tag,"result: ",result)

            //submit to work
            let output = {
                queryId
            }

            return output
        } catch(e){
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
