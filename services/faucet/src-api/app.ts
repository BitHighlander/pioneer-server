/*
    Primary Application Module

      Pioneer Platform

          -highlander
 */

const TAG = ' | APP | '
import {checkConfigs, getConfig, innitConfig, updateConfig} from "@pioneer-platform/pioneer-config";
const CryptoJS = require("crypto-js")
const bip39 = require(`bip39`)
const App = require("@pioneer-platform/pioneer-app");
const figlet = require('figlet');
const bcrypt = require("bcryptjs");
const chalk = require("chalk");
let wait = require('wait-promise');
let sleep = wait.sleep;
const log = require('electron-log');
const generator = require('generate-password');

//Globals
let WALLETS_LOADED = []
let WALLET_LOADED = {}
let WALLET_CONTEXT = 0
let FIO_ACCEPT = false
let FIO_REJECT = false
let PASSWORDLESS_ENABLE = false
let WALLET_PASSWORD
let WALLET_HASH
let USERNAME
let PRIMARY_VAULT
let FIRST_START = true

function standardRandomBytesFunc(size) {
    /* istanbul ignore if: not testable on node */
    return CryptoJS.lib.WordArray.random(size).toString()
}

//feature flags
let featureSoftwareCreate = process.env['CREATE_SOFTWARE_FEATURE']
let featurePasswordless = process.env['PASSWORDLESS_FEATURE']
let featureInsecurePassword = process.env['INSECURE_PASSWORD']


export async function onStart(event,data) {
    let tag = TAG + " | onStart | ";
    try {

        log.info(tag," onStart() ")
        if(FIRST_START){
            //Print banner
            log.info(  chalk.red(
                figlet.textSync('Pioneer-Native', { horizontalLayout: 'full' })
            ))
            log.info(
                "\n \n \n        ,    .  ,   .           .\n" +
                "    *  / \\_ *  / \\_      " +
                chalk.yellowBright(".-.") +
                "  *       *   /\\'__        *\n" +
                "      /    \\  /    \\,   " +
                chalk.yellowBright("( ₿ )") +
                "     .    _/  /  \\  *'.\n" +
                " .   /\\/\\  /\\/ :' __ \\_  " +
                chalk.yellowBright(" - ") +
                "          _^/  ^/    `--.\n" +
                "    /    \\/  \\  _/  \\-'\\      *    /.' ^_   \\_   .'\\  *\n" +
                "  /\\  .-   `. \\/     \\ /==~=-=~=-=-;.  _/ \\ -. `_/   \\\n" +
                " /  `-.__ ^   / .-'.--\\ =-=~_=-=~=^/  _ `--./ .-'  `-\n" +
                "/        `.  / /       `.~-^=-=~=^=.-'      '-._ `._"
            );
            FIRST_START = false
        }

        // let configStatus = checkConfigs()
        // let config = await App.getConfig()
        // log.info(tag,"config: ",config)
        // log.debug(tag,"configStatus() | configStatus: ", configStatus)
        //
        // if(data.password){
        //     config.temp = data.password
        //     WALLET_PASSWORD = data.password
        //     if(featureInsecurePassword){
        //         //write password to file (auto-login)
        //         //NOTE: it is bad form to store USER passwords on disk
        //         //however: it is accepted to store generated passwords on disk
        //         await App.updateConfig({temp: data.password});
        //     }
        // }
        //
        // if(!config){
        //     //TODO prompt language?
        //     //make config
        //     await App.initConfig("english");
        //     await App.updateConfig({created: new Date().getTime()});
        //     config = await App.getConfig()
        //
        //     //TODO when pioneer local node working
        //     //event.sender.send('navigation',{ dialog: 'Create', action: 'open'})
        //
        //     //navigate to setup
        //     event.sender.send('navigation',{ dialog: 'Setup', action: 'open'})
        //
        //     return true
        // }
        //
        // if(config && !config.promptedPasswordless){
        //     //log.info(tag," offer encryption ")
        //     //TODO
        //     //event.sender.send('navigation',{ dialog: 'PasswordCreate', action: 'open'})
        //     //return true
        // }
        //
        //
        // if(config && !config.promptedFio){
        //     //TODO opt in to FIO
        // }
        //
        // //if pioneer api found
        // // let url = await pioneer.url()
        // // log.debug("url: ",url)
        // //
        // // let health = await pioneer.health()
        // // log.info("health: ",health)
        //
        // //if online
        // // if(health.online){
        // //   //TODO state online
        // //
        // // }
        //
        // // if(!config.username){
        // //   //create username
        // //   let randomChars = generator.generateMultiple(1, {
        // //     length: 10,
        // //     uppercase: false
        // //   });
        // //   USERNAME = "temp:"+randomChars[0]
        // //   config.username = USERNAME
        // //   await App.updateConfig({username:USERNAME});
        // // } else {
        // //   USERNAME = config.username
        // // }
        //
        // if(!config.temp && config.passwordHash && !WALLET_PASSWORD){
        //     WALLET_HASH = config.passwordHash
        //     event.sender.send('navigation',{ dialog: 'Unlock', action: 'open'})
        //     return
        // } else if(config.temp) {
        //     WALLET_PASSWORD = config.temp
        // } else {
        //     //generate password
        //     if(featurePasswordless){
        //         log.info(tag,"featurePasswordless TRUE")
        //         //create password
        //         let randomChars = generator.generateMultiple(1, {
        //             length: 10,
        //             uppercase: false
        //         });
        //         WALLET_PASSWORD = randomChars[0]
        //         await App.updateConfig({temp:WALLET_PASSWORD});
        //     } else {
        //         //get password
        //         event.sender.send('navigation',{ dialog: 'Unlock', action: 'open'})
        //         return true
        //     }
        // }
        // if(!WALLET_PASSWORD) throw Error("Error: Password required! ")
        //
        // //get wallet files
        // let walletFiles = await App.getWalletNames()
        // log.info("walletFiles: ",walletFiles)
        //
        // if(!config.spec){
        //     //config.spec = process.env['URL_PIONEER_SPEC'] || "https://pioneers.dev/spec/swagger.json"
        //     config.spec = "https://pioneers.dev/spec/swagger.json"
        // }
        //
        // if(walletFiles.length === 0){
        //     //Always have atleast 1 wallet!
        //     log.info(" No Wallets found! ")
        //
        //     return true
        // }
        //
        // let isTestnet
        // //if feature flag mainnet
        // if(process.env['MAINNET_FEATURE']){
        //     //TODO offer promt?
        // } else {
        //     isTestnet = true
        //     config.isTestnet = isTestnet
        // }
        //
        //
        // //start App
        // if(!WALLET_PASSWORD) throw Error("unable to start! missing, WALLET_PASSWORD")
        // config.password = WALLET_PASSWORD
        // log.info(tag,"config: ",config)
        // let resultInit = await App.init(config)
        // log.info("resultInit: ",resultInit)
        // event.sender.send('init',resultInit)
        // event.sender.send('navigation',{ dialog: 'Connect', action: 'close'})
        //
        // let wallets = App.getWallets()
        //
        //
        // //TODO is context pref in config?
        //
        // //set primary context
        // let context = wallets[0]
        // WALLETS_LOADED = context

        //load masters
        // let info = await context.getInfo()
        // log.info("info: ",info)

        //Start wallet interface


    } catch (e) {
        console.error(tag, "e: ", e);
        return {error:e};
    }
}
