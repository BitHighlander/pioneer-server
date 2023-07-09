/*

    Pioneer REST endpoints



 */
import {bufferToHex} from "ethereumjs-util";

let TAG = ' | API | '
// import jwt from 'express-jwt';
const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
let ai = require('@pioneer-platform/pioneer-intelligence')
ai.init(process.env['OPENAI_API_KEY'])
const util = require('util')
import { v4 as uuidv4 } from 'uuid';
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
let terminalsDB = connection.get('terminals')
let banklessTxDB = connection.get('bankless-transactions')
terminalsDB.createIndex({terminalId: 1}, {unique: true})
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
import {recoverPersonalSignature} from "eth-sig-util";


export class ApiError extends Error {
    private statusCode: number;
    constructor(name: string, statusCode: number, message?: string) {
        super(message);
        this.name = name;
        this.statusCode = statusCode;
    }
}

//route
@Tags('Bankless Endpoints')
@Route('')
export class BanklessController extends Controller {

    //global Info
    @Get('/bankless/info')
    public async banklessInfo() {
        let tag = TAG + " | banklessInfo | "
        try{

            //get all terminals
            let allTerminals = await terminalsDB.find({})

            return allTerminals
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
    @Get('/bankless/terminal/public')
    public async terminalListing(@Header('Authorization') authorization: string) {
        let tag = TAG + " | terminalListing | "
        try{

            return true
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
    @Get('/bankless/terminal/private/{terminalName}')
    public async terminalPrivate(@Header('Authorization') authorization: string, terminalName: string) {
        let tag = TAG + " | terminalPrivate | "
        try{
            log.info(tag,"queryKey: ",authorization)
            log.info(tag,"terminalName: ",terminalName)
            let output:any = {}
            let accountInfo = await redis.hgetall(authorization)
            let banklessAuth = await redis.hgetall("bankless:auth:"+authorization)
            log.info(tag,"banklessAuth: ",banklessAuth)
            let username = accountInfo.username
            if(!username) throw Error("unknown token! token: "+authorization)
            log.info(tag,"accountInfo: ",accountInfo)

            //if valid give terminal history
            let terminalInfo = await terminalsDB.findOne({terminalName})
            log.info(tag,"terminalInfo: ",terminalInfo)
            //get last txs

            //get cap table


            return terminalInfo
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
    @Post('/bankless/terminal/submit')
    //CreateAppBody
    public async submitTerminal(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | submitTerminal | "
        try{
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            // if(!body.signer) throw Error("invalid signed payload missing signer!")
            // if(!body.payload) throw Error("invalid signed payload missing payload!")
            // if(!body.signature) throw Error("invalid signed payload missing !")
            // if(!body.nonce) throw Error("invalid signed payload missing !")

            //get bankless auth info
            let banklessAuth = await redis.hgetall("bankless:auth:"+authorization)
            log.info(tag,"banklessAuth: ",banklessAuth)

            if(Object.keys(banklessAuth).length === 0) {
                //new terminal
            }
            let entry = {
                terminalId:body.terminalId,
                terminalName:body.terminalName,
                tradePair: body.tradePair,
                rate: body.rate,
                pubkey:body.pubkey,
                fact:"",
                location:body.location
            }
            let saveDb = await terminalsDB.insert(entry)
            log.info(tag,"saveDb: ",saveDb)

            //register location

            //current rate

            return(true);
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

    //startSession
    @Post('/bankless/terminal/update')
    //CreateAppBody
    public async updateTerminal(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | updateTerminal | "
        try{
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            // if(!body.signer) throw Error("invalid signed payload missing signer!")
            // if(!body.payload) throw Error("invalid signed payload missing payload!")
            // if(!body.signature) throw Error("invalid signed payload missing !")
            // if(!body.nonce) throw Error("invalid signed payload missing !")
            //@TODO update auth
            //must be lp add or remove
            //must be terminal add or remove
            let location = body.location
            let terminalName = body.terminalName
            let rate = body.lastRate

            let terminalInfo = await terminalsDB.update(
                { terminalName },
                { $set: { location, rate } }
            );



            return(terminalInfo);
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

    //startSession
    @Post('/bankless/terminal/startSession')
    //CreateAppBody
    public async startSession(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | startSession | "
        try{
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            // if(!body.signer) throw Error("invalid signed payload missing signer!")
            // if(!body.payload) throw Error("invalid signed payload missing payload!")
            // if(!body.signature) throw Error("invalid signed payload missing !")
            // if(!body.nonce) throw Error("invalid signed payload missing !")

            //must be lp add or remove
            if(!body.type) throw Error("invalid type!")
            if(!body.terminalName) throw Error("invalid type!")

            //create an actionId
            let actionId = "action:"+uuidv4()
            body.actionId = actionId
            let trade
            publisher.publish('bankless', JSON.stringify({type:"terminal",payload:body}))

            //wait for session to be created
            let resultCreate = await redisQueue.blpop(actionId, 30);
            log.info(tag,"resultCreate: ",resultCreate)
            //current rate

            return(JSON.parse(resultCreate[1]));
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
