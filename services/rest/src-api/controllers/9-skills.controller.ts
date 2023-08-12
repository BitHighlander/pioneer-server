/*

    Pioneer Skills endpoints



 */
import axios from "axios";

let TAG = ' | Skills | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()

import {
    Error,
    ApiError,
} from "@pioneer-platform/pioneer-types";


let connection  = require("@pioneer-platform/default-mongo")
let skillsDB = connection.get('skills')
skillsDB.createIndex({skillId: 1}, {unique: true})

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
