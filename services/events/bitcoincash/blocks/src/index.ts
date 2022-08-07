/*
      Subscribe to blocks

      Detect if stuck

 */
require('dotenv').config()
require('dotenv').config({path:"../../../.env"})
require('dotenv').config({path:"./../../.env"})
require('dotenv').config({path:"../../../../.env"})

let ASSET = "BCH"
//TODO move to DD module
const metrics = require('datadog-metrics');
const pjson = require('../package.json');
const os = require("os")
metrics.init({ host: os.hostname, prefix: pjson.name+'.'+process.env['NODE_ENV']+'.' });

const TAG = " | "+pjson.name+" | "
const log = require('@pioneer-platform/loggerdog')()
const {subscriber,publisher,redis,redisQueue} = require('@pioneer-platform/default-redis')
let queue = require("@pioneer-platform/redis-queue")
let wait = require('wait-promise');
let sleep = wait.sleep;

//globals
const INFURA_V3_WS = process.env['INFURA_V3_WS']
if(!INFURA_V3_WS) throw Error("102: missing INFURA_V3_WS! ")
import { Blockbook } from 'blockbook-client'
const blockbook = new Blockbook({
    // nodes: ['doge1.trezor.io'],
    // nodes: ['btc1.trezor.io', 'btc2.trezor.io'],
    nodes: ['bch1.trezor.io'],
})

let lastBlock:any

let ingestBlock = async function(height:number, hash:string){
    let tag = " | ingestBlock | "
    try{
        log.info(tag,'new block', height, hash)
        //force atomic
        let success = await redis.zadd(ASSET+':blocks:scanned',height,hash)
        if(success){
            lastBlock = new Date().getTime()
            await sleep(300) //delay ingestion for sync
            metrics.increment(ASSET+'.newBlock');

            let payload = {
                height,
                hash,
                coin:ASSET
            }
            let event:any = {}
            event.network = ASSET
            event.type = "newBlock"
            event.height = payload.height
            event.payload = payload
            publisher.publish('blocks',JSON.stringify(event))
            log.info(TAG,"Saving block to queue! height: ",payload.height)
            queue.createWork(ASSET+":queue:block:ingest:high",{coin:ASSET,height,hash})
            redis.hset("blockHeights","ETH",height)
        }
    }catch(e){
        log.error(tag,e)
    }
}

let onStart = async function(){
    let tag = " | onStart | "
    try{
        log.info(tag,"checkpoint")
        let connectSuccess = await blockbook.connect()
        log.info(tag,"connectSuccess: ",connectSuccess)

        let block = await blockbook.subscribeNewBlock(({ height, hash }) =>
            ingestBlock(height, hash)
        )
        log.info(tag,"block: ",block)

    }catch(e){
        log.error(e)
    }
}
onStart()


let checkIfStuck = function(){
    try{
        //if no blocks in 30 min
        let timeNow = new Date().getTime()

        let timeSinceLastBlock = timeNow - lastBlock
        if(timeSinceLastBlock > 360 * 30 * 1000){
            //socket stuck restarting
            log.error(" * STUCK STUCK STUCK exiting! *")
            process.exit(1)
        } else {
            log.debug(" Healthy! * ONLINE * TSB: ",timeSinceLastBlock / 1000)
        }

    }catch(e){
        log.error("e: ",e)
        process.exit(1)
    }
}

setInterval(checkIfStuck,3000)
log.debug(TAG," Worker Started!", "")
