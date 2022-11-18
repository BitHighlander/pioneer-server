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

    //Info
    @Get('/info')
    public async info() {
        let tag = TAG + " | info | "
        try{

            let info = await redis.hgetall("info:dapps")

            if(!info){
                //populate
                let countUsers = await usersDB.count()
                let countDevs = await devsDB.count()
                let countDapps = await dapsDB.count()
                log.info(tag,"countDevs: ",countDevs)
                log.info(tag,"countDapps: ",countDapps)
                info = {
                    users:countUsers,
                    devs:countDevs,
                    dapps:countDapps
                }
                redis.hset("info:dapps",info)
            }

            //add MOTD
            let motd = await redis.get("MOTD")
            info.motd = motd

            log.info(tag,"INFO: ",info)
            return(info);
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


    /** GET /users */
    /** GET /users/:publicAddress */
    @Get('/users')
    public async users() {
        let tag = TAG + " | users | "
        try{
            let devs = await devsDB.find()
            log.info(tag,"devs: ",devs)
            return(devs);
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

    /** GET /users/:publicAddress */
    @Get('/users/{publicAddress}')
    public async getUser(publicAddress:any) {
        let tag = TAG + " | getUser | "
        try{
            log.info(tag,"publicAddress: ",publicAddress)

            let devs = await devsDB.findOne({publicAddress})
            log.info(tag,"devs: ",devs)

            if(!devs){
                //create
                devs = {
                    publicAddress,
                    nonce : Math.floor(Math.random() * 10000)
                }
                let success = await devsDB.insert(devs)
                log.info(tag,"success: ",success)
            }

            return(devs);
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

    /** POST /users */
    @Post('/login')
    //CreateAppBody
    public async login(@Body() body: any): Promise<any> {
        let tag = TAG + " | createUser | "
        try{
            log.info(tag,"body: ",body)
            let publicAddress = body.publicAddress
            let signature = body.signature
            let message = body.message
            if(!publicAddress) throw Error("Missing publicAddress!")
            if(!signature) throw Error("Missing signature!")
            if(!message) throw Error("Missing message!")

            log.info(tag,{publicAddress,signature,message})
            //get user
            let devs = await devsDB.findOne({publicAddress})
            log.info(tag,"devs: ",devs)
            log.info(tag,"devs: ",devs.nonce)

            //validate nonce

            //validate sig
            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: signature,
            });
            log.info(tag,"addressFromSig: ",addressFromSig)

            //if valid sign and return token
            if(addressFromSig === publicAddress){
                log.info(tag,"valid signature: ")
                let token = sign({
                        payload: {
                            id: "bla",
                            publicAddress,
                        },
                    },
                    config.secret,
                    {
                        algorithm: config.algorithms[0],
                    })

                //generate new nonce
                let nonceNew = Math.floor(Math.random() * 10000);
                let updateUser = await devsDB.update({publicAddress},{$set:{nonce:nonceNew}})
                log.info("updateUser: ",updateUser)

                await redis.hmset(token,{
                    publicAddress
                })
                log.info("token: ",token)
                return(token)
            } else {
                throw Error("Invalid signature")
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



    /** PATCH /users/:userId */
    @Post('/users/{userId}')
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



}