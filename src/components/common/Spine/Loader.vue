<template>
    <div id="player-container">
        
    </div>
</template>

<script setup lang="ts">
import {ref, onMounted, watch } from 'vue'
import { useMarket } from '@/stores/market'

// @ts-ignore
import spine40 from "@/utils/spine/spine-player4.0"
// @ts-ignore
import spine41 from "@/utils/spine/spine-player4.1"

import { globalParams } from "@/utils/enum/globalParams"

let canvas: any;
const market = useMarket()
const DEFAULT_PC_Y = "18%";
const id = ref("c010")

onMounted(()=> {
    market.load.beginLoad()
    new (spine40 as any).SpinePlayer("player-container", {
        skelUrl: globalParams.NIKKE_DB + globalParams.PATH_L2D + id.value + "/" + id.value + "_00.skel",
        atlasUrl: globalParams.NIKKE_DB + globalParams.PATH_L2D + id.value + "/" + id.value + "_00.atlas",
        animation: "idle",
        // skin: skin,
        // backgroundColor: transparent ? "#00000000" : current_color,
        backgroundColor: "#00FF00",
        // alpha: transparent ? true : false,
        mipmaps:false,
        debug: false,
        preserveDrawingBuffer:true,
        success: (player: any) => {
            market.load.endLoad()
        },
        error: (player: any) => {
            market.load.errorLoad()
        }
    })

    setTimeout(() => {
        canvas = (document.querySelector(".spine-player-canvas") as any)
        // I hate this so much
        canvas.style.marginTop = "50px"
        canvas.width = canvas.height
        
        
        // this centers the character and fit them on screen
        canvas.style.height = "95vh"

        // do NOT use this for computer or it'll mess up the screenshot (and video recording) features
        if (checkMobile()) {
            canvas.style.width = "100%"
        } else {
            canvas.style.position = "absolute"
            // canvas.style.left = DEFAULT_PC_Y
            canvas.style.top = "0px"
            centerForPC()
        }

    }, 200)
})

watch(() => market.globalParams.isMobile, (e) => {
    if (e) {
        canvas.style.width = "100%"
        canvas.style.position = "static"
        canvas.style.left = "0px"
        canvas.style.top = "0px"
    } else {
        canvas.style.position = "absolute"
        canvas.style.left = DEFAULT_PC_Y
        canvas.style.top = "0px"
        canvas.style.width = canvas.style.height
    }
})

const checkMobile = () => {
    return market.globalParams.isMobile ? true : false
}

const centerForPC = () => {
    let canvas_width = canvas.offsetWidth
    let viewport_width = window.innerWidth
    canvas.style.left = ((viewport_width - canvas_width) / 2) + "px"
}


/**
 * click to drag the character around, 
 * will move the canvas through the dom based on coordinates
 */

let oldX: number
let oldY: number
let move = false as boolean

document.addEventListener("mousedown", (e) => {
    if (e.target === canvas ||
        e.target === document.querySelector('.spine-player')) {
        oldX = e.clientX
        oldY = e.clientY
        move = true
    }
})

document.addEventListener("mouseup", (e) => {
    oldX = 0
    oldY = 0
    move = false
})

document.addEventListener("mousemove", (e) => {
    if (move) {
        let newX = e.clientX
        let newY = e.clientY

        let stylel = parseInt(canvas.style.left.replaceAll("px", ""))
        let stylet = parseInt(canvas.style.top.replaceAll("px", ""))

        if (newX !== oldX) { canvas.style.left = (stylel + (newX - oldX)) + "px" }

        if (newY !== oldY) { canvas.style.top  = (stylet + (newY - oldY)) + "px"}

        oldX = newX
        oldY = newY
    }
})

</script>

<style scoped lang="less">

#player-container {
    height: 100vh;
    overflow:hidden
}


</style>