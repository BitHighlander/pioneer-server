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

let LIMITER = process.env['BATCH_SIZE_LIMITER'] || 100
let ASSET = "ETH"

let BATCH_SIZE = process.env['BATCH_SIZE_TX'] || 3000
if(!process.env['PARITY_ARCHIVE_NODE']) throw Error("Misconfigured! required PARITY_ARCHIVE_NODE")



const get_transactions_receipts = async function(txids:any){
    let tag = TAG + " | get_balances | "
    try{

        let actions = []
        for(let i = 0; i < txids.length; i++){
            let txid = txids[i]
            let action = {
                method:"eth_getTransactionReceipt",
                params:[txid]
            }
            actions.push(action)
        }

        let result:any = await rpcCallBatch(actions)

        //covert
        let output:any = []
        for(let i = 0; i < result.length; i++){
            let entry = result[i]
            output.push(entry)
        }

        return output
    }catch(e){
        console.error(tag,e)
    }
}

const get_transactions = async function(txids:any){
    let tag = TAG + " | get_balances | "
    try{

        let actions = []
        for(let i = 0; i < txids.length; i++){
            let txid = txids[i]
            let action = {
                method:"eth_getTransactionByHash",
                params:[txid]
            }
            actions.push(action)
        }
        //log.debug(tag,"actions: ",actions)
        let result:any = await rpcCallBatch(actions)

        //covert
        let output:any = []
        for(let i = 0; i < result.length; i++){
            let entry = result[i]
            output.push(entry)
        }

        return output
    }catch(e){
        console.error(tag,e)
    }
}

const rpcCallBatch = async (actions:any)=>{
    let tag = TAG + " | post_request | ";
    try{

        let body = []

        for(let i = 0; i < actions.length; i++){
            let action = actions[i]

            let req = {
                "jsonrpc":"2.0",
                "method" : action.method,
                "params": action.params,
                "id": 1
            };

            body.push(req)
        }

        let options = {
            method : "POST",
            url : process.env['PARITY_ARCHIVE_NODE'],
            headers :{'content-type':'application/json'},
            body : JSON.stringify(body)
        };
        //console.log("options: ",options)
        let result = await request(options);
        //console.log("result: ",result)
        result = JSON.parse(result);
        if(result.error) throw JSON.stringify(result.error)
        return result;
    }catch(err){
        throw new Error(err)
    }
};


let do_work = async function(){
    let tag = TAG+" | do_work | "
    let block
    try{
        await network.init()

        //get high work (in batch)

        //if no high work, do low

        //all work
        let allWork = await queue.count(ASSET+":transaction:queue:ingest:HIGH")
        if(allWork > 0)log.debug(tag,"allWork: ",allWork)
        metrics.gauge(ASSET+'.txQueue', allWork);

        let timeStart = new Date().getTime()
        let workHigh = await redis.lpop(ASSET+":transaction:queue:ingest:HIGH",BATCH_SIZE)
        log.debug(tag,"workHigh: ",workHigh)

        if(workHigh){
            let txids = []
            for(let i = 0; i < workHigh.length; i++){
                let work = JSON.parse(workHigh[i])
                log.debug(tag,"work: ",work)
                log.debug(tag,"work: ",work.txid)
                txids.push(work.txid)
            }

            //get results
            log.debug(tag,"txids: ",txids)
            let txInfoBasics = await get_transactions(txids)
            log.debug(tag,"txInfoBasics: ",txInfoBasics)

            let txReceipts = await get_transactions_receipts(txids)
            log.debug(tag,"txReceipts: ",txReceipts)

            //rebuild work
            let txInfos = []
            for(let i = 0; i < txids.length; i++){
                let txid = txids[i]

                let entry = {
                    txid,
                    txInfo:txInfoBasics[i].result,
                    receipt:txReceipts[i].result
                }
                txInfos.push(entry)
            }

            log.debug(tag,"txInfos: ",txInfos)
            let saveActions:any = []

            //for each
            for(let i = 0; i < txInfos.length; i++){
                let txInfo = txInfos[i]

                if(!txInfo.txInfo) {
                    log.error(tag,"invalid txInfo: ",txInfo)
                }
                //log.debug("txInfo: ",txInfo)


                let addressInfo
                if(txInfo.txInfo && txInfo.txInfo.to) addressInfo = await redis.hgetall(txInfo.txInfo.to)
                log.debug("txInfo.txInfo.to: ",txInfo.txInfo.to, ' logs: ',txInfo?.receipt?.logs.length)

                //if known
                if(addressInfo){
                    log.debug("addressInfo: ",addressInfo)
                    //known

                    //if contract
                    if(addressInfo.type === 'contract' && txInfo.receipt){
                        //audit
                        try{
                            //TODO if dev caputure
                            //fs.writeFileSync(txInfo.txid+'.info.csv', JSON.stringify(txInfo.receipt));

                            let auditResult = await audit.auditReceipt(addressInfo.username,txInfo.receipt)
                            if(auditResult.Type === 'streamCreate'){
                                log.debug("WINNING! *********** ")
                                log.debug("auditResult.events: ",auditResult.events[0].stream.saleryId)

                                //save result to mongo
                                saveActions.push({insertOne:auditResult})
                            }

                        }catch(e){
                            //TODO failed to audit deadletter
                            log.debug(tag,"Failed work:",e)
                        }
                    }
                }else{
                    //ignore (un-tracked mempool)
                    log.debug("Untracted address (ignore): ",addressInfo)
                }
            }

            if(saveActions.length > 0){
                try{
                    let resultSaveDB = await txsDB.bulkWrite(saveActions,{ordered:false})
                    log.debug("resultSaveDB: ",resultSaveDB)
                }catch(e){
                    log.debug("resultSaveDB (error): ",e)
                }
            }

        } else {
            await sleep(3000)
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
log.debug(TAG," worker started! ","")
do_work()
