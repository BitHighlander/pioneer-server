/*

    Pioneer REST endpoints

       FIO


 */
let TAG = ' | FIO | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis} = require('@pioneer-platform/default-redis')

const networks:any = {
    'FIO' : require('@pioneer-platform/fio-network'),
}

//rest-ts
import { Body, Controller, Get, Post, Route, Tags, SuccessResponse, Query, Request, Response, Header } from 'tsoa';

import {
    Error,
    ApiError
} from "@pioneer-platform/pioneer-types";

//route
@Tags('Fio Endpoints')
@Route('')
export class ZFioPublicNerfed extends Controller {


    /**
     *  Retrieve accounts for FIO pubkey
     */
    @Get('/fio/accountsFromPubkey/{pubkey}')
    public async accountsFromFioPubkey(pubkey:string) {
        let tag = TAG + " | accountsFromFioPubkey | "
        try{
            let accounts = await networks['FIO'].getAccounts(pubkey)
            return accounts
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

    /**
     *  Retrieve public user info
     */
    @Get('/fio/getPubkey/{username}')
    public async getFioPubkey(username:string) {
        let tag = TAG + " | getFioPubkey | "
        try{
            let accounts = await networks['FIO'].getAccountAddress(username,"FIO")
            return accounts.public_address
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

    /**
     *  Retrieve public user info
     */
    @Get('/fio/accountInfo/{username}')
    public async getFioAccountInfo(username:string) {
        let tag = TAG + " | fioAccountInfo | "
        try{
            let accounts = await networks['FIO'].getAccountInfo(username)
            return accounts
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
