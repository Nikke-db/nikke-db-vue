<template>
    <span>
        <n-button ghost type="info" round @click="openBgiModal()">
            Background <br/>
            Image
        </n-button>

        <n-modal 
            v-model:show="isBgiModalOpen" 
            id="bgcModal"
            preset="dialog"
            title="&nbsp;&nbsp;Change the Background Image"
            positive-text="Confirm"
            :closable="false"
            >
                <n-card
                title=""
                :bordered="false"
                size="huge"
                id="bgcModalContent"
                >
                    <n-upload
                        directory-dnd
                        accept="image/*"
                        list-type="image"
                        v-model:file-list="fileList"
                        @update:file-list="handleFileListChange"
                    >
                        <n-upload-dragger>
                            <n-icon size="48" :component="DriveFolderUploadOutlined"></n-icon><br/>
                            <n-text >Click or drag and drop an image</n-text><br/>
                            <n-text depth="3">The file will be loaded locally and not sent to any server</n-text>
                        </n-upload-dragger>
                    </n-upload>

                    <div v-if="fileList.length > 0" class="separator">
                        <n-tabs default-value="signin" size="large" justify-content="space-evenly">
                          <n-tab-pane name="bgi_size" tab="Size">
                            <n-radio-group name="radioBgiSize" v-model:value="size">
                              <span v-for="siz in sizes">
                                <n-radio
                                  :key="siz.value"
                                  :value="siz.value"
                                  :label="siz.label"
                                  /> <br/>
                              </span>
                            </n-radio-group>
                          </n-tab-pane>
                          <n-tab-pane name="bgi_posi" tab="Position" class="spanPosition">
                            <span v-for="(posi, index) in positions">
                              <n-button :type="checkIfSelectedPosiType(posi.position)" :ghost="!checkIfSelectedPosiBool(posi.position)" @click="() => changePlacement(posi.position)" class="positionBtn">
                                <n-icon :component="posi.icon" size="30" :class="checkIfSelectedPosiClass(posi.position)"/>
                              </n-button>
                              <br v-if="(index + 1) % 3 === 0"/>
                            </span>
                          </n-tab-pane>
                        </n-tabs>
                    </div>
                </n-card>

        </n-modal>
    </span>
</template>

<script setup lang="ts">
import { ref, type Ref, onUnmounted, watch } from 'vue'
import { DriveFolderUploadOutlined } from '@vicons/material'
import { MinusVertical, Minus, RadiusTopLeft, RadiusTopRight, RadiusBottomLeft, RadiusBottomRight, Circle } from '@vicons/tabler'
import { type UploadFileInfo } from 'naive-ui';

const isBgiModalOpen = ref(false)
const fileList: Ref<UploadFileInfo[]> = ref([])

const size = ref('auto')
const sizes = [
  {
    value: "auto",
    label: "Auto"
  },
  {
    value: "cover",
    label: "Cover"
  },
  {
    value: "contain",
    label: "Contain"
  }
]

const position = ref("center")
const positions = [
  {
    position: "top left",
    icon: RadiusTopLeft
  },
  {
    position: "top",
    icon: Minus
  },
  {
    position: "top right",
    icon: RadiusTopRight
  },
  {
    position: "left",
    icon: MinusVertical
  },
  {
    position: "center",
    icon: Circle
  },
  {
    position: "right",
    icon: MinusVertical
  },
  {
    position: "bottom left",
    icon: RadiusBottomLeft
  },
  {
    position: "bottom",
    icon: Minus
  },
  {
    position: "bottom right",
    icon: RadiusBottomRight
  }
]

document.body.style.backgroundSize = size.value
document.body.style.backgroundPosition = position.value

const openBgiModal = () => {
    isBgiModalOpen.value = true
}

onUnmounted(() => {
    document.body.style.backgroundImage = "none"
    document.body.style.backgroundSize = "cover"
    document.body.style.backgroundRepeat = "no-repeat"
    document.body.style.backgroundAttachment = "fixed"
    document.body.style.backgroundPosition = "center"
})

const handleFileListChange = () => {
    if (fileList.value.length > 1) {
        const backup = fileList.value[1]
        fileList.value = []
        fileList.value.push(backup)
    }

    let fileReader = new FileReader()
    fileReader.readAsDataURL(fileList.value[0].file!)
    fileReader.onload = () => {
        document.body.style.backgroundImage = 'url(' + fileReader.result + ')' 
        document.body.style.backgroundRepeat = "no-repeat"
    }
}

watch(size, () => {
  document.body.style.backgroundSize = size.value
})

const changePlacement = (e: string) => {
  document.body.style.backgroundPosition = e
  position.value = e
}

const checkIfSelectedPosiClass = (e : string) => {
  return checkIfSelectedPosiBool(e) ? "icn_black" : ''
}
const checkIfSelectedPosiType = (e: string) => {
  return checkIfSelectedPosiBool(e) ? "warning": "info"
} 

const checkIfSelectedPosiBool = (e: string) => {
  return e === position.value
}
</script>

<style scoped lang="less">
@import '@/utils/style/global_variables.less';
.n-button {
    width: 100%;
    height: 40px;
}

.separator {
  border-top: @grey-color 1px solid;
  margin-top: 10px;
}

.positionBtn {
  width: 25%;
  height: 50px
}

.spanPosition {
  text-align: center;
}

.icn_black {
  color: black
}
</style>