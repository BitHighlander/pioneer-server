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
let connection = require("@pioneer-platform/default-mongo")
const markets = require('@pioneer-platform/markets')
let usersDB = connection.get('users')
let pubkeysDB = connection.get('pubkeys')
let txsDB = connection.get('transactions')
let invocationsDB = connection.get('invocations')
let utxosDB = connection.get('utxo')
let devsDB = connection.get('developers')
let blockchainsDB = connection.get('blockchains')
let dappsDB = connection.get('apps')
let nodesDB = connection.get('nodes')
let assetsDB = connection.get('assets')
let insightDB = connection.get('insight')

usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

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
import { ethers } from 'ethers';

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
    public async smartInsight(
        @Header('Authorization') authorization: string,
        @Body() body: any
    ): Promise<any> {
        const tag = TAG + ' | smartInsight | ';
        try {
            log.info(tag, 'tx: ', body);
            if (!body.to) throw Error('to is required!');
            if (!body.from) throw Error('from is required!');
            if (!body.data) throw Error('data is required!');

            // chainId
            const chainId = parseInt(body.chainId, 10) || 1;
            const sort = { ping: -1 };
            const entry = await nodesDB.findOne({ chainId }, { sort });
            // get node for chainId
            const service = entry.service;
            log.debug(tag, 'entry: ', entry);
            log.info(tag, 'service: ', service);

            const provider = new ethers.providers.JsonRpcProvider(service);

            let isEIP1559 = false
            if(!body.gas && body.maxPriorityFeePerGas) isEIP1559 = true;
            // let gasLimit = await provider.estimateGas({});


            let gasLimit
            try{
                gasLimit = await provider.estimateGas({
                    from: body.from,
                    to: body.to,
                    value: 0,
                    data: body.data,
                });
                log.info(tag, 'gasLimit: ', gasLimit);
            }catch(e){
                gasLimit = await provider.estimateGas({});
            }

            log.info("gasLimit: ",gasLimit)
            log.info("gasLimit: ",gasLimit.toString())

            // save into insightDb

            // push to discord

            // push event to metric
            let result = await harpie.validateTransactionv2(body.to,body.from,body.data)
            console.log("result: ",result)


            let recommended = {
                "addressNList": body.addressNList,
                "from": body.from,
                "chainId": body.chainId,
                "data": body.data,
                "to": body.to,
                "value": body.value,
            }
            let gasPrice = await provider.getGasPrice();  // Legacy gas price
            let block = await provider.getBlock("latest");
            let baseFeePerGas = block.baseFeePerGas;  // EIP-1559 base fee
            let priorityFeePerGas = ethers.BigNumber.from("2").mul(gasPrice).div("10");  // Tip, usually ~10-20% of maxFeePerGas
            let maxFeePerGas = gasPrice;

            //add gas
            recommended["gasLimit"] = '0x' + gasLimit.toHexString();
            if(isEIP1559){
                recommended["maxPriorityFeePerGas"] = priorityFeePerGas.toHexString();
                recommended["maxFeePerGas"] = maxFeePerGas.toHexString();
            }else{
                recommended["gas"] = gasPrice.toHexString();
            }

            let output = {
                invokeId:"invoke:"+short.generate(),
                success: true,
                analysis:result,
                isEIP1559,
                original: body,
                isError: false,
                recommended
            }
            insightDB.insert(output)

            let insight = {
                "invokeId":output.invokeId,
                "analysis":result.summary,
                "isEIP1559":isEIP1559.toString(),
                "chainId":chainId.toString(),
                "from":body.from,
                "to":body.to,
            }

            let view  = {
                type:"insight",
                data:insight,
                message:"insight"
            }

            let payload = {
                channel:"1123742848039272488",
                responses:{
                    sentences:[],
                    views:[
                        view
                    ]
                }
            }
            publisher.publish('discord-bridge',JSON.stringify(payload))

            return output
        } catch (e) {
            const errorResp: Error = {
                success: false,
                tag,
                e,
            };
            log.error(tag, 'e: ', { errorResp });
            throw new ApiError('error', 503, 'error: ' + e.toString());
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
