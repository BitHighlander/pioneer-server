/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis} = require('@pioneer-platform/default-redis')

//TODO if no mongo use nedb?
//https://github.com/louischatriot/nedb

let connection  = require("@pioneer-platform/default-mongo")
let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let txsRawDB = connection.get('transactions-raw')
let devsDB = connection.get('developers')

txsDB.createIndex({txid: 1}, {unique: true})
txsRawDB.createIndex({txhash: 1}, {unique: true})
devsDB.createIndex({username: 1}, {unique: true})

//globals

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';

import {
    Error,
    CreateAppBody
} from "@pioneer-platform/pioneer-types";


export class ApiError extends Error {
    private statusCode: number;
    constructor(name: string, statusCode: number, message?: string) {
        super(message);
        this.name = name;
        this.statusCode = statusCode;
    }
}

//route
@Tags('App Store Endpoints')
@Route('')
export class XDevsController extends Controller {

    /*
        Create

     */

    @Post('/devs/create')
    //CreateAppBody
    public async createDeveloper(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | transactions | "
        try{
            let success = devsDB.insert(body)
            return(success);
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
        read
    */

    @Get('/devs')
    public async listDevelopers() {
        let tag = TAG + " | listDeveloper | "
        try{
            let apps = devsDB.find()
            return(apps)
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
