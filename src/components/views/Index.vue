<template>
  <div class="body">
    <n-card
      title="Nikke: Database of Victory"
      size="medium"
      :class="checkMobile()"
    >
      <n-p>Last Update: {{ updates[updates.length-1].date }}</n-p>

      <n-alert type="success">
        Let's talk why favorite animations aren't on the website besides wave 1, <br/>
        The files are clearly broken, the background animations are splitted from the character animation, and I've always been vocal ( on discord at least ) that if I don't find a way to fix that I won't really bother with new favorites. <br /> <br />
        Time has come after 40+ hours of brute force testing ( decoding Skels, rewriting the spine run times, bruteforcing stuff here and there ) to give up on fixing it myself. <br/>
        PS: it was during these hours that I discovered how to remove layers. <br /> <br />

        I am now officially looking for a Spine Pro Owner to do the little work for me :
        <ul>
          <li>Must have a proof of ownership of the Pro Software for Spine 4.1 ( a portfolio should do )</li>
          <li>Must be 18+</li>
          <li>Must not be called Seireiko</li>
        </ul>

        I will pay 5€ through PayPal for each favorite asset fixed, which is 45 € for the current batch of 9 favorite animations. <br/>
        You will be contacted when new favorites releases ( or if I forget, you can contact me ) and will also be paid 5€ per favorite. <br/>
        I will be providing the files needed, and I want bg_idle and idle animation to be merged into one animation, and bg_expression_0 merged with expression_0 for a second animation. <br/>
        Four favorites are publicly available for anyone interested, please try to fix at least one and contact me with a result. <br/>
        First come first served, no new favorites until then.
      </n-alert>

      <n-divider />

      <n-alert type="success">
        Props to McPurrito on reddit, facebook and twitter for being the only dude crediting me on his layer editor posts. <br /> <br />

        Let's talk about Shift Up. <br/>

        Pretty solid stuff recently with the UR "rework", but please, if a random marketing member, intern, or translator comes by, do something for any of this :
        <ul>
          <li>When is the outpost city builder getting a single OUNCE of an update ? </li>
          <li>When are the next Liberation Units ?? According to Nikke Wikia, Nihilister released March 30th 2023, OVER 21 MONTHS AGO ???</li>
          <li>When are we getting new Outpost Academy tiers ? Are we supposed to expect 1 update every 15/16 months?</li>
          <li>When are we getting new Infrastructure Core levels?? Literally never got a new level. What even is the point of giving us xp by clearing level 300+ of every towers ? Everyone is level max with 50 000 extra xp at this point.</li>
          <li>What the fuck happened to the so called Sniper Rifle and Rocket Launcher reworks?? Too scared for the backlash ?</li>
          <li>Even if it got officially cancelled, private messaging should NOT be hard to implement, and would be useful to contact people that aren't in an union discord nor on communities.</li>
          <li>We're nearing the 20th month of Champion Arena being delayed, holy guacamolee what is happening with this game mode?</li>
          <li>Would be cool for UR hard mode to last more than 1 day and with infinite hp bosses</li>
          <li>There's a serious lack of generosity about materials. All. Of. Them. XGuillotine, XMaiden, Cinderella, Grave, Rapi Red Hood, Soon EVA or Stellar Blade collab. How do you expect people to make use of everyone of them when they release faster than the time it takes to gather skill mats for level 10s. Same about credit and custom modules, the quantity needed at high level is just astonishing</li>
          <li>Let's not talk about Doll XP materials that are just abysmally low to gather, and yet needs to be equipped on anyone that is half decent, max leveled out, to be competitive.</li>
        </ul>

        More and more day one players are leaving and I'm expecting myself to be out by the end of the year or 2026, this website will follow me to the grave. But we aren't getting more frustated, for that we've been quite for a long time already. <br/> <br/>
        I am extremely enclined to believe Shift Up only have 5 actual developpers on Nikke nowadays. And they are only working on event mini games and character kits. The entire game can be ran by Artists, Music composer, and Writers, using a tool to generate events and story chapters. There have just hasn't been any new permanent content since Dolls and Solo Raid, it's crazy (PS: Overclock, Anomaly & UR hard mode aren't new game modes, they are just older game mode with pumped up stats like tower & hard mode, which is really nice to have).<br />
        Rant's out. Happy fapping.
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
