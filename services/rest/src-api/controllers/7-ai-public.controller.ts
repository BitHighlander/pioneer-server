/*

    Pioneer REST endpoints



 */
import axios from "axios";

let TAG = ' | API | '

const pjson = require('../../package.json');
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis, redisQueue} = require('@pioneer-platform/default-redis')
const midgard = require("@pioneer-platform/midgard-client")
const uuid = require('short-uuid');
const queue = require('@pioneer-platform/redis-queue');
import BigNumber from 'bignumber.js'
import {
    Error,
    ApiError,
    Chart,
} from "@pioneer-platform/pioneer-types";

let connection  = require("@pioneer-platform/default-mongo")

let usersDB = connection.get('users')
let pubkeysDB = connection.get('pubkeys')
let txsDB = connection.get('transactions')
let invocationsDB = connection.get('invocations')
let utxosDB = connection.get('utxo')
const knowledgeDB = connection.get('knowledge')
const tasksDB = connection.get('tasks')
const rivescriptDB = connection.get('rivescriptRaw')
const skillsDB = connection.get('skills')

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
import {Body, Controller, Get, Header, Post, Route, Tags} from 'tsoa';

//route
@Tags('Desktop Skills/Tasks Endpoints')
@Route('')
export class pioneerAiController extends Controller {

    /*
     * Pioneer AI
     *
     *      Skills
     *      Tasks
     *      solutions
     *
     * */

    /*
        CRUD on skills
     */
    @Get('/skills')
    public async skills() {
        let tag = TAG + " | skills | "
        try{
            //TODO give 10 top skills
            let status:any = await skillsDB.find({},{limit:10})

            return(status)
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
    CRUD on skills
 */
    @Get('/skill/:id')
    public async skill(id:string) {
        let tag = TAG + " | skills | "
        try{
            //TODO give 10 top skills
            let status:any = await skillsDB.findOne({scriptName:id})

            return(status)
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


    // Create a skill
    @Post('/skills/create')
    public async createSkill(@Header('Authorization') authorization: string, @Body() skill: any) {
        let tag = TAG + " | createSkill | "
        try {
            log.debug(tag,"skill: ",skill)
            if(!skill.script) throw Error("Invalid result! missing script")
            if(!skill.summary) throw Error("Invalid result! missing summary")
            if(!skill.keywords) throw Error("Invalid result! missing keywords")
            if(!skill.inputs) throw Error("Invalid result! missing keywords")

            //sanitize
            let inputSkill = {
                tested: false,
                score: 0,
                stability: 0,
                author: "TODO",
                scriptName: skill.scriptName,
                script: skill.script,
                summary: skill.summary,
                inputs: skill.inputs,
                keywords: skill.keywords,
            }

            //createSkill
            let createdSkill = await skillsDB.insert(inputSkill)

            return createdSkill
        } catch(e) {
            let errorResp:Error = {
                success: false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error", 503, "error: "+e.toString());
        }
    }

    // Update a skill
    @Post('/skills/:id')
    public async updateSkill(@Header('Authorization') authorization: string, id: string, @Body() skill: any) {
        let tag = TAG + " | updateSkill | "
        try {
            let updatedSkill = await skillsDB.update({ _id: id }, skill)
            return updatedSkill
        } catch(e) {
            let errorResp:Error = {
                success: false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error", 503, "error: "+e.toString());
        }
    }

    // Delete a skill
    @Post('/skills/:id/delete')
    public async deleteSkill(@Header('Authorization') authorization: string, id: string) {
        let tag = TAG + " | deleteSkill | "
        try {
            //TODO if user owns skill
            let deletedSkill = await skillsDB.remove({ _id: id })
            return deletedSkill
        } catch(e) {
            let errorResp:Error = {
                success: false,
                tag,
                e
            }
            log.error(tag,"e: ",{errorResp})
            throw new ApiError("error", 503, "error: "+e.toString());
        }
    }




    /*
        Get Tasks
     */
    @Get('/tasks')
    public async tasks() {
        let tag = TAG + " | user | "
        try{

            let status:any = await tasksDB.find({},{limit:5})

            return(status)
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
        Get Solutions
     */
    @Get('/solutions')
    public async solutions() {
        let tag = TAG + " | user | "
        try{

            let status:any = await knowledgeDB.find({},{limit:5})

            return(status)
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
