import Vue from 'vue'
import Vuex from 'vuex'

import pioneer from './modules/pioneer'
Vue.use(Vuex)

/**
 * Get coinMap
 */

export default function (/* { ssrContext } */) {
  const Store = new Vuex.Store({
    modules: {
      pioneer,
    },
    strict: true,
  });

  return Store
}
