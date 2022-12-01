/*

    Pioneer REST endpoints



 */
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

let connection  = require("@pioneer-platform/default-mongo")

let usersDB = connection.get('users')
let pubkeysDB = connection.get('pubkeys')
let txsDB = connection.get('transactions')
let invocationsDB = connection.get('invocations')
let utxosDB = connection.get('utxo')
let networksDB = connection.get('networks')

usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

//rest-ts
import { Body, Controller, Get, Post, Route, Tags } from 'tsoa';

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
     *    Get all live atlas
     *
     * */
    @Get('/atlas/list')
    public async atlas() {
        let tag = TAG + " | atlas | "
        try{

            //Get tracked networks
            let networks = await networksDB.find()

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
     * CHART
     *
     *    Build an atlas on a new EVM network
     *
     * */
    @Post('atlas/network/chart')
    public async chartNetwork(@Body() body: any): Promise<any> {
        let tag = TAG + " | pushTx | "
        try{
            log.debug(tag,"mempool tx: ",body)
            if(body.type !== 'EVM') throw Error("Network Type Not Supported!")
            if(!body.name) throw Error("Name is required!")
            if(!body.type) throw Error("type is required!")
            if(!body.tags) throw Error("tags is required!")
            if(!body.chain) throw Error("chain is required!")
            if(!body.rpc) throw Error("rpc is required!")
            let evmNetwork:any = {
                name:body.name,
                type:body.type,
                tags:body.tags,
                blockchain:body.chain,
                chainId:body.chainId,
                network:body.rpc
            }
            if(body.infoURL) evmNetwork.infoURL = body.infoURL
            if(body.shortName) evmNetwork.shortName = body.shortName
            if(body.nativeCurrency) evmNetwork.nativeCurrency = body.nativeCurrency
            if(body.faucets) evmNetwork.faucets = body.faucets
            if(body.faucets) evmNetwork.faucets = body.faucets

            let saveNetwork = await networksDB.insert(evmNetwork)

            return saveNetwork
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
     *    Build an atlas
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

}
