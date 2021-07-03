/*
    Liveness probe G1

    Goals:
        *


 */
const TAG = " | liveness | "
require("dotenv").config({path:'./../../.env'})
const log = require('@pioneer-platform/loggerdog')()


const check_liveness = async function(){
    let tag = TAG + " | check_liveness | "
    try{
        process.exit(0)

    }catch(e){
        log.error(tag,"error: ",e)
        process.exit(1)
    }
}
check_liveness()
