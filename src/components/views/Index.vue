<template>
    <div class="body">
        <n-card title="Nikke: Database of Victory" size="medium" :class="checkMobile()">
            <n-p>Last Update: August 25th 2023</n-p>
            <RouterLink to="/notice"><n-a>Check out the new notice where I talk about the recent google form.</n-a></RouterLink>
            <n-p>
                Nikke Community decided to shut down the server I used for feedback and update log, so I guess the only way to reach me out is through private discord messages (Koshirei#0333 / koshirei).
            </n-p>
        </n-card>

        <n-card title="Update log:" class="card-spacer" :class="checkMobile()">
            <n-p>
                A listing of the updates ( copy paste from legacy website )
            </n-p>
        </n-card>
        <n-back-top :visibility-height="0" style="display:none"/>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeMount, onUnmounted } from 'vue'
import { useMarket } from '@/stores/market'
import bgi from '@/assets/index_bg.jpg'

const market = useMarket()

onBeforeMount(() => {
    market.load.beginLoad()
    document.body.classList.add("poli-bg")
})

onMounted(() => {
    setTimeout(()=>{
        market.load.endLoad();
        (document.querySelector('.n-back-top') as HTMLElement).click()
    }, 10)
    document.body.style.backgroundImage = "url(" + bgi + ")";
})

onUnmounted(() => {
    document.body.classList.remove("poli-bg")
    document.body.style.backgroundImage = 'none'
})

const checkMobile = () => {
    return market.globalParams.isMobile ? "isMobile" : ""
}

</script>

<style lang="less" scoped>
@import '../../utils/style/global_variables.less';

.body {
    padding-top: 45vh;
}

.n-card{
    background-color: @main-dark-theme-transparent;
    width: 50%;
    margin:0 auto;
}

.card-spacer {
    margin-top: 100px;
}

.isMobile {
    width:95%;
}

</style>