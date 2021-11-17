
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
//     pubkey: "0xc3affff54122658b89c31183cec4f15514f34624",
//     inserted: 1594510142838
// }

// let work = {
//     "_id":{
//         "$oid":"6192ab10d544ce8a7c07af02"
//     },
//     "pubkey":"cosmos19442j2ug37kwyxuhc6qqyfw80xtahtenq4q0rh",
//     "blockchain":"cosmos",
//     "symbol":"ATOM",
//     "asset":"cosmos",
//     "path":"m/44'/118'/0'/0/0",
//     "script_type":"bech32",
//     "network":"cosmos",
//     "created":1637002000018,
//     "tags":[
//         "user:pair-keepkey:405406bb-4f96-4251-b51b-aca67cf191d4",
//         "cosmos",
//         "ATOM",
//         "cosmos",
//         "kk-undefined-3800"
//     ],
//     "master":"cosmos19442j2ug37kwyxuhc6qqyfw80xtahtenq4q0rh",
//     "address":"cosmos19442j2ug37kwyxuhc6qqyfw80xtahtenq4q0rh",
//     "balances":[
//         {
//             "network":"ATOM",
//             "asset":"ATOM",
//             "symbol":"ATOM",
//             "isToken":false,
//             "lastUpdated":1637002003081,
//             "balance":0,
//             "source":"network"
//         }
//     ]
// }

let work = {
    "_id":{
        "$oid":"61935217d544ce8a7c07af21"
    },
    walletId: '0x2356a15042f98f0a53784f42237bd4b2873aadcf.wallet.json',
    username: 'testerconfigenv',
    queueId: 'j9ZbcfjFy6kqShnupHXLWi',
    "pubkey":"osmo1yc6dftwdhgt96k8yty8djga88f3knhznply6vy",
    "blockchain":"osmosis",
    "symbol":"OSMO",
    "asset":"OSMO",
    "path":"m/44'/118'/0'/0/0",
    "script_type":"bech32",
    "network":"OSMO",
    "created":1637044759526,
    "tags":[
        "testerconfigenv",
        "osmosis",
        "OSMO",
        "OSMO",
        "0x2356a15042f98f0a53784f42237bd4b2873aadcf.wallet.json"
    ],
    "master":"osmo1yc6dftwdhgt96k8yty8djga88f3knhznply6vy",
    "address":"osmo1yc6dftwdhgt96k8yty8djga88f3knhznply6vy",
    "balances":[
        {
            "network":"OSMO",
            "asset":"OSMO",
            "symbol":"OSMO",
            "isToken":false,
            "lastUpdated":1637044762640,
            "balance":0.02,
            "source":"network"
        }
    ]
}

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

// let work = {
//     symbol: 'BNB',
//     asset: 'BNB',
//     blockchain: "binance",
//     walletId: 'keepkey-pubkeys-343733331147363327003800',
//     queueId: 'j9ZbcfjFy6kqShnupHXLWi',
//     type:"address",
//     username: 'test-user-2',
//     pubkey: "bnb1ffm69vl732y59tdm69d83ddjz3h4j5lqjaqxnf",
//     inserted: 1594510142838
// }

// let work = {
//     pubkey: 'thor1mu7gez4wpkddlsldfc8trn94zqwqumcgan4w7u',
//     username: 'test-user-2',
//     blockchain: 'thorchain',
//     symbol: 'RUNE',
//     asset: 'RUNE',
//     walletId: 'keepkey-pubkeys-343733331147363327003800',
//     queueId: 'j9ZbcfjFy6kqShnupHXLWi',
//     path: "m/44'/931'/0'/0/0",
//     script_type: 'thorchain',
//     network: 'RUNE',
//     created: 1635633471760,
//     tags: [
//         'keepkey:user:keepkey',
//         'thorchain',
//         'RUNE',
//         'thorchain',
//         'keepkey',
//         'kk-test-3800',
//         'keepkey-pubkeys-343733331147363327003800',
//         'keepkey:user:keepkey-pubkeys-343733331147363327003800'
//     ],
//     master: 'thor1mu7gez4wpkddlsldfc8trn94zqwqumcgan4w7u',
//     address: 'thor1mu7gez4wpkddlsldfc8trn94zqwqumcgan4w7u',
//     context: 'keepkey-pubkeys-343733331147363327003800',
//     isToken: false,
//     lastUpdated: 1635633696647,
//     balance: 0,
//     source: 'network',
//     priceUsd: '0',
//     valueUsd: '0',
//     onCoincap: false,
//     image: 'https://static.coincap.io/assets/icons/rune@2x.png'
// }

// let work = {
//     symbol: 'ETH',
//     asset: 'ETH',
//     blockchain: "ethereum",
//     walletId: 'keepkey-pubkeys-343733331147363327003800',
//     queueId: 'j9ZbcfjFy6kqShnupHXLWi',
//     type:"address",
//     username: 'test-user-2',
//     pubkey: "0xc3affff54122658b89c31183cec4f15514f34624",
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

