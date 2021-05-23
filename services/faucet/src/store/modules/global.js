
const state = {
    masterEth: "",
    modalComponent: "",
}

const getters = {
    getMasterEth: (state) => state.masterEth
}


const mutations = {
    setMasterEth(state, address) {
        state.masterEth = address
    },
    showModal(state, componentName) {
        state.modalVisible = componentName ? true : false
        state.modalComponent = componentName
    },
    hideModal(state) {
        state.modalVisible = false
    },
}

export default {
    state,
    getters,
    mutations
}
