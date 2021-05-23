import Vue from 'vue'
import Vuex from 'vuex'

import global from './modules/global'
Vue.use(Vuex)

/**
 * Get coinMap
 */

export default function (/* { ssrContext } */) {
  const Store = new Vuex.Store({
    modules: {
      global,
    },
    strict: true,
  });

  return Store
}
