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

import { numberToHex } from 'web3-utils'
import {
    InvocationBody,
    ApiError
} from "@pioneer-platform/pioneer-types";

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';
import * as express from 'express';

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
            if(!body.network) throw Error("102: invalid invocation! network required!")
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

            //TODO assign risk profile

            //TODO verify vault address if marked as swap

            //get approveTx for dapp
            //verify sign on approveTx
            //verify address match on invocation
            //if valid Dapp, sign as notary


            //is signed by authed by server
            let notary = PIONEER_SIGNING_PUBKEY
            let invocationSerliazed = JSON.stringify(body.invocation)
            let notarySig = sign.sign(notary,invocationSerliazed,PIONEER_SIGNING_PRIVKEY)

            //normalize
            if(!body.invocation.invocationId) body.invocation.invocationId = invocationId
            if(!body.invocation.type) body.invocation.type = body.type

            //validate
            if(!body.context) throw Error("Invocation context required!")
            if(!body.invocation.type) throw Error("Invocation type required!")

            //TODO validate invocation types
            /*
                transfer:
                swap:
                deposit:
                approve:

             */

            //TODO make this more clear what coins can do what
            //swap type contract only
            if(body.invocation.type === 'swap'){
                //if not ETH throw
                if(body.invocation.asset !== 'ETH') throw Error("104: swap* smart contract execution only supported on ETH! asset: "+body.invocation.asset)
            } else {
                if(body.invocation.type !== 'transfer' && body.invocation.type !== 'replace'){
                    if(body.invocation.asset === 'ETH') throw Error("105: eth must use smart contract router!")
                }
            }

            //deposit type thorchain only
            if(body.invocation.type === 'deposit'){
                //if not ETH throw
                if(body.invocation.asset !== 'RUNE') throw Error("104: deposit* is a thorchain feature only")
            }

            //if type = replace
            if(body.invocation.type === 'replace'){
                //get invocation from mongo
                let invocationInfo = await invocationsDB.findOne({invocationId:body.invocationId})
                if(!invocationInfo) throw Error("103: unable to find invocationId: "+body.invocationId)
                log.info(tag,"invocationInfo: ",invocationInfo)

                //move signed to "replaced"
                invocationInfo.replaced = []
                invocationInfo.replaced.push(invocationInfo.signed)
                delete invocationInfo.signed

                //update HDwallet payload
                if(invocationInfo.network === 'ETH'){
                    //get replace fee info
                    if(!invocationInfo.invocation.fee) throw Error("101 Fee: required on RBF!")
                    if(invocationInfo.invocation.fee.value){
                        //update gasPrice
                        invocationInfo.unsignedTx.HDwalletPayload.gasPrice = numberToHex(invocationInfo.invocation.fee.value)
                    } else {
                        throw Error("104: priority levels not supported")
                    }
                } else {
                    throw Error("102: RBF not supported for network: "+invocationInfo.network)
                }

                //update invocation
                let mongoSave = await invocationsDB.update(
                    {invocationId:body.invocationId},
                    {$set:{unsignedTx:invocationInfo.unsignedTx,state:'replaced',signed:null}})
                log.info(tag,"mongoSave: ",mongoSave)

            } else {
                //not RBF aka new invocation

                //validate
                if(!body.invocation.fee) throw Error("104: invalid body missing fee ")

                let entry:any = {
                    state:'created',
                    network:body.network,
                    type:body.invocation.type,
                    invocationId,
                    context:body.context,
                    username:body.username,
                    tags:[body.username],
                    invocation:body.invocation,
                    notary,
                    notarySig
                }

                //Optional fields (custom txs)
                if(body.invocation.poolId){
                    entry.poolId = body.invocation.poolId
                    entry.invocation.poolId = body.invocation.poolId
                }

                if(body.invocation.shareOutAmount){
                    entry.shareOutAmount = body.invocation.shareOutAmount
                    entry.invocation.shareOutAmount = body.invocation.shareOutAmount
                }

                if(body.invocation.tokenInMaxs){
                    entry.tokenInMaxs = body.invocation.tokenInMaxs
                    entry.invocation.tokenInMaxs = body.invocation.tokenInMaxs
                }

                if(body.invocation.routes){
                    entry.routes = body.invocation.routes
                    entry.invocation.routes = body.invocation.routes
                }

                if(body.invocation.tokenIn){
                    entry.tokenIn = body.invocation.tokenIn
                    entry.invocation.tokenIn = body.invocation.tokenIn
                }

                if(body.invocation.tokenOutMinAmount){
                    entry.tokenOutMinAmount = body.invocation.tokenOutMinAmount
                    entry.invocation.tokenOutMinAmount = body.invocation.tokenOutMinAmount
                }

                if(body.invocation.validator){
                    entry.validator = body.invocation.validator
                    entry.invocation.validator = body.invocation.validator
                }

                if(body.invocation.validatorOld){
                    entry.validatorOld = body.invocation.validatorOld
                    entry.invocation.validatorOld = body.invocation.validatorOld
                }

                //TODO IBC txs

                //TODO runtime type check by tx object?

                //verify invoke type is known

                //give fee rating/recommendation


                //TODO sequence
                //only accept 1 per username
                //save to mongo
                log.info(tag,"Creating invocation to save: ",entry)
                let mongoSave = await invocationsDB.insert(entry)
                log.info(tag,"mongoSave: ",mongoSave)
            }

            //build invocation


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
            let errorResp:any = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }
}
