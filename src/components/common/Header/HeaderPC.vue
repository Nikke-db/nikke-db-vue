<template>
  <div class="flexbox main-bg main-box-shadow">
    <div class="githubwrapper">
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <n-icon :component="GithubFilled" class="github" @click="sendToGithub()" size="50"/>
        </template>
        View the source code on GitHub
      </n-tooltip>
    </div>
    <span>
      <RouterLink to="/">
        <img :src="logo" class="logo" />
      </RouterLink>
    </span>
    <span class="routes">
      <RouterLink
        v-for="route in props.routes"
        :to="{name: route.path}"
        class="redirect"
        :key="'route' + route.path"
      >
        {{ route.text }}
      </RouterLink>
    </span>
  </div>
</template>

<script setup lang="ts">
import logo from '@/assets/nikke-db.png'

import { GithubFilled } from '@vicons/antd'
import { globalParams } from '@/utils/enum/globalParams'

import { type route2DisplayInterface } from '@/components/common/Header/routes2Display'

const props = defineProps<{
  routes: route2DisplayInterface[]
}>()

const sendToGithub = () => {
  window.open(globalParams.GITHUB, '_blank')
}
</script>

<style lang="less" scoped>
.flexbox {
  height: 100px;
  display: flex;
  flex-direction: row;
  width: 100%;
  position: relative;
  // top:0;
  z-index: 10;

  span {
    width: 100%;
    flex: 1;

    &.routes {
      flex: 50 0 0;

      align-items: center;
      margin-top: 30px;

      text-align: right;
      .redirect {
        width: 100vw;
        margin-right: 25px;
      }
    }
  }

  .logo {
    margin: 0 50px 0 15px;
    height: 100px;
    user-select: none;
  }
}
.githubwrapper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-left: 25px;
  .github {
    color: white;
    height: 50%;
    cursor: pointer;
  }
}
</style>
