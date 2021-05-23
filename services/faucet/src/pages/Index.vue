<template>
  <q-page class="flex flex-center">



  </q-page>
</template>

<script>
import VueGridLayout from 'vue-grid-layout';

let testLayout = [
  {
    "name":"pioneer",
    "icon":"assets/GreenCompas.jpeg",
    "x":0,
    "y":0,
    "w":2,
    "h":2,
    "i":"0"
  },
];

export default {
  name: 'PageIndex',
  components: {
    GridLayout: VueGridLayout.GridLayout,
    GridItem: VueGridLayout.GridItem
  },
  data () {
    return {
      status:"online",
      layout: testLayout,
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
