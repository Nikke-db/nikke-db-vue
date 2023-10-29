<template>
  <span>
    <n-button ghost type="info" round @click="customLoader()">
      Custom Spine<br />
      Loader
    </n-button>

    <n-modal
      v-model:show="customSpineModal"
      id="customSpineModal"
      class="wideModalDialogWidth"
      :mask-closable="false"
      preset="dialog"
      title="&nbsp;&nbsp;Load custom a spine asset"
      positive-text="Close modal"
      negative-text="Close modal"
      :closable="false"
    >
      <n-card :bordered="false" size="huge" id="customSpineModalContent">
        Load custom spine 4.0 or 4.1 assets<br/>
        Useful to check out mods if you have all the non-encrypted files<br/>
        Not restricted to NIKKE assets<br/>
        Nothing will be saved on a server or your localhost.

        <div class="fileFlexWrap marginTop">
          <n-upload
          directory-dnd
          accept=".skel"
          v-model:file-list="skelFileList"
          @update:file-list="handleSkelFileListChange"
          >
            <n-upload-dragger>
              <div class="verticalFlex">
                <n-icon :component="AttachFileOutlined" :size="32"/>
                <span>Load a .skel file</span>
              </div>
            </n-upload-dragger>
          </n-upload>

          <n-upload
          directory-dnd
          accept=".png"
          list-type="image"
          v-model:file-list="pngFileList"
          @update:file-list="handlePngFileListChange"
          >
            <n-upload-dragger>
              <div class="verticalFlex">
                <n-icon :component="AttachFileOutlined" :size="32"/>
                <span>Load a .png file</span>
              </div>
            </n-upload-dragger>
          </n-upload>

          <n-upload
          directory-dnd
          accept=".atlas"
          v-model:file-list="atlasFileList"
          @update:file-list="handleAtlasFileListChange"
          >
            <n-upload-dragger>
              <div class="verticalFlex">
                <n-icon :component="AttachFileOutlined" :size="32"/>
                <span>Load a .atlas file</span>
              </div>
            </n-upload-dragger>
          </n-upload>

        </div>
          <n-select
            v-model:value="spineVersion"
            :options="spineVersionList"
            class="marginTop"
          />

          <n-button
          @click="triggerCustomLoad()"
          class="marginTop"
          type="primary"
          round
          >
            Load the custom assets
          </n-button>
      </n-card>
    </n-modal>
  </span>
</template>

<script setup lang="ts">
import { useMarket } from '@/stores/market'
import { messagesEnum } from '@/utils/enum/globalParams'
import type { UploadFileInfo } from 'naive-ui'
import { ref, type Ref, watch } from 'vue'
import { AttachFileOutlined } from '@vicons/material'

const market = useMarket()

const skelFileList: Ref<UploadFileInfo[]> = ref([])
const pngFileList: Ref<UploadFileInfo[]> = ref([])
const atlasFileList: Ref<UploadFileInfo[]> = ref([])

const spineVersionList = [
  {
    label: 'Use spine 4.0',
    value: 4.0
  },
  {
    label: 'Use spine 4.1',
    value: 4.1
  }
]

const spineVersion = ref(4.1)

const customSpineModal = ref(false)

const customLoader = () => {
  customSpineModal.value = true
}

const handleSkelFileListChange = () => {
  if (skelFileList.value.length > 1) {
    const backup = skelFileList.value[1]
    skelFileList.value = []
    skelFileList.value.push(backup)
    market.message.getMessage().error(messagesEnum.MESSAGE_UNLOAD)
  }

  const skelFile = skelFileList.value[0].file!

  if (skelFile.name.endsWith('.skel')) {
    market.live2d.initCustomSkel(skelFile)
    market.message.getMessage().success(messagesEnum.MESSAGE_ASSET_LOADED)
  } else {
    skelFileList.value = []
    market.message.getMessage().error(messagesEnum.MESSAGE_WRONG_FILE_FORMAT)
  }
}

const handlePngFileListChange = () => {
  if (pngFileList.value.length > 1) {
    const backup = pngFileList.value[1]
    pngFileList.value = []
    pngFileList.value.push(backup)
    market.message.getMessage().error(messagesEnum.MESSAGE_UNLOAD)
  }

  const pngFile = pngFileList.value[0].file!

  if (pngFile.name.endsWith('.png')) {
    market.live2d.initCustomPng(pngFile)
    market.message.getMessage().success(messagesEnum.MESSAGE_ASSET_LOADED)
  } else {
    pngFileList.value = []
    market.message.getMessage().error(messagesEnum.MESSAGE_WRONG_FILE_FORMAT)
  }
}

const handleAtlasFileListChange = () => {
  if (atlasFileList.value.length > 1) {
    const backup = atlasFileList.value[1]
    atlasFileList.value = []
    atlasFileList.value.push(backup)
    market.message.getMessage().error(messagesEnum.MESSAGE_UNLOAD)
  }

  const atlasFile = atlasFileList.value[0].file!

  if (atlasFile.name.endsWith('.atlas')) {
    market.live2d.initCustomAtlas(atlasFile)
    market.message.getMessage().success(messagesEnum.MESSAGE_ASSET_LOADED)
  } else {
    atlasFileList.value = []
    market.message.getMessage().error(messagesEnum.MESSAGE_WRONG_FILE_FORMAT)
  }
}

watch(spineVersion, () => {
  market.live2d.setCustomSpineVersion(spineVersion.value)
})

const triggerCustomLoad = () => {
  market.live2d.triggerCustomLoad()
}
</script>

<style scoped lang="less">
.n-button {
  width: 100%;
  height: 40px;
}
.fileFlexWrap {
  display: flex;

  > * {
    margin-left: 5px;
    margin-right: 5px;
  }
}

.marginTop {
  margin-top: 25px;
}

.verticalFlex {
  display: flex;
  justify-content: center;
  > * {
    &:nth-child(2) {
      display:flex;
      justify-content: center;
      flex-direction: column;
    }
  }
}
</style>
