<template>
  <div id="divTools">
    <SynchroCost />
    <OutpostIncome />
  </div>
</template>

<script setup lang="ts">
import SynchroCost from '@/components/common/Tools/SynchroCost.vue'
import OutpostIncome from '@/components/common/Tools/OutpostIncome.vue'
import { onBeforeMount, onMounted } from 'vue'
import { useMarket } from '@/stores/market'

const market = useMarket()

onBeforeMount(() => {
  market.load.beginLoad()
})

onMounted(() => {
  setTimeout(() => {
    market.load.endLoad()
  }, 10)
})

</script>

<style scoped lang="less">
#divTools {
  margin-top: 50px;

  > * {
    margin-bottom: 50px;
  }
}
</style>
