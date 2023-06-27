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
let insightDB = connection.get('insight')
//modules
let harpie = require("@pioneer-platform/harpie-client")
let blocknative = require("@pioneer-platform/blocknative-client")
blocknative.init()

//explore
let explore = require('@pioneer-platform/pioneer-explore')
explore.init({})

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
     * Harpie TX insight
     *
     *
     * */
    @Post('pioneer/evm/tx')
    public async smartInsight(@Header('Authorization') authorization: string, @Body() body: any): Promise<any> {
        let tag = TAG + " | smartInsight | "
        try{
            log.info(tag,"mempool tx: ",body)
            if(!body.to) throw Error("to is required!")
            if(!body.from) throw Error("from is required!")
            if(!body.data) throw Error("data is required!")

            //save into insightDb

            //push to discord

            //push event to metric

            let result = await harpie.validateTransactionv2(body.to,body.from,body.data)
            console.log("result: ",result)

            insightDB.insert(result)

            return result
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

    /*
    * Blocknative TX Simulator
    *
    *
    * */
    @Post('pioneer/evm/tx/simulate')
    public async simulation(@Header('Authorization') authorization: string, @Body() body: any): Promise<any> {
        let tag = TAG + " | smartInsight | "
        try{
            log.info(tag,"mempool tx: ",body)
            if(!body.to) throw Error("to is required!")
            if(!body.from) throw Error("from is required!")
            if(!body.data) throw Error("data is required!")
            let transaction = {
                "to":body.to,
                "from":body.from,
                "gas":body.gas || 10407056,
                "maxFeePerGas":body.maxFeePerGas || 102306635634,
                "maxPriorityFeePerGas":body.maxFeePerGas || 2.14,
                "value":body.value || 100000000000000000,
                "input":body.data
            }
            let result = await blocknative.simulateTx('ethereum',transaction)

            return result
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


    /*
     * CHART Dapp
     *
     *    Build an atlas on a new Dapp
     *
     * */
    @Post('pioneer/query')
    public async query(@Header('Authorization') authorization: string, @Body() body: any): Promise<any> {
        let tag = TAG + " | query | "
        let timingResults = {};
        try{
            let startTime = Date.now();

            log.info(tag,"Query Body:  ",body)
            if(!body.query) throw Error("query is required!")

            let authTimeStart = Date.now();
            const authInfo = await redis.hgetall(authorization)
            timingResults['auth'] = Date.now() - authTimeStart;
            if(Object.keys(authInfo).length === 0) throw Error("You must register to use Query!")
            log.info("authInfo: ",authInfo)

            let userDataTimeStart = Date.now();
            const userData = await redis.get(authorization + ":user");
            log.info("userData: ",userData)
            timingResults['userData'] = Date.now() - userDataTimeStart;

            //@TODO streaming search pushs
            //assign queryId
            //push events to stream to user

            //get summary of query

            //get all related assets

            //get all related blockchains

            //get all related nodes

            //get all related dapps

            //use db to build response
            let memory = ["data.txt"]
            let loadKnowledgeTimeStart = Date.now();
            await explore.loadKnowledge(memory)
            timingResults['loadKnowledge'] = Date.now() - loadKnowledgeTimeStart;

            if(userData){
                await explore.loadString(userData)
            }

            let queryTimeStart = Date.now();
            let query = body.query
            log.info("query: ",query)
            if(!query) throw Error("Must have query!")
            let response = await explore.query(body.query)
            if(!response) throw Error("Failed to build response!")
            timingResults['query'] = Date.now() - queryTimeStart;
            timingResults['total'] = Date.now() - startTime;

            let output = {
                response,
                timings: timingResults
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
