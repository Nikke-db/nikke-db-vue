<template>
  <div class="l2dGlobal">
    <Loader />
    <ChatInterface />
  </div>
</template>

<script setup lang="ts">
import Loader from '@/components/common/Spine/Loader.vue'
import ChatInterface from '@/components/views/ChatInterface.vue'
import { theme } from '@/utils/enum/globalParams'
import { onUnmounted } from 'vue'
import { useMarket } from '@/stores/market'

const market = useMarket()

market.live2d.current_id = ''

onUnmounted(() => {
  document.body.style.backgroundColor = theme.BACKGROUND_COLOR
})
</script>

<style lang="less" scoped></style>
