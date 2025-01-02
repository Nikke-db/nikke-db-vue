<template>
  <div class="toolList" v-show="!market.live2d.hideUI">
    <n-card :bordered="false" size="small" class="toolCardTitle">
      <n-h3>Tools</n-h3>
    </n-card>
    <n-scrollbar style="height: calc(85vh - 120px)">
      <n-card :bordered="false" size="small" class="toolCardContent">

        <div class="toolListDiv">
          <PoseSelector />
          <Yapping />
        </div>

        <div class="toolListDiv">
          <ChangeQualityMode />
          <span class="routerLinkSpan">
            <RouterLink :to="{name: 'HQvqLQAssets'}" class="routerLink">
              Learn More
            </RouterLink>
          </span>
        </div>

        <div class="toolListDiv">
          <ResetCoordinates />
        </div>

        <div class="toolListDiv">
          <HideUI />
        </div>

        <div class="toolListDiv">
          <BackgroundColor />
        </div>

        <div class="toolListDiv">
          <BackgroundImage />
          <BackgroundImagePack />
        </div>

        <div class="toolListDiv">
          <AttachmentEditor />
        </div>

        <div class="toolListDiv">
          <Export />
        </div>

        <div style="display: flex;" class="toolListDiv">
          <Screenshot />
          <ChangeScreenshotSize />
        </div>

        <div class="toolListDiv">
          <CustomLoader />
        </div>

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
import Export from './Tools/Export.vue'
import Screenshot from './Tools/Screenshot.vue'
import ChangeScreenshotSize from './Tools/ChangeScreenshotSize.vue'
import CustomLoader from './Tools/CustomLoader.vue'
import { useMarket } from '@/stores/market'
import ChangeQualityMode from '@/components/common/Spine/Tools/ChangeQualityMode.vue'
import Yapping from '@/components/common/Spine/Tools/Yapping.vue'
import AttachmentEditor from '@/components/common/Spine/Tools/AttachmentEditor.vue'

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

    .toolListDiv {
      border-bottom: 1px solid @grey-color;
      padding-bottom: 10px;

      &:not(:nth-child(1)) {
        padding: 10px 0;
      }
    }

    .routerLinkSpan {
      width: 100%;
      display: block;
      text-align: center;

      .routerLink{
        color: @naive-green;
        text-decoration: underline;

      }
    }
  }
}
</style>
