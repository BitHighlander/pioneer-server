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

const TAG = " | eth-tx-ingester | "
const log = require('@pioneer-platform/loggerdog')()
const {subscriber,publisher,redis} = require('@pioneer-platform/default-redis')
const request = require("request-promise")
const Web3Utils = require('web3-utils');

const metrics = require('datadog-metrics');
const pjson = require('../package.json');
const os = require("os")
metrics.init({ host: os.hostname, prefix: pjson.name+'.'+process.env['NODE_ENV']+'.' });

let queue = require("@pioneer-platform/redis-queue")
let audit = require("@pioneer-platform/eth-audit")
let network = require("@pioneer-platform/eth-network")
let wait = require('wait-promise');
let sleep = wait.sleep;

let connection  = require("@pioneer-platform/default-mongo")
let txsDB = connection.get('transactions')
let LIMITER = 300
let ASSET = "ETH"

let PRIORITY = 'HIGH'
let TTB = '3' //Time till batch (time waited until batch tx lookup)



let do_work = async function(){
    let tag = TAG+" | do_work | "
    let block
    try{
        await network.init()

        //all work
        let allWork = await queue.count(ASSET+":transaction:queue:ingest:"+PRIORITY)
        if(allWork > 0)log.info(tag,"allWork: ",allWork)
        metrics.gauge(ASSET+'.txQueue', allWork);

        let timeStart = new Date().getTime()
        log.info(tag,"timeStart: ",timeStart)
        let work = await queue.getWork(ASSET+":transaction:queue:ingest:"+PRIORITY,60)

        if(work){
            log.info(tag,"work: ",work)

            if(!work.txid) throw Error("invalid work! missing txid")

            let txid = work.txid
            log.info("unknown tx! looking up info! txid: ",txid)

            //new tx
            let txInfo = await network.getTransaction(txid)
            if(!txInfo.txInfo.to) throw Error("Failed to get transaction info!")
            log.info("txInfo: ",txInfo)

            let addressInfo
            if(txInfo.txInfo && txInfo.txInfo.to) addressInfo = await redis.hgetall(txInfo.txInfo.to)
            log.info("addressInfo: ",addressInfo)
            //if
            if(addressInfo){
                //known

                //if contract
                if(addressInfo.type === 'contract' && txInfo.receipt){
                    //audit
                    let auditResult = await audit.auditReceipt(addressInfo.username,txInfo.receipt)
                    log.info("auditResult: ",auditResult)

                    //save result to mongo
                    if(auditResult.Type === 'streamCreate'){
                        let successMongo = await txsDB.insert(auditResult)
                        log.info("successMongo: ",successMongo)
                    }
                }
            }else{
                //ignore (un-tracked mempool)
                log.info("Untracted address (ignore): ",addressInfo)
            }
        }

    } catch(e) {
        log.error(tag,"e: ",e)
        //queue.createWork(ASSET+":queue:block:ingest",block)
    }
    //dont stop working even if error
    await sleep(LIMITER)
    do_work()
}

//start working on install
log.info(TAG," worker started! ","")
do_work()
