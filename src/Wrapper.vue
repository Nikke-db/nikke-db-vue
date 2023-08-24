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

import * as override from '@/utils/style/naive-ui-theme-overrides.json';

const theme = ref(darkTheme)


</script>