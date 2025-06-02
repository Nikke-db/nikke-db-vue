<template>
  <!-- if increase/decrease margin top of scroll bar, need to update the calc of max height -->
  <n-scrollbar
    class="scrollBarMargin"
    :class="checkMobile() ? 'mobileScroll' : ''"
  >
    <Header v-show="!isChibiMobile()"/>
    <RouterView />
    <Footer v-show="!isL2d() && !isChibiMobile()" />
    <!-- <div v-if="market.globalParams.isMobile" class="fakeFooter"></div> -->
  </n-scrollbar>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import Header from '@/components/common/Header/HeaderSelector.vue'
import Footer from '@/components/common/Footer/Footer.vue'
import { watch } from 'vue'
import { useMarket } from '@/stores/market'
import { useLoadingBar } from 'naive-ui'
import { useMessage } from 'naive-ui'

const market = useMarket()
const loadingBar = useLoadingBar()

const checkMobile = () => {
  return market.globalParams.isMobile
}
const isL2d = () => {
  return market.route.name === 'visualiser'
}
const isChibiMobile = () => {
  return checkMobile() && market.route.name === 'chibi'
}

market.message.setMessage(useMessage())

// update the loading bar at the top of the screen
watch(() => market.load.load, () => {
  switch (market.load.load) {
    case 'done':
      loadingBar.finish()
      break
    case 'loading':
      loadingBar.start()
      break
    case 'error':
      loadingBar.error()
      break
    default:
      console.log('unknown loadingBar value')
  }
})
</script>

<style lang="less">
@import '@/utils/style/global_variables.less';
@import '@/utils/spine/spine-player.css';

* {
  font-family: Arial, Helvetica, sans-serif;
}
.main-bg {
  background-color: @main-dark-theme;
}

.main-box-shadow {
  box-shadow: 0px 10px 5px 5px @main-dark-theme;
  z-index: 100;
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
    color: white;
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
  margin-top: 0px;
  max-height: calc(100vh - 0px);
}

.mobileScroll {
  max-height: -webkit-fill-available;
}

.n-icon {
  color: white;
}

.n-color-picker-trigger__value {
  user-select: none !important;
}

.fakeFooter {
  height: 150px;
}

blockquote.twitter-tweet {
  display: inline-block;
  font-family: "Helvetica Neue", Roboto, "Segoe UI", Calibri, sans-serif;
  font-size: 12px;
  font-weight: bold;
  line-height: 16px;
  border-color: #eee #ddd #bbb;
  border-radius: 5px;
  border-style: solid;
  border-width: 1px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  margin: 10px 5px;
  padding: 0 16px 16px 16px;
  max-width: 468px;
}

blockquote.twitter-tweet p {
  font-size: 16px;
  font-weight: normal;
  line-height: 20px;
}

blockquote.twitter-tweet a {
  color: inherit;
  font-weight: normal;
  text-decoration: none;
  outline: 0 none;
}

blockquote.twitter-tweet a:hover,
blockquote.twitter-tweet a:focus {
  text-decoration: underline;
}

.wideModalDialogWidth {
  width: 60vw !important;
}

.coloredSwitch {
  .n-icon {
    color: @main-dark-theme;
  }

  .n-switch__checked, .n-switch__unchecked {
    color: @main-dark-theme !important;
  }
}
</style>
