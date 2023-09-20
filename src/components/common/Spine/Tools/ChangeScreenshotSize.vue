<template>
  <span>
    <n-button ghost type="info" round @click="openScSzModal()">
      Screenshot <br />options
    </n-button>

    <n-modal
      v-model:show="scSzModal"
      id="bgcModal"
      :mask-closable="false"
      preset="dialog"
      title="&nbsp;&nbsp;Change the Screenshot size"
      positive-text="Confirm"
      negative-text="Cancel"
      @positive-click="confirmScSzModal()"
      @negative-click="cancelScSzModal()"
      :closable="false"
    >
      <n-card title="" :bordered="false" size="huge" id="bgcModalContent">
        Screenshots are a square, chose the dimension wanted. Default dimension
        is 3000.<br />
        Value will be saved to your local storage

        <n-input-number
          v-model:value="size"
          :min="0"
          :max="9999"
          :clearable="false"
          :autofocus="false"
          :show-button="false"
        >
          <template #suffix> pixels </template>
        </n-input-number>
      </n-card>
    </n-modal>
  </span>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMarket } from '@/stores/market'
import { messagesEnum } from '@/utils/enum/globalParams'

onMounted(() => {
  if (
    localStorage.getItem('sc_sz') === null ||
    localStorage.getItem('sc_sz') === undefined ||
    localStorage.getItem('sc_sz') === ''
  ) {
    localStorage.setItem('sc_sz', '3000')
  }

  size.value = parseInt(localStorage.getItem('sc_sz')!)
})

const size = ref(0)
const market = useMarket()
const scSzModal = ref(false)

const openScSzModal = () => {
  scSzModal.value = true
  setTimeout(() => {
    ;(document.activeElement as HTMLElement).blur()
  }, 50)
}

const confirmScSzModal = () => {
  if (size.value === null) {
    market.message.getMessage().error(messagesEnum.MESSAGE_CANNOT_SAVE_EMPTY)
    return false
  } else {
    market.message.getMessage().success(messagesEnum.MESSAGE_LOCALSTORAGE_SAVED)
    localStorage.setItem('sc_sz', size.value.toString())
    return true
  }
}

const cancelScSzModal = () => {
  market.message.getMessage().warning(messagesEnum.MESSAGE_CANCELLED)
  size.value = parseInt(localStorage.getItem('sc_sz')!)
}
</script>

<style scoped lang="less">
.n-button {
  width: 100%;
  height: 40px;
  margin-top: 10px;
}

.n-input-number {
  margin-top: 20px;
}
</style>
