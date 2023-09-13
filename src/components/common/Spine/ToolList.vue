<template>
    <div class="toolList">
        <n-card :bordered='false' size="small" class="toolCardTitle">
            <n-h3>Tools</n-h3>
        </n-card>
        <n-scrollbar style="height:calc(85vh - 120px)" >
            <n-card :bordered='false' size="small" class="toolCardContent">
                <PoseSelector />
            </n-card>
        </n-scrollbar>
    </div>
</template>

<script setup lang="ts">
import PoseSelector from './Tools/PoseSelector.vue'

</script>

<style scoped lang="less">
@import '@/utils/style/global_variables.less';

.toolList {
    position: absolute;
    top: 130px;
    right: 20px;
    width:150px;
    min-height: calc(85vh - 120px);

    .n-card {
        border-radius: 0px;
    }

    .toolCardTitle {
        height: 60px;
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        border: 1px solid @naive-green;
        border-bottom: none
    }

    .toolCardContent {
        user-select: none;
        min-height: calc(85vh - 120px);
        height:100%;
        border-right: 1px solid @naive-green;

        * {
            border-bottom: 1px solid @grey-color;
            padding-bottom: 10px;

            &:not(:nth-child(1)) {
                padding: 10px 0;
            }
        }
    }
}
</style>