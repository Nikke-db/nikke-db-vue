<template>
  <div
    id="player-container"
    :class="checkMobile() ? 'mobile' : 'computer'"
  ></div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useMarket } from '@/stores/market'

// @ts-ignore
import spine40 from '@/utils/spine/spine-player4.0'
// @ts-ignore
import spine41 from '@/utils/spine/spine-player4.1'

import { globalParams, messagesEnum } from '@/utils/enum/globalParams'

let canvas: HTMLCanvasElement | null = null
let spineCanvas: any = null
const market = useMarket()

// http://esotericsoftware.com/spine-player#Viewports
const spineViewport = {
  padLeft: '0%',
  padRight: '0%',
  padTop: '0%',
  padBottom: '0%'
}

onMounted(() => {
  market.load.beginLoad()
  spineLoader()
})

const SPINE_DEFAULT_MIX = 0.25
let spinePlayer: any = null

const spineLoader = () => {
  const skelUrl = getPathing('skel')
  const request = new XMLHttpRequest()

  request.responseType = 'arraybuffer'
  request.open('GET', skelUrl, true)
  request.send()
  request.onloadend = () => {
    if (request.status !== 200) {
      console.error('Failed to load skel file:', request.statusText)
      return
    }

    // convert the ArrayBuffer in the response as a DataUrl for rawDataURIs
    const buffer = request.response
    
    const frURL = new FileReader()
    frURL.readAsDataURL(new Blob([buffer]))
    frURL.onload = () => {
      const skelURL: string | ArrayBuffer | null = frURL.result

      const uintArray = new Uint8Array(buffer)

      // Take the first 16 bytes
      const versionBytes = uintArray.slice(0, 16)

      // Extract and decode version string
      const versionString = new TextDecoder().decode(versionBytes).replace(/\0/g, '')

      let usedSpine

      if (versionString.includes('4.0.47')) {
        usedSpine = spine40
      } else if (versionString.includes('4.1.20')) {
        usedSpine = spine41
      } else {
        console.error('Unsupported Spine version:', versionString)
        return
      }

      spineCanvas = new usedSpine.SpinePlayer('player-container', {
        skelUrl: market.live2d.current_id,
        rawDataURIs: {
          [market.live2d.current_id]: skelURL,
        },
        atlasUrl: getPathing('atlas'),
        animation: getDefaultAnimation(),
        skin: market.live2d.getSkin(),
        backgroundColor: '#00000000',
        alpha: true,
        premultipliedAlpha: true,
        mipmaps: market.live2d.current_pose === 'fb' ? true : false,
        debug: false,
        preserveDrawingBuffer: true,
        viewport: spineViewport,
        defaultMix: SPINE_DEFAULT_MIX,
        success: (player: any) => {
          spinePlayer = player
          successfullyLoaded()
          applyDefaultStyle2Canvas()
        },
        error: () => {
          wrongfullyLoaded()
        },
      })
    }
  }
}

const customSpineLoader = () => {
  let usedSpine: any

  switch (market.live2d.customSpineVersion) {
    case 4.0:
      usedSpine = spine40
      break
    case 4.1:
      usedSpine = spine41
      break
    default:
      break
  }

  spineCanvas = new usedSpine.SpinePlayer('player-container', {
    skelUrl: market.live2d.customSkel.title,
    atlasUrl: market.live2d.customAtlas.title,
    rawDataURIs: {
      [market.live2d.customSkel.title]: market.live2d.customSkel.URI,
      [market.live2d.customAtlas.title]: market.live2d.customAtlas.URI,
      [market.live2d.customPng.title]: market.live2d.customPng.URI,
      [market.live2d.customAdditionalPng.title]: market.live2d.customAdditionalPng.URI
    },
    backgroundColor: '#00000000',
    alpha: true,
    premultipliedAlpha: market.live2d.customPremultipliedAlpha,
    mipmaps: market.live2d.current_pose === 'fb' ? true : false,
    debug: false,
    preserveDrawingBuffer: true,
    viewport: spineViewport,
    defaultMix: SPINE_DEFAULT_MIX,
    success: (e: any) => {
      successfullyLoaded()
      if (market.live2d.customDefaultAnimationIdle) {
        const animationArray = e.animationState.data.skeletonData.animations
        const idleRegEx = /idle/

        for (let i = 0; i <= animationArray.length; i++) {
          if (idleRegEx.test(animationArray[i].name)) {
            e.config.animation = animationArray[i].name
            break
          }
        }
      }
      e.play()
    },
    error: () => {
      wrongfullyLoaded()
    }
  })
}

const getPathing = (extension: string) => {
  let route =
    globalParams.PATH_L2D +
    market.live2d.current_id +
    '/'
  let fileSuffix = '_00.'

  // could be more automated if we set market.live2d.current_pose to '' if we select
  // "full body" but I'd rather keep fb for future/other functions
  switch (market.live2d.current_pose) {
    case 'aim':
      route += globalParams.PATH_L2D_AIM
      fileSuffix = '_aim' + fileSuffix
      break
    case 'cover':
      route += globalParams.PATH_L2D_COVER
      fileSuffix = '_cover' + fileSuffix
      break
    default:
      break
  }

  route += market.live2d.current_id + fileSuffix + extension

  return route
}

const getDefaultAnimation = () => {
  if (market.live2d.current_id === 'mbg004_appearance' ) {
    return 'mbg004_appearance'
  }

  if (market.live2d.current_id === 'smol_rem' ||
      market.live2d.current_id === 'smol_ram' ||
      market.live2d.current_id === 'smol_emilia') {
    return 'idle_front'
  }

  switch (market.live2d.current_pose) {
    case 'aim':
      return 'aim_idle'
    case 'cover':
      return 'cover_idle'
    default:
      return 'idle'
  }
}

const successfullyLoaded = () => {
  market.load.endLoad()
  market.message
    .getMessage()
    .success(messagesEnum.MESSAGE_ASSET_LOADED, market.message.short_message)
}

const wrongfullyLoaded = () => {
  market.load.errorLoad()
  market.message
    .getMessage()
    .error(messagesEnum.MESSAGE_ERROR, market.message.long_message)
}

watch(() => market.globalParams.isMobile, (e) => {
  if (e) {
    canvas && setCanvasStyleMobile()
  } else {
    applyDefaultStyle2Canvas()
    centerForPC()
  }
})

watch(() => market.live2d.current_id, () => {
  loadSpineAfterWatcher()
})

watch(() => market.live2d.current_pose, () => {
  loadSpineAfterWatcher()
})

watch(() => market.live2d.resetPlacement, () => {
  applyDefaultStyle2Canvas()
})

watch(() => market.live2d.screenshot, () => {
  if (!checkMobile()) {
    const sc_sz = localStorage.getItem('sc_sz')
    const old_sc_sz = canvas ? canvas.style.height : '0'
    canvas && (canvas.style.height = sc_sz + 'px')

    setTimeout(() => {
      takeScreenshot()
      canvas && (canvas.style.height = old_sc_sz)
    }, 250)
  } else {
    takeScreenshot()
  }
})

watch(() => market.live2d.exportAnimationTimestamp, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    exportAnimationFrames(newVal)
  }
})

watch(() => market.live2d.customLoad, () => {
  spineCanvas.dispose()
  market.load.beginLoad()
  customSpineLoader()
  applyDefaultStyle2Canvas()
})

watch(() => market.live2d.hideUI, () => {
  const controls = document.querySelector('.spine-player-controls') as HTMLElement
  if (market.live2d.hideUI === false) {
    controls.style.visibility = 'visible'
  } else {
    controls.style.visibility = 'hidden'
  }
})

const takeScreenshot = () => {
  if (!canvas) return
  const dataURL = canvas.toDataURL()

  const link = document.createElement('a')

  link.download = 'NIKKE-DB_' + market.live2d.current_id + '_' + market.live2d.current_pose + '_' +
                  new Date().getTime().toString().slice(-3) + '.png'

  link.href = dataURL

  link.click()
}

// VP9 may be too performance intensive. VP8 or VP9 MUST be explicitly specified for alpha transparency to work.
const RECORDING_MIME_TYPE = 'video/webm;codecs=vp8'
const RECORDING_BITRATE = 12000000
const RECORDING_FRAME_RATE = 30
const RECORDING_TIME_SLICE = 10

async function startRecording(spinePlayer: any, currentAnimation: string, timestamp: number) {
  return new Promise<void>((resolve, reject) => {
    const chunks: BlobPart[] | undefined = [] // Store recorded media chunks (Blobs)
    const stream = canvas ? canvas.captureStream(RECORDING_FRAME_RATE) : new MediaStream() // Grab our canvas MediaStream
    const rec = new MediaRecorder(stream, { mimeType: RECORDING_MIME_TYPE, videoBitsPerSecond: RECORDING_BITRATE }) // Initialize the MediaRecorder

    rec.onerror = (e) => reject(e) // Reject the promise on error

    rec.ondataavailable = (e) => {
      chunks.push(e.data)
    }

    // Only when the recorder stops, construct a complete Blob from all the chunks
    rec.onstop = async () => {
      spinePlayer.pause()

      const blob: BlobPart = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = 'animation_frames_' + timestamp + '.webm'
      link.href = url
      link.click()
      URL.revokeObjectURL(url) // Clean up
      resolve()
    }

    rec.onresume = () => {
    }


    rec.onstart = () => {
      spinePlayer.play()
      requestAnimationFrame(checkCondition)
    }

    // This is important, the timeslice has to be low or the lag is high and the loop won't look right.
    rec.start(RECORDING_TIME_SLICE)

    function checkCondition() {
      if (spinePlayer.animationState.tracks && spinePlayer.animationState.tracks[0] && spinePlayer.animationState.tracks[0].animationLast !== -1 && spinePlayer.animationState.tracks[0].animationLast === spinePlayer.animationState.tracks[0].animationEnd) {
        rec.stop()
      } else {
        requestAnimationFrame(checkCondition)
      }
    }
  })
}

async function exportAnimationFrames(timestamp: number) {
  if (spineCanvas && spinePlayer) {
    if (market.live2d.exportAnimationColoredBackground) {
      let bgColor = document.body.style.backgroundColor.replace('rgb(', '').replace(')', '').split(',')
      spinePlayer.bg.r = parseInt(bgColor[0].trim()) / 255
      spinePlayer.bg.g = parseInt(bgColor[1].trim()) / 255
      spinePlayer.bg.b = parseInt(bgColor[2].trim()) / 255
      spinePlayer.bg.a = 100
    }
    const currentAnimation = spineCanvas.config.animation
    spinePlayer.playerControls.style.visibility = 'hidden'
    spinePlayer.animationState.data.defaultMix = 0
    spinePlayer.animationState.setAnimation(0, currentAnimation)
    spinePlayer.setAnimation(currentAnimation, false)
    spinePlayer.animationState.data.defaultMix = SPINE_DEFAULT_MIX
    spinePlayer.pause()

    market.message
      .getMessage()
      .success(messagesEnum.MESSAGE_EXPORT_ANIMATION, market.message.short_message)

    market.live2d.isExportingAnimation = true
    startRecording(spinePlayer, currentAnimation, timestamp).then(() => {
      market.message
        .getMessage()
        .success(messagesEnum.MESSAGE_EXPORT_ANIMATION_SUCCESS, market.message.short_message)
    }).catch((err: any) => {
      market.message
        .getMessage()
        .error(messagesEnum.MESSAGE_EXPORT_ANIMATION_FAILED, market.message.short_message)
      console.error(err)
    }).finally(() => {
      market.live2d.isExportingAnimation = false
      spinePlayer.animationState.data.defaultMix = SPINE_DEFAULT_MIX
      spinePlayer.play()
      spinePlayer.setAnimation(currentAnimation, true)
      spinePlayer.playerControls.style.visibility = 'visible'
      spinePlayer.bg.r = 0
      spinePlayer.bg.g = 0
      spinePlayer.bg.b = 0
      spinePlayer.bg.a = 0
    })
  } else {
    market.message
      .getMessage()
      .error(messagesEnum.MESSAGE_EXPORT_ANIMATION_FAILED, market.message.short_message)
    console.error('spineCanvas is not properly initialized or accessible.')
  }
}

const loadSpineAfterWatcher = () => {
  spineCanvas.dispose()
  market.load.beginLoad()
  spineLoader()
  applyDefaultStyle2Canvas()
}

const applyDefaultStyle2Canvas = () => {
  setTimeout(() => {
    canvas = document.querySelector('.spine-player-canvas') as HTMLCanvasElement

    if (!canvas) return

    canvas.width = canvas.height

    if (checkMobile()) {
      setCanvasStyleMobile()
    } else {
      canvas.style.height = market.live2d.HQassets ? '450vh' : '168vh'
      canvas.style.marginTop = market.live2d.HQassets ? 'calc(-171vh)' : 'calc(-30vh)'
      canvas.style.transform = market.live2d.HQassets ? 'scale(0.18)' : 'scale(0.5)'
      canvas.style.position = 'absolute'
      canvas.style.left = '0px'
      canvas.style.top = '0px'
      transformScale = market.live2d.HQassets ? 0.18 : 0.5
      market.globalParams.showMobileHeader()
      centerForPC()
    }
  }, 50)
}

const setCanvasStyleMobile = () => {
  if (!canvas) return

  canvas.style.height = '90vh'
  canvas.style.width = '100%'
  transformScale = 1
  market.globalParams.hideMobileHeader()
}

const checkMobile = () => {
  return market.globalParams.isMobile ? true : false
}

const centerForPC = () => {
  const canvas_width = canvas ? canvas.offsetWidth : 0
  const viewport_width = window.innerWidth
  canvas && (canvas.style.left = (viewport_width - canvas_width) / 2 + 'px')
}

const filterDomEvents = (event: any) => {
  if (
    event.target === canvas ||
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

document.addEventListener('mousedown', (e) => {
  if (filterDomEvents(e)) {
    oldX = e.clientX
    oldY = e.clientY
    move = true
  }
})

document.addEventListener('mouseup', () => {
  oldX = 0
  oldY = 0
  move = false
})

document.addEventListener('mousemove', (e) => {
  if (move && canvas) {
    const newX = e.clientX
    const newY = e.clientY

    const stylel = parseInt(canvas.style.left.replaceAll('px', ''))
    const stylet = parseInt(canvas.style.top.replaceAll('px', ''))

    if (newX !== oldX) {
      canvas.style.left = stylel + (newX - oldX) + 'px'
    }

    if (newY !== oldY) {
      canvas.style.top = stylet + (newY - oldY) + 'px'
    }

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

let transformScale = 0.5

document.addEventListener('wheel', (e) => {
  if (filterDomEvents(e)) {
    switch (e.deltaY > 0) {
      case true:
        transformScale -= 0.02
        transformScale < 0.01 && transformScale > -0.01
          ? (transformScale = -0.02)
          : ''
        break
      case false:
        transformScale += 0.02
        transformScale < 0.01 && transformScale > -0.01
          ? (transformScale = 0.02)
          : ''
        break
      default:
        break
    }

    canvas && (canvas.style.transform = 'scale(' + transformScale + ')')
  }
})
</script>

<style scoped lang="less">
#player-container {
   //height: calc(100vh - 100px);
  overflow:hidden
}
.mobile {
  height: -webkit-fill-available;
  width: 100%;
}

.computer {
  height: 100vh;
  margin-top: -100px
}
</style>
