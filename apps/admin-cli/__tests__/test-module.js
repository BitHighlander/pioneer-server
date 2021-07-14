/*

 */
require("dotenv").config()
require("dotenv").config({path:'../../../.env'})

const {redis,redisQueue} = require("@pioneer-platform/default-redis")
const queue = require("@pioneer-platform/redis-queue")

//monitor and capture queue sampleling

//grab bad work from deadletter

//push pairing event
// redis.publish('context', JSON.stringify({
//         type: 'context',
//         username: 'e2e-test-02-a',
//         context: '0xc3affff54122658b89c31183cec4f15514f34624.wallet.json',
//         event: 'context'
//     })
// )

//push invoke event


// queue.getWork("pioneer:pubkey:ingest:deadletter",100)
//     .then(function(work){
//         console.log("Deadletter work: ",work)
//     })
//
//
// //drop all deadletter
// redis.del("pioneer:pubkey:ingest:deadletter")
//     .then(function(result){
//         console.log("drop deadletter: ",result)
//     })

