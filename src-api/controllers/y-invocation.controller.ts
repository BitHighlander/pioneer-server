/*

    Pioneer REST endpoints



 */

let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
let connection  = require("@pioneer-platform/default-mongo")
let queue = require("@pioneer-platform/redis-queue")
const short = require('short-uuid');
let sign = require('@pioneer-platform/signing')
let usersDB = connection.get('users')
let pubkeysDB = connection.get('pubkeys')
let txsDB = connection.get('transactions')
let utxosDB = connection.get('utxo')
let invocationsDB = connection.get('invocations')

invocationsDB.createIndex({invocationId: 1}, {unique: true})
usersDB.createIndex({id: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})

//globals
let BLOCKING_TIMEOUT_INVOCATION = process.env['BLOCKING_TIMEOUT_INVOCATION'] || 60
let PIONEER_SIGNING_PUBKEY = process.env['PIONEER_SIGNING_PUBKEY']
let PIONEER_SIGNING_PRIVKEY = process.env['PIONEER_SIGNING_PRIVKEY']
if(!PIONEER_SIGNING_PUBKEY) throw Error("PIONEER_SIGNING_PUBKEY required to run server!")
if(!PIONEER_SIGNING_PRIVKEY) throw Error("PIONEER_SIGNING_PRIVKEY required to run server!")

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';
import * as express from 'express';

//TODO enum for supported types
interface Invocation {
    type?:string
    noBroadcast?:boolean
    invocationId?:string
    inboundAddress?:any
    address?:string,
    addressTo?:string,
    memo?:string
    asset?:any
    blockchain?:string
    network?:string
    coin?:string
    amount:string
    context?:string
    username:string

}

interface InvocationBody {
    msg?: string;
    context?: string;
    type:string
    username:string,
    invocation:Invocation
    invocationId?:string
    auth?:string
    service?:string
    servicePubkey?:string
    serviceHash?:string
    mode?:'sync' | 'async'
}


//types
interface Error{
    success:boolean
    tag:string
    e:any
}

export class ApiError extends Error {
    private statusCode: number;
    constructor(name: string, statusCode: number, message?: string) {
        super(message);
        this.name = name;
        this.statusCode = statusCode;
    }
}

//route
@Tags('Invocation (Payment Requests) Endpoint ')

/**
 *  Test
 */

@Route('')
export class pioneerInvocationController extends Controller {

    /**
     *  Wallet events
     *      invocations
     *      * Payment requests (pay x address)
     *      * sign contract action
     *      * Request to install app
     *
     *
     */

    @Post('/invoke')
    public async invoke(@Header('Authorization') authorization: string, @Body() body: InvocationBody): Promise<any> {
        let tag = TAG + " | invocation | "
        try{
            log.info(tag,"body: ",body)
            let output:any = {}
            //mode
            let mode = 'async'
            if(body.mode && body.mode === 'sync') mode = 'async'

            //verify auth

            //verify user settings

            //is invokeion valid?

            //is user online?
            let onlineUsers = await redis.smembers("online")
            log.info(tag,"onlineUsers: ",onlineUsers)
            log.info(tag,"username: ",body.username)

            //else
            //does user exist?
                //does user exist on fio?

            // invocationId
            if(!body.invocationId){
                body.invocationId = "pioneer:invocation:v0.01:"+body.invocation.coin+":"+short.generate()
            }
            let invocationId = body.invocationId

            //TODO limit per user? DDOS protect?

            //origin

            //TODO signed by?

            //get approveTx for dapp
            //verify sign on approveTx
            //verify address match on invocation
            //if valid Dapp, sign as notary


            //is signed by authed by server
            let notary = PIONEER_SIGNING_PUBKEY
            let invocationSerliazed = JSON.stringify(body.invocation)
            let notarySig = sign.sign(notary,invocationSerliazed,PIONEER_SIGNING_PRIVKEY)

            //normalize
            if(!body.invocation.type) body.invocation.type = body.type
            if(body.invocation.context) body.context = body.invocation.context

            //validate
            if(!body.invocation.type) throw Error("Invocation type required!")

            let entry = {
                state:'created',
                type:body.invocation.type,
                invocationId,
                username:body.username,
                tags:[body.username],
                invocation:body.invocation,
                notary,
                notarySig
            }

            //verify invoke type is known

            //give fee rating/recommendation

            //

            //TODO sequence
            //only accept 1 per username
            //save to mongo
            let mongoSave = await invocationsDB.insert(entry)
            log.info(tag,"mongoSave: ",mongoSave)

            if(onlineUsers.indexOf(body.username) >= 0){
                body.invocationId = invocationId
                //auth (app needs to verify!)
                body.auth = authorization
                //send
                publisher.publish("invocations",JSON.stringify(body))

                //if sync
                if(mode === 'sync'){
                    // :( but this was cool
                    //block till confirmation
                    log.info(tag," STARTING BLOCKING INVOKE id: ",invocationId)
                    let timeStart = new Date().getTime()

                    let txid = await redisQueue.blpop(invocationId,BLOCKING_TIMEOUT_INVOCATION)
                    let timeEnd = new Date().getTime()
                    log.info(tag," END BLOCKING INVOKE T: ",(timeEnd - timeStart)/1000)

                    //if
                    if(!txid[1]) throw Error("Failed to broadcast! timeout!")
                    //TODO if timeout return invocationId
                    output.success = true
                    output.txid = txid[1]
                    output.ttr = (timeEnd - timeStart)/1000
                    if(body.invocation.noBroadcast) output.broadcast = false
                }else{
                    output.invocationId = body.invocationId
                }

            } else {
                output.invocationId = invocationId
                output.msg = "User is offline! username:"+body.invocation.username
            }

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
}
