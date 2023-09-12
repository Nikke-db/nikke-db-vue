<template>
    <div>
        <n-icon :size="50" :component="Cog" id="mobileCogL2d" @click="showCogModal()"/>

        <n-modal v-model:show="isCogModalVisible" id="cogModal">
            <n-card
            title="Options"
            :bordered="false"
            size="huge"
            role="dialog"
            >

            <template #header-extra>
                <n-icon :component="CloseOutlined" :size="40" @click="hideCogModal()"/>
            </template>

            <n-tabs type="line" animated size="large">

                <n-tab-pane name="Character" tab="Character" >
                    <CharacterList/>
                </n-tab-pane>

                <n-tab-pane name="options" tab="Options" >
                    <div class="l2d-options-tab">
                        <n-switch v-model:value="showHeaderBool" class="center-switch"> 
                            <template #checked>
                                The header is currently visible
                            </template>

                            <template #unchecked>
                                The header is currently hidden
                            </template>
                        </n-switch>
                    </div>
                </n-tab-pane> 
                
                <n-tab-pane name="tools" tab="tools" >
                    add screenshot, background color or any simple tool that'd work on mobile
                </n-tab-pane>                

            </n-tabs>

            <template #footer>
                <!-- footer content -->
            </template>
            </n-card>
        </n-modal>
    </div>
</template>

<script setup lang="ts">
import { Cog } from '@vicons/fa'
import { CloseOutlined } from '@vicons/antd'
import { ref, watch } from 'vue'
import CharacterList from "./CharacterList.vue"
import { useMarket } from '@/stores/market'

const market = useMarket()

const isCogModalVisible = ref(false)
const showHeaderBool = ref(false)

const showCogModal = () => {
    isCogModalVisible.value = true
}

const hideCogModal = () => {
    isCogModalVisible.value = false
}

watch(showHeaderBool, () => {
    switch (showHeaderBool.value) {
        case true: market.globalParams.showMobileHeader(); break;
        case false: market.globalParams.hideMobileHeader(); break;
    }
})
</script>

<style lang="less">

#mobileCogL2d {
    position: absolute;
    top:130px;
    left: 10px;
}

#cogModal {
    width: 95%;
    height: 80vh
}

.n-tab-pane {
    height: calc(80vh - 200px);
    overflow: auto;

    .l2d-options-tab {
        width:100%;
        text-align: center;
    }

}

.n-tabs {
    height: 100%;
}
</style>