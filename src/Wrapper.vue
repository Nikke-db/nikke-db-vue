<!-- wrapper for naive or other first things before loading app.vue -->

<template>
    <n-config-provider :theme="theme" :theme-overrides="override">
    <!-- <n-config-provider> -->
        <n-loading-bar-provider>
            <App/>
        </n-loading-bar-provider>
    </n-config-provider>
</template>

<script setup lang="ts">
import App from '@/App.vue'
import { darkTheme } from 'naive-ui'
import { ref} from 'vue'
import { onBeforeMount } from 'vue';
import { useGlobalParamsStore } from '@/stores/globalParamsStore'
import * as override from '@/utils/style/naive-ui-theme-overrides.json';

const theme = ref(darkTheme)
const globalParamStore = useGlobalParamsStore()

onBeforeMount(() => {
    checkIfMobileUI()
})

window.addEventListener("resize", (e) => {
    checkIfMobileUI()
})

const checkIfMobileUI = () => {
    if (document.body.clientWidth < 900) { // DOM's width, if too low switch to mobile display globally
        globalParamStore.setMobile()
    } else {
        globalParamStore.setComputer()
    }
}


</script>