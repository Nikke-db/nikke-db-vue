<!-- wrapper for naive or other first things before loading app.vue -->

<template>
    <n-config-provider :theme="theme" :theme-overrides="override">
        <n-message-provider>
                <n-loading-bar-provider>
                    <App/>
                </n-loading-bar-provider>
            </n-message-provider>
        </n-config-provider>
</template>

<script setup lang="ts">
import App from '@/App.vue'
import { darkTheme } from 'naive-ui'
import { ref } from 'vue'
import { onBeforeMount } from 'vue';
import * as override from '@/utils/style/naive-ui-theme-overrides.json';
import { useMarket } from '@/stores/market'

const theme = ref(darkTheme)
const market = useMarket()

onBeforeMount(() => {
    checkIfMobileUI()
})

window.addEventListener("resize", (e) => {
    checkIfMobileUI()
})

const checkIfMobileUI = () => {
    if (document.body.clientWidth < 900) { // DOM's width, if too low switch to mobile display globally
        market.globalParams.setMobile()
    } else {
        market.globalParams.setComputer()
    }
}
</script>