<template>
  <div class="body">
    <n-card
      title="Nikke: Database of Victory"
      size="medium"
      :class="checkMobile()"
    >
      <n-p>Last Update: {{ updates[updates.length-1].date }}</n-p>

      <n-alert type="info">
        holy shit canto 6 y'all ! <br/>

        <n-image src="https://cdn.discordapp.com/attachments/891090590048075786/1228809752382013571/fth1h6zpghsc1.png?ex=662d6543&is=661af043&hm=bf3600778864640c1b70d312256a9f27d1d9d794b4459e3332e0f8c83d81af43&"
                 width="50%"/>
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
import bgi from '@/assets/index_bg.jpg'
import updates from '@/utils/json/updateLog.json'

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
