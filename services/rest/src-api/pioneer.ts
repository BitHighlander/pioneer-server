/*

    Pioneer API
      A High Availability blockchain api

    Goals:
      v1 compatibility with watchtower with 0 change
      Multi-asset support

    V2 goals:
      Treat Xpubs as passwords
      encrypt long term data storage
      maintain hash table to detect and cache payments



    getTransactions:

    Data: example

    { success: true,
      pagination: { page: 1, total_objects: 88, total_pages: 9 },
      data:
        [ { txid:
          '',
          status: 'confirmed',
          type: 'send',
          amount: -78602,
          date: '2019-05-10T21:01:23Z',
          confirmations: 1055,
          network: 'BTC',
          xpub:
            '' },
         }
       ]
      }
     }

*/

const TAG = " | Pioneer | "
const queue = require('@pioneer-platform/redis-queue');
const uuid = require('short-uuid');
let blocknative = require("@pioneer-platform/blocknative-client")
blocknative.init()
const blockbook = require('@pioneer-platform/blockbook')
// const foxitar = require("@pioneer-platform/foxitar-client")
let zapper = require("@pioneer-platform/zapper-client")
let servers:any = {}
if(process.env['BTC_BLOCKBOOK_URL']) servers['BTC'] = process.env['BTC_BLOCKBOOK_URL']
if(process.env['ETH_BLOCKBOOK_URL']) servers['ETH'] = process.env['ETH_BLOCKBOOK_URL']
if(process.env['DOGE_BLOCKBOOK_URL']) servers['DOGE'] = process.env['DOGE_BLOCKBOOK_URL']
if(process.env['BCH_BLOCKBOOK_URL']) servers['BCH'] = process.env['BCH_BLOCKBOOK_URL']
if(process.env['LTC_BLOCKBOOK_URL']) servers['LTC'] = process.env['LTC_BLOCKBOOK_URL']
blockbook.init(servers)

const networks:any = {
    'ETH' : require('@pioneer-platform/eth-network'),
    'ATOM': require('@pioneer-platform/cosmos-network'),
    'OSMO': require('@pioneer-platform/osmosis-network'),
    'BNB' : require('@pioneer-platform/binance-network'),
    // 'EOS' : require('@pioneer-platform/eos-network'),
    'FIO' : require('@pioneer-platform/fio-network'),
    'ANY' : require('@pioneer-platform/utxo-network'),
    'RUNE' : require('@pioneer-platform/thor-network'),
}
networks.ANY.init('full')
networks.ETH.init()

let {
    supportedBlockchains,
    supportedAssets,
    getPaths,
    get_address_from_xpub,
    getNativeAssetForBlockchain
} = require('@pioneer-platform/cointools')

//const bcrypt = require('bcryptjs');
var numbro = require("numbro");

const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
let connection  = require("@pioneer-platform/default-mongo")


let wait = require('wait-promise');
let sleep = wait.sleep;


let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let pubkeysDB = connection.get('pubkeys')
let inputsDB = connection.get('unspent')
let assetsDB = connection.get('assets')
usersDB.createIndex({id: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
inputsDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
pubkeysDB.createIndex({ tags: 1 })

const BALANCE_ON_REGISTER = true

module.exports = {
    refresh: async function (username:string) {
        return get_and_rescan_pubkeys(username);
    },
    register: async function (username:string, xpubs:any, context:string) {
        return register_pubkeys(username, xpubs, context);
    },
    getPubkeys: async function (username:string, context?:string) {
        return get_and_verify_pubkeys(username, context);
    },
    update: async function (username:string, xpubs:any, context:string) {
        return update_pubkeys(username, xpubs, context);
    },
    balances: async function (pubkey:any) {
        return get_pubkey_balances(pubkey);
    },
}

async function getFromCache(key) {
    try {
        const data = await redis.get(key);
        return data;
    } catch (err) {
        throw err;
    }
}

async function setInCache(key, data, expiration) {
    try {
        await redis.setex(key, expiration, data);
    } catch (err) {
        throw err;
    }
}

let get_pubkey_balances = async function (pubkey: any) {
    let tag = TAG + " | get_pubkey_balances | ";
    try {
        let output: any = {};
        if (!pubkey.symbol && pubkey.asset) pubkey.symbol = pubkey.asset;
        if (!pubkey.type && pubkey.address) pubkey.type = "address";
        if (!pubkey.context) throw Error("100: invalid pubkey! missing context");
        if (!pubkey.symbol) throw Error("101: invalid pubkey! missing symbol");
        if (!pubkey.username) throw Error("102: invalid pubkey! missing username");
        if (!pubkey.pubkey) throw Error("103: invalid pubkey! missing pubkey");
        if (!pubkey.type) throw Error("105: invalid pubkey! missing type");
        // if(!pubkey.queueId) throw Error("106: invalid pubkey! missing queueId");
        if (pubkey.type !== 'address' && pubkey.type !== 'xpub' && pubkey.type !== 'zpub' && pubkey.type !== 'contract') throw Error("Unknown type! " + pubkey.type);
        let balances: any = [];
        let nfts: any = [];
        let positions: any = [];

        // By type
        if (pubkey.type === "xpub" || pubkey.type === "zpub") {
            let cacheKey = `balances:blockbook:getBalanceByXpub:${pubkey.symbol}:${pubkey.pubkey}`;
            let cachedData = await getFromCache(cacheKey);
            let balance: any;
            if (cachedData) {
                balance = JSON.parse(cachedData);
            } else {
                balance = await blockbook.getBalanceByXpub(pubkey.symbol, pubkey.pubkey);
                log.debug(tag, pubkey.username + " Balance (" + pubkey.symbol + "): ", balance);
                await setInCache(cacheKey, JSON.stringify(balance), 60 * 60 * 1);
            }
            // Update balance
            balances.push({
                network: pubkey.symbol,
                asset: pubkey.symbol,
                isToken: false,
                lastUpdated: new Date().getTime(),
                balance
            });
        } else if (pubkey.type === "address") {
            switch (pubkey.symbol) {
                case "ETH":
                    let cacheKeyZapper = `balances:zapperInfo:getPortfolio:${pubkey.pubkey}`;
                    let cachedDataZapper = await getFromCache(cacheKeyZapper);
                    let zapperInfo;
                    if (cachedDataZapper) {
                        zapperInfo = JSON.parse(cachedDataZapper);
                    } else {
                        zapperInfo = await zapper.getPortfolio(pubkey.pubkey);
                        log.debug(tag, "zapperInfo: ", zapperInfo);
                        await setInCache(cacheKeyZapper, JSON.stringify(zapperInfo), 60 * 60 * 1);
                    }

                    let cacheKeyBlockbook = `balances:blockbook:getBalanceByXpub:${pubkey.symbol}:${pubkey.pubkey}`;
                    let cachedDataBlockbook = await getFromCache(cacheKeyBlockbook);
                    let balance;
                    if (cachedDataBlockbook) {
                        balance = JSON.parse(cachedDataBlockbook);
                    } else {
                        balance = await blockbook.getBalanceByXpub(pubkey.symbol, pubkey.pubkey);
                        log.debug(tag, pubkey.username + " Balance (" + pubkey.symbol + "): ", balance);
                        await setInCache(cachedDataBlockbook, JSON.stringify(balance), 60 * 60 * 1);
                    }

                    if (zapperInfo?.tokens?.length > 0) {
                        zapperInfo.tokens.forEach((token) => {
                            let balanceInfo = token.token;
                            balanceInfo.network = token.network;
                            balanceInfo.asset = balanceInfo.symbol = token.token.symbol;
                            balanceInfo.contract = token.token.address;
                            if (token.token.address !== '0x0000000000000000000000000000000000000000') {
                                balanceInfo.isToken = true;
                                balanceInfo.protocal = 'erc20';
                            }
                            balanceInfo.lastUpdated = new Date().getTime();
                            balanceInfo.balance = token.token.balance.toString();
                            balances.push(balanceInfo);
                        });
                    }

                    if (zapperInfo?.nfts?.length > 0) {
                        nfts = zapperInfo.nfts;
                    }

                    let cacheKeyAllPioneers = 'balances:getAllPioneers:ETH';
                    let cachedAllPioneers = await getFromCache(cacheKeyAllPioneers);
                    let allPioneers;
                    if (cachedAllPioneers) {
                        allPioneers = JSON.parse(cachedAllPioneers);
                    } else {
                        allPioneers = await networks['ETH'].getAllPioneers();
                        await setInCache(cacheKeyAllPioneers, JSON.stringify(allPioneers), 60 * 60 * 1);
                    }
                    log.debug(tag, "allPioneers: ", allPioneers);

                    let isPioneer = allPioneers.owners.includes(pubkey.pubkey.toLowerCase());
                    if (isPioneer) {
                        log.debug("Pioneer detected!");
                        let updatedUsername = await usersDB.update({ username: pubkey.username }, { $set: { isPioneer: true } }, { multi: true });
                        log.debug("Updated username PIONEER: ", updatedUsername);

                        const pioneerImage = allPioneers.images.find((image) => image.address.toLowerCase() === pubkey.pubkey.toLowerCase());
                        if (pioneerImage) {
                            let updatedUsername2 = await usersDB.update({ username: pubkey.username }, { $set: { pioneerImage: pioneerImage.image } }, { multi: true });
                            log.debug("updatedUsername2 PIONEER: ", updatedUsername2);
                            nfts.push({
                                name: "Pioneer",
                                description: "Pioneer",
                                number: allPioneers.owners.indexOf(pubkey.pubkey.toLowerCase()),
                                image: pioneerImage.image
                            });
                        }
                    }

                    let cacheKeyBlockbookInfo = `balances:blockbook:getAddressInfo:ETH:${pubkey.pubkey}`;
                    let cachedBlockbookInfo = await getFromCache(cacheKeyBlockbookInfo);
                    let blockbookInfo;
                    if (cachedBlockbookInfo) {
                        blockbookInfo = JSON.parse(cachedBlockbookInfo);
                    } else {
                        blockbookInfo = await blockbook.getAddressInfo('ETH', pubkey.pubkey);
                        await setInCache(cacheKeyBlockbookInfo, JSON.stringify(blockbookInfo), 60 * 60 * 1);
                    }
                    log.debug(tag, 'blockbookInfo: ', blockbookInfo);

                    if (blockbookInfo?.tokens) {
                        blockbookInfo.tokens.forEach((tokenInfo) => {
                            if (tokenInfo.symbol && tokenInfo.symbol !== 'ETH') {
                                let balanceInfo: any = {
                                    network: "ETH",
                                    type: tokenInfo.type,
                                    asset: tokenInfo.symbol,
                                    symbol: tokenInfo.symbol,
                                    name: tokenInfo.name,
                                    contract: tokenInfo.contract,
                                    image: "https://pioneers.dev/coins/ethereum.png",
                                    isToken: true,
                                    protocal: 'erc20',
                                    lastUpdated: new Date().getTime(),
                                    decimals: tokenInfo.decimals,
                                    balance: tokenInfo.balance / Math.pow(10, Number(tokenInfo.decimals)),
                                    balanceNative: tokenInfo.balance / Math.pow(10, Number(tokenInfo.decimals)),
                                    source: "blockbook"
                                };

                                if (tokenInfo.holdersCount === 1) {
                                    balanceInfo.nft = true;
                                }

                                if (balanceInfo.balance > 0) {
                                    balances.push(balanceInfo);
                                }
                            }
                        });
                    }

                    break;
                default:
                    let cacheKeyNetwork = `balances:${pubkey.symbol}:getBalance:${pubkey.pubkey}`;
                    let cachedDataNetwork = await getFromCache(cacheKeyNetwork);
                    let balanceNetwork;
                    if (cachedDataNetwork) {
                        balanceNetwork = JSON.parse(cachedDataNetwork);
                    } else {
                        balanceNetwork = await networks[pubkey.symbol].getBalance(pubkey.pubkey);
                        log.info(tag, "balance: ", balanceNetwork);
                        await setInCache(cacheKeyNetwork, JSON.stringify(balanceNetwork), 60 * 60 * 1);
                    }

                    if (!balanceNetwork) balanceNetwork = 0;
                    balances.push({
                        network: pubkey.symbol,
                        asset: pubkey.symbol,
                        symbol: pubkey.symbol,
                        isToken: false,
                        lastUpdated: new Date().getTime(), //TODO use block heights
                        balance: balanceNetwork,
                        source: "network"
                    });
                    break;
            }
        }

        let pubkeyInfo = await pubkeysDB.findOne({ pubkey: pubkey.pubkey });
        if (!pubkeyInfo || !pubkeyInfo.balances) {
            pubkeyInfo = {
                balances: []
            };
        }
        if (!pubkeyInfo.nfts) pubkeyInfo.nfts = [];
        log.debug(tag, "pubkeyInfo: ", pubkeyInfo);
        log.debug(tag, "pubkeyInfo.balances: ", pubkeyInfo.balances);
        log.debug(tag, "nfts: ", pubkeyInfo.nfts);

        let saveActions = [];
        for (let i = 0; i < balances.length; i++) {
            let balance = balances[i];
            let balanceIndex = pubkeyInfo.balances.findIndex((e) => e.symbol === balance.symbol);

            // Get asset info
            let assetInfo = await assetsDB.findOne({ symbol: balance.symbol });
            log.debug(tag,"assetInfo: ", assetInfo);

            if (assetInfo) {
                balance.caip = assetInfo.caip;
                balance.image = assetInfo.image;
                balance.description = assetInfo.description;
                balance.website = assetInfo.website;
                balance.explorer = assetInfo.explorer;
            }

            if (balanceIndex !== -1 && pubkeyInfo.balances[balanceIndex].balance !== balance.balance) {
                saveActions.push({
                    updateOne: {
                        filter: { pubkey: pubkey.pubkey },
                        update: {
                            $set: { [`balances.${balanceIndex}`]: balance },
                        },
                    },
                });
            } else {
                log.debug(tag, "balance not changed!");
            }
        }

        for (let i = 0; i < nfts.length; i++) {
            let nft = nfts[i];
            log.debug(tag, "pubkeyInfo.nfts: ", pubkeyInfo.nfts);
            let existingNft = pubkeyInfo.nfts.find((e: any) => e.name === nft.name);

            if (!existingNft) {
                saveActions.push({
                    updateOne: {
                        filter: { pubkey: pubkey.pubkey },
                        update: {
                            $addToSet: { nfts: nft }
                        }
                    }
                });
            }
        }

        if (saveActions.length > 0) {
            let updateSuccess = await pubkeysDB.bulkWrite(saveActions, { ordered: false });
            log.debug(tag, "updateSuccess: ", updateSuccess);
            output.dbUpdate = updateSuccess;
        }

        //@TODO save transactions

        // Build output
        output.pubkeys = [pubkeyInfo]
        output.balances = balances;
        output.nfts = nfts;

        return output;
    } catch (e) {
        console.error(tag, "e: ", e);
        throw e;
    }
};


// let get_pubkey_balances = async function (pubkey:any) {
//     let tag = TAG + " | get_pubkey_balances | "
//     try {
//         let output:any = {}
//         if(!pubkey.symbol && pubkey.asset) pubkey.symbol = pubkey.asset
//         if(!pubkey.type && pubkey.address) pubkey.type = "address"
//         if(!pubkey.context) throw Error("100: invalid pubkey! missing context")
//         if(!pubkey.symbol) throw Error("101: invalid pubkey! missing symbol")
//         if(!pubkey.username) throw Error("102: invalid pubkey! missing username")
//         if(!pubkey.pubkey) throw Error("103: invalid pubkey! missing pubkey")
//         if(!pubkey.type) throw Error("105: invalid pubkey! missing type")
//         // if(!pubkey.queueId) throw Error("106: invalid pubkey! missing queueId")
//         if(pubkey.type !== 'address' && pubkey.type !== 'xpub' && pubkey.type !== 'zpub' && pubkey.type !== 'contract') throw Error("Unknown type! "+pubkey.type)
//         let balances:any = []
//         let nfts:any = []
//         let positions:any = []
//         //by type
//         if(pubkey.type === "xpub" || pubkey.type === "zpub"){
//             //
//             let cacheKey = `balances:blockbook:getBalanceByXpub:${pubkey.username}:${pubkey.symbol}:${pubkey.pubkey}`;
//             let cachedData = await getFromCache(cacheKey);
//             let balance:any
//             if(cachedData){
//                 balance = JSON.parse(cachedData)
//             } else{
//                 let balance = await blockbook.getBalanceByXpub(pubkey.symbol,pubkey.pubkey)
//                 log.debug(tag,pubkey.username + " Balance ("+pubkey.symbol+"): ",balance)
//                 await setInCache(cacheKey, JSON.stringify(balance), 60 * 60 * 1);
//             }
//             //update balance
//             balances.push({
//                 network:pubkey.symbol,
//                 asset:pubkey.symbol,
//                 isToken:false,
//                 lastUpdated:new Date().getTime(),
//                 balance
//             })
//         } else if(pubkey.type === "address") {
//             switch (pubkey.symbol) {
//                 case "ETH":
//                     // let ethInfo = await networks['ETH'].getBalanceTokens(work.pubkey)
//                     // log.debug(tag,"ethInfo: ",ethInfo)
//
//                     let cacheKeyZapper = `balances:zapperInfo:getPortfolio:${pubkey.username}:${pubkey.pubkey}`;
//                     let cachedDataZapper = await getFromCache(cacheKeyZapper);
//                     let zapperInfo
//                     if(cachedDataZapper){
//                         zapperInfo = await zapper.getPortfolio(pubkey.pubkey);
//                         log.debug(tag, "zapperInfo: ", zapperInfo);
//                         await setInCache(cacheKeyZapper, JSON.stringify(zapperInfo), 60 * 60 * 1);
//                     } else{
//                         zapperInfo = JSON.parse(cachedDataZapper)
//                     }
//
//
//                     let cacheKeyBlockbook = `balances:blockbook:getBalanceByXpub:${pubkey.username}:${pubkey.symbol}::${pubkey.symbol}`;
//                     let cachedDataBlockbook = await getFromCache(cacheKeyBlockbook);
//                     let balance
//                     if(cachedDataBlockbook){
//                         balance = JSON.parse(cachedDataBlockbook)
//                     } else{
//                         let balance = await blockbook.getBalanceByXpub(pubkey.symbol,pubkey.pubkey)
//                         log.debug(tag,pubkey.username + " Balance ("+pubkey.symbol+"): ",balance)
//                         await setInCache(cacheKey, JSON.stringify(balance), 60 * 60 * 1);
//                     }
//
//                     if (zapperInfo?.tokens?.length > 0) {
//                         zapperInfo.tokens.forEach((token) => {
//                             let balanceInfo = token.token;
//                             balanceInfo.network = token.network;
//                             balanceInfo.asset = balanceInfo.symbol = token.token.symbol;
//                             balanceInfo.contract = token.token.address;
//                             if (token.token.address !== '0x0000000000000000000000000000000000000000') {
//                                 balanceInfo.isToken = true;
//                                 balanceInfo.protocal = 'erc20';
//                             }
//                             balanceInfo.lastUpdated = new Date().getTime();
//                             balanceInfo.balance = token.token.balance.toString();
//                             balances.push(balanceInfo);
//                         });
//                     }
//
//                     if (zapperInfo?.nfts?.length > 0) {
//                         nfts = zapperInfo.nfts;
//                     }
//
//                     let allPioneers = await networks['ETH'].getAllPioneers();
//                     log.debug(tag, "allPioneers: ", allPioneers);
//
//                     let isPioneer = allPioneers.owners.includes(pubkey.pubkey.toLowerCase());
//                     if (isPioneer) {
//                         log.debug("Pioneer detected!");
//                         let updatedUsername = await usersDB.update({ username: pubkey.username }, { $set: { isPioneer: true } }, { multi: true });
//                         log.debug("Updated username PIONEER: ", updatedUsername);
//
//                         const pioneerImage = allPioneers.images.find((image) => image.address.toLowerCase() === pubkey.pubkey.toLowerCase());
//                         if (pioneerImage) {
//                             let updatedUsername2 = await usersDB.update({ username: pubkey.username }, { $set: { pioneerImage: pioneerImage.image } }, { multi: true });
//                             log.debug("updatedUsername2 PIONEER: ", updatedUsername2);
//                             nfts.push({
//                                 name: "Pioneer",
//                                 description: "Pioneer",
//                                 number: allPioneers.owners.indexOf(pubkey.pubkey.toLowerCase()),
//                                 image: pioneerImage.image
//                             });
//                         }
//                     }
//
//                     // let isFox = await foxitar.isFoxOwner(pubkey.pubkey);
//                     // if (isFox > 0) {
//                     //     let foxInfo:any = {};
//                     //     let addressInfo = await redis.hgetall(pubkey.pubkey.toLowerCase());
//                     //     if (addressInfo.id) foxInfo.foxId = addressInfo.id;
//                     //     if (addressInfo.image) foxInfo.foxImage = addressInfo.image;
//                     //     if (addressInfo.xp) foxInfo.foxXp = addressInfo.xp;
//                     //     let updatedUsername = await usersDB.update({ username: pubkey.username }, { $set: { isFox: true, ...foxInfo } }, { multi: true });
//                     //     log.debug("updatedUsername FOX: ", updatedUsername);
//                     // }
//
//                     let blockbookInfo = await blockbook.getAddressInfo('ETH', pubkey.pubkey);
//                     log.debug(tag, 'blockbookInfo: ', blockbookInfo);
//
//                     if (blockbookInfo?.tokens) {
//                         blockbookInfo.tokens.forEach((tokenInfo) => {
//                             if (tokenInfo.symbol && tokenInfo.symbol !== 'ETH') {
//                                 let balanceInfo:any = {
//                                     network: "ETH",
//                                     type: tokenInfo.type,
//                                     asset: tokenInfo.symbol,
//                                     symbol: tokenInfo.symbol,
//                                     name: tokenInfo.name,
//                                     contract: tokenInfo.contract,
//                                     image:"https://pioneers.dev/coins/ethereum.png",
//                                     isToken: true,
//                                     protocal: 'erc20',
//                                     lastUpdated: new Date().getTime(),
//                                     decimals: tokenInfo.decimals,
//                                     balance: tokenInfo.balance / Math.pow(10, Number(tokenInfo.decimals)),
//                                     balanceNative: tokenInfo.balance / Math.pow(10, Number(tokenInfo.decimals)),
//                                     source: "blockbook"
//                                 };
//
//                                 if (tokenInfo.holdersCount === 1) {
//                                     // @ts-ignore
//                                     balanceInfo.nft = true;
//                                 }
//
//                                 if (balanceInfo.balance > 0) {
//                                     balances.push(balanceInfo);
//                                 }
//                             }
//                         });
//                     }
//
//                     break
//                 default:
//                     let balance = await networks[pubkey.symbol].getBalance(pubkey.pubkey)
//                     log.debug(tag,"balance: ",balance)
//                     if(!balance) balance = 0
//                     balances.push({
//                         network:pubkey.symbol,
//                         asset:pubkey.symbol,
//                         symbol:pubkey.symbol,
//                         isToken:false,
//                         lastUpdated:new Date().getTime(), //TODO use block heights
//                         balance,
//                         source:"network"
//                     })
//                     break
//             }
//         }
//         let pubkeyInfo = await pubkeysDB.findOne({pubkey:pubkey.pubkey})
//         if(!pubkeyInfo || !pubkeyInfo.balances) {
//             pubkeyInfo = {
//                 balances: []
//             }
//         }
//         if(!pubkeyInfo.nfts) pubkeyInfo.nfts = []
//         log.debug(tag,"pubkeyInfo: ",pubkeyInfo)
//         log.debug(tag,"pubkeyInfo: ",pubkeyInfo.balances)
//         log.debug(tag,"nfts: ",pubkeyInfo.nfts)
//
//         let saveActions = []
//         for (let i = 0; i < balances.length; i++) {
//             let balance = balances[i];
//             let balanceIndex = pubkeyInfo.balances.findIndex((e) => e.symbol === balance.symbol);
//
//             // Get asset info
//             let assetInfo = await assetsDB.findOne({ symbol: balance.symbol });
//             log.debug("assetInfo: ", assetInfo);
//
//             if (assetInfo) {
//                 balance.caip = assetInfo.caip;
//                 balance.image = assetInfo.image;
//                 balance.description = assetInfo.description;
//                 balance.website = assetInfo.website;
//                 balance.explorer = assetInfo.explorer;
//             }
//
//             if (balanceIndex !== -1 && pubkeyInfo.balances[balanceIndex].balance !== balance.balance) {
//                 saveActions.push({
//                     updateOne: {
//                         filter: { pubkey: pubkey.pubkey },
//                         update: {
//                             $set: { [`balances.${balanceIndex}`]: balance },
//                         },
//                     },
//                 });
//             } else {
//                 log.debug(tag, "balance not changed!");
//             }
//         }
//
//         for(let i = 0; i < nfts.length; i++){
//             let nft = nfts[i];
//             log.debug(tag,"pubkeyInfo.nfts: ",pubkeyInfo.nfts)
//             let existingNft = pubkeyInfo.nfts.find((e:any) => e.name === nft.name);
//
//             if(!existingNft){
//                 saveActions.push({updateOne: {
//                         "filter": {pubkey: pubkey.pubkey},
//                         "update": {
//                             // $pull: { balances: { nft.token.id: nft.token.id } },
//                             $addToSet: { nfts: nft }
//                         }
//                     }});
//             }
//         }
//
//         if(saveActions.length > 0){
//             let updateSuccess = await pubkeysDB.bulkWrite(saveActions,{ordered:false});
//             log.debug(tag,"updateSuccess: ",updateSuccess)
//             output.dbUpdate = updateSuccess
//         }
//
//         //@TODO save transactions
//
//         //build output
//         output.balances = balances
//         output.nfts = nfts
//
//         return output
//     } catch (e) {
//         console.error(tag, "e: ", e)
//         throw e
//     }
// }



let get_and_rescan_pubkeys = async function (username:string) {
    let tag = TAG + " | get_and_rescan_pubkeys | "
    try {
        //get pubkeys from mongo with context tagged
        let pubkeysMongo = await pubkeysDB.find({tags:{ $all: [username]}})
        log.debug(tag,"pubkeysMongo: ",pubkeysMongo.length)

        //get user info from mongo
        let userInfo = await usersDB.findOne({username})
        if(!userInfo) throw Error("get_and_rescan_pubkeys user not found!")
        log.debug(tag,"userInfo: ",userInfo)
        let blockchains = userInfo.blockchains
        if(!blockchains) blockchains = []
        // if(!userInfo.blockchains) throw Error("Invalid user!")

        //reformat
        let pubkeys:any = []
        let masters:any = {}
        for(let i = 0; i < pubkeysMongo.length; i++){
            let pubkeyInfo = pubkeysMongo[i]
            delete pubkeyInfo._id

            //for each wallet by user
            for(let j = 0; j < userInfo.wallets.length; j++){
                let context = userInfo.wallets[i]
                if(pubkeyInfo.type === 'zpub'){
                    //if context found in tags
                    let match = pubkeyInfo.tags.filter((e: any) => e === context)
                    if(match.length > 0){
                        register_zpub(username,pubkeyInfo,context)
                    }
                }else if(pubkeyInfo.type === 'xpub'){
                    let match = pubkeyInfo.tags.filter((e: any) => e === context)
                    if(match.length > 0){
                        register_xpub(username,pubkeyInfo,context)
                    }
                }else if(pubkeyInfo.type === 'address'){
                    let match = pubkeyInfo.tags.filter((e: any) => e === context)
                    if(match.length > 0){
                        register_address(username,pubkeyInfo,context)
                    }
                }
            }
        }



        return {pubkeys,masters}
    } catch (e) {
        console.error(tag, "e: ", e)
        throw e
    }
}

let get_and_verify_pubkeys = async function (username:string, context?:string) {
    let tag = TAG + " | get_and_verify_pubkeys | "
    try {

        //get pubkeys from mongo with context tagged
        if(!context) context = username
        let pubkeysMongo = await pubkeysDB.find({tags:{ $all: [context]}})
        log.debug(tag,"pubkeysMongo: ",pubkeysMongo.length)

        //get user info from mongo
        let userInfo = await usersDB.findOne({username})
        if(!userInfo) throw Error("get_and_verify_pubkeys User not found!")
        log.debug(tag,"userInfo: ",userInfo)
        let blockchains = userInfo.blockchains
        if(!blockchains) blockchains = []
        //if(!userInfo.blockchains) throw Error("Invalid user!")

        //reformat
        let pubkeys:any = []
        let allBalances:any = []
        // let masters:any = {}
        for(let i = 0; i < userInfo.pubkeys.length; i++){
            let pubkeyInfo = userInfo.pubkeys[i]
            delete pubkeyInfo._id
            //TODO validate pubkeys?
            pubkeyInfo.username = username
            //if no balances, get balances
            if(!pubkeyInfo.balances || pubkeyInfo.balances.length === 0){
                log.debug(tag,"no balances, getting balances...")
                let balances = await get_pubkey_balances(pubkeyInfo)
                // log.debug(tag,"balances: ",balances)
                log.debug(tag,"balances: ",balances)
                log.debug(tag,"balances: ",balances.balances.length)
                if(balances && balances.balances) {
                    pubkeyInfo.balances = balances.balances
                    allBalances = allBalances.concat(balances.balances)
                    log.debug(tag,"allBalances: ",allBalances)
                }
                if(balances && balances.nfts) pubkeys.nfts = balances.nfts
            } else {
                log.debug(tag,"balances already exist! count: ",pubkeyInfo.balances.length)
            }

            // if(!masters[pubkeyInfo.symbol] && pubkeyInfo.master)masters[pubkeyInfo.symbol] = pubkeyInfo.master
            pubkeyInfo.context = context
            pubkeys.push(pubkeyInfo)
        }

        return { pubkeys, balances: allBalances }
    } catch (e) {
        console.error(tag, "e: ", e)
        throw e
    }
}

let register_zpub = async function (username:string, pubkey:any, context:string) {
    let tag = TAG + " | register_zpub | "
    try {
        if(!context) throw Error("101: context required!")
        if(!pubkey.zpub) throw Error("102: invalid pubkey! missing zpub!")
        if(!pubkey.pubkey) throw Error("103: invalid pubkey! missing pubkey!")
        if(pubkey.pubkey == true) throw Error("104:(zpub) invalid pubkey! == true wtf!")
        if(!pubkey.symbol) throw Error("105: invalid pubkey! missing pubkey!")
        log.debug(tag,"pubkey: ",pubkey)
        //if zpub add zpub
        let queueId = uuid.generate()

        //get master
        let account = 0
        let index = 0
        let address = await get_address_from_xpub(pubkey.zpub,pubkey.scriptType,pubkey.symbol,account,index,false,false)
        log.debug(tag,"Master(Local): ",address)
        log.debug(tag,"Master(hdwallet): ",pubkey.master)
        if(address !== pubkey.master){
            log.error(tag,"Local Master NOT VALID!!")
            log.error(tag,"Local Master: ",address)
            log.error(tag,"hdwallet Master: ",pubkey.master)
            //revert to pubkey (assume hdwallet right)
            address = pubkey.master
        }
        let work = {
            type:'zpub',
            blockchain:pubkey.blockchain,
            pubkey:pubkey.pubkey,
            master:pubkey.master,
            network:pubkey.blockchain,
            asset:pubkey.symbol,
            queueId,
            username,
            context,
            zpub:pubkey.pubkey,
            inserted: new Date().getTime()
        }
        log.debug(tag,"Creating work! ",work)
        queue.createWork("pioneer:pubkey:ingest",work)
        let result = await get_pubkey_balances(work)
        log.debug(result)

        return queueId
    } catch (e) {
        console.error(tag, "e: ", e)
        throw e
    }
}

let register_xpub = async function (username:string, pubkey:any, context:string) {
    let tag = TAG + " | register_xpub | "
    try {
        if(!pubkey.pubkey) throw Error("102: invalid pubkey! missing pubkey!")
        if(pubkey.pubkey == true) throw Error("103:(xpub) invalid pubkey! === true wtf!")
        if(!pubkey.symbol) throw Error("104: invalid pubkey! missing symbol!")
        //log.debug(tag,"pubkey: ",pubkey)
        //if zpub add zpub
        let queueId = uuid.generate()

        //get master
        let account = 0
        let index = 0
        let address = await get_address_from_xpub(pubkey.pubkey,pubkey.scriptType,pubkey.symbol,account,index,false,false)
        log.debug(tag,"Master(Local): ",address)
        log.debug(tag,"Master(hdwallet): ",pubkey.master)
        if(address !== pubkey.master){
            log.error(tag,"Local Master NOT VALID!!")
            //revert to pubkey (assume hdwallet right)
            address = pubkey.master
        }
        let work = {
            context,
            type:'xpub',
            blockchain:pubkey.blockchain,
            pubkey:pubkey.pubkey,
            master:pubkey.master,
            network:pubkey.blockchain,
            asset:pubkey.symbol,
            queueId,
            username,
            xpub:pubkey.xpub,
            inserted: new Date().getTime()
        }
        log.debug(tag,"Creating work! ",work)
        queue.createWork("pioneer:pubkey:ingest",work)
        let {pubkeys, balances} = await get_pubkey_balances(work)
        log.debug(tag, "pubkeys: ",pubkeys.length)
        log.debug(tag, "balances: ",balances.length)

        return {pubkeys, balances}
    } catch (e) {
        console.error(tag, "e: ", e)
        throw e
    }
}

let register_address = async function (username:string, pubkey:any, context:string) {
    let tag = TAG + " | register_address | "
    try {
        let address = pubkey.pubkey
        let queueId = uuid.generate()

        //add to work
        let work = {
            type:'address',
            pubkey:address,
            symbol:pubkey.symbol,
            blockchain:pubkey.blockchain,
            network:pubkey.network,
            asset:pubkey.symbol,
            context,
            queueId,
            username,
            address,
            master:address,
            inserted: new Date().getTime()
        }
        log.debug("adding work: ",work)

        queue.createWork("pioneer:pubkey:ingest",work)
        let result = await get_pubkey_balances(work)
        log.debug(result)

        return queueId
    } catch (e) {
        console.error(tag, "e: ", e)
        throw e
    }
}

let update_pubkeys = async function (username:string, pubkeys:any, context:string) {
    let tag = TAG + " | update_pubkeys | "
    try {
        log.debug(tag,"input: ",{username,pubkeys,context})
        let saveActions = []
        //generate addresses
        let output:any = {}
        output.pubkeys = []
        let allPubkeys = []
        let PubkeyMap = {}
        for (let i = 0; i < pubkeys.length; i++) {
            let pubkeyInfo = pubkeys[i]
            allPubkeys.push(pubkeyInfo.pubkey)
            PubkeyMap[pubkeyInfo.pubkey] = pubkeyInfo
        }
        //remove duplicates
        allPubkeys = Array.from(new Set(allPubkeys))
        let allBalances = []
        //get pubkeys from mongo
        log.debug(tag,"allPubkeys: ",allPubkeys)
        let allKnownPubkeys = await pubkeysDB.find({"pubkey" : {"$in" : allPubkeys}})
        log.debug(tag,"allKnownPubkeys: ",allKnownPubkeys.length)

        //
        let knownPubkeys = []
        for(let i = 0; i < allKnownPubkeys.length; i++){
            knownPubkeys.push(allKnownPubkeys[i].pubkey)
        }
        log.debug(tag,"allKnownPubkeys: ",allKnownPubkeys.length)
        log.debug(tag,"allPubkeys: ",allPubkeys.length)
        if(allPubkeys.length > allKnownPubkeys.length){
            //build diff array known
            let unknown = allPubkeys.filter(x => !knownPubkeys.includes(x));
            log.debug(tag,"unknown: ",unknown)
            log.debug(tag,"Registering pubkeys : ",unknown.length)

            //if(BALANCE_ON_REGISTER){} //TODO dont return till work complete
            for(let i = 0; i < unknown.length; i++){
                let pubkey = unknown[i]
                let pubkeyInfo = PubkeyMap[pubkey]
                log.debug(tag,"pubkeyInfo: ",pubkeyInfo)
                if(!pubkeyInfo.pubkey) throw Error("102: invalid pubkey! missing pubkey")
                if(!pubkeyInfo.master) throw Error("102: invalid pubkey! missing master")
                if(!pubkeyInfo.blockchain) throw Error("103: invalid pubkey! missing blockchain")
                if(pubkey.pubkey === true) throw Error("104: invalid pubkey! === true wtf!")
                let nativeAsset = getNativeAssetForBlockchain(pubkeyInfo.blockchain)
                if(!nativeAsset) throw Error("105: invalid pubkey! unsupported by coins module!")
                //hack
                if (!pubkeyInfo.symbol) pubkeyInfo.symbol = nativeAsset

                //hack clean up tags
                if(typeof(context) !== 'string') {
                    //
                    log.error("invalid context!",context)
                    throw Error("Bad walletID!")
                }

                //save to mongo
                let entryMongo:any = {
                    blockchain:pubkeyInfo.blockchain,
                    symbol:nativeAsset,
                    asset:nativeAsset,
                    path:pubkeyInfo.path,
                    pathMaster:pubkeyInfo.pathMaster,
                    master:pubkeyInfo.master,
                    pubkey:pubkeyInfo.pubkey,
                    script_type:pubkeyInfo.script_type,
                    network:pubkeyInfo.network,
                    created:new Date().getTime(),
                    tags:[username,pubkeyInfo.blockchain,pubkeyInfo.network,context],
                }

                if(pubkeyInfo.type === "xpub" || pubkeyInfo.xpub){
                    if(pubkeyInfo.xpub){
                        entryMongo.pubkey = pubkeyInfo.pubkey
                    } else {
                        log.errro(tag,"pubkey: ",pubkeyInfo)
                        throw Error("102: Invalid xpub pubkey!")
                    }
                    saveActions.push({insertOne:entryMongo})
                    let result = await register_xpub(username,pubkeyInfo,context)
                    entryMongo.balances = result.balances
                    allBalances.push(...result.balances);
                    output.pubkeys.push(...result.pubkeys)
                } else if(pubkeyInfo.type === "zpub" || pubkeyInfo.zpub){
                    if(pubkeyInfo.zpub){
                        entryMongo.pubkey = pubkeyInfo.pubkey
                    } else {
                        log.errro(tag,"pubkey: ",pubkeyInfo)
                        throw Error("102: Invalid zpub pubkey!")
                    }
                    saveActions.push({insertOne:entryMongo})
                    let result = await register_zpub(username,pubkeyInfo,context)
                    entryMongo.balances = result.balances
                    allBalances.push(...result.balances);
                    output.pubkeys.push(...result.pubkeys)
                } else if(pubkeyInfo.type === "address"){
                    entryMongo.pubkey = pubkeyInfo.pubkey
                    let result = await register_address(username,pubkeyInfo,context)
                    entryMongo.balances = result.balances
                    allBalances.push(...result.balances);
                    output.pubkeys.push(...result.pubkeys)
                } else {
                    log.error("Unhandled type: ",pubkeyInfo.type)
                }


                //verify write
                log.debug(tag,"entryMongo: ",entryMongo)
                //check exists
                let keyExists = await pubkeysDB.findOne({pubkey:entryMongo.pubkey})
                if(keyExists){
                    log.debug(tag,"Key already registered! key: ",entryMongo)
                    //push wallet to tags
                    //add to tags
                    let pushTagMongo = await pubkeysDB.update({pubkey:entryMongo.pubkey},
                        { $addToSet: { tags: { $each:[context,username] } } })
                    log.debug(tag,"pushTagMongo: ",pushTagMongo)
                }else{
                    // saveActions.push({insertOne: entryMongo})

                    //final check
                    if(!entryMongo.pubkey || entryMongo.pubkey == true){
                        log.error(" **** ERROR INVALID PUBKEY ENTRY! ***** pubkeyInfo: ",pubkeyInfo)
                        log.error(" **** ERROR INVALID PUBKEY ENTRY! ***** entryMongo: ",entryMongo)
                        throw Error("105: unable to save invalid pubkey!")
                    } else {
                        let resultSave = await pubkeysDB.insert(entryMongo)
                        log.debug(tag,"resultSave: ",resultSave)
                        //TODO throw if error (better get error then not fail fast)
                    }

                }
            }


        } else {
            log.debug(tag," No new pubkeys! ")
        }

        log.debug(tag,"output: ",output)
        if(allBalances.length === 0){
            log.error(tag,"No balances found! allBalances: ",allBalances)
            // throw Error("No balances found!")
        }
        output.balances = allBalances

        log.debug(tag," return object: ",output)
        return output
    } catch (e) {
        console.error(tag, "e: ", e)
        throw e
    }
}

const register_pubkeys = async function (username: string, pubkeys: any, context: string) {
    let tag = TAG + " | register_pubkeys | ";
    try {
        log.debug(tag, "input: ", { username, pubkeys, context });
        let saveActions = [];
        let allBalances = [];
        //generate addresses
        let output: any = {};
        output.pubkeys = [];
        output.balances = [];
        for (let i = 0; i < pubkeys.length; i++) {
            let pubkeyInfo = pubkeys[i];
            log.debug(tag, "pubkeyInfo: ", pubkeyInfo);
            let nativeAsset = getNativeAssetForBlockchain(pubkeyInfo.blockchain);
            if (!nativeAsset) throw Error("104: invalid pubkey! unsupported by coins module!");
            if (!pubkeyInfo.pubkey) throw Error("104: invalid pubkey! missing pubkey!");
            if (!pubkeyInfo.type) throw Error("104: invalid pubkey! missing type!");
            //TODO verify type is in enums
            //hack
            if (!pubkeyInfo.symbol) pubkeyInfo.symbol = nativeAsset;

            log.debug(tag, "pubkeyInfo: ", pubkeyInfo);
            if (!pubkeyInfo.blockchain) throw Error("Invalid pubkey required field: blockchain");
            if (!pubkeyInfo.script_type) throw Error("Invalid pubkey required field: script_type coin:" + pubkeyInfo.blockchain);
            if (!pubkeyInfo.network) throw Error("Invalid pubkey required field: network coin:" + pubkeyInfo.blockchain);
            if (!pubkeyInfo.master) throw Error("Invalid pubkey required field: master coin:" + pubkeyInfo.blockchain);

            //save to mongo
            let entryMongo: any = {
                pubkey: pubkeyInfo.pubkey,
                type: pubkeyInfo.type,
                blockchain: pubkeyInfo.blockchain,
                symbol: nativeAsset,
                asset: pubkeyInfo.blockchain,
                path: pubkeyInfo.path,
                pathMaster: pubkeyInfo.pathMaster,
                script_type: pubkeyInfo.script_type,
                network: pubkeyInfo.blockchain,
                created: new Date().getTime(),
                tags: [username, pubkeyInfo.blockchain, pubkeyInfo.symbol, pubkeyInfo.network, context],
            };

            if (pubkeyInfo.type === "xpub") {
                log.debug(tag, "pubkeyInfo: ", pubkeyInfo);
                let xpub = pubkeyInfo.pubkey;
                log.debug(tag, "xpub: ", xpub);

                entryMongo.pubkey = xpub;
                entryMongo.xpub = xpub;
                entryMongo.type = 'xpub';
                entryMongo.master = pubkeyInfo.address;
                entryMongo.address = pubkeyInfo.address;
                let result = await register_xpub(username, pubkeyInfo, context);
                allBalances.push(...result.balances);
                output.pubkeys.push(...result.pubkeys);

            } else if (pubkeyInfo.type === "zpub") {
                let zpub = pubkeyInfo.pubkey;

                entryMongo.pubkey = zpub;
                entryMongo.zpub = zpub;
                entryMongo.type = 'zpub';
                entryMongo.master = pubkeyInfo.address;
                entryMongo.address = pubkeyInfo.address;

                let result = await register_xpub(username, pubkeyInfo, context);
                allBalances.push(...result.balances);
                output.pubkeys.push(...result.pubkeys);

            } else if (pubkeyInfo.type === "address") {
                entryMongo.pubkey = pubkeyInfo.pubkey;
                entryMongo.master = pubkeyInfo.pubkey;
                entryMongo.type = pubkeyInfo.type;
                entryMongo.address = pubkeyInfo.address;
                let result = await register_address(username, pubkeyInfo, context);
                allBalances.push(...result.balances);
                output.pubkeys.push(...result.pubkeys);
            } else {
                log.error("Unhandled type: ", pubkeyInfo.type);
            }

            //verify write
            log.debug(tag, "entryMongo: ", entryMongo);
            if (!entryMongo.pubkey) throw Error("103: Invalid pubkey! can not save!");
            //check exists
            let keyExists = await pubkeysDB.findOne({ pubkey: entryMongo.pubkey });
            if (keyExists) {
                log.debug(tag, "Key already registered! key: ", entryMongo);
                //push wallet to tags
                //add to tags
                let pushTagMongo = await pubkeysDB.update(
                    { pubkey: entryMongo.pubkey },
                    { $addToSet: { tags: { $each: [context, username] } } }
                );

                log.debug(tag, "pushTagMongo: ", pushTagMongo);
            } else {
                if (!entryMongo.pubkey || entryMongo.pubkey == true) {
                    log.error(" **** ERROR INVALID PUBKEY ENTRY! ***** pubkeyInfo: ", pubkeyInfo);
                    log.error(" **** ERROR INVALID PUBKEY ENTRY! ***** entryMongo: ", entryMongo);
                    throw Error("105: unable to save invalid pubkey!");
                } else {
                    let saveMongo = await pubkeysDB.insert(entryMongo);
                    log.debug(tag, "saveMongo: ", saveMongo);
                    //TODO throw if error (better get error than not fail fast)
                }

            }

        }
        output.balances = allBalances;
        log.debug(tag, "return object: ", output);
        return output;
    } catch (e) {
        console.error(tag, "e: ", e);
        throw e;
    }
};
