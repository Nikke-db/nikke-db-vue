<template>
  <div class="body">
    <n-card
      title="Nikke: Database of Victory"
      size="medium"
      :class="checkMobile()"
    >
      <n-p>Last Update: {{ updates[updates.length-1].date }}</n-p>

      <n-alert type="success">
        Tried real hard to make a "Rewind to last move" button for the layer editor, in case you failed something big time. but it's a lot harder than I expected to work with cloning huge nested objects.<br/>
        I recommend making regular exports when working for a long time on an edition. <br/> <br/>

        My days off are ending the 6th january, but still do not hesitate to come forward if you notice an issue with the new tool.
      </n-alert>

      <n-divider></n-divider>

      <n-alert type="error">
        Now stopping to answer DMs asking how to datamine or extracting specific files for your own use.<br/>
        Please only come for feedback about the website.
      </n-alert>

    </n-card>

    <n-card title="Update log:" class="card-spacer updatelog" :class="checkMobile()">
      <n-scrollbar style="height:300px; padding-right: 15px">
        <n-ul>
          <n-li v-for="update in updates.slice().reverse()" :key="update.date">
            <n-text class="naive-underlive" :class="update.date === updates[updates.length-1].date ? 'latest-date' : 'older-date'">{{ update.date }}</n-text>:
            {{ update.update }}
          </n-li>
        </n-ul>
      </n-scrollbar>
      </n-card>
    <n-back-top :visibility-height="0" style="display: none" />
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeMount, onUnmounted } from 'vue'
import { useMarket } from '@/stores/market'
import bgi from '@/assets/index_bg2.png'
import updates from '@/utils/json/updateLog.json'
// import indexalt from '@/assets/index-alt.png'

const market = useMarket()

onBeforeMount(() => {
  market.load.beginLoad()
  document.body.classList.add('poli-bg')
})

onMounted(() => {
  setTimeout(() => {
    market.load.endLoad();
    (document.querySelector('.n-back-top') as HTMLElement).click()
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

.naive-underlive{
  text-decoration: underline;
}

.latest-date {
  color: @naive-green;
}

</style>
