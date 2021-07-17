<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-img height=50px width=50px src="../assets/greenCompas.png"></q-img>
        <q-toolbar-title>
          Pioneer
        </q-toolbar-title>
<!--        <div>total assets value (USD): {{totalValueUsd}}</div>-->

        <div v-if="!paired">
          <q-btn-dropdown
            label="Pair a Wallet!"
          >
            <q-list>
              <q-item clickable v-close-popup>
                <q-item-section avatar>
                  <q-img height=25px width=25px src="../assets/greenCompas.png"></q-img>
                </q-item-section>
                <q-item-section>
                  <q-item-label>Pair Pioneer</q-item-label>
                </q-item-section>
              </q-item>

              <q-item clickable v-close-popup>
                <q-item-section avatar>
<!--                  <q-img height=25px width=25px src="../assets/metamask.png"></q-img>-->
                </q-item-section>
                <q-item-section>
                  <q-item-label>Pair Metamask</q-item-label>
                </q-item-section>
              </q-item>

              <q-item clickable v-close-popup>
                <q-item-section avatar>
                  <!--                  <q-img height=25px width=25px src="../assets/metamask.png"></q-img>-->
                </q-item-section>
                <q-item-section>
                  <q-item-label>Pair Keepkey</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>

        <div v-if="paired">
          <q-btn-dropdown
                  split
                  to="/start/pick-quasar-flavour"
                  color="teal"
                  rounded
                  label="Go to Docs Index"
          >
            <q-list>
              <q-item clickable v-close-popup>
                <q-item-section>
                  <q-item-label>Photos</q-item-label>
                </q-item-section>
              </q-item>

              <q-item clickable v-close-popup>
                <q-item-section>
                  <q-item-label>Videos</q-item-label>
                </q-item-section>
              </q-item>

              <q-item clickable v-close-popup>
                <q-item-section>
                  <q-item-label>Articles</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>

        <br/>
        <div>API v{{ $q.version }}</div>

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
import {mapGetters, mapMutations} from "vuex";

export default {
  name: 'MainLayout',

  components: {
  },
  data() {
    return {
      isLoggedIn: false,
      paired:false,
      totalValueUsd: 0
    }
  },
  async mounted() {
    try{
      //on mount


      // console.log("process.env",process.env)
      // const newAccounts = await ethereum.request({
      //   method: 'eth_requestAccounts',
      // })
      //
      // console.log("newAccounts: ",newAccounts)
      // let domain = location.toString()
      // let account = newAccounts[0]
      // console.log("Account Metamask: ",account)
      // console.log("domain: ",domain)
      //
      // //pioneer SDK
      // // let resultInit = this.init()
      // // console.log("resultInit: ",resultInit)
      //
      // let resultInit = this.init('init')
      // console.log("resultInit: ",resultInit)
      //
      // let resultStart = await this.onStart()
      // console.log("resultStart: ",resultStart)



    }catch(e){
      console.error(e)
    }
  },
  watch: {
    "$store.state.invocations": {
      handler: function (value) {
        console.log("value: ", value)
        //get value
        this.invocations = this.$store.getters['getInvocationContext'];
        console.log("invocations: ", this.invocations)
      },
      immediate: true
    },
  },
  computed: {
    ...mapGetters(['getUsername'])
  },
  methods: {
    ...mapMutations(['init','onStart']),
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
