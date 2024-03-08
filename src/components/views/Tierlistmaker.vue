<template>
  <n-card id="screenshot">
    <n-h1>Tier List Maker v0.01</n-h1>

    <div class="tierRow" v-for="tier in tierList.tiers" :key="tier.name">
      <div class="tierTitle" :style="{backgroundColor: tier.color_bg}">
        <n-h2 :style="{color: tier.color_name, fontWeight: 'bold'}">{{ tier.name }}</n-h2>
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
        <template #item="{element}">
          <div class="tempborder">
            <CharacterCard :id="element.id" :name="element.name" :subtext="element.subtext"/>
          </div>
        </template>
      </draggable>
    </div>

    <div class="tierRow">
      <div class="tierTitle" :style="{backgroundColor: tierList.benchTier.color_bg}">
        <n-h2 :style="{color: tierList.benchTier.color_name, fontWeight: 'bold'}">{{ tierList.benchTier.name }}</n-h2>
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
        <template #item="{element}">
          <div class="tempborder">
            <CharacterCard :id="element.id" :name="element.name" :subtext="element.subtext"/>
          </div>
        </template>
      </draggable>
    </div>

    <n-button @click="exportAsPng()">export as png</n-button>
  </n-card>
</template>

<script lang="ts" setup>
import draggable from 'vuedraggable'
import { ref, onMounted } from 'vue'
import { initDefaultTierList } from '@/utils/interfaces/tierlist/tierlistUtils'
import CharacterCard from '@/components/common/Tierlistmaker/CharacterCard.vue'
import html2canvas from 'html2canvas'

const test = ref([] as {name: string, subname: string, subclass: string}[])
const test2 = ref([] as {name: string, subname: string, subclass: string}[])

// const tierListToRef = ini
const tierList = ref(initDefaultTierList())

const drag = ref(false)

onMounted(() => {
  for (let i = 0; i < 25; i++) {
    test.value.push({
      name: 'test ' + i,
      subname: 'test subname ' + i,
      subclass: subclass(i)
    })
    test2.value.push({
      name: 'test ' + i,
      subname: 'test subname ' + i,
      subclass: subclass(25 - i)
    })
  }
})

const subclass = (i: number): string => {
  if (i !== undefined) {
    switch (i) {
      case 0: return 'sub-zero'
      case 1: return 'sub-one'
      case 2: return 'sub-two'
      default: return subclass(i - 3)
    }
  } else return ''
}

const exportAsPng = () => {
  html2canvas(document.querySelector('#screenshot') as HTMLElement, {
    allowTaint: true,
    useCORS: true,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.offsetWidth,
    windowHeight: document.documentElement.offsetHeight,
    backgroundColor: '#000000'
  }).then((canvas) => {
    const dataURL = canvas.toDataURL()

    const link = document.createElement('a')

    link.download = 'sample_' + new Date().getTime() + '.png'

    link.href = dataURL

    link.click()
    document.body.appendChild(canvas)
  })
}

</script>

<style scoped lang="less">
.n-card{
  width: 90%;
  margin: 0 auto;
  margin-top: 50px;
}

.n-h1 {
  text-align: center;
}
.tempborder{
  border: 2px solid white;
  width: 128px;
}
.tieritems{
  display:flex;
  flex-wrap: wrap;
}
.sub-zero {
  background-color: red;
  color:black;
}
.sub-one {
  background-color: blue;
}
.sub-two {
  background-color: yellow;
  color:black;
}
.tierRow {
  display: flex;
  //flex-basis: auto;

  .tierTitle {
    flex: 0 0 128px;
    min-height: 96px;
    text-align: center;
    padding-top: 56px;
  }
}
</style>