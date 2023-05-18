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

let changelly = new Changelly(
    CHANGELLY_API_KEY,
    CHANGELLY_API_SECRET
);
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
@Tags('Changelly Endpoints (3rd party api)')
@Route('')
export class pioneerChangellyController extends Controller {

    /*
     * Market Info
     *
     *    Cache Market info
     *
     * */
    private getCurrenciesAsync(): Promise<any> {
        return new Promise((resolve, reject) => {
            changelly.getCurrencies((err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    @Get('/changelly/currencies')
    public async currenciesChangelly() {
        let tag = TAG + " | currenciesChangelly | "
        try{
            const data = await this.getCurrenciesAsync();
            log.info(tag, data);
            return data.result;
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

    // Implementing other methods

    private createTransactionAsync(from: string, to: string, address: string, amount: number, extraId?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            changelly.createTransaction(from, to, address, amount, extraId, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    @Example<any>({
        from: 'eth',
        to: 'btc',
        address: '1PKYrd9CC4RFB65wBrvaAsTWnp8fXePuj',
        amount: 10,
        extraId: undefined
    })
    @Post('/create-transaction')
    public async createTransactionChangelly(@Body() body: { from: string, to: string, address: string, amount: number, extraId?: string }) {
        try {
            const data = await this.createTransactionAsync(body.from, body.to, body.address, body.amount, body.extraId);
            return data.result;
        } catch (e) {
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }

    private getMinAmountAsync(from: string, to: string): Promise<any> {
        return new Promise((resolve, reject) => {
            changelly.getMinAmount(from, to, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    @Example<any>({
        from: 'eth',
        to: 'btc'
    })
    @Get('/min-amount/:from/:to')
    public async getMinAmountChangelly(from: string, to: string) {
        try {
            const data = await this.getMinAmountAsync(from, to);
            return data.result;
        } catch (e) {
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }

    private getExchangeAmountAsync(from: string, to: string, amount: number): Promise<any> {
        return new Promise((resolve, reject) => {
            changelly.getExchangeAmount(from, to, amount, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
    @Example<any>({
        from: 'btc',
        to: 'eth',
        amount: 1
    })
    @Get('/exchange-amount/:from/:to/:amount')
    public async getExchangeAmountChangelly(from: string, to: string, amount: number) {
        try {
            const data = await this.getExchangeAmountAsync(from, to, amount);
            return data.result;
        } catch (e) {
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }

    private getTransactionsAsync(limit: number, offset: number, currency?: string, address?: string, extraId?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            changelly.getTransactions(limit, offset, currency, address, extraId, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
    @Example<any>({
        limit: 10,
        offset: 0,
        currency: 'btc',
        address: undefined,
        extraId: undefined
    })
    @Get('/transactions/:limit/:offset/:currency?/:address?/:extraId?')
    public async getTransactionsChangelly(limit: number, offset: number, currency?: string, address?: string, extraId?: string) {
        try {
            const data = await this.getTransactionsAsync(limit, offset, currency, address, extraId);
            return data.result;
        } catch (e) {
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }
    private getStatusAsync(id: string): Promise<any> {
        return new Promise((resolve, reject) => {
            changelly.getStatus(id, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    @Example<any>({
        id: '1gy2g76'
    })
    // @ts-ignore
    public async getStatusChangelly(id: string) {
        let tag = TAG + " | getStatus | ";
        try {
            const data = await this.getStatusAsync(id);
            log.info(tag, data);
            return data.result;
        } catch (e) {
            let errorResp: Error = {
                success: false,
                tag,
                e
            };
            log.error(tag, "e: ", { errorResp });
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }
}
