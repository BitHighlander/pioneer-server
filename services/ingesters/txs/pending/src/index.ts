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


let do_work = async function(){
    let tag = TAG+" | do_work | "
    let block
    try{
        await network.init()

        //get high work (in batch)

        //if no high work, do low


    } catch(e) {
        log.error(tag,"e: ",e)
        //queue.createWork(ASSET+":queue:block:ingest",block)
    }
    do_work()
}

//start working on install
log.debug(TAG," worker started! ","")
do_work()
