<template>
    <div id="l2dsearchbox" :class="checkMobile()">
        <n-card size="small" :bordered="false">
            <n-input type="text" placeholder="Name" v-model:value='name_filter' :clearable="true"></n-input>
        </n-card>
        <n-scrollbar style="">
        <n-list hoverable :show-divider="false">
                <n-list-item 
                    v-for="character in market.live2d.filtered_l2d_Array" 
                    v-show="character.name.toLowerCase().includes(name_filter.toLowerCase())" 
                    :key="character.id"
                    @click="changeSpine(character)"
                    >

                    <template #prefix>
                        <img :src="getSiIcon(character.id)" class="si_img">
                    </template>

                    <n-h5>{{ character.name }}</n-h5>
                </n-list-item>
            </n-list>
        </n-scrollbar>
    </div>
</template>

<script setup lang="ts">

import { useMarket } from '@/stores/market'
import { onMounted, ref } from 'vue';
import { globalParams } from '@/utils/enum/globalParams';
import type { live2d_interface } from '@/utils/interfaces/live2d';

const market = useMarket()
const name_filter = ref('')

onMounted(() => {
    if (market.live2d.filtered_l2d_Array.length === 0) {
        market.live2d.filter()
    }
})

const getSiIcon = (id:string) => {
    return globalParams.NIKKE_DB + globalParams.PATH_SPRITE_1 + id + globalParams.PATH_SPRITE_2
}

const checkMobile = () => {
    return market.globalParams.isMobile ? 'mobile' : 'computer'
}

const changeSpine = (character: live2d_interface) => {
    market.live2d.change_current_spine(character)
}


</script>

<style scoped lang="less">
@import '@/utils/style/global_variables.less';
.computer {
    position: absolute;
    width: 200px;
    left: 20px;
    top:130px;
    height: calc(85vh - 120px);

    .n-list {
        min-height: calc(85vh - 120px);
        user-select: none;

        .n-list-item {
            padding: 5px 10px;
            border-top: #18181C 1px solid;
            border-bottom: #18181C 1px solid;

            .si_img {
                height: 50px
            }

            &:hover {
                cursor: pointer;
                border-top: @naive-green 1px solid;
                border-bottom:  @naive-green 1px solid;
            }
        }
    }
    
    .n-card {
        height: 60px;
        border-top: 1px solid @naive-green;
        border-right: 1px solid @naive-green
    }

    .n-card, .n-list {
        border-left: 1px solid @naive-green;
    }
}

.mobile {
    .n-list-item, .n-card {
        border-top: @naive-green 1px solid;

        .si_img {
            height: 50px
        }
    }


}

</style>