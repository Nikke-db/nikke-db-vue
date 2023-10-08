<template>
  <div class="galleryBody">
    <n-card :class="checkMobile()" title="Gallery">
      <n-p>This page will display pictures from the game. It will be gradually updated with new events, story, 4-KOMA, community content, etc. I'm okay with adding anything as long as I deem it worth it, e.g. it's pointless to ask me to add gear pictures.</n-p>
      <n-p>If a gallery shows Cocoa and Soda, or if there's a missing image, hit me up asap !</n-p>
      <n-p>Feedback and content recommendation is appreciated</n-p>

      <n-h1>Story</n-h1>
      <ButtonTemplate
        v-for="buttonItem in buttonListStory"
        :key="buttonItem.id"
        :target-id="buttonItem.id"
        :displayed-text="buttonItem.text"
        :carousel-data="carouselData" :current-id="currentId" @load-data="(id: string) => loadData(id)"
      />

      <n-h1>Events</n-h1>
      <ButtonTemplate
        v-for="buttonItem in buttonListEvents"
        :key="buttonItem.id"
        :target-id="buttonItem.id"
        :displayed-text="buttonItem.text"
        :carousel-data="carouselData" :current-id="currentId" @load-data="(id: string) => loadData(id)"
      />

      <n-h1>Other</n-h1>
      <ButtonTemplate
        v-for="buttonItem in buttonListOther"
        :key="buttonItem.id"
        :target-id="buttonItem.id"
        :displayed-text="buttonItem.text"
        :carousel-data="carouselData" :current-id="currentId" @load-data="(id: string) => loadData(id)"
      />

      <n-h1>Community Content</n-h1>
      empty atm but will display 4koma, twitter exclusive pictures, or anything community made on discord/twitter/arca.live/anything. hit me up if you are interested in displaying something here!<br/>
      <ButtonTemplate
        v-for="buttonItem in buttonListCommunity"
        :key="buttonItem.id"
        :target-id="buttonItem.id"
        :displayed-text="buttonItem.text"
        :carousel-data="carouselData" :current-id="currentId" @load-data="(id: string) => loadData(id)"
      />
    </n-card>

    <n-card :class="checkMobile()" id="scrollTo">
      <n-h1 prefix="bar" :type="carouselData === null ? 'error' : 'success'">
        {{ carouselData === null ? 'No data selected' : carouselData.title }}
      </n-h1>

      <!-- COMPUTER CAROUSEL -->
      <n-carousel v-if="carouselData !== null && !checkMobileBool()"
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
          <n-image
            :src="globalParams.GALLERY + carouselData.path + data.name +'.png'"
            :fallback-src="maids"
            style="height:20vw; max-height: 512px;"
          />
          <n-h3 prefix="bar" type="info">
            {{ data.text }}
          </n-h3>
        </n-carousel-item>
        <template #arrow="{ prev, next }">
          <ArrowTemplate :index="index" :total="carouselData.content.length - 1" :prev="prev" :next="next"/>
        </template>
      </n-carousel>

      <!-- MOBILE CAROUSEL -->
      <n-carousel v-if="carouselData !== null && checkMobileBool()"
      :slides-per-view="1"
      draggable
      :default-index="index - 1"
      :loop="true"
      :show-arrow="true"
      :show-dots="false"
      :space-between="15"
      @update:current-index="(e: number) => updateIndex(e)"
      style="width: 100%"
      >
        <n-carousel-item v-for="data in carouselData.content" :key="data.name">
          <div style="text-align:center; width:100%;">
            <img
            :src="globalParams.GALLERY + carouselData.path + data.name +'.png'"
            :fallback-src="maids"
            style="width:100%; object-fit: contain;"
            object-fit='contain'
            />
          </div>
          <n-h3 prefix="bar" type="info">
          {{ data.text }}
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

const market = useMarket()

const carouselData: Ref<galleryInterface | null> = ref(null)
const index = ref(1)
const currentId = ref('')

const buttonListStory = [
  { id: chapterThumbnails.id, text: chapterThumbnails.title },
]

const buttonListEvents = [
  { id: whiteMemory.id, text: whiteMemory.title }
]

const buttonListOther = [
  { id: albumCovers.id, text: albumCovers.title },
]

// remove any when there will be content in the array
const buttonListCommunity: any[] = [

]

const checkMobile = () => {
  return market.globalParams.isMobile ? 'mobile' : ''
}

const checkMobileBool = () => {
  return market.globalParams.isMobile
}

const successFeedback = () => {
  market.message.getMessage().success(messagesEnum.MESSAGE_ASSET_LOADED)
}

const loadData = (id: string) => {
  carouselData.value = null
  index.value = 1
  switch (id) {
    case albumCovers.id: carouselData.value = albumCovers; break
    case chapterThumbnails.id: carouselData.value = chapterThumbnails; break
    case whiteMemory.id: carouselData.value = whiteMemory; break
    default:
  }
  currentId.value = id
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