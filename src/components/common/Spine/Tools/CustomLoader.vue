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
      title="&nbsp;&nbsp;Load a custom spine asset"
      positive-text="Close modal"
      negative-text="Close modal"
      :closable="false"
    >
      <n-tabs>

        <n-tab-pane name="Custom L2D Loader">
          <n-card :bordered="false" size="huge" id="customSpineModalContent">
            Load custom spine 4.0 or 4.1 assets<br/>
            Useful to check out mods if you have all the non-encrypted files<br/>
            Not restricted to NIKKE assets<br/>
            Nothing will be saved on a server or your localhost.

            <div class="fileFlexWrap marginTop">
              <CustomLoaderItem fileType="skel" accept=".skel, .json, .prefab"/>

              <CustomLoaderItem fileType="png" :multiple="additionalPng" accept=".png"/>

              <n-button
                dashed type="info"
                class="additional-png"
                @click="triggerAdditionalPng"
              >
                <n-icon :component="!additionalPng ? PlusCircleOutlined : MinusCircleOutlined" :size="32"></n-icon>
              </n-button>

              <CustomLoaderItem fileType="atlas" accept=".atlas"/>

            </div>

            <n-select
              v-model:value="spineVersion"
              :options="spineVersionList"
              class="marginTop"
            />

            <n-select
                v-model:value="premultipliedAlpha"
                :options="getFormattedBooleanTemplate('Pre Multiplied Alpha')"
                class="marginTop"
            />

            <n-select
                v-model:value="defaultIdleAnimation"
                :options="getFormattedBooleanTemplate('Default animation \'idle\'')"
                class="marginTop"
            />

            <n-switch
                class="marginTop coloredSwitch"
                v-model:value="loader"
                checked-value="skel"
                unchecked-value="json"
                :rail-style="(e: RailStyleInterface) => railstyle(e)"
            >
              <template #checked>
                Use Skel Binary
              </template>
              <template #unchecked>
                Use Json
              </template>
              <template #checked-icon>
                <n-icon :component="Binary" />
              </template>
              <template #unchecked-icon>
                <n-icon :component="Json" />
              </template>
            </n-switch>

            <n-button
              @click="triggerCustomLoad()"
              class="marginTop submit"
              type="primary"
              round
            >
              Load the custom assets
            </n-button>
          </n-card>
        </n-tab-pane>

        <n-tab-pane name="Alpha Converters">
          <AlphaConverters />
        </n-tab-pane>

      </n-tabs>
    </n-modal>
  </span>
</template>

<script setup lang="ts">
import { useMarket } from '@/stores/market'
import { messagesEnum } from '@/utils/enum/globalParams'
import type { UploadFileInfo } from 'naive-ui'
import { type CSSProperties, ref, type Ref, watch } from 'vue'
import { PlusCircleOutlined, MinusCircleOutlined } from '@vicons/antd'
import { Json } from '@vicons/carbon'
import { Binary } from '@vicons/tabler'
import AlphaConverters from '@/components/common/Tools/AlphaConverters.vue'
import CustomLoaderItem from '@/components/common/Spine/Tools/CustomLoaderItem.vue'
import type { RailStyleInterface } from '@/utils/interfaces/live2d'

const market = useMarket()

const additionalPngFileList: Ref<UploadFileInfo[]> = ref([])

const additionalPng = ref(false)

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

const constructTemplateBoolean = () => {
  return [
    {
      label: 'xxx : true',
      value: true
    },
    {
      label: 'xxx : false',
      value: false
    }
  ]
}

const getFormattedBooleanTemplate = (str: string) => {
  return constructTemplateBoolean().map((v) => {
    v.label = v.label.replace('xxx', str)
    return v
  })
}

const spineVersion = ref(4.1)
const premultipliedAlpha = ref(true)
const defaultIdleAnimation = ref(true)
const loader = ref<'skel' | 'json'>('skel')

const customSpineModal = ref(false)

const customLoader = () => {
  customSpineModal.value = true
}

watch(spineVersion, () => {
  market.live2d.setCustomSpineVersion(spineVersion.value)
})

watch(premultipliedAlpha, () => {
  market.live2d.setPremultipliedAlpha(premultipliedAlpha.value)
})

watch(defaultIdleAnimation, () => {
  market.live2d.setCustomDefaultAnimationIdle(defaultIdleAnimation.value)
})

watch(loader, () => {
  market.live2d.setCustomLoader(loader.value)
})

const triggerCustomLoad = () => {
  market.live2d.current_pose = 'fb'
  market.live2d.triggerCustomLoad()
}

const triggerAdditionalPng = () => {
  additionalPng.value = !additionalPng.value

  if (additionalPng.value === false && additionalPngFileList.value.length > 0) {
    additionalPngFileList.value = []
    market.message.getMessage().error(messagesEnum.MESSAGE_UNLOAD)
  }
}

// font color handled in css .
const railstyle = ( e: RailStyleInterface ) => {
  const style: CSSProperties = {}

  if (e.checked) {
    style.backgroundColor = '#63e2b7'
  } else {
    style.backgroundColor = '#ffd700'
  }

  return style
}
</script>

<style scoped lang="less">
.n-button {
  &.submit {
    width: 100%;
    height: 40px;
  }
  &.additional-png {
    height: 82px;
  }
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
