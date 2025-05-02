<template>
  <div style="opacity: 25%;" :class="props.display">
    <div align=center>
      <img :src="getVisitorId" alt="visits">
    </div>
  </div>
</template>
<script lang="ts" setup>

import { computed } from 'vue'

const props = defineProps<{
  display: 'PC' | 'mobile'
}>()

const getVisitorId = computed(() => {
  if (window.location.hostname === 'localhost') return 'https://visit-counter.vercel.app/counter.png?page=https%3A%2F%2Fnikke-db-legacy.pages.dev&s=40&c=ffffff&bg=000000&no=9&ff=digii&tb=&ta='
  else return 'https://visit-counter.vercel.app/counter.png?page=https%3A%2F%2Fnikke-db.pages.dev&s=40&c=ffffff&bg=000000&no=9&ff=digii&tb=&ta='
})
</script>

<style scoped lang="less">
.hit-counter{
  color: white;
  margin-top: 0;
}

img {
  display: block;
  margin-left: auto;
  width:125px
}

.PC {
  margin: 12px 25px 0 0;
  width: fit-content;
}
.mobile {
  margin-top: -8px;
  width: fit-content;
}

</style>