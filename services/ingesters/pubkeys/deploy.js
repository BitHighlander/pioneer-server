
/*
    Deployment info

    ENV verification

    deployment description
 */


let packageInfo = require("./package.json")
const TAG = " |"+packageInfo.name+"|  "
let ASSET = "ETH"
let ASSET_LONG = 'ETH'
let ENV_VARS = [
    'NODE_ENV',
    'DATADOG_API_KEY',
    'BLOCK_RATE_LIMITER_BNB',
    'REDIS_CONNECTION',
    'MONGO_CONNECTION',
    'PARITY_ARCHIVE_NODE',
    'ETHERSCAN_API_KEY'
]

let ENV_VAR_LONG = []
ENV_VAR_LONG.push({name:"ASSET",value:ASSET})
for(let i = 0; i < ENV_VARS.length;i++){
    ENV_VAR_LONG.push({name:ENV_VARS[i],value:process.env[ENV_VARS[i]]})
}

// ENV_VAR_LONG.push({name:"DEFAULT_LOG_LEVEL",value:"DEBUG"})

module.exports = {
    init: function () {
        return init_deploy();
    },
    envs:['stage','prod'],
    deploy:false,
    tier:2,
    replicas:2,
    limits: {
        cpu: '256m',
        memory: '256M'
    },
    requests: {
        cpu: '50m',
        memory: '128M'
    },
    liveness:{
        exec: {
            command: ['node', 'isLive.js']
        },
        initialDelaySeconds: 5,
        periodSeconds: 5, // probe once every X seconds
        failureThreshold: 1 // try period * failureThreshold # of times
    },
    readyness:{
        exec: {
            command: ['node', 'isReady.js']
        },
        initialDelaySeconds: 10,
        periodSeconds: 10, // probe once every X seconds
        failureThreshold: 1 // try period * failureThreshold # of times
    },
    context:__dirname,
    asset:ASSET,
    name:packageInfo.name,
    version:packageInfo.version,
    featureFlags:[],
    services:[],
    env:ENV_VAR_LONG
}

/*
    Main

 */

const init_deploy = async function () {
    let tag = TAG + " | init_deploy | "
    try {

        for(let i = 0; i < ENV_VARS.length;i++){
            if(!process.env[ENV_VARS[i]]) throw Error("missing ENV var: "+ENV_VARS[i])
        }

        return true
    } catch (e) {
        console.error(tag, "e: ", e)
        throw e
    }
}
