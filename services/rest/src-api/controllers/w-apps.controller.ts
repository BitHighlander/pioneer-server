/*

    Pioneer REST endpoints



 */
let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
let ai = require('@pioneer-platform/pioneer-intelligence')
const {subscriber, publisher, redis} = require('@pioneer-platform/default-redis')
import { recoverPersonalSignature } from 'eth-sig-util';
import { bufferToHex } from 'ethereumjs-util';

let networkEth = require("@pioneer-platform/eth-network")
networkEth.init()

const axios = require('axios');
const cheerio = require('cheerio');
// const puppeteer = require('puppeteer');
// import cheerio from 'cheerio';
ai.init()
//TODO if no mongo use nedb?
//https://github.com/louischatriot/nedb
let connection  = require("@pioneer-platform/default-mongo")
let usersDB = connection.get('users')
let txsDB = connection.get('transactions')
let txsRawDB = connection.get('transactions-raw')
let appsDB = connection.get('apps')
let blockchainsDB = connection.get('blockchains')
const uuid = require('short-uuid');
const queue = require('@pioneer-platform/redis-queue');
const assetsDB = connection.get('assets')
const knowledgeDB = connection.get('knowledge');
const reviewsDB = connection.get('reviews');
reviewsDB.createIndex({id: 1}, {unique: true})
knowledgeDB.createIndex({title: 1}, {unique: true})
blockchainsDB.createIndex({blockchain: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
txsRawDB.createIndex({txhash: 1}, {unique: true})
appsDB.createIndex({app: 1}, {unique: true})
appsDB.createIndex({homepage: 1}, {unique: true})
appsDB.createIndex({id: 1}, {unique: true})
// assetsDB.createIndex({name: 1}, {unique: true})
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

    @Get('/apps/{limit}/{skip}')
    public async listApps(limit:number,skip:number) {
        let tag = TAG + " | health | "
        try{
            //Assume minVersion means no support
            let apps = await appsDB.find({whitelist:true},{limit,skip})
            console.log("apps: ",apps)
            let output = []
            for(let i = 0; i < apps.length; i++){
                let app = apps[i]
                if(!app.minVersion){
                    output.push(app)
                }
            }
            console.log("output: ",output)
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

    /*
        read
    */

    @Get('/appsbyName/{name}')
    public async listAppsByName(name:string) {
        let tag = TAG + " | byName | "
        try{
            // let apps = await appsDB.find({whitelist:true})
            let apps = await appsDB.find({$and: [{whitelist:true},{name}]})

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

    @Get('/appsbyApp/{app}')
    public async listAppsByApp(app:string) {
        let tag = TAG + " | listAppsByApp | "
        try{
            let apps = await appsDB.find({whitelist:true, app})
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

    @Get('/appsbyVersion/{minVersion}/{limit}/{skip}')
    public async listAppsByVersion(minVersion:string,limit:number,skip:number) {
        let tag = TAG + " | health | "
        try{
            let apps = await appsDB.find({whitelist:true},{limit,skip})
            let output = []
            for(let i = 0; i < apps.length; i++){
                let app = apps[i]
                if(!app.minVersion){
                    output.push(app)
                } else if(app.minVersion) {
                    //check major version
                    let versions = minVersion.split('.')
                    let majorVersion = versions[0]
                    let patchVersion = versions[1]
                    let minorVersion = versions[2]

                    //check patch
                    //check minor
                    output.push(app)
                }
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

    /*
        listAppsByVersionAndAsset
    */

    @Get('/appsbyVersionAndAsset/{asset}/{version}/{limit}/{skip}')
    public async listAppsByVersionAndAsset(asset:string,version:string,limit:number,skip:number) {
        let tag = TAG + " | health | "
        try{
            asset = asset.toLowerCase()
            log.debug("asset: ",asset)
            log.debug("version: ",version)
            log.debug("limit: ",limit)
            log.debug("skip: ",skip)

            let assetsByName = await assetsDB.find({ name:asset },{limit:100})
            let assetsBySymbol = await assetsDB.find({ name:asset.toUpperCase() },{limit:100})
            let blockchainsByName = await blockchainsDB.find({ name:asset },{limit:100})
            log.debug("assetsByName: ",assetsByName)
            log.debug("assetsBySymbol: ",assetsBySymbol)
            log.debug("blockchainsByName: ",blockchainsByName)

            let hits = [...assetsByName,...blockchainsByName,...assetsBySymbol]
            let output:any = []
            if(hits.length > 0) {
                let blockchains = []

                for(let i = 0; i < blockchainsByName.length; i++){
                    let asset = blockchainsByName[i]
                    blockchains.push(asset.name)
                }
                log.debug("blockchains: ",blockchains)

                for(let i = 0; i < assetsByName.length; i++){
                    let asset = assetsByName[i]
                    blockchains.push(asset.blockchain)
                }
                log.debug("blockchains: ",blockchains)
                if(!blockchains[0]) blockchains.push(asset)
                // let apps = await appsDB.find({whitelist:true},{limit,skip})
                log.debug("blockchains: ",blockchains[0])
                // let apps = await appsDB.find({$and: [{whitelist:true},{blockchains:{$in:[blockchains]}}]},{limit:100})
                // let apps = await appsDB.find({$and: [{whitelist:true},{blockchains:{$in: [/bitcoin/i]}}]},{limit:100})
                let apps = await appsDB.find({$and: [{whitelist:true},{blockchains:{$in: blockchains}}]},{limit:100})
                // let apps = await appsDB.find({whitelist:true},{limit:100})
                log.debug("apps: ",apps)
                log.debug("apps: ",apps.length)

                output = []
                for(let i = 0; i < apps.length; i++){
                    let app = apps[i]
                    output.push(app)
                    // if(!app.minVersion){
                    //     output.push(app)
                    // } else if(app.minVersion) {
                    //     //check major version
                    //     let versions = version.split('.')
                    //     let majorVersion = versions[0]
                    //     let patchVersion = versions[1]
                    //     let minorVersion = versions[2]
                    //
                    //     //check patch
                    //     //check minor
                    //     output.push(app)
                    // }
                }
            }
            //Rank by score
            const sortArrayByScore = (arr) => {
                return arr.sort((a, b) => {
                    if (a.score === undefined) a.score = 0;
                    if (b.score === undefined) b.score = 0;
                    return b.score - a.score;
                });
            }
            output = sortArrayByScore(output)

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


    /*
        read
    */

    @Get('/spotlight')
    public async getSpotlight() {
        let tag = TAG + " | getSpotlight | "
        try{
            let apps = appsDB.findOne({whitelist:true,isSpotlight:true})
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
            developer = developer.toLowerCase()
            let apps = appsDB.find({whitelist:true,developer})
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

    @Get('/votes/{name}')
    public async listAppVotesByName(name:any) {
        let tag = TAG + " | listAppsByDeveloper | "
        try{
            let output = {
                allFactsUp: [],
                allFactsDown: []
            }
            let upvotes = await redis.smembers("facts:votes:"+name+":up");
            let downvotes = await redis.smembers("facts:votes:"+name+":down");

            for(let i = 0; i < upvotes.length; i++){
                let address = upvotes[i]
                address = address.toLowerCase()
                let votingPower = await redis.get(address+":nft:voteing-power")
                output.allFactsUp.push({ address: address, weight: parseFloat(votingPower)})
            }

            for(let i = 0; i < downvotes.length; i++){
                let address = downvotes[i]
                address = address.toLowerCase()
                let votingPower = await redis.get(address+":nft:voteing-power")
                output.allFactsDown.push({ address: address, weight: parseFloat(votingPower)})
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


    /*
    TODO
    vote
 */
    @Post('/apps/vote')
    //CreateAppBody
    public async voteOnApp(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | voteOnApp | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)

            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.vote) throw Error("Ivalid message missing value")
            let resultWhitelist:any = {}
            //get fox balance of address
            let work:any = {}
            let queueId = uuid.generate()
            work.vote = true
            work.queueId = queueId
            work.name = message.name
            work.payload = body
            resultWhitelist.success = true
            resultWhitelist.message = 'Address '+addressFromSig+' voted '+message.vote+' on  app '+message.name+' in the dapp store!'
            resultWhitelist.result = await queue.createWork("pioneer:facts:ingest",work)

            return(resultWhitelist);
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
    @Post('/apps/update')
    //CreateAppBody
    public async updateApp(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | updateApp | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)

            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.key) throw Error("Ivalid message missing key")
            if(!message.value) throw Error("Ivalid message missing value")

            //get all noun owners
            let allPioneers = await networkEth.getAllPioneers()
            let pioneers = allPioneers.owners
            log.debug(tag,"pioneers: ",pioneers)
            for(let i=0;i<pioneers.length;i++){
                pioneers[i] = pioneers[i].toLowerCase()
            }
            log.debug(tag,"pioneers: ",pioneers)
            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.url) throw Error("Ivalid message missing url")
            let resultWhitelist:any = {}
            console.log("index: ",pioneers.indexOf(addressFromSig.toLowerCase()))
            if(pioneers.indexOf(addressFromSig.toLowerCase()) >= 0) {
                delete message["_id"]
                resultWhitelist = await appsDB.update({name:message.name},{$set:{[message.key]:message.value}})
                log.debug(tag,"resultWhitelist: ",resultWhitelist)
            } else {
                //get fox balance of address
                let work:any = {}
                let queueId = uuid.generate()
                work.queueId = queueId
                work.payload = body
                resultWhitelist.success = true
                resultWhitelist.message = 'Address '+addressFromSig+' voted to update app '+message.name+' in the dapp store!'
                resultWhitelist.result = await queue.createWork("pioneer:facts:ingest",work)
            }

            return(resultWhitelist);
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
        destroy
     */

     /*
        Create new dapp list

        submit name
            check url is live
            load url and use AI to get description
            store description into knowledge
     */

    @Get('/reviews/{app}/{limit}/{skip}')
    public async listReviewsByApp(app:string,limit:number,skip:number) {
        let tag = TAG + " | health | "
        try{
            let reviews = reviewsDB.find({app},{limit,skip})
            return(reviews)
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


    //admin
    /*
        read
    */

    @Get('/apps/pending/{limit}/{skip}')
    public async listAppsPending(limit:number,skip:number) {
        let tag = TAG + " | health | "
        try{
            let apps = appsDB.find({whitelist:false},{limit,skip})
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

    @Post('/apps/search')
    public async listAppsSearch(@Body() payload: {
        limit: number;
        skip: number;
        sortBy?: string;
        sortOrder?: string;
        filterTags?: string[];
        customFilters?: Record<string, any>;
    }) {
        let tag = TAG + ' | listAppsSearch | ';
        try {
            const {
                limit,
                skip,
                sortBy,
                sortOrder = 'asc',
                filterTags = [],
                customFilters = {}
            } = payload;

            const sort: any = {};
            if (sortBy) {
                sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
            }

            const query: any = {
                ...customFilters
            };
            // if(filterTags){
            //     query.tags = { $in: filterTags };
            // }
            console.log("query: ",query)
            const results = await appsDB.find(query, {
                sort,
                limit,
                skip
            });
            const total = await appsDB.count(query);

            return { results, total };
        } catch (e) {
            let errorResp: Error = {
                success: false,
                tag,
                e,
            };
            log.error(tag, 'e: ', { errorResp });
            throw new ApiError('error', 503, 'error: ' + e.toString());
        }
    }

    @Post('/apps/submit')
    public async submitUrl(@Header('Authorization') authorization: string, @Body() body: any): Promise<any> {
        let tag = TAG + " | transactions | ";
        try {
            log.debug(tag, "body: ", body);
            log.debug(tag, "authorization: ", authorization);
            if (!body.homepage) throw Error("invalid signed payload missing homepage!");
            if (!body.app) throw Error("invalid signed payload missing app!");

            //
            if (body.app.indexOf("https") === -1) {
                body.app = "https://" + body.app;
            }

            if (body.homepage.indexOf("https") === -1) {
                body.homepage = "https://" + body.homepage;
            }

            let textContent = "";
            try {
                // Fetch the webpage HTML
                const response = await axios.get(body.homepage);
                const htmlContent = response.data;

                // Use cheerio to parse the HTML content
                const $ = cheerio.load(htmlContent);

                // Remove all script and style elements
                $('script, style').remove();

                // Get the text content of the webpage
                textContent = $('body').text();

                // Remove all white space from the text
                textContent = textContent.replace(/\s+/g, ' ');

                // Get all images from the webpage
                let imageUrls = $('img').map((_, img) => $(img).attr('src')).get();

                // Limit the image URLs to 10,000 characters
                imageUrls = imageUrls.join(' ').substring(0, 10000);

                textContent = textContent + ' ' + imageUrls;

                // Trim the text to a maximum of 10,000 characters
                textContent = textContent.substring(0, 10000);

                console.log("textContent: ", textContent);
            } catch (e) {
                textContent = "loading failed, just guess";
            }

            const schema = {
                name: "name of the DApp",
                app: "official app of the DApp",
                blockchains: "blockchains supported by the DApp, listed as a CSV, use what you know about the dapp, almost always have ethereum and do you best to add more eip155 chains that are common",
                protocols: {
                    walletConnect: "boolean indicating if the DApp supports WalletConnect (default to true)",
                    walletConnectV2: "boolean indicating if the DApp supports WalletConnect V2 (default to false)",
                    rest: " boolean indicating if the DApp supports kk REST, default to false if you do now know ",
                },
                image: "logo of the DApp, a full URL or just the image encoded in base64",
                developer: {
                    email: "developer's email of the DApp"
                },
                keepKeySupport: "boolean indicating if the DApp supports KeepKey",
                shapeShiftSupport: "boolean indicating if the DApp supports ShapeShift",
                description: "brief description of the DApp, guess from the input",
                homepage: "official website of the DApp",
                created: "creation time of the DApp",
                trust: "trust score of the DApp",
                transparency: "transparency score of the DApp",
                innovation: "innovation score of the DApp",
                popularity: "popularity score of the DApp",
                socialMedia: {
                    twitter: "Twitter handle of the DApp",
                    telegram: "Telegram handle of the DApp",
                    facebook: "Facebook page of the DApp",
                    linkedin: "LinkedIn page of the DApp",
                    github: "Github repository of the DApp"
                },
                license: "license type under which the DApp is released",
                sourceCodeLink: "link to the DApp's source code",
                userCount: "number of users using the DApp",
            };

            textContent = "the dapps URL is " + body.app + " if you know what this dapp does then please add a description from your mind! I don't care if your knowledge is outdated, don't warn me " + textContent;
            log.debug(tag, "pre-summary textContent: ", textContent);

            let result = await ai.summarizeString(textContent, schema);
            console.log("result: ", result);
            console.log("result: ", typeof(result));
            if (!result) {
                result = schema;
                result.name = body.app.replace("https://", "");
                result.name = result.name.replace(".com", "");
            }
            //TODO save into knowledge db

            return(result);
        } catch (e) {
            let errorResp = {
                success: false,
                tag,
                e
            };
            log.error(tag, "e: ", { errorResp });
            throw new ApiError("error", 503, "error: " + e.toString());
        }
    }

    //Submit review
    @Post('/apps/review/submit')
    //CreateAppBody
    public async submitReview(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | submitReview | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let authInfo = await redis.hgetall(authorization)
            log.debug(tag,"authInfo: ",authInfo)

            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)
            message = JSON.parse(message)
            log.debug(tag,"message: ",message)
            log.debug(tag,"message: ",typeof(message))
            //TODO verify app and rating is signed

            //TODO verify user is a fox or pioneer

            let entry = {
                app:message.app,
                user:authInfo.address,
                rating:body.review.rating,
                review:body.review.review,
                timestamp:Date.now(),
                fact:{
                    signer:body.signer,
                    payload:body.payload,
                    signature:body.signature
                }
            }
            let submitResult = await reviewsDB.insert(entry)
            log.debug(submitResult)
            submitResult.success = true

            return(submitResult);
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

    //delete review
    @Post('/apps/review/delete')
    //CreateAppBody
    public async removeReview(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | removeReview | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")
            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)
            log.debug(tag,"message: ",message)
            log.debug(tag,"message: ",typeof(message))
            message = JSON.parse(message)
            if(!message.app) throw Error("Ivalid message missing app")

            let allPioneers = await networkEth.getAllPioneers()
            let pioneers = allPioneers.owners
            log.debug(tag,"pioneers: ",pioneers)
            for(let i=0;i<pioneers.length;i++){
                pioneers[i] = pioneers[i].toLowerCase()
            }
            let resultRevoke:any = {}
            console.log("index: ",pioneers.indexOf(addressFromSig.toLowerCase()))
            log.debug(tag,"pioneers: ",pioneers[0])
            log.debug(tag,"pioneers: ",pioneers[1])
            log.debug(tag,"pioneers: ",addressFromSig.toLowerCase())

            if(pioneers.indexOf(addressFromSig.toLowerCase()) >= 0) {
                resultRevoke.result = await reviewsDB.remove({app:message.app})
                resultRevoke.success = true
                log.debug(tag,"resultWhitelist: ",resultRevoke)
            } else {
                //get fox balance of address
                resultRevoke.error = "user is not a pioneer!"
                resultRevoke.success = false
            }

            return(resultRevoke);
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


    @Post('/apps/revoke')
    //CreateAppBody
    public async revokeApp(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | transactions | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")

            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)
            log.debug(tag,"message: ",message)
            log.debug(tag,"message: ",typeof(message))
            message = JSON.parse(message)
            if(!message.app) throw Error("Ivalid message missing app")

            let allPioneers = await networkEth.getAllPioneers()
            let pioneers = allPioneers.owners
            log.debug(tag,"pioneers: ",pioneers)
            for(let i=0;i<pioneers.length;i++){
                pioneers[i] = pioneers[i].toLowerCase()
            }
            let resultRevoke:any = {}
            console.log("index: ",pioneers.indexOf(addressFromSig.toLowerCase()))
            log.debug(tag,"pioneers: ",pioneers[0])
            log.debug(tag,"pioneers: ",pioneers[1])
            log.debug(tag,"pioneers: ",addressFromSig.toLowerCase())

            if(pioneers.indexOf(addressFromSig.toLowerCase()) >= 0) {
                resultRevoke.result = await appsDB.remove({app:message.app})
                resultRevoke.success = true
                log.debug(tag,"resultWhitelist: ",resultRevoke)
            } else {
                //get fox balance of address
                resultRevoke.error = "user is not a pioneer!"
                resultRevoke.success = false
            }

            return(resultRevoke);
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

    @Post('/apps/create')
    //CreateAppBody
    public async whitelistApp(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | whitelistApp | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.signer) throw Error("invalid signed payload missing signer!")
            if(!body.payload) throw Error("invalid signed payload missing payload!")
            if(!body.signature) throw Error("invalid signed payload missing !")

            let message = body.payload

            const msgBufferHex = bufferToHex(Buffer.from(message, 'utf8'));
            const addressFromSig = recoverPersonalSignature({
                data: msgBufferHex,
                sig: body.signature,
            });
            log.debug(tag,"addressFromSig: ",addressFromSig)

            //get all noun owners
            let allPioneers = await networkEth.getAllPioneers()
            let pioneers = allPioneers.owners
            log.debug(tag,"pioneers: ",pioneers)
            for(let i=0;i<pioneers.length;i++){
                pioneers[i] = pioneers[i].toLowerCase()
            }
            log.debug(tag,"pioneers: ",pioneers)
            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.url) throw Error("Ivalid message missing url")
            let resultWhitelist:any = {}
            console.log("index: ",pioneers.indexOf(addressFromSig.toLowerCase()))
            log.debug(tag,"pioneers: ",pioneers[0])
            log.debug(tag,"pioneers: ",pioneers[1])
            log.debug(tag,"pioneers: ",addressFromSig.toLowerCase())
            if(pioneers.indexOf(addressFromSig.toLowerCase()) >= 0) {
                resultWhitelist = await appsDB.update({name:message.name},{$set:{whitelist:true}})
                log.debug(tag,"resultWhitelist: ",resultWhitelist)
                resultWhitelist.success = true

                //credit the dev that submited
                let appInfo = await appsDB.findOne({name:message.name})
                log.debug(tag,"appInfo: ",appInfo)
                let devAddress = appInfo.developer
                redis.hincryby(devAddress+":score",100)

            } else {
                //get fox balance of address
                resultWhitelist.error = true
                resultWhitelist.message = 'Address '+addressFromSig+' is not a pioneer!'
            }

            return(resultWhitelist);
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
