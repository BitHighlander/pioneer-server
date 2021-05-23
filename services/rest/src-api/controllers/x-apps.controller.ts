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
//appsDB.createIndex({appId: 1}, {unique: true})

//globals

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';

//types
interface Error {
    success:boolean
    tag:string
    e:any
}

interface createAppBody {
    name:string
    image:string
    version:string
    description:string
}

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
export class XAppsController extends Controller {

    /*
        Create

     */

    @Post('/create')
    public async createApp(@Header('Authorization') authorization: string,@Body() body: createAppBody): Promise<any> {
        let tag = TAG + " | transactions | "
        try{
            let success = appsDB.insert(body)
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

    @Get('/apps')
    public async listApps() {
        let tag = TAG + " | health | "
        try{
            let apps = appsDB.find()
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

}
