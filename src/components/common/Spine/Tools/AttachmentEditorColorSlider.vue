<template>
  <div class="slider-flex">

    <n-button round ghost @click="setValue(0)" :type="props.type">0</n-button>
    <n-slider
        :keyboard="true"
        :max="255"
        :min="0"
        v-model:value="model"
        :id="getId"
        :format-tooltip="(e: number) => tooltipFormat(e)"
    />
    <n-button round ghost @click="setValue(255)" :type="props.type">255</n-button>
  </div>

</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

const props = defineProps<{
  color: string,
  type: 'error' | 'info' | 'success' | 'default'
}>()

const model = defineModel<number>()

onMounted(() => {
  const slider = document.getElementById(getId.value) as HTMLDivElement
  const subSlider = slider.getElementsByClassName('n-slider-rail')[0] as HTMLDivElement
  if (!props.color.toLowerCase().includes('alpha')) {
    subSlider.style.background = `linear-gradient(90deg, transparent, ${props.color})`
  } else {
    subSlider.style.background = 'linear-gradient(90deg, black, white)'
  }
  const subSubSlider = subSlider.getElementsByClassName('n-slider-rail__fill')[0] as HTMLDivElement
  subSubSlider.style.background = 'none'
})

const getId = computed(() => {
  return `slider-color-${props.color}`
})

const tooltipFormat = (value: number) => {
  return `${props.color[0].toUpperCase()}${props.color.slice(1)} : ${value}`
}

const setValue = (value: number) => {
  model.value = value
}
</script>

<style scoped lang="less">

.slider-flex{
  display: flex;
  justify-content: center;
  .n-slider {
    margin: auto 5px;
  }
}


</style>