<template>
    <div class="q-pa-md">
        <h5>Transaction Status page</h5>
        <small>Invocation: {{ invocationContext }}</small>
        <br/>
        status: {{invocation.state}}
        <br/>
        <q-btn class="primary" @click="onUpdate">
            Refresh
        </q-btn>
        <q-stepper
                v-model="step"
                ref="stepper"
                alternative-labels
                color="primary"
                animated
        >
            <q-step
                    :name="1"
                    title="Reviewed and Signed"
                    icon="settings"
                    :done="step > 1"
            >
                Complete transaction in Pioneer App

                <div>
                    Launch App (app)
                </div>

                <div>
                    context: {{context}}
                </div>

                <div>
                    change context?
                </div>

                <q-spinner
                        color="primary"
                        size="5rem"
                        v-if="!isLoaded"
                        key="spinner"
                />

            </q-step>

            <q-step
                    :name="2"
                    title="Pending Transactions"
                    caption="(broadcast)"
                    icon="create_new_folder"
                    :done="step > 2"
            >
                Fee levels:
                <br/>
                Time till next block:
                <br/>
                estimated time till confirmation:
                <br/>
                Rebuild/replace transaction:
            </q-step>

            <q-step
                    :name="3"
                    title="Pending Transactions"
                    caption="(broadcast)"
                    icon="create_new_folder"
                    :done="step > 3"
            >

            </q-step>

<!--            <template v-slot:navigation>-->
<!--                <q-stepper-navigation>-->
<!--                    <q-btn @click="$refs.stepper.next()" color="primary" :label="step === 4 ? 'Finish' : 'Continue'" />-->
<!--                    <q-btn v-if="step > 1" flat color="primary" @click="$refs.stepper.previous()" label="Back" class="q-ml-sm" />-->
<!--                </q-stepper-navigation>-->
<!--            </template>-->
        </q-stepper>
    </div>
</template>

<script>
    /*
        Invocation Info

        Stages:
            build
            sign
            broadcast



     */

    import { mapMutations, mapGetters, mapActions } from 'vuex'
    export default {
        name: "Transaction",
        data () {
            return {
                invocationContext:"",
                context:"",
                invocation:"",
                status:"online",
                step: 1
            }
        },
        async mounted() {
            try{

                let resultInit = this.init('init')
                console.log("resultInit: ",resultInit)

                let resultStart = await this.onStart()
                console.log("resultStart: ",resultStart)

                //subscribe to invocation lifecycles
                let invocationId = this.$route.params.id
                console.log("invocationId: ",invocationId)
                this.invocationContext = invocationId
                this.invocaction = invocationId
                // this.invocaction = await this.setInvocationContext(invocationId)
                console.log("invocaction: ",this.invocaction)
            }catch(e){
                console.error(e)
            }
        },
        watch: {
            "$store.state.invocationContext": {
                handler: function (value) {
                    //get value
                    // this.invocationContext = this.$store.getters['getInvocationContext'];
                    // console.log("invocations: ", this.invocations)
                },
                immediate: true
            },
            "$store.state.invocation": {
                handler: function (value) {

                    //get value
                    this.invocation = this.$store.getters['getInvocation'];
                    console.log("invocations: ", this.invocation)
                },
                immediate: true
            },
            "$store.state.invocations": {
                handler: function (value) {

                    //get value
                    this.invocations = this.$store.getters['getInvocations'];

                    //get current context

                    //set as local
                    console.log("invocations: ", this.invocations)
                },
                immediate: true
            },
        },
        computed: {
            ...mapGetters(['getUsername'])
        },
        methods: {
            ...mapMutations(['showModal', 'hideModal','setInvocationContext','onStart','init']),
            ...mapActions(['fetchData']),
            //onUpdate
            async onUpdate () {
                console.log("updating invocation")
                //get info on invocation
                console.log("updating invocation: ",this.invocationContext)
                // this.$store.commit('getInvocationInfo', this.invocationContext)

                this.invocation = this.$store.getters['getInvocation'];
                console.log("invocations: ", this.invocation)

                this.fetchData(this.invocationContext)
            },
        }
    }
</script>

<style scoped>

</style>
