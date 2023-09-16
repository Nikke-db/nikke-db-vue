<template>
  <Header />
  <!-- if increase/decrease margin top of scroll bar, need to update the calc of max height -->
  <n-scrollbar :class="shouldHaveMargin()"> 
    <RouterView />
  </n-scrollbar>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import Header from '@/components/common/Header/HeaderSelector.vue'
import { watch } from 'vue'
import { useMarket } from '@/stores/market'
import { useLoadingBar } from 'naive-ui'
import { useMessage } from 'naive-ui'

const market = useMarket()
const loadingBar = useLoadingBar()

const shouldHaveMargin = () => {
  if (market.route.name !== "Live2D") {
    return "scrollBarMargin"
  } else {
    return "noScrollBarMargin"
  }
}

market.message.setMessage(useMessage())

// update the loading bar at the top of the screen
watch(() => market.load.load, () => {
    switch (market.load.load) {
        case "done" : 
            loadingBar.finish();
            break;
        case "loading" :
            loadingBar.start();
            break;
        case "error" :
            loadingBar.error();
            break;
        default :
            console.log("unknown loadingBar value")
    }
})
</script>

<style lang="less">
@import '@/utils/style/global_variables.less';
@import '@/utils/spine/spine-player.css';

*{
  font-family: Arial, Helvetica, sans-serif;
  // color:white;
}
.main-bg {
  background-color: @main-dark-theme;
}

.main-box-shadow {
  box-shadow: 0px 10px 5px 5px @main-dark-theme;
}

.alt-bg {
  background-color: @alt-dark-theme;
}

.redirect {
  color: @grey-color;
  text-decoration: none;
  font-size: 20px;
  transition: 0.5s;

  &:hover {
    color:white;
    font-style: italic;
    
  }
}

.poli-bg {
  // background-image: url(./assets/index_bg.jpg);
  background-size: cover;
  background-repeat: no-repeat;
  background-attachment: fixed;
  background-position: center;
}

body {
  background-color: @alt-dark-theme;
}

.n-a {
  font-size: 16px;
  text-decoration: underline;
}

.scrollBarMargin {
  margin-top: 100px;
  max-height: calc(100vh - 100px);
}

.noScrollBarMargin {
  max-height: 100vh;
}

.n-icon {
  color: white
}

.n-color-picker-trigger__value {
  user-select: none !important;
}
</style>
