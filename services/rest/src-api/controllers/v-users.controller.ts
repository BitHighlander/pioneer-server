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

//TODO if no mongo use nedb?
//https://github.com/louischatriot/nedb

let config = {
    algorithms: ['HS256' as const],
    secret: 'shhhh', // TODO Put in process.env
};


let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let txsRawDB = connection.get('transactions-raw')
let dapsDB = connection.get('dapps')

txsDB.createIndex({txid: 1}, {unique: true})
txsRawDB.createIndex({txhash: 1}, {unique: true})
// devsDB.createIndex({username: 1}, {unique: true})
// usersDB.createIndex({publicAddress: 1}, {unique: true})
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
export class VUsersController extends Controller {

    //Info
    // @Get('/info')
    // public async info() {
    //     let tag = TAG + " | info | "
    //     try{
    //
    //         let info = await redis.hgetall("info:dapps")
    //
    //         if(!info){
    //             //populate
    //             let countUsers = await usersDB.count()
    //             let countDevs = await devsDB.count()
    //             let countDapps = await dapsDB.count()
    //             log.info(tag,"countDevs: ",countDevs)
    //             log.info(tag,"countDapps: ",countDapps)
    //             info = {
    //                 users:countUsers,
    //                 devs:countDevs,
    //                 dapps:countDapps
    //             }
    //             redis.hset("info:dapps",info)
    //         }
    //
    //         //add MOTD
    //         let motd = await redis.get("MOTD")
    //         info.motd = motd
    //
    //         log.info(tag,"INFO: ",info)
    //         return(info);
    //     }catch(e){
    //         let errorResp:Error = {
    //             success:false,
    //             tag,
    //             e
    //         }
    //         log.error(tag,"e: ",{errorResp})
    //         throw new ApiError("error",503,"error: "+e.toString());
    //     }
    // }


    /** GET /users */
    // @Get('/users')
    // public async users() {
    //     let tag = TAG + " | users | "
    //     try{
    //         let devs = await devsDB.find()
    //         log.info(tag,"devs: ",devs)
    //         return(devs);
    //     }catch(e){
    //         let errorResp:Error = {
    //             success:false,
    //             tag,
    //             e
    //         }
    //         log.error(tag,"e: ",{errorResp})
    //         throw new ApiError("error",503,"error: "+e.toString());
    //     }
    // }

    // @Get('/auth/user')
    // public async getUserInfo(@Header('Authorization') authorization: string) {
    //     let tag = TAG + " | users | "
    //     try{
    //         let authInfo = await redis.hgetall(authorization)
    //         log.info(tag,"authInfo: ",authInfo)
    //         log.info(tag,"Object: ",Object.keys(authInfo))
    //         if(!authInfo || Object.keys(authInfo).length === 0) throw Error("Token unknown or Expired!")
    //         let publicAddress = authInfo.publicAddress
    //         if(!publicAddress) throw Error("invalid auth key info!")
    //
    //
    //
    //         let user = await usersDB.findOne({publicAddress})
    //         log.info(tag,"user: ",user)
    //         return(user);
    //     }catch(e){
    //         let errorResp:Error = {
    //             success:false,
    //             tag,
    //             e
    //         }
    //         log.error(tag,"e: ",{errorResp})
    //         throw new ApiError("error",503,"error: "+e.toString());
    //     }
    // }

    /*
     * GET /users/:publicAddress
     *
     *  Get pub-key user information for a given publicAddress
     *
     *  You can use any publicAddress to get public user information
     *  If the user has not yet registered, this will error
     * */
    @Get('/users/{publicAddress}')
    public async lookupPublicUserByAddress(publicAddress:any) {
        let tag = TAG + " | lookupPublicUserByAddress | "
        try{
            log.info(tag,"publicAddress: ",publicAddress)

            let devs = await usersDB.findOne({publicAddress})
            log.info(tag,"devs: ",devs)

            if(!devs){
                //create
                devs = {
                    publicAddress,
                    nonce : Math.floor(Math.random() * 10000)
                }
                let success = await usersDB.insert(devs)
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



    /** PATCH /users/:userId */
    @Post('/users/{userId}')
    //CreateAppBody
    public async updateDeveloper(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | /updateDeveloper | "
        try{
            log.info(tag,"authorization: ",authorization)
            let authInfo = await redis.hgetall(authorization)
            if(!authInfo || Object.keys(authInfo).length === 0) throw Error("Token unknown or Expired!")

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
