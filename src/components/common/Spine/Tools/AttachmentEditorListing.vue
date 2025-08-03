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
          />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">

import { useMarket } from '@/stores/market'
import type { AttachmentInterface, AttachmentItemColorInterface } from '@/utils/interfaces/live2d'
import AttachmentEditorListItem from '@/components/common/Spine/Tools/AttachmentEditorListItem.vue'
import { onMounted } from 'vue'

const market = useMarket()

onMounted(() => {
  // console.log(market.live2d.attachments)
})

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