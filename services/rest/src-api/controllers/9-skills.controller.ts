/*

    Pioneer REST endpoints



 */
import axios from "axios";

let TAG = ' | CHANGELLY | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()

import {
    Error,
    ApiError,
    Chart,
} from "@pioneer-platform/pioneer-types";
let Changelly = require('@bithighlander/changelly');
let CHANGELLY_API_KEY = process.env['CHANGELLY_API_KEY']
if(!CHANGELLY_API_KEY) throw new Error('CHANGELLY_API_KEY not set')
let CHANGELLY_API_SECRET = process.env['CHANGELLY_API_SECRET']
if(!CHANGELLY_API_SECRET) throw new Error('CHANGELLY_API_SECRET not set')

let connection  = require("@pioneer-platform/default-mongo")

let usersDB = connection.get('users')
let pubkeysDB = connection.get('pubkeys')
let txsDB = connection.get('transactions')
let invocationsDB = connection.get('invocations')
let utxosDB = connection.get('utxo')
let skillsDB = connection.get('skills')
skillsDB.createIndex({skillId: 1}, {unique: true})
usersDB.createIndex({id: 1}, {unique: true})
usersDB.createIndex({username: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
utxosDB.createIndex({txid: 1}, {unique: true})
pubkeysDB.createIndex({pubkey: 1}, {unique: true})
invocationsDB.createIndex({invocationId: 1}, {unique: true})
txsDB.createIndex({invocationId: 1})

const markets = require('@pioneer-platform/markets')

let blockchains = []
const networks:any = {}
if(process.env['FEATURE_OSMOSIS_BLOCKCHAIN']){
    blockchains.push('osmosis')
    networks['OSMO'] = require('@pioneer-platform/osmosis-network')
}

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, Example } from 'tsoa';
//route
@Tags('Skills Endpoint')
@Route('')
export class pioneerSkillsController extends Controller {

    /*
     * Skills
     *
     *
     *
     * */

    @Get('/skills/info')
    public async skills() {
        let tag = TAG + " | skills | "
        try{

            return true;
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
    //@TODO Skills crud
}
