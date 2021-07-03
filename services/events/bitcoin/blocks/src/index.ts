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

import { Blockbook } from 'blockbook-client'

let blockbookUrl = process.env['BTC_BLOCKBOOK_URL']
if(!blockbookUrl) throw Error("Missing ENV BTC_BLOCKBOOK_URL")
const blockbook = new Blockbook({
    nodes: [blockbookUrl],
})

const onStart = async function(){
    let tag = TAG + " | onStart | "
    try{
        // To use websockets
        await blockbook.connect()

        let status = await blockbook.getStatus()
        log.info(tag,"status: ",status)

        //blocks
        await blockbook.subscribeNewBlock(({ height, hash }) => console.log('new block', height, hash))

    }catch(e){
        log.error(e)
    }
}

onStart()

// let checkIfStuck = function(){
//     try{
//         //if no blocks in 1 min
//         let timeNow = new Date().getTime()
//
//         let timeSinceLastBlock = timeNow - lastBlock
//         if(timeSinceLastBlock > 360 * 1000){
//             //socket stuck restarting
//             log.error(" * STUCK STUCK STUCK exiting! *")
//             process.exit(1)
//         } else {
//             log.debug(" Healthy! * ONLINE * TSB: ",timeSinceLastBlock / 1000)
//         }
//
//     }catch(e){
//         log.error("e: ",e)
//         process.exit(1)
//     }
// }
//
// setInterval(checkIfStuck,3000)
// log.info(TAG," Worker Started!", "")
