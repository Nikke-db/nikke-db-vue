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
import type { AttachmentItemColorInterface } from '@/utils/interfaces/live2d'
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
const STORY_GEN_LOW_POWER_DATASET_KEY = 'storyGenLowPower'
const STORY_GEN_LOW_POWER_FRAME_MS = 1000 / 30

// http://esotericsoftware.com/spine-player#Viewports
const spineViewport = {
  padLeft: '0%',
  padRight: '0%',
  padTop: '0%',
  padBottom: '0%'
}

const isStoryGenLowPowerEnabled = () => {
  if (typeof document === 'undefined') return false

  return market.route.name === 'story-gen' &&
         document.body.dataset[STORY_GEN_LOW_POWER_DATASET_KEY] === 'true' &&
         !market.live2d.isExportingAnimation
}

const applyStoryGenLowPowerThrottle = (player: any) => {
  if (market.route.name !== 'story-gen' || !player || typeof player.drawFrame !== 'function' || player.__storyGenLowPowerWrapped) {
    return
  }

  const originalDrawFrame = player.drawFrame.bind(player)
  let lastFrameAt = 0

  player.drawFrame = (requestNextFrame = true) => {
    if (!requestNextFrame || !isStoryGenLowPowerEnabled()) {
      return originalDrawFrame(requestNextFrame)
    }

    if (player.error || player.disposed) return

    const now = performance.now()
    if (lastFrameAt !== 0 && now - lastFrameAt < STORY_GEN_LOW_POWER_FRAME_MS) {
      if (!player.stopRequestAnimationFrame) {
        requestAnimationFrame(() => player.drawFrame())
      }
      return
    }

    lastFrameAt = now
    return originalDrawFrame(requestNextFrame)
  }

  player.__storyGenLowPowerWrapped = true
}

onMounted(() => {
  market.load.beginLoad()
  /*Pre-size the player container for story-gen *before* any load attempt.
   On physical iOS, -webkit-fill-available (used by .mobile) can resolve
   to 0 or be clamped until a definite ancestor height exists. StoryGenerator
   now sets 100dvh on .l2dGlobal.story-gen, and we force it here synchronously
   so that the first (or subsequent) SpinePlayer('player-container', ...) sees
   a measurable rect at construction time. The visualiser (L2D) route does not
   need this because its Wrapper* components + layout provide real height early. */
  if (market.route.name === 'story-gen') {
    const containerEl = document.getElementById('player-container')
    if (containerEl) {
      containerEl.style.height = '100dvh'
      containerEl.style.minHeight = '100dvh'
      containerEl.style.width = '100%'
      containerEl.style.position = containerEl.style.position || 'relative'
    }
  }
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
  if (zoomFrameId !== null) {
    cancelAnimationFrame(zoomFrameId)
    zoomFrameId = null
  }
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
  const newScale = clampScale(initialScale * scaleFactor)
  if (newScale === transformScale) return

  // Anchor the zoom at the midpoint of the two fingers so the character stays
  // under the fingers instead of flying off-screen (the original pinch bug).
  const midX = (touch1.clientX + touch2.clientX) / 2
  const midY = (touch1.clientY + touch2.clientY) / 2
  captureAnchor(midX, midY)
  transformScale = newScale
  targetScale = newScale
  applyScaleWithAnchor(transformScale)

  // Prevent page zoom during pinch
  if (e.cancelable) e.preventDefault()
}

const onTouchStart = (e: TouchEvent) => {
  if (!filterDomEvents(e)) return

  // Tell the browser we own this gesture before it can start panning/zooming the page.
  if (e.cancelable) e.preventDefault()

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
    // Stop any in-flight wheel zoom smoothing so pinch takes over cleanly
    if (zoomFrameId !== null) {
      cancelAnimationFrame(zoomFrameId)
      zoomFrameId = null
    }
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

const onMouseUp = () => {
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

    const cs = getComputedStyle(canvas)
    const stylel = parseFloat(canvas.style.left) || parseFloat(cs.left) || 0
    const stylet = parseFloat(canvas.style.top) || parseFloat(cs.top) || 0

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

  if (move && canvas) {
    // Only prevent default for single touch drag, allow multi-touch for pinch zoom
    if (e.touches.length === 1 && e.cancelable) {
      e.preventDefault()
    }

    const newX = e.touches[0].clientX
    const newY = e.touches[0].clientY

    const cs = getComputedStyle(canvas)
    const stylel = parseFloat(canvas.style.left) || parseFloat(cs.left) || 0
    const stylet = parseFloat(canvas.style.top) || parseFloat(cs.top) || 0

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
    const direction = e.deltaY > 0 ? -1 : 1
    targetScale = clampScale(targetScale * Math.pow(ZOOM_FACTOR, direction))
    startZoomSmoothing()
  }
}

const SPINE_DEFAULT_MIX = 0.25
const MAX_SPINE_LOAD_RETRIES = 3
const SPINE_RETRY_DELAYS = [1000, 3000, 5000]
const XHR_TIMEOUT_MS = 15000
const SPINE_PLAYER_TIMEOUT_MS = 20000
let spinePlayer: any = null

const getActiveSpinePlayer = () => {
  if (!spinePlayer || !spineCanvas || spinePlayer !== spineCanvas) return null
  if (spinePlayer.disposed || spinePlayer.error || !spinePlayer.animationState) return null
  return spinePlayer
}

const clearSpineReferences = (player?: any) => {
  if (!player || spineCanvas === player) {
    spineCanvas = null
  }

  if (!player || spinePlayer === player) {
    spinePlayer = null
  }
}

const forceRemovePlayerDom = () => {
  const container = document.getElementById('player-container')
  if (!container) return

  const canvases = container.querySelectorAll('.spine-player-canvas')
  canvases.forEach((c) => c.remove())

  const controls = container.querySelectorAll('.spine-player-controls')
  controls.forEach((c) => c.remove())

  canvas = null
}

const disposeSpineInstance = (player: any, context: string) => {
  if (!player) return

  try {
    if (player.stopRequestAnimationFrame) {
      player.stopRequestAnimationFrame = true
    }
  } catch (_) { /* ignore */ }

  try {
    if (player.assetManager && typeof player.assetManager.dispose === 'function') {
      player.assetManager.dispose()
    }
  } catch (_) { /* ignore */ }

  try {
    if (!player.disposed) {
      player.dispose()
    }
  } catch (e) {
    console.warn(`[Loader] Error disposing ${context}:`, e)
  }

  clearSpineReferences(player)
  forceRemovePlayerDom()
}

const isDefinitiveMissingAssetError = (
  stage: string,
  details?: Record<string, any>,
  assetErrors?: Record<string, string>,
  message?: string
): boolean => {
  if (stage === 'skeleton request') {
    return details?.status === 404
  }

  if (message && message.includes('does not have the desired animation')) {
    return true
  }

  if (assetErrors) {
    return Object.values(assetErrors).some((msg) => {
      return /status\s+404/.test(msg) || msg.startsWith('Couldn\'t load image:')
    })
  }

  return false
}

const handleSpineLoadFailure = ({
  loadId,
  retryAttempt,
  requestedCharacterId,
  requestedPose,
  requestedSkelUrl,
  requestedAtlasUrl,
  stage,
  message,
  player,
  details
}: {
  loadId: number
  retryAttempt: number
  requestedCharacterId: string
  requestedPose: string
  requestedSkelUrl: string
  requestedAtlasUrl: string
  stage: string
  message?: string
  player?: any
  details?: Record<string, any>
}) => {
  if (loadId !== currentLoadId) {
    logDebug(`[Loader] Ignoring stale ${stage} failure for ${requestedCharacterId}`)
    return
  }

  const assetErrors = typeof player?.assetManager?.getErrors === 'function'
    ? player.assetManager.getErrors()
    : undefined

  console.error('[Loader] Spine load failed:', {
    characterId: requestedCharacterId,
    pose: requestedPose,
    skelUrl: requestedSkelUrl,
    atlasUrl: requestedAtlasUrl,
    stage,
    message,
    assetErrors,
    ...details
  })

  const isMissingAsset = isDefinitiveMissingAssetError(stage, details, assetErrors, message)

  if (isMissingAsset) {
    // Real missing asset (e.g. Logey aim/cover): keep the SpinePlayer error overlay visible
    // Do not retry, and unblock any waiting story-gen playback.
    if (!player) {
      clearSpineReferences()
      forceRemovePlayerDom()
    }

    wrongfullyLoaded()
    market.live2d.triggerFinishedLoading()
    return
  }

  // Transient failure / timeout path: tear down and retry.
  if (player) {
    disposeSpineInstance(player, `${stage} failure`)
  } else {
    clearSpineReferences()
    forceRemovePlayerDom()
  }

  if (retryAttempt < MAX_SPINE_LOAD_RETRIES) {
    const delay = SPINE_RETRY_DELAYS[retryAttempt] ?? SPINE_RETRY_DELAYS[SPINE_RETRY_DELAYS.length - 1]
    console.warn(`[Loader] Retrying Spine load for ${requestedCharacterId} (${retryAttempt + 1}/${MAX_SPINE_LOAD_RETRIES}) in ${delay}ms`)
    window.setTimeout(() => {
      if (loadId !== currentLoadId) return
      spineLoader(retryAttempt + 1)
    }, delay)
    return
  }

  wrongfullyLoaded()
  market.live2d.triggerFinishedLoading()
}

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
  const activePlayer = getActiveSpinePlayer()

  if (activePlayer && newAnim) {
    try {
      const resolvedAnim = resolveAnimation(newAnim, market.live2d.animations)

      if (resolvedAnim) {
        activePlayer.animationState.setAnimation(0, resolvedAnim, true)
      } else {
        console.warn(`Animation ${newAnim} not found and no fallback discovered.`)
      }
    } catch (e) {
      console.error('Error setting animation:', e)
    }
  }
})

const spineLoader = (retryAttempt = 0) => {
  if (!market.live2d.current_id) {
    logDebug('[Loader] No current_id set, skipping load.')
    return
  }

  currentLoadId++
  const thisLoadId = currentLoadId
  const requestedCharacterId = market.live2d.current_id
  const requestedPose = market.live2d.current_pose

  const skelUrl = getPathing('skel')
  const atlasUrl = getPathing('atlas')
  const requestedSkin = market.live2d.getSkin()
  const request = new XMLHttpRequest()

  request.responseType = 'arraybuffer'
  request.timeout = XHR_TIMEOUT_MS
  request.open('GET', skelUrl, true)
  request.send()
  request.ontimeout = () => {
    if (thisLoadId !== currentLoadId) return
    handleSpineLoadFailure({
      loadId: thisLoadId,
      retryAttempt,
      requestedCharacterId,
      requestedPose,
      requestedSkelUrl: skelUrl,
      requestedAtlasUrl: atlasUrl,
      stage: 'skeleton request',
      message: `XHR timed out after ${XHR_TIMEOUT_MS}ms.`,
      details: { timedOut: true }
    })
  }
  request.onloadend = () => {
    if (thisLoadId !== currentLoadId) {
      logDebug('[Loader] Ignoring stale load request')
      return
    }

    if (request.status !== 200 || !request.response) {
      handleSpineLoadFailure({
        loadId: thisLoadId,
        retryAttempt,
        requestedCharacterId,
        requestedPose,
        requestedSkelUrl: skelUrl,
        requestedAtlasUrl: atlasUrl,
        stage: 'skeleton request',
        message: 'Failed to load skel file.',
        details: {
          status: request.status,
          statusText: request.statusText
        }
      })
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

      // Guard flag + safety timeout: SpinePlayer has no built-in timeout for atlas/texture fetches,
      // so we force a failure if neither success nor error fires within SPINE_PLAYER_TIMEOUT_MS.
      let playerSettled = false
      const playerTimeoutId = window.setTimeout(() => {
        if (playerSettled || thisLoadId !== currentLoadId) return
        playerSettled = true
        
        // CRITICAL: Pass the spineCanvas instance so it gets properly disposed
        // The SpinePlayer is still alive and trying to load - we must kill it
        const hungPlayer = spineCanvas
        handleSpineLoadFailure({
          loadId: thisLoadId,
          retryAttempt,
          requestedCharacterId,
          requestedPose,
          requestedSkelUrl: skelUrl,
          requestedAtlasUrl: atlasUrl,
          stage: 'asset manager',
          message: `SpinePlayer timed out after ${SPINE_PLAYER_TIMEOUT_MS}ms (atlas/texture fetch hung).`,
          player: hungPlayer
        })
      }, SPINE_PLAYER_TIMEOUT_MS)

      /*Ensure the container has a definite non-zero size *right before* the
      SpinePlayer constructor on story-gen. This is the moment the library
      samples clientWidth/clientHeight/dpr to allocate its internal canvas
      and WebGL viewport. Without this, on physical iPhones the container
      can be 0x0 (or offscreen) due to fill-available timing in the
      n-scrollbar + fixed NikkeChatOverlay + conditional header ancestry,
      even though the same Loader works for the L2D visualiser route. */
      if (market.route.name === 'story-gen') {
        const containerEl = document.getElementById('player-container')
        if (containerEl) {
          containerEl.style.height = '100dvh'
          containerEl.style.minHeight = '100dvh'
          containerEl.style.width = '100%'
          containerEl.style.position = containerEl.style.position || 'relative'
        }
      }
      spineCanvas = new usedSpine.SpinePlayer('player-container', {
        skelUrl: requestedCharacterId,
        rawDataURIs: {
          [requestedCharacterId]: skelURL,
        },
        atlasUrl,
        animation: getDefaultAnimation(),
        skin: requestedSkin,
        showControls: market.route.name !== 'story-gen',
        backgroundColor: '#00000000',
        alpha: true,
        premultipliedAlpha: true,
        mipmaps: requestedPose === 'fb' ? true : false,
        debug: false,
        preserveDrawingBuffer: true,
        viewport: spineViewport,
        defaultMix: SPINE_DEFAULT_MIX,
        success: (player: any) => {
          // Late arrival after our safety timeout fired — discard this player.
          if (playerSettled) {
            logDebug(`[Loader] Ignoring success callback after timeout for ${requestedCharacterId}`)
            if (!player.disposed) {
              disposeSpineInstance(player, 'post-timeout success callback')
            }
            return
          }
          playerSettled = true
          clearTimeout(playerTimeoutId)

          if (thisLoadId !== currentLoadId || player.disposed) {
            logDebug(`[Loader] Ignoring stale success callback for ${requestedCharacterId}`)
            if (!player.disposed) {
              disposeSpineInstance(player, 'stale success callback')
            }
            return
          }

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
              if (thisLoadId !== currentLoadId || player !== getActiveSpinePlayer()) {
                return
              }

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
        error: (player: any, message?: string) => {
          if (playerSettled) {
            logDebug(`[Loader] Ignoring error callback after timeout for ${requestedCharacterId}`)
            return
          }
          playerSettled = true
          clearTimeout(playerTimeoutId)

          handleSpineLoadFailure({
            loadId: thisLoadId,
            retryAttempt,
            requestedCharacterId,
            requestedPose,
            requestedSkelUrl: skelUrl,
            requestedAtlasUrl: atlasUrl,
            stage: 'asset manager',
            message,
            player
          })
        },
      })
      applyStoryGenLowPowerThrottle(spineCanvas)
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
  applyStoryGenLowPowerThrottle(spineCanvas)
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

  if (['smol_anis', 'smol_prika', 'smol_mint', 'smol_marciana', 'smol_naga', 'smol_tia'].includes(market.live2d.current_id)) {
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
    centerCanvas()
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
    const sc_sz = parseInt(localStorage.getItem('sc_sz') || '3000', 10) || 3000
    // Cap the capture size to the real WebGL buffer limit so the character
    // isn't cropped at the top on high-DPI displays.
    const dpr = window.devicePixelRatio || 1
    const limit = measureBufferLimit(Math.round(sc_sz * dpr))
    const cappedPx = Math.min(sc_sz, Math.floor(limit / dpr))
    const old_sc_sz = canvas ? canvas.style.height : '0'
    canvas && (canvas.style.height = cappedPx + 'px')

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
    disposeSpineInstance(spineCanvas, 'spineCanvas for customLoad')
  } else {
    clearSpineReferences()
    forceRemovePlayerDom()
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
    stopHoverCycle()
    if (spineCanvas) {
      disposeSpineInstance(spineCanvas, 'spineCanvas')
    } else {
      clearSpineReferences()
      forceRemovePlayerDom()
    }
    market.load.beginLoad()
    spineLoader()
    applyDefaultStyle2Canvas()
  }
}

// The GPU clamps the WebGL drawing buffer to a max dimension (often 4096-16384
// device px, and on some drivers ~5768). If the canvas is sized beyond that,
// spine still renders into the requested coordinate space but only the bottom
// portion is composited, so the head gets cropped while the feet stay anchored.
// We detect the real limit by probing an offscreen canvas' drawing buffer
// (gl.drawingBufferWidth), cap the canvas to it, and compensate with a larger
// transform scale so the on-screen size and sharpness stay the same.
let maxCanvasDimension = 0

// Measures the maximum drawing-buffer dimension (device px) the GPU will
// actually allocate. We probe with `desiredDevice` (the exact size we'd use),
// because requesting more than the limit is what triggers the clamp. The
// buffer is then allocated at the GPU max and drawingBufferWidth reports that
// max. We use a throwaway offscreen context (the clamp is a GPU/driver
// property, identical across contexts) so the live spine canvas is never
// touched. The probe context is released afterwards to avoid exhausting the
// browser's WebGL context pool on repeated resizes.
const measureBufferLimit = (desiredDevice: number): number => {
  const probe = Math.max(256, Math.round(desiredDevice))
  if (maxCanvasDimension > 0 && probe <= maxCanvasDimension) return maxCanvasDimension
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null
  try {
    const tmp = document.createElement('canvas')
    gl = (tmp.getContext('webgl2') ||
      tmp.getContext('webgl') ||
      tmp.getContext('experimental-webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null
    if (!gl) {
      maxCanvasDimension = Math.max(maxCanvasDimension, 4096)
      return maxCanvasDimension
    }
    tmp.width = probe
    tmp.height = probe
    const w = gl.drawingBufferWidth || 0
    const h = gl.drawingBufferHeight || 0
    if (w > 0 && w < probe) {
      // Clamped: the GPU capped us, so min(w,h) is the real maximum.
      maxCanvasDimension = Math.min(w, h)
    } else {
      // Not clamped at this size; we never need more than `probe`, so treat it
      // as effectively unlimited.
      maxCanvasDimension = probe
    }
  } catch (_) {
    maxCanvasDimension = Math.max(maxCanvasDimension, 4096)
  } finally {
    try {
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch (_) { /* ignore */ }
  }
  return maxCanvasDimension
}

const applyDefaultStyle2Canvas = () => {
  setTimeout(() => {
    canvas = document.querySelector('.spine-player-canvas') as HTMLCanvasElement

    if (!canvas) {
      return
    }

    canvas.width = canvas.height

    // The canvas is the actual touch gesture target; touch-action is NOT inherited.
    canvas.style.touchAction = 'none'

    if (checkMobile()) {
      setCanvasStyleMobile()
    } else {
      const isHQ = market.live2d.HQassets
      const desiredVh = isHQ ? 450 : 168
      const baseScale = isHQ ? 0.18 : 0.5
      const dpr = window.devicePixelRatio || 1
      const desiredDevice = Math.round((desiredVh * window.innerHeight) / 100 * dpr)
      const limit = measureBufferLimit(desiredDevice)
      let cappedVh = desiredVh
      if (desiredDevice > limit) {
        cappedVh = (limit / dpr / window.innerHeight) * 100
      }
      const scale = baseScale * (desiredVh / cappedVh)

      canvas.style.height = cappedVh + 'vh'
      canvas.style.marginTop = 'calc(' + (54 - cappedVh / 2) + 'vh)'
      canvas.style.position = 'absolute'
      canvas.style.left = '0px'
      canvas.style.top = '0px'
      setTransformScale(scale)
      market.globalParams.showMobileHeader()
      centerCanvas()
    }
  }, 50)
}

const setCanvasStyleMobile = () => {
  if (!canvas) return
  canvas.style.marginTop = ''
  canvas.style.marginLeft = ''
  canvas.style.transformOrigin = ''

  if (market.route.name === 'story-gen') {
    const isCompact = market.globalParams.isMobileCompact
    if (isCompact) {
      // Compact mode: slightly larger scale for better visibility on phones
      canvas.style.height = '70vh'
      canvas.style.width = 'auto'
      canvas.style.position = 'absolute'
      canvas.style.top = '0px'
      setTransformScale(0.85)
    } else {
      canvas.style.height = '70vh'
      canvas.style.width = 'auto'
      canvas.style.position = 'absolute'
      canvas.style.top = '0px'
      setTransformScale(0.7)
    }
    centerCanvas()
  } else {
    // L2D (visualiser) - use production behavior
    // Must be positioned (absolute) or left/top are ignored and drag does nothing.
    canvas.style.height = '90vh'
    canvas.style.width = '100%'
    canvas.style.position = 'absolute'
    canvas.style.top = '0px'
    canvas.style.left = '0px'
    setTransformScale(1)
    centerCanvas()
  }
  market.globalParams.hideMobileHeader()
}

const checkMobile = () => {
  return market.globalParams.isMobile ? true : false
}

const centerCanvas = () => {
  const canvas_width = canvas ? canvas.offsetWidth : 0
  const canvas_height = canvas ? canvas.offsetHeight : 0
  const viewport_width = window.innerWidth
  const viewport_height = window.innerHeight

  // Center the element box (the scaled visual content stays centered
  // because transform: scale() scales from the element's center by default).
  canvas && (canvas.style.left = (viewport_width - canvas_width) / 2 + 'px')

  // On mobile story-gen, also center vertically so the character isn't anchored to the top edge
  if (checkMobile() && market.route.name === 'story-gen' && canvas) {
    canvas.style.top = (viewport_height - canvas_height) / 2 + 'px'
  }
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

const MIN_SCALE = 0.05
const MAX_SCALE = 5
const ZOOM_FACTOR = 1.15
const ZOOM_SMOOTHING = 0.15

let transformScale = 0.5
let targetScale = 0.5
let zoomFrameId: number | null = null
let anchorX = 0
let anchorY = 0
let anchorMarginTop = 0
let anchorScreenX = 0
let anchorScreenY = 0

const clampScale = (value: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, value))

const setTransformScale = (value: number) => {
  transformScale = clampScale(value)
  targetScale = transformScale
  if (canvas) canvas.style.transform = 'scale(' + transformScale + ')'
}

// Capture the canvas-local point currently under the anchor screen position
// (the mouse cursor while dragging, otherwise the screen center) so that
// zooming keeps that point fixed on screen even after the canvas is dragged.
const captureAnchor = (screenX?: number, screenY?: number) => {
  if (!canvas) return
  const style = getComputedStyle(canvas)
  const left = parseFloat(style.left) || 0
  const top = parseFloat(style.top) || 0
  const marginTop = parseFloat(style.marginTop) || 0
  const width = canvas.offsetWidth
  const height = canvas.offsetHeight
  if (!width || !height) return
  const sw = window.innerWidth
  const sh = window.innerHeight
  // While dragging, anchor to the mouse/finger cursor; otherwise to the screen
  // center. Pinch passes an explicit midpoint so the zoom stays under the fingers.
  anchorScreenX = screenX !== undefined ? screenX : (move && oldX !== undefined ? oldX : sw / 2)
  anchorScreenY = screenY !== undefined ? screenY : (move && oldY !== undefined ? oldY : sh / 2)
  const visualLeft = left
  const visualTop = top + marginTop
  anchorX = width / 2 + (anchorScreenX - visualLeft - width / 2) / transformScale
  anchorY = height / 2 + (anchorScreenY - visualTop - height / 2) / transformScale
  anchorMarginTop = marginTop
}

const applyScaleWithAnchor = (scale: number) => {
  if (!canvas) return
  const width = canvas.offsetWidth
  const height = canvas.offsetHeight
  if (!width || !height) {
    canvas.style.transform = 'scale(' + scale + ')'
    return
  }
  const newVisualLeft = anchorScreenX - width / 2 - (anchorX - width / 2) * scale
  const newVisualTop = anchorScreenY - height / 2 - (anchorY - height / 2) * scale
  canvas.style.left = newVisualLeft + 'px'
  canvas.style.top = (newVisualTop - anchorMarginTop) + 'px'
  canvas.style.transform = 'scale(' + scale + ')'
}

const startZoomSmoothing = () => {
  if (zoomFrameId !== null) return
  zoomFrameId = requestAnimationFrame(zoomSmoothingStep)
}

const zoomSmoothingStep = () => {
  // Re-capture the anchor each frame so that any drag performed while the
  // zoom animation is running is preserved instead of being overwritten.
  captureAnchor()
  const diff = targetScale - transformScale
  if (Math.abs(diff) < 0.0005) {
    transformScale = targetScale
    zoomFrameId = null
  } else {
    transformScale += diff * ZOOM_SMOOTHING
    zoomFrameId = requestAnimationFrame(zoomSmoothingStep)
  }
  applyScaleWithAnchor(transformScale)
}

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
// color.a === 0: Null the slot so hit-testing naturally skips it.
// color.a  > 0: Restore if the slot was nulled.
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
  stopHoverCycle()
}, { flush: 'sync' })

watch(() => market.live2d.resetSelectedLayers, () => {
  stopHoverCycle()
}, { flush: 'sync' })

watch(() => market.live2d.resetAllLayers, () => {
  stopHoverCycle()
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
  if (!val) stopHoverCycle()
})

// Click-to-select hit testing and hover preview.
// Loader owns only the temporary hover color cycle for the attachment under the cursor
// Selected-layer cycling is handled by AttachmentEditorListItem.

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
    } catch (_) {
      // ignore hit-test errors for this attachment
    }
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
  touch-action: none;
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
