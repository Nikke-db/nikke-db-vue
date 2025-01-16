<template>

  <n-upload
      directory-dnd
      :accept="`.${props.fileType}`"
      v-model:file-list="fileList"
      @change="(e: any) => handleMultipleListChange(e)"
      @update:file-list="handleFileListChange()"
      :multiple="props.multiple"
  >
    <n-upload-dragger>
      <div class="verticalFlex">
        <n-icon :component="AttachFileOutlined" :size="32"/>
        <span>Load &nbsp;<b>{{ props.multiple ? 'multiple' : 'a'}}</b>&nbsp;.{{ props.fileType }} {{ props.multiple ? 'files': 'file'}}</span>
      </div>
    </n-upload-dragger>
  </n-upload>

</template>

<script lang="ts" setup>

import { AttachFileOutlined } from '@vicons/material'
import { onMounted, ref, type Ref } from 'vue'
import type { UploadFileInfo } from 'naive-ui'
import { messagesEnum } from '@/utils/enum/globalParams'
import { useMarket } from '@/stores/market'

const market = useMarket()

const props = withDefaults(defineProps<{
  fileType: 'png' | 'skel' | 'atlas',
  multiple: boolean
}>(), {
  multiple: false
})

const fileList: Ref<UploadFileInfo[]> = ref([])

onMounted(() => {
  switch (props.fileType) {
    case 'png': initFiles(market.live2d.customPng); break
    case 'skel': initFiles([market.live2d.customSkel]); break
    case 'atlas': initFiles([market.live2d.customAtlas]); break
    default: console.error(`illegal prop value : ${props.fileType}`)
  }
})

let backupMultipleQuantity = 0

const initFiles = (data: {title: string, URI: string | ArrayBuffer | null, file: File | null}[]) => {
  if (data[0].file === null) return
  data.forEach((d) => {
    fileList.value.push( { id: d.title, status: 'pending', name: d.title, file: d.file } )
  })
}

const handleFileListChange = () => {

  if (props.multiple) return

  if (fileList.value.length > 1) {
    const backup = fileList.value[1]
    fileList.value = []
    fileList.value.push(backup)
    market.message.getMessage().error(messagesEnum.MESSAGE_UNLOAD)
  }

  const file = fileList.value[0].file!

  if (file.name.endsWith(`.${props.fileType}`)) {
    switch (props.fileType) {
      case 'atlas': market.live2d.initCustomAtlas(file); break
      case 'png': market.live2d.initCustomPng(file); market.live2d.customPng = []; break
      case 'skel': market.live2d.initCustomSkel(file); break
      default: console.error(`illegal prop value : ${props.fileType}`)
    }

    market.message.getMessage().success(messagesEnum.MESSAGE_ASSET_LOADED)
  } else {
    fileList.value = []
    market.message.getMessage().error(messagesEnum.MESSAGE_WRONG_FILE_FORMAT)
  }
}

/**
 * for characters that have several assets, allow the drag & drop or selection of several assets at once.
 * automated for infinite amount of pictures ( ie 10+ for brown dust )
 * naive will trigger this method once for each file "uploaded"
 * how to differenciate the last file from the first ? no clue.
 * so we go with the easiest path of cleansing the entire png array and filling it for every picture
 * definitely not performance friendly but should be okay. people who mod have more than enough hardware
 */
const handleMultipleListChange = (event: {file: UploadFileInfo, fileList: UploadFileInfo[]}) => {

  if (!props.multiple) return

  if (backupMultipleQuantity > event.fileList.length) { //most likely here because a file got removed
    market.live2d.customPng = market.live2d.customPng.filter((f) => {
      return f.title !== event.file.name
    })
  } else {
    market.live2d.initCustomPng(event.file.file!)
  }

  backupMultipleQuantity = event.fileList.length
}

</script>

<style scoped lang="less">
.verticalFlex {
  display: flex;
  justify-content: center;
}

</style>