require('dotenv').config()
require('dotenv').config({path:"./.env"})
require('dotenv').config({path:"./../.env"})
require('dotenv').config({path:"./../../.env"})
require('dotenv').config({path:"../../../.env"})
require('dotenv').config({path:"../../../../.env"})
require('dotenv').config({path:"./../../../../.env"})

const pjson = require('../package.json');
const TAG = " | "+ pjson.name +" | "
const log = require('@pioneer-platform/loggerdog')()
const {subscriber, publisher, redis} = require('@pioneer-platform/default-redis')
const cors = require('cors')
import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as methodOverride from 'method-override';

import { RegisterRoutes } from './routes/routes';  // here
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../api/dist/swagger.json')
// const metrics = require('datadog-metrics');
let os = require('os')
// metrics.init({ host: os.hostname(), prefix: pjson.name });
log.info("BEGIN SERVER")
// let connection  = require("@pioneer-platform/default-mongo")
// let marketsDB = connection.get('markets')
// marketsDB.createIndex({id: 1}, {unique: true})

//Rate limiter options
//https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example#create-simple-rate-limiter-and-consume-points-on-entry-point
const { RateLimiterRedis } = require('rate-limiter-flexible');

const app = express();
const server = require('http').Server(app);
let API_PORT:any = process.env["API_PORT_PIONEER"] || "80"
log.info("API_PORT",API_PORT)
API_PORT = parseInt(API_PORT)

let RATE_LIMIT_RPM = parseInt(process.env["RATE_LIMIT_TPS"]) || 500

//limiter
const rateLimiterRedis = new RateLimiterRedis({
    storeClient: redis,
    points: RATE_LIMIT_RPM, // Number of points
    duration: 1, // Per second
});
// let PIONEER_SPEC = process.env['PIONEER_SPEC'] || 'http://127.0.0.1:9001/spec/swagger.json'
// log.debug("PIONEER_SPEC",PIONEER_SPEC)
// process.env['PIONEER_SPEC'] = PIONEER_SPEC

// const loggerDogMiddleWare = async (req, res, next) => {
//     try{
//         //
//         console.log("path",req.path)
//         metrics.increment('requests:total');
//         metrics.increment('path:'+req.path);
//         next();
//     }catch(e){
//         console.error(e)
//     }
// };


//TODO handle broke redis
// ReplyError: MISCONF Redis is configured
// This is commented because of Too many bug, but its not a too many, its a fucking broke server
//TODO add rate limiting back
// const WHITELIST_CACHE = []
// const rateLimiterMiddleware = async (req, res, next) => {
//     try{
//         if(req.headers.authorization){
//             let auth = req.headers.authorization
//             log.debug('path: ',req.url)
//             let path = req.path
//             if(auth.indexOf('Bearer ')) auth.replace('Bearer ','')
//
//             //if in cache
//             if(WHITELIST_CACHE.indexOf(auth)){
//                 next();
//             } else {
//                 let isWhitelisted = await redis.sismember("PIONEER_WHITELIST_KEYS",auth)
//                 if(isWhitelisted){
//                     WHITELIST_CACHE.push(auth)
//                     next();
//                 } else {
//                     rateLimiterRedis.consume(req.ip)
//                         .then(() => {
//                             next();
//                         })
//                         .catch(_ => {
//                             res.status(429).send('Too Many Requests');
//                         });
//                 }
//             }
//         } else {
//             rateLimiterRedis.consume(req.ip)
//                 .then(() => {
//                     next();
//                 })
//                 .catch(_ => {
//                     res.status(429).send('Too Many Requests');
//                 });
//         }
//     }catch(e){
//         console.error(e)
//     }
// };

let corsOptions = {
    origin: '*',
}
log.info("DEBUG checkpoint0")
app.use(cors(corsOptions))
// app.use(loggerDogMiddleWare);
// app.use(rateLimiterMiddleware);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());

//socket
let SOCKET_MAX_CONNECTIONS = parseInt(process.env["SOCKET_MAX_CONNECTIONS"]) || 200
log.info("DEBUG checkpoint1")
//socket-io
// let io = require('socket.io')(server,{cors: {origin:'*'}});
// io.sockets.setMaxListeners(SOCKET_MAX_CONNECTIONS);

//web
app.use('/',express.static('frontend/dist'));

//docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

//swagger.json
app.use('/spec', express.static('api/dist'));

app.use('/coins', express.static('coins'));

log.info("DEBUG checkpoint2")

//REST API v1
RegisterRoutes(app);  // and here

// //globals
// let globalSockets = {}
// let usersBySocketId = {}
// let usersByUsername = {}
// let usersByKey = {}
// let channel_history_max = 10;
//
// //broadcast
// subscriber.subscribe('blocks');
//
// //private
// subscriber.subscribe('payments');
// subscriber.subscribe('pairings');
// subscriber.subscribe('invocations');
// subscriber.subscribe('pioneer');
// subscriber.subscribe('bankless');
//
// subscriber.on('message', async function (channel, payloadS) {
//     let tag = TAG + ' | publishToFront | ';
//     try {
//         log.debug(tag,channel+ " event: ",payloadS)
//         //Push event over socket
//         if(channel === 'payments'){
//             let payload = JSON.parse(payloadS)
//             log.debug(tag,"payments: ",payload)
//             if(!payload.accounts) return
//             //for each username
//             for(let i = 0; i < payload.accounts.length; i++){
//                 let username = payload.accounts[i]
//
//                 //if subscribed
//                 if(usersByUsername[username]){
//                     log.debug(tag," User is subscribed! username: ",username)
//
//                     log.debug(tag,"usersByUsername: ",usersByUsername)
//                     //log.debug(tag,"globalSockets: ",globalSockets)
//                     log.debug(tag,"usersBySocketId: ",usersBySocketId)
//
//                     let sockets = usersByUsername[username]
//                     log.debug(tag,"sockets: ",sockets)
//                     for(let i =0; i < sockets.length; i++){
//                         let socketid = sockets[i]
//                         //push tx to user
//                         log.debug(tag,"socketid: ",socketid)
//                         if(globalSockets[socketid]){
//
//                             let tx = payload
//                             let type
//                             let from
//                             let to
//                             let amount
//                             let fee
//                             log.debug(tag,"tx: ",tx)
//                             for(let j = 0; j < tx.events.length; j++){
//
//                                 let event = tx.events[j]
//                                 log.debug(tag,"event: ",event)
//                                 let addressInfo = await redis.smembers(event.address+":accounts")
//
//                                 if(addressInfo.indexOf(username) >= 0 && event.type === 'debit'){
//                                     type = 'send'
//                                 }
//                                 if(addressInfo.indexOf(username) >= 0 && event.type === 'credit'){
//                                     type = 'receive'
//                                 }
//
//                                 if(event.type === 'debit' && !event.fee){
//                                     from = event.address
//                                 }
//                                 if(event.type === 'debit' && event.fee){
//                                     fee = {
//                                         asset:tx.asset
//                                     }
//                                 }
//                                 if(event.type === 'credit'){
//                                     to = event.address
//                                     amount = event.amount
//                                 }
//                             }
//
//                             //default (TODO dont do this)
//                             if(!fee){
//                                 fee = {
//                                     "amount": 0.0002,
//                                     "asset": "ETH"
//                                 }
//                             }
//
//                             let summary = {
//                                 type,
//                                 asset:tx.asset,
//                                 from,
//                                 to,
//                                 amount,
//                                 fee,
//                                 txid:tx.txid,
//                                 height:tx.height,
//                                 time:tx.time
//                             }
//
//                             globalSockets[socketid].emit('payments', summary);
//                         } else {
//                             log.error("Socket not found? socketid: ",socketid)
//                         }
//                     }
//                 } else {
//                     log.debug(tag," Payment to offline user! ")
//                 }
//             }
//         } else if(channel === 'invocations'){
//             let invocation = JSON.parse(payloadS)
//             log.debug(tag,"invocation: ",invocation)
//             //send to user
//             let username = invocation.username
//             if(!username) throw Error("username required!")
//
//             if(usersByUsername[username]){
//                 let sockets = usersByUsername[username]
//                 for(let i =0; i < sockets.length; i++){
//                     let socketid = sockets[i]
//                     if(globalSockets[socketid]){
//                         globalSockets[socketid].emit('invocations', invocation);
//                     }
//                 }
//             } else {
//                 log.error("User is not connected! username: ",username," online: ",usersByUsername)
//                 //throw Error("User is not connected!")
//             }
//         }else if(channel === 'pairings'){
//             let pairing = JSON.parse(payloadS)
//             log.debug(tag,"pairing: ",pairing)
//             //send to user
//             let queryKey = pairing.queryKey
//             log.debug(tag,"usersByKey: ",usersByKey)
//             if(usersByKey[queryKey]){
//                 log.debug(tag,"key found! ")
//                 let sockets = usersByKey[queryKey]
//                 log.debug(tag,"sockets: ",sockets)
//                 for(let i =0; i < sockets.length; i++){
//                     let socketid = sockets[i]
//                     if(globalSockets[socketid]){
//                         pairing.type = "pairing"
//                         //TODO remove message
//                         globalSockets[socketid].emit('pairings', pairing);
//                         log.debug(tag,socketid+ " sending message to user! msg: ",pairing)
//                     }
//                 }
//             } else {
//                 log.error("apiKey is not connected! queryKey: ",queryKey," online: ",usersByKey)
//                 //throw Error("User is not connected!")
//             }
//         }else if(channel === 'context'){
//             let context = JSON.parse(payloadS)
//             log.debug(tag,"context: ",context)
//             log.debug(tag,"context: ",context.username)
//             log.debug(tag,"usersByUsername: ",usersByUsername)
//             log.debug(tag,"usersByKey: ",usersByKey)
//             //usersBySocketId
//             log.debug(tag,"usersBySocketId: ",usersBySocketId)
//
//             //send to keys
//             let queryKeys = await redis.smembers(context.username+":pairings")
//             log.debug(tag,"queryKey")
//             for(let i = 0; i < queryKeys.length; i++){
//                 let queryKey = queryKeys[i]
//                 if(usersByKey[queryKey]){
//                     let sockets = usersByKey[queryKey]
//                     log.debug(tag,"sockets: ",sockets)
//                     for(let j =0; j < sockets.length; j++){
//                         let socketid = sockets[j]
//                         if(globalSockets[socketid]){
//                             context.event = 'context'
//                             globalSockets[socketid].emit('context', context);
//                             log.debug(tag,socketid+ " sending message to user! msg: ",context)
//                         }
//                     }
//                 }
//             }
//
//             //send to users
//             if(usersByUsername[context.username]){
//                 let sockets = usersByUsername[context.username]
//                 log.debug(tag,"sockets: ",sockets)
//                 for(let i =0; i < sockets.length; i++){
//                     let socketid = sockets[i]
//                     if(globalSockets[socketid]){
//                         context.event = 'context'
//                         globalSockets[socketid].emit('context', context);
//                         log.debug(tag,socketid+ " sending message to user! msg: ",context)
//                     }
//                 }
//             }
//         } else if(channel === 'pioneer'){
//             //push message to user
//             let context = JSON.parse(payloadS)
//             log.debug(tag,"context: ",context)
//             log.debug(tag,"context: ",context.username)
//             log.debug(tag,"usersByUsername: ",usersByUsername)
//
//             //send to user
//             if(usersByUsername[context.username]){
//                 let sockets = usersByUsername[context.username]
//                 log.debug(tag,"sockets: ",sockets)
//                 for(let i =0; i < sockets.length; i++){
//                     let socketid = sockets[i]
//                     if(globalSockets[socketid]){
//                         context.event = 'context'
//                         globalSockets[socketid].emit('message', context);
//                         log.debug(tag,socketid+ " sending message to user! msg: ",context)
//                     }
//                 }
//             } else {
//                 log.error("User is offline!")
//             }
//         } else if(channel === 'bankless'){
//             //push message to user
//             let context = JSON.parse(payloadS)
//             log.debug(tag,"context: ",context)
//             log.debug(tag,"context: ",context.terminalName)
//             log.debug(tag,"usersByUsername: ",usersByUsername)
//             let terminalName = context.payload.terminalName
//             //send to user
//             if(usersByUsername[terminalName]){
//                 let sockets = usersByUsername[terminalName]
//                 log.debug(tag,"sockets: ",sockets)
//                 for(let i =0; i < sockets.length; i++){
//                     let socketid = sockets[i]
//                     if(globalSockets[socketid]){
//                         context.event = 'context'
//                         globalSockets[socketid].emit('message', context);
//                         log.debug(tag,socketid+ " sending message to terminalId! msg: ",context)
//                     }
//                 }
//             } else {
//                 log.error("terminal is offline!")
//             }
//         } else {
//             log.error("unhandled channel! channel: ",channel)
//         }
//
//         let globals = [
//             'blocks'
//         ]
//
//         if(channel.indexOf(globals) >= 0){
//             log.debug(tag,"Pushing event to global users!")
//             io.emit('message', payloadS);
//             io.emit(channel, payloadS);
//         }
//
//     } catch (e) {
//         log.error(tag, e);
//         throw e
//     }
// });
log.info("DEBUG checkpoint3")
/**
 *
 * subscribe to Payments
 *       Socket.io
 *
 *       Goals:
 *          * User subs to individual feed
 *          * announce when online
 *
 *
 */

// io.on('connection', async function(socket){
//     let tag = TAG + ' | io connection | '
//     log.debug(tag,'a user connected', socket.id," user: ",usersByUsername[socket.id]);
//     redis.sadd("online:users",socket.id)
//     redis.hincrby("globals","usersOnline",Object.keys(usersByUsername).length)
//
//     //set into global
//     globalSockets[socket.id] = socket
//
//     socket.on('disconnect', function(){
//         let username = usersBySocketId[socket.id]
//         log.debug(tag,socket.id+" username: "+username+' disconnected');
//         redis.srem('online',username)
//         //remove socket.id from username list
//         if(usersByUsername[username])usersByUsername[username].splice(usersByUsername[username].indexOf(socket.id), 1);
//         delete globalSockets[socket.id]
//         delete usersBySocketId[socket.id]
//         redis.hset("globals","usersOnline",Object.keys(usersByUsername).length)
//     });
//
//     socket.on('join', async function(msg){
//         log.debug(tag,'**** Join event! : ', typeof(msg));
//         //if(typeof(msg) === "string") msg = JSON.parse(msg)
//         log.debug(tag,"message: ",msg)
//
//         let queryKey = msg.queryKey
//         if(queryKey && msg.username){
//             log.debug(tag,"GIVEN: username: ",msg.username)
//             //get pubkeyInfo
//             let queryKeyInfo = await redis.hgetall(queryKey)
//             log.debug(tag,"ACTUAL: username: ",queryKeyInfo.username)
//             if(queryKeyInfo.username === msg.username){
//                 log.debug(tag,"session valid starting!")
//                 log.debug(tag,"socket.id: ",socket.id)
//                 log.debug(tag,"msg.username: ",msg.username)
//                 usersBySocketId[socket.id] = msg.username
//                 if(!usersByUsername[msg.username]) usersByUsername[msg.username] = []
//                 usersByUsername[msg.username].push(socket.id)
//                 redis.sadd('online',msg.username)
//                 let subscribePayload = {
//                     socketId:socket.id,
//                     success:true,
//                     username:msg.username
//                 }
//                 globalSockets[socket.id].emit('subscribedToUsername', subscribePayload);
//             } else if(queryKeyInfo.username && queryKeyInfo.username !== msg.username) {
//                 log.error(tag,"Failed to join! pubkeyInfo.username: "+queryKeyInfo.username+" msg.username: "+msg.username)
//                 let error = {
//                     code:6,
//                     msg:"(error) Failed to join! pubkeyInfo.username: "+queryKeyInfo.username+" msg.username: "+msg.username
//                 }
//                 globalSockets[socket.id].emit('errorMessage', error);
//             }else if(!queryKeyInfo.username){
//                 //new queryKey
//                 //register Username
//                 log.debug(tag,"New queryKey! msg.username: ",msg.username)
//                 await redis.hset(queryKey,"username",msg.username)
//                 await redis.hset(msg.username,"queryKey",queryKey)
//                 usersBySocketId[socket.id] = msg.username
//                 if(!usersByUsername[msg.username]) usersByUsername[msg.username] = []
//                 usersByUsername[msg.username].push(socket.id)
//                 redis.sadd('online',msg.username)
//                 let subscribePayload = {
//                     socketId:socket.id,
//                     success:true,
//                     username:msg.username
//                 }
//                 globalSockets[socket.id].emit('subscribedToUsername', subscribePayload);
//             } else {
//                 log.error(tag,"Failed to join! pubkeyInfo.username: "+queryKeyInfo.username+" msg.username: "+msg.username)
//                 let error = {
//                     code:7,
//                     msg:"Failed to join! unknown queryKey!"
//                 }
//                 globalSockets[socket.id].emit('errorMessage', error);
//             }
//
//         } else if(msg.queryKey){
//             log.debug(tag,"No username given! subbing to queryKey!")
//             if(!usersByKey[msg.queryKey]) {
//                 usersByKey[msg.queryKey] = [socket.id]
//             } else {
//                 usersByKey[msg.queryKey].push(socket.id)
//             } //edge case multiple sockets on same key, push to all
//             let connectPayload = {
//                 success:true,
//             }
//             globalSockets[socket.id].emit('connected', connectPayload);
//             log.debug(tag,"sdk subscribed to apiKey: ",msg.queryKey)
//             log.debug(tag,"usersByKey: ",usersByKey)
//         } else {
//             log.error(tag,"invalid join request! ")
//         }
//     });
//
//     socket.on('event', function(msg){
//         log.debug(tag,'event ****************: ' + msg);
//     })
//     socket.on('message', function(msg){
//         log.debug(tag,'message ****************: ' , msg);
//         if(msg.actionId){
//             //actionId
//             redis.lpush(msg.actionId,JSON.stringify(msg))
//         }
//     })
//
//     socket.on('error', function(msg){
//         log.error(tag,'error message ****************: ' , msg);
//     })
// });
log.info("DEBUG checkpoint4")
let subsribe_to_payments = async function () {
    try{
        //@TODO
        //User goes online

        //get all pubkeys

        //subscribe to all pubkeys
    }catch(e){
        console.error(e)
    }
}

//Error handeling
function errorHandler (err, req, res, next) {
    if (res.headersSent) {
        return next(err)
    }
    log.error("ERROR: ",err)
    res.status(400).send({
        message: err.message,
        error: err
    });
}
app.use(errorHandler)

let start_server = async function () {
    let tag = TAG + " | start_server | "
    try {
        log.info("DEBUG checkpoint PRE")
        //clear online
        // await redis.del("online")
        log.info("DEBUG checkpoint PRE")
        server.listen(API_PORT, () => console.log(`Server started listening to port ${API_PORT}`));
        //TODO handle exit

        return true
    }catch(e){
        log.error(tag,"e: ",e)
        throw e
    }
}
start_server()
