/*

 */
require("dotenv").config()
require("dotenv").config({path:'../../../.env'})

const {redis,redisQueue} = require("@pioneer-platform/default-redis")
const queue = require("@pioneer-platform/redis-queue")

//monitor and capture queue sampleling

//grab bad work from deadletter



queue.getWork("pioneer:pubkey:ingest:deadletter",100)
    .then(function(work){
        console.log("Deadletter work: ",work)
    })


//drop all deadletter
redis.del("pioneer:pubkey:ingest:deadletter")
    .then(function(result){
        console.log("drop deadletter: ",result)
    })

