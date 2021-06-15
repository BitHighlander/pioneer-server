<template>
  <div>
    <q-splitter
            v-model="splitterModel"
            style="height: 250px"
    >

      <template v-slot:before>
        <q-tabs
                v-model="tab"
                vertical
                class="text-teal"
        >
          <q-tab name="apps" icon="search" label="Search" />
          <q-tab name="network" icon="public" label="Network" />
          <q-tab name="wallets" icon="public" label="wallets" />
          <div v-if="isPaired">
            <q-tab name="user" icon="account_circle" label="User" />
            <q-tab name="invocations" icon="auto_fix_high" label="Invocations" />
          </div>
        </q-tabs>
      </template>

      <template v-slot:after>
        <q-tab-panels
                v-model="tab"
                animated
                swipeable
                vertical
                transition-prev="jump-up"
                transition-next="jump-up"
        >
          <q-tab-panel name="search">
            <div class="q-pa-md">
              <div class="q-gutter-y-md column" style="max-width: 300px">

<!--                <q-input rounded outlined v-model="text">-->
<!--                  <template v-slot:append>-->
<!--                    <q-avatar>-->
<!--                      <img src="https://cdn.quasar.dev/logo/svg/quasar-logo.svg">-->
<!--                    </q-avatar>-->
<!--                  </template>-->
<!--                  <template v-slot:hint>-->
<!--                    Field hint-->
<!--                  </template>-->
<!--                </q-input>-->

<!--                <q-input rounded standout bottom-slots v-model="text" label="Label" counter>-->
<!--                  <template v-slot:prepend>-->
<!--                    <q-icon name="place" />-->
<!--                  </template>-->
<!--                  <template v-slot:append>-->
<!--                    <q-icon name="close" @click="text = ''" class="cursor-pointer" />-->
<!--                  </template>-->

<!--                  <template v-slot:hint>-->
<!--                    Field hint-->
<!--                  </template>-->
<!--                </q-input>-->
              </div>
            </div>
          </q-tab-panel>
          <q-tab-panel name="network">
            <div class="text-h4 q-mb-md"></div>
            users online

            <br/>
            Launch app <a href="invocation://abc=1">open in pioneer</a>

          </q-tab-panel>

          <q-tab-panel name="search">
            <div class="text-h4 q-mb-md">search</div>
            asdasdas
          </q-tab-panel>

          <q-tab-panel name="wallets">
            <div class="text-h4 q-mb-md">wallets</div>

          </q-tab-panel>

          <q-tab-panel name="invocations">
          </q-tab-panel>
        </q-tab-panels>
      </template>

    </q-splitter>
  </div>
</template>

<script>
// import VueGridLayout from 'vue-grid-layout';
import { initOnboard, initNotify } from '../modules/services'

export default {
  name: 'PageIndex',
  components: {
    // GridLayout: VueGridLayout.GridLayout,
    // GridItem: VueGridLayout.GridItem
  },
  data () {
    return {
      isPaired:false,
      splitterModel: 20,
      status:"online",
      // layout: testLayout,
      draggable: true,
      resizable: true,
      responsive: true,
      index: 0,
      show: false,
      tab:"",
    }
  },
  mounted: function () {

    const onboard = initOnboard({
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

          window.localStorage.setItem('selectedWallet', wallet.name)
        } else {
          provider = null
          setWallet({})
        }
      }
    })

    console.log("onboard: ",onboard)

  },
  methods: {

  },
}
</script>
