/*
    Liveness probe G1

    Goals:
        *


 */
const TAG = " | liveness | "
require("dotenv").config({path:'./../../.env'})
const log = require('@foxcookieco/pioneer-loggerdog-client')()
//let network = require("@foxcookieco/pioneer-monero-network")
//network.init('full')


const check_liveness = async function(){
    let tag = TAG + " | check_liveness | "
    try{
        process.exit(0)

        // let walletInfo = await network.getWalletInfo()
        // log.debug(tag,"walletInfo: ",walletInfo)
        //
        //
        // if(walletInfo){
        //     log.debug(tag," SERVICE IS LIVE!")
        //     process.exit(0)
        // } else {
        //     log.debug(tag," FAIL LIVENESS TEST!")
        //     process.exit(0)
        // }
    }catch(e){
        log.error(tag,"error: ",e)
        process.exit(1)
    }
}
check_liveness()
