<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Header from '@/components/common/Header/HeaderSelector.vue'
</script>

<template>
  <Header />
  <!-- if increase/decrease margin top of scroll bar, need to update the calc of max height -->
  <n-scrollbar style="max-height: calc(100vh - 120px); margin-top: 20px;"> 
    <RouterView />
  </n-scrollbar>
</template>

<style lang="less">
@import './utils/style/global_variables.less';

*{
  font-family: Arial, Helvetica, sans-serif;
}
.main-bg {
  background-color: @main-dark-theme;
}

.main-box-shadow {
  box-shadow: 0px 10px 5px 5px @main-dark-theme;
}

.alt-bg {
  background-color: @alt-dark-theme;
}

.redirect {
  color: @grey-color;
  text-decoration: none;
  font-size: 20px;
  transition: 0.5s;

  &:hover {
    color:white;
    font-style: italic;
    
  }
}

.poli-bg {
  background-image: url(./assets/index_bg.jpg);
  background-size: cover;
  background-repeat: no-repeat;
  background-attachment: fixed;
  background-position: center;
}

body {
  background-color: @alt-dark-theme;
}

.n-a {
  font-size: 16px;
  text-decoration: underline;
}
</style>
