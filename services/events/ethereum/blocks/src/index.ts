/*
      Subscribe to blocks

      Detect if stuck

 */
require('dotenv').config()
require('dotenv').config({path:"../../../.env"})
require('dotenv').config({path:"./../../.env"})
require('dotenv').config({path:"../../../../.env"})

let ASSET = "ETH"
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
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider(INFURA_V3_WS));

let lastBlock:any

const subscription = web3.eth.subscribe('newBlockHeaders', async (error:any, blockHeader:any) => {
    if (error) return console.error(error);
    lastBlock = new Date().getTime()
    log.info(TAG,'ETH BLOCK:', blockHeader.number);

    //force atomic
    let success = await redis.zadd(ASSET+':blocks:scanned',parseInt(blockHeader.number),blockHeader.hash)

    if(success){
        await sleep(300) //delay ingestion for sync
        metrics.increment(ASSET+'.newBlock');

        let payload = {
            height:blockHeader.number,
            hash:blockHeader.hash,
            coin:ASSET
        }
        let event:any = {}
        event.network = ASSET
        event.type = "newBlock"
        event.height = payload.height
        event.payload = payload
        publisher.publish('blocks',JSON.stringify(event))
        log.info(TAG,"Saving block to queue! height: ",payload.height)
        queue.createWork(ASSET+":queue:block:ingest:high",{coin:ASSET,height:blockHeader.number,hash:blockHeader.hash})
        redis.hset("blockHeights","ETH",blockHeader.number)
    }


}).on('data', (blockHeader:string) => {
    console.log('data: ', blockHeader);
});

// unsubscribes the subscription
subscription.unsubscribe((error:any, success:any) => {
    if (error) return console.error(error);
    //console.log('Successfully unsubscribed!');
});

let checkIfStuck = function(){
    try{
        //if no blocks in 1 min
        let timeNow = new Date().getTime()

        let timeSinceLastBlock = timeNow - lastBlock
        if(timeSinceLastBlock > 360 * 1000){
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
log.info(TAG," Worker Started!", "")
