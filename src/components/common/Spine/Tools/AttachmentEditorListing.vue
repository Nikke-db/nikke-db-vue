<template>
  <div>
    <template v-for="(item, index) in market.live2d.attachments" v-bind:key="index">
      <template v-if="item !== null && item !== undefined">
        <template v-for="(subitem, subindex) in Object.keys(item)" v-bind:key="subindex">
          <AttachmentEditorListItem
              v-if="subitem !== null && subitem !== undefined"
              :item="item[subitem]"
              :index="index"
              :subIndex="subindex"
              @updateAttachment="(key: string, i: number) => updateAttachments(key, i)"
              @triggerpreview="(key: string, i: number) => triggerPreview(key, i)"
              @stoppreview="(key: string, i: number) => stopPreview(key, i)"
              :searchQuery="props.searchQuery"
              :colors="props.colors"
              :preview-color="commonColor"
          />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">

import { useMarket } from '@/stores/market'
import type { AttachmentItemColorInterface } from '@/utils/interfaces/live2d'
import AttachmentEditorListItem from '@/components/common/Spine/Tools/AttachmentEditorListItem.vue'
import { onMounted, onUnmounted, ref } from 'vue'

const market = useMarket()
let intervalId = null as any

onMounted(() => {
  intervalId = commonPreviewInterval()
})

onUnmounted(() => {
  clearInterval(intervalId)
})

let commonColor = ref({
  r: 1,
  b: 1,
  g: 1,
  a: 1
})

const commonPreviewInterval = () => {
  return setInterval(() => {
    const r = commonColor.value.r === 1 || commonColor.value.b === 2 ? 2 : 0
    const g = commonColor.value.r === 2 ? 2 : 0
    const b = commonColor.value.g === 2 ? 2 : 0
    commonColor.value = {
      r: r,
      g: g,
      b: b,
      a: 1
    }
  }, 250)
}

const props = defineProps<{
  searchQuery: string,
  colors: AttachmentItemColorInterface
}>()

const updateAttachments = (key: string, index: number) => {
  market.live2d.attachments[index][key].color = props.colors
  market.live2d.triggerApplyAttachments()
}

const triggerPreview = (key: string, index: number) => {
  market.live2d.layerEditorPreviewObj = {
    index: index,
    key: key,
    preview: true
  }
  market.live2d.triggerLayerPreviewMode()
}

const stopPreview = (key: string, index: number) => {
  market.live2d.layerEditorPreviewObj = {
    index: index,
    key: key,
    preview: false
  }
  market.live2d.triggerLayerPreviewMode()
}

</script>


<style scoped lang="less">


</style>