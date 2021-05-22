<template>
    <q-page class="flex flex-center">



        <!--    <div>-->
        <!--      <h7>Pioneer status: {{status}}</h7>-->

        <!--      <br/>-->
        <!--      <br/>-->
        <!--      <br/>-->
        <!--      <a href="https://github.com/BitHighlander/pioneer-platform/releases">Download platform</a>-->

        <!--    </div>-->
        <div id="content" style="width: 100%;">
            <grid-layout v-if="show"
                         :layout.sync="layout"
                         :col-num="12"
                         :row-height="30"
                         :is-draggable="draggable"
                         :is-resizable="resizable"
                         :vertical-compact="true"
                         :use-css-transforms="true"
                         :responsive="responsive"
            >
                <grid-item v-for="item in layout"
                           :x="item.x"
                           :y="item.y"
                           :w="item.w"
                           :h="item.h"
                           :i="item.i"
                >
          <span class="text">
            <q-card-section>
              <q-card
                      class="my-card text-white"
                      style="background: radial-gradient(circle, #000000 0%, #236303 100%)"
              >
                <q-img height=50px width=50px src="../assets/GreenCompas.jpeg"></q-img>
                i:{{item.i}}
                x:{{item.x}}
                y:{{item.y}}
              </q-card>
            </q-card-section>
          </span>
                </grid-item>
            </grid-layout>
        </div>


    </q-page>
</template>

<script>

    // import VueGridLayout from 'vue-grid-layout';
    //
    // let testLayout = [
    //     {
    //         "name":"pioneer",
    //         "icon":"assets/GreenCompas.jpeg",
    //         "x":0,
    //         "y":0,
    //         "w":2,
    //         "h":2,
    //         "i":"0"
    //     },
    // ];

    export default {
        name: "NFTgrid",
        components: {
            // GridLayout: VueGridLayout.GridLayout,
            // GridItem: VueGridLayout.GridItem
        },
        data () {
            return {
                status:"online",
                // layout: testLayout,
                draggable: true,
                resizable: true,
                responsive: true,
                index: 0,
                show: false,
            }
        },
        mounted: function () {
            this.index = this.layout.length;
            this.$nextTick(function () {
                this.show = true;
            })
        },
        methods: {
        },
    }
</script>

<style scoped>

</style>
