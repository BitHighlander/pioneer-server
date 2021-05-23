/*
    Readyness probe G1

    Goals:
        *


 */
const TAG = " | Readyness | "
require("dotenv").config({path:'./../../.env'})
const log = require('@pioneer-platform/loggerdog')()
//let network = require("@pioneer-platform/pioneer-monero-network")
//network.init('full')
// let connection  = require("@pioneer-platform/pioneer-mongo-default-env")
const {subscriber, publisher, redis} = require('@pioneer-platform/pioneer-default-redis')

// let usersDB = connection.get('users')
// let txsDB = connection.get('transactions')

const check_liveness = async function(){
    let tag = TAG + " | check_liveness | "
    try{

        //can connect to redis
        let redisInfo = await redis.info()
        log.debug(tag,"redisInfo: ",redisInfo)
        if(!redisInfo) throw Error("102: Redis not working! empty response")

        //can connect to mongo


        process.exit(0)

    }catch(e){
        log.error(tag,"error: ",e)
        process.exit(1)
    }
}
log.info(TAG," check isReady begin!")
check_liveness()
