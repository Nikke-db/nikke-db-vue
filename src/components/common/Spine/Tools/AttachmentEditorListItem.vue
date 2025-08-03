<template>
  <n-h4 v-show="shouldApplyToAttachment" style="display: flex; gap: 8px;">
    <div :style="`width: 8px; display: block; height: 16px; margin-top: 4px; background-color: ${getRgba()}`"/>
    <div>
      <n-icon
          :component="EyeFilled"
          :size="16"
          style="cursor: pointer;"
          @mouseover="previewhovering()"
          @mouseleave="previerout()"
      />
    </div>
    <n-checkbox v-model:checked="isAttachmentChecked">
      {{ props.item.name}}
    </n-checkbox>
  </n-h4>
</template>

<script lang="ts" setup>

import type { AttachmentItemInterface } from '@/utils/interfaces/live2d'
import { computed, ref, watch } from 'vue'
import { useMarket } from '@/stores/market'
import { EyeFilled } from '@vicons/antd'

const emits = defineEmits(['updateAttachment', 'triggerpreview', 'stoppreview'])

const props = defineProps<{
  index: number,
  subIndex: number,
  item: AttachmentItemInterface,
  searchQuery: string
}>()

const market = useMarket()

const isAttachmentChecked = ref(false)

const shouldApplyToAttachment = computed(() => {
  return props.item.name.includes(props.searchQuery)
})

const getRgba = () => {
  const colors = props.item.color
  const r = convertColorValues(colors.r)
  const g = convertColorValues(colors.g)
  const b = convertColorValues(colors.b)
  const a = convertColorValues(colors.a)

  return `rgba(${r},${g},${b},${a})`
}

// convert a float value to a rgba value
// basically float * 255
// but hard limit to 255 if float > 1
const convertColorValues = (float: number) => {
  return float > 1 ? 255 : float * 255
}

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

const previewing = ref(false)
const previewhovering = () => {
  previewing.value = true
}
const previerout = () => {
  previewing.value = false
}

watch(previewing, () => {
  if (previewing.value) {
    emits('triggerpreview', props.item.name, props.index)
  } else {
    emits('stoppreview', props.item.name, props.index)
  }
})
</script>

<style lang="less" scoped>
.n-h4 {
  margin: 0;
}
</style>