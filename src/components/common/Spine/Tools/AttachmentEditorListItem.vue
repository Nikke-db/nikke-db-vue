<template>
  <n-h4 ref="itemRef" v-show="shouldApplyToAttachment" :class="{ 'click-selected': isClickHighlighted }" style="display: flex; gap: 8px;">
    <div :style="`width: 8px; display: block; height: 16px; margin-top: 4px; background-color: ${getRgba()}`"/>
    <div>
      <n-icon
          :component="EyeFilled"
          :size="16"
          style="cursor: pointer;"
          @mouseover="previewhovering()"
          @mouseleave="previewout()"
      />
    </div>
    <n-checkbox v-model:checked="isAttachmentChecked">
      {{ props.item.name}}
    </n-checkbox>
  </n-h4>
</template>

<script lang="ts" setup>

import type { AttachmentItemInterface } from '@/utils/interfaces/live2d'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
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

let selectionIntervalId: any = null
let selectionColorBackup: { r: number; g: number; b: number; a: number } | null = null

const startSelectionCycle = () => {
  if (selectionIntervalId !== null) return
  const colorRef = market.live2d.attachments[props.index]?.[props.item.name]?.color
  if (!colorRef) return
  selectionColorBackup = { ...colorRef }
  let phase = 'r'
  selectionIntervalId = setInterval(() => {
    const colorObj = market.live2d.attachments[props.index]?.[props.item.name]?.color
    if (!colorObj) return
    colorObj.r = phase === 'r' ? 2 : 0
    colorObj.g = phase === 'g' ? 2 : 0
    colorObj.b = phase === 'b' ? 2 : 0
    colorObj.a = 1
    phase = phase === 'r' ? 'g' : phase === 'g' ? 'b' : 'r'
  }, 250)
}

const stopSelectionCycle = (restore = true) => {
  if (selectionIntervalId === null) return
  clearInterval(selectionIntervalId)
  selectionIntervalId = null
  if (restore && selectionColorBackup) {
    const colorObj = market.live2d.attachments[props.index]?.[props.item.name]?.color
    if (colorObj) Object.assign(colorObj, selectionColorBackup)
  }
  selectionColorBackup = null
}

watch(isAttachmentChecked, (checked) => {
  if (checked && market.live2d.clickToSelectMode) {
    startSelectionCycle()
  } else {
    stopSelectionCycle()
  }
})

watch(() => market.live2d.clickToSelectMode, (enabled) => {
  if (enabled && isAttachmentChecked.value) {
    startSelectionCycle()
  } else {
    stopSelectionCycle()
  }
})

onUnmounted(() => {
  stopSelectionCycle()
})

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

watch(() => market.live2d.hideSelectedLayers, () => {
  if (isAttachmentChecked.value) {
    stopSelectionCycle(false) // stop cycling without restoring color — we're about to set a=0
    selectionColorBackup = null
    market.live2d.attachments[props.index][props.item.name].color.a = 0
    market.live2d.triggerApplyAttachments()
  }
})

watch(() => market.live2d.resetSelectedLayers, () => {
  if (isAttachmentChecked.value) {
    stopSelectionCycle(false)
    selectionColorBackup = null
    market.live2d.attachments[props.index][props.item.name].color = { r: 1, g: 1, b: 1, a: 1 }
    isAttachmentChecked.value = false
    market.live2d.triggerApplyAttachments()
  }
})

watch(() => market.live2d.resetAllLayers, () => {
  selectionColorBackup = null // prevent restore — Loader.vue resets colors to {1,1,1,1}
  isAttachmentChecked.value = false
})

const itemRef = ref<any>(null)
const isClickHighlighted = ref(false)

watch(() => market.live2d.triggerClickedAttachment, async () => {
  if (
    market.live2d.clickedAttachmentKey === props.item.name &&
    market.live2d.clickedAttachmentIndex === props.index
  ) {
    isAttachmentChecked.value = !isAttachmentChecked.value
    isClickHighlighted.value = true
    await nextTick()
    const el = itemRef.value?.$el ?? itemRef.value
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => { isClickHighlighted.value = false }, 1200)
  }
})

const previewing = ref(false)
const previewhovering = () => {
  previewing.value = true
}
const previewout = () => {
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
@keyframes clickHighlight {
  0%   { background-color: rgba(99, 226, 183, 0.35); }
  100% { background-color: transparent; }
}
.click-selected {
  animation: clickHighlight 1.2s ease-out;
  border-radius: 4px;
}
</style>
