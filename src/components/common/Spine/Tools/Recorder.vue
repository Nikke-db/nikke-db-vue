<template>
    <div v-if="market.live2d.recorder">
        <n-button v-if="market.live2d.isRecording" ghost type="success" round @click="stopRecording" >Stop</n-button>
        <n-button v-else ghost type="success" round @click="startRecording" >Record</n-button>

    </div>
</template>
  
<script setup lang="ts">
import { useMarket } from '@/stores/market'

const market = useMarket()

const startRecording = () => {
    market.live2d.recorder?.start()
}

const stopRecording = () => {
    market.live2d.recorder?.stop()
}
</script>
  
<style scoped lang="less">
.n-button {
    width: 100%;
    height: 40px;
}
</style>
  