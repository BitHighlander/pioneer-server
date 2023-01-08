/*

    Pioneer REST endpoints



 */
import {bufferToHex} from "ethereumjs-util";

let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
const midgard = require("@pioneer-platform/midgard-client")
const uuid = require('short-uuid');
const queue = require('@pioneer-platform/redis-queue');
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
nodesDB.createIndex({service: 1}, {unique: true})
usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
assetsDB.createIndex({name: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

//rest-ts
import {Body, Controller, Get, Header, Post, Route, Tags} from 'tsoa';
import {recoverPersonalSignature} from "eth-sig-util";

interface Network {
    network: string;
    symbol?: string;
    pioneer?: string;
    type: string;
    tags: any;
    pubkey: string;
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
            log.info(tag,"assets: ",assets.length)
            log.info(tag,"assets: ",assets[0])

            //seed market data
            let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
            marketCacheCoinGecko = JSON.parse(marketCacheCoinGecko)
            log.info(tag,"marketCacheCoinGecko: ",marketCacheCoinGecko['BTC'])
            let usedSymbold = []
            for(let i = 0; i < assets.length; i++){
                //NOTE this sucks because it assumes symbol matchs
                let asset = assets[i]
                log.info(tag,"asset: ",asset)
                let symbol = asset.symbol.toUpperCase()
                log.info(tag,"symbol: ",symbol)
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
    @Get('/atlas/blockchains/list/{limit}/{skip}')
    public async searchBlockchainsPageniate(limit:number,skip:number) {
        let tag = TAG + " | searchBlockchainsPageniate | "
        try{

            let output = []
            //blockchains Supported by keepkey
            let blockchains = await blockchainsDB.find({tags:{$all:['KeepKeySupport']}})
            log.info(tag,"blockchains: ",blockchains.length)
            log.info(tag,"blockchains: ",blockchains[0])

            //seed market data
            let marketCacheCoinGecko = await redis.get('markets:CoinGecko')
            marketCacheCoinGecko = JSON.parse(marketCacheCoinGecko)
            log.info(tag,"marketCacheCoinGecko: ",marketCacheCoinGecko['BTC'])
            let usedSymbold = []
            for(let i = 0; i < blockchains.length; i++){
                //NOTE this sucks because it assumes symbol matchs
                let asset = blockchains[i]
                log.info(tag,"asset: ",asset)
                let symbol = asset.symbol.toUpperCase()
                log.info(tag,"symbol: ",symbol)
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
     *    Get all live atlas
     *
     * */
    @Get('/atlas/dapps/list/{limit}/{skip}')
    public async searchDappsPageniate(limit:number,skip:number) {
        let tag = TAG + " | searchDappsPageniate | "
        try{
            log.info(tag,{limit,skip})
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
            log.info(tag,"developer: ",developer)

            developer = developer.toLowerCase()
            log.info(tag,"developer: ",developer)
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
    @Get('/atlas/list/asset/{tagString}')
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
            log.info(tag,"marketCacheCoinGecko: ",marketCacheCoinGecko['BTC'])
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
            log.info(tag,"marketCacheCoinGecko: ",marketCacheCoinGecko['BTC'])
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

    /*
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

    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/list/asset/{limit}/{skip}')
    public async searchAssetsList(limit:number,skip:number) {
        let tag = TAG + " | searchAssetsList | "
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

    /*
     * ATLAS
     *
     *    Get all live atlas
     *
     * */
    @Get('/atlas/list/asset/{symbol}')
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
            let cache = await redis.get("cache:network:top:"+start+":"+stop)
            //console.log(cache)
            if(!cache){
                for(let i = start; i < stop; i++){
                    let entry = await nodesDB.find({chainId:i},{limit})
                    for(let j = 0; j < entry.length; j++){
                        let server = entry[j]
                        if(entry)output.push(server)
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
     *    Get all live blockchains
     *
     * */
    @Get('/atlas/search/nodes/blockchains/{blockchain}')
    public async SearchByNetworkName(blockchain:string) {
        let tag = TAG + " | SearchByNetworkName | "
        try{
            //TODO sanitize
            let output = []
            let escapeRegex = function (text) {
                return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            };

            //TODO sanitize
            const regex = new RegExp(escapeRegex(blockchain), 'gi');
            //Get tracked networks
            let blockchains = await blockchainsDB.find({ "name": regex },{limit:10})

            for(let i = 0; i < blockchains.length; i++){
                let blockchain = blockchains[i]

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
        let tag = TAG + " | atlas | "
        try{
            //TODO sanitize

            let escapeRegex = function (text) {
                return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            };

            //TODO sanitize
            const regex = new RegExp(escapeRegex(blockchain), 'gi');
            //Get tracked networks
            let networks = await blockchainsDB.find({ "name": regex },{limit:10})

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
     * CHART Dapp
     *
     *    Build an atlas on a new Dapp
     *
     * */
    @Post('atlas/dapp/chart')
    public async chartDapp(@Body() body: any): Promise<any> {
        let tag = TAG + " | chartDapp | "
        try{
            log.debug(tag,"mempool tx: ",body)
            if(!body.name) throw Error("Name is required!")
            if(!body.app) throw Error("app is required!")
            if(!body.tags) throw Error("tags is required!")
            if(!body.image) throw Error("decimals is required!")
            if(!body.signer) throw Error("signer address is required!")
            if(!body.signature) throw Error("signature is required!")
            if(!body.payload) throw Error("payload is required!")
            if(!body.protocols) throw Error("protocols is required!")
            if(!body.blockchains) throw Error("blockchains is required!")
            let dapp:any = {
                name:body.name.toLowerCase(),
                app:body.app,
                tags:body.tags,
                image:body.image,
                developer:body.developer,
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
                output = await dappsDB.insert(dapp)
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
     *    Build an atlas on a new EVM network
     *
     * */
    @Post('atlas/asset/chart')
    public async chartAsset(@Body() body: any): Promise<any> {
        let tag = TAG + " | chartAsset | "
        try{
            log.debug(tag,"mempool tx: ",body)
            if(!body.type) throw Error("type is required!")
            if(!body.name) throw Error("Name is required!")
            if(!body.symbol) throw Error("symbol is required!")
            if(!body.tags) throw Error("tags is required!")
            if(!body.decimals) throw Error("decimals is required!")
            if(!body.image) throw Error("decimals is required!")
            if(!body.signer) throw Error("signer is required!")
            if(!body.signature) throw Error("signature is required!")
            if(!body.payload) throw Error("signature is required!")
            let asset:any = {
                name:body.name.toLowerCase(),
                type:body.type,
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
            log.debug(tag,"mempool tx: ",body)
            if(!body.name) throw Error("Name is required!")
            if(!body.type) throw Error("type is required!")
            if(!body.image) throw Error("image is required!")
            if(!body.tags) throw Error("tags is required!")
            if(!body.symbol) throw Error("symbol is required!")
            if(!body.chain) throw Error("chain is required!")
            if(!body.explorer) throw Error("explorer is required!")
            if(!body.description) throw Error("description is required!")
            if(!body.explorer) throw Error("explorer is required!")
            if(!body.blockchain) throw Error("blockchain is required!")
            if(!body.signer) throw Error("signer address is required!")
            if(!body.signature) throw Error("signature is required!")
            if(!body.payload) throw Error("signature is required!")
            let blockchain:any = {
                name:body.name,
                type:body.type,
                image:body.image,
                tags:body.tags,
                blockchain:body.blockchain,
                symbol:body.symbol,
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
            if(body.research) blockchain.research = body.research
            if(body.explorer) blockchain.explorer = body.explorer
            if(body.links) blockchain.links = body.links
            if(body.decimals) blockchain.decimals = body.decimals
            if(body.description) blockchain.description = body.description
            if(body.faucets) blockchain.faucets = body.faucets

            let output:any = {}
            try{
                output = await blockchainsDB.insert(blockchain)
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
            if(body.type !== 'EVM') throw Error("Network Type Not Supported!")
            if(!body.name) throw Error("Name is required!")
            if(!body.type) throw Error("type is required!")
            if(!body.tags) throw Error("tags is required!")
            if(!body.image) throw Error("image is required!")
            if(!body.chain) throw Error("chain is required!")
            if(!body.service) throw Error("service is required!")
            if(!body.signer) throw Error("signer address is required!")
            if(!body.signature) throw Error("signature is required!")
            if(!body.payload) throw Error("signature is required!")
            let evmNetwork:any = {
                name:body.name,
                type:body.type,
                tags:body.tags,
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
            if(body.infoURL) evmNetwork.infoURL = body.infoURL
            if(body.shortName) evmNetwork.shortName = body.shortName
            if(body.nativeCurrency) evmNetwork.nativeCurrency = body.nativeCurrency
            if(body.faucets) evmNetwork.faucets = body.faucets
            if(body.faucets) evmNetwork.faucets = body.faucets

            let output:any = {}
            try{
                output = await nodesDB.insert(evmNetwork)
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
            log.info(tag,"body: ",body)
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.info(tag,"addressFromSig: ",addressFromSig)

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
                log.info(tag,"resultWhitelist: ",resultWhitelist)
            } else if(addressFromSig === entry.developer){
                resultWhitelist = await nodesDB.update({service:message.service},{$set:{[message.key]:message.value}})
                log.info(tag,"resultWhitelist: ",resultWhitelist)
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
            log.info(tag,"body: ",body)
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.info(tag,"addressFromSig: ",addressFromSig)

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
                log.info(tag,"resultWhitelist: ",resultWhitelist)
            } else if(addressFromSig === entry.developer){
                resultWhitelist = await nodesDB.update({blockchain:message.blockchain},{$set:{[message.key]:message.value}})
                log.info(tag,"resultWhitelist: ",resultWhitelist)
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
        let tag = TAG + " | updateApp | "
        try{
            log.info(tag,"body: ",body)
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.info(tag,"addressFromSig: ",addressFromSig)

            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.key) throw Error("Ivalid message missing key")
            if(!message.value) throw Error("Ivalid message missing value")
            let resultWhitelist:any = {}

            //get entry for name
            let entry = await assetsDB.findOne({name:message.name})

            if(addressFromSig === ADMIN_PUBLIC_ADDRESS) {
                delete message["_id"]
                resultWhitelist = await assetsDB.update({name:message.name},{$set:{[message.key]:message.value}})
                log.info(tag,"resultWhitelist: ",resultWhitelist)
            } else if(addressFromSig === entry.developer){
                resultWhitelist = await assetsDB.update({name:message.name},{$set:{[message.key]:message.value}})
                log.info(tag,"resultWhitelist: ",resultWhitelist)
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
}
