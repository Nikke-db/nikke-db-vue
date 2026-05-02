<template>
  <div
    id="player-container"
    :class="checkMobile() ? 'mobile' : 'computer'"
    :style="{ visibility: market.live2d.isVisible ? 'visible' : 'hidden', opacity: market.live2d.isVisible ? 1 : 0 }"
  ></div>
</template>

<script setup lang="ts">
import { onMounted, watch, onUnmounted } from 'vue'
import { useMarket } from '@/stores/market'

// @ts-ignore
import spine40 from '@/utils/spine/spine-player4.0'
// @ts-ignore
import spine41 from '@/utils/spine/spine-player4.1'

import { globalParams, messagesEnum } from '@/utils/enum/globalParams'
import type { AttachmentInterface, AttachmentItemColorInterface } from '@/utils/interfaces/live2d'
import { animationMappings } from '@/utils/animationMappings'

// Helper for debug logging
const logDebug = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

let canvas: HTMLCanvasElement | null = null
let spineCanvas: any = null
let currentLoadId = 0 // Track active load requests
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
  window.addEventListener('resize', handleResize)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('touchstart', onTouchStart, { passive: false })
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('touchend', onTouchEnd)
  document.addEventListener('touchcancel', onTouchEnd)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('wheel', onWheel)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('mousedown', onMouseDown)
  document.removeEventListener('touchstart', onTouchStart)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('touchend', onTouchEnd)
  document.removeEventListener('touchcancel', onTouchEnd)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('wheel', onWheel)
})

const handleResize = () => {
  if (canvas) {
    applyDefaultStyle2Canvas()
  }
}

const onMouseDown = (e: MouseEvent) => {
  if (filterDomEvents(e)) {
    oldX = e.clientX
    oldY = e.clientY
    mouseDownX = e.clientX
    mouseDownY = e.clientY
    isCanvasMouseDown = true
    didDrag = false
    move = true
  } else {
    isCanvasMouseDown = false
  }
}

let initialDistance = 0
let initialScale = 0.5

const handlePinch = (e: TouchEvent) => {
  if (!filterDomEvents(e) || e.touches.length !== 2 || initialDistance === 0) return
  
  const touch1 = e.touches[0]
  const touch2 = e.touches[1]
  const currentDistance = Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) + 
    Math.pow(touch2.clientY - touch1.clientY, 2)
  )
  
  const scaleFactor = currentDistance / initialDistance
  transformScale = initialScale * scaleFactor
  
  // Clamp scale between reasonable bounds
  transformScale = Math.max(0.1, Math.min(3, transformScale))
  
  if (canvas) {
    canvas.style.transform = 'scale(' + transformScale + ')'
  }
  
  // Prevent page zoom during pinch
  if (e.cancelable) e.preventDefault()
}

const onTouchStart = (e: TouchEvent) => {
  if (market.route.name === 'story-gen' && filterDomEvents(e)) {
    // Handle pinch gesture start
    if (e.touches.length === 2) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      initialDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
      initialScale = transformScale
      move = false
      return
    }
    
    // Only start dragging if it's a single touch (not pinch)
    if (e.touches.length === 1) {
      oldX = e.touches[0].clientX
      oldY = e.touches[0].clientY
      move = true
      initialDistance = 0 // Reset pinch tracking
    }
  }
}

const onMouseUp = (e: MouseEvent) => {
  if (isCanvasMouseDown && market.live2d.clickToSelectMode && !didDrag) {
    handleCanvasClick(mouseDownX, mouseDownY)
  }
  oldX = 0
  oldY = 0
  move = false
  isCanvasMouseDown = false
}

const onTouchEnd = () => {
  oldX = 0
  oldY = 0
  move = false
  initialDistance = 0
}

const onMouseMove = (e: MouseEvent) => {
  if (market.live2d.clickToSelectMode && !move) {
    if (filterDomEvents(e)) {
      handleCanvasHover(e.clientX, e.clientY)
    } else {
      stopHoverCycle()
    }
  }

  if (move && canvas) {
    const newX = e.clientX
    const newY = e.clientY
    if (!didDrag) {
      const dx = newX - mouseDownX
      const dy = newY - mouseDownY
      if (dx * dx + dy * dy > 25) didDrag = true
    }

    const stylel = parseInt(canvas.style.left.replace(/px/g, ''))
    const stylet = parseInt(canvas.style.top.replace(/px/g, ''))

    if (newX !== oldX) {
      canvas.style.left = stylel + (newX - oldX) + 'px'
    }

    if (newY !== oldY) {
      canvas.style.top = stylet + (newY - oldY) + 'px'
    }

    oldX = newX
    oldY = newY
  }
}

const onTouchMove = (e: TouchEvent) => {
  // Handle pinch zoom
  if (e.touches.length === 2 && filterDomEvents(e)) {
    handlePinch(e)
    move = false
    if (e.cancelable) e.preventDefault()
    return
  }
  
  if (move && canvas && market.route.name === 'story-gen') {
    // Only prevent default for single touch drag, allow multi-touch for pinch zoom
    if (e.touches.length === 1 && e.cancelable) {
      e.preventDefault()
    }

    const newX = e.touches[0].clientX
    const newY = e.touches[0].clientY

    const stylel = parseInt(canvas.style.left.replace(/px/g, ''))
    const stylet = parseInt(canvas.style.top.replace(/px/g, ''))

    if (newX !== oldX) {
      canvas.style.left = stylel + (newX - oldX) + 'px'
    }

    if (newY !== oldY) {
      canvas.style.top = stylet + (newY - oldY) + 'px'
    }

    oldX = newX
    oldY = newY
  }
}

const onWheel = (e: WheelEvent) => {
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
}

const SPINE_DEFAULT_MIX = 0.25
let spinePlayer: any = null

const resetAttachmentColors = (player: any) => {
  if (!player?.animationState?.data?.skeletonData?.defaultSkin?.attachments) return

  player.animationState.data.skeletonData.defaultSkin.attachments.forEach((a: any[]) => {
    if (a) {
      const keys = Object.keys(a)
      if (keys !== null && keys !== undefined && keys.length > 0) {
        keys.forEach((k: string) => {
          a[k as any].color = {
            r: 1,
            g: 1,
            b: 1,
            a: 1
          }
        })
      }
    }
  })
}

const resolveAnimation = (requested: string, available: string[]): string | null => {
  logDebug(`[Loader] Resolving animation: '${requested}' against available:`, available)

  if (!requested || requested === 'none') return null
  if (available.includes(requested)) {
    logDebug(`[Loader] Found exact match: ${requested}`)
    return requested
  }

  if (market.route.name !== 'story-gen') return null

  const lowerRequested = requested.toLowerCase()

  // Special handling for multi-stage anger (e.g. Chime)
  const specialMappings = [
    {
      target: 'angry',
      condition: (avail: string[]) => avail.filter((a) => a.toLowerCase().includes('angry')).length > 1,
      triggers: ['irritated', 'bothered', 'grumpy', 'frustrated', 'annoyed', 'displeased']
    },
    {
      target: 'angry_02',
      condition: (avail: string[]) => avail.includes('angry_02'),
      triggers: ['very angry', 'furious', 'rage', 'shouting', 'yelling', 'livid', 'outraged', 'irate', 'mad']
    },
    {
      target: 'angry_03',
      condition: (avail: string[]) => avail.includes('angry_03'),
      triggers: ['stern', 'frown', 'slightly angry', 'serious', 'disapproving', 'cold', 'glaring']
    }
  ]

  for (const { target, condition, triggers } of specialMappings) {
    if (condition(available) && triggers.some((t) => lowerRequested.includes(t))) {
      logDebug(`[Loader] Mapped '${requested}' to '${target}'`)
      return target
    }
  }

  // Direct fuzzy match
  const directMatch = available.find((a) => a.toLowerCase().includes(lowerRequested))
  if (directMatch) {
    logDebug(`[Loader] Found direct fuzzy match: ${directMatch}`)
    return directMatch
  }

  // Semantic mapping
  for (const [targetAnim, triggers] of Object.entries(animationMappings)) {
    // If requested animation contains the target name OR any of the triggers
    if (lowerRequested.includes(targetAnim) || triggers.some((t) => lowerRequested.includes(t))) {

      // Try to find the target animation in available
      // exact match of targetAnim (fuzzy)...
      let match = available.find((a) => a.toLowerCase().includes(targetAnim))
      if (match) {
        logDebug(`[Loader] Found semantic match for ${targetAnim} (base): ${match}`)
        return match
      }

      // ...or match any of the triggers in available
      for (const trigger of triggers) {
        match = available.find((a) => a.toLowerCase().includes(trigger))
        if (match) {
          logDebug(`[Loader] Found semantic match for ${targetAnim} (trigger: ${trigger}): ${match}`)
          return match
        }
      }
    }
  }

  console.warn(`[Loader] No match found for animation: ${requested}`)
  return null
}

watch(() => market.live2d.current_animation, (newAnim) => {
  if (spinePlayer && newAnim) {
    try {
      const resolvedAnim = resolveAnimation(newAnim, market.live2d.animations)

      if (resolvedAnim) {
        spinePlayer.animationState.setAnimation(0, resolvedAnim, true)
      } else {
        console.warn(`Animation ${newAnim} not found and no fallback discovered.`)
      }
    } catch (e) {
      console.error('Error setting animation:', e)
    }
  }
})

const spineLoader = () => {
  if (!market.live2d.current_id) {
    logDebug('[Loader] No current_id set, skipping load.')
    return
  }

  currentLoadId++
  const thisLoadId = currentLoadId

  const skelUrl = getPathing('skel')
  const request = new XMLHttpRequest()

  request.responseType = 'arraybuffer'
  request.open('GET', skelUrl, true)
  request.send()
  request.onloadend = () => {
    if (thisLoadId !== currentLoadId) {
      logDebug('[Loader] Ignoring stale load request')
      return
    }

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

      if (/4\.0\.\d+/.test(versionString)) {
        usedSpine = spine40
      } else if (/4\.1\.\d+/.test(versionString)) {
        usedSpine = spine41
      } else {
        console.error('Unsupported Spine version:', versionString + ' | defaults to 4.1')
        usedSpine = spine41
      }

      spineCanvas = new usedSpine.SpinePlayer('player-container', {
        skelUrl: market.live2d.current_id,
        rawDataURIs: {
          [market.live2d.current_id]: skelURL,
        },
        atlasUrl: getPathing('atlas'),
        animation: getDefaultAnimation(),
        skin: market.live2d.getSkin(),
        showControls: market.route.name !== 'story-gen',
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
          resetAttachmentColors(player)
          market.live2d.attachments = player.animationState.data.skeletonData.defaultSkin.attachments
          market.live2d.animations = player.animationState.data.skeletonData.animations.map((a: any) => a.name)

          const currentAnim = market.live2d.current_animation
          let resolvedAnim = resolveAnimation(currentAnim, market.live2d.animations)

          if (!resolvedAnim) {
            // Try default animation from config
            resolvedAnim = resolveAnimation(player.config.animation, market.live2d.animations)
          }

          if (!resolvedAnim && market.live2d.animations.length > 0) {
            // Fallback to first available animation
            resolvedAnim = market.live2d.animations[0]
            console.warn(`No valid animation found. Falling back to first available: ${resolvedAnim}`)
          }

          if (resolvedAnim) {
            logDebug(`[Loader] Setting initial animation to: ${resolvedAnim} (Requested: ${currentAnim})`)
            market.live2d.current_animation = resolvedAnim

            // Force set animation with a slight delay to ensure player is ready
            setTimeout(() => {
              try {
                player.animationState.setAnimation(0, resolvedAnim, true)
                player.play()
              } catch (e) {
                console.error('[Loader] Failed to set animation in timeout', e)
              }
            }, 100)
          } else {
            console.error('[Loader] No animations available for this character.')
          }

          market.live2d.triggerFinishedLoading()
          successfullyLoaded()
        },
        error: () => {
          wrongfullyLoaded()
        },
      })
      applyDefaultStyle2Canvas()
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

  const spineCanvasOptions = {
    atlasUrl: market.live2d.customAtlas.title,
    rawDataURIs: {
      [market.live2d.customSkel.title]: market.live2d.customSkel.URI,
      [market.live2d.customAtlas.title]: market.live2d.customAtlas.URI
    },
    backgroundColor: '#00000000',
    alpha: true,
    premultipliedAlpha: market.live2d.customPremultipliedAlpha,
    mipmaps: market.live2d.current_pose === 'fb' ? true : false,
    debug: false,
    preserveDrawingBuffer: true,
    viewport: spineViewport,
    defaultMix: SPINE_DEFAULT_MIX,
    success: (player: any) => {
      spinePlayer = player
      resetAttachmentColors(player)
      market.live2d.attachments = player.animationState.data.skeletonData.defaultSkin.attachments
      market.live2d.animations = player.animationState.data.skeletonData.animations.map((a: any) => a.name)

      const currentAnim = market.live2d.current_animation
      const hasAnim = market.live2d.animations.includes(currentAnim)

      if (hasAnim) {
        player.animationState.setAnimation(0, currentAnim, true)
      } else {
        market.live2d.current_animation = player.config.animation
      }

      market.live2d.triggerFinishedLoading()
      successfullyLoaded()
      try {
        if (market.live2d.customDefaultAnimationIdle) {
          const animationArray = player.animationState.data.skeletonData.animations
          const idleRegEx = /idle/

          for (let i = 0; i <= animationArray.length; i++) {
            if (idleRegEx.test(animationArray[i].name)) {
              player.config.animation = animationArray[i].name
              break
            }
          }
        } 
      } catch (e) {
        console.error('Something unexpected happened with custom loader: non-nikke asset ?')
        console.error(e)
      }
      player.play()
    },
    error: () => {
      wrongfullyLoaded()
    }
  }

  for (let i = 0; i < market.live2d.customPng.length; i++) {
    spineCanvasOptions.rawDataURIs[market.live2d.customPng[i].title] = market.live2d.customPng[i].URI
  }
  // whether to load json or skel
  // @ts-ignore
  spineCanvasOptions[market.live2d.customLoader === 'skel' ? 'skelUrl' : 'jsonUrl'] = market.live2d.customSkel.title

  spineCanvas = new usedSpine.SpinePlayer('player-container', spineCanvasOptions)
}

const getPathing = (extension: string) => {
  let route =
    globalParams.PATH_L2D +
    market.live2d.current_id +
    '/'
  let fileSuffix = '_00'


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

  const f = market.live2d.f !== '' ? market.live2d.f : market.live2d.current_id + fileSuffix
  route += f + '.' + extension

  return route
}

const getDefaultAnimation = () => {
  if (market.live2d.current_id === 'mbg004_appearance' ) {
    return 'mbg004_appearance'
  }

  if (market.live2d.current_id === 'smol_rem' ||
      market.live2d.current_id === 'smol_ram' ||
      market.live2d.current_id === 'smol_emilia' ||
      market.live2d.current_id === 'smol_mast_pirate' ||
      market.live2d.current_id === 'smol_anchor_pirate' ||
      market.live2d.current_id === 'smol_sin_pirate') {
    return 'idle_front'
  }

  if (['smol_anis', 'smol_prika', 'smol_mint'].includes(market.live2d.current_id)) {
    return 'pose_idle'
  }

  // mass manufactured rapi
  if (market.live2d.current_id === 'c994') return 'idle_02'

  if (market.live2d.current_id.includes('favorite')) return 'idle_merged'

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

  checkIfAssetCanYap()
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

watch(() => market.route.name, () => {
  applyDefaultStyle2Canvas()
})

watch(() => market.live2d.HQassets, () => {
  applyDefaultStyle2Canvas()
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
  if (spineCanvas) {
    try {
      spineCanvas.dispose()
    } catch (e) {
      console.warn('[Loader] Error disposing spineCanvas for customLoad:', e)
    }
    spineCanvas = null
  }
  market.load.beginLoad()
  customSpineLoader()
  applyDefaultStyle2Canvas()
})

watch(() => market.live2d.hideUI, () => {
  const controls = document.querySelector('.spine-player-controls') as HTMLElement
  if (!controls) return
  // On story-gen route, controls should always be hidden
  // On other routes (like L2D), controls visibility depends on hideUI state
  if (market.live2d.hideUI === false && market.route.name !== 'story-gen') {
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
  if (market.live2d.canLoadSpine) {
    stopAllCycles()
    if (spineCanvas) {
      try {
        spineCanvas.dispose()
      } catch (e) {
        console.warn('[Loader] Error disposing spineCanvas:', e)
      }
      spineCanvas = null
    }
    market.load.beginLoad()
    spineLoader()
    applyDefaultStyle2Canvas()
  }
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

  if (market.route.name === 'story-gen') {
    canvas.style.height = '70vh'
    canvas.style.width = 'auto'
    canvas.style.position = 'absolute'
    canvas.style.top = '0px'
    canvas.style.transform = 'scale(0.7)'
    transformScale = 0.7
    centerForPC()
  } else {
    // L2D (visualiser) - use production behavior
    canvas.style.height = '90vh'
    canvas.style.width = '100%'
    transformScale = 1
  }
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
  const target = event.target as HTMLElement
  const spinePlayer = document.querySelector('.spine-player')
  const playerContainer = document.querySelector('#player-container')

  // Only change behaviour in story-gen route
  const allowContainerHit = market.route.name === 'story-gen'
  
  if (
    target === canvas ||
    target === spinePlayer ||
    canvas?.contains(target) ||
    spinePlayer?.contains(target) ||
    (allowContainerHit && playerContainer?.contains(target))
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
let mouseDownX = 0
let mouseDownY = 0
let isCanvasMouseDown = false
let didDrag = false

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

/**
 * Yap or talking mode for the normal people;
 * first of all begin with checking if a talk_start animation exists in the spine
 * if it does, activate the checkbox, otherwise disable it
 * once activated, add the animation & play it on top of the current track,
 * once deactivated, remove the talking track and let only the regular animation play
 */

const YAP_TRACK = 'talk_start'

const checkIfAssetCanYap = () => {
  let yappable = false
  if (market.live2d.current_pose === 'fb') {
    const animations = spineCanvas.animationState.data.skeletonData.animations
    animations.forEach((a: {name: string}) => {
      if (a.name === YAP_TRACK) {
        yappable = true
      }
    })
  }
  setYappable(yappable)

  if (yappable && market.live2d.isYapping && market.live2d.yapEnabled) {
    try {
      spineCanvas.animationState.setAnimation(1, YAP_TRACK, true)
    } catch (e) {
      console.warn('Could not add yap track on load', e)
    }
  }
}

const setYappable = (bool: boolean) => {
  market.live2d.canYap = bool
  if (!bool) {
    market.live2d.isYapping = false
  }
}

watch(() => market.live2d.isYapping, (value) => {
  if (!spineCanvas || !spineCanvas.animationState) return

  logDebug(`[Loader] isYapping changed to: ${value}`)

  // Only allow yapping if asset supports it AND user enabled it
  if (value && market.live2d.canYap && market.live2d.yapEnabled) {
    try {
      logDebug('[Loader] Setting yap animation')
      spineCanvas.animationState.setAnimation(1, YAP_TRACK, true)
    } catch (e) {
      console.warn('Could not add yap track', e)
    }
  } else {
    try {
      logDebug('[Loader] Clearing yap animation')
      spineCanvas.animationState.setEmptyAnimation(1, 0)
    } catch (e) {
      console.warn('Could not clear yap track', e)
    }
  }
})

/**
 * Attachment / Layer edition
 */
// Sync slot.attachment on the live skeleton based on color.a.
// color.a === 0 → null the slot so hit-testing naturally skips it.
// color.a  > 0 → restore if the slot was nulled.
const syncHiddenSlots = () => {
  if (!spinePlayer?.skeleton) return
  market.live2d.attachments.forEach((slotAtts: any, slotIndex: number) => {
    if (!slotAtts) return
    Object.keys(slotAtts).forEach((key: string) => {
      const slot = spinePlayer.skeleton.slots[slotIndex]
      if (!slot) return
      if (slotAtts[key].color.a === 0) {
        if (slot.attachment?.name === key) slot.attachment = null
      } else if (slot.attachment === null && slot.data.attachmentName === key) {
        slot.attachment = slotAtts[key]
      }
    })
  })
}

watch(() => market.live2d.applyAttachments, () => {
  spineCanvas.animationState.data.skeletonData.defaultSkin.attachments = [ ...market.live2d.attachments ]
  syncHiddenSlots()
}, { deep: true })

watch(() => market.live2d.hideSelectedLayers, () => {
  stopAllCycles()
}, { flush: 'sync' })

watch(() => market.live2d.resetSelectedLayers, () => {
  stopAllCycles()
}, { flush: 'sync' })

watch(() => market.live2d.resetAllLayers, () => {
  stopAllCycles()
  if (spinePlayer?.skeleton) spinePlayer.skeleton.setSlotsToSetupPose()
  market.live2d.attachments.forEach((a: any) => {
    if (!a) return
    Object.keys(a).forEach((k: string) => {
      a[k].color = { r: 1, g: 1, b: 1, a: 1 }
    })
  })
  market.live2d.triggerApplyAttachments()
})


// preview layer
// if we ARE previewing :
// first off we find the requested layer
// afterward we backup it's color data
// then we apply the preview
// once we stop previewing we apply the backedup color back to the layer
let allColorsBackedUp = new Map() as Map<string, AttachmentItemColorInterface>
let intervalid = null as null | number


watch(() => market.live2d.layerPreviewMode, () => {
  if (market.live2d.layerEditorPreviewObj.preview) {

    spineCanvas.animationState.data.skeletonData.defaultSkin.attachments.forEach((a: any[]) => {
      if (a) {
        const keys = Object.keys(a)
        if (keys !== null && keys !== undefined && keys.length > 0) {
          keys.forEach((k: string) => {
            allColorsBackedUp.set(k, JSON.parse(JSON.stringify(a[k as any].color)))
          })
        }
      }
    })

    const PREVIEW_MODE = 1

    if (PREVIEW_MODE === 1) {
      triggerPreview1()
    }
  } else {
    if (intervalid) {
      clearInterval(intervalid)
    }

    spineCanvas.animationState.data.skeletonData.defaultSkin.attachments.forEach((a: any[]) => {
      if (a) {
        const keys = Object.keys(a)
        if (keys !== null && keys !== undefined && keys.length > 0) {
          keys.forEach((k: string) => {
            a[k as any].color = allColorsBackedUp.get(k)
          })
        }
      }
    })

  }
})

const triggerPreview1 = () => {
  let toShow = 'r'

  intervalid = setInterval(() => {
    const colors = {
      r: toShow === 'r' ? 2 : 0,
      g: toShow === 'g' ? 2 : 0,
      b: toShow === 'b' ? 2 : 0,
      a: 1
    }
    toShow = toShow === 'r' ? 'g' : toShow === 'g' ? 'b' : 'r'
    spineCanvas.animationState.data.skeletonData.defaultSkin.attachments[market.live2d.layerEditorPreviewObj.index][market.live2d.layerEditorPreviewObj.key].color = colors

  }, 250) as any
}

watch(() => market.live2d.clickToSelectMode, (val) => {
  if (canvas) canvas.style.cursor = val ? 'crosshair' : ''
  if (!val) stopAllCycles()
})

// ─── Click-to-select: hit testing + self-contained color cycling ─────────────
// We manage cycling directly (setInterval + manual color backup) instead of
// going through the store watcher system. Two concurrent watcher triggers in
// the same tick would be batched by Vue, causing the "restore" call to be
// swallowed by the "start" call and leaving colors stuck.

type CycleState = {
  slotIndex: number
  key: string
  backup: { r: number; g: number; b: number; a: number }
  intervalId: any
}

const ALPHA_HIT_THRESHOLD = 12
let hoverCycle: CycleState | null = null
const textureImageDataCache = new WeakMap<object, ImageData | null>()

const getAttachment = (slotIndex: number, key: string): any =>
  spineCanvas?.animationState?.data?.skeletonData?.defaultSkin?.attachments?.[slotIndex]?.[key] ?? null

const startCycling = (slotIndex: number, key: string): any => {
  let phase = 'r'
  const applyNextColor = () => {
    const att = getAttachment(slotIndex, key)
    if (!att) return
    att.color = {
      r: phase === 'r' ? 2 : 0,
      g: phase === 'g' ? 2 : 0,
      b: phase === 'b' ? 2 : 0,
      a: 1
    }
    phase = phase === 'r' ? 'g' : phase === 'g' ? 'b' : 'r'
  }
  applyNextColor()
  return setInterval(applyNextColor, 250)
}


const stopHoverCycle = () => {
  if (!hoverCycle) return
  clearInterval(hoverCycle.intervalId)
  const att = getAttachment(hoverCycle.slotIndex, hoverCycle.key)
  if (att) att.color = { ...hoverCycle.backup }
  hoverCycle = null
}

const stopAllCycles = () => {
  stopHoverCycle()
}

const pointInQuad = (px: number, py: number, v: number[]): boolean => {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const x1 = v[i * 2], y1 = v[i * 2 + 1]
    const x2 = v[((i + 1) % 4) * 2], y2 = v[((i + 1) % 4) * 2 + 1]
    const cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
    if (cross === 0) continue
    const s = cross > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

const pointInTriangle = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): boolean => {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

const pointInMeshTriangles = (px: number, py: number, verts: number[], triangles: number[]): boolean => {
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] * 2
    const b = triangles[i + 1] * 2
    const c = triangles[i + 2] * 2
    if (
      pointInTriangle(
        px,
        py,
        verts[a],
        verts[a + 1],
        verts[b],
        verts[b + 1],
        verts[c],
        verts[c + 1]
      )
    ) {
      return true
    }
  }
  return false
}

const getTriangleBarycentric = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
) => {
  const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
  if (denom === 0) return null
  const w1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom
  const w2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom
  const w3 = 1 - w1 - w2
  const epsilon = -0.0001
  if (w1 < epsilon || w2 < epsilon || w3 < epsilon) return null
  return { w1, w2, w3 }
}

const getImageDataForRegion = (region: any): ImageData | null => {
  const image = region?.page?.texture?.getImage?.()
  if (!image) return null
  if (textureImageDataCache.has(image)) return textureImageDataCache.get(image) ?? null

  try {
    const canvasForTexture = document.createElement('canvas')
    canvasForTexture.width = image.width
    canvasForTexture.height = image.height
    const ctx = canvasForTexture.getContext('2d')
    if (!ctx) {
      textureImageDataCache.set(image, null)
      return null
    }
    ctx.drawImage(image, 0, 0)
    const imageData = ctx.getImageData(0, 0, image.width, image.height)
    textureImageDataCache.set(image, imageData)
    return imageData
  } catch (_) {
    textureImageDataCache.set(image, null)
    return null
  }
}

const getInterpolatedUvInTriangle = (
  px: number,
  py: number,
  verts: number[],
  uvs: ArrayLike<number>,
  vertexIndexes: [number, number, number]
) => {
  const [i1, i2, i3] = vertexIndexes
  const b = getTriangleBarycentric(
    px,
    py,
    verts[i1 * 2],
    verts[i1 * 2 + 1],
    verts[i2 * 2],
    verts[i2 * 2 + 1],
    verts[i3 * 2],
    verts[i3 * 2 + 1]
  )
  if (!b) return null
  return {
    u: uvs[i1 * 2] * b.w1 + uvs[i2 * 2] * b.w2 + uvs[i3 * 2] * b.w3,
    v: uvs[i1 * 2 + 1] * b.w1 + uvs[i2 * 2 + 1] * b.w2 + uvs[i3 * 2 + 1] * b.w3
  }
}

const isOpaqueRegionHit = (px: number, py: number, verts: number[], attachment: any): boolean => {
  const imageData = getImageDataForRegion(attachment.region)
  if (!imageData) return true

  const uv =
    getInterpolatedUvInTriangle(px, py, verts, attachment.uvs, [0, 1, 2]) ??
    getInterpolatedUvInTriangle(px, py, verts, attachment.uvs, [0, 2, 3])
  if (!uv) return false

  const x = Math.max(0, Math.min(imageData.width - 1, Math.floor(uv.u * imageData.width)))
  const y = Math.max(0, Math.min(imageData.height - 1, Math.floor(uv.v * imageData.height)))
  return imageData.data[(y * imageData.width + x) * 4 + 3] > ALPHA_HIT_THRESHOLD
}

const hitTest = (screenX: number, screenY: number): { slotIndex: number, key: string } | null => {
  if (!canvas || !spinePlayer) return null

  const cam = spinePlayer.sceneRenderer?.camera
  if (!cam) return null

  const skeleton = spinePlayer.skeleton
  if (!skeleton?.drawOrder) return null

  const rect = canvas.getBoundingClientRect()
  const normX = (screenX - rect.left) / rect.width
  const normY = (screenY - rect.top) / rect.height

  const worldX = cam.position.x + (normX - 0.5) * cam.viewportWidth * cam.zoom
  const worldY = cam.position.y + (0.5 - normY) * cam.viewportHeight * cam.zoom

  const drawOrder: any[] = skeleton.drawOrder
  for (let i = drawOrder.length - 1; i >= 0; i--) {
    const slot = drawOrder[i]
    const attachment = slot.attachment
    if (!attachment) continue
    if (attachment.color?.a === 0) continue

    try {
      if (attachment.offset && attachment.width !== undefined) {
        // RegionAttachment
        const verts = new Array(8).fill(0)
        attachment.computeWorldVertices(slot, verts, 0, 2)
        if (pointInQuad(worldX, worldY, verts) && isOpaqueRegionHit(worldX, worldY, verts, attachment)) {
          return { slotIndex: slot.data.index, key: attachment.name }
        }
      } else if (attachment.triangles !== undefined) {
        // MeshAttachment
        const vl: number = attachment.worldVerticesLength
        const verts = new Array(vl).fill(0)
        attachment.computeWorldVertices(slot, 0, vl, verts, 0, 2)
        if (pointInMeshTriangles(worldX, worldY, verts, attachment.triangles)) {
          return { slotIndex: slot.data.index, key: attachment.name }
        }
      }
    } catch (_) {}
  }
  return null
}

const handleCanvasHover = (screenX: number, screenY: number) => {
  const hit = hitTest(screenX, screenY)

  if (!hit) {
    stopHoverCycle()
    return
  }

  // Already hovering this exact attachment
  if (hoverCycle && hoverCycle.slotIndex === hit.slotIndex && hoverCycle.key === hit.key) return

  stopHoverCycle()

  const att = getAttachment(hit.slotIndex, hit.key)
  if (!att) return

  hoverCycle = {
    slotIndex: hit.slotIndex,
    key: hit.key,
    backup: { ...att.color },
    intervalId: startCycling(hit.slotIndex, hit.key)
  }
}

const handleCanvasClick = (screenX: number, screenY: number) => {
  stopHoverCycle()
  const hit = hitTest(screenX, screenY)
  if (!hit) return
  market.live2d.clickedAttachmentKey = hit.key
  market.live2d.clickedAttachmentIndex = hit.slotIndex
  market.live2d.fireClickedAttachment()
}

</script>

<style scoped lang="less">
#player-container {
   //height: calc(100vh - 100px);
  overflow:hidden;
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
