/*
    Update

 */
require("dotenv").config({path:'./../.env'})
require("dotenv").config({path:'./../../.env'})
require("dotenv").config({path:'../../../.env'})
require("dotenv").config({path:'../../../../.env'})

let Leeroy = require("@pioneer-platform/leeroy-sdk")
let leeroy = new Leeroy({
    publicKey:process.env['LEEROY_API_PUBLIC'],
    privateKey:process.env['LEEROY_API_PRIVATE']
})

let urlSpec = process.env['LEEROY_SERVER_SPEC']

console.log({urlSpec})
let rollout = async function(){
    try{
        await leeroy.init(urlSpec,{})

        let podInfo = await leeroy.rollout()
        console.log("rollout: ",podInfo)

    }catch(e){
        console.error(e)
        if(e.isAxiosError){
            console.error(Object.keys(e))
            console.error(e.response.data.message)
            console.error(e.response.data.error)
        } else {
            console.error(e)
        }

    }
}

rollout()
