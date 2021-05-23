
/*
    Deployment info

    ENV verification

    deployment description
 */


let packageInfo = require("./package.json")
const TAG = " |"+packageInfo.name+"|  "

let ENV_VARS = [
    'NODE_ENV',
    'DATADOG_API_KEY',
    'REDIS_CONNECTION',
    'MONGO_CONNECTION',
    'VERSION',
]

let ENV_VAR_LONG = []
for(let i = 0; i < ENV_VARS.length;i++){
    ENV_VAR_LONG.push({name:ENV_VARS[i],value:process.env[ENV_VARS[i]]})
}
ENV_VAR_LONG.push({name:"DEFAULT_LOG_LEVEL",value:"DEBUG"})
let ingress

let deployment = {
    envs:['stage','prod'],
    deploy:true,
    tier:2,
    replicas:1,
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
    ingress:true,
    ingressURL:"pioneer-services",
    tests:[
        {
            "description":"Primary pioneer services. register/balances/events",
            "path":"../pioneer.int.spec.js",
            "blocking":false,
            "timeout":"",
            "averageTime":""
        }
    ],
    env:ENV_VAR_LONG
}

/*
    Main

 */

const init_deploy = function () {
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

init_deploy()
//create project
