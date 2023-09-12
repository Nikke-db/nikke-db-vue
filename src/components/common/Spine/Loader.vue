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
let spineCanvas: any;
const market = useMarket()

onMounted(()=> {
    market.load.beginLoad()
    spineLoader()
    applyDefaultStyle2Canvas()
})

const spineLoader = () => {
    let usedSpine: any;

    switch (market.live2d.current_spine_version) {
        case 4.0: usedSpine = spine40; break;
        case 4.1: usedSpine = spine41; break;
        default: console.log('TBA ALERT MESSAGE')
    }

    spineCanvas = new usedSpine.SpinePlayer("player-container", {
        skelUrl: globalParams.NIKKE_DB + globalParams.PATH_L2D + market.live2d.current_id + "/" + market.live2d.current_id + "_00.skel",
        atlasUrl: globalParams.NIKKE_DB + globalParams.PATH_L2D + market.live2d.current_id + "/" + market.live2d.current_id + "_00.atlas",
        animation: "idle",
        // skin: skin,
        // backgroundColor: transparent ? "#00000000" : current_color,
        backgroundColor: "#2f353a",
        // alpha: transparent ? true : false,
        mipmaps:false,
        debug: false,
        preserveDrawingBuffer:true,
        viewport: {
            padLeft: "0%",
            padRight: "0%",
            padTop: "0%",
            padBottom: "0%"
        },
        success: (player: any) => {
            market.load.endLoad()
        },
        error: (player: any) => {
            market.load.errorLoad()
        }
    })
}

watch(() => market.globalParams.isMobile, (e) => {
    if (e) {
        canvas.style.height = "90vh"
        canvas.style.width = "100%"
        canvas.style.position = "static"
        canvas.style.left = "0px"
        canvas.style.top = "0px"
        canvas.style.marginTop = "0px"
        canvas.width = canvas.height 
        canvas.style.transform = "scale(1)"
        market.globalParams.hideMobileHeader()
    } else {
        canvas.style.position = "absolute"
        canvas.style.height = "500vh"
        canvas.style.width = ''
        canvas.style.marginTop = "-195vh"
        canvas.style.transform = "scale(0.2)"
        canvas.style.left = "0px"
        canvas.style.top = "0px"
        canvas.width = canvas.height 
        market.globalParams.showMobileHeader()
        centerForPC()
    }
})

watch(() => market.live2d.current_id, (e) => {
    spineCanvas.dispose()
    market.load.beginLoad()
    spineLoader()
    applyDefaultStyle2Canvas()
})

const applyDefaultStyle2Canvas = () => {
    setTimeout(() => {
        canvas = (document.querySelector(".spine-player-canvas") as any)

        canvas.width = canvas.height    
        
        if (checkMobile()) {
            // canvas.style.marginTop = "50px"
            canvas.style.height = "95vh"
            canvas.style.width = "100%"
            transformScale = 1
            market.globalParams.hideMobileHeader()
        } else {
            canvas.style.height = "500vh"
            canvas.style.marginTop = "-195vh"
            canvas.style.transform = "scale(0.17)"
            canvas.style.position = "absolute"
            canvas.style.left = "0px"
            canvas.style.top = "0px"
            transformScale = 0.2
            market.globalParams.showMobileHeader()
            centerForPC()
        }
    }, 200)
}

const checkMobile = () => {
    return market.globalParams.isMobile ? true : false
}

const centerForPC = () => {
    let canvas_width = canvas.offsetWidth
    let viewport_width = window.innerWidth
    canvas.style.left = ((viewport_width - canvas_width) / 2) + "px"
}

const filterDomEvents = (event:any) => {
    if (event.target === canvas || 
        event.target === document.querySelector('.spine-player')
    ) {
        return true
    } else {
        return false
    }
}

/**
 * click to drag the character around, 
 * will move the canvas through the dom based on coordinates of the cursor
 */

let oldX: number
let oldY: number
let move = false as boolean

document.addEventListener("mousedown", (e) => {
    if (filterDomEvents(e)) {
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

/**
 * zoom in or out for the live2d
 * it uses the property transform scale instead of buffing up or down viewport height of the canvas
 * using the vh in nikke db legacy produces some lag when zooming at high values ( 450 - 500 vh of size)
 * transform should hopefully fix this issue, but to fix blurring/pixelated images
 * the canvas is already bruteforced to 500vh and transform scale 0.2
 * since the zoom is smooth there is no reason to limit it like in nikke db legacy
 * however after scale(1) it'll start getting blurried than usual
 * though I don't see the point as it is already pixelated enough
 */

let transformScale = 0.2

document.addEventListener("wheel", (e) => {
    if (filterDomEvents(e)) {
        switch (e.deltaY > 0) {
            case true:
                    transformScale -= 0.05
                break;
            case false: 
                    transformScale += 0.05
                break;
        }
        
        canvas.style.transform = "scale("+transformScale+")"
    }
})

</script>

<style scoped lang="less">

#player-container {
    height: 100vh;
    overflow:hidden
}


</style>