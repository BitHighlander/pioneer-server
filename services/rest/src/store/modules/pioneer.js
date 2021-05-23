/*
    Pioneer SDK

        A ultra-light bridge to the pioneer platform

              ,    .  ,   .           .
          *  / \_ *  / \_      .-.  *       *   /\'__        *
            /    \  /    \,   ( ₿ )     .    _/  /  \  *'.
       .   /\/\  /\/ :' __ \_   -           _^/  ^/    `--.
          /    \/  \  _/  \-'\      *    /.' ^_   \_   .'\  *
        /\  .-   `. \/     \ /==~=-=~=-=-;.  _/ \ -. `_/   \
       /  `-.__ ^   / .-'.--\ =-=~_=-=~=^/  _ `--./ .-'  `-
      /        `.  / /       `.~-^=-=~=^=.-'      '-._ `._

                             A Product of the CoinMasters Guild
                                              - Highlander

      Api Docs:
        * https://pioneers.dev/docs/
      Transaction Diagram
        * https://github.com/BitHighlander/pioneer/blob/master/docs/pioneerTxs.png
 */
const TAG = ' | Pioneer | ';
import { v4 as uuidv4 } from 'uuid';
import { SDK } from '@pioneer-platform/pioneer-sdk';

let App
let Api
let events

const state = {
    testnet:false,
    blockchains:[],
    locale:"english",
    context:null,
    invocationContext:null,
    invocation: "",
    username:"",
    pioneerUrl:"",
    pioneerLive:false,
    usersOnline:[],
    coins: [],
    paths: [],
    pubkeys: [],
    apps: [],
    totalUsd: 0,
    viewSeed: "",
    layout:[],
    wallets: [],
    walletContexts: [],
    devices: [],
    allUsbDevices:[],
    allKeepKeys:[],
    keepKeyState:0,
    keepKeyStatus:"unknown",
    walletInfo: {}, //Current wallet context
    mnemonic: null,
    walltedLoaded: false,
    walletSendInfo:{},
    recentEvents:[],
    walletStart: {},
    assetLoading: false,
    txBuilding: false,
    keepkeyConnected:false
}

const getters = {
    isTestnet:state => state.testnet,
    getUsername:state => state.username,
    getTotal:state => state.totalUsd,
    // wallets:state => state.wallets,
    getWallets:state => state.wallets,
    // layout:state => state.layout,
    // devices:state => state.devices,
    getDevices:state => state.devices,
    getWalletContexts:state => state.walletContexts,
    getCoins:state => state.coins,
    // context:state => state.context,
    getContext:state => state.context,
    getKeepKeyState:state => state.keepKeyState,
    getKeepKeyStatus:state => state.keepKeyStatus,
    getInvocationContext:state => state.invocationContext,
    getInvocation:state => state.invocation,
    // getPubkeys:state => state.pubkeys,
    getPioneerLive: state => state.pioneerLive,
    getPioneerUrl: state => state.pioneerUrl,
    getMnemonic: state => state.mnemonic,
    getUsersOnline: state => state.usersOnline,
    getAllUsbDevices: state => state.allUsbDevices,
    getAllKeepKeys: state => state.allKeepKeys,
    // walletStart: (state) => state.walletStart,
    getWalletSendInfo: state => state.walletSendInfo,
    getMasterAddresses: state => state.masterAddresses,
    getBalances: state => state.balances,
    getWalletInfo: state => state.walletInfo,
    getWalletLoaded: state => state.walltedLoaded,
    getAssetLoading: state => state.assetLoading,
    getKeepkeyConnected: state => state.keepkeyConnected,
    // txBuilding: state => state.txBuilding
}

const mutations = {
    init(state, app) {
        let tag = TAG + " | init | "
        try{
            console.log("Checkpoint: init")
            let queryKey = localStorage.getItem('queryKey');
            const username = localStorage.getItem('username');
            if (!queryKey){
                queryKey = 'key:' + uuidv4();
                localStorage.setItem('queryKey', queryKey);
                state.queryKey = queryKey;
            } else {
                state.queryKey = queryKey;
            }
            if (username){
                state.username = username;
            }
            console.log({
                username:state.username,
                queryKey:state.queryKey
            })
        }catch(e){
            console.error(tag,"e: ",e)
            throw e
        }
    },
    async onStart(state, app) {
        let tag = TAG + " | onStart | "
        try{
            // TODO move SDK vars to env
            if(!state.queryKey) throw Error("102: failed to init! queryKey required")
            const config = {
                network:'mainnet',
                service: 'pioneers.dev',
                url: 'https://pioneers.dev/',
                queryKey: state.queryKey,
                // wss: 'wss://pioneers.dev',
                wss: 'ws://127.0.0.1:9001',
                // spec: 'https://pioneers.dev/spec/swagger.json'
                spec: 'http://127.0.0.1:9001/spec/swagger.json'
            };
            if (state.username) { config.username = state.username; }

            //init app
            App = new SDK(config.spec, config);
            //TODO chains from env?
            const seedChains = ['bitcoin', 'ethereum', 'thorchain', 'bitcoincash', 'binance', 'litecoin'];
            Api = await App.init(seedChains);

            //start socket
            events = await App.startSocket();

            //Listen for pairings and context changes
            events.on('message', async (event) => {
                console.log('message:', event);
                if (event.paired && event.username) {
                    state.username = event.username;
                    localStorage.setItem('username', state.username);
                }
                if (event.type === 'context') {
                    console.log('Switching context!:', event);
                    state.context = event.context;
                    await App.setContext(event.context);
                }
            })

            //get Info
            const info = await App.getUserInfo();
            console.log('info:', info);

            //
            if(info && info.error){
                //Not yet paired
                console.log('this session not yet paired with a pioneer user');
            }
        }catch(e){
            console.error(tag,"e: ",e)
            throw e
        }
    },
    // async updateInvocationInfo(state,invocationId) {
    //     let tag = TAG + " | getInvocation | "
    //     try{
    //         console.log("(pioneer) getInvocation: ",invocationId)
    //         // console.log("App: ",App)
    //         let invocation = await App.getInvocation(invocationId)
    //         console.log("(pioneer)  invocation: ",invocation)
    //         state.invocation = invocationId
    //         //state.commit('setInvocationContext',invocation)
    //     }catch(e){
    //         console.error(tag,"e: ",e)
    //         throw e
    //     }
    // },
    async updateInvocation(state, invocation) {
        let tag = TAG + " | updateInvocation | "
        try{
            // let invocationInfoRemote = await App.getInvocation(invocation)
            // console.log("invocationInfoRemote: ",invocationInfoRemote)

            //
            state.invocation = invocation
        }catch(e){
            console.error(tag,"e: ",e)
            throw e
        }
    },
    setBlockchains(state, blockchains) {
        state.blockchains = blockchains
    }
}

const actions = {
    fetchData ({ commit },invocation) {
        console.log("invocation: ",invocation)
        App.getInvocation(invocation).then(function (response) {
            console.log("invocation response: ",response)
            commit('updateInvocation', response)
        }, function () {
            console.log('error')
        })
    }
    // async updateInvocation ({ commit },invocationId) {
    //     commit('setInvocationContext',await setInvocationContext(invocationId))
    // }
}


export default {
    state,
    getters,
    actions,
    mutations
}
