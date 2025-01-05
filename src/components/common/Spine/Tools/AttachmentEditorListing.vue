<template>
  <div>
    <span v-for="(item, index) in market.live2d.attachments" v-bind:key="index">
      <AttachmentEditorListItem
          v-if="item !== null && item !== undefined"
          :item="item[grabKey(item)]"
          :index="index"
          @updateAttachment="(key: string, index: number) => updateAttachments(key, index)"
          :searchQuery="props.searchQuery"
          :colors="props.colors"
      />
    </span>
  </div>
</template>

<script setup lang="ts">

import { useMarket } from '@/stores/market'
import type { AttachmentInterface, AttachmentItemColorInterface } from '@/utils/interfaces/live2d'
import AttachmentEditorListItem from '@/components/common/Spine/Tools/AttachmentEditorListItem.vue'

const market = useMarket()

const props = defineProps<{
  searchQuery: string,
  colors: AttachmentItemColorInterface
}>()

const grabKey = (item: AttachmentInterface) => {
  try {
    const keys = Object.keys(item)
    return keys[0]
  } catch (e) {
    return new Date().getTime()
  }
}

const updateAttachments = (key: string, index: number) => {
  market.live2d.attachments[index][key].color = props.colors
  market.live2d.triggerApplyAttachments()
}

</script>


<style scoped lang="less">


</style>