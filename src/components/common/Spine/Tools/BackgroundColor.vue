<template>
  <span>
    <n-button ghost type="info" round @click="openBgcModal">
      Background <br />
      Color
    </n-button>

    <n-modal
      v-model:show="isBgcModalOpen"
      id="bgcModal"
      class="wideModalDialogWidth"
      :mask-closable="false"
      preset="dialog"
      title="&nbsp;&nbsp;Change the Background Color"
      positive-text="Confirm"
      negative-text="Cancel"
      @positive-click="confirmBgcModal()"
      @negative-click="cancelBgcModal()"
      :closable="false"
    >
      <n-card title="" :bordered="false" size="huge" id="bgcModalContent">
        Chosen color will be saved in localstorage.
        <n-color-picker
          :show-alpha="false"
          v-model:value="backgroundColor"
          :modes="['hex', 'rgb', 'hsl']"
          placement="bottom"
          :swatches="swatches"
          size="large"
        />
      </n-card>
    </n-modal>
  </span>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { messagesEnum, theme } from '@/utils/enum/globalParams'
import { useMarket } from '@/stores/market'

const market = useMarket()

const backgroundColor = ref('')
const backupBgc = ref('')
const isBgcModalOpen = ref(false)

const swatches = [
  theme.BACKGROUND_COLOR,
  theme.BACKGROUND_COLOR_2,
  '#000000',
  '#FFFFFF',
  theme.NAIVE_GREEN,
  theme.GREY
]

onMounted(() => {
  if (
    localStorage.getItem('l2d_bgc') === null ||
    localStorage.getItem('l2d_bgc') === undefined ||
    localStorage.getItem('l2d_bgc') === ''
  ) {
    localStorage.setItem('l2d_bgc', theme.BACKGROUND_COLOR)
  }

  backgroundColor.value = localStorage.getItem('l2d_bgc')!
  backupBgc.value = backgroundColor.value

  setBodyBgc(backgroundColor.value)
})

watch(backgroundColor, (e) => {
  setBodyBgc(e)
})

const setBodyBgc = (color: string) => {
  document.body.style.backgroundColor = color
}

const openBgcModal = () => {
  isBgcModalOpen.value = true
}

const closeBgcModal = () => {
  isBgcModalOpen.value = false
  saveToStorage()
}

const cancelBgcModal = () => {
  backgroundColor.value = backupBgc.value
  setBodyBgc(backgroundColor.value)
  closeBgcModal()
  market.message.getMessage().warning(messagesEnum.MESSAGE_CANCELLED)
}

const confirmBgcModal = () => {
  backupBgc.value = backgroundColor.value
  closeBgcModal()
  market.message.getMessage().success(messagesEnum.MESSAGE_LOCALSTORAGE_SAVED)
}

const saveToStorage = () => {
  localStorage.setItem('l2d_bgc', backgroundColor.value)
}
</script>

<style scoped lang="less">
.n-button {
  width: 100%;
  height: 40px;
}

#bgcModalContent {
  .n-color-picker {
    height: 70px;
    margin-top: 20px;
    font-size: x-large;
  }
}
</style>
