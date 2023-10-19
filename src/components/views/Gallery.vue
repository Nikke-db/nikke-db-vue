<template>
  <div class="galleryBody">
    <n-card :class="checkMobile()" title="Gallery">
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
      This place could display anything community made on discord/twitter/arca.live/anything. hit me up if you are interested in displaying something here!<br/><br/>
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
          <div
            v-else-if="carouselData.type === 'twitter'"
            >
              <Tweet :id="data.text.split('/status/')[1]" :options="{ dnt: 'true', theme: 'dark' }">
                <n-spin size="large" />
              </Tweet>
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
            style="max-width: 95%; height:100%; object-fit: cover;"
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
// @ts-ignore
import { Tweet } from '@jacksongross/vue-tweet-embed'

import albumCovers from '@/utils/json/Gallery/albums.json'
import chapterThumbnails from '@/utils/json/Gallery/chapters.json'
import whiteMemory from '@/utils/json/Gallery/whitememory.json'
import fourkoma_en from '@/utils/json/Gallery/4koma_en.json'
import fourkoma_jp from '@/utils/json/Gallery/4koma_jp.json'
import fourkoma_kr from '@/utils/json/Gallery/4koma_kr.json'

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
  { id: fourkoma_en.id, text: fourkoma_en.title },
  { id: fourkoma_jp.id, text: fourkoma_jp.title },
  { id: fourkoma_kr.id, text: fourkoma_kr.title }
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
    case fourkoma_en.id: carouselData.value = fourkoma_en; break
    case fourkoma_jp.id: carouselData.value = fourkoma_jp; break
    case fourkoma_kr.id: carouselData.value = fourkoma_kr; break
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

.tweet {
  user-select: none;
}
</style>