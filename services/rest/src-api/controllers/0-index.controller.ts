/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis} = require('@pioneer-platform/default-redis')
// let client = require("@pioneer-platform/cosmos-network")
// let connection  = require("@pioneer-platform/mongo-default-env")
//
// let usersDB = connection.get('users')
// let txsDB = connection.get('transactions')
// let txsRawDB = connection.get('transactions-raw')
const axios = require('axios')
const short = require('short-uuid');
const { queryString } = require("object-query-string");
const os = require("os")
let connection  = require("@pioneer-platform/default-mongo")
//globals
let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let txsRawDB = connection.get('transactions-raw')
let devsDB = connection.get('developers')
let dapsDB = connection.get('dapps')
//modules

//rest-ts
import { Controller, Get, Route, Tags } from 'tsoa';
import * as express from 'express';

//import { User, UserCreateRequest, UserUpdateRequest } from '../models/user';

//types
import {
    Health,
    ApiError,
    Error
} from "@pioneer-platform/pioneer-types";

//route
@Tags('Status Endpoints')
@Route('')
export class IndexController extends Controller {

    //remove api key


    /**
     *  Health Endpoint
     *  Gives me the health of the system
     *
     */

    @Get('/health')
    public async health() {
        let tag = TAG + " | health | "
        try{

            let queueStatus:any = await redis.hgetall("info:pioneer")

            let output:Health = {
                online:true,
                hostname:os.hostname(),
                uptime:os.uptime(),
                loadavg:os.loadavg(),
                name:pjson.name,
                version:pjson.version,
                system:queueStatus
            }

            return(output)
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

    @Get('/plugin')
    public async plugin() {
        let tag = TAG + " | plugin | "
        try{

            let output = {
                "schema_version": "v1",
                "name_for_model": "Pioneer",
                "name_for_human": "Pioneer Api",
                "description_for_human": "Explore the world of cryptocurrency. live blockchain information and data.",
                "description_for_model": "pioneer api that give real time blockchain information, lets users register wallets and then query information about their wallets with the pioneer api. ",
                "api": {
                    "type": "openapi",
                    "url": "https://pioneers.dev/spec/swagger.json",
                    "has_user_authentication": false
                },
                "auth": {
                    "type": "none"
                },
                "logo_url": "https://pioneers.dev/coins/pioneer.png",
                "contact_email": "highlander@keepkey.com",
                "legal_info_url": "pioneers.dev"
            }

            return(output)
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
