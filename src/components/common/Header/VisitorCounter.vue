<template>
  <div style="opacity: 25%;" :class="props.display">
    <a href='https://www.free-website-hit-counter.com' style="display: flex; flex-direction: column; justify-content: right">
      <img :src="`https://www.free-website-hit-counter.com/zc.php?d=9&id=${getVisitorId}&s=8`" border='0' alt='Free Website Hit Counter'>
      <small>
        <a href='https://www.free-website-hit-counter.com' class="hit-counter" title="Free Website Hit Counter" target="_blank">
          Free website hit counter
        </a>
      </small>
    </a>
  </div>
</template>

<script lang="ts" setup>

import { computed } from 'vue'

const props = defineProps<{
  display: 'PC' | 'mobile'
}>()

const getVisitorId = computed(() => {
  if (window.location.hostname === 'localhost') return 2875
  else return 2876
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