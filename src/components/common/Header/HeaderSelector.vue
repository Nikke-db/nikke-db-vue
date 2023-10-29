<template>
  <div>
    <HeaderMobile
      v-show="
        market.globalParams.isMobile &&
        market.globalParams.isMobileHeaderVisibile
      "
      :routes="ROUTES"
    />
    <HeaderPC v-show="!market.globalParams.isMobile" :routes="ROUTES"  :class="nullifyOpacity()"/>
  </div>
</template>

<script setup lang="ts">
import HeaderPC from '@/components/common/Header/HeaderPC.vue'
import HeaderMobile from '@/components/common/Header/HeaderMobile.vue'

import { ROUTES } from '@/components/common/Header/routes2Display'

import { useMarket } from '@/stores/market'

const market = useMarket()

const nullifyOpacity = () => {
  if (market.live2d.hideUI) {
    return 'no-opacity'
  } else {
    ''
  }
}
</script>

<style lang="less">
.no-opacity {
  visibility: hidden;
}
</style>
