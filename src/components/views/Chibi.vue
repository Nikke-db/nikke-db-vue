<template>
  <div class="test">
    <n-card>
      placeholder chibi<br/>
      <canvas id="unity-canvas" width=1920 height=1080 tabindex="-1" style="height: 90vh; background: #231F20"></canvas>
    </n-card>
  </div>
</template>

<script setup lang="ts">
// @ts-ignore
// import createUnityInstance from 'http://localhost:5500/Build/mock.loader.js'
import { onMounted } from 'vue'

onMounted(() => {
  // createUnityInstance(document.querySelector('#unity-canvas'), {
  // dataUrl: 'http://localhost:5501/Build/mock4.data.unityweb',
  // frameworkUrl: 'http://localhost:5501/Build/mock4.framework.js.unityweb',
  // codeUrl: 'http://localhost:5501/Build/mock4.wasm.unityweb',
  // streamingAssetsUrl: 'http://localhost:5501/StreamingAssets',
  // companyName: 'DefaultCompany',
  // productName: 'Nikke Export',
  // productVersion: '0.1',
  // matchWebGLToCanvasSize: false, // Uncomment this to separately control WebGL canvas render size and DOM element size.
  // devicePixelRatio: 1, // Uncomment this to override low DPI rendering on high DPI displays.
  // })
})

</script>

<style scoped lang="less">
.test{
  margin-top:50px
}
</style>