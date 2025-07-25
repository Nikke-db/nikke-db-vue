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



       <AttachmentEditorListing :searchQuery="searchQuery" :colors="colorsToApply"/>



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

            <n-button class="triggerButton" round type="primary" ghost @click="market.live2d.triggerUpdateAttachments()">
              Apply modifications to selected layers
            </n-button> <br/><br/>

            <n-button class="triggerButton" round type="error" ghost @click="fixBrokenAnimation()">
              Fix broken animation
            </n-button>

             <span class="selectionButtons">
              <n-button @click="triggerExport()">Export Layers</n-button>

               <n-upload
                :multiple="false"
                accept=".json"
                @change="(e: any) => triggerImport(e)"
                file-list-style="display: none;"
               >
                  <n-button @click="selectUnselectSelection('unselect')">Import Layers</n-button>

               </n-upload>
            </span>

          </div>
        </template>

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
import {
  getExportableContent,
  getImportedContentV1,
  getKeyOfContentByString,
  type layerEditorImportableInterface
} from '@/utils/LayerEditorUtils'

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

const triggerExport = () => {
  const link = document.createElement('a')

  link.download = 'NIKKE-DB_LAYER_EDIT_' + market.live2d.current_id + '_' + market.live2d.current_pose + '_' +
      new Date().getTime().toString().slice(-3) + '.json'

  link.href = 'data:text/plain;charset=utf-8,' + JSON.stringify(
    getExportableContent(market.live2d.current_id, market.live2d.current_pose, market.live2d.attachments),
    null, 2)
  link.click()
}

const isImporting = ref(false)
let fileContent = '' as string

/**
 * We have to separate the current id and current pose calls so the watchers in Loader.vue does not overlap
 * We also need to wait for the asset to actually load or else the attachments won't be in pinia.
 * @param e
 */
const triggerImport = async (e: any) => {
  const content = await getImportedContentV1(e.file.file)
  importEditedLayer(content)
}

const importEditedLayer = (content: layerEditorImportableInterface) => {
  try {
    isImporting.value = true
    market.live2d.canLoadSpine = false
    market.live2d.current_id = content.cid
    // must use a temp fake pose or else the value set in setTimeout will not trigger the watcher
    // in the case of imported asset being same pose as currently selected one
    market.live2d.current_pose = 'temp'

    setTimeout(() => {
      market.live2d.canLoadSpine = true
      market.live2d.current_pose = content.pose
      fileContent = JSON.stringify(content)
    }, 500)
  } catch (e) {
    market.message.getMessage().error('Something wrong happened, no way to know what. send me your file through discord', market.message.long_message)
    isImporting.value = false
  }
}

/**
 * Will apply the imported layers after assets have loaded & market updated
 */
watch(() => market.live2d.finishedLoading, () => {
  if (isImporting.value) {
    const content = JSON.parse(fileContent)

    market.live2d.attachments.forEach((a) => {
      const keys = Object.keys(a)
      if (keys.length > 0) {
        keys.forEach((k) => {
          const keyInContent = getKeyOfContentByString(content, k)

          if (keyInContent === undefined) return

          a[k].color = { ...keyInContent }
        })
      }

    })
    isImporting.value = false
    market.live2d.triggerHideUI()
  }
})

// https://github.com/Nikke-db/nikke-db-vue/issues/45
const fixBrokenAnimation = () => {
  const exportableContent = getExportableContent(market.live2d.current_id, market.live2d.current_pose, market.live2d.attachments)
  importEditedLayer(exportableContent)
}

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

    .n-upload {
      width: fit-content;
    }
  }
  .selectionSlider {
    margin-top: 8px;
    margin-bottom: 8px;
  }
}
.n-upload-file-list {
  display: none;
}
</style>