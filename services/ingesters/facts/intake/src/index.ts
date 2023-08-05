/*
      ETH-tx ingester

      Registered intake


      *  Mempool txs


 */
require('dotenv').config()
require('dotenv').config({path:"./../../.env"})
require('dotenv').config({path:"../../../.env"})
require('dotenv').config({path:"../../../../.env"})
require('dotenv').config({path:"../../../../../.env"})

const TAG = " | pending-tx-ingester | "
const log = require('@pioneer-platform/loggerdog')()
const {subscriber,publisher,redis} = require('@pioneer-platform/default-redis')
import { recoverPersonalSignature } from 'eth-sig-util';
import { bufferToHex } from 'ethereumjs-util';
// const metrics = require('datadog-metrics');
const pjson = require('../package.json');
let client = require("@pioneer-platform/foxitar-client")
const os = require("os")
// metrics.init({ host: os.hostname, prefix: pjson.name+'.'+process.env['NODE_ENV']+'.' });
const markets = require('@pioneer-platform/markets')

const poap = require('@pioneer-platform/poap-client')
let queue = require("@pioneer-platform/redis-queue")
let network = require("@pioneer-platform/eth-network")
let wait = require('wait-promise');
let sleep = wait.sleep;

let connection  = require("@pioneer-platform/default-mongo")
let txsDB = connection.get('transactions')
let assetsDB = connection.get('assets')
let blockchainsDB = connection.get('blockchains')
let votesDB = connection.get('votes')
txsDB.createIndex({txid: 1}, {unique: true})
let appsDB = connection.get('apps')

let BATCH_SIZE = process.env['BATCH_SIZE_SCORE'] || 1

let calculate_nft_voteing_power = async function(address:string){
    let tag = TAG + " | calculate_nft_voteing_power | "
    try{
        let voteTotal = 0
        //if pioneer 1 mill fox
        let allPioneers = await network.getAllPioneers()
        let pioneers = allPioneers.owners
        if(pioneers.indexOf(address) >= 0){
            log.info("PIONEER DETECTED!!!!!")
            voteTotal = 100000
        }

        //if poap add 1k fox
        let isPoap = false
        let paopInfo = await poap.getNFTs(address)
        log.debug(tag,"paopInfo: ",paopInfo)
        for(let i = 0; i < paopInfo.length; i++){
            let event = paopInfo[i]
            if(event.event.id === "100142"){
                voteTotal = voteTotal + 1000
            }
        }
        address = address.toLowerCase()
        redis.set(address+":nft:voteing-power",voteTotal)
        return voteTotal
    }catch(e){
        log.error(e)
        throw e
    }
}

let do_work = async function(){
    let tag = TAG+" | do_work | "
    let block
    try{
        await network.init()

        //all work
        let allWork = await queue.count("pioneer:facts:ingest")
        if(allWork > 0)log.debug(tag,"allWork: ",allWork)
        // metrics.gauge('score', allWork);
        await sleep(300)
        let work = await redis.lpop("pioneer:facts:ingest",BATCH_SIZE)
        if(work){
            log.info(tag,"work: ",work)
            work = JSON.parse(work[0])
            let body = work.payload
            //validate sig
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload
            let payload = JSON.parse(body.payload)

            //if vote
            if(payload.vote){
                if(!payload.name) throw Error("invalid payload, missing name!")
                const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
                const addressFromSig = recoverPersonalSignature({
                    data: msgBufferHex,
                    sig: body.signature,
                });
                log.debug(tag,"addressFromSig: ",addressFromSig)
                log.debug(tag,"body.signer: ",body.signer)
                if(addressFromSig.toLowerCase() !== body.signer.toLowerCase()) throw Error("Invalid signature!")

                // Tally actions
                redis.sadd("addresses:voted", addressFromSig);
                let isNew = await redis.sadd("addresses:voted:"+payload.name, addressFromSig);
                if (isNew === 1) {
                    log.info(tag, "isNew: ", addressFromSig);
                    await redis.sadd(addressFromSig + ":actions", "voted");
                    await redis.hincrby(addressFromSig + ":score", "score", 10); // Add "score" as the field parameter
                }

                //get all facts for dapp
                let allFactsUp = await redis.smembers("facts:votes:"+payload.name+":up")
                let allFactsDown = await redis.smembers("facts:votes:"+payload.name+":down")

                if(payload.vote === 'up'){
                    if(allFactsUp.indexOf(addressFromSig) >= 0){
                        console.error("Already voted!")
                    } else{
                        await redis.sadd("facts:votes:"+payload.name+":up",addressFromSig)
                    }
                    if(allFactsDown.indexOf(addressFromSig) >= 0){
                        console.error("Removing down vote")
                        await redis.srem("facts:votes:"+payload.name+":down",addressFromSig)
                    }
                }else if(payload.vote === 'down'){
                    if(allFactsDown.indexOf(addressFromSig) >= 0){
                        console.error("Already voted!")
                    } else{
                        await redis.sadd("facts:votes:"+payload.name+":down",addressFromSig)
                    }
                    if(allFactsUp.indexOf(addressFromSig) >= 0){
                        console.error("Removing up vote")
                        await redis.srem("facts:votes:"+payload.name+":up",addressFromSig)
                    }
                } else {
                    throw Error("Invalid vote! "+payload.vote)
                }
                allFactsUp = await redis.smembers("facts:votes:"+payload.name+":up")
                allFactsDown = await redis.smembers("facts:votes:"+payload.name+":down")
                //tally votes
                let allUpVotesInFox = 0
                let allDownVotesInFox = 0

                //profile dev


                for(let i = 0; i < allFactsUp.length; i++){
                    let address = allFactsUp[i]
                    let balanceFox = await network.getBalanceToken(address,"0xc770eefad204b5180df6a14ee197d99d808ee52d")

                    let nftPower = await calculate_nft_voteing_power(address)
                    let totalPowerAddress = parseFloat(balanceFox) + nftPower
                    log.info("UP: "+address+" power:",totalPowerAddress)
                    allUpVotesInFox = allUpVotesInFox + totalPowerAddress
                }

                for(let i = 0; i < allFactsDown.length; i++){
                    let address = allFactsDown[i]
                    let balanceFox = await network.getBalanceToken(address,"0xc770eefad204b5180df6a14ee197d99d808ee52d")
                    let nftPower = await calculate_nft_voteing_power(address)
                    let totalPowerAddress = parseFloat(balanceFox) + nftPower
                    log.info("DOWN: "+address+" power:",totalPowerAddress)
                    allDownVotesInFox = allDownVotesInFox + totalPowerAddress
                }
                //add all votes to

                //update global balance
                let score = allUpVotesInFox - allDownVotesInFox
                console.log("score: ",score)
                let resultScore = await appsDB.update({name:payload.name},{$set:{score}})
                console.log("resultScore: ",resultScore)
            }

            //if update

            //update mongo
        }

    } catch(e) {
        log.error(tag,"e: ",e)
        //queue.createWork(ASSET+":queue:block:ingest",block)
    }
    do_work()
}

let onCrawalFoxitars = async function() {
    let tag = TAG + " | onCrawalFoxitars | ";
    try {
        // Get last time it's run
        let lastRunTime = await redis.get("foxitar:worker:lastRunTime");
        log.info("lastRunTime: ", lastRunTime);
        let today = new Date();

        // Get last cursor
        let lastCursor = await redis.get("foxitar:cursor");
        lastCursor = parseInt(lastCursor) || 1;
        log.info("lastCursor: ", lastCursor);

        // If already run today and a full cycle was completed
        if (lastRunTime && new Date(lastRunTime).getDate() == today.getDate() && lastCursor == 0) {
            console.log("Already run today and a full cycle is completed");
            return;
        }

        // Get 100 addys at a time
        let limit = 2;
        let batch = await client.getOwners(lastCursor, limit);
        batch = batch.owners;
        //log.info(tag, "batch: ", batch);

        // If the batch is smaller than the limit, we've completed a cycle
        if (batch.length < limit) {
            lastCursor = 0; // Reset the cursor for the next cycle
        }

        // Prepare data for the sorted set
        let data = [];
        for (let i = lastCursor; i < lastCursor + batch.length; i++) {
            let entry = batch[i - lastCursor];
            log.debug(tag, "entry: ", entry);
            let tokenInfo = await client.getTokenInfo(i);
            log.debug(tag, "tokenInfo: ", tokenInfo);
            let xp = tokenInfo.properties?.XP?.value;
            log.debug(tag, "xp: ", xp);
            data.push({
                id: i+1,
                image: tokenInfo.image,
                xp: parseInt(xp) || 0,
                address: entry,
            });
            redis.hmset(entry,"foxitar",tokenInfo.image)
        }
        log.debug(tag, "data", data);

        for(let i = 0; i < data.length; i++){
            let entry = data[i]
            await redis.zadd("foxitars",entry.xp,entry.address)
        }

        // Set the cursor for the next run
        await redis.set("foxitar:cursor", lastCursor + batch.length);

        // If a full cycle was completed in this run, set the last run time
        if (batch.length < limit) {
            await redis.set("foxitar:worker:lastRunTime", today.toISOString());
        }

        // Wait for 5 seconds before the next iteration
        setTimeout(onCrawalFoxitars, 5000);
    } catch (e) {
        console.error(e);
        // If an error occurred, wait for 5 seconds before retrying
        setTimeout(onCrawalFoxitars, 5000);
    }
};

//saveMarketData()
let getMarketData = async function(){
    let tag = TAG + " | getMarketData | ";
    try{
        //get market data from markets
        let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
        let marketCacheCoincap = await redis.get('markets:Coincap')
        log.info(tag,"markets: ",markets)
        if(!marketCacheCoinGecko){
            let marketInfoCoinGecko = await markets.getAssetsCoingecko()
            if(marketInfoCoinGecko){
                //market info found for
                marketInfoCoinGecko.updated = new Date().getTime()
                redis.set('markets:CoinGecko',JSON.stringify(marketInfoCoinGecko),60 * 15)
                marketCacheCoinGecko = marketInfoCoinGecko
            }
        }

        // if(!marketCacheCoincap){
        //     let marketInfoCoincap = await markets.getAssetsCoinCap()
        //     if(marketInfoCoincap){
        //         //market info found for
        //         marketInfoCoincap.updated = new Date().getTime()
        //         redis.set('markets:CoinGecko',JSON.stringify(marketInfoCoincap),60 * 15)
        //         marketCacheCoincap = marketInfoCoincap
        //     }
        // }
        // log.info(tag,"marketCacheCoinGecko: ",marketCacheCoinGecko)
        // log.info(tag,"marketCacheCoincap: ",marketCacheCoincap)

        //save ranking to assets
        // Now, process the assets in batches
        marketCacheCoinGecko = JSON.parse(marketCacheCoinGecko)
        let symbols = Object.keys(marketCacheCoinGecko);
        log.info(symbols.length, " symbols found in marketCacheCoincap")
        // log.info(tag,"symbols: ",symbols)
        let batchSize = 300;
        for (let i = 0; i < symbols.length; i += batchSize) {
            let batchSymbols = symbols.slice(i, i + batchSize);
            log.info(tag,"batchSymbols: ",batchSymbols.length)
            log.info(tag,"batchSymbols: ",batchSymbols)
            // Query the DB for the symbols in the current batch
            let assetsInDB = await assetsDB.find({ symbol: { $in: batchSymbols } });
            log.info(tag,"assetsInDB: ",assetsInDB.length)

            let bulkOps = [];
            for (let assetInDB of assetsInDB) {
                // log.info(tag,"assetInDB: ",assetInDB)

                let asset = marketCacheCoinGecko[assetInDB.symbol];
                if(asset && asset.market_cap_rank){
                    // log.info(tag,"asset: ",asset)
                    log.info(tag,"symbol: ",asset.symbol)
                    log.info(tag,"asset: ",asset.market_cap_rank)
                    // if (!asset || asset.symbol === assetInDB.symbol) {
                    //     log.info("Collision or not found in marketCacheCoincap: ", assetInDB.symbol, " | ", asset.symbol);
                    //     continue;  // Symbol collision or not found in marketCacheCoincap, skip this symbol
                    // }

                    bulkOps.push({
                        updateOne: {
                            filter: { symbol: asset.symbol.toUpperCase() },
                            update: { $set: { rank: asset.market_cap_rank } }
                        }
                    });
                }
            }

            // Perform the bulk write operation
            if (bulkOps.length > 0) {
                log.info("bulkOps: ", JSON.stringify(bulkOps));
                let resultBatch = await assetsDB.bulkWrite(bulkOps, { ordered: false });
                log.info("resultBatch: ", resultBatch);
            }
        }


    }catch(e){
        console.error(e)
    }
}

//Do all the things
// onCrawalFoxitars();
// getMarketData()
//start working on install
log.debug(TAG," worker started! ","")
do_work()
