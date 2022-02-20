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

usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

const fakeUa = require('fake-useragent');
console.log(fakeUa());

//rest-ts
import { Body, Controller, Get, Post, Route, Tags } from 'tsoa';

const axios = require('axios')
const sdk = require('api')('@opensea/v1.0#jblb1ukzswdj7x');

//route
@Tags('NFT Endpoints')
@Route('')
export class nftPublicController extends Controller {

    /*
     * get bufficorn
     *
     *
     *
     * */
    @Get('/nft/{address}')
    public async getNfts(address:string) {
        let tag = TAG + " | nfts | "
        try{

            let nftTxs = await axios.get("https://api.etherscan.io/api?module=account&action=tokennfttx&address="+address+"&page=1&offset=100&sort=asc&apikey="+process.env['ETHERSCAN_API_KEY'])
            log.info(tag,"nftTxs: ",nftTxs.data)

            let nfts = []
            for(let i = 0; i < nftTxs.data.result.length; i++){
                let nft:any = {}
                let entry = nftTxs.data.result[i]
                log.info(tag,"entry: ",entry)

                let contractAddress = entry.contractAddress
                let tokenID = entry.tokenID
                nft.contractAddress = contractAddress
                nft.tokenID = tokenID

                let url = "https://api.opensea.io/api/v1/asset/"+contractAddress+"/"+tokenID+"?format=json"
                log.info(tag,"url: ",url)

                var headers = {
                    'x-api-key': "",
                    'User-Agent': fakeUa()
                };
                //get openSea info
                let openSeaInfo = await axios.get(url,{
                    headers
                })
                log.info(tag,"openSeaInfo: ",openSeaInfo.data)

                //image
                let imageUrl = openSeaInfo.data.image_original_url
                nft.imageUrl = imageUrl

                //traits
                nft.traits = openSeaInfo.data.traits


                nfts.push(nft)
            }

            return(nfts)
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
