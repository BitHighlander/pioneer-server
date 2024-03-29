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
// let explore = require('@pioneer-platform/pioneer-explore')
// explore.init({})

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
            log.debug(tag, 'tx: ', body);
            if (!body.to) throw new Error('to is required!');
            if (!body.from) throw new Error('from is required!');
            if (!body.data) throw new Error('data is required!');

            // chainId
            const chainId = parseInt(body.chainId, 10) || 1;
            const sort = { ping: -1 };
            const entry = await nodesDB.findOne({ chainId }, { sort });
            if(!entry) throw new Error('no node found for chainId: ' + chainId)
            log.debug(tag, 'entry: ', entry);
            // get node for chainId
            const service = entry.service;
            log.debug(tag, 'entry: ', entry);
            log.debug(tag, 'service: ', service);

            const provider = new ethers.providers.JsonRpcProvider(service);

            let isEIP1559 = false;
            if (!body.gas && body.maxPriorityFeePerGas) isEIP1559 = true;
            //prefer EIP1559 on ETH mainnet
            if(body.chainId === '0x1' || body.chainId === 1) isEIP1559 = true;
            const FALLBACK_GAS_LIMIT = ethers.BigNumber.from('1000000'); // Set the fallback gas limit to a large value

            let gasLimit;
            try {
                gasLimit = await provider.estimateGas({
                    from: body.from,
                    to: body.to,
                    value: 0,
                    data: body.data,
                });
                log.debug(tag, 'gasLimit: ', gasLimit);
                // Calculate a 20% buffer and add it to the gasLimit
                const buffer = gasLimit.mul(20).div(100); // 20% buffer
                gasLimit = gasLimit.add(buffer);
                //if gas limit is < 21000 then set to 21000
                if (gasLimit.lt(ethers.BigNumber.from('36000'))) {
                    gasLimit = ethers.BigNumber.from('36000');
                }
            } catch (e) {
                gasLimit = FALLBACK_GAS_LIMIT; // Fallback to the large gas limit
            }

            log.debug("gasLimit: ", gasLimit);
            log.debug("gasLimit: ", gasLimit.toString());

            let recommended = {
                "addressNList": body.addressNList,
                "from": body.from,
                "chainId": body.chainId,
                "data": body.data,
                "to": body.to,
                "value": body.value,
            };

            const gasLimitCalculated = parseInt(gasLimit.toString())
            const bodyGasLimitDecimal = parseInt(body.gasLimit, 16);
            log.debug(tag,"gasLimitCalculated: ", gasLimitCalculated);
            log.debug(tag,"bodyGasLimitDecimal: ", bodyGasLimitDecimal);

            log.debug(tag, "gasLimitCalculated: ", gasLimitCalculated);
            log.debug(tag, "bodyGasLimitDecimal: ", bodyGasLimitDecimal);

            if (!isNaN(gasLimitCalculated) && !isNaN(bodyGasLimitDecimal)) {
                if (gasLimitCalculated > bodyGasLimitDecimal) {
                    log.debug("calculated gas limit is larger!");
                    recommended["gasLimit"] = "0x"+gasLimitCalculated.toString(16);
                } else {
                    log.debug("original gas limit is larger!");
                    log.debug("Original: ", body.gasLimit);
                    recommended["gasLimit"] = body.gasLimit;
                }
            } else if (!isNaN(gasLimitCalculated)) {
                log.debug("original gas limit is not a number! Using calculated gas limit.");
                recommended["gasLimit"] = "0x"+gasLimitCalculated.toString(16);
            } else if (!isNaN(bodyGasLimitDecimal)) {
                log.debug("calculated gas limit is not a number! Using original gas limit.");
                recommended["gasLimit"] = body.gasLimit;
            } else {
                log.debug("Both calculated and original gas limits are not numbers!");
                // Handle the case when both values are NaN, such as setting a default value or throwing an error
            }

            if (isEIP1559) {
                let getFeeData = await provider.getFeeData();

                recommended["maxPriorityFeePerGas"] = getFeeData.maxPriorityFeePerGas.toHexString();
                recommended["maxFeePerGas"] = getFeeData.maxFeePerGas.toHexString();

                if(recommended["maxFeePerGas"] > recommended["maxPriorityFeePerGas"]){
                    recommended["maxPriorityFeePerGas"] = recommended["maxFeePerGas"];
                }
                if(recommended["maxFeePerGas"] === '0x0' || parseInt(recommended["maxFeePerGas"]) === 0) throw Error("Invalid! maxFeePerGas is 0x0");
                if(recommended["maxPriorityFeePerGas"] === '0x0' || parseInt(recommended["maxPriorityFeePerGas"]) === 0) throw Error("Invalid! maxFeePerGas is 0x0");

            } else {
                log.debug("non-EIP1559 transaction");
                const gasPrice = await provider.getGasPrice();
                const gasPriceCalculated = gasPrice.toHexString();
                log.debug("gasPriceCalculated: ", gasPriceCalculated);

                const gasPriceCalculatedDecimal = parseInt(gasPriceCalculated, 16);
                const bodyGasDecimal = parseInt(body.gas, 16);
                log.debug("gasPriceCalculatedDecimal: ", gasPriceCalculatedDecimal);
                log.debug("bodyGasDecimal: ", bodyGasDecimal);

                if (!isNaN(gasPriceCalculatedDecimal) && !isNaN(bodyGasDecimal)) {
                    if (gasPriceCalculatedDecimal > bodyGasDecimal) {
                        log.debug(tag, "gas Calculated a higher fee than original!");
                        recommended["gas"] = gasPriceCalculated;
                    } else {
                        log.debug(tag, "gas sticking with original! It's higher");
                        recommended["gas"] = body.gas;
                    }
                } else if (!isNaN(gasPriceCalculatedDecimal)) {
                    log.debug("Original gas value is not a number! Using calculated gas value.");
                    recommended["gas"] = gasPriceCalculated;
                } else if (!isNaN(bodyGasDecimal)) {
                    log.debug("Calculated gas value is not a number! Using original gas value.");
                    recommended["gas"] = body.gas;
                } else {
                    log.debug("Both calculated and original gas values are not numbers!");
                    // Handle the case when both values are NaN, such as setting a default value or throwing an error
                }

                //gas limit
                const gasLimitCalculated = gasLimit.toHexString();

            }

            let output = {
                invokeId: "invoke:" + short.generate(),
                success: true,
                isEIP1559,
                original: body,
                isError: false,
                recommended
            };

            insightDB.insert(output);

            let insight = {
                "invokeId": output.invokeId,
                "isEIP1559": isEIP1559.toString(),
                "chainId": chainId.toString(),
                "from": body.from,
                "to": body.to,
            };

            let view = {
                type: "insight",
                data: insight,
                message: "insight"
            };

            let payload = {
                channel: "1123742848039272488",
                responses: {
                    sentences: [],
                    views: [
                        view
                    ]
                }
            };

            publisher.publish('discord-bridge', JSON.stringify(payload));
            log.debug("Output: ", output);
            return output;
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
        let tag = TAG + " | simulation | "
        try{
            log.debug(tag,"mempool tx: ",body)
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
    // @Post('pioneer/query')
    // public async query(@Header('Authorization') authorization: string, @Body() body: any): Promise<any> {
    //     let tag = TAG + " | query | "
    //     let timingResults = {};
    //     try{
    //         let startTime = Date.now();
    //
    //         log.debug(tag,"Query Body:  ",body)
    //         if(!body.query) throw Error("query is required!")
    //
    //         let authTimeStart = Date.now();
    //         const authInfo = await redis.hgetall(authorization)
    //         timingResults['auth'] = Date.now() - authTimeStart;
    //         if(Object.keys(authInfo).length === 0) throw Error("You must register to use Query!")
    //         log.debug("authInfo: ",authInfo)
    //
    //         let userDataTimeStart = Date.now();
    //         const userData = await redis.get(authorization + ":user");
    //         log.debug("userData: ",userData)
    //         timingResults['userData'] = Date.now() - userDataTimeStart;
    //
    //         //username
    //
    //         //@TODO streaming search pushs
    //         //assign queryId
    //         //push events to stream to username
    //
    //         //get summary of query
    //
    //         //get all related assets
    //
    //         //get all related blockchains
    //
    //         //get all related nodes
    //
    //         //get all related dapps
    //
    //         //use db to build response
    //         let memory = ["data.txt"]
    //         let loadKnowledgeTimeStart = Date.now();
    //         await explore.loadKnowledge(memory)
    //         timingResults['loadKnowledge'] = Date.now() - loadKnowledgeTimeStart;
    //
    //         if(userData){
    //             await explore.loadString(userData)
    //         }
    //
    //         let queryTimeStart = Date.now();
    //         let query = body.query
    //         log.debug("query: ",query)
    //         if(!query) throw Error("Must have query!")
    //         let response = await explore.query(body.query)
    //         if(!response) throw Error("Failed to build response!")
    //         timingResults['query'] = Date.now() - queryTimeStart;
    //         timingResults['total'] = Date.now() - startTime;
    //
    //         let output = {
    //             response,
    //             timings: timingResults
    //         }
    //
    //         return output
    //     } catch(e){
    //         let errorResp:Error = {
    //             success:false,
    //             tag,
    //             e
    //         }
    //         log.error(tag,"e: ",{errorResp})
    //         throw new ApiError("error",503,"error: "+e.toString());
    //     }
    // }

}
