<template>
    <n-card class="center" :class="checkMobile()">
        <n-p>I'd like to dedicate this page to anyone who contributed one way or another to the website during it's entire lifespan. I am mainly alone in this project but any help I receive brings me great joy.</n-p><br/>
        <div class="imgDiv">
            <img :src="maids"/>
        </div>
    </n-card>

    <n-card class="center" :class="checkMobile()">
        <n-h1>External Help</n-h1>
        <CreditTable :data="external"/>
    </n-card>

    <n-card class="center" :class="checkMobile()">
        <n-h1>GitHub Forks</n-h1>
        <n-h3>(both repos)</n-h3>
        <CreditTable :data="forks"/>
    </n-card>
</template>

<script setup lang="ts">
import maids from "@/assets/maids.png"
import { type help } from '@/utils/interfaces/contributor'
import CreditTable from '@/components/common/Credits/Table.vue'
import { useMarket } from '@/stores/market'

const market = useMarket()

const external : help[] = [
    {
        name: "Bingle",
        contribution: "NKAB v3 Decryptor to access encrypted files after the Septembre 1st patch.",
        tier: "gold"
    },
    {
        name: "神罰の執行者 ライラ",
        contribution: "Instructions on how to fix transparency issues for the live2d visualiser.",
        tier: "silver"
    },
    {
        name: "Panafonic",
        contribution: "Help on fixing display issues for Dolla and Centi skins live2d.",
        tier: null
    },
    {
        name: "Who <br/> Robu_Stories",
        contribution: "Manual data gathering for characters.",
        tier: null
    },
    {
        name: "Evilcat",
        contribution: "Tool Page idea, data about unit leveling cost, and data about outpost income calculations.",
        tier: null
    },
    {
        name: "Sakae",
        contribution: "Images and data gathering. Argued to develop the Live2D Visualiser.",
        tier: null
    },
    {
        name: "Falzar",
        contribution: "NKAB v1 and NKAB v2 decryptor, though sad things happend for NKAV v3 decryptor",
        tier: null
    }
]

const forks: help[] = [
    {
        name: "R3XxN1xX",
        contribution: "Live2D files for Einkk, Rapunzel, Helm, Isabel, Shifty, Modernia Anchor, Jackal, Viper, Agent D, Agent K.<br/>Added icons for a bunch of characters",
        tier: null
    },
    {
        name: "CauchyDOOM(水纹霖霖)",
        contribution: "CSS z-index fix on mobile l2d visualiser.",
        tier: null
    },
    {
        name: "pin03",
        contribution: "Jackal, Viper and Maiden Live2D Assets.",
        tier: null
    },
    {
        name: "pin02",
        contribution: "Anis uncensored Live2D assets.",
        tier: null
    }
]

const checkMobile = () => {
    return market.globalParams.isMobile ? 'mobile': ''
}

</script>

<style scoped lang="less">
.n-card {
    width: 80%;
    margin:0 auto;
    margin-top: 25px;

    &.center {
        text-align: center;
    }

    .imgDiv {
        width: 100%;
        img {
            width: 100%;
            max-height: 400px;
            object-fit: contain;

        }
    }
}

.mobile {
    width: 95%;
    text-align: left;
}
</style>
