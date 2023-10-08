<!-- eslint-disable vue/no-parsing-error -->
<!-- svg are copypasted from naive ui raw code, could be changed in the future -->
<template>
  <div class="arrows">
    <div class="n-carousel__arrow" role="button" @click="prev">
      <svg xmlns="http:/www.w3.org/2000/svg" viewBox="0 0 16 16">
        <g fill="none">
          <path  h d="M10.26 3.2a.75.75 0 0 1 .04 1.06L6.773 8l3.527 3.74a.75.75 0 1 1-1.1 1.02l-4-4.25a.75.75 0 0 1 0-1.02l4-4.25a.75.75 0 0 1 1.06-.04z" fill="currentColor"></path>
        </g>
      </svg>
    </div>
    <div>
      {{ index }} / {{ total }}
    </div>
    <div class="n-carousel__arrow" role="button" @click="next">
      <svg xmlns="http:/www.w3.org/2000/svg" viewBox="0 0 16 16">
        <g fill="none">
          <path  h d="M5.74 3.2a.75.75 0 0 0-.04 1.06L9.227 8L5.7 11.74a.75.75 0 1 0 1.1 1.02l4-4.25a.75.75 0 0 0 0-1.02l-4-4.25a.75.75 0 0 0-1.06-.04z" fill="currentColor"></path>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">

defineProps<{
  index: number,
  total: number,
  prev: any,
  next: any
}>()
</script>

<style lang="less" scoped>
.arrows {
  display: flex;
  justify-content: end;

  div {
    margin-left: 15px;
  }
}

</style>