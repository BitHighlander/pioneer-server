/*
      update tx's by address worker

      Start

 */
require('dotenv').config()
require('dotenv').config({path:"../../../.env"})
require('dotenv').config({path:"./../../.env"})
require('dotenv').config({path:"../../../../.env"})

// console.log(process.env)

let packageInfo = require("../package.json")
const TAG = " | "+packageInfo.name+" | "
const log = require('@pioneer-platform/loggerdog')()
const {subscriber,publisher,redis,redisQueue} = require('@pioneer-platform/default-redis')
const blockbook = require('@pioneer-platform/blockbook')

let queue = require("@pioneer-platform/redis-queue")
let connection  = require("@pioneer-platform/default-mongo")
let wait = require('wait-promise');
let sleep = wait.sleep;

const networks:any = {
    'ETH' : require('@pioneer-platform/eth-network'),
    'ATOM': require('@pioneer-platform/cosmos-network'),
    'BNB' : require('@pioneer-platform/bnb-network'),
    // 'EOS' : require('@pioneer-platform/eos-network'),
    'FIO' : require('@pioneer-platform/fio-network'),
    'ANY' : require('@pioneer-platform/utxo-network'),
    'RUNE' : require('@pioneer-platform/thor-network'),
}
networks.ANY.init('full')
networks.ETH.init()

let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let utxosDB = connection.get('utxo')
let pubkeysDB = connection.get('pubkeys')
let unspentDB = connection.get('unspent')

usersDB.createIndex({id: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
unspentDB.createIndex({txid: 1}, {unique: true})

let push_balance_event = async function(work:any,balance:string){
    let tag = TAG+" | push_balance_event | "
    try{
        let balanceEvent = {
            username:work.username,
            symbol:work.symbol,
            network:work.symbol,
            balance
        }
        //publisher.publish('',JSON.stringify(balanceEvent))
    }catch(e){
        log.error(tag,e)
    }
}

let do_work = async function(){
    let tag = TAG+" | do_work | "
    let work
    try{

        //TODO normalize queue names
        let allWork = await queue.count("pioneer:pubkey:ingest")
        log.debug(tag,"allWork: ",allWork)

        work = await queue.getWork("pioneer:pubkey:ingest", 1)
        if(work){
            log.info("work: ",work)
            if(!work.symbol && work.asset) work.symbol = work.asset
            if(!work.type && work.address) work.type = "address"
            if(!work.walletId) throw Error("100: invalid work! missing walletId")
            if(!work.symbol) throw Error("101: invalid work! missing symbol")
            if(!work.username) throw Error("102: invalid work! missing username")
            if(!work.pubkey) throw Error("103: invalid work! missing pubkey")
            if(!work.blockchain) throw Error("104: invalid work! missing blockchain")
            if(!work.type) throw Error("105: invalid work! missing type")
            if(!work.queueId) throw Error("106: invalid work! missing queueId")
            if(work.type !== 'address' && work.type !== 'xpub' && work.type !== 'zpub') throw Error("Unknown type! "+work.type)

            //TODO lookup last update
            //if < x time, refuse to do work

            //if xpub
            if(work.type === "xpub" || work.type === "zpub"){

                //get balance
                let balance = await blockbook.getBalanceByXpub(work.symbol,work.pubkey)
                log.info(tag,work.username + " Balance ("+work.symbol+"): ",balance)

                //update balance cache
                let updateResult = await redis.hset(work.username+":assets:"+work.walletId,work.symbol,balance)
                if(updateResult) push_balance_event(work,balance)
                log.info(tag,"updateResult: ",updateResult)

                //TODO if change push new balance over socket to user

                //TODO if BCH get slp tokens

            } else if(work.type === "address") {
                // if ETH get tokens
                if(work.symbol === 'ETH'){
                    //if eth use master

                    //     //register to blocknative
                    //     blocknative.submitAddress("ETH", pubkeyInfo.master)

                    // get ethPlorer list
                    let ethInfo = await networks['ETH'].getBalanceTokens(work.pubkey)
                    log.debug(tag,"ethInfo: ",ethInfo)

                    //forEach
                    let tokens = Object.keys(ethInfo.balances)
                    for(let i = 0; i < tokens.length; i++){
                        let token = tokens[i]
                        let balance = ethInfo.balances[token]
                        //update balance cache
                        let updateResult = await redis.hset(work.username+":assets:"+work.walletId,token,balance)
                        if(updateResult) push_balance_event(work,balance)
                        log.info(tag,"updateResult: ",updateResult)
                        //TODO if change push new balance over socket to user
                    }

                    //blockbook get txids


                    //get txid diff from mongo

                    //do lookup on mongo/ find unknown

                    //batch lookup unknown txids


                    // get blockbook tokens
                    // validate ethPlorer

                    // filter LP positions

                    // Price LP positions

                }

                // if BSC get tokens

                // if BNB get tokens

                //


                //get balance
                if(!networks[work.symbol] || !networks[work.symbol].getBalance) throw Error("102: coin not supported! "+work.symbol)

                let balance = await networks[work.symbol].getBalance(work.pubkey)
                //
                log.info(tag,"address ingestion")
                let updateResult = await redis.hset(work.username+":assets:"+work.walletId,work.symbol,balance)
                if(updateResult) push_balance_event(work,balance)
                //if eth get info
                //TODO if change push new balance over socket to user

            } else {
                //unhandled work!
                log.error(work)
            }

            //release
            redis.lpush(work.queueId,JSON.stringify({success:true}))

        }
    } catch(e) {
        log.error(tag,"e: ",e)
        log.error(tag,"e: ",e.message)
        work.error = e.message
        queue.createWork("pioneer:pubkey:ingest:deadletter",work)
        //TODO dead letter queue?
        //TODO fix errors dont shh them (need cointainers)
        //log.debug(tag,"Error checking for blocks: ", e)
        //toss back into work queue? (at end)
        //await sleep(10000)
    }
    //dont stop working even if error
    do_work()
}

//start working on install
log.info(TAG," worker started! ","")
do_work()
