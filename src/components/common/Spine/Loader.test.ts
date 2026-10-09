import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Loader from './Loader.vue'
import { useMarket } from '@/stores/market'

vi.mock('@/utils/spine/spine-player4.0', () => ({ default: {} }))
vi.mock('@/utils/spine/spine-player4.1', () => ({ default: {} }))
vi.mock('@/stores/market', () => ({ useMarket: vi.fn() }))

describe('Spine screenshot downloads', () => {
  let wrapper: VueWrapper | undefined
  let screenshot: { width: number; height: number } | undefined
  let downloaded: { href: string; filename: string; connected: boolean } | undefined
  const createObjectURL = vi.fn<[Blob], string>(() => 'blob:screenshot')
  const revokeObjectURL = vi.fn()
  const market = reactive({
    route: { name: 'visualiser' },
    load: { beginLoad: vi.fn() },
    globalParams: {
      isMobile: false,
      showMobileHeader: vi.fn(),
      hideMobileHeader: vi.fn()
    },
    live2d: {
      current_id: '',
      current_pose: 'fb',
      isVisible: true,
      isExportingAnimation: false,
      HQassets: false,
      resetPlacement: 0,
      screenshot: 0
    }
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    screenshot = undefined
    downloaded = undefined
    market.live2d.HQassets = false
    market.globalParams.isMobile = false
    market.route.name = 'visualiser'
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => '3000') })
    vi.stubGlobal('DOMMatrixReadOnly', class { a = 1 })
    vi.mocked(useMarket).mockReturnValue(market as unknown as ReturnType<typeof useMarket>)
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      clearRect: vi.fn()
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback) {
      screenshot = { width: this.width, height: this.height }
      callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = { href: this.href, filename: this.download, connected: this.isConnected }
    })
    wrapper = mount(Loader, { attachTo: document.body })
    const container = wrapper.get('#player-container').element
    const renderCanvas = document.createElement('canvas')
    renderCanvas.className = 'spine-player-canvas'
    const presentationCanvas = document.createElement('canvas')
    presentationCanvas.className = 'spine-presentation-canvas'
    presentationCanvas.width = 400
    presentationCanvas.height = 800
    container.append(renderCanvas, presentationCanvas)
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([false, true])('uses an attached blob download on mobile=%s', async (isMobile) => {
    market.globalParams.isMobile = isMobile
    market.live2d.HQassets = true
    await nextTick()
    vi.advanceTimersByTime(50)
    market.live2d.screenshot++
    await nextTick()

    expect(screenshot?.width).toBe(1500)
    expect(screenshot?.height).toBe(3000)
    expect(downloaded).toEqual({
      href: 'blob:screenshot',
      filename: expect.stringMatching(/^NIKKE-DB__fb_\d+\.png$/),
      connected: true
    })
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(createObjectURL.mock.calls[0][0].type).toBe('image/png')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:screenshot')
  })

  it('does not download an empty PNG when encoding fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null))
    market.live2d.HQassets = true
    await nextTick()
    vi.advanceTimersByTime(50)
    market.live2d.screenshot++
    await nextTick()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(downloaded).toBeUndefined()
    expect(console.error).toHaveBeenCalledOnce()
  })

  it('serializes captures while PNG encoding is pending', async () => {
    let encode: BlobCallback | undefined
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => { encode = callback })
    market.live2d.HQassets = true
    await nextTick()
    vi.advanceTimersByTime(50)
    market.live2d.screenshot++
    await nextTick()
    market.live2d.screenshot++
    await nextTick()
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledOnce()
    encode!(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    await nextTick()
    expect(downloaded?.href).toBe('blob:screenshot')
  })

  it('does not download a PNG that finishes encoding after unmount', async () => {
    let encode: BlobCallback | undefined
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => { encode = callback })
    market.live2d.HQassets = true
    await nextTick()
    vi.advanceTimersByTime(50)
    market.live2d.screenshot++
    await nextTick()
    wrapper!.unmount()
    wrapper = undefined
    encode!(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    await nextTick()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(downloaded).toBeUndefined()
  })

  const bindCamera = async () => {
    market.live2d.HQassets = true
    await nextTick()
    vi.advanceTimersByTime(50)
    const setup = (wrapper!.vm.$ as unknown as { setupState: Record<string, any> }).setupState
    const player = {
      __cameraBaseZoom: 5,
      __cameraZoomFactor: 1,
      __cameraPositionOffset: { x: 0, y: 0 },
      __cameraScreenOffset: { x: 0, y: 0 },
      sceneRenderer: { camera: { viewportWidth: 3200, viewportHeight: 1800, zoom: 5 } },
      dispose: vi.fn()
    }
    setup.spinePlayer = player
    vi.spyOn(setup.canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 1280, height: 720
    })
    return { setup, player }
  }

  it('pans in presentation pixels rather than backing pixels', async () => {
    const { setup, player } = await bindCamera()
    setup.moveCameraByScreenDelta(100, 100)
    expect(player.__cameraPositionOffset).toEqual({ x: -1250, y: 1250 })
  })

  it('pans at the pending logical zoom before the next rendered frame', async () => {
    const { setup, player } = await bindCamera()
    player.__cameraZoomFactor = 0.5
    setup.moveCameraByScreenDelta(100, 100)
    expect(player.__cameraPositionOffset).toEqual({ x: -625, y: 625 })
  })

  it('renders at least the recording frame rate even with a low preview rate', async () => {
    const { setup, player } = await bindCamera()
    const draw = vi.fn<[boolean?], void>()
    const nativePlayer = Object.assign(player, { drawFrame: draw })
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    setup.setRenderFps(1)
    setup.applyRenderFpsLimiter(nativePlayer)
    nativePlayer.drawFrame(true)
    market.live2d.isExportingAnimation = true
    now += 34
    nativePlayer.drawFrame(true)
    expect(draw).toHaveBeenCalledTimes(2)
    market.live2d.isExportingAnimation = false
  })

  it('does not present the cleared backing bitmap when a render is skipped', async () => {
    const { setup, player } = await bindCamera()
    const renderCanvas = wrapper!.get('.spine-player-canvas').element
    const nativePlayer = Object.assign(player, {
      canvas: renderCanvas,
      dom: renderCanvas.parentElement,
      __renderFrameVersion: 1,
      drawFrame: vi.fn<[boolean?], void>()
    })
    setup.applyPresentationCanvas(nativePlayer)
    const context = setup.canvas.getContext('2d')
    vi.mocked(context.drawImage).mockClear()
    nativePlayer.drawFrame(false)
    expect(context.drawImage).toHaveBeenCalledOnce()
    // Restoring screenshot dimensions clears the WebGL buffer before the next live frame.
    nativePlayer.drawFrame(true)
    expect(context.drawImage).toHaveBeenCalledOnce()
    nativePlayer.__renderFrameVersion++
    nativePlayer.drawFrame(true)
    expect(context.drawImage).toHaveBeenCalledTimes(2)
  })

  it('keeps zoom anchored even when rendering is slower than gestures', async () => {
    const { setup, player } = await bindCamera()
    setup.captureAnchor(940, 400)
    setup.cameraZoomAnchorActive = true
    setup.setZoomLevel(2)
    setup.setZoomLevel(4)
    // The camera zoom still belongs to the frame before both gestures.
    expect(player.sceneRenderer.camera.zoom).toBe(5)
    expect(player.__cameraPositionOffset.x).toBeCloseTo(2812.5)
    expect(player.__cameraPositionOffset.y).toBeCloseTo(-375)
  })

  it('resets the mobile Story Generator camera before the next pinch', async () => {
    const { setup, player } = await bindCamera()
    market.route.name = 'story-gen'
    market.globalParams.isMobile = true
    setup.zoomLevel = setup.targetZoom = 2
    player.__cameraZoomFactor = 0.5
    market.live2d.resetPlacement++
    await nextTick()
    vi.advanceTimersByTime(50)
    expect(setup.zoomLevel).toBe(1)
    expect(setup.targetZoom).toBe(1)
    expect(player.__cameraZoomFactor).toBe(1)
    setup.setZoomLevel(1.05)
    expect(player.__cameraZoomFactor).toBeCloseTo(1 / 1.05)
  })
})
