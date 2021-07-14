/*
    Block Ingester
 */

//
let txid = "0x788165bb1d93ba0ab3d0abd69346c6b0f4ca4614cb5635779000f197f3c53eb7"

let block = '12692695'

let queue = require("@pioneer-platform/redis-queue")

let work = {
    txid,
    network:'ETH'
}

queue.createWork('ETH:transaction:queue:ingest',work)
