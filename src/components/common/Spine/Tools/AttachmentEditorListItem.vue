<template>
  <n-h4 v-show="shouldApplyToAttachment">
    <n-checkbox v-model:checked="isAttachmentChecked">
      {{ props.item.name}}
    </n-checkbox>
  </n-h4>
</template>

<script lang="ts" setup>

import type { AttachmentItemInterface } from '@/utils/interfaces/live2d'
import { computed, ref, watch } from 'vue'
import { useMarket } from '@/stores/market'

const emits = defineEmits(['updateAttachment'])

const props = defineProps<{
  index: number,
  item: AttachmentItemInterface,
  searchQuery: string
}>()

const market = useMarket()

const isAttachmentChecked = ref(false)

const shouldApplyToAttachment = computed(() => {
  return props.item.name.includes(props.searchQuery)
})

watch(() => market.live2d.selectAttachments, () => {
  if (shouldApplyToAttachment.value) {
    switch (market.live2d.selectionAttachments) {
      case 'select': isAttachmentChecked.value = true; break
      case 'unselect': isAttachmentChecked.value = false; break
      default: console.error('Unexpected selectionAttachments value : ' + market.live2d.selectionAttachments)
    }
  }
})

watch(() => market.live2d.updateAttachments, () => {
  if (isAttachmentChecked.value) {
    emits('updateAttachment', props.item.name, props.index)
  }
})

</script>

<style lang="less" scoped>
.n-h4 {
  margin: 0;
}
</style>