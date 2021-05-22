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

//globals

//modules

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';
import * as express from 'express';

//import { User, UserCreateRequest, UserUpdateRequest } from '../models/user';

//types
interface Error {
    success:boolean
    tag:string
    e:any
}

interface Health {
    online:boolean
    name:string
    version:string
    system:any
    hostname:string,
    uptime:any,
    loadavg:any
}

// interface Health {
//   online:boolean
//   name:string
//   version:string
//   system:any
// }

export class ApiError extends Error {
    private statusCode: number;
    constructor(name: string, statusCode: number, message?: string) {
        super(message);
        this.name = name;
        this.statusCode = statusCode;
    }
}

//route
@Tags('Status Endpoints')
@Route('')
export class IndexController extends Controller {

    //remove api key


    /*
        Health endpoint
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
}
