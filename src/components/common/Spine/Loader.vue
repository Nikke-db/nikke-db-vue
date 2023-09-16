<template>
    <div id="player-container">
        
    </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useMarket } from '@/stores/market'

// @ts-ignore
import spine40 from "@/utils/spine/spine-player4.0"
// @ts-ignore
import spine41 from "@/utils/spine/spine-player4.1"

import { globalParams, messagesEnum } from "@/utils/enum/globalParams"

let canvas: any;
let spineCanvas: any;
const market = useMarket()

// http://esotericsoftware.com/spine-player#Viewports
const spineViewport = {
    padLeft: "0%",
    padRight: "0%",
    padTop: "0%",
    padBottom: "0%"
}

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
        skelUrl: getPathing('skel'),
        atlasUrl: getPathing('atlas'),
        animation: getDefaultAnimation(),
        // skin: skin,
        backgroundColor: "#00000000",
        alpha: true,
        mipmaps: market.live2d.current_pose === "fb" ? true : false,
        debug: false,
        preserveDrawingBuffer:true,
        viewport: spineViewport,
        success: (player: any) => {
            successfullyLoaded(player)
        },
        error: (player: any) => {
            wrongfullyLoaded(player)
        }
    })
}

const getPathing = (extension: string) => {
    let route = globalParams.NIKKE_DB + globalParams.PATH_L2D + market.live2d.current_id + '/'
    let fileSuffix = '_00.'
    
    // could be more automated if we set market.live2d.current_pose to '' if we select
    // "full body" but I'd rather keep fb for future/other functions
    switch (market.live2d.current_pose) {
        case 'aim': 
            route += globalParams.PATH_L2D_AIM + '/'; 
            fileSuffix = '_aim' + fileSuffix;
            break;
        case 'cover': 
            route += globalParams.PATH_L2D_COVER + '/'; 
            fileSuffix = '_cover' + fileSuffix
            break;
        default: break;
    }

    route += market.live2d.current_id + fileSuffix + extension
    
    return route
}

const getDefaultAnimation = () => {
    switch (market.live2d.current_pose) {
        case 'aim': return "aim_idle";
        case 'cover': return "cover_idle";
        default: return "idle";
    }
}

const successfullyLoaded = (player: any) => {
    market.load.endLoad()
    market.message.getMessage().success(messagesEnum.MESSAGE_ASSET_LOADED, market.message.short_message)
}

const wrongfullyLoaded = (player: any) => {
    market.load.errorLoad()
    market.message.getMessage().error(messagesEnum.MESSAGE_ERROR, market.message.long_message)
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
        canvas.style.height = "475vh"
        canvas.style.width = ''
        canvas.style.marginTop = "-183vh"
        canvas.style.transform = "scale(0.2)"
        canvas.style.left = "0px"
        canvas.style.top = "0px"
        canvas.width = canvas.height 
        market.globalParams.showMobileHeader()
        centerForPC()
    }
})

watch(() => market.live2d.current_id, (e) => {
    loadSpineAfterWatcher(e)
})

watch (() => market.live2d.current_pose, (e) => {
    loadSpineAfterWatcher(e)
})

watch (() => market.live2d.resetPlacement, (e) => {
    applyDefaultStyle2Canvas()
})

watch (() => market.live2d.screenshot, (e) => {

    
    if (!checkMobile()) {
        const sc_sz = localStorage.getItem('sc_sz')
        const old_sc_sz = canvas.style.height 
        canvas.style.height = sc_sz + 'px'

        setTimeout(() => {
            takeScreenshot()
            canvas.style.height = old_sc_sz
        }
        , 250)
    } else {
        takeScreenshot()
    }

})

const takeScreenshot = () => {
    const dataURL = canvas.toDataURL()

    const link = document.createElement('a')
    link.download = "NIKKE-DB_"+market.live2d.current_id+'_'+market.live2d.current_pose+'_'+new Date().getTime().toString().slice(-3)+'.png'
    link.href = dataURL
    
    link.click()
}


const loadSpineAfterWatcher = (e: any) => {
    spineCanvas.dispose()
    market.load.beginLoad()
    spineLoader()
    applyDefaultStyle2Canvas()
}

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
            canvas.style.height = "475vh"
            canvas.style.marginTop = "-183vh"
            canvas.style.transform = "scale(0.17)"
            canvas.style.position = "absolute"
            canvas.style.left = "0px"
            canvas.style.top = "0px"
            transformScale = 0.2
            market.globalParams.showMobileHeader()
            centerForPC()
        }
    }, 50)
}

const checkMobile = () => {
    return market.globalParams.isMobile ? true : false
}

const centerForPC = () => {
    const canvas_width = canvas.offsetWidth
    const viewport_width = window.innerWidth
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
        const newX = e.clientX
        const newY = e.clientY

        const stylel = parseInt(canvas.style.left.replaceAll("px", ""))
        const stylet = parseInt(canvas.style.top.replaceAll("px", ""))

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
                transformScale -= 0.02
                transformScale < 0.01 && transformScale > - 0.01 ? transformScale = - 0.02 : ''
                break;
            case false: 
                transformScale += 0.02
                transformScale < 0.01 && transformScale > - 0.01 ? transformScale = 0.02 : ''
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