<template>
  <div class="l2dGlobal story-gen">
    <Loader />
    <ChatInterface />
  </div>
</template>

<script setup lang="ts">
import Loader from '@/components/common/Spine/Loader.vue'
import ChatInterface from '@/components/views/ChatInterface.vue'
import { theme } from '@/utils/enum/globalParams'
import { onUnmounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useMarket } from '@/stores/market'

const market = useMarket()

market.live2d.current_id = ''
market.live2d.current_pose = 'fb'

onUnmounted(() => {
  document.body.style.backgroundColor = theme.BACKGROUND_COLOR
  document.body.style.backgroundImage = 'none'
  document.body.style.backgroundSize = ''
  document.body.style.backgroundPosition = ''
  document.body.style.backgroundRepeat = ''
  document.body.style.backgroundAttachment = ''

  market.live2d.clearBackgroundImages()
})

onBeforeRouteLeave(() => {
  market.live2d.current_id = ''
  market.live2d.current_animation = 'idle'
  market.live2d.current_pose = 'fb'
})
</script>

<style lang="less" scoped>
/* Ensure the story-gen route root has a definite height so that
   the shared Spine Loader's #player-container (and its .mobile
   height:-webkit-fill-available rule) can resolve to a non-zero
   size on real mobile devices. This is required for SpinePlayer
   to measure a proper container at construction time. The visualiser
   (L2D) route does not need this because its Wrapper* components
   participate in a layout that provides height. */
.l2dGlobal.story-gen {
  height: 100dvh;
  min-height: 100dvh;
  position: relative;
}
</style>
