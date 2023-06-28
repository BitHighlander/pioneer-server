/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '
// import jwt from 'express-jwt';
const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis} = require('@pioneer-platform/default-redis')
let ai = require('@pioneer-platform/pioneer-intelligence')
ai.init(process.env['OPENAI_API_KEY'])
const util = require('util')

//TODO if no mongo use nedb?
//https://github.com/louischatriot/nedb

let config = {
    algorithms: ['HS256' as const],
    secret: 'shhhh', // TODO Put in process.env
};


let connection  = require("@pioneer-platform/default-mongo")
let usersDB = connection.get('users')
let assetsDB = connection.get('assets')
let pubkeysDB = connection.get('pubkeys')
let txsDB = connection.get('transactions')
let invocationsDB = connection.get('invocations')
let utxosDB = connection.get('utxo')
let blockchainsDB = connection.get('blockchains')
let dappsDB = connection.get('apps')
let nodesDB = connection.get('nodes')

blockchainsDB.createIndex({blockchain: 1}, {unique: true})
// blockchainsDB.createIndex({chainId: 1}, {unique: true})
nodesDB.createIndex({service: 1}, {unique: true})
usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
// assetsDB.createIndex({name: 1}, {unique: true})
// assetsDB.createIndex({assetId: 1}, {unique: true})
assetsDB.createIndex({caip: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})
// knowledgeDB.createIndex({publicAddress: 1}, {unique: true})
// dapsDB.createIndex({id: 1}, {unique: true})
//globals

const ADMIN_PUBLIC_ADDRESS = process.env['ADMIN_PUBLIC_ADDRESS']
if(!ADMIN_PUBLIC_ADDRESS) throw Error("Invalid ENV missing ADMIN_PUBLIC_ADDRESS")

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';

import {
    Error,
    CreateAppBody
} from "@pioneer-platform/pioneer-types";


export class ApiError extends Error {
    private statusCode: number;
    constructor(name: string, statusCode: number, message?: string) {
        super(message);
        this.name = name;
        this.statusCode = statusCode;
    }
}

//route
@Tags('Charting Endpoints')
@Route('')
export class ChartingController extends Controller {

    //Info
    @Get('/uncharted')
    public async uncharted() {
        let tag = TAG + " | uncharted | "
        try{

            let query = {};
            query['isCharted'] = false;

            // Blockchains Supported by keepkey
            let blockchainsUncharted = await blockchainsDB.count(query);
            let assetsUncharted = await assetsDB.count(query);
            let nodesUncharted = await nodesDB.count(query);
            let dappsUncharted = await nodesDB.count(query);

            return {
                blockchains: blockchainsUncharted,
                assets: assetsUncharted,
                nodes: nodesUncharted,
                dapps: dappsUncharted,
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

    //build chart
    @Get('/charting')
    public async randomCharting() {
        let tag = TAG + " | uncharted | "
        try{

            let query = {};
            query['isCharted'] = false;

            // Blockchains Supported by keepkey
            let blockchainsUncharted = await blockchainsDB.count(query);
            let assetsUncharted = await assetsDB.count(query);
            let nodesUncharted = await nodesDB.count(query);
            let dappsUncharted = await nodesDB.count(query);

            //get random work
            let randomWork = await blockchainsDB.findOne({isCharted:false});

            let objectives = "given object determining completeness and correctness, and return a score, and a list of missing fields, and actions a human should take to verify data"

            //get AI analysis
            let schema = {
                type: "options node/asset/blockchain",
                completeness: " 1 - 10 options",
                correctness: " 1 - 10 options",
                missing: "array of missing fields",
                analysis: " verbal summary of the data",
                topics: "array of topics related to the data",
                actions: "set of actionalables for a human to take to verify data",
            }
            //return charting to user for approval
            let analysis = await ai.analyzeData(randomWork,objectives, schema)
            console.log("analysis: ",analysis)

            return {
                entryType:"blockchain",
                analysis,
                data:randomWork
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

    //submit charting



}
