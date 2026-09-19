<template>
  <div class="body">
    <n-card
      title="Nikke: Database of Victory"
      size="medium"
      :class="checkMobile()"
    >
      <n-p>Last Update: {{ updates[updates.length-1].date }}</n-p>

      <n-alert type="info" class="ytb">
        <iframe class="ytb-iframe" src="https://www.youtube.com/embed/h5eR27Gle1U" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </n-alert>

      <n-divider />

      <n-alert type="info">
        I took days off for 3 weeks to play limbus and to rewrite everything for Nikke-DB. The first half about character l2d should be pretty much done.<br/>
        I will look up to add the galleries and event live2d next week. <br/>
        Sorry for everyone who have been waiting for the Persona On Frontline gallery. I know it's been some time since the event but I didn't plan for all of this to happen with the game and work. <br/>
        Rewriting and changing the entire method of accessing the files is extremely time-consuming :(. <br/> <br/>

        <b>The new extraction method is entirely based on programatically guessing for existing files, searching them and extracting them. For instance "I know that a new Rapi skin exists, find it, download it, extract it". This entire process is based on context clues and file name patterns. <br/>
          This mean that, in case of exceptional cases where a NPC have been added to the game, but does not share some pattern similarities to other NPC & characters, it is literally impossible for me to know of it's existance. I don't play the game so I wouldn't know such a NPC exist. <br/>
          As such, once again, I'd like you guys to not hesitate and come forward to me with information so I can find and dig manually instead of letting the tools do their routine work.
        </b>

        <br/><br/>
        I'd like to reiterate that I will not help datamining for your own use. I based my tools on scripts that are easily findable in certain forums and spent time re-adapting to fit my own programming eco system and preferences. It's really hard to explain how to do it now and it might just be better for you to use the publicly accessible stuff ( I will not tell you where to find it though. risking nikke db to get nuked if I do )
      </n-alert>

      <n-divider />

      <n-alert type="info">
        I have quit the game and pretty much only "play" to do website updates. <br/>
        As such I can't really know NPC names anymore. So every NPCs I can't datamine from now on will have their names be "NPC: TBA" in the L2D viewer. <br/>
        Please open github tickets or send me discord messages so I can complete their names. Of course I'll at least need a picture or their c_id. <br/>
        I will still try to delay galleries just to avoid getting some cease and desist or copyrights.
      </n-alert>

      <n-divider />

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
import bgi from '@/assets/index_bg2.webp'
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

.ytb {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 */
  height: 0;

  .ytb-iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}

</style>
