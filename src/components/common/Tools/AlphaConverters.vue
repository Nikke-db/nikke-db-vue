<template>
  <n-card :bordered="false" size="huge">

    Straight Alpha to premultiplied Alpha

    <n-upload
        directory-dnd
        v-model:file-list="fileArray"
        @update:file-list="converter('sta2pma')"
        accept=".png"
    >
      <n-upload-dragger>
        Drag a png to convert to PMA
      </n-upload-dragger>
    </n-upload>

    <n-divider />

    Premultiplied Alpha to Straight Alpha

    <n-upload
        directory-dnd
        v-model:file-list="fileArray"
        @update:file-list="converter('pma2sta')"
        accept=".png"
    >
      <n-upload-dragger>
        Drag a png to convert to STA
      </n-upload-dragger>
    </n-upload>

    <n-divider />

    <n-a href="https://learn.microsoft.com/en-us/windows/apps/develop/win2d/premultiplied-alpha#converting-between-alpha-formats">
      Learn more about the converting algorithm
    </n-a>
    <n-p>Yes. there is quality loss when you convert a picture due to rounding numbers.</n-p>
  </n-card>
</template>

<script setup lang="ts">

import { getPixels, savePixels } from 'ndarray-pixels'
import { ref, type Ref } from 'vue'
import { type UploadFileInfo } from 'naive-ui'
import { useMarket } from '@/stores/market'

const fileArray: Ref<UploadFileInfo[]> = ref([])
const market = useMarket()

const converter = (conversionType: 'pma2sta' | 'sta2pma') => {
  const fr = new FileReader()
  fr.readAsArrayBuffer(fileArray.value[0].file!)
  fr.onload = async () => {
    const result = fr.result as ArrayBuffer
    const pixels = await getPixels(new Uint8Array(result), 'image/png')

    market.message.getMessage().info('parsing ' + pixels.data.length / 4 + ' pixels of a png file')
    const dateParsingStart = new Date()

    if (conversionType === 'sta2pma') {
      for (let i = 0; i <= pixels.data.length - 5; i = i + 4) {
        let r = pixels.data[i]
        let g = pixels.data[i + 1]
        let b = pixels.data[i + 2]
        const a = pixels.data[i + 3]

        if (r !== 0 || g !== 0 || b !== 0) { // don't process void pixels where rgb = (0,0,0)
          r = ( r * a ) / 255
          g = ( g * a ) / 255
          b = ( b * a ) / 255
          pixels.data[i] = r
          pixels.data[i + 1] = g
          pixels.data[i + 2] = b
        }
      }
    } else if (conversionType === 'pma2sta') {
      for (let i = 0; i <= pixels.data.length - 5; i = i + 4) {
        let r = pixels.data[i]
        let g = pixels.data[i + 1]
        let b = pixels.data[i + 2]
        const a = pixels.data[i + 3]

        if (r !== 0 || g !== 0 || b !== 0) {  // don't process void pixels where rgb = (0,0,0)
          r = ( r * 255 ) / a
          g = ( g * 255 ) / a
          b = ( b * 255 ) / a
          pixels.data[i] = r
          pixels.data[i + 1] = g
          pixels.data[i + 2] = b
        }
      }
    }

    const dateParsingEnd = new Date()
    market.message.getMessage().success('parsing completed , duration : ' + (dateParsingEnd.getTime() - dateParsingStart.getTime()) + ' ms')
    const savedPixels = await savePixels(pixels, 'image/png')
    const tempblob = new Blob([savedPixels], { type: 'image/png' })
    const url = URL.createObjectURL(tempblob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileArray.value[0].name
    a.click()
    window.URL.revokeObjectURL(url)

    fileArray.value = []
  }
}

</script>