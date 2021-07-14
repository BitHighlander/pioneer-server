/*

 */

//

let txid = ""


let queue = require("@pioneer-platform/redis-queue")

let work = {
    txid,
    network:'ETH'
}

queue.createWork('ETH:transaction:queue:ingest',work)
