<template>
  <div class="spacer">
    <!-- Computer Render -->
    <n-card title="3D Chibi Viewer - Beta v0.13" v-if="!market.globalParams.isMobile" >
      <template #header-extra>
        <n-spin :show="unityInstance === null" size="small">
          <n-button type="primary" round ghost @click="setFullScreen()" >
          View in Full Screen
        </n-button>
        </n-spin><br/><br/>
      </template>
      <div style="text-align:center">
        <canvas id="unity-canvas" width=1920 height=1080 tabindex="-1" style="width:90%"></canvas>
      </div>
    </n-card>
    <!-- Mobile Render -->
    <div v-else style="margin-top: -50px;">
      <canvas id="unity-canvas" width=1920 height=1080 tabindex="-1" ></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { globalParams } from '@/utils/enum/globalParams'
// @ts-ignore
import createUnityInstance from 'https://nikke-db-legacy.pages.dev/chibi/Build/chibi.loader.js'
import { onMounted, watch, ref, type Ref, onBeforeMount } from 'vue'

import { useMarket } from '@/stores/market'

const market = useMarket()
let unityInstance = ref(null) as Ref<any>

watch(() => market.globalParams.isMobile, () => {
  init()
  setMobileView()
})

onBeforeMount(() => {
  market.load.beginLoad()
})

onMounted(() => {
  init()
  setMobileView()
})

const init = () => {
  createUnityInstance(document.querySelector('#unity-canvas'), {
    dataUrl: globalParams.CHIBI_BUILD + 'chibi.data.unityweb',
    frameworkUrl: globalParams.CHIBI_BUILD + 'chibi.framework.js.unityweb',
    codeUrl: globalParams.CHIBI_BUILD + 'chibi.wasm.unityweb',
    streamingAssetsUrl: globalParams.STREAMING_ASSETS,
    companyName: 'Nikke-DB',
    productName: 'Nikke Chibi By Hacker_lyx',
    productVersion: '0.13',
  }).then((inst: any) => {
    unityInstance.value = inst
    market.load.endLoad()
  })
}

const setMobileView = () => {
  if (market.globalParams.isMobile) {
    const meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = 'width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes'
    document.getElementsByTagName('head')[0].appendChild(meta)
    const canvas = document.querySelector('#unity-canvas') as HTMLElement
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.position = 'fixed'
    document.body.style.textAlign = 'left'
  }
}

const setFullScreen = () => {
  unityInstance.value.SetFullscreen(1)
}

</script>

<style scoped lang="less">
.spacer{
  margin-top:50px
}

.n-card {
  width:90%;
  margin: 0 auto;
}
</style>