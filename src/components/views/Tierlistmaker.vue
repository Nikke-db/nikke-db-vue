<template>
  <n-card>
    <n-h1>Tier List Maker v0.1</n-h1>
    <div id="tierlistControls">
      <div id="tierlistControlsLeft">
        <GridOptions v-model="tierList"/>
      </div>
      <div id="tierlistControlsRight">
        <n-button @click="exportAsPng()" type="warning" primary round>export as png</n-button> <n-space/>
        <n-button @click="exportAsPng(false)" type="warning" primary round>export as png ( without bench tier )</n-button> <br/><br/>
        <n-button @click="exportAsText()" type="info" primary round>Export as txt</n-button> <n-space/>
        <ImportFromText @loadTierListFromStorage="loadTierListFromStorage()"/>
      </div>
    </div>

    <div id="screenshot" v-if="tierList">
    <div id="screenshotWithoutBench" v-if="tierList">

      <div id="titlediv">
        <div id="titleimg">
          <img :src="logo" alt="nikke-db icon" class="logo" v-show="tierList.print_NikkeDB"/>
        </div>
        <div id="titletxt">
          <n-h1> {{ tierList.name }} </n-h1>
          <n-text>By {{ tierList.author }}</n-text>
        </div>
      </div>

      <div class="tierRow" v-for="(tier, index) in tierList.tiers" :key="tier.name" :class="index % 2 === 0 ? 'rowbgtype1' : ''">
        <div class="tierTitle" :style="{backgroundColor: tier.color_bg}">
          <div class="tierTitleInner">
            <h2 :style="{color: tier.color_name, fontWeight: 'bold'}">{{ tier.name }}</h2>
          </div>
        </div>
        <draggable v-model="tier.items"
                   :item-key="tier.name"
                   :enabled="true"
                   @start="drag=true"
                   @end="drag=false"
                   tag="div"
                   :component-data="{style:'display:\'flex\''}"
                   class="tieritems"
                   group="nikke"
        >
          <template #item="{element, index}">
            <div class="cardBorder" :class="index % 2 === 0 ? 'bgtype1' : 'bgtype2'">
              <CharacterCard :nikke="element"/>
            </div>
          </template>
        </draggable>
      </div>

    </div>
      <div class="tierRow">
        <div class="tierTitle" :style="{backgroundColor: tierList.benchTier.color_bg}">
          <div class="tierTitleInner">
            <p :style="{color: tierList.benchTier.color_name, fontWeight: 'bold'}">{{ tierList.benchTier.name }}</p>
          </div>
        </div>
        <draggable v-model="tierList.benchTier.items"
                   item-key="bench"
                   :enabled="true"
                   @start="drag=true"
                   @end="drag=false"
                   tag="div"
                   :component-data="{style:'display:\'flex\''}"
                   class="tieritems"
                   group="nikke"
        >
          <template #item="{element, index}">
            <div class="cardBorder" :class="index % 2 === 0 ? 'bgtype1' : 'bgtype2'">
              <CharacterCard :nikke="element"/>
            </div>
          </template>
        </draggable>
      </div>

    </div>
  </n-card>
</template>

<script lang="ts" setup>
import draggable from 'vuedraggable'
import { ref, onMounted, watch } from 'vue'
import type { Ref } from 'vue'
import { retrieveTierListFromLocalStorage, saveTierListToLocalStorage, initDefaultTierList } from '@/utils/tierlistUtils'
import CharacterCard from '@/components/common/Tierlistmaker/CharacterCard.vue'
import html2canvas from 'html2canvas'
import logo from '@/assets/nikke-db.png'
import GridOptions from '@/components/common/Tierlistmaker/GridOptions.vue'
import type { tierlist } from '@/utils/interfaces/tierlist/tierlist'
import { messagesEnum } from '@/utils/enum/globalParams'
import { useMarket } from '@/stores/market'
import ImportFromText from '@/components/common/Tierlistmaker/ImportFromText.vue'

const tierList = ref(initDefaultTierList()) as Ref<tierlist>
const tierListSlot = ref(0)
const drag = ref(false)
const market = useMarket()
const haveBeenInit = ref(false)

onMounted(() => {
  tierList.value = retrieveTierListFromLocalStorage()
})

const exportAsPng = (shouldScreenshotBench: boolean = true) => {
  market.message.getMessage().success(messagesEnum.MESSAGE_TIERLIST_SCREENSHOT_CONVERT2CANVAS)
  const idToScreenshot = shouldScreenshotBench ? '#screenshot' : '#screenshotWithoutBench'
  html2canvas(document.querySelector(idToScreenshot) as HTMLElement, {
    allowTaint: true,
    useCORS: true,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.offsetWidth,
    windowHeight: document.documentElement.offsetHeight,
    backgroundColor: '#000000'
  }).then((canvas) => {
    market.message.getMessage().success(messagesEnum.MESSAGE_TIERLIST_SCREENSHOT_CANVAS2PNG)
    const dataURL = canvas.toDataURL()

    const link = document.createElement('a')

    link.download =
        tierList.value.name + ' By ' + tierList.value.author + ' - Nikke-DB (' + new Date().getTime().toString().slice(-3) + ').png'

    link.href = dataURL

    link.click()
  })
}

const exportAsText = () => {
  const link = document.createElement('a')
  link.download =
      tierList.value.name + ' By ' + tierList.value.author + ' - Nikke-DB (' + new Date().getTime().toString().slice(-3) + ').txt'
  link.href = 'data:text/plain;charset=utf-8,' + localStorage.getItem('tierlist_slot0') // to update with slot changes
  link.click()
}

const loadTierListFromStorage = () => {
  tierList.value = retrieveTierListFromLocalStorage()
}

watch(() => tierList.value, () => {
  if (haveBeenInit.value) {
    saveTierListToLocalStorage(tierList.value, tierListSlot.value)
    market.message.getMessage().success(messagesEnum.MESSAGE_LOCALSTORAGE_SAVED, market.message.short_message)
  } else {
    haveBeenInit.value = true
  }
},
{ deep: true })

</script>

<style scoped lang="less">
@import '@/utils/style/global_variables.less';

.n-card{
  width: 90%;
  margin: 0 auto;
  margin-top: 50px;
}

#titlediv{
  display: flex;
  justify-content: center;
  flex-direction: row;

  #titleimg{
    flex:0 0 100px;
    .logo{
      margin-left: 10px;
      width: 200px;
    }
  }

  #titletxt{
    flex:1;
    display: flex;
    justify-content: center;
    margin-right: 100px;
    margin-top: 15px;

    .n-text {
      margin-left: 15px;
      display: flex;
      justify-content: center;
      flex-direction: column;
    }
  }
}
.n-h1, .center {
  text-align: center;
}
.cardBorder{
  width: 128px;

  &.bgtype1 {
    background-color: @main-dark-theme;
  }
  &.bgtype2 {
    background-color: @alt-dark-theme;
  }
}
.tieritems{
  display:flex;
  flex-wrap: wrap;
  gap: 10px;
}
.tierRow {
  display: flex;
  border: 1px solid @naive-green;
  border-bottom: none;
  border-left: none;

  &.rowbgtype1 {
    background-color: #092b2080;
  }

  .tierTitle {
    flex: 0 0 128px;
    min-height: 128px;
    text-align: center;

    .tierTitleInner {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
  }
}

#screenshot, #screenshotWithoutBench {
  background-color: #18181C;
}

#tierlistControls {
  display: flex;

  #tierlistControlsLeft, #tierlistControlsRight {
    flex: 1
  }

  #tierlistControlsRight {
    text-align: right;
  }
}
</style>