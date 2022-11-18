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
let appsDB = connection.get('apps')

txsDB.createIndex({txid: 1}, {unique: true})
txsRawDB.createIndex({txhash: 1}, {unique: true})
appsDB.createIndex({homepage: 1}, {unique: true})
appsDB.createIndex({id: 1}, {unique: true})

//globals
const ADMIN_PUBLIC_ADDRESS = process.env['ADMIN_PUBLIC_ADDRESS']
if(!ADMIN_PUBLIC_ADDRESS) throw Error("Invalid ENV missing ADMIN_PUBLIC_ADDRESS")

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
export class WAppsController extends Controller {

    /*
        read
    */

    @Get('/apps')
    public async listApps() {
        let tag = TAG + " | health | "
        try{
            let apps = appsDB.find({whitelist:true})
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

    /*
        read
    */

    @Get('/apps/{developer}')
    public async listAppsByDeveloper(developer:any) {
        let tag = TAG + " | listAppsByDeveloper | "
        try{
            let apps = appsDB.find({whitelist:true})
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

    /*
        TODO
        update
     */

    /*
        TODO
        destroy
     */

    /*
    Create

 */

    @Post('/apps/create')
    //CreateAppBody
    public async createApp(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | transactions | "
        try{
            log.info(tag,"body: ",body)
            log.info(tag,"authorization: ",authorization)
            if(!authorization && !body.authorization) throw Error("authorization required!")
            if(!authorization) authorization = body.authorization

            //validate auth
            let authInfo = await redis.hgetall(authorization)
            log.info(tag,"authInfo: ",authInfo)
            if(!authInfo) throw Error("invalid token!")

            let publicAddress = authInfo.publicAddress
            if(!publicAddress) throw Error("invalid auth key info!")

            //validate input
            let homepage = body.homepage
            let appName = body.name
            let image = body.image


            let entry:any = {
                homepage,
                appName,
                image
            }

            //defaults
            entry.whitelist = false
            if(publicAddress === ADMIN_PUBLIC_ADDRESS) {
                entry.whitelist = true
            } else {
                log.info(tag,"not an admin! given:"+publicAddress+" expected: "+ADMIN_PUBLIC_ADDRESS)
            }

            //defaults
            entry.trust = 0
            entry.transparency = 0
            entry.innovation = 0
            entry.popularity = 0
            entry.uploader = [publicAddress]
            entry.developers = []
            entry.blockchains = ['ethereum']
            entry.protocol  = ['wallet-connect-v1']
            entry.version = "wc-1"
            entry.description = "app name is "+appName
            entry.tags = ['ethereum']
            console.log(entry)
            let success = appsDB.insert(entry)

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


}
