<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-img height=50px width=50px src="../assets/citadel.png"></q-img>
        <q-toolbar-title>
          Citadels.io
        </q-toolbar-title>
        <div>total assets value (USD): {{totalValueUsd}}</div>
        <br/>
<!--        <div>API v{{ $q.version }}</div>-->

      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>

//Pioneer SDK
let App = require("@pioneer-platform/pioneer-sdk")
const axios = require('axios')

export default {
  name: 'MainLayout',

  components: {
  },
  data() {
    return {
      isLoggedIn: false,
      totalValueUsd: 0
    }
  },
  async mounted() {
    try{
      console.log("process.env",process.env)
      const newAccounts = await ethereum.request({
        method: 'eth_requestAccounts',
      })

      console.log("newAccounts: ",newAccounts)

      let domain = location.toString()

      let account = newAccounts[0]

      //TODO use env
      //let urlSpec = "http://127.0.0.1:9001/spec/swagger.json"
      let urlSpec = "https://pioneers.dev/spec/swagger.json"

      if(account){
        let config = {
          addresses:newAccounts,
          domain,
          spec:urlSpec
        }

        //init
        let app = new App('testapp',config)

        //init metamask
        let info = await app.init()
        console.log("total Value: ",info.totalValueUsd)
        this.totalValueUsd = info.totalValueUsd
      }


    }catch(e){
      console.error(e)
    }
  },
  methods: {
    onItemClick () {
      console.log('Clicked on an Item')


    },
    onLogin () {
      console.log('onlogin')

    },
    onLogout () {
      console.log('logging out')

    }
  }
}
</script>
