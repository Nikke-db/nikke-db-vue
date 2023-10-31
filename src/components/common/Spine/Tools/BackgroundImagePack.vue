<template>
  <n-button ghost type="warning" round @click="openInNewTab()">
    Background<br/>
    Image Pack
  </n-button>
</template>

<script setup lang="ts">

const suspicious_str = 'aHR0cHM6Ly9tZWdhLm56L2ZvbGRlci9WNTVDM1Q2QyMwMk42V1VqaUVROGhRdjZQaFp1TWtn'
const openInNewTab = () => {
  window.open(window.atob(suspicious_str), '_blank')
}

</script>

<style scoped lang="less">
.n-button {
  width: 100%;
  height: 40px;
  margin-top: 10px;
}
</style>
