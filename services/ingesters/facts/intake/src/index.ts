/*
      ETH-tx ingester

      Registered intake


      *  Mempool txs


 */
require('dotenv').config()
require('dotenv').config({path:"./../../.env"})
require('dotenv').config({path:"../../../.env"})
require('dotenv').config({path:"../../../../.env"})
require('dotenv').config({path:"../../../../../.env"})

const TAG = " | pending-tx-ingester | "
const log = require('@pioneer-platform/loggerdog')()
const {subscriber,publisher,redis} = require('@pioneer-platform/default-redis')
import { recoverPersonalSignature } from 'eth-sig-util';
import { bufferToHex } from 'ethereumjs-util';
const request = require("request-promise")
const metrics = require('datadog-metrics');
const pjson = require('../package.json');
const os = require("os")
metrics.init({ host: os.hostname, prefix: pjson.name+'.'+process.env['NODE_ENV']+'.' });


//for dev
const fs = require("fs-extra");

let queue = require("@pioneer-platform/redis-queue")
let audit = require("@pioneer-platform/eth-audit")
let network = require("@pioneer-platform/eth-network")
let wait = require('wait-promise');
let sleep = wait.sleep;

let connection  = require("@pioneer-platform/default-mongo")
let txsDB = connection.get('transactions')
txsDB.createIndex({txid: 1}, {unique: true})
let appsDB = connection.get('apps')

let BATCH_SIZE = process.env['BATCH_SIZE_SCORE'] || 1

let do_work = async function(){
    let tag = TAG+" | do_work | "
    let block
    try{
        await network.init()

        //all work
        let allWork = await queue.count("pioneer:facts:ingest")
        if(allWork > 0)log.debug(tag,"allWork: ",allWork)
        metrics.gauge('score', allWork);
        await sleep(300)
        let work = await redis.lpop("pioneer:facts:ingest",BATCH_SIZE)
        if(work){
            log.info(tag,"work: ",work)
            work = JSON.parse(work[0])
            let body = work.payload
            //validate sig
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload
            let payload = JSON.parse(body.payload)

            //if vote
            if(payload.vote){
                if(!payload.name) throw Error("invalid payload, missing name!")
                const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
                const addressFromSig = recoverPersonalSignature({
                    data: msgBufferHex,
                    sig: body.signature,
                });
                log.info(tag,"addressFromSig: ",addressFromSig)
                log.info(tag,"body.signer: ",body.signer)
                if(addressFromSig.toLowerCase() !== body.signer.toLowerCase()) throw Error("Invalid signature!")

                //get all facts for dapp
                let allFactsUp = await redis.smembers("facts:votes:"+payload.name+":up")
                let allFactsDown = await redis.smembers("facts:votes:"+payload.name+":down")

                if(payload.vote === 'up'){
                    if(allFactsUp.indexOf(addressFromSig) >= 0){
                        console.error("Already voted!")
                    } else{
                        await redis.sadd("facts:votes:"+payload.name+":up",addressFromSig)
                    }
                    if(allFactsDown.indexOf(addressFromSig) >= 0){
                        console.error("Removing down vote")
                        await redis.srem("facts:votes:"+payload.name+":down",addressFromSig)
                    }
                }else if(payload.vote === 'down'){
                    if(allFactsDown.indexOf(addressFromSig) >= 0){
                        console.error("Already voted!")
                    } else{
                        await redis.sadd("facts:votes:"+payload.name+":down",addressFromSig)
                    }
                    if(allFactsUp.indexOf(addressFromSig) >= 0){
                        console.error("Removing up vote")
                        await redis.srem("facts:votes:"+payload.name+":up",addressFromSig)
                    }
                } else {
                    throw Error("Invalid vote! "+payload.vote)
                }
                allFactsUp = await redis.smembers("facts:votes:"+payload.name+":up")
                allFactsDown = await redis.smembers("facts:votes:"+payload.name+":down")
                //tally votes
                let allUpVotesInFox = 0
                let allDownVotesInFox = 0

                for(let i = 0; i < allFactsUp.length; i++){
                    let address = allFactsUp[i]
                    let balanceFox = await network.getBalanceToken(address,"0xc770eefad204b5180df6a14ee197d99d808ee52d")
                    allUpVotesInFox = allUpVotesInFox + parseFloat(balanceFox)
                }

                for(let i = 0; i < allFactsDown.length; i++){
                    let address = allFactsDown[i]
                    let balanceFox = await network.getBalanceToken(address,"0xc770eefad204b5180df6a14ee197d99d808ee52d")
                    allDownVotesInFox = allUpVotesInFox + parseFloat(balanceFox)
                }
                //update global balance
                let score = allUpVotesInFox - allDownVotesInFox
                console.log("score: ",score)
                let resultScore = await appsDB.update({name:payload.name},{$set:{score}})
                console.log("resultScore: ",resultScore)
            }

            //if update

            //update mongo
        }

    } catch(e) {
        log.error(tag,"e: ",e)
        //queue.createWork(ASSET+":queue:block:ingest",block)
    }
    do_work()
}

//start working on install
log.debug(TAG," worker started! ","")
do_work()
