<template>
  <n-button ghost type="success" round @click="hideUI()">Hide UI</n-button>
</template>

<script setup lang="ts">
import { useMarket } from '@/stores/market'
import { messagesEnum } from '@/utils/enum/globalParams'

const market = useMarket()

const hideUI = () => {
  market.live2d.triggerHideUI()
  market.message.getMessage().success(messagesEnum.MESSAGE_UI_SHOWBACK, market.message.long_message)
}

document.addEventListener('keypress', (e) => {
  if (e.key.toLowerCase() === 'enter') {
    market.live2d.triggerShowUI()
  }
})
</script>

<style scoped lang="less">
.n-button {
  width: 100%;
  height: 40px;
}
</style>
