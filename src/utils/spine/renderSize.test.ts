import { describe, expect, it } from 'vitest'
import { boundRenderSize, drawSquareFrame, fitRenderSize, MAX_LIVE_PIXELS } from './renderSize'

const MAX_SIDE = 16384
const BROWSER_MAX_PIXELS = 7680 * 4320

describe('fitRenderSize', () => {
  it('keeps a size that already fits', () => {
    expect(fitRenderSize({ width: 1920, height: 1080 }, MAX_LIVE_PIXELS, MAX_SIDE)).toEqual({ width: 1920, height: 1080 })
  })

  it('shrinks a 4K HQ canvas to the pixel budget and keeps it square', () => {
    const size = fitRenderSize({ width: 9720, height: 9720 }, MAX_LIVE_PIXELS, MAX_SIDE)

    expect(size.width).toBe(size.height)
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_LIVE_PIXELS)
    expect(size.width).toBeGreaterThanOrEqual(4095)
  })

  it('keeps the aspect ratio of a wide canvas', () => {
    const size = fitRenderSize({ width: 16000, height: 4000 }, MAX_LIVE_PIXELS, MAX_SIDE)

    expect(size.width / size.height).toBeCloseTo(4, 2)
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_LIVE_PIXELS)
  })

  it('never makes a side longer than the GPU limit', () => {
    const size = fitRenderSize({ width: 20000, height: 100 }, Infinity, 8192)

    expect(size).toEqual({ width: 8192, height: 40 })
  })

  it('returns at least one pixel for a hidden canvas', () => {
    expect(fitRenderSize({ width: 0, height: 0 }, MAX_LIVE_PIXELS, MAX_SIDE)).toEqual({ width: 1, height: 1 })
  })
})

const createFakePlayer = (clientWidth: number, clientHeight: number) => {
  const canvas = { clientWidth, clientHeight, width: 300, height: 150 }
  const viewports: number[][] = []
  const cameraViewports: number[][] = []

  const grantedScale = () => Math.min(1, Math.sqrt(BROWSER_MAX_PIXELS / (canvas.width * canvas.height)))

  const gl = {
    MAX_RENDERBUFFER_SIZE: 1,
    MAX_VIEWPORT_DIMS: 2,
    getParameter: (name: number) => (name === 1 ? MAX_SIDE : [MAX_SIDE, MAX_SIDE]),
    viewport: (...box: number[]) => viewports.push(box),
    get drawingBufferWidth() {
      return Math.floor(canvas.width * grantedScale())
    },
    get drawingBufferHeight() {
      return Math.floor(canvas.height * grantedScale())
    }
  }

  const player: any = {
    canvas,
    context: { gl },
    sceneRenderer: {
      canvas,
      context: { gl },
      camera: {
        setViewport: (...size: number[]) => cameraViewports.push(size),
        update: () => {}
      }
    },
    drawnSizes: [] as number[][],
    drawFrame() {
      player.sceneRenderer.resize()
      player.drawnSizes.push([canvas.width, canvas.height])
    }
  }

  return { player, canvas, viewports, cameraViewports }
}

describe('boundRenderSize', () => {
  it('renders the 4K HQ canvas into a bounded buffer', () => {
    const { player, canvas, viewports, cameraViewports } = createFakePlayer(9720, 9720)

    boundRenderSize(player)
    player.sceneRenderer.resize()

    expect(canvas.width).toBe(canvas.height)
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(MAX_LIVE_PIXELS)
    expect(viewports.pop()).toEqual([0, 0, canvas.width, canvas.height])
    expect(cameraViewports.pop()).toEqual([canvas.width, canvas.height])
  })

  it('leaves a canvas that fits untouched', () => {
    const { player, canvas } = createFakePlayer(1814, 1814)

    boundRenderSize(player)
    player.sceneRenderer.resize()

    expect([canvas.width, canvas.height]).toEqual([1814, 1814])
  })
})

describe('drawSquareFrame', () => {
  it('draws the screenshot at the wanted size, above the live budget', () => {
    const { player } = createFakePlayer(9720, 9720)
    boundRenderSize(player)

    expect(drawSquareFrame(player, 5000)).toBe(5000)
    expect(player.drawnSizes).toEqual([[5000, 5000]])
  })

  it('redraws at the size the browser granted', () => {
    const { player } = createFakePlayer(9720, 9720)
    boundRenderSize(player)

    expect(drawSquareFrame(player, 9999)).toBe(5760)
    expect(player.drawnSizes).toEqual([[9999, 9999], [5760, 5760]])
  })

  it('goes back to the live size on the next frame', () => {
    const { player, canvas } = createFakePlayer(1814, 1814)
    boundRenderSize(player)

    drawSquareFrame(player, 3000)
    player.sceneRenderer.resize()

    expect([canvas.width, canvas.height]).toEqual([1814, 1814])
  })
})
