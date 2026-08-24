<template>

  <div style="display: flex; justify-content: center;  flex-direction: column">
    <n-icon
        :size="24"
        :component="Cog"
        @click="showModal()"
        style="cursor: pointer;"
    />
  </div>

  <n-modal
      v-model:show="isModalOpen"
      preset="dialog"
      title="&nbsp;&nbsp;Choose a language"
      class="wideModalDialogWidth"
  >
    <n-card title="" :bordered="false" size="huge">
      Language only affect playable Nikkes and their skins. <br/>NPCs, favorites and event scenes are still exclusively in english. <br/> <br/>
      <n-select v-model:value="selectedLanguage" placeholder="" :show-arrow="false" :options="options" :render-label="renderLabel" />
    </n-card>

  </n-modal>

</template>

<script lang="ts" setup>

import type { SelectOption } from 'naive-ui'
import { h, onMounted, ref, watch } from 'vue'
import { GB, KR, JP, TW, CN, DE, TH, FR } from 'country-flag-icons/string/3x2'
import type { LANG } from '@/components/common/Spine/CharacterList.vue'
import { Cog } from '@vicons/fa'

const selectedLanguage = ref<LANG>()
const isModalOpen = ref(false)

const props = defineProps<{
  lang: LANG
}>()

const emits = defineEmits(['changeLanguage'])

onMounted(() => {
  selectedLanguage.value = props.lang
})

const showModal = () => {
  isModalOpen.value = true
}

const options = [
  {
    label: 'English',
    value: 'EN',
  },
  {
    label: '한국어',
    value: 'KR'
  },
  {
    label: '日本語',
    value: 'JP'
  },
  {
    label: '繁體中文',
    value: 'TW'
  },
  {
    label: '简体中文',
    value: 'CN'
  },
  {
    label: 'Deutsch',
    value: 'DE'
  },
  {
    label: 'ไทย',
    value: 'TH'
  },
  {
    label: 'Français',
    value: 'FR'
  }] as SelectOption[]

const renderLabel = (option: SelectOption) => {
  return [
    h('div', {
      style: 'display: flex;'
    },
    [
      h('img', { src: `data:image/svg+xml,${encodeURIComponent(str2flag(option.value as string))}`, style: 'height: 24px; margin: 0 8px 0 0' } ), option.label as string
    ]
    )
  ]
}

const str2flag = (str: string) => {
  switch (str) {
    case 'KR': return KR
    case 'JP': return JP
    case 'TW': return TW
    case 'CN': return CN
    case 'DE': return DE
    case 'TH': return TH
    case 'FR': return FR
    default: return GB
  }
}

watch(() => selectedLanguage.value, () => {
  emits('changeLanguage', selectedLanguage.value)
})
</script>
