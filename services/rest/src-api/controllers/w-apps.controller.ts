/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis} = require('@pioneer-platform/default-redis')
import { recoverPersonalSignature } from 'eth-sig-util';
import { bufferToHex } from 'ethereumjs-util';
//TODO if no mongo use nedb?
//https://github.com/louischatriot/nedb
let connection  = require("@pioneer-platform/default-mongo")
let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let txsRawDB = connection.get('transactions-raw')
let appsDB = connection.get('apps')
const uuid = require('short-uuid');
const queue = require('@pioneer-platform/redis-queue');
txsDB.createIndex({txid: 1}, {unique: true})
txsRawDB.createIndex({txhash: 1}, {unique: true})
appsDB.createIndex({homepage: 1}, {unique: true})
appsDB.createIndex({id: 1}, {unique: true})

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
@Tags('App Store Endpoints')
@Route('')
export class WAppsController extends Controller {

    /*
        read
    */

    @Get('/apps/{limit}/{skip}')
    public async listApps(limit:number,skip:number) {
        let tag = TAG + " | health | "
        try{
            let apps = appsDB.find({whitelist:true},{limit,skip})
            return(apps)
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

    /*
        read
    */

    @Get('/spotlight')
    public async getSpotlight() {
        let tag = TAG + " | getSpotlight | "
        try{
            let apps = appsDB.findOne({whitelist:true,isSpotlight:true})
            return(apps)
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

    /*
        read
    */

    @Get('/apps/{developer}')
    public async listAppsByDeveloper(developer:any) {
        let tag = TAG + " | listAppsByDeveloper | "
        try{
            developer = developer.toLowerCase()
            let apps = appsDB.find({whitelist:true,developer})
            return(apps)
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

    /*
    TODO
    update
 */
    @Post('/apps/vote')
    //CreateAppBody
    public async voteOnApp(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | voteOnApp | "
        try{
            log.info(tag,"body: ",body)
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.info(tag,"addressFromSig: ",addressFromSig)

            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.vote) throw Error("Ivalid message missing value")
            let resultWhitelist:any = {}
            //get fox balance of address
            let work:any = {}
            let queueId = uuid.generate()
            work.vote = true
            work.queueId = queueId
            work.name = message.name
            work.payload = body
            resultWhitelist.success = true
            resultWhitelist.message = 'Address '+addressFromSig+' voted '+message.vote+' on  app '+message.name+' in the dapp store!'
            resultWhitelist.result = await queue.createWork("pioneer:facts:ingest",work)

            return(resultWhitelist);
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

    /*
        TODO
        update
     */
    @Post('/apps/update')
    //CreateAppBody
    public async updateApp(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | updateApp | "
        try{
            log.info(tag,"body: ",body)
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.info(tag,"addressFromSig: ",addressFromSig)

            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.key) throw Error("Ivalid message missing key")
            if(!message.value) throw Error("Ivalid message missing value")
            let resultWhitelist:any = {}
            if(addressFromSig === ADMIN_PUBLIC_ADDRESS) {
                delete message["_id"]
                resultWhitelist = await appsDB.update({name:message.name},{$set:{[message.key]:message.value}})
                log.info(tag,"resultWhitelist: ",resultWhitelist)
            } else {
                //get fox balance of address
                let work:any = {}
                let queueId = uuid.generate()
                work.queueId = queueId
                work.payload = body
                resultWhitelist.success = true
                resultWhitelist.message = 'Address '+addressFromSig+' voted to update app '+message.name+' in the dapp store!'
                resultWhitelist.result = await queue.createWork("pioneer:facts:ingest",work)
            }


            return(resultWhitelist);
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

    /*
        TODO
        destroy
     */

     /*
        Create

     */

    //admin
        /*
        read
    */

    @Get('/apps/pending/{limit}/{skip}')
    public async listAppsPending(limit:number,skip:number) {
        let tag = TAG + " | health | "
        try{
            let apps = appsDB.find({whitelist:false},{limit,skip})
            return(apps)
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

    @Post('/apps/create')
    //CreateAppBody
    public async whitelistApp(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | transactions | "
        try{
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")

            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.info(tag,"addressFromSig: ",addressFromSig)

            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.app) throw Error("Ivalid message missing app")
            let resultWhitelist:any = {}
            if(addressFromSig === ADMIN_PUBLIC_ADDRESS) {
                resultWhitelist = await appsDB.update({name:message.name},{$set:{whitelist:true}})
                log.info(tag,"resultWhitelist: ",resultWhitelist)
            } else {
                //get fox balance of address
                let work:any = {}
                let queueId = uuid.generate()
                work.queueId = queueId
                work.payload = body
                resultWhitelist.success = true
                resultWhitelist.message = 'Address '+addressFromSig+' voted to submit app '+message.name+' to the dapp store!'
                resultWhitelist.result = await redis.createWork("pioneer:facts:ingest",work)
            }

            return(resultWhitelist);
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
