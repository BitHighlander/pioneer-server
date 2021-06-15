/*
    Onboard.js
            -Powered by blocknative

      Docs:
        *
 */
import {initOnboard} from "../../modules/services";
import { ethers } from 'ethers'
import getSigner from '../../modules/signer'

const TAG = ' | onboard | ';


let App
let provider
let events
let WALLET_TYPE

const state = {
    testnet:false,
}

const getters = {
    isTestnet:state => state.testnet,

}

const mutations = {
    init(state, app) {
        App = initOnboard({
            address: setAddress,
            network: setNetwork,
            balance: setBalance,
            wallet: wallet => {
                if (wallet.provider) {
                    setWallet(wallet)

                    const ethersProvider = new ethers.providers.Web3Provider(
                        wallet.provider
                    )

                    provider = ethersProvider

                    //window.localStorage.setItem('selectedWallet', wallet.name)
                } else {
                    provider = null
                    setWallet({})
                }
            }
        })

        console.log("onboard: ",App)

    },
    async onStart(state, app) {
        let tag = TAG + " | onStart | "
        try{
            //

        }catch(e){
            console.error(tag,"e: ",e)
            throw e
        }
    },
    setKeepKeyState(state, stateKeepKey) {
        state.keepKeyState = stateKeepKey
    },
}

const actions = {
    fetchData ({ commit },invocation) {
        console.log("invocation: ",invocation)

    }
}


export default {
    state,
    getters,
    actions,
    mutations
}
