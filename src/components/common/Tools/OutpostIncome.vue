<template>
  <ToolsTemplate title="Outpost income calculator" :resultShow="resultShow">
    <template #form>
      <n-form
        :model="formDataOutpostIncome"
        :rules="rulesOutpostIncome"
        ref="formRefOutpostIncome">

        <n-form-item label="Outpost Level:" path="level" size="large">
          <n-input-number
            v-model:value="formDataOutpostIncome.level"
            :min="1"
            :max="400"
          />
        </n-form-item>

        <n-form-item label="Custom Time: " path="custom" size="large">
          <n-input-number
            v-model:value="formDataOutpostIncome.custom"
            :options="boostBdAndCore"
          >
          <template #suffix>
            Hours
          </template>
          </n-input-number>
        </n-form-item>

        <n-form-item label="Academy:" path="academy" size="large">
          <n-switch
            v-model:value="formDataOutpostIncome.academy"
            style="margin:0 auto"
          >
            <template #checked>
              Max Level Academy
            </template>
            <template #unchecked>
              Custom Academy
            </template>
          </n-switch>
        </n-form-item>

        <n-form-item label="Credit Boost (%)" path="acaCd" size="large" v-if="!formDataOutpostIncome.academy">
          <n-select
            v-model:value="formDataOutpostIncome.acaCd"
            :options="creditBoost"
          />
        </n-form-item>

        <n-form-item label="Battle Data Boost (%)" path="acaBd" size="large" v-if="!formDataOutpostIncome.academy">
          <n-select
            v-model:value="formDataOutpostIncome.acaBd"
            :options="boostBdAndCore"
          />
        </n-form-item>

        <n-form-item label="Core Dust Boost (%)" path="acaCore" size="large" v-if="!formDataOutpostIncome.academy">
          <n-select
            v-model:value="formDataOutpostIncome.acaCore"
            :options="boostBdAndCore"
          />
        </n-form-item>

        <div class="validate">
          <n-button
            :disabled="disabledValidate()"
            round
            type="primary"
            @click="(e: MouseEvent) => triggerResult(e)"
            >
            Calculate
          </n-button>
        </div>

      </n-form>
    </template>

    <template #result>

      <n-data-table
        :columns="resultColumns"
        :striped="true"
        :data="dataTableData"
      />

    </template>
  </ToolsTemplate>
</template>

<script setup lang="ts">
import type { DataTableColumn, FormInst, FormItemRule, FormRules, FormValidationError, SelectOption } from 'naive-ui'
import ToolsTemplate from './Template.vue'
import { ref } from 'vue'
import { useMarket } from '@/stores/market'
import { messagesEnum } from '@/utils/enum/globalParams'
import type { outpostBattleRecordInterface } from '@/utils/interfaces/outpostBattleRecords'
import * as outpostBattleTable from '@/utils/json/OutpostBattleTable.json'

const formRefOutpostIncome = ref<FormInst | null>(null)
const market = useMarket()

const resultShow = ref(false)

// acaCd = academy credits, ...
const formDataOutpostIncome = ref({
  level: null,
  acaCd: null as number | null,
  acaBd: null as number | null,
  acaCore: null as number | null,
  academy: true,
  custom: 24
})

const requiredRule = [{ required: true }]

const rulesOutpostIncome: FormRules = {
  level: [
    {
      required: true,
      min: 1,
      max: 400,
      // must do a validator or naive will say that our number is not a string ...
      validator: (rule: FormItemRule, value: number) => {
        if (value > rule.max!) {
          return false
        }
        return true
      }
    }
  ],
  acaCd: requiredRule,
  acaBd: requiredRule,
  acaCore: requiredRule,
  custom: requiredRule
}

const boostBdAndCore: SelectOption[] = [
  {
    label: '10',
    value: 10
  },
  {
    label: '25',
    value: 25
  },
  {
    label: '45',
    value: 45
  }
]

const creditBoost: SelectOption[] = []
for (let i = 1; i <= 6 ; i++) {
  creditBoost.push({
    label: '' + i * 10,
    value: i * 10
  })
}

const disabledValidate = () => {
  if (formDataOutpostIncome.value.level === null) {
    return true
  }
  if (formDataOutpostIncome.value.custom === null) {
    return true
  }
  if (formDataOutpostIncome.value.academy === false) {
    if (formDataOutpostIncome.value.acaBd === null ||
        formDataOutpostIncome.value.acaCd === null ||
        formDataOutpostIncome.value.acaCore === null) {
      return true
    }
  }
}

const resultColumns: DataTableColumn[] = [
  {
    title: 'Currency Name',
    key: 'currency'
  },
  {
    title: 'Per Minute',
    key: 'minute',
    render: (row: any) => {
      return Math.floor(row.minute).toLocaleString()
    }
  },
  {
    title: 'Per Hour',
    key: 'hour',
    render: (row: any) => {
      return Math.floor(row.hour).toLocaleString()
    }
  },
  {
    title: 'Custom Time',
    key: 'custom',
    render: (row: any) => {
      return Math.floor(row.custom).toLocaleString()
    }
  }
]

// used for automation, could be used elsewhere if needed
enum dataTableEnum {
  CREDIT='Credit',
  BATTLE='Battle Data',
  CORE='Core Dust'
}

const dataTableData = ref([
  {
    currency: dataTableEnum.CREDIT,
    minute: 0,
    hour: 0,
    custom: 0,
    ratio: 3
  },
  {
    currency: dataTableEnum.BATTLE,
    minute: 0,
    hour: 0,
    custom: 0,
    ratio: 3
  },
  {
    currency: dataTableEnum.CORE,
    minute: 0,
    hour: 0,
    custom: 0,
    ratio: 1
  },
])

const triggerResult = (e: MouseEvent) => {
  e.preventDefault()
  formRefOutpostIncome.value?.validate((errors: FormValidationError[] | undefined) => {
    if (errors) {
      market.message.getMessage().error(messagesEnum.MESSAGE_WRONG_FORM_DATA)
    } else {
      market.message.getMessage().success(messagesEnum.MESSAGE_PROCESSING, market.message.short_message)
      resultShow.value = true
      if (formDataOutpostIncome.value.academy === true) {
        formDataOutpostIncome.value.acaCd = 60
        formDataOutpostIncome.value.acaBd = 45
        formDataOutpostIncome.value.acaCore = 45
      }
      calculateRessources()
    }
  })
}

const calculateRessources = () => {
  const OutpostTable = outpostBattleTable.records as outpostBattleRecordInterface[]
  const record = OutpostTable.find((record) => record.id === formDataOutpostIncome.value.level)!

  dataTableData.value.forEach((data) => {
    let value: number
    let boost: number
    switch (data.currency) {
      case dataTableEnum.CREDIT:
        value = record.credit
        boost = formDataOutpostIncome.value.acaCd!
        break
      case dataTableEnum.BATTLE:
        value = record.character_exp1
        boost = formDataOutpostIncome.value.acaBd!
        break
      case dataTableEnum.CORE:
        value = record.character_exp2
        boost = formDataOutpostIncome.value.acaCore!
        break
      default:
        value = 999999
        boost = 999999
    }

    const BASE = value * data.ratio / 10000
    data.minute = BASE + BASE * boost / 100
    data.hour = 60 * data.minute
    data.custom = formDataOutpostIncome.value.custom * data.hour
  })
}
</script>

<style scoped lang="less">

</style>