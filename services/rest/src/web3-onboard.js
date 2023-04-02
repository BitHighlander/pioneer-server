

import walletConnectModule from '@web3-onboard/walletconnect'
import injectedModule from '@web3-onboard/injected-wallets'
import { init } from '@web3-onboard/react'


const INFURA_KEY = 'fb05c87983c4431baafd4600fd33de7e'

const walletConnect = walletConnectModule()

const injected = injectedModule({
    custom: [
        // include custom injected wallet modules here
    ],
    filter: {
        // mapping of wallet labels to filter here
    }
})



export default init({
    // An array of wallet modules that you would like to be presented to the user to select from when connecting a wallet.
    wallets: [
        injected,
        walletConnect
    ],
    // An array of Chains that your app supports
    chains: [
        {
            // hex encoded string, eg '0x1' for Ethereum Mainnet
            id: '0x1',
            // string indicating chain namespace. Defaults to 'evm' but will allow other chain namespaces in the future
            namespace: 'evm',
            // the native token symbol, eg ETH, BNB, MATIC
            token: 'ETH',
            // used for display, eg Ethereum Mainnet
            label: 'Ethereum Mainnet',
            // used for network requests
            rpcUrl: `https://mainnet.infura.io/v3/${INFURA_KEY}`
        },
        {
          id: '0x3',
          token: 'tROP',
          label: 'Ethereum Ropsten Testnet',
          rpcUrl: `https://ropsten.infura.io/v3/${INFURA_KEY}`
        },
        // {
        //   id: '0x4',
        //   token: 'rETH',
        //   label: 'Ethereum Rinkeby Testnet',
        //   rpcUrl: `https://rinkeby.infura.io/v3/${INFURA_KEY}`
        // },
        // {
        //   id: '0x89',
        //   token: 'MATIC',
        //   label: 'Matic Mainnet',
        //   rpcUrl: 'https://matic-mainnet.chainstacklabs.com'
        // }
    ],
    appMetadata: {
        // The name of your dApp
        name: 'Pioneers',
        // SVG icon string, with height or width (whichever is larger) set to 100% or a valid image URL
        icon: '<svg></svg>',
        // Optional wide format logo (ie icon and text) to be displayed in the sidebar of connect modal. Defaults to icon if not provided
        logo: '<svg></svg>',
        // The description of your app
        description: 'Pioneer Developer Program',
        // The url to a getting started guide for app
        gettingStartedGuide: 'http://mydapp.io/getting-started',
        // url that points to more information about app
        explore: 'https://pioneers.dev',
        // if your app only supports injected wallets and when no injected wallets detected, recommend the user to install some
        recommendedInjectedWallets: [
            {
                // display name
                name: 'MetaMask',
                // link to download wallet
                url: 'https://metamask.io'
            }
        ],
        // Optional - but allows for dapps to require users to agree to TOS and privacy policy before connecting a wallet
        // agreement: {
        //   version: '1.0.0',
        //   termsUrl: 'https://www.blocknative.com/terms-conditions',
        //   privacyUrl: 'https://www.blocknative.com/privacy-policy'
        // }
    }
})
