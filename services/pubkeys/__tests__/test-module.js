
require('dotenv').config()
require('dotenv').config({path:"../../../../.env"});
require('dotenv').config({path:"../../../.env"});
require('dotenv').config({path:"../../../../.env"});
let queue = require("@pioneer-platform/redis-queue")

let ASSET = "ETH"


// let work = {
//     coin: 'ETH',
//     queueId: 'j9ZbcfjFy6kqShnupHXLWi',
//     type:"address",
//     username: 'test-user-2',
//     pubkey: "0x33b35c665496ba8e71b22373843376740401f106",
//     inserted: 1594510142838
// }


// let work = {
//     coin: 'BTC',
//     type: 'xpub',
//     username: 'test-user-2',
//     symbol: 'BTC',
//     blockchain: "bitcoin",
//     queueId: 'j9ZbcfjasdFy6kqShnupHXLWi',
//     account: 'tesasdasdtaddress',
//     pubkey:"xpub6BtH1WStaVrzUC3mfoxy1F7MkJ9Tx5fjmMAn2RKaHSeYRNFYiQZWHchbWY7edcXwj4Un9cF1qMuA8tkEpkkcDc5WKgenPD5ZfXvpErPNx2K",
//     inserted: 1594510142838
// }

// let work = {
//     coin: 'BCH',
//     type: 'xpub',
//     walletId: 'keepkey-pubkeys-343733331147363327003800',
//     username: 'test-user-2',
//     symbol: 'BCH',
//     blockchain: "bitcoincash",
//     queueId: 'j9ZbcfjasdFy6kqShnupHXLWi',
//     account: 'tesasdasdtaddress',
//     pubkey:"xpub6BtH1WStaVrzUC3mfoxy1F7MkJ9Tx5fjmMAn2RKaHSeYRNFYiQZWHchbWY7edcXwj4Un9cF1qMuA8tkEpkkcDc5WKgenPD5ZfXvpErPNx2K",
//     inserted: 1594510142838
// }

let work = {
    coin: 'BCH',
    type: 'xpub',
    walletId: 'keepkey-pubkeys-343733331147363327003800',
    username: 'test-user-2',
    symbol: 'BCH',
    blockchain: "bitcoincash",
    queueId: 'j9ZbcfjasdFy6kqShnupHXLWi',
    account: 'tesasdasdtaddress',
    pubkey:"xpub6BtH1WStaVrzUC3mfoxy1F7MkJ9Tx5fjmMAn2RKaHSeYRNFYiQZWHchbWY7edcXwj4Un9cF1qMuA8tkEpkkcDc5WKgenPD5ZfXvpErPNx2K",
    inserted: 1594510142838
}


console.log("inserted:",work)


queue.createWork("pioneer:pubkey:ingest",work)
    .then(function(resp){
        console.log("resp:",resp)
    })

