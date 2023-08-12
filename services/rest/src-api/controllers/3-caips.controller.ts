/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
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
let assetsDB = connection.get('assets')
let blockchainsDB = connection.get('blockchains')
let nodesDB = connection.get('nodes')
usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';
// import * as express from 'express';


//route
@Tags('Streams Endpoints')
@Route('')
export class caipsController extends Controller {

    /*
     * CAIPS
     *
     *    get assets by CAIP
     *
     * */
    @Get('/assetBySymbol/{symbol}')
    public async getAsset(symbol:string) {
        let tag = TAG + " | getAsset | "
        try{
            symbol = symbol.toUpperCase()
            log.debug(tag,"address: ",symbol)
            //Get tracked assets
            let assets = await assetsDB.find({symbol})
            //@TODO use smart filtering to sort by most popular
            return(assets)
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

    @Get('/assetByString/{name}')
    public async assetByString(name:string) {
        let tag = TAG + " | assetByString | "
        try{
            name = name.toLowerCase()
            log.debug(tag,"name: ",name)
            // Get tracked assets with fuzzy search
            let assets = await assetsDB.find({
                $or: [
                    { name: { $regex: name, $options: 'i' } }, // Search by name
                    { aliases: { $regex: name, $options: 'i' } } // Search by aliases
                ]
            });
            //@TODO use smart filtering to sort by most popular
            return assets;
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

    @Get('/assetByCaip/{caip}')
    public async assetByCaip(caip:string) {
        let tag = TAG + " | assetByCaip | "
        try{
            caip = caip.toLowerCase()
            log.debug(tag,"caip: ",caip)
            // Get tracked assets with fuzzy search
            let assets = await assetsDB.find({caip});
            //@TODO use smart filtering to sort by most popular
            return assets;
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

    @Get('/getBlockchainByName/{name}')
    public async getBlockchainByName(name:string) {
        let tag = TAG + " | getBlockchainByName | "
        try{
            name = name.toLowerCase()
            log.debug(tag,"name: ",name)
            // Get tracked blockchains
            let blockchains = await blockchainsDB.find({ name });
            //@TODO use smart filtering to sort by most popular
            return blockchains;
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

    @Get('/getBlockchainByChainId/{chainId}')
    public async getBlockchainByChainId(chainId:any) {
        let tag = TAG + " | getBlockchainByChainId | "
        try{
            log.debug(tag,"address: ",chainId)
            if(typeof(chainId) === 'string') chainId = parseInt(chainId)
            // Get tracked blockchains
            let blockchains = await blockchainsDB.find({ chainId });
            //@TODO use smart filtering to sort by most popular
            return blockchains;
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

    @Get('/blockchainBySymbol/{symbol}')
    public async getBlockchainBySymbol(symbol:string) {
        let tag = TAG + " | getBlockchainBySymbol | "
        try{
            symbol = symbol.toUpperCase()
            log.debug(tag,"address: ",symbol)
            // Get tracked blockchains
            let blockchains = await blockchainsDB.find({ symbol });
            //@TODO use smart filtering to sort by most popular
            return blockchains;
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

    @Get('/blockchainByCaip/{caip}')
    public async blockchainByCaip(caip:string) {
        let tag = TAG + " | blockchainByCaip | "
        try{
            caip = caip.toLowerCase()
            log.debug(tag,"caip: ",caip)
            // Get tracked assets with fuzzy search
            let blockchain = await blockchainsDB.find({caip});
            //@TODO use smart filtering to sort by most popular
            return blockchain;
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

    @Get('/blockchainByString/{name}')
    public async blockchainByString(name:string) {
        let tag = TAG + " | blockchainByString | "
        try{
            name = name.toLowerCase()
            log.debug(tag,"name: ",name)
            // Get tracked blockchains with fuzzy search
            let blockchains = await blockchainsDB.find({
                name: {
                    $regex: name,
                    $options: 'i'
                }
            });
            //@TODO use smart filtering to sort by most popular
            return blockchains;
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

    //nodes by caip
    @Get('/nodesByCaip/{caip}')
    public async nodesByCaip(caip:string) {
        let tag = TAG + " | nodesByCaip | "
        try{
            caip = caip.toLowerCase()
            log.debug(tag,"caip: ",caip)
            // Get tracked assets with fuzzy search
            let nodes = await nodesDB.find({caip});
            //@TODO use smart filtering to sort by most popular
            return nodes;
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

    //dapps by caip (supported)

    //TODO
    //knowledge by caip (related)

}
