<template>
    <ToolsTemplate title="Synchro Level Cost Calculator" :resultShow="resultShow">

      <template #form>
        <div class="wrapper">
          <n-form
          :model="formData"
          :rules="rules"
          ref="formRef"
          >
            <n-form-item label="Current Syncro Level:" path="base" size="large">
              <n-input-number v-model:value="formData.base" placeholder="From 1 to 599" :min="1" :max="599"/>
            </n-form-item>
            
            <n-form-item label="Target Syncro Level:" path="target" size="large">
              <n-input-number v-model:value="formData.target" placeholder="From 2 to 600" :min="2" :max="600"/>
            </n-form-item>
            
            <div class="validate">
              <n-button
                :disabled="formData.base === null || formData.target === null || formData.base! > formData.target!"
                round
                type="primary"
                @click="(e: MouseEvent) => triggerResult(e)"
                >
                Calculate
              </n-button>
            </div>
          </n-form>
        </div>
      </template>

      <template #result>

        <n-h2 style="marginBottom: 0px">In order to be synchro level {{ displayedLevels.target }}, starting at level {{ displayedLevels.base }}, you will need:</n-h2>
        <n-p style="marginTop: 0px" :depth="3">Values under level 200 have been multiplied by 5 to calculate a full squad cost to level up</n-p>

        <n-list :show-divider="true" bordered>
          
          <n-list-item v-for="item in displayArray">

            <n-grid :cols="checkMobile() ? 3 : 2">
              <n-gi class="right">
                <n-image :src="item.img" width="96"/>
              </n-gi>
              <n-gi class="left" :span="checkMobile() ? 2 : 1">
                <n-statistic :label="item.label" :tabular-nums="true">
                  <n-number-animation
                    :ref="item.ref"
                    :from="item.old.value"
                    :to="item.calculated.value"
                    :active="true"
                    locale="fr-FR"
                    show-separator
                    :duration="1500"
                    @finish="updateOldValues()"
                  />
                </n-statistic>
              </n-gi>
            </n-grid>
          </n-list-item>
        </n-list>
      </template>
    </ToolsTemplate>
</template>

<script setup lang="ts">
import ToolsTemplate from './Template.vue'
import { ref } from "vue"
import { type NumberAnimationInst, type FormInst, type FormItemRule, type FormRules, type FormValidationError } from 'naive-ui'
import { useMarket } from '@/stores/market'
import { messagesEnum } from '@/utils/enum/globalParams'
import * as LevelingJson from '@/utils/json/CharacterLevelTable.json'
import type { levelingRecordInterface } from '@/utils/interfaces/levelingRecord'

const market = useMarket()

const formRef = ref<FormInst | null>(null)
const resultShow = ref(false)

const formData = ref({
  base: null,
  target:null
})

const displayedLevels = ref({base:0, target:0})

const rules: FormRules = {
  base: [
    {
      required: true,
      min: 1,
      max: 599,
      validator (rule: FormItemRule, value: number) {
        if (formData.value.target !== null) {
          if (value >= formData.value.target) {
            return new Error('Base level cannot be above or equal the Target level')
          }
        }
        return true
      },
      trigger: ['input', 'blur']
    }
  ],
  target: {
    required: true,
    min: 2,
    max: 600,
    validator (rule: FormItemRule, value: number) {
      if (formData.value.base !== null) {
        if (value <= formData.value.base) {
          return new Error('Base level cannot be above or equal the Target level')
        }
      }

      return true
    },
    trigger: ['input', 'blur']
  }
}

const triggerResult = (e: MouseEvent) => {
  e.preventDefault()
  formRef.value?.validate((errors: FormValidationError[] | undefined) => {
    if (errors) {
      market.message.getMessage().error(messagesEnum.MESSAGE_WRONG_FORM_DATA)
    } else {
      market.message.getMessage().success(messagesEnum.MESSAGE_PROCESSING, market.message.short_message)
      resultShow.value = true
      credit.value = 0
      bd.value = 0
      core.value = 0
      displayedLevels.value.base = formData.value.base!
      displayedLevels.value.target = formData.value.target!
      calculateRessources()
      animate()
    }
  })
}

// for number animations
const oldCredit = ref(0)
const oldBd = ref(0)
const oldCore = ref(0)

const credit = ref(0)
const bd = ref(0) //battle data shorthand
const core = ref(0)

const displayArray = [
{
    old: oldCredit,
    calculated: credit,
    label: "Credit",
    ref: "creditRef",
    img: "https://cdn.discordapp.com/attachments/891090590048075786/1040028793328373830/im_1002.png"
  },
  {
    old: oldBd,
    calculated: bd,
    label: "Battle Data",
    ref: "bdRef",
    img: "https://cdn.discordapp.com/attachments/891090590048075786/1040028792992833606/im_1005.png"
  },
  {
    old: oldCore,
    calculated: core,
    label: "Core",
    ref: "coreRef",
    img: "https://cdn.discordapp.com/attachments/891090590048075786/1040028704539168839/im_1006.png"
  },
]

const calculateRessources = () => {
  const LevelingTable = LevelingJson.records as levelingRecordInterface[]
  LevelingTable.forEach((record: levelingRecordInterface) => {
    if (record.level >= formData.value.base! && record.level < formData.value.target!) {
      if (record.level < 200) {
        credit.value += (record.gold * 5)
        bd.value += (record.character_exp * 5)
        core.value += (record.character_exp_2 *5)
      } else {
        credit.value += record.gold
        bd.value += record.character_exp
        core.value += record.character_exp_2
      }
    }
  })
}

const animate = () => {
  const creditRef = ref<NumberAnimationInst | null>(null)
  const bdRef = ref<NumberAnimationInst | null>(null)
  const coreRef = ref<NumberAnimationInst | null>(null)
  creditRef.value?.play()
  bdRef.value?.play()
  coreRef.value?.play()
}

const updateOldValues = () => {
  oldCredit.value = credit.value
  oldBd.value = bd.value
  oldCore.value = core.value
}

const checkMobile = () => {
  return market.globalParams.isMobile ? true : false
}
</script>

<style lang="less" scoped>

.wrapper {
  .n-form-item{
    margin: 0 auto;
    width: 250px
  }
  .validate {
    text-align: center;

    .n-button {
      width: 250px
    }
  }

}
.n-list-item {
  .right {
    text-align: right;
    margin-right: 10px;
  }

  .left {
    margin-left: 10px;
  }
}


</style>