<template>
    <n-table>
        <thead>
        <tr>
            <th>Name</th>
            <th>Contribution</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="data in props.data">
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
    color: black
}

.silver {
    background-color: silver;
    color: black
}
</style>
