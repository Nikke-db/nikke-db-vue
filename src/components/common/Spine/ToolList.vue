<template>
  <div class="toolList" v-show="!market.live2d.hideUI">
    <n-card :bordered="false" size="small" class="toolCardTitle">
      <n-h3>Tools</n-h3>
    </n-card>
    <n-scrollbar style="height: calc(85vh - 120px)">
      <n-card :bordered="false" size="small" class="toolCardContent">
        <div>
          <PoseSelector />
        </div>
        <div>
          <ResetCoordinates />
        </div>
        <div>
          <HideUI />
        </div>
        <div>
          <BackgroundColor />
        </div>
        <div>
          <BackgroundImage />
          <BackgroundImagePack />
        </div>
        <div>
          <Screenshot />
          <ChangeScreenshotSize />
        </div>
        <div>
          <CustomLoader />
        </div>
        <Recorder />
      </n-card>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import PoseSelector from './Tools/PoseSelector.vue'
import ResetCoordinates from './Tools/ResetCoordinates.vue'
import HideUI from './Tools/HideUI.vue'
import BackgroundColor from './Tools/BackgroundColor.vue'
import BackgroundImage from './Tools/BackgroundImage.vue'
import BackgroundImagePack from './Tools/BackgroundImagePack.vue'
import Screenshot from './Tools/Screenshot.vue'
import ChangeScreenshotSize from './Tools/ChangeScreenshotSize.vue'
import CustomLoader from './Tools/CustomLoader.vue'
import Recorder from './Tools/Recorder.vue'
import { useMarket } from '@/stores/market'

const market = useMarket()
</script>

<style scoped lang="less">
@import '@/utils/style/global_variables.less';

.toolList {
  position: absolute;
  top: 130px;
  right: 20px;
  width: 150px;
  min-height: calc(85vh - 120px);

  .n-card {
    border-radius: 0px;
  }

  .toolCardTitle {
    height: 60px;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    border: 1px solid @naive-green;
    border-bottom: none;
  }

  .toolCardContent {
    user-select: none;
    min-height: calc(85vh - 120px);
    height: 100%;
    border-right: 1px solid @naive-green;

    div {
      border-bottom: 1px solid @grey-color;
      padding-bottom: 10px;

      &:not(:nth-child(1)) {
        padding: 10px 0;
      }
    }
  }
}
</style>
