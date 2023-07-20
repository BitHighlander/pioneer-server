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
let sessionsDB = connection.get('bankless-sessions')
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
    @Get('/bankless/terminal/{terminalName}')
    public async terminalListing(terminalName: string) {
        let tag = TAG + " | terminalListing | "
        try{

            log.debug(tag,"terminalName: ",terminalName)
            let output:any = {}
            // let username = accountInfo.username
            // if(!username) throw Error("unknown token! token: "+authorization)

            //if valid give terminal history
            let terminalInfo = await terminalsDB.findOne({terminalName})
            log.debug(tag,"terminalInfo: ",terminalInfo)
            output.terminalInfo = terminalInfo

            //get last txs

            //get cap table

            return output
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
            log.debug(tag,"queryKey: ",authorization)
            log.debug(tag,"terminalName: ",terminalName)
            let output:any = {}
            let accountInfo = await redis.hgetall(authorization)
            let banklessAuth = await redis.hgetall("bankless:auth:"+authorization)
            log.debug(tag,"banklessAuth: ",banklessAuth)
            // let username = accountInfo.username
            // if(!username) throw Error("unknown token! token: "+authorization)
            log.debug(tag,"accountInfo: ",accountInfo)

            //if valid give terminal history
            let terminalInfo = await terminalsDB.findOne({terminalName})
            log.debug(tag,"terminalInfo: ",terminalInfo)
            output.terminalInfo = terminalInfo

            //get last txs

            //get cap table

            //get sessions:
            let sessions = await sessionsDB.find({terminalName})
            output.sessions = sessions

            return output
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
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            // if(!body.signer) throw Error("invalid signed payload missing signer!")
            // if(!body.payload) throw Error("invalid signed payload missing payload!")
            // if(!body.signature) throw Error("invalid signed payload missing !")
            if(!body.terminalName) throw Error("invalid terminalName missing !")
            if(!body.rate) throw Error("invalid rate missing !")
            if(!body.pubkey) throw Error("invalid pubkey missing !")
            if(!body.TOTAL_CASH) throw Error("invalid TOTAL_CASH missing !")
            if(!body.TOTAL_DAI) throw Error("invalid TOTAL_DAI missing !")
            if(!body.location) throw Error("invalid location missing !")
            if(!body.captable) throw Error("invalid captable missing !")

            let output:any = {}

            //get bankless auth info
            let banklessAuth = await redis.hgetall("bankless:auth:"+authorization)
            log.debug(tag,"banklessAuth: ",banklessAuth)


            if(Object.keys(banklessAuth).length === 0) {
                //new terminal
            }
            let entry = {
                terminalId:body.terminalId,
                terminalName:body.terminalName,
                tradePair: body.tradePair,
                rate: body.rate,
                pubkey:body.pubkey,
                TOTAL_CASH:body.TOTAL_CASH,
                TOTAL_DAI:body.TOTAL_DAI,
                captable:body.captable,
                fact:"",
                location:body.location
            }
            let saveDb = await terminalsDB.insert(entry)
            log.debug(tag,"saveDb: ",saveDb)
            output.success = true
            output.saveDb = saveDb
            //start session
            let session = {
                terminalName:entry.terminalName,
                type:"onStart",
                action:"start device",
                sessionId:body.sessionId,
                location:body.location,
                rate:entry.rate,
                TOTAL_CASH:entry.TOTAL_CASH,
                TOTAL_DAI:entry.TOTAL_DAI,
                start: new Date()
            }
            sessionsDB.insert(session)
            output.sessionId = session.sessionId

            //txs history


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

    @Post('/bankless/terminal/captable/update')
    //CreateAppBody
    public async updateTerminalCaptable(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | updateTerminalCaptable | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            // if(!body.signer) throw Error("invalid signed payload missing signer!")
            // if(!body.payload) throw Error("invalid signed payload missing payload!")
            // if(!body.signature) throw Error("invalid signed payload missing !")
            // if(!body.nonce) throw Error("invalid signed payload missing !")
            //@TODO update auth
            //must be lp add or remove
            //must be terminal add or remove
            let captable = body.captable
            let terminalName = body.terminalName

            let terminalInfo = await terminalsDB.update(
                { terminalName },
                { $set: { captable } }
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
    @Post('/bankless/terminal/update')
    //CreateAppBody
    public async updateTerminal(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | updateTerminal | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            // if(!body.signer) throw Error("invalid signed payload missing signer!")
            // if(!body.payload) throw Error("invalid signed payload missing payload!")
            // if(!body.signature) throw Error("invalid signed payload missing !")
            // if(!body.nonce) throw Error("invalid signed payload missing !")
            if(!body.terminalName) throw Error("invalid terminalName missing !")
            if(!body.rate) throw Error("invalid rate missing !")
            if(!body.pubkey) throw Error("invalid pubkey missing !")
            if(!body.TOTAL_CASH) throw Error("invalid TOTAL_CASH missing !")
            if(!body.TOTAL_DAI) throw Error("invalid TOTAL_DAI missing !")
            if(!body.location) throw Error("invalid location missing !")
            if(!body.captable) throw Error("invalid captable missing !")

            //@TODO update auth
            //must be lp add or remove
            //must be terminal add or remove
            let captable = body.captable
            let location = body.location
            let terminalName = body.terminalName
            let rate = body.lastRate
            let TOTAL_CASH = body.TOTAL_CASH
            let TOTAL_DAI = body.TOTAL_DAI

            publisher.publish('bankless', JSON.stringify({type:"rate",payload:{terminalName, rate, TOTAL_CASH, TOTAL_DAI}}))

            let terminalInfo = await terminalsDB.update(
                { terminalName },
                { $set: { location, rate, TOTAL_CASH, TOTAL_DAI, captable } }
            );

            //start session
            // let session = {
            //     terminalName,
            //     location,
            //     rate,
            //     TOTAL_CASH,
            //     TOTAL_DAI,
            //     start: new Date(),
            //     sessionId: "session:"+uuidv4()
            // }
            // sessionsDB.insert(session)
            // terminalInfo.sessionId = session.sessionId

            //get public tx history
            let txHistory = await banklessTxDB.find({terminalName})
            terminalInfo.txHistory = txHistory
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
    @Post('/bankless/terminal/event')
    //CreateAppBody
    public async pushEvent(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | pushEvent | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            // if(!body.signer) throw Error("invalid signed payload missing signer!")
            // if(!body.payload) throw Error("invalid signed payload missing payload!")
            // if(!body.signature) throw Error("invalid signed payload missing !")
            // if(!body.nonce) throw Error("invalid signed payload missing !")

            //must be lp add or remove
            if(!body.type) throw Error("invalid type!")
            if(!body.event) throw Error("invalid event!")
            if(!body.terminalName) throw Error("invalid type!")

            let session = {
                terminalName:body.terminalName,
                type:body.type,
                event:body.event,
                sessionId:body.sessionId,
                location:body.location,
                rate:body.rate,
                TOTAL_CASH:body.TOTAL_CASH,
                TOTAL_DAI:body.TOTAL_DAI,
            }
            let result = await sessionsDB.insert(session)

            log.debug(tag,"result: ",result)
            return(result);
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
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            // if(!body.signer) throw Error("invalid signed payload missing signer!")
            // if(!body.payload) throw Error("invalid signed payload missing payload!")
            // if(!body.signature) throw Error("invalid signed payload missing !")
            // if(!body.nonce) throw Error("invalid signed payload missing !")

            //must be lp add or remove
            if(!body.type) throw Error("invalid type!")
            if(!body.address) throw Error("invalid required address!")
            if(!body.terminalName) throw Error("invalid required terminalName!")

            //create an actionId
            let actionId = "action:"+uuidv4()
            body.actionId = actionId
            let trade
            publisher.publish('bankless', JSON.stringify({type:"terminal",payload:body}))

            //wait for session to be created
            let resultCreate = await redisQueue.blpop(actionId, 30);
            log.debug(tag,"resultCreate: ",resultCreate)
            log.debug(tag,"resultCreate: ",resultCreate[1])
            log.debug(tag,"resultCreate: ",typeof(resultCreate[1]))
            log.debug(tag,"resultCreate: ",JSON.parse(resultCreate[1]))
            //current rate
            let result = JSON.parse(resultCreate[1])
            log.debug(tag,"result: ",result)
            return(result);
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
