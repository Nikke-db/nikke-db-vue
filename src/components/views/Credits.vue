<template>
  <n-card class="center first" :class="checkMobile()">
    <n-p :class="checkMobile()"
      >I'd like to dedicate this page to anyone who contributed one way or
      another to the website during it's entire lifespan. I am mainly alone in
      this project but any help I receive brings me great joy.</n-p
    ><br />
    <div class="imgDiv">
      <img :src="maids" />
    </div>
  </n-card>

  <CreditTemplate title="External Help" :data="external" />

  <CreditTemplate title="GitHub Forks" subTitle="(both repos)" :data="forks" />

  <CreditTemplate title="Other" :data="others" />

  <n-back-top :visibility-height="0" style="display: none" />
</template>

<script setup lang="ts">
import maids from '@/assets/maids.png'
import { type help } from '@/utils/interfaces/contributor'
import CreditTemplate from '@/components/common/Credits/Template.vue'
import { useMarket } from '@/stores/market'
import { onMounted, onBeforeMount } from 'vue'

onBeforeMount(() => {
  market.load.beginLoad()
})

onMounted(() => {
  setTimeout(() => {
    market.load.endLoad()
    ;(document.querySelector('.n-back-top') as HTMLElement).click()
  }, 10)
})
const market = useMarket()

const external: help[] = [
  {
    name: 'Bingle',
    contribution:
      'NKAB v3 Decryptor to access encrypted files after the Septembre 1st patch.',
    tier: 'gold'
  },
  {
    name: '神罰の執行者 ライラ',
    contribution:
      'Instructions on how to fix transparency issues for the live2d visualiser.',
    tier: 'silver'
  },
  {
    name: 'Panafonic',
    contribution:
      'Help on fixing display issues for Dolla and Centi skins live2d.',
    tier: null
  },
  {
    name: 'Who <br/> Robu_Stories',
    contribution: 'Manual data gathering for characters.',
    tier: null
  },
  {
    name: 'Evilcat',
    contribution:
      'Tool Page idea, data about unit leveling cost, and data about outpost income calculations.',
    tier: null
  },
  {
    name: 'Sakae',
    contribution:
      'Images and data gathering. Argued to develop the Live2D Visualiser.',
    tier: null
  },
  {
    name: 'Falzar',
    contribution:
      'NKAB v1 and NKAB v2 decryptor, though sad things happened for NKAV v3 decryptor',
    tier: null
  }
]

// forkers: feel free to add yourself here, if you don't I'll do it myself
const forks: help[] = [
  {
    name: 'R3XxN1xX',
    contribution:
      'Live2D files for Einkk, Rapunzel, Helm, Isabel, Shifty, Modernia Anchor, Jackal, Viper, Agent D, Agent K.<br/>Added icons for a bunch of characters',
    tier: null
  },
  {
    name: 'CauchyDOOM(水纹霖霖)',
    contribution: 'CSS z-index fix on mobile l2d visualiser.',
    tier: null
  },
  {
    name: 'pin03',
    contribution: 'Jackal, Viper and Maiden Live2D Assets.',
    tier: null
  },
  {
    name: 'pin02',
    contribution: 'Anis uncensored Live2D assets.',
    tier: null
  }
]

const others: help[] = [
  {
    name: 'ShiftUp<br/>Level Infinite<br/>Tencent',
    contribution:
      'Owners of Nikke: Goddess of Victory, and all the assets associated shown in this website',
    tier: null
  },
  {
    name: '@totakeke__',
    contribution:
      'Artist of the chibi Soda and Cocoa just above (4koma from valentine event)',
    tier: null
  },
  {
    name: 'Vue',
    contribution:
      'Javascript framework that was used to develop this new version of Nikke-DB',
    tier: null
  },
  {
    name: 'Naive-UI',
    contribution: 'Vue 3 component library',
    tier: null
  },
  {
    name: 'Everyone who starred or forked either repository',
    contribution: 'My online ego keeps going up. Thank you',
    tier: null
  },
  {
    name: 'Spine by Esoteric Softwares',
    contribution: 'For the free and easy to use web runtimes',
    tier: null
  }
]

const checkMobile = () => {
  return market.globalParams.isMobile ? 'mobile' : ''
}
</script>

<style scoped lang="less">
.n-card {
  width: 80%;
  margin: 0 auto;
  margin-top: 50px;

  &.center {
    text-align: center;
  }

  &.center:not(:first-of-type) {
    margin-top: 75px;
  }

  &.first {
    .n-card__content:first {
      background-color: red !important;
      // padding: 0px !important
      padding-top: 0px !important;
    }
  }

  .imgDiv {
    width: 100%;
    img {
      width: 100%;
      max-height: 400px;
      object-fit: contain;
    }
  }
}

.mobile {
  width: 95%;
  text-align: left;
}

.n-p.mobile {
  text-align: justify;
}
</style>
