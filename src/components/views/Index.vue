<template>
  <div class="body">
    <n-card
      title="Nikke: Database of Victory"
      size="medium"
      :class="checkMobile()"
    >
      <n-p>Last Update: {{ updates[updates.length-1].date }}</n-p>
      <n-p>the character page ( route /c or /character ) have been removed and will never be developped. Check out <n-a href="https://dotgg.gg/nikke/characters" target="_blank">dotgg.gg/nikke</n-a> for a better and quicker updated website.</n-p>
      <n-p>
        Nikke Community decided to shut down the server I used for feedback and
        update log, so I guess the only way to reach me out is through private
        discord messages (Koshirei#0333 / koshirei).
      </n-p>
    </n-card>

    <n-card title="Update log:" class="card-spacer" :class="checkMobile()">
      <n-p>New codebase, new update log! The old update log is still available on legacy website for the curious</n-p>
      <n-ul>
        <n-li v-for="update in updates.slice().reverse()" :key="update.date">{{ update.date }}: {{ update.update }}</n-li>
      </n-ul>
    </n-card>
    <n-back-top :visibility-height="0" style="display: none" />
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeMount, onUnmounted } from 'vue'
import { useMarket } from '@/stores/market'
import bgi from '@/assets/index_bg.jpg'
import updates from '@/utils/json/updateLog.json'

const market = useMarket()


onBeforeMount(() => {
  market.load.beginLoad()
  document.body.classList.add('poli-bg')
})

onMounted(() => {
  setTimeout(() => {
    market.load.endLoad()
    ;(document.querySelector('.n-back-top') as HTMLElement).click()
  }, 10)
  document.body.style.backgroundImage = 'url(' + bgi + ')'
})

onUnmounted(() => {
  document.body.classList.remove('poli-bg')
  document.body.style.backgroundImage = 'none'
})

const checkMobile = () => {
  return market.globalParams.isMobile ? 'isMobile' : ''
}


</script>

<style lang="less" scoped>
@import '@/utils/style/global_variables.less';

.body {
  padding-top: 45vh;
}

.n-card {
  background-color: @main-dark-theme-transparent;
  width: 50%;
  margin: 0 auto;
}

.card-spacer {
  margin-top: 100px;
}

.isMobile {
  width: 95%;
}
</style>
