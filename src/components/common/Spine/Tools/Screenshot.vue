<template>
  <n-tooltip trigger="hover" placement="top">
    <template #trigger>
      <n-button ghost type="primary" @click="capture()" >
        <n-icon color="inherit" size="24"> <!-- svg by marshall47313 (Lady) on Nikke Community -->
          <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" id="Layer_1" x="0" y="0" version="1.1" viewBox="0 0 1000 1000">
            <path d="M250 143c-59 0-107 48-107 107v143a36 36 0 0 0 71 0V250c0-20 16-36 36-36h143a36 36 0 0 0 0-71H250zm357 0a36 36 0 0 0 0 71h143c20 0 36 16 36 36v143a36 36 0 0 0 71 0V250c0-59-48-107-107-107H607zM214 607a36 36 0 0 0-71 0v143c0 59 48 107 107 107h143a36 36 0 0 0 0-71H250c-20 0-36-16-36-36V607zm643 0a36 36 0 0 0-71 0v143c0 20-16 36-36 36H607a36 36 0 0 0 0 71h143c59 0 107-48 107-107V607zM0 143C0 64 64 0 143 0h714c79 0 143 64 143 143v714c0 79-64 143-143 143H143C64 1000 0 936 0 857V143zm71 0v714c0 40 32 72 72 72h714c39 0 71-32 71-72V143c0-40-32-72-71-72H143c-40 0-72 32-72 72z" class="st0"/>
            <path d="M670 500a170 170 0 1 1-340 0 170 170 0 0 1 340 0zM500 394a106 106 0 1 0 0 212 106 106 0 0 0 0-212z" class="st0"/>
          </svg>
        </n-icon>
      </n-button>
    </template>
    Screenshot
  </n-tooltip>
</template>

<script lang="ts" setup>
import { useMarket } from '@/stores/market'

const market = useMarket()

const capture = () => {
  market.live2d.triggerScreenshot()
}
</script>

<style lang="less" scoped>
.n-button {
  width: 50%;
  height: 40px;
  border-radius: 34px 0px 0px 34px;
  text-align: right;
}
.n-icon {
  transform: rotate(90deg);
}
</style>
