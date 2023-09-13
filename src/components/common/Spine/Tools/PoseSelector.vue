<template>
    <n-radio-group name="radioGroupPoses" v-model:value="market.live2d.current_pose">
        <span v-for="pose in poses">
            <n-radio
            :key="pose.value"
            :value="pose.value"
            :label="pose.label"
            /> <br/>
    </span>
    </n-radio-group>
</template>

<script setup lang="ts">
import { useMarket } from '@/stores/market'

const market = useMarket()

const poses = [
    {
        value: "aim",
        label: "Aim"
    },
    {
        value: "cover",
        label: "Cover"
    },
    {
        value: "fb",
        label: "Full Body"
    }
]

</script>

<style scoped lang="less">

</style>