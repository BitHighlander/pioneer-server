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
        read
    */

    @Get('/devs/{limit}/{skip}')
    public async listDevelopers(limit:number,skip:number) {
        let tag = TAG + " | listDeveloper | "
        try{
            //let devs = await usersDB.find({},{limit,skip})
            let allVoted = await redis.smembers("addresses:voted")
            log.info(tag,"allVoted: ",{allVoted})
            let output = []
            for(let i = 0; i < allVoted.length; i++){
                let developer = allVoted[i]
                log.info(tag,"developer: ",developer)
                let score = await redis.hgetall(developer+":score")
                log.info(tag,"score: ",score)
                let power = await redis.get(developer+":nft:voteing-power")
                score = parseInt(score.score)
                log.info(tag,"score: (INT) ",score)
                if(score > 0){
                    let dev:any = {}
                    //if pioneer/ or foxitar else default
                    dev.avatar = 'https://ipfs.io/ipfs/bafybeiezdzjofkcpiwy5hlvxwzkgcztxc6xtodh3q7eddfjmqsguqs47aa/0-backgrounds/bithighlander_using_the_psychedelic_art_style_portray_a_pioneer_7b887cd1-b8d9-46bc-ba9f-9e9a74e7ab88_2.png'
                    dev.address = developer.publicAddress
                    dev.username = developer.username
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

    @Post('/devs/create')
    //CreateAppBody
    public async createDeveloper(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | createDeveloper | "
        try{
            log.info(tag,"body: ",body)
            let authInfo = await redis.hgetall(authorization)
            log.info(tag,"authInfo: ",authInfo)
            log.info(tag,"Object: ",Object.keys(authInfo))
            if(!authInfo || Object.keys(authInfo).length === 0) throw Error("Token unknown or Expired!")
            let publicAddress = authInfo.publicAddress
            if(!publicAddress) throw Error("invalid auth key info!")

            //get userInfo
            let userInfo = await usersDB.findOne({publicAddress})
            if(!userInfo) throw Error("First must register an account!")

            //body
            if(!body.email) throw Error("Developers must register an email!")
            if(!body.github) throw Error("Developers must register a github!")
            let devInfo = {
                verified:false,
                username:userInfo.username,
                publicAddress,
                email:body.email,
                github:body.github
            }
            let dev = await devsDB.insert(devInfo)

            return(dev);
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
        Update MOTD
     */
    /** POST /users */
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
    @Post('/devs/register')
    //CreateAppBody
    public async registerDeveloper(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | registerDeveloper | "
        try{
            log.info(tag,"body: ",body)
            if(!authorization) throw Error("Missing authorization!")
            if(!body.publicAddress) throw Error("Missing publicAddress!")
            if(!body.github) throw Error("Missing github!")
            if(!body.email) throw Error("Missing email!")
            if(!body.image) throw Error("Missing image!")
            log.info(tag,"authorization: ",authorization)
            let authInfo = await redis.hgetall(authorization)
            log.info(tag,"authInfo: ",authInfo)
            log.info(tag,"Object: ",Object.keys(authInfo))
            if(!authInfo || Object.keys(authInfo).length === 0) {
                //register
                let userInfo:any = {
                    registered: new Date().getTime(),
                    id:"developer:"+pjson.version+":"+uuidv4(), //user ID versioning!
                    username:body.username,
                    verified:false,
                    nonce:Math.floor(Math.random() * 10000),
                    publicAddress:body.publicAddress
                }
                await redis.hmset(authorization,userInfo)
            }
            authInfo = await redis.hgetall(authorization)
            log.info(tag,"authInfo: ",authInfo)
            let publicAddress = authInfo.publicAddress
            if(!publicAddress) throw Error("invalid auth key info! missing publicAddress")

            //verify action
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
            if(addressFromSig.toLowerCase() == body.developer.toLowerCase()){

                let devInfo = {
                    verified:false,
                    username:body.username,
                    developer:body.developer,
                    publicAddress,
                    email:body.email,
                    github:body.github,
                    image:body.image
                }
                let dev = await devsDB.insert(devInfo)
                log.info(tag,"updateResult: ",dev)
                return(dev);
            } else {
                return({
                    success:false,
                    error:"Invalid signature! must be signed by developer address!"
                })
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


}
