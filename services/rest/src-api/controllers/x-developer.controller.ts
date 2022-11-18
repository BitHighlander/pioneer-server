/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '
// import jwt from 'express-jwt';
const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis} = require('@pioneer-platform/default-redis')
let connection  = require("@pioneer-platform/default-mongo")
const util = require('util')
import { recoverPersonalSignature } from 'eth-sig-util';
import { bufferToHex } from 'ethereumjs-util';
import {sign} from 'jsonwebtoken';

//TODO if no mongo use nedb?
//https://github.com/louischatriot/nedb

let config = {
    algorithms: ['HS256' as const],
    secret: 'shhhh', // TODO Put in process.env
};


let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let txsRawDB = connection.get('transactions-raw')
let devsDB = connection.get('developers')
let dapsDB = connection.get('dapps')

txsDB.createIndex({txid: 1}, {unique: true})
txsRawDB.createIndex({txhash: 1}, {unique: true})
// devsDB.createIndex({username: 1}, {unique: true})
devsDB.createIndex({publicAddress: 1}, {unique: true})
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
@Tags('App Store Endpoints')
@Route('')
export class XDevsController extends Controller {





    /*
        Update MOTD
     */
    /** POST /users */
    @Post('/motd')
    //CreateAppBody
    public async updateMOTD(@Body() body: any): Promise<any> {
        let tag = TAG + " | createUser | "
        try{
            log.info(tag,"body: ",body)
            let publicAddress = body.publicAddress
            let signature = body.signature
            let message = body.message
            if(!publicAddress) throw Error("Missing publicAddress!")
            if(!signature) throw Error("Missing signature!")
            if(!message) throw Error("Missing message!")

            //validate sig
            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: signature,
            });
            log.info(tag,"addressFromSig: ",addressFromSig)
            if(addressFromSig === ADMIN_PUBLIC_ADDRESS){
                //update MOTD
                let motd = message.split("MOTD:")
                motd = motd[1]
                log.info(tag,"motd: ",motd)
                await redis.set("MOTD",motd)
            } else {
                throw Error("Not Signed by admin! actual: "+addressFromSig+" expected: "+ADMIN_PUBLIC_ADDRESS)
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

    /*
        Verify

     */




    /** PATCH /users/:userId */
    @Post('/developer/{userId}')
    //CreateAppBody
    public async updateDeveloper(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | /updateDeveloper | "
        try{
            log.info(tag,"authorization: ",authorization)
            let authInfo = await redis.hgetall(authorization)
            if(!authInfo) throw Error("Token unknown or Expired!")

            log.info(tag,"body: ",body)
            log.info(tag,"authInfo: ",authInfo)
            //if username set username

            //TODO
            //if valid jwt
            //return private info
            let secretInfo = {
                username:"foobar2",
                nonce:1
            }
            return(secretInfo);
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






    //old
    /*
    Create

 */

    @Post('/devs/create')
    //CreateAppBody
    public async createDeveloper(@Body() body: any): Promise<any> {
        let tag = TAG + " | transactions | "
        try{
            log.info(tag,"body: ",body)
            //TODO
            //is developer already in database?

            //does dev have ENS name

            //validate github url

            //send email confirmation
            //
            // let success = devsDB.insert(body)
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

    /*
        read
    */

    @Get('/devs')
    public async listDevelopers() {
        let tag = TAG + " | listDeveloper | "
        try{
            let apps = devsDB.find()
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


}
