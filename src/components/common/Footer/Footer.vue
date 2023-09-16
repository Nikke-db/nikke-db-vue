<template>
    <n-card :bordered="false">
        Nikke-DB | 
        2022 - {{ new Date().getFullYear()  }} | 
        By Koshirei | 
        <RouterLink to="/credits">
            <n-a>Credits</n-a>
        </RouterLink>
    </n-card>
</template>

<script setup lang="ts">

</script>

<style scoped lang="less">
@import '@/utils/style/global_variables.less';

.n-card {
    border-top: @grey-color 1px solid;
    margin-top: 100px;
    text-align: center;
}
</style>