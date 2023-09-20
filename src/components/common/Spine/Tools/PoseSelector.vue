<template>
  <n-radio-group
    name="radioGroupPoses"
    v-model:value="market.live2d.current_pose"
  >
    <span v-for="pose in poses" :key="pose.value">
      <n-radio :key="pose.value" :value="pose.value" :label="pose.label" />
      <br />
    </span>
  </n-radio-group>
</template>

<script setup lang="ts">
import { useMarket } from '@/stores/market'
import { NIcon } from 'naive-ui'
import { AimOutlined } from '@vicons/antd'
import { AccessibilityTwotone } from '@vicons/material'
import { h } from 'vue'
import ManageProtection from '@vicons/carbon/ManageProtection'

const market = useMarket()

const poses = [
  {
    value: 'aim',
    label: h('div', {}, [
      h(NIcon, {
        component: AimOutlined,
        size: 18,
        style: 'position:relative; top:3px'
      }),
      ' Aim'
    ])
  },
  {
    value: 'cover',
    label: h('div', {}, [
      h(NIcon, {
        component: ManageProtection,
        size: 18,
        style: 'position:relative; top:5px'
      }),
      ' Cover'
    ])
  },
  {
    value: 'fb',
    label: h('div', {}, [
      h(NIcon, {
        component: AccessibilityTwotone,
        size: 18,
        style: 'position:relative; top:3px'
      }),
      ' Full Body'
    ])
  }
]
</script>

<style scoped lang="less">
div {
  border-bottom: none !important;
}
</style>
