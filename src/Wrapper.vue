<!-- wrapper for naive or other first things before loading app.vue -->

<template>
  <n-config-provider :theme="theme" :theme-overrides="override">
    <n-message-provider>
      <n-loading-bar-provider>
        <n-message-provider>
          <App />
        </n-message-provider>
      </n-loading-bar-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import App from '@/App.vue'
import { darkTheme } from 'naive-ui'
import { ref } from 'vue'
import { onBeforeMount } from 'vue'
import * as override from '@/utils/style/naive-ui-theme-overrides.json'
import { useMarket } from '@/stores/market'

const theme = ref(darkTheme)
const market = useMarket()

const COMPACT_MODE_THRESHOLD = 768
const MOBILE_MODE_THRESHOLD = 900

let resizeTimer: ReturnType<typeof setTimeout> | null = null

onBeforeMount(() => {
  checkIfMobileUI()
})

window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(checkIfMobileUI, 100)
})

const checkIfMobileUI = () => {
  const vw = document.body.clientWidth
  const vh = window.innerHeight
  if (vw < MOBILE_MODE_THRESHOLD) {
    // DOM's width, if too low switch to mobile display globally
    market.globalParams.setMobile()
  } else {
    market.globalParams.setComputer()
  }

  // Compact mode: phone-sized screens that need a dedicated layout overhaul
  const minDim = Math.min(vw, vh)
  const isCompact = minDim < COMPACT_MODE_THRESHOLD
  market.globalParams.setMobileCompact(isCompact)
}

</script>
