<template>
  <n-table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Contribution</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="data in props.data" :key="data.name">
        <td :class="data.tier" v-html="data.name"></td>
        <td :class="data.tier" v-html="data.contribution"></td>
      </tr>
    </tbody>
  </n-table>
</template>

<script setup lang="ts">
import { type help } from '@/utils/interfaces/contributor'

const props = defineProps({
  data: {
    type: Object as () => help[],
    required: true
  }
})
</script>

<style scoped lang="less">
.gold {
  background-color: rgb(224, 203, 81);
  color: black;
}

.silver {
  background-color: silver;
  color: black;
}

.amethyst {
  background-color: #8F26AC
}

.pink {
  background-color: #FC0083;
  color: black;
}

.SELEKCJONER {
  background: #260b56;
}

.skyblue {
  background: #87ceeb;
  color: black;
}

.skyblue2 {
  background: #52f8f2;
  color: black;
}
</style>
