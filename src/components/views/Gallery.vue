<template>
  <div class="galleryBody">
    <n-card :class="checkMobile()" title="Gallery">

<!--      <n-alert type="warning">-->
<!--        Last Kingdom Gallery will be added after part 2 is done. enjoy the event, this one is worth it compared to re zero.-->
<!--      </n-alert>-->

      <n-h1>Story</n-h1>
      <ButtonTemplate
        v-for="buttonItem in buttonListStory"
        :key="buttonItem.data.id"
        :data-to-load="buttonItem.data"
        :carousel-data="carouselData" :current-id="currentId" @load-data="(data: galleryInterface) => loadData(data)"
      />

      <n-h1>Side Stories</n-h1>
      <ButtonTemplate
          v-for="buttonItem in buttonListSideStory"
          :key="buttonItem.data.id"
          :data-to-load="buttonItem.data"
          :carousel-data="carouselData" :current-id="currentId" @load-data="(data: galleryInterface) => loadData(data)"
      />

      <n-h1>Events</n-h1>
      <ButtonTemplate
        v-for="buttonItem in buttonListEvents"
        :key="buttonItem.data.id"
        :data-to-load="buttonItem.data"
        :carousel-data="carouselData" :current-id="currentId" @load-data="(data: galleryInterface) => loadData(data)"
      />

      <n-h1>Other</n-h1>
      <ButtonTemplate
        v-for="buttonItem in buttonListOther"
        :key="buttonItem.data.id"
        :data-to-load="buttonItem.data"
        :carousel-data="carouselData" :current-id="currentId" @load-data="(data: galleryInterface) => loadData(data)"
      />

      <n-h1>Community Content</n-h1>
      This place could display anything community made on discord/twitter/arca.live/anything. hit me up if you are interested in displaying something here!<br/><br/>
      <ButtonTemplate
        v-for="buttonItem in buttonListCommunity"
        :key="buttonItem.data.id"
        :data-to-load="buttonItem.data"
        :carousel-data="carouselData" :current-id="currentId" @load-data="(data: galleryInterface) => loadData(data)"
      />
    </n-card>

    <n-card :class="checkMobile()" id="scrollTo">
      <n-h1 prefix="bar" :type="carouselData === null ? 'error' : 'success'">
        {{ carouselData === null ? 'No data selected' : carouselData.title }}
      </n-h1>

      <n-alert type="info" v-if="carouselData && carouselData.notice">
        <div v-html="carouselData.notice"/>
      </n-alert>
      <br v-if="carouselData && carouselData.notice" />

      <!-- COMPUTER CAROUSEL -->
      <n-carousel v-if="carouselData !== null && !checkMobileBool() && carouselData.type !== 'large'"
      :slides-per-view="2"
      :default-index="index - 1"
      :current-index="index - 1"
      draggable
      :loop="true"
      :dot-type="'line'"
      :show-arrow="true"
      :space-between="5"
      @update:current-index="(e: number) => updateIndex(e)"
      style="width: 80%"
      >
        <n-carousel-item v-for="data in carouselData.content" :key="data.name">
          <div v-if="carouselData.type === 'img'">
            <n-image
              :src="globalParams.GALLERY + carouselData.path + data.name +'.png'"
              :fallback-src="maids"
              style="height:20vw; max-height: 512px;"
            />
            <n-h3 prefix="bar" type="info">
              {{ data.text }}
            </n-h3>
          </div>
        </n-carousel-item>
        <template #arrow="{ prev, next }">
          <ArrowTemplate :index="index" :total="carouselData.content.length - 1" :prev="prev" :next="next"/>
        </template>
      </n-carousel>

      <!-- MOBILE/LARGE CAROUSEL -->
      <n-carousel v-if="carouselData !== null && (checkMobileBool() || carouselData.type === 'large') "
      :slides-per-view="1"
      draggable
      :default-index="index - 1"
      :current-index="index - 1"
      :loop="true"
      :show-arrow="true"
      :dot-type="'line'"
      :show-dots="!checkMobileBool()"
      :space-between="50"
      @update:current-index="(e: number) => updateIndex(e)"
      style="max-width: 95%"
      >
        <n-carousel-item v-for="data in carouselData.content" :key="data.name">
          <div style="text-align:center; width:100%;">
            <img
            :src="globalParams.GALLERY + carouselData.path + data.name +'.png'"
            :fallback-src="maids"
            style="max-width: 95%; max-height:80vh; object-fit: cover;"
            object-fit='contain'
            />
          </div>
          <n-h3 style="text-align: center;">
            <span v-if="data.text.includes('https://twitter.com/')">
              <n-a :href="data.text" target="_blank">
                <span v-if="data.text.includes('NIKKE_en')">Original Tweet</span>
                <span v-else-if="data.text.includes('NIKKE_japan')">元のツイート</span>
                <span v-else-if="data.text.includes('NIKKE_kr')">원본 트윗</span>
              </n-a>
            </span>
            <span v-else>
              {{ data.text }}
            </span>
          </n-h3>

        </n-carousel-item>
        <template #arrow="{ prev, next }">
          <ArrowTemplate :index="index" :total="carouselData.content.length" :prev="prev" :next="next"/>
        </template>
      </n-carousel>
    </n-card>
  </div>
</template>

<script lang="ts" setup>
import { useMarket } from '@/stores/market'
import type { galleryInterface } from '@/utils/interfaces/gallery'
import { type Ref, ref } from 'vue'
import maids from '@/assets/maids.png'
import { messagesEnum, globalParams } from '@/utils/enum/globalParams'
import ArrowTemplate from '@/components/common/Gallery/ArrowTemplate.vue'
import ButtonTemplate from '@/components/common/Gallery/ButtonTemplate.vue'

import albumCovers from '@/utils/json/Gallery/albums.json'
import chapterThumbnails from '@/utils/json/Gallery/chapters.json'
import whiteMemory from '@/utils/json/Gallery/whitememory.json'
import fourkoma_en from '@/utils/json/Gallery/4koma_en.json'
import fourkoma_jp from '@/utils/json/Gallery/4koma_jp.json'
import fourkoma_kr from '@/utils/json/Gallery/4koma_kr.json'
import story1 from '@/utils/json/Gallery/story1.json'
import story2 from '@/utils/json/Gallery/story2.json'
import story3 from '@/utils/json/Gallery/story3.json'
import story4 from '@/utils/json/Gallery/story4.json'
import story5 from '@/utils/json/Gallery/story5.json'
import story6 from '@/utils/json/Gallery/story6.json'
import story7 from '@/utils/json/Gallery/story7.json'
import bbqmaster from '@/utils/json/Gallery/bbqmaster.json'
import voltroad from '@/utils/json/Gallery/voltroad.json'
import bluewaterisland from '@/utils/json/Gallery/bluewaterisland.json'
import brandnewyear from '@/utils/json/Gallery/brandnewyear.json'
import outerautomata from '@/utils/json/Gallery/outerautomata.json'
import doutsiders from '@/utils/json/Gallery/doutsiders.json'
import bonds from '@/utils/json/Gallery/bonds.json'
import fullfoolday from '@/utils/json/Gallery/fullfoolday.json'
import miraclesnow from '@/utils/json/Gallery/miraclesnow.json'
import seayouagain from '@/utils/json/Gallery/seayouagain.json'
import overzone from '@/utils/json/Gallery/overzone.json'
import redash from '@/utils/json/Gallery/redash.json'
import sevensevenseven from '@/utils/json/Gallery/777.json'
import nyanyaparadise from '@/utils/json/Gallery/nyanyaparadise.json'
import neverland from '@/utils/json/Gallery/neverland.json'
import snowfalloasis from '@/utils/json/Gallery/snowfalloasis.json'
import boomsday from '@/utils/json/Gallery/boomsday.json'
import killthelord from '@/utils/json/Gallery/killthelord.json'
import recipeforyou from '@/utils/json/Gallery/recipeforyou.json'
import liarsend from '@/utils/json/Gallery/liarsend.json'
import side01 from '@/utils/json/Gallery/side01.json'
import side02 from '@/utils/json/Gallery/side02.json'
import lastkingdom from '@/utils/json/Gallery/lastkingdom.json'
import darkhero from '@/utils/json/Gallery/darkhero.json'
import goldencoinrush from '@/utils/json/Gallery/goldencoinrush.json'
import beautyfullshot from '@/utils/json/Gallery/beautyfullshot.json'
import juveniledays from '@/utils/json/Gallery/juveniledays.json'
import colorless from '@/utils/json/Gallery/colorless.json'
import evangelion from '@/utils/json/Gallery/evangelion.json'
import jinxplayer from '@/utils/json/Gallery/jinxplayer.json'
import oldtales from '@/utils/json/Gallery/oldtales.json'
import icedragonsaga from '@/utils/json/Gallery/icedragonsaga.json'
import dragondungeonrun from '@/utils/json/Gallery/dragondungeonrun.json'
import footstepwalkrun from '@/utils/json/Gallery/footstepwalkrun.json'
import secondquest from '@/utils/json/Gallery/secondquest.json'
import fourkoma_zh from '@/utils/json/Gallery/4koma_zh.json'
import newflavor from '@/utils/json/Gallery/newflavor.json'
import forrest from '@/utils/json/Gallery/forrest.json'
import foolburstday from '@/utils/json/Gallery/foolburstday.json'

const market = useMarket()

const carouselData: Ref<galleryInterface | null> = ref(null)
const index = ref(1)
const currentId = ref('')

interface buttonInterface {
  data: galleryInterface
}

const buttonListStory = [
  { data: chapterThumbnails },
  { data: story1 },
  { data: story2 },
  { data: story3 },
  { data: story4 },
  { data: story5 },
  { data: story6 },
  { data: story7 }
] as buttonInterface[]

const buttonListSideStory = [
  { data: side01 },
  { data: side02 }
] as buttonInterface[]

const buttonListEvents = [
  { data: miraclesnow },
  { data: brandnewyear },
  { data: doutsiders },
  { data: fullfoolday },
  { data: overzone },
  { data: whiteMemory },
  { data: sevensevenseven },
  { data: bluewaterisland },
  { data: nyanyaparadise },
  { data: seayouagain },
  { data: outerautomata },
  { data: redash },
  { data: neverland },
  { data: snowfalloasis },
  { data: boomsday },
  { data: killthelord },
  { data: recipeforyou },
  { data: liarsend },
  { data: lastkingdom },
  { data: darkhero },
  { data: goldencoinrush },
  { data: beautyfullshot },
  { data: juveniledays },
  { data: colorless },
  { data: evangelion },
  { data: jinxplayer },
  { data: oldtales },
  { data: icedragonsaga },
  { data: footstepwalkrun },
  { data: secondquest },
  { data: forrest },
  { data: newflavor },
  { data: foolburstday }
] as buttonInterface[]

const buttonListOther = [
  { data: albumCovers },
  { data: bonds },
  { data: bbqmaster },
  { data: voltroad },
  { data: dragondungeonrun }
] as buttonInterface[]

const buttonListCommunity = [
  { data: fourkoma_en },
  { data: fourkoma_jp },
  { data: fourkoma_kr },
  { data: fourkoma_zh },
] as buttonInterface[]

const checkMobile = () => {
  return market.globalParams.isMobile ? 'mobile' : ''
}

const checkMobileBool = () => {
  return market.globalParams.isMobile
}

const successFeedback = () => {
  market.message.getMessage().success(messagesEnum.MESSAGE_ASSET_LOADED)
}

const loadData = (dataToLoad: galleryInterface) => {
  carouselData.value = null
  index.value = 1
  carouselData.value = dataToLoad
  currentId.value = dataToLoad.id
  setTimeout(() => {
    document.querySelector('#scrollTo')?.scrollIntoView({ behavior: 'smooth' })
    successFeedback()
  }, 50)
}

const updateIndex = (newIndex: number) => {
  index.value = newIndex + 1
}

</script>

<style lang="less" scoped>

.n-card {
  width: 80%;
  margin: 0 auto;
  margin-top: 50px;

  .n-h1 {
    margin-top: 0px;
  }

  .n-carousel {
    margin: 0 auto;
    .n-h3 {
      margin-top: 10px;
      margin-bottom: 20px;
    }
  }
}

.mobile {
  width: 95%;
  text-align: left;
}
</style>