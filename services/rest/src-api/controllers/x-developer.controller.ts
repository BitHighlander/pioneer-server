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
import { v4 as uuidv4 } from 'uuid';
//TODO if no mongo use nedb?
//https://github.com/louischatriot/nedb

let config = {
    algorithms: ['HS256' as const],
    secret: 'shhhh', // TODO Put in process.env
};

let networkEth = require("@pioneer-platform/eth-network")
networkEth.init()
let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let txsRawDB = connection.get('transactions-raw')
let dapsDB = connection.get('dapps')

txsDB.createIndex({txid: 1}, {unique: true})
txsRawDB.createIndex({txhash: 1}, {unique: true})
// devsDB.createIndex({username: 1}, {unique: true})
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
        read
    */

    @Get('/devs/{limit}/{skip}')
    public async listDevelopers(limit:number,skip:number) {
        let tag = TAG + " | listDeveloper | "
        try{
            //let devs = await usersDB.find({},{limit,skip})
            let allVoted = await redis.smembers("addresses:voted")
            log.info(tag,"allVoted: ",{allVoted})

            //get all pioneers
            let allPioneers = await networkEth.getAllPioneers()
            let images = allPioneers.images
            let pioneerImageMap:any = {}
            for(let i = 0; i < images.length; i++){
                let pioneer = images[i]
                pioneerImageMap[pioneer.address] = pioneer.image
            }
            log.info(tag,"pioneerImageMap: ",pioneerImageMap)
            //get the top 20 of all foxitars

            let output = []
            for(let i = 0; i < allVoted.length; i++){
                let developer = allVoted[i]
                log.info(tag,"developer: ",developer)
                let score = await redis.hgetall(developer+":score")
                log.info(tag,"score: ",score)
                let power = await redis.get(developer+":nft:voteing-power")
                score = parseInt(score.score)
                log.info(tag,"score: (INT) ",score)
                let avatar
                if(pioneerImageMap[developer]){
                    log.info("DETECTED PIONEER SETTING AVATAR")
                    avatar = pioneerImageMap[developer]
                }
                if(!avatar){
                    //check foxitar
                    let foxitar = await redis.hget(developer,"foxitar")
                    log.info(tag,"foxitar: ",foxitar)
                    if(foxitar){
                        avatar = foxitar
                    }
                }
                if(!avatar) {
                    avatar = 'data:image/jpeg;base64,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'
                }
                if(score > 0){
                    let dev:any = {}
                    //if pioneer/ or foxitar else default
                    dev.avatar = avatar
                    dev.address = developer
                    dev.username = developer
                    dev.score = score
                    dev.power = power
                    output.push(dev)
                }
            }

            return(output)
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


    @Get('/auth/dev/{address}')
    public async getDevInfo(address:string) {
        let tag = TAG + " | getDevInfo | "
        try{

            //get dev score
            let completed = await redis.smembers(address+":actions")
            let score = await redis.hgetall(address+":score")
            //get dev actions

            //voting power
            let power = await redis.get(address+":nft:voteing-power")
            let user = {
                completed,
                score,
                power
            }

            return(user);
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

    // @Post('/devs/create')
    // //CreateAppBody
    // public async createDeveloper(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
    //     let tag = TAG + " | createDeveloper | "
    //     try{
    //         log.info(tag,"body: ",body)
    //         let authInfo = await redis.hgetall(authorization)
    //         log.info(tag,"authInfo: ",authInfo)
    //         log.info(tag,"Object: ",Object.keys(authInfo))
    //         if(!authInfo || Object.keys(authInfo).length === 0) throw Error("Token unknown or Expired!")
    //         let publicAddress = authInfo.publicAddress
    //         if(!publicAddress) throw Error("invalid auth key info!")
    //
    //         //get userInfo
    //         let userInfo = await usersDB.findOne({publicAddress})
    //         if(!userInfo) throw Error("First must register an account!")
    //
    //         //body
    //         if(!body.email) throw Error("Developers must register an email!")
    //         if(!body.github) throw Error("Developers must register a github!")
    //         let devInfo = {
    //             verified:false,
    //             username:userInfo.username,
    //             publicAddress,
    //             email:body.email,
    //             github:body.github
    //         }
    //         let dev = await devsDB.insert(devInfo)
    //
    //         return(dev);
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
    //


    /**
        Update MOTD
     */
    @Post('/motd')
    //CreateAppBody
    public async updateMOTD(@Body() body: any): Promise<any> {
        let tag = TAG + " | updateMOTD | "
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
    // @Post('/devs/register')
    // //CreateAppBody
    // public async registerDeveloper(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
    //     let tag = TAG + " | registerDeveloper | "
    //     try{
    //         log.info(tag,"body: ",body)
    //         if(!authorization) throw Error("Missing authorization!")
    //         if(!body.publicAddress) throw Error("Missing publicAddress!")
    //         if(!body.github) throw Error("Missing github!")
    //         if(!body.email) throw Error("Missing email!")
    //         if(!body.image) throw Error("Missing image!")
    //         log.info(tag,"authorization: ",authorization)
    //         let authInfo = await redis.hgetall(authorization)
    //         log.info(tag,"authInfo: ",authInfo)
    //         log.info(tag,"Object: ",Object.keys(authInfo))
    //         if(!authInfo || Object.keys(authInfo).length === 0) {
    //             //register
    //             let userInfo:any = {
    //                 registered: new Date().getTime(),
    //                 id:"developer:"+pjson.version+":"+uuidv4(), //user ID versioning!
    //                 username:body.username,
    //                 verified:false,
    //                 nonce:Math.floor(Math.random() * 10000),
    //                 publicAddress:body.publicAddress
    //             }
    //             await redis.hmset(authorization,userInfo)
    //         }
    //         authInfo = await redis.hgetall(authorization)
    //         log.info(tag,"authInfo: ",authInfo)
    //         let publicAddress = authInfo.publicAddress
    //         if(!publicAddress) throw Error("invalid auth key info! missing publicAddress")
    //
    //         //verify action
    //         let signature = body.signature
    //         let message = body.message
    //         if(!publicAddress) throw Error("Missing publicAddress!")
    //         if(!signature) throw Error("Missing signature!")
    //         if(!message) throw Error("Missing message!")
    //
    //         //validate sig
    //         const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
    //         const addressFromSig = recoverPersonalSignature({
    //             data: msgBufferHex,
    //             sig: signature,
    //         });
    //         log.info(tag,"addressFromSig: ",addressFromSig)
    //         if(addressFromSig.toLowerCase() == body.developer.toLowerCase()){
    //
    //             let devInfo = {
    //                 verified:false,
    //                 username:body.username,
    //                 developer:body.developer,
    //                 publicAddress,
    //                 email:body.email,
    //                 github:body.github,
    //                 image:body.image
    //             }
    //             let dev = await devsDB.insert(devInfo)
    //             log.info(tag,"updateResult: ",dev)
    //             return(dev);
    //         } else {
    //             return({
    //                 success:false,
    //                 error:"Invalid signature! must be signed by developer address!"
    //             })
    //         }
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


}
