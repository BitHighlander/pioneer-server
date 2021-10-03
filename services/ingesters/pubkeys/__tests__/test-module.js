
require('dotenv').config()
require('dotenv').config({path:"../../../../.env"});
require('dotenv').config({path:"../../../.env"});
require('dotenv').config({path:"../../../../.env"});
let queue = require("@pioneer-platform/redis-queue")

let ASSET = "ETH"




// //Atom
// let work = {
//     coin: 'ATOM',
//     symbol: 'ATOM',
//     network: 'ATOM',
//     queueId: 'j9ZbcfjFy6kqShnupHXLWi',
//     walletId: 'atom-test-343733331147363327003800',
//     type:"address",
//     username: 'test-user-2',
//     pubkey: "cosmos1fmczm8gl6pepdak8syqf0krlclpwmlzg989ryh",
//     inserted: 1594510142838
// }

//atlas
// let work = {
//     coin: 'ETH',
//     symbol: 'ETH',
//     network: 'ETH',
//     blockchain: 'ethereum',
//     queueId: 'j9ZbcfjFy6kqShnupHXLWi',
//     walletId: 'atlas-test-343733331147363327003800',
//     type:"address",
//     contract:{
//         name:"sablier (proxy)",
//         tags:['sablier','streams','erc20']
//     },
//     username: 'test-user-2',
//     pubkey: "0xbd6a40Bb904aEa5a49c59050B5395f7484A4203d",
//     inserted: 1594510142838
// }


// let work = {
//     symbol: 'OSMO',
//     asset: 'OSMO',
//     network: 'OSMO',
//     blockchain: "osmosis",
//     walletId: 'keepkey-pubkeys-343733331147363327003800',
//     queueId: 'j9ZbcfjFy6kqShnupHXLWi',
//     type:"address",
//     username: 'test-user-2',
//     pubkey: "osmo1k0kzs2ygjsext3hx7mf00dfrfh8hl3e85s23kn",
//     inserted: 1594510142838
// }

let work = {
    symbol: 'BNB',
    asset: 'BNB',
    blockchain: "binance",
    walletId: 'keepkey-pubkeys-343733331147363327003800',
    queueId: 'j9ZbcfjFy6kqShnupHXLWi',
    type:"address",
    username: 'test-user-2',
    pubkey: "bnb1ffm69vl732y59tdm69d83ddjz3h4j5lqjaqxnf",
    inserted: 1594510142838
}

// let work = {
//     symbol: 'ETH',
//     asset: 'ETH',
//     blockchain: "ethereum",
//     walletId: 'keepkey-pubkeys-343733331147363327003800',
//     queueId: 'j9ZbcfjFy6kqShnupHXLWi',
//     type:"address",
//     username: 'test-user-2',
//     pubkey: "0x33b35c665496bA8E71B22373843376740401F106",
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

// let work = {
//     coin: 'DOGE',
//     type: 'xpub',
//     walletId: 'keepkey-pubkeys-343733331147363327003800',
//     username: 'test-user-2',
//     symbol: 'DOGE',
//     blockchain: "dogecoin",
//     queueId: 'j9ZbcfjasdFy6kqShnupHXLWi',
//     account: 'tesasdasdtaddress',
//     pubkey:"xpub6BgVLrcywjgQrv2SZFLxYbjxAAVbeY5SXmGSDxkT9wobyyETW6De4SFnxQdNgzgNxBPRpWocod2YNMCvnNrh4cZgv6bQMab2WKwbWisv1oY",
//     inserted: 1594510142838
// }
//
// console.log("inserted:",work)


queue.createWork("pioneer:pubkey:ingest",work)
    .then(function(resp){
        console.log("resp:",resp)
    })

