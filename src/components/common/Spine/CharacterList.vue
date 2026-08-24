<template>
  <div id="l2dsearchbox" :class="checkMobile()" v-show="!market.live2d.hideUI">
    <n-card size="small" :bordered="false" >
      <div class="flexbox">
        <n-input
          type="text"
          placeholder="Name"
          v-model:value="name_filter"
          :clearable="true"
        ></n-input>
        <CharacterListFlags :lang="getLanguage()" @change-language="changeLanguage"/>
      </div>
    </n-card>
    <n-scrollbar>
      <n-list hoverable :show-divider="false" :key="language">
        <n-list-item
          v-for="character in market.live2d.filtered_l2d_Array"
          v-show="
            getCharacterName(character).toLowerCase().includes(name_filter.toLowerCase()) &&
            !character.name.toUpperCase().startsWith('HIDDEN')
          "
          :key="character.id"
          @click="changeSpine(character)"
        >
          <template #prefix>
            <img :src="getSiIcon(character.id)" class="si_img" loading="lazy" :onerror="`this.onerror=null; this.src='${fallbackSiIcon()}'`"/>
          </template>

          <n-h5>{{ getCharacterName(character) }}</n-h5>
        </n-list-item>
      </n-list>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { useMarket } from '@/stores/market'
import { onMounted, ref } from 'vue'
import { globalParams } from '@/utils/enum/globalParams'
import type { live2d_interface } from '@/utils/interfaces/live2d'
import CharacterListFlags from '@/components/common/Spine/CharacterListFlags.vue'

const market = useMarket()
const name_filter = ref('')
const language = ref<LANG>()

export type LANG = 'EN' | 'KR' | 'JP' | 'TW' | 'CN' | 'DE' | 'TH' | 'FR'

onMounted(() => {
  language.value = getLanguage()
  if (market.live2d.filtered_l2d_Array.length === 0) {
    market.live2d.filter(language.value)
  }
})

const getSiIcon = (id: string) => {
  return (
    globalParams.NIKKE_DB +
    globalParams.PATH_SPRITE_1 +
    id +
    globalParams.PATH_SPRITE_2
  )
}

const fallbackSiIcon = () => {
  return getSiIcon('c9999')
}

const checkMobile = () => {
  return market.globalParams.isMobile ? 'mobile' : 'computer'
}

const changeSpine = (character: live2d_interface) => {
  market.live2d.change_current_spine(character)
}

const getLanguage = (): LANG => {
  let lang = localStorage.getItem('l2d_language')

  if (lang === undefined || lang === null) {
    lang = 'EN'
    setLanguage(lang as LANG)
  }

  return lang as LANG
}

const setLanguage = (lang: LANG) => {
  localStorage.setItem('l2d_language', lang)
  language.value = lang
}

const changeLanguage = (newLang: LANG) => {
  setLanguage(newLang)
  market.live2d.filtered_l2d_Array = []
  market.live2d.filter(language.value)
}

// get the name in translation selected, or EN if undefined
const getCharacterName = (character: live2d_interface) => {
  switch (getLanguage()) {
    case 'KR': return (character.ko ?? character.name).trim()
    case 'JP': return (character.jp ?? character.name).trim()
    case 'TW': return (character.tw ?? character.name).trim()
    case 'CN': return (character.cn ?? character.name).trim()
    case 'DE': return (character.de ?? character.name).trim()
    case 'TH': return (character.th ?? character.name).trim()
    case 'FR': return (character.fr ?? character.name).trim()
    default: return character.name
  }
}

</script>

<style scoped lang="less">
@import '@/utils/style/global_variables.less';
.computer {
  position: absolute;
  width: 200px;
  left: 20px;
  top: 130px;
  height: calc(85vh - 120px);

  .n-list {
    min-height: calc(85vh - 120px);
    user-select: none;

    .n-list-item {
      padding: 5px 10px;
      border-top: #18181c 1px solid;
      border-bottom: #18181c 1px solid;

      .si_img {
        height: 50px;
        width: 50px;
        object-fit: contain;
      }

      &:hover {
        cursor: pointer;
        border-top: @naive-green 1px solid;
        border-bottom: @naive-green 1px solid;
      }
    }
  }

  .n-card {
    height: 60px;
    border-top: 1px solid @naive-green;
    border-right: 1px solid @naive-green;
    border-radius: 10px;
    border-bottom-left-radius: 0px;
    border-bottom-right-radius: 0px;
  }

  .n-card,
  .n-list {
    border-left: 1px solid @naive-green;
  }
}

.mobile {
  .n-list-item,
  .n-card {
    border-top: @naive-green 1px solid;

    .si_img {
      height: 50px;
    }
  }
}

.flexbox {
  display: flex;
  gap: 8px;
}
</style>
