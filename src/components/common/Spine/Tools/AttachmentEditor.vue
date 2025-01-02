<template>
  <span>
    <n-button ghost type="error" round @click="openDrawer()" class="triggerButton">
      Layer <br />
      Editor
    </n-button>

    <n-drawer
        resizable
        v-model:show="isDrawerVisible"
        placement="right"
        default-width="500"
        :mask-closable="false"
        :show-mask="false">
      <n-drawer-content closable :native-scrollbar="false">

        <template #header>
          Layer Editor <br/>
          <span class="drawer-subtitle">
            <RouterLink :to="{ name: 'layerEditor' }" @click="market.live2d.triggerShowUI()">
              <n-a class="drawer-subtitle">Quick Tutorial</n-a>
            </RouterLink> <br/>
            Make em bald, make em clothless, you do you and I don't care. <br/>
            This feature can be laggy on shitty hardware. Beware. I don't care. <br/>
            Found a layer/attachment that doesn't behave as intended? HMU ASAP.
          </span>
        </template>

        <template #footer>
          <div class="drawer-footer">
            <n-input type="text" v-model:value="searchQuery" placeholder="Search for an attachment name" clearable/>

            <span class="selectionButtons">
              <n-button @click="selectUnselectSelection('select')">Select results</n-button>
              <n-button @click="selectUnselectSelection('unselect')">Deselect results</n-button>
            </span>

            <n-divider class="drawer-divider"/>

            <AttachmentEditorColorSlider v-model="colors.r" class="selectionSlider" color="red" type="error"/>
            <AttachmentEditorColorSlider v-model="colors.g" class="selectionSlider" color="green" type="success"/>
            <AttachmentEditorColorSlider v-model="colors.b" class="selectionSlider" color="blue" type="info"/>
            <AttachmentEditorColorSlider v-model="colors.a" class="selectionSlider" color="alpha channel" type="default"/>

            <n-button class="triggerButton" round type="primary" ghost @click="market.live2d.triggerApplyAttachments()">
              Apply modifications to selected layers
            </n-button>

          </div>
        </template>

         <AttachmentEditorListing :searchQuery="searchQuery" :colors="colorsToApply"/>

      </n-drawer-content>

    </n-drawer>

  </span>
</template>

<script setup lang="ts">

import { computed, ref, watch } from 'vue'
import { useMarket } from '@/stores/market'
import AttachmentEditorListing from '@/components/common/Spine/Tools/AttachmentEditorListing.vue'
import AttachmentEditorColorSlider from '@/components/common/Spine/Tools/AttachmentEditorColorSlider.vue'
import type { AttachmentItemColorInterface } from '@/utils/interfaces/live2d'

const market = useMarket()

const isDrawerVisible = ref(false)
const searchQuery = ref('')

const colors = ref({ r: 255, g: 255, b: 255, a: 255 })

const openDrawer = () => {
  isDrawerVisible.value = true
}

watch(isDrawerVisible, () => {
  if (isDrawerVisible.value) {
    market.live2d.triggerHideUI()
  } else {
    market.live2d.triggerShowUI()
  }
}, { deep: true })

const selectUnselectSelection = (selection: 'select' | 'unselect') => { // TODO : find a better method name
  market.live2d.selectionAttachments = selection
  market.live2d.triggerSelectAttachments()
}

/**
 * Spine want colors in a range 0..1 instead of 0..255 that every single other software on earth uses
 */
const colorsToApply = computed(() => {
  return {
    r: colors.value.r / 255,
    g: colors.value.g / 255,
    b: colors.value.b / 255,
    a: colors.value.a / 255
  } as AttachmentItemColorInterface
})


</script>

<style scoped lang="less">
.triggerButton {
  width: 100%;
  height: 40px;
}
.drawer-subtitle {
  font-size: xx-small;
}
.drawer-footer {
  height: 100%;
  width: 100%;

  .drawer-divider {
    margin: 16px 0 4px 0;
  }

  .selectionButtons {
    padding-top: 8px;
    display: flex;
    justify-content: space-evenly;
  }
  .selectionSlider {
    margin-top: 8px;
    margin-bottom: 8px;
  }
}
</style>