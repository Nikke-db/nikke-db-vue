<template>
  <n-card class="center" :class="checkMobile()">
    <n-h1>{{ props.title }}</n-h1>
    <n-h3 v-if="props.subTitle !== null"> {{ props.subTitle }}</n-h3>
    <CreditTable :data="props.data" />
  </n-card>
</template>

<script setup lang="ts">
import type { help } from '@/utils/interfaces/contributor'
import CreditTable from '@/components/common/Credits/Table.vue'
import { useMarket } from '@/stores/market'

const market = useMarket()

const props = defineProps({
  data: {
    type: Object as () => help[],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  subTitle: {
    type: String,
    required: false
  }
})

const checkMobile = () => {
  return market.globalParams.isMobile ? 'mobile' : ''
}
</script>

<style>
.mobile {
  width: 95%;
  text-align: left;
}
</style>
