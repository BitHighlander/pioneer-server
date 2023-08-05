/*

    Pioneer REST endpoints



 */
import {bufferToHex} from "ethereumjs-util";

let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const { subscriber, publisher, redis, redisQueue } = require('@pioneer-platform/default-redis')
const midgard = require("@pioneer-platform/midgard-client")
const uuid = require('short-uuid');
const queue = require('@pioneer-platform/redis-queue');
const { Web3 } = require('web3');

import {
    Error,
    ApiError,
    Chart,
} from "@pioneer-platform/pioneer-types";

//globals
const ADMIN_PUBLIC_ADDRESS = process.env['ADMIN_PUBLIC_ADDRESS']
if(!ADMIN_PUBLIC_ADDRESS) throw Error("Invalid ENV missing ADMIN_PUBLIC_ADDRESS")


let connection  = require("@pioneer-platform/default-mongo")
let usersDB = connection.get('users')
let assetsDB = connection.get('assets')
let pubkeysDB = connection.get('pubkeys')
let txsDB = connection.get('transactions')
let invocationsDB = connection.get('invocations')
let utxosDB = connection.get('utxo')
let blockchainsDB = connection.get('blockchains')
let dappsDB = connection.get('apps')
let nodesDB = connection.get('nodes')

blockchainsDB.createIndex({blockchain: 1}, {unique: true})
// blockchainsDB.createIndex({chainId: 1}, {unique: true})
nodesDB.createIndex({service: 1}, {unique: true})
usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
// assetsDB.createIndex({name: 1}, {unique: true})
// assetsDB.createIndex({assetId: 1}, {unique: true})
assetsDB.createIndex({caip: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

//rest-ts
import {Body, Controller, Get, Header, Post, Route, Tags} from 'tsoa';
import {recoverPersonalSignature} from "eth-sig-util";
// @ts-ignore
let networkEth = require("@pioneer-platform/eth-network")
networkEth.init()

interface Network {
    network: string;
    symbol?: string;
    pioneer?: string;
    type: string;
    tags: any;
    pubkey: string;
}

interface SearchBlockchainsRequest {
    limit: number;
    skip: number;
    sortField: string;
    sortOrder: number;
    isCharted?: boolean;
}

//route
@Tags('Atlas Endpoints')
@Route('')
export class pioneerPublicController extends Controller {
    /*
     * ATLAS
     *
     *    Get all live blockchains
     *
     * */
    @Get('/atlas/assets/list/{limit}/{skip}')
    public async searchAssetsPageniate(limit:number,skip:number) {
        let tag = TAG + " | searchAssetsPageniate | "
        try{

            let output = []
            //blockchains Supported by keepkey
            let assets = await assetsDB.find({tags:{$all:['KeepKeySupport']}},{limit,skip})
            log.debug(tag,"assets: ",assets.length)
            log.debug(tag,"assets: ",assets[0])

            //seed market data
            let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
            marketCacheCoinGecko = JSON.parse(marketCacheCoinGecko)
            log.debug(tag,"marketCacheCoinGecko: ",marketCacheCoinGecko['BTC'])
            let usedSymbold = []
            for(let i = 0; i < assets.length; i++){
                //NOTE this sucks because it assumes symbol matchs
                let asset = assets[i]
                log.debug(tag,"asset: ",asset)
                let symbol = asset.symbol.toUpperCase()
                log.debug(tag,"symbol: ",symbol)
                if(symbol === "ETH" && asset.blockchain !== 'ethereum') symbol= "UNK"
                if(marketCacheCoinGecko[symbol]){
                    asset.price = marketCacheCoinGecko[symbol]?.current_price
                } else {
                    asset.price = 0
                }
                if(marketCacheCoinGecko[symbol]){
                    asset.rank = marketCacheCoinGecko[symbol]?.market_cap_rank
                } else {
                    asset.rank = 99999999
                }
                //only 1 per symbol
                if(usedSymbold.indexOf(asset.symbol) === -1){
                    output.push(asset)
                    usedSymbold.push(asset.symbol)
                }
            }

            //rank
            output = output.sort((a, b) => {
                if (a.rank < b.rank) {
                    return -1;
                }
            });

            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }


    /*
     * ATLAS
     *
     *    Get all live blockchains
     *
     * */
    @Post('/atlas/search/blockchains/list')
    public async searchBlockchainsPageniate(
        @Body() requestBody: SearchBlockchainsRequest
    ) {
        let tag = TAG + " | searchBlockchainsPageniate | ";
        try {
            const { limit, skip, sortField, sortOrder, isCharted = true } = requestBody;
            let sortQuery = {};
            sortQuery[sortField] = sortOrder;
            // Blockchains Supported by keepkey
            let query = {};
            if (isCharted) {
                query['isCharted'] = true;
            } else {
                query['isCharted'] = false;
            }

            // Blockchains Supported by keepkey
            let blockchains = await blockchainsDB.find(query, { limit, skip, sort: sortQuery });

            //
            let total = await blockchainsDB.count(query);

            return { blockchains, total };
        } catch (e) {
            let errorResp: Error = {
                success: false,
                tag,
                e,
            };
            log.error(tag, "e: ", { errorResp });
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }
    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/dapps/list/{limit}/{skip}')
    public async searchDappsPageniate(limit:number,skip:number) {
        let tag = TAG + " | searchDappsPageniate | "
        try{
            log.debug(tag,{limit,skip})
            let dapps = await dappsDB.find({whitelist:true},{limit,skip})
            return dapps
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/dapps/pending/{limit}/{skip}')
    public async searchDappsPageniatePending(limit:number,skip:number) {
        let tag = TAG + " | searchDappsPageniatePending | "
        try{
            //Get tracked networks
            let dapps = await dappsDB.find({whitelist:false},{limit,skip})

            return dapps
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/dapps/{developer}')
    public async searchDappsByDeveloper(developer:string) {
        let tag = TAG + " | searchDappsByDeveloper | "
        try{
            developer = developer.toLowerCase()
            //Get tracked networks
            let dapps = await dappsDB.find({developer})

            return dapps
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/dapps/pending/{developer}')
    public async searchDappsByDeveloperPendingTest(developer:any) {
        let tag = TAG + " | searchDappsByDeveloperPending | "
        try{
            log.debug(tag,"developer: ",developer)

            developer = developer.toLowerCase()
            log.debug(tag,"developer: ",developer)
            //Get tracked networks
            // let dapps = await dappsDB.find()
            let dapps = await dappsDB.find({$and: [{developer},{whitelist:false}]},{limit:10})

            return dapps
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/tokens/{contract}')
    public async searchByContract(contract:string) {
        let tag = TAG + " | searchByContract | "
        try{
            contract = contract.toLowerCase()
            //Get tracked networks
            let assets = await assetsDB.find({contract})

            return assets
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }


    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/searchByTag/asset/{tagString}')
    public async searchByTag(tagString:string) {
        let tag = TAG + " | searchByTag | "
        try{
            //Get tracked networks
            let assets = await assetsDB.find({tags:{$all:[tagString]}})

            return assets
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     * searchByTagNative
     *
     */

    @Get('/atlas/list/asset/native/{tagString}')
    public async searchByTagNative(tagString:string) {
        let tag = TAG + " | searchByTagNative | "
        try{
            let output = []
            //Get tracked networks
            let assets = await assetsDB.find({tags:{$all:[tagString,'isNative']}})

            //seed market data
            let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
            marketCacheCoinGecko = JSON.parse(marketCacheCoinGecko)
            log.debug(tag,"marketCacheCoinGecko: ",marketCacheCoinGecko['BTC'])
            for(let i = 0; i < assets.length; i++){
                //NOTE this sucks because it assumes symbol matchs
                let asset = assets[i]

                if(marketCacheCoinGecko[asset.symbol.toUpperCase()]){
                    asset.price = marketCacheCoinGecko[asset.symbol.toUpperCase()]?.current_price
                } else {
                    asset.price = 0
                }
                if(marketCacheCoinGecko[asset.symbol.toUpperCase()]){
                    asset.rank = marketCacheCoinGecko[asset.symbol.toUpperCase()]?.market_cap_rank
                } else {
                    asset.rank = 99999999
                }
                output.push(asset)
            }

            //rank
            output = output.sort((a, b) => {
                if (a.rank < b.rank) {
                    return -1;
                }
            });

            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
* ATLAS
*
*    Get all live atlas
*
* */
    @Get('/atlas/list/asset/search/chainId/{chainId}/{name}')
    public async searchByNameAndChainId(chainId:number,name:string) {
        let tag = TAG + " | searchByName | "
        try{
            name = name.toLowerCase()
            let escapeRegex = function (text) {
                return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            };

            //TODO sanitize
            let regex = new RegExp(escapeRegex(name), 'gi');
            name = name.toUpperCase()
            let regexUpper = new RegExp(escapeRegex(name), 'gi');
            name = name.toLowerCase()
            let regexLower = new RegExp(escapeRegex(name), 'gi')

            //Get tracked networks
            let assetsByName = await assetsDB.find({ chainId,"name": regex },{limit:100})
            let assetsBySymbol = await assetsDB.find({ chainId,"symbol": regexUpper },{limit:100})
            let assetsByContract = await assetsDB.find({ chainId,"contract": regexLower },{limit:100})

            console.log("assetsByName: ",assetsByName.length)
            console.log("assetsBySymbol: ",assetsBySymbol.length)
            console.log("assetsByContract: ",assetsByContract.length)

            console.log("assetsByName: ",assetsByName[0])
            console.log("assetsBySymbol: ",assetsBySymbol[0])
            console.log("assetsByContract: ",assetsByContract[0])

            // let assets = await assetsDB.find({$and: [{ "name": regex },{tags:{$all:['KeepKeySupport']}}]},{limit:4})
            let assets =  [...assetsByName, ...assetsBySymbol, ...assetsByContract]
            let output = []
            //sort assets by markcap
            //seed market data
            let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
            marketCacheCoinGecko = JSON.parse(marketCacheCoinGecko)
            log.debug(tag,"marketCacheCoinGecko: ",marketCacheCoinGecko['BTC'])
            for(let i = 0; i < assets.length; i++){
                //NOTE this sucks because it assumes symbol matchs
                let asset = assets[i]

                if(marketCacheCoinGecko[asset.symbol.toUpperCase()]){
                    asset.price = marketCacheCoinGecko[asset.symbol.toUpperCase()]?.current_price
                } else {
                    asset.price = 0
                }
                if(marketCacheCoinGecko[asset.symbol.toUpperCase()]){
                    asset.rank = marketCacheCoinGecko[asset.symbol.toUpperCase()]?.market_cap_rank
                } else {
                    asset.rank = 99999999
                }
                if(!asset.score) asset.score = 0
                output.push(asset)
            }

            //rank
            output = output.sort((a, b) => {
                if (a.rank < b.rank) {
                    return -1;
                }
            });

            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }


    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/list/asset/search/{name}')
    public async searchByName(name:string) {
        let tag = TAG + " | searchByName | "
        try{
            name = name.toLowerCase()
            let escapeRegex = function (text) {
                return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            };

            //TODO sanitize
            const regex = new RegExp(escapeRegex(name), 'gi');
            //Get tracked networks
            let assets = await assetsDB.find({ "name": regex },{limit:10})
            // let assets = await assetsDB.find({$and: [{ "name": regex },{tags:{$all:['KeepKeySupport']}}]},{limit:4})

            return assets
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/list/asset/search/native/{name}')
    public async searchByNameNative(name:string) {
        let tag = TAG + " | searchByName | "
        try{

            let escapeRegex = function (text) {
                return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            };

            //TODO sanitize
            const regex = new RegExp(escapeRegex(name), 'gi');
            //Get tracked networks
            //let assets = await assetsDB.find({ "name": regex },{limit:10})
            let assets = await assetsDB.find({$and: [{ "name": regex },{tags:{$all:['KeepKeySupport']}}]},{limit:4})

            return assets
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
        @Get('/atlas/search/asset/{limit}/{skip}')
    public async searchAssetsList(limit:number,skip:number) {
        let tag = TAG + " | searchAssetsListByChainId | "
        try{
            //TODO sanitize
            //Get tracked networks
            let assets = await assetsDB.find({},{limit,skip})

            return assets
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     * ATLAS
     * Search for dapps
     */
    @Post('/atlas/search/dapp')
    public async searchDapps(
        @Body()
            payload: {
            sortBy: string;
            limit: number;
            skip: number;
            sortOrder?: string;
            filterTags?: string[];
            isWhitelisted?: boolean;
            blockchain?: string;
        }
    ) {
        let tag = TAG + ' | getDapps | ';
        try {
            const {
                sortBy,
                limit,
                skip,
                sortOrder = 'asc',
                filterTags = [],
                isWhitelisted,
                blockchain,
            } = payload;

            // Create sort object
            const sort: any = {};
            if (sortBy) {
                sort[sortBy] = sortOrder === 'desc' ? -1 : 1; // -1 for descending, 1 for ascending (default)
            }

            // Build query object
            let query: any = {};

            // Filter out dapps without rank
            if (sortBy === 'rank') {
                query.rank = { $exists: true };
            }

            // Add filters based on the filter tags
            if (filterTags && filterTags.length > 0 && filterTags[0] !== '') {
                query.tags = { $in: filterTags };
            }

            // Add filter for isWhitelisted
            if (typeof isWhitelisted === 'boolean') {
                query.whitelist = isWhitelisted;
            }

            // Add filter for blockchain
            if (blockchain && typeof blockchain === 'string') {
                query.blockchain = blockchain;
            }

            // Get dapps with sort, limit, and skip parameters
            log.debug(tag, 'filterTags: ', filterTags);
            let dapps = await dappsDB.find(query, { limit, skip });

            //if no score then set to 0
            dapps = dapps.map((dapp) => {
                if (!dapp.score) {
                    dapp.score = 0;
                }
                return dapp;
            })
            //sort by score
            const sortArrayByScore = (arr: any[]) => {
                return arr.sort((a, b) => {
                    if (a.score === undefined) a.score = 0;
                    if (b.score === undefined) b.score = 0;
                    return b.score - a.score;
                });
            };
            dapps = sortArrayByScore(dapps);

            let total = await dappsDB.count(query);

            return { dapps, total };
        } catch (e) {
            let errorResp: Error = {
                success: false,
                tag,
                e,
            };
            log.error(tag, 'e: ', { errorResp });
            throw new ApiError('error', 503, 'error: ' + e.toString());
        }
    }


    /**
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/list/asset/chainId/{chainId}/{limit}/{skip}')
    public async searchAssetsListByChainId(chainId:number,limit:number,skip:number) {
        let tag = TAG + " | searchAssetsListByChainId | "
        try{
            //TODO sanitize
            //Get tracked networks
            let assets = await assetsDB.find({chainId},{limit,skip})

            return assets
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /**
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Post('/atlas/list/asset')
    public async getAssets(
        @Body() payload: {
            sortBy: string;
            limit: number;
            skip: number;
            sortOrder?: string;
            filterTags?: string[];
        }
    ) {
        let tag = TAG + " | getAssets | ";
        try {
            // TODO: Sanitize input

            const { sortBy, limit, skip, sortOrder = 'asc', filterTags = [] } = payload;

            // Create sort object
            const sort: any = {};
            if (sortBy) {
                sort[sortBy] = sortOrder === 'desc' ? -1 : 1; // -1 for descending, 1 for ascending (default)
            }
            // Build query object to filter out assets without rank
            let query: any = {};
            if(sortBy === 'rank'){
                query = { rank: { $exists: true } };
            }

            // Add filters based on the filter tags
            if (filterTags && filterTags.length > 0 && filterTags[0] !== '') {
                query['tags'] = { $in: filterTags };
            }

            // Get tracked networks with sort, limit, and skip parameters
            log.debug(tag,"filterTags: ",filterTags)
            let assets = await assetsDB.find(query, { sort, limit, skip });
            let total = await assetsDB.count(query);

            return { assets, total };
        } catch (e) {
            let errorResp: Error = {
                success: false,
                tag,
                e,
            };
            log.error(tag, "e: ", { errorResp });
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }

    /*
     * ATLAS
     *
     *    Get blockchains to limit
     *    Filter by EIP155
     *    Order by rank of fee assets
     *    For each blockchain, get 3 nodes
     *
     */

    @Post('/nodes/list/blockchain')
    public async getNodesByByBlockchain(
        @Body() payload: {
            sortBy: string;
            limit: number;
            skip: number;
            sortOrder?: string;
            filterTags?: string[];
        }
    ) {
        let tag = TAG + " | getNodesByByBlockchain | ";
        try {
            // TODO: Sanitize input

            const { sortBy, limit, skip, sortOrder = 'asc', filterTags = [] } = payload;

            // Create sort object
            const sort: any = {};
            if (sortBy) {
                sort[sortBy] = sortOrder === 'desc' ? -1 : 1; // -1 for descending, 1 for ascending (default)
            }
            // Build query object to filter out assets without rank
            let query: any = {};
            if (sortBy === 'rank') {
                query = { rank: { $exists: true } };
            }

            // Add filters based on the filter tags
            if (filterTags && filterTags.length > 0 && filterTags[0] !== '') {
                query['tags'] = { $in: filterTags };
            }

            // Get tracked networks with sort, limit, and skip parameters
            log.info(tag, "filterTags: ", filterTags)
            let assets = await nodesDB.find(query, { sort, limit, skip });
            let total = await assetsDB.count(query);

            return { assets, total };
        } catch (e) {
            let errorResp: Error = {
                success: false,
                tag,
                e,
            };
            log.error(tag, "e: ", { errorResp });
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }


    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/searchBySymbol/asset/{symbol}')
    public async searchBySymbol(symbol:string) {
        let tag = TAG + " | atlas | "
        try{
            //TODO sanitize
            //Get tracked networks
            let assets = await assetsDB.find({symbol},{limit:4})

            return assets
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/list/top/{start}/{stop}/{limit}')
    public async atlasNetwork(start:number,stop:number,limit:number) {
        let tag = TAG + " | atlas | "
        try{
            let output = []
            //let cache = await redis.get("cache:network:top:"+start+":"+stop)
            let cache = false
            let ALL_CHAINS = [
                { name: 'ethereum', chain_id: 1, symbol: 'ETH' },
                { name: 'polygon', chain_id: 137, symbol: 'MATIC' },
                { name: 'pulsechain', chain_id: 369, symbol: 'PLS' },
                { name: 'optimism', chain_id: 10, symbol: 'ETH' },
                { name: 'gnosis', chain_id: 100, symbol: 'xDAI' },
                { name: 'binance-smart-chain', chain_id: 56, symbol: 'BNB' },
                { name: 'smart-bitcoin-cash', chain_id: 10000, symbol: 'BCH' },
                { name: 'arbitrum', chain_id: 42161, symbol: 'ARB' },
                { name: 'fuse', chain_id: 122, symbol: 'FUSE' },
                { name: 'bittorrent', chain_id: 199, symbol: 'BTT' },
                { name: 'pulsechain', chain_id: 369, symbol: 'PLS' },
                { name: 'celo', chain_id: 42220, symbol: 'CELO' },
                { name: 'avalanche-c-chain', chain_id: 43114, symbol: 'AVAX' },
                { name: 'görli', chain_id: 5, symbol: 'GOR' },
                { name: 'ethereum-classic', chain_id: 61, symbol: 'ETC' },
                { name: 'evmos', chain_id: 9001, symbol: 'EVMOS' },
                { name: 'poa-core', chain_id: 99, symbol: 'POA' },
            ]

            //top 15 networks
            //avalance-c
            //optimism
            //binance smart chain
            //gnosis
            //matic

            //console.log(cache)
            if(!cache){
                for(let i = 0; i < ALL_CHAINS.length; i++){
                    let chainInfo = ALL_CHAINS[i]
                    let chainId = chainInfo.chain_id
                    log.info(tag,"chainId: ",chainId)
                    let entry = await nodesDB.find({chainId},{limit})
                    log.info(tag,"entry: ",entry.length)
                    if(entry.length > 1){
                        for(let j = 0; j < entry.length; j++){
                            let server = entry[j]
                            if(entry)output.push(server)
                        }
                    }
                }
                redis.set("cache:network:top",JSON.stringify(output))
                redis.expire("cache:network:top",60000)
            } else {
                output = JSON.parse(cache)
            }

            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
        * ATLAS
        *
        *    Get a tested live node
        *
        * */
    @Get('/atlas/node/{chainId}')
    public async getEvmNode(chainId: number) {
        const tag = TAG + " | getEvmNode | ";
        try {
            const limit = 10;
            const entry = await nodesDB.find({ chainId }, { limit });
            log.info(tag,"entry: ",entry.length)
            const output = entry.slice(0, limit);

            const pingNode = async (node) => {
                const startTime = new Date().getTime();
                try {
                    const providerUrl = node.service;
                    const web3 = new Web3(providerUrl);

                    let result = await web3.eth.getBlockNumber();
                    result = result.toString(); // Convert BigInt to string
                    log.info("result: ",result)
                    const endTime = new Date().getTime();
                    const ping = endTime - startTime;
                    console.log(`Node: ${node.service}, Ping: ${ping}`);

                    await nodesDB.update({ _id: node._id }, { $set: { ping } }); // Update ping in MongoDB

                    return ping;
                } catch (error) {
                    log.error(tag, `Timeout for ${node.service}`);
                    await nodesDB.update({ _id: node._id }, { $set: { isOffline: true } });
                    return null;
                }
            };

            const pingPromises = output.map(server => pingNode(server));
            // @ts-ignore
            const pings = await Promise.allSettled(pingPromises);

            pings.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const ping = result.value;
                    if (ping !== null) {
                        output[index].ping = ping;
                    }
                }
            });

            const bestPingNode = output.reduce((best, current) => {
                if (!best || current.ping < best.ping) {
                    return current;
                }
                return best;
            }, null);

            return bestPingNode;
        } catch (e) {
            const errorResp: Error = {
                success: false,
                tag,
                e,
            };
            log.error(tag, "e: ", { errorResp });
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }

    /*
        * ATLAS
        *
        *    Get all live nodes
        *
        * */
    @Get('/atlas/nodes/{limit}/{skip}')
    public async searchNodes(limit:number,skip:number) {
        let tag = TAG + " | atlas | "
        try{

            //Get tracked networks
            let networks = await nodesDB.find({ },{limit,skip})

            return networks
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    * ATLAS
    *
    *    Get all live nodes
    *
    * */
    @Get('/atlas/blockchains/{limit}/{skip}')
    public async searchBlockchainsPaginate(limit:number,skip:number) {
        let tag = TAG + " | searchBlockchainsPaginate | "
        try{
            //Get tracked networks
            let output = await blockchainsDB.find({},{limit,skip})
            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    * ATLAS
    *
    *    Search blockchains by type
    *
    * */
    @Get('/atlas/blockchains/byType/{type}/{limit}/{skip}')
    public async searchBlockchainsByTagPaginate(type:string,limit:number,skip:number) {
        let tag = TAG + " | searchBlockchainsByTagPaginate | "
        try{
            //Get tracked networks
            let output = await blockchainsDB.find({},{limit,skip})
            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    * ATLAS
    *
    *    Get all live nodes
    *
    * */
    @Get('/atlas/dapps/{limit}/{skip}')
    public async searchDappsPaginate(limit:number,skip:number) {
        let tag = TAG + " | searchDappsPaginate | "
        try{
            //Get tracked networks
            let output = await dappsDB.find({},{limit,skip})
            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    * ATLAS
    *
    *    Get all live nodes
    *
    * */
    @Get('/atlas/assets/{limit}/{skip}')
    public async searchAppsPaginate(limit:number,skip:number) {
        let tag = TAG + " | searchDappsPaginate | "
        try{
            //Get tracked networks
            let output = await dappsDB.find({},{limit,skip})
            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    * ATLAS
    *
    *    Get all live nodes
    *
    * */
    @Get('/atlas/pioneers/{limit}/{skip}')
    public async searchPioneersPaginate(limit:number,skip:number) {
        let tag = TAG + " | searchPioneersPaginate | "
        try{
            //Get tracked networks
            let output = await usersDB.find({},{limit,skip})
            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    * ATLAS
    *
    *    getBlockchainsBy ChainId
    *
    * */
    @Get('/atlas/blockchains/chainId/{chainId}')
    public async searchBlockchainByChainId(chainId:string) {
        let tag = TAG + " | searchBlockchainByChainId | "
        try{
            log.info(tag,"chainId: ",chainId)
            log.info(tag,"chainId: ",typeof(chainId))
            // @ts-ignore
            chainId = parseInt(chainId)
            log.info(tag,"chainId: ",typeof(chainId))
            //Get tracked networks
            let networks = await blockchainsDB.find({ chainId },{limit:10})

            return networks
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }


    /*
    * ATLAS
    *
    *    Get all live atlas
    *
    * */
    @Get('/atlas/network/chainId/{chainId}')
    public async searchByNetworkId(chainId:number) {
        let tag = TAG + " | atlas | "
        try{

            //Get tracked networks
            let networks = await nodesDB.find({ chainId },{limit:10})

            return networks
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    * ATLAS
    *
    *    Get all live atlas
    *
    * */
    @Get('/atlas/nodes/network/chainId/{chainId}')
    public async searchNodesByNetworkId(chainId:number) {
        let tag = TAG + " | searchNodesByNetworkId | "
        try{

            //Get tracked networks
            let networks = await nodesDB.find({ chainId },{limit:10})

            return networks
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * SEARCH
     *
     *    Get all live blockchains
     *
     * */
    @Get('/atlas/search/assets/byName/{asset}')
    public async searchAssetsByName(asset:string) {
        let tag = TAG + " | SearchAssetsByName | "
        try{
            //TODO sanitize
            let output = []
            let escapeRegex = function (text) {
                return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            };

            //TODO sanitize
            const regex = new RegExp(escapeRegex(asset), 'gi');
            //Get tracked networks
            let assets = await assetsDB.find({ "name": regex },{limit:100})

            return assets
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    @Get('/atlas/search/assets/bySymbol/{symbol}')
    public async searchAssetsBySymbol(symbol:string) {
        let tag = TAG + " | searchAssetsBySymbol | "
        try{
            //Get tracked networks
            let assets = await assetsDB.find({ symbol },{limit:100})

            return assets
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    @Get('/atlas/search/nodes/byType/{type}')
    public async searchNodesByType(type:string) {
        let tag = TAG + " | searchNodesByType | "
        try{
            //Get tracked networks
            //any node with this type in tags
            let nodes = await nodesDB.find({ tags: { $in: [type] } },{limit:100})

            return nodes
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * ATLAS
     *
     *    Get all live blockchains
     *
     * */
    @Get('/atlas/search/nodes/blockchains/{blockchain}')
    public async SearchByNetworkName(blockchain:string) {
        let tag = TAG + " | SearchByNetworkName | "
        try{
            //TODO sanitize
            let blockchains
            let output = []
            let blockchainsExact = await blockchainsDB.find({ "name": blockchain },{limit:10})
            let blockchainsExact2 = await blockchainsDB.find({ "blockchain": blockchain },{limit:10})
            if(blockchainsExact) blockchains=blockchainsExact
            if(blockchainsExact2) blockchains=blockchainsExact2
            if(!blockchains){
                let escapeRegex = function (text) {
                    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                };

                //TODO sanitize
                const regex = new RegExp(escapeRegex(blockchain), 'gi');
                //Get tracked networks
                blockchains = await blockchainsDB.find({ "name": regex },{limit:10})
                console.log("blockchains: ",blockchains)
            }
            for(let i = 0; i < blockchains.length; i++){
                let blockchain = blockchains[i]
                console.log("blockchain: ",blockchain)
                //if chainId
                if(blockchain.chainId){
                    let nodes = await nodesDB.find({chainId:blockchain.chainId}, {limit:10})
                    for(let j = 0; j < nodes.length; j++){
                        let node = nodes[j]
                        output.push(node)
                    }
                }
            }

            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }


    /*
     * ATLAS
     *
     *    Get all live blockchains
     *
     * */
    @Get('/atlas/search/blockchains/{blockchain}')
    public async searchByBlockchainName(blockchain:string) {
        let tag = TAG + " | searchByBlockchainName | "
        try{
            //TODO sanitize
            //look for direct match
            let directMatch = await blockchainsDB.findOne({ "name": blockchain })
            let directMatchChainId = await blockchainsDB.findOne({ "chainId": parseInt(blockchain) })
            if(directMatchChainId) directMatch = directMatchChainId
            log.info(tag,"directMatch: ",directMatch)
            let blockchainInfo
            if(!directMatch){
                directMatch = await blockchainsDB.findOne({ $or: [{ "blockchain": blockchain },{ "name": blockchain }] })
                log.info("No direct match found!")
                if(!directMatch){
                    //if miss then look for partial match
                    let escapeRegex = function (text) {
                        return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                    };
                    //TODO sanitize
                    const regex = new RegExp(escapeRegex(blockchain) + ".*", 'gi');
                    //Get tracked networks
                    log.info("regex: ",regex)
                    blockchainInfo = await blockchainsDB.find({ "blockchain": regex },{limit:10})[0]
                    if(!blockchainInfo){
                        log.info("No REGEX match found on name!")
                        blockchainInfo = await blockchainsDB.find({ "blockchain": regex },{limit:10})[0]
                        if(!blockchainInfo){
                            log.info("No REGEX match found on blockchain!")
                            blockchainInfo = await blockchainsDB.find({ "symbol": regex },{limit:10})[0]
                        }
                    }
                } else {
                    blockchainInfo = directMatch
                }
            } else {
                blockchainInfo = directMatch
            }
            return blockchainInfo
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
        Search by Dapp Name

     */
    @Get('/atlas/search/dapps/{name}')
    public async searchDappsByName(name:string) {
        let tag = TAG + " | searchDappsByName | "
        try{
            //TODO sanitize
            //look for direct match
            let directMatch = await dappsDB.findOne({ "name": name })
            log.info(tag,"directMatch: ",directMatch)
            let dappInfo
            if(!directMatch){
                directMatch = await dappsDB.findOne({ $or: [{ "app": name },{ "name": name }] })
                log.info("No direct match found!")
                if(!directMatch){
                    const escapeRegex = function (text) {
                        return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                    };

                    const regex = new RegExp(escapeRegex(name), 'gi');
                    console.log("regex: ", regex); // Use console.log instead of log.info for debugging

                    // Use the regex to search for documents in the collection.
                    dappInfo = await dappsDB.find({ name: regex });
                    console.log("dappInfo", dappInfo);

                    if(dappInfo.length === 0){
                        log.info("No REGEX match found on name!")
                        dappInfo = await dappsDB.find({ "name": regex },{limit:10})
                        if(!dappInfo.length){
                            log.info("No REGEX match found on description!")
                            dappInfo = await dappsDB.find({ "description": regex },{limit:10})
                        }
                    }
                } else {
                    dappInfo = directMatch
                }
            } else {
                dappInfo = directMatch
            }
            return dappInfo
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }


    /*
     * CHART Dapp
     *
     *    Build an atlas on a new Dapp
     *
     * */
    @Post('atlas/dapp/chart')
    public async chartDapp(@Body() body: any): Promise<any> {
        let tag = TAG + " | chartDapp | "
        try{
            log.debug(tag,"chartDapp: ",body)
            if(!body.name) throw Error("Name is required!")
            if(!body.app) throw Error("app is required!")
            if(!body.tags) throw Error("tags is required!")
            if(!body.image) throw Error("image is required!")
            if(!body.signer) throw Error("signer address is required!")
            if(!body.signature) throw Error("signature is required!")
            if(!body.payload) throw Error("payload is required!")
            if(!body.protocols) throw Error("protocols is required!")
            if(!body.blockchains) throw Error("blockchains is required!")
            if(!body.features) throw Error("features is required!")
            if(!body.description) throw Error("description is required!")
            let dapp:any = {
                name:body.name.toLowerCase(),
                app:body.app,
                tags:body.tags,
                image:body.image,
                description:body.description,
                developer:body.developer,
                features:body.features,
                protocols:body.protocols,
                blockchains:body.blockchains,
                facts:[
                    {
                        signer:body.signer,
                        payload:body.payload,
                        signature:body.signature,
                    }
                ]
            }
            if(body.minVersion) dapp.minVersion = body.minVersion
            if(body.description) dapp.description = body.description
            if(body.homepage) dapp.homepage = body.homepage
            if(body.explorer) dapp.explorer = body.explorer
            if(body.id) {
                dapp.id = body.id
                dapp.tags.push(body.id)
            }

            dapp.isSpotlight = false
            dapp.whitelist = false

            //defaults
            dapp.id = uuid.generate()
            dapp.created = new Date().getTime()
            dapp.trust = 0
            dapp.transparency = 0
            dapp.innovation = 0
            dapp.popularity = 0

            let output:any = {}
            try{
                let resultSave = await dappsDB.insert(dapp)
                output.result = resultSave
            }catch(e){
                output.error = true
                output.e = e.toString()
            }
            output.success = true
            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }


    /*
     * CHART
     *
     *    Build an atlas on a new EVM network
     *
     * */
    @Post('atlas/asset/chart')
    public async chartAsset(@Body() body: any): Promise<any> {
        let tag = TAG + " | chartAsset | "
        try{
            log.debug(tag,"chartAsset: ",body)
            if(!body.type) throw Error("type is required!")
            if(!body.name) throw Error("Name is required!")
            if(!body.symbol) throw Error("symbol is required!")
            if(!body.tags) throw Error("tags is required!")
            if(!body.decimals) throw Error("decimals is required!")
            if(!body.image) throw Error("image is required!")
            if(!body.signer) throw Error("signer is required!")
            if(!body.signature) throw Error("signature is required!")
            if(!body.payload) throw Error("payload is required!")
            if(!body.blockchain) throw Error("blockchain is required!")
            if(!body.caip) throw Error("caip is required!")
            let asset:any = {
                name:body.name.toLowerCase(),
                type:body.type,
                caip:body.caip.toLowerCase(),
                tags:body.tags,
                blockchain:body.blockchain.toLowerCase(),
                symbol:body.symbol,
                decimals:body.decimals,
                image:body.image,
                facts:[
                    {
                        signer:body.signer,
                        payload:body.payload,
                        signature:body.signature,
                    }
                ]
            }
            if(body.chainId) asset.chainId = body.chainId
            if(body.description) asset.description = body.description
            if(body.website) asset.website = body.website
            if(body.nativeCurrency) asset.nativeCurrency = body.nativeCurrency
            if(body.explorer) asset.explorer = body.explorer
            if(body.explorerAddressLink) asset.explorerAddressLink = body.explorerAddressLink
            if(body.explorerTxLink) asset.explorerTxLink = body.explorerTxLink
            if(body.id) {
                asset.id = body.id
                asset.tags.push(body.id)
            }

            let output:any = {}
            try{
                output = await assetsDB.insert(asset)
            }catch(e){
                output.error = true
                output.e = e.toString()
            }

            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * CHART
     *
     *    Build an atlas on a new network
     *
     * */
    @Post('atlas/blockchain/chart')
    public async chartBlockchain(@Body() body: any): Promise<any> {
        let tag = TAG + " | chartBlockchain | "
        try{
            log.debug(tag,"chartBlockchain: ",body)
            if(!body.name) throw Error("Name is required!")
            if(!body.type) throw Error("type is required!")
            if(!body.image) throw Error("image is required!")
            if(!body.tags) throw Error("tags is required!")
            if(!body.symbol) throw Error("symbol is required!")
            if(!body.chain) throw Error("chain is required!")
            if(!body.explorer) throw Error("explorer is required!")
            if(!body.description) throw Error("description is required!")
            if(!body.explorer) throw Error("explorer is required!")
            if(!body.caip) throw Error("caip is required!")
            if(!body.blockchain) throw Error("blockchain is required!")
            if(!body.signer) throw Error("signer address is required!")
            if(!body.signature) throw Error("signature is required!")
            if(!body.payload) throw Error("signature is required!")
            if(!body.feeAssetCaip) throw Error("feeAssetCaip is required!")
            if(!body.feeAssetName) throw Error("feeAssetName is required!")
            if(!body.feeAssetSymbol) throw Error("feeAssetSymbol is required!")
            let blockchain:any = {
                name:body.name.toLowerCase(),
                type:body.type,
                image:body.image,
                tags:body.tags,
                caip:body.caip,
                isCharted: false,
                blockchain:body.blockchain,
                symbol:body.symbol,
                service:body.service,
                chainId:body.chainId,
                network:body.network || body.symbol,
                feeAssetCaip:body.feeAssetCaip,
                feeAssetName:body.feeAssetName,
                feeAssetSymbol:body.feeAssetSymbol,
                feeAssetRank:body.feeAssetRank || 999999,
                facts:[
                    {
                        signer:body.signer,
                        payload:body.payload,
                        signature:body.signature,
                    }
                ]
            }
            if(body.research) blockchain.research = body.research
            if(body.explorer) blockchain.explorer = body.explorer
            if(body.links) blockchain.links = body.links
            if(body.decimals) blockchain.decimals = body.decimals
            if(body.description) blockchain.description = body.description
            if(body.faucets) blockchain.faucets = body.faucets

            let output:any = {}
            try{
                let query = { blockchain: blockchain.blockchain };
                let update = { $set: blockchain };
                let options = { upsert: true };

                output = await blockchainsDB.update(query, update, options)
            }catch(e){
                output.error = true
                output.e = e.toString()
            }

            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * Submit
     *
     *    Build an atlas on a new network
     *
     * */
    @Post('atlas/node/submit')
    public async chartNode(@Body() body: any): Promise<any> {
        let tag = TAG + " | chartNode | "
        try{
            log.debug(tag,"mempool tx: ",body)
            //if(body.type !== 'EVM') throw Error("Network Type Not Supported!")
            if(!body.name) throw Error("Name is required!")
            if(!body.type) throw Error("type is required!")
            if(!body.tags) throw Error("tags is required!")
            if(!body.image) throw Error("image is required!")
            if(!body.chain) throw Error("chain is required!")
            if(!body.service) throw Error("service is required!")
            if(!body.signer) throw Error("signer address is required!")
            if(!body.signature) throw Error("signature is required!")
            if(!body.payload) throw Error("signature is required!")
            if(!body.caip) throw Error("caip is required!")
            let evmNetwork:any = {
                name:body.name,
                type:body.type,
                tags:body.tags,
                caip:body.caip,
                image:body.image,
                blockchain:body.name.toLowerCase(),
                symbol:body.chain.toUpperCase(),
                service:body.service,
                chainId:body.chainId,
                network:body.rpc,
                facts:[
                    {
                        signer:body.signer,
                        payload:body.payload,
                        signature:body.signature,
                    }
                ]
            }
            if(body.websocket) evmNetwork.websocket = body.websocket
            if(body.swagger) evmNetwork.swagger = body.swagger
            if(body.infoURL) evmNetwork.infoURL = body.infoURL
            if(body.shortName) evmNetwork.shortName = body.shortName
            if(body.nativeCurrency) evmNetwork.nativeCurrency = body.nativeCurrency
            if(body.faucets) evmNetwork.faucets = body.faucets
            if(body.faucets) evmNetwork.faucets = body.faucets

            let output:any = {}
            try{
                let query = { service: evmNetwork.service };
                let update = { $set: evmNetwork };
                let options = { upsert: true };

                output = await nodesDB.update(query, update, options)
            }catch(e){
                output.error = true
                output.e = e.toString()
            }

            return output
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
     * CHART
     *
     *    Build an atlas on a contract
     *
     * */
    @Post('atlas/contract/chart')
    public async chart(@Body() body: Chart): Promise<any> {
        let tag = TAG + " | pushTx | "
        try{
            log.debug(tag,"mempool tx: ",body)
            let output:any = {}
            //create queueId
            let queueId = uuid.generate()
            output.queueId = queueId

            //add contract pubkey to work
            //TODO type Chart
            let work:any = {
                symbol: body.network,
                network: body.network,
                queueId,
                type:"contract",
                tags:body.tags,
                username: body.contractName,
                context: "contract:"+body.contractName,
                pubkey: body.pubkey,
                charted: new Date().getTime()
            }

            //save to queue
            output.result = await queue.createWork("pioneer:pubkey:ingest",work)

            //track
            let savedRedis = await redis.hmset(body.pubkey.toLowerCase(),work)
            output.savedRedis = savedRedis

            return(output);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    update
 */
    @Post('/node/update')
    //CreateAppBody
    public async updateNode(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | updateApp | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)

            message = JSON.parse(message)
            if(!message.service) throw Error("Ivalid message missing service")
            if(!message.key) throw Error("Ivalid message missing key")
            if(!message.value) throw Error("Ivalid message missing value")
            let resultWhitelist:any = {}

            //get entry for name
            let entry = await nodesDB.findOne({service:message.service})

            if(addressFromSig === ADMIN_PUBLIC_ADDRESS) {
                delete message["_id"]
                resultWhitelist = await nodesDB.update({service:message.service},{$set:{[message.key]:message.value}})
                log.debug(tag,"resultWhitelist: ",resultWhitelist)
            } else if(addressFromSig === entry.developer){
                resultWhitelist = await nodesDB.update({service:message.service},{$set:{[message.key]:message.value}})
                log.debug(tag,"resultWhitelist: ",resultWhitelist)
            } else {
                //get fox balance of address
                let work:any = {}
                let queueId = uuid.generate()
                work.queueId = queueId
                work.payload = body
                resultWhitelist.success = true
                resultWhitelist.message = 'Address '+addressFromSig+' voted to update app '+message.name+' in the dapp store!'
                resultWhitelist.result = await queue.createWork("pioneer:facts:ingest",work)
            }


            return(resultWhitelist);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
        update
     */
    @Post('/blockchain/update')
    //CreateAppBody
    public async updateBlockchain(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | updateApp | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)

            message = JSON.parse(message)
            if(!message.blockchain) throw Error("Ivalid message missing blockchain")
            if(!message.key) throw Error("Ivalid message missing key")
            if(!message.value) throw Error("Ivalid message missing value")
            let resultWhitelist:any = {}

            //get entry for name
            let entry = await blockchainsDB.findOne({blockchain:message.blockchain})

            if(addressFromSig === ADMIN_PUBLIC_ADDRESS) {
                delete message["_id"]
                resultWhitelist = await nodesDB.update({blockchain:message.blockchain},{$set:{[message.key]:message.value}})
                log.debug(tag,"resultWhitelist: ",resultWhitelist)
            } else if(addressFromSig === entry.developer){
                resultWhitelist = await nodesDB.update({blockchain:message.blockchain},{$set:{[message.key]:message.value}})
                log.debug(tag,"resultWhitelist: ",resultWhitelist)
            } else {
                //get fox balance of address
                let work:any = {}
                let queueId = uuid.generate()
                work.queueId = queueId
                work.payload = body
                resultWhitelist.success = true
                resultWhitelist.message = 'Address '+addressFromSig+' voted to update app '+message.name+' in the dapp store!'
                resultWhitelist.result = await queue.createWork("pioneer:facts:ingest",work)
            }


            return(resultWhitelist);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    update
 */
    @Post('/asset/update')
    //CreateAppBody
    public async updateAsset(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | updateAsset | "
        try{
            let output:any = {}
            log.debug(tag,"body: ",body)
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)

            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.key) throw Error("Ivalid message missing key")
            if(!message.value) throw Error("Ivalid message missing value")
            let resultWhitelist:any = {}

            //get entry for name
            let entryMongo = await assetsDB.findOne({name:message.name})

            let allPioneers = await networkEth.getAllPioneers()
            let pioneers = allPioneers.owners
            log.info(tag,"pioneers: ",pioneers)
            for(let i=0;i<pioneers.length;i++){
                pioneers[i] = pioneers[i].toLowerCase()
            }
            if(pioneers.indexOf(addressFromSig.toLowerCase()) >= 0) {
                //update the Asset
                if(message.key === "name"){
                    //add old name to aliases
                    let aliases = entryMongo.aliases || []
                    aliases.push(entryMongo.name)
                    aliases.push(message.value)

                    //update aliases
                    let saveAliasesResult = await assetsDB.update({ name: message.name }, { $set: { aliases } })
                    log.info("saveAliasesResult: ",saveAliasesResult)
                    output.saveAliasesResult = saveAliasesResult
                }
                //TODO tags, if tag, simply add to array
                if(message.key === "tag"){
                    //add old name to aliases
                    let tags = entryMongo.tags || []
                    tags.push(message.value)
                    //update aliases
                    let saveAliasesResult = await assetsDB.update({ name: message.name }, { $set: { tags } })
                    log.info("saveAliasesResult: ",saveAliasesResult)
                    output.saveAliasesResult = saveAliasesResult
                } else {
                    //TODO this is kinda not readable, but it works
                    //Everything that is NOT a tag update in mongo
                    let saveNamesResult = await assetsDB.update({ name: message.name }, { $set: { [message.key]: message.value } })
                    log.info("saveNamesResult: ",saveNamesResult)
                    output.saveNamesResult = saveNamesResult
                }
            } else {
                output.error = "user is not a pioneer!"
                output.success = false
            }


            return(output);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }

    /*
    update
    */
    @Post('/asset/delete')
    //CreateAppBody
    public async deleteAsset(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | deleteAsset | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)
            log.info(tag,"message: ",message)
            log.info(tag,"message: ",typeof(message))
            message = JSON.parse(message)
            if(!message.app) throw Error("Ivalid message missing app")

            let allPioneers = await networkEth.getAllPioneers()
            let pioneers = allPioneers.owners
            log.info(tag,"pioneers: ",pioneers)
            for(let i=0;i<pioneers.length;i++){
                pioneers[i] = pioneers[i].toLowerCase()
            }
            let resultRevoke:any = {}
            console.log("index: ",pioneers.indexOf(addressFromSig.toLowerCase()))
            log.info(tag,"pioneers: ",pioneers[0])
            log.info(tag,"pioneers: ",pioneers[1])
            log.info(tag,"pioneers: ",addressFromSig.toLowerCase())

            if(pioneers.indexOf(addressFromSig.toLowerCase()) >= 0) {
                resultRevoke.result = await assetsDB.remove({name:message.app})
                resultRevoke.success = true
                log.debug(tag,"resultWhitelist: ",resultRevoke)
            } else {
                //get fox balance of address
                resultRevoke.error = "user is not a pioneer!"
                resultRevoke.success = false
            }

            return(resultRevoke);
        }catch(e){
            let errorResp:Error = {
                success:false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error",503,"error: "+e.toString());
        }
    }
}
