/*

    Pioneer Skills endpoints



 */
import axios from "axios";

let TAG = ' | Skills | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
import type { Chain, UTXO, UTXOChain } from '@thorswap-lib/types';
import {
    Error,
    ApiError,
} from "@pioneer-platform/pioneer-types";

import { SwapKitApi, QuoteResponse, CachedPricesParams, CachedPricesResponse, QuoteParams, GasRatesResponse, TxnResponse, TokenlistProvidersResponse, ThornameResponse } from '@thorswap-lib/swapkit-api';

let connection  = require("@pioneer-platform/default-mongo")
// @ts-ignore
import { getRequest } from '@thorswap-lib/helpers';



export type BlockchairApiParams<T> = T & {
    chain: Chain;
    apiKey: string;
};

export interface BlockchairMultipleBalancesResponse {
    [key: string]: number;
}

export interface BlockchairVin {
    txid: string;
    vout: number;
    scriptSig: {
        asm: string;
        hex: string;
    };
    sequence: number;
}

export interface BlockchairVout {
    value: number;
    n: number;
    scriptPubKey: {
        asm: string;
        hex: string;
        address: string;
        type: string;
        addresses: string[];
        reqSigs: number;
    };
}

export interface BlockchairTransaction {
    block_id: number;
    hash: string;
    time: string;
    balance_change: number;
}

export interface BlockchairUtxo {
    block_id: number;
    transaction_hash: string;
    index: number;
    value: number;
}

export interface BlockchairAddressCoreData {
    type: string;
    script_hex: string;
    balance: number;
    balance_usd: number;
    received: number;
    received_usd: number;
    spent: number;
    spent_usd: number;
    output_count: number;
    unspent_output_count: number;
    first_seen_receiving: string;
    last_seen_receiving: string;
    first_seen_spending: null | string;
    last_seen_spending: null | string;
    transaction_count: number;
    scripthash_type: null | string;
}

export interface BlockchairInputOutputCommonData {
    block_id: number;
    transaction_id: number;
    index: number;
    transaction_hash: string;
    date: string;
    time: string;
    value: number;
    value_usd: number;
    recipient: string;
    type: string;
    script_hex: string;
    is_from_coinbase: boolean;
    is_spendable: boolean | null;
    is_spent: boolean;
    lifespan: number | null;
    cdd: number | null;
}
export interface BlockchairTransactionInputOutput
    extends BlockchairSpendingBlockData,
        BlockchairInputOutputCommonData {
    scripthash_type: null | string;
}

export interface BlockchairSpendingBlockData {
    spending_block_id: number | null;
    spending_transaction_id: number | null;
    spending_index: number | null;
    spending_transaction_hash: string | null;
    spending_date: string | null;
    spending_time: string | null;
    spending_value_usd: number | null;
    spending_sequence: number | null;
    spending_signature_hex: string | null;
    spending_witness: string | null;
}

export interface BlockchairAddressResponse {
    [key: string]: {
        address: BlockchairAddressCoreData;
        transactions: BlockchairTransaction[];
        utxo: BlockchairUtxo[];
    };
}

export interface BlockchairOutputsResponse
    extends BlockchairSpendingBlockData,
        BlockchairInputOutputCommonData {}

export interface BlockchairRawTransactionResponse {
    [key: string]: {
        raw_transaction: string;
        decoded_raw_transaction: {
            txid: string;
            hash: string;
            version: number;
            size: number;
            vsize: number;
            weight: number;
            locktime: number;
            vin: BlockchairVin[];
            vout: BlockchairVout[];
        };
    };
}

export interface BlockchairMultipleAddressesResponse {
    addresses: {
        [key: string]: BlockchairAddressCoreData;
    };
    transactions: BlockchairTransaction[];
    utxo: BlockchairUtxo[];
    set: {
        address_count: number;
        balance: number;
        balance_usd: number;
        received: number;
        spent: number;
        output_count: number;
        unspent_output_count: number;
        first_seen_receiving: string;
        last_seen_receiving: string;
        first_seen_spending: null | string;
        last_seen_spending: null | string;
        transaction_count: number;
    };
}

export interface BlockchairResponse<T> {
    data: T;
    context: {
        code: number;
        source: string;
        results: number;
        state: number;
        market_price_usd: number;
        cache: {
            live: boolean;
            duration: number;
            since: string;
            until: string;
            time: any;
        };
        api: {
            version: string;
            last_major_update: string;
            next_major_update: null | string;
            documentation: string;
            notice: string;
        };
        servers: string;
        time: number;
        render_time: number;
        full_time: number;
        request_cost: number;
    };
}

export interface BlockchairDashboardTransactionResponse {
    [key: string]: {
        transaction: {
            block_id: number;
            id: number;
            hash: string;
            date: string;
            time: string;
            size: number;
            weight: number;
            version: number;
            lock_time: number;
            is_coinbase: boolean;
            has_witness: boolean;
            input_count: number;
            output_count: number;
            input_total: number;
            input_total_usd: number;
            output_total: number;
            output_total_usd: number;
            fee: number;
            fee_usd: number;
            fee_per_kb: number;
            fee_per_kb_usd: number;
            fee_per_kwu: number;
            fee_per_kwu_usd: number;
            cdd_total: number;
            is_rbf: boolean;
        };
        inputs: BlockchairTransactionInputOutput[];
        outputs: BlockchairTransactionInputOutput[];
    };
}

type BlockchairParams<T> = T & { chain: Chain; apiKey?: string };

export interface GetAddressDataBody {
    chain: Chain
    address: string
}

export interface GetRawTxBody {
    chain: Chain
    txHash: string
}

export interface GetUnspentTxsBody {
    chain: Chain
    address: string
    offset?: number
}

export interface ScanUTXOsBody {
    chain: Chain
    address: string
    fetchTxHex?: boolean
}


let BLOCKCHAIR_API_KEY = process.env['BLOCKCHAIR_API_KEY']

const blockchairRequest = async <T extends any>(url: string): Promise<T> => {
    const response = await getRequest<BlockchairResponse<T>>(url);
    if (!response || response.context.code !== 200) throw new Error(`failed to query ${url}`);

    return response.data as T;
};

const mapChainToBlockchairChain = (chain: Chain) => {
    switch (chain) {
        // @ts-ignore
        case Chain.BitcoinCash:
            return 'bitcoin-cash';
        // @ts-ignore
        case Chain.Litecoin:
            return 'litecoin';
        // @ts-ignore
        case Chain.Dogecoin:
            return 'dogecoin';
        default:
            return 'bitcoin';
    }
};

const baseUrl = (chain: Chain) => `https://api.blockchair.com/${mapChainToBlockchairChain(chain)}`;


//rest-ts
import {Body, Controller, Get, Post, Route, Tags, Example, Header} from 'tsoa';
//route
@Tags('thorswap Endpoint (3rd party)')
@Route('')
export class thorswapController extends Controller {

    /*
     * thorswap API
     *
     *
     *
     * */

    //global Info
    @Get('/blockchair/getSuggestedTxFee/:chain')
    public async getThornameRlookup(chain:Chain){
        let tag = TAG + " | getThornameRlookup | "
        try{

            //Use Bitgo API for fee estimation
            //Refer: https://app.bitgo.com/docs/#operation/v2.tx.getfeeestimate
            const { feePerKb } = await getRequest<{
                feePerKb: number;
                cpfpFeePerKb: number;
                numBlocks: number;
                feeByBlockTarget: { 1: number; 3: number };
            }>(`https://app.bitgo.com/api/v2/${chain.toLowerCase()}/tx/fee`);

            return(feePerKb / 1000);
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


    //Submit review
    @Post('/blockcair/getAddressData')
    //CreateAppBody
    public async getAddressData(@Body() body: GetAddressDataBody): Promise<any> {
        let tag = TAG + " | getCachedPrices | "
        try{
            log.debug(tag,"body: ",body)
            const url = `/dashboards/address/${body.address}?transaction_details=true${
                BLOCKCHAIR_API_KEY ? `&key=${BLOCKCHAIR_API_KEY}` : ''
            }`;
            const response = await blockchairRequest<BlockchairAddressResponse>(`${baseUrl(body.chain)}${url}`);

            return(response);
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

    //Submit review
    @Post('/blockchair/getUnconfirmedBalance')
    //CreateAppBody
    public async getUnconfirmedBalance(@Body() body: GetAddressDataBody): Promise<any> {
        let tag = TAG + " | getUnconfirmedBalance | "
        try{
            log.debug(tag,"body: ",body)
            const url = `/dashboards/address/${body.address}?transaction_details=true${
                BLOCKCHAIR_API_KEY ? `&key=${BLOCKCHAIR_API_KEY}` : ''
            }`;
            const response = await blockchairRequest<BlockchairAddressResponse>(`${baseUrl(body.chain)}${url}`);

            // @ts-ignore
            return response.address.balance;
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

    //Submit review
    @Post('/blockchair/getConfirmedBalance')
    //CreateAppBody
    public async getConfirmedBalance(@Body() body: GetAddressDataBody): Promise<any> {
        let tag = TAG + " | getUnconfirmedBalance | "
        try{
            if (!body.address) throw new Error('address is required');

            const url = `/addresses/balances?addresses=${body.address}${BLOCKCHAIR_API_KEY ? `&key=${BLOCKCHAIR_API_KEY}` : ''}`;
            const response = await blockchairRequest<BlockchairMultipleBalancesResponse>(
                `${baseUrl(body.chain)}${url}`,
            );

            return response[body.address] || 0;
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

    //Submit review
    @Post('/blockchair/getRawTx')
    //CreateAppBody
    public async getRawTx(@Body() body: GetRawTxBody): Promise<any> {
        let tag = TAG + " | getRawTx | "
        try{
            if (!body.txHash) throw new Error('txHash is required');

            const url = `/raw/transaction/${body.txHash}${BLOCKCHAIR_API_KEY ? `?key=${BLOCKCHAIR_API_KEY}` : ''}`;
            const rawTxResponse = await blockchairRequest<BlockchairRawTransactionResponse>(
                `${baseUrl(body.chain)}${url}`,
            );
            return rawTxResponse[body.txHash].raw_transaction;
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

    //Submit review
    @Post('/blockchair/getUnspentTxs')
    //CreateAppBody
    public async getUnspentTxs(@Body() body: GetUnspentTxsBody): Promise<any> {
        let tag = TAG + " | getUnspentTxs | "
        try {
            if (!body.address) throw new Error('address is required');
            const chain = body.chain;
            const apiKey = BLOCKCHAIR_API_KEY;
            let offset = 0
            if(body.offset) offset = body.offset
            // @ts-ignore
            async function fetchUnspentTxs(offset: number): Promise<UTXO[]> {
                const url = `/outputs?q=is_spent(false),recipient(${body.address})&limit=100&offset=${offset}${
                    apiKey ? `&key=${apiKey}` : ''
                }`;
                const response = await blockchairRequest<BlockchairOutputsResponse[]>(`${baseUrl(chain)}${url}`);

                const txs = response
                    .filter(({ is_spent }) => !is_spent)
                    .map(({ script_hex, block_id, transaction_hash, index, value, spending_signature_hex }) => ({
                        hash: transaction_hash,
                        index,
                        value,
                        txHex: spending_signature_hex,
                        script_hex,
                        is_confirmed: block_id !== -1,
                    })) as (UTXO & { script_hex: string; is_confirmed: boolean })[];

                if (response.length !== 100) return txs;

                const nextOffset = response[99].transaction_id;
                const nextBatch = await fetchUnspentTxs(nextOffset);

                // @ts-ignore
                return txs.concat(nextBatch);
            }

            const unspentTxs = await fetchUnspentTxs(offset);

            return unspentTxs;
        } catch (e) {
            let errorResp: Error = {
                success: false,
                tag,
                e
            }
            log.error(tag, "e: ", { errorResp })
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }

    //Submit review
    @Post('/blockchair/scanUTXOs')
    //CreateAppBody
    public async scanUTXOs(@Body() body: ScanUTXOsBody): Promise<any> {
        let tag = TAG + " | scanUTXOs | "
        try {
            if (!body.address) throw new Error('address is required');
            const chain = body.chain;
            const apiKey = BLOCKCHAIR_API_KEY;
            let offset = 0
            // @ts-ignore
            async function fetchUnspentTxs(offset: number): Promise<UTXO[]> {
                const url = `/outputs?q=is_spent(false),recipient(${body.address})&limit=100&offset=${offset}${
                    apiKey ? `&key=${apiKey}` : ''
                }`;
                const response = await blockchairRequest<BlockchairOutputsResponse[]>(`${baseUrl(chain)}${url}`);

                const txs = response
                    .filter(({ is_spent }) => !is_spent)
                    .map(({ script_hex, block_id, transaction_hash, index, value, spending_signature_hex }) => ({
                        hash: transaction_hash,
                        index,
                        value,
                        txHex: spending_signature_hex,
                        script_hex,
                        is_confirmed: block_id !== -1,
                    })) as (UTXO & { script_hex: string; is_confirmed: boolean })[];

                if (response.length !== 100) return txs;

                const nextOffset = response[99].transaction_id;
                const nextBatch = await fetchUnspentTxs(nextOffset);

                // @ts-ignore
                return txs.concat(nextBatch);
            }

            const utxos = await fetchUnspentTxs(offset);

            const results = [];

            // @ts-ignore
            for (const { hash, index, script_hex, value } of utxos) {
                let txHex;
                if (body.fetchTxHex) {
                    const url = `/raw/transaction/${hash}${BLOCKCHAIR_API_KEY ? `?key=${BLOCKCHAIR_API_KEY}` : ''}`;
                    const rawTxResponse = await blockchairRequest<BlockchairRawTransactionResponse>(
                        `${baseUrl(body.chain)}${url}`,
                    );
                    txHex = rawTxResponse[hash].raw_transaction;
                }
                results.push({
                    // @ts-ignore
                    address,
                    hash,
                    index,
                    txHex,
                    value,
                    witnessUtxo: { value, script: Buffer.from(script_hex, 'hex') },
                });
            }
            return results;
        } catch (e) {
            let errorResp: Error = {
                success: false,
                tag,
                e
            }
            log.error(tag, "e: ", { errorResp })
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }
}
