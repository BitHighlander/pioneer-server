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
const puppeteer = require('puppeteer');
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
knowledgeDB.createIndex({title: 1}, {unique: true})
blockchainsDB.createIndex({blockchain: 1}, {unique: true})
txsDB.createIndex({txid: 1}, {unique: true})
txsRawDB.createIndex({txhash: 1}, {unique: true})
appsDB.createIndex({app: 1}, {unique: true})
appsDB.createIndex({homepage: 1}, {unique: true})
appsDB.createIndex({id: 1}, {unique: true})
assetsDB.createIndex({name: 1}, {unique: true})
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
            log.info("asset: ",asset)
            log.info("version: ",version)
            log.info("limit: ",limit)
            log.info("skip: ",skip)

            let assetsByName = await assetsDB.find({ name:asset },{limit:100})
            let assetsBySymbol = await assetsDB.find({ name:asset.toUpperCase() },{limit:100})
            let blockchainsByName = await blockchainsDB.find({ name:asset },{limit:100})
            log.info("assetsByName: ",assetsByName)
            log.info("assetsBySymbol: ",assetsBySymbol)
            log.info("blockchainsByName: ",blockchainsByName)

            let hits = [...assetsByName,...blockchainsByName,...assetsBySymbol]
            let output:any = []
            if(hits.length > 0) {
                let blockchains = []

                for(let i = 0; i < blockchainsByName.length; i++){
                    let asset = blockchainsByName[i]
                    blockchains.push(asset.name)
                }
                log.info("blockchains: ",blockchains)

                for(let i = 0; i < assetsByName.length; i++){
                    let asset = assetsByName[i]
                    blockchains.push(asset.blockchain)
                }
                log.info("blockchains: ",blockchains)
                if(!blockchains[0]) blockchains.push(asset)
                // let apps = await appsDB.find({whitelist:true},{limit,skip})
                log.info("blockchains: ",blockchains[0])
                // let apps = await appsDB.find({$and: [{whitelist:true},{blockchains:{$in:[blockchains]}}]},{limit:100})
                // let apps = await appsDB.find({$and: [{whitelist:true},{blockchains:{$in: [/bitcoin/i]}}]},{limit:100})
                let apps = await appsDB.find({$and: [{whitelist:true},{blockchains:{$in: blockchains}}]},{limit:100})
                // let apps = await appsDB.find({whitelist:true},{limit:100})
                log.info("apps: ",apps)
                log.info("apps: ",apps.length)

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
            let resultWhitelist:any = {}
            if(addressFromSig === ADMIN_PUBLIC_ADDRESS) {
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

    @Post('/apps/submit')
    //CreateAppBody
    public async submitUrl(@Header('Authorization') authorization: string,@Body() body: any): Promise<any> {
        let tag = TAG + " | transactions | "
        try{
            log.debug(tag,"body: ",body)
            log.debug(tag,"authorization: ",authorization)
            if(!body.homepage) throw Error("invalid signed payload missing url!")
            if(!body.app) throw Error("invalid signed payload missing url!")

            //
            if(body.app.indexOf("https") === -1) {
                body.app = "https://"+body.app
            }

            if(body.homepage.indexOf("https") === -1) {
                body.homepage = "https://"+body.homepage
            }

            //read page
            // Launch a headless browser
            const browser = await puppeteer.launch();
            const page = await browser.newPage();

            // Navigate to the URL
            await page.goto(body.homepage);

            // Wait for the JavaScript to execute on the page
            await page.waitForTimeout(2000); // Adjust the timeout as needed

            // Get all images from the webpage
            const imageUrls = await page.$$eval('img', images => images.map(img => img.src));

            // Get the HTML content after JavaScript execution
            const htmlContent = await page.content();

            // Close the browser
            await browser.close();

            // Use cheerio to parse the HTML content
            const $ = cheerio.load(htmlContent);

            // Remove all script and style elements
            $('script, style').remove();

            // Get the text content of the webpage
            let textContent = $('body').text();

            // Remove all white space from the text
            textContent = textContent.replace(/\s+/g, ' ');

            // Log the text and image content
            console.log("textContent: ", textContent);
            console.log("imageUrls: ", imageUrls);
            textContent = textContent + " " + imageUrls.join(" ")
            const schema = {
                name: "name of the DApp",
                app: "official app of the DApp",
                blockchains: "blockchains supported by the DApp, listed as a CSV, use what you know about the dapp, almost always have ethereum and do you best to add more eip155 chains that are common",
                protocols: {
                    walletConnect: "boolean indicating if the DApp supports WalletConnect (default to true)",
                    walletConnectV2: "boolean indicating if the DApp supports WalletConnect V2 (default to false)",
                    rest:" boolean indicating if the DApp supports kk REST, default to false if you do now know ",
                },
                image: "logo of the DApp, a full URL os just the image prefure png",
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
            textContent = "the dapps URL is "+body.url+" if you know what this dapp does then please add a description from you mind! I dont care if your knowledge is our to date, dont warn me " + textContent
            let result = await ai.summarizeString(textContent,schema)
            console.log("result: ",result)
            console.log("result: ",typeof(result))

            //TODO save into knowledge db

            return(result);
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
            log.info(tag,"message: ",message)
            log.info(tag,"message: ",typeof(message))
            message = JSON.parse(message)
            if(!message.app) throw Error("Ivalid message missing app")

            let allPioneers = await networkEth.getAllPioneers()
            let pioneers = allPioneers.owners
            log.info(tag,"pioneers: ",pioneers)
            for(let i=0;i<pioneers.length;i++){
                pioneers[i] = pioneers[i].toLowerCase()
            }
            let resultRevoke:any = {}
            console.log("index: ",pioneers.indexOf(addressFromSig.toLowerCase()))
            log.info(tag,"pioneers: ",pioneers[0])
            log.info(tag,"pioneers: ",pioneers[1])
            log.info(tag,"pioneers: ",addressFromSig.toLowerCase())

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
            log.info(tag,"pioneers: ",pioneers)
            for(let i=0;i<pioneers.length;i++){
                pioneers[i] = pioneers[i].toLowerCase()
            }
            log.info(tag,"pioneers: ",pioneers)
            message = JSON.parse(message)
            if(!message.name) throw Error("Ivalid message missing name")
            if(!message.url) throw Error("Ivalid message missing url")
            let resultWhitelist:any = {}
            console.log("index: ",pioneers.indexOf(addressFromSig.toLowerCase()))
            log.info(tag,"pioneers: ",pioneers[0])
            log.info(tag,"pioneers: ",pioneers[1])
            log.info(tag,"pioneers: ",addressFromSig.toLowerCase())
            if(pioneers.indexOf(addressFromSig.toLowerCase()) >= 0) {
                resultWhitelist = await appsDB.update({name:message.name},{$set:{whitelist:true}})
                log.debug(tag,"resultWhitelist: ",resultWhitelist)
                resultWhitelist.success = true
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
