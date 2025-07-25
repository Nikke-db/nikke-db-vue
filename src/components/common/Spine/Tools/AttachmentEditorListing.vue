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
              @updateAttachment="(key: string, index: number) => updateAttachments(key, index)"
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

</script>


<style scoped lang="less">


</style>