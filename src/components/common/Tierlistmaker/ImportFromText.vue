<template>
  <span>
    <n-button  primary type="info" round @click="openModal()">
      Import from Txt
    </n-button>

    <n-modal v-model:show="isModalOpened"
             id="tierListGridOptions"
             class="wideModalDialogWidth"
             :mask-closable="false"
             preset="dialog"
             title="&nbsp;&nbsp;Import Tier List From text"
             positive-text="Confirm"
             negative-text="Cancel"
             @positive-click="confirmRowOptionsModal()"
             @negative-click="closeOptionsModal()"
             :closable="false"
    >
      <n-card :bordered="false" size="huge">

        <n-h3 type="info" prefix="bar">Tier List name</n-h3>
        <n-input
            v-model:value="importedText"
            type="textarea"
            placeholder="Text to import"
        />
      </n-card>

      <n-divider/>

      <n-alert type="error">
        If the website breaks because you imported a falsy text, the default tier list will be generated
      </n-alert>

      <n-divider/>

      <n-alert type="error">
        Confirming the import will instantly override the current tier list you have made. <br/>
        Be sure to export the current tier list before importing another one.
      </n-alert>
    </n-modal>
  </span>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { saveTierListToLocalStorageFromImportText } from '@/utils/tierlistUtils'

const isModalOpened = ref(false)
const importedText = ref()

const emit = defineEmits(['loadTierListFromStorage'])

const openModal = () => {
  isModalOpened.value = true
}

const closeOptionsModal = () => {
  isModalOpened.value = false
}

const confirmRowOptionsModal = () => {
  saveTierListToLocalStorageFromImportText(importedText.value)
  emit('loadTierListFromStorage')
}

</script>

<style lang="less" scoped>

</style>