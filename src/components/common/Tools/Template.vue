<template>
    <n-card :class='checkMobile()'>
      <!-- <n-icon :component="ChevronRight" size="40"/> -->
        <n-h1 @click="showOrHide" prefix="bar" :type="show ? 'success' : 'info'">{{ props.title }}</n-h1>

        <n-collapse-transition :show="show">
          <div class="slot">
            <slot name="form" />
          </div>
        </n-collapse-transition>

        <n-collapse-transition :show="props.resultShow && show">
          <div class="slot">
            <slot name="result" />
          </div>
        </n-collapse-transition>

    </n-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMarket } from '@/stores/market'

const show = ref(false)
const market = useMarket()

const props = defineProps({
    title: {
        type: String,
        required: true
    },
    resultShow: {
      type: Boolean,
      required: true
    }
})

const showOrHide = () => {
  show.value = !show.value
}

const checkMobile = () => {
  return market.globalParams.isMobile ? 'mobile' : ''
}
</script>

<style lang="less" scoped>
@import '@/utils/style/global_variables.less';

.n-card {
  width: 80%;
  margin:0 auto;

  .n-h1 {
    user-select: none;
    &:hover {
      cursor: pointer;
    }
  }
}

.n-collapse-transition {
    border-top: 1px @grey-color solid;
    .slot {
      padding-bottom: 15px;
      padding-top: 15px;
    }
}

.mobile {
  width: 95%
}


</style>