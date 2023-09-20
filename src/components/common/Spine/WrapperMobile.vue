<template>
  <div>
    <n-icon
      :size="50"
      :component="Cog"
      id="mobileCogL2d"
      @click="showCogModal()"
    />
    <BackgroundColor v-show="false" />
    <n-modal v-model:show="isCogModalVisible" id="cogModal">
      <n-card title="Options" :bordered="false" size="huge" role="dialog">
        <template #header-extra>
          <n-icon
            :component="CloseOutlined"
            :size="40"
            @click="hideCogModal()"
          />
        </template>

        <n-tabs type="line" animated size="large">
          <n-tab-pane name="Character" tab="Character">
            <CharacterList />
          </n-tab-pane>

          <n-tab-pane name="options" tab="Options" class="options">
            <div class="l2d-options-tab">
              <n-switch v-model:value="showHeaderBool" class="center-switch">
                <template #checked> The header is currently visible </template>

                <template #unchecked> The header is currently hidden </template>
              </n-switch>
              <br />
            </div>
            <div>
              <div class="poseSelector">
                <span>
                  <PoseSelector />
                </span>
              </div>
            </div>
          </n-tab-pane>

          <n-tab-pane name="tools" tab="Tools" class="options">
            <div>
              <BackgroundColor />
            </div>
            <div>
              <Screenshot />
              It is extremely recommended for mobile users to pause the frame
              they want to screenshot before pressing the button, as the pop up
              make it really hard to get the frame you want.<br />
              Custom screenshot size and better resolution will happen in the
              future, for now the screenshot will have the width and height of
              your screen.
            </div>
          </n-tab-pane>
        </n-tabs>

        <template #footer>
          <!-- footer content -->
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { Cog } from '@vicons/fa'
import { CloseOutlined } from '@vicons/antd'
import { ref, watch } from 'vue'
import CharacterList from './CharacterList.vue'
import { useMarket } from '@/stores/market'
import PoseSelector from '@/components/common/Spine/Tools/PoseSelector.vue'
import BackgroundColor from './Tools/BackgroundColor.vue'
import Screenshot from './Tools/Screenshot.vue'

const market = useMarket()

const isCogModalVisible = ref(false)
const showHeaderBool = ref(false)

const showCogModal = () => {
  isCogModalVisible.value = true
}

const hideCogModal = () => {
  isCogModalVisible.value = false
}

watch(showHeaderBool, () => {
  switch (showHeaderBool.value) {
    case true:
      market.globalParams.showMobileHeader()
      break
    case false:
      market.globalParams.hideMobileHeader()
      break
  }
})
</script>

<style lang="less" scoped>
@import '@/utils/style/global_variables.less';

#mobileCogL2d {
  position: absolute;
  top: 130px;
  left: 10px;
}

#cogModal {
  width: 95%;
  height: 80vh;
}

.n-tab-pane {
  height: calc(80vh - 200px);
  overflow: auto;

  .l2d-options-tab {
    width: 100%;
    text-align: center;
  }

  .poseSelector {
    text-align: center;

    span {
      text-align: left;
    }
  }

  &.options > * {
    padding-bottom: 10px;

    &:not(:nth-child(1)) {
      border-top: 1px solid @grey-color;
      padding: 10px 0;
    }
  }
}

.n-tabs {
  height: 100%;
}
</style>
