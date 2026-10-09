import { Blob as NodeBlob } from 'node:buffer'
import * as webStreams from 'node:stream/web'
import { inflateSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderTiledPngScreenshot, renderTiledScreenshot } from './screenshot'
// @ts-expect-error The vendored runtime has no TypeScript declarations.
import spine40 from './spine-player4.0'
// @ts-expect-error The vendored runtime has no TypeScript declarations.
import spine41 from './spine-player4.1'

const NodeCompressionStream = (webStreams as unknown as { CompressionStream: typeof CompressionStream }).CompressionStream

type Bounds = { x: number; y: number; width: number; height: number }
type Tile = { x: number; y: number; zoom: number; width: number; height: number }

function setup(bounds: Bounds = { x: -100, y: -50, width: 500, height: 1000 }) {
  const source = document.createElement('canvas')
  source.width = 2400
  source.height = 1800
  source.style.cssText = 'width: 1200px; height: 900px; position: absolute; left: -100000px;'
  const gl: any = {}
  const keys = ['MAX_VIEWPORT_DIMS', 'MAX_TEXTURE_SIZE', 'MAX_RENDERBUFFER_SIZE', 'VIEWPORT', 'COLOR_CLEAR_VALUE',
    'COLOR_WRITEMASK', 'FRAMEBUFFER_BINDING', 'CURRENT_PROGRAM', 'ARRAY_BUFFER_BINDING', 'ELEMENT_ARRAY_BUFFER_BINDING',
    'ACTIVE_TEXTURE', 'BLEND_SRC_RGB', 'BLEND_DST_RGB', 'BLEND_SRC_ALPHA', 'BLEND_DST_ALPHA', 'BLEND', 'CULL_FACE',
    'SCISSOR_TEST', 'DEPTH_TEST', 'STENCIL_TEST', 'TEXTURE0', 'TEXTURE_BINDING_2D', 'MAX_VERTEX_ATTRIBS', 'FRAMEBUFFER',
    'ARRAY_BUFFER', 'ELEMENT_ARRAY_BUFFER', 'TEXTURE_2D', 'COLOR_BUFFER_BIT', 'ONE', 'ONE_MINUS_SRC_ALPHA', 'SRC_ALPHA', 'DST_COLOR', 'ONE_MINUS_SRC_COLOR']
  keys.forEach((key, index) => { gl[key] = index + 1 })
  const state = new Map<number, any>([
    [gl.MAX_VIEWPORT_DIMS, [4096, 4096]], [gl.MAX_TEXTURE_SIZE, 4096], [gl.MAX_RENDERBUFFER_SIZE, 4096],
    [gl.VIEWPORT, [10, 20, 2300, 1600]], [gl.COLOR_CLEAR_VALUE, [0.2, 0.3, 0.4, 0.5]],
    [gl.COLOR_WRITEMASK, [false, true, false, true]], [gl.FRAMEBUFFER_BINDING, { name: 'framebuffer' }],
    [gl.CURRENT_PROGRAM, { name: 'program' }], [gl.ARRAY_BUFFER_BINDING, { name: 'vertices' }],
    [gl.ELEMENT_ARRAY_BUFFER_BINDING, { name: 'indices' }], [gl.ACTIVE_TEXTURE, gl.TEXTURE0 + 2],
    [gl.BLEND_SRC_RGB, 1], [gl.BLEND_DST_RGB, 2], [gl.BLEND_SRC_ALPHA, 3], [gl.BLEND_DST_ALPHA, 4],
    [gl.MAX_VERTEX_ATTRIBS, 0]
  ])
  const textures = new Map([[gl.TEXTURE0, { name: 'texture0' }], [gl.TEXTURE0 + 2, { name: 'texture2' }]])
  const enabled = new Set([gl.SCISSOR_TEST, gl.DEPTH_TEST, gl.CULL_FACE])
  const fixture = { failDrawAt: 0, failEndAt: 0, lostAt: 0, actualWidthLimit: 4096, actualHeightLimit: 4096 }
  Object.defineProperties(gl, {
    drawingBufferWidth: { get: () => Math.min(source.width, fixture.actualWidthLimit) },
    drawingBufferHeight: { get: () => Math.min(source.height, fixture.actualHeightLimit) }
  })
  const tiles: Tile[] = []
  gl.getParameter = vi.fn((key: number) => key === gl.TEXTURE_BINDING_2D ? textures.get(state.get(gl.ACTIVE_TEXTURE)) : state.get(key))
  gl.getExtension = vi.fn(() => null)
  gl.isContextLost = vi.fn(() => !!fixture.lostAt && tiles.length >= fixture.lostAt)
  gl.isEnabled = vi.fn((key: number) => enabled.has(key))
  gl.enable = vi.fn((key: number) => { enabled.add(key) })
  gl.disable = vi.fn((key: number) => { enabled.delete(key) })
  gl.activeTexture = vi.fn((unit: number) => { state.set(gl.ACTIVE_TEXTURE, unit) })
  gl.bindTexture = vi.fn((_: number, value: any) => { textures.set(state.get(gl.ACTIVE_TEXTURE), value) })
  gl.viewport = vi.fn((...values: number[]) => { state.set(gl.VIEWPORT, values) })
  gl.clearColor = vi.fn((...values: number[]) => { state.set(gl.COLOR_CLEAR_VALUE, values) })
  gl.colorMask = vi.fn((...values: boolean[]) => { state.set(gl.COLOR_WRITEMASK, values) })
  gl.bindFramebuffer = vi.fn((_: number, value: any) => { state.set(gl.FRAMEBUFFER_BINDING, value) })
  gl.useProgram = vi.fn((value: any) => { state.set(gl.CURRENT_PROGRAM, value) })
  gl.bindBuffer = vi.fn((key: number, value: any) => { state.set(key === gl.ARRAY_BUFFER ? gl.ARRAY_BUFFER_BINDING : gl.ELEMENT_ARRAY_BUFFER_BINDING, value) })
  gl.blendFuncSeparate = vi.fn((...values: number[]) => {
    ;[gl.BLEND_SRC_RGB, gl.BLEND_DST_RGB, gl.BLEND_SRC_ALPHA, gl.BLEND_DST_ALPHA].forEach((key, index) => { state.set(key, values[index]) })
  })
  gl.clear = vi.fn()
  const originalResource = { dispose: vi.fn() }
  const player: any = {
    context: { gl, restorables: [originalResource] },
    config: { premultipliedAlpha: true, frame: vi.fn(), update: vi.fn(), draw: vi.fn() },
    currentViewport: { ...bounds, padLeft: 0, padRight: 0, padTop: 0, padBottom: 0 },
    skeleton: {
      getBoundsRect: vi.fn(() => ({ ...bounds })),
      updateWorldTransform: vi.fn(), setToSetupPose: vi.fn(),
      bones: [{ worldX: 12, worldY: 23 }], slots: [{ deform: [1, 2], attachment: { name: 'body' } }]
    },
    animationState: { update: vi.fn(), apply: vi.fn(), tracks: [{ trackTime: 1.25 }] },
    drawFrame: vi.fn(), pause: vi.fn(), play: vi.fn(), setViewport: vi.fn(), setAnimation: vi.fn(),
    __cameraZoomFactor: 0.5, __cameraPositionOffset: { x: 12, y: 23 }, __cameraScreenOffset: { x: 5, y: 10 }
  }
  const resource = { dispose: vi.fn(() => { player.context.restorables = player.context.restorables.filter((entry: any) => entry !== resource) }) }
  const drawSkeleton = vi.fn()
  const clipEnd = vi.fn()
  const dispose = vi.fn(() => { resource.dispose() })
  class Renderer {
    camera = {
      position: { x: 0, y: 0, z: 0 }, zoom: 1, viewportWidth: 0, viewportHeight: 0,
      setViewport(width: number, height: number) { this.viewportWidth = width; this.viewportHeight = height }
    }
    skeletonRenderer = { clipper: { clipEnd } }
    batcher: any = {
      srcColorBlend: 5, dstBlend: 6,
      begin() { gl.blendFuncSeparate(5, 6, 7, 8) },
      setBlendMode() {}
    }
    constructor() { player.context.restorables.push(resource) }
    begin() {
      gl.useProgram({ name: 'exportProgram' })
      gl.bindBuffer(gl.ARRAY_BUFFER, { name: 'exportVertices' })
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, { name: 'exportIndices' })
      gl.enable(gl.BLEND)
      gl.disable(gl.CULL_FACE)
      this.batcher.begin()
    }
    drawSkeleton(skeleton: any, premultipliedAlpha: boolean) {
      drawSkeleton(skeleton, premultipliedAlpha)
      tiles.push({ x: this.camera.position.x, y: this.camera.position.y, zoom: this.camera.zoom, width: this.camera.viewportWidth, height: this.camera.viewportHeight })
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, { name: 'atlas' })
      if (fixture.failDrawAt === tiles.length) throw new Error('draw failed')
    }
    end() { if (fixture.failEndAt === tiles.length) throw new Error('flush failed') }
    dispose = dispose
  }
  player.sceneRenderer = {
    constructor: Renderer, twoColorTint: true,
    camera: { position: { x: 432, y: 765, z: 0 }, zoom: 0.75, viewportWidth: 2400, viewportHeight: 1800 }
  }
  const copies: number[][] = []
  const context = {
    imageSmoothingEnabled: true,
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn<[number, number, number, number], { data: Uint8ClampedArray }>(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    drawImage: vi.fn((canvas: HTMLCanvasElement, ...args: number[]) => {
      expect(canvas).toBe(source)
      copies.push(args)
    })
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  const saved = {
    width: source.width, height: source.height, style: source.getAttribute('style'),
    camera: structuredClone(player.sceneRenderer.camera),
    state: new Map(state), enabled: new Set(enabled), textures: new Map(textures)
  }
  const mutableState = (values: Map<number, any>) => new Map([...values].filter(([key]) =>
    ![gl.MAX_VIEWPORT_DIMS, gl.MAX_TEXTURE_SIZE, gl.MAX_RENDERBUFFER_SIZE, gl.MAX_VERTEX_ATTRIBS].includes(key)))
  const assertRestored = () => {
    expect(source.width).toBe(saved.width)
    expect(source.height).toBe(saved.height)
    expect(source.getAttribute('style')).toBe(saved.style)
    expect(player.sceneRenderer.camera).toEqual(saved.camera)
    expect(mutableState(state)).toEqual(mutableState(saved.state))
    expect(enabled).toEqual(saved.enabled)
    expect(textures).toEqual(saved.textures)
    expect(player.context.restorables).toEqual([originalResource])
    expect(originalResource.dispose).not.toHaveBeenCalled()
  }
  return { ...fixture, fixture, player, source, gl, state, saved, tiles, copies, context, drawSkeleton, resource, dispose, clipEnd, assertRestored }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function framebufferReadback(f: ReturnType<typeof setup>, read?: (width: number, height: number, index: number, pixels: Uint8Array) => void) {
  const keys = ['PACK_ALIGNMENT', 'DITHER', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T',
    'NEAREST', 'CLAMP_TO_EDGE', 'RGBA', 'UNSIGNED_BYTE', 'COLOR_ATTACHMENT0', 'FRAMEBUFFER_COMPLETE']
  keys.forEach((key, index) => { f.gl[key] = index + 100 })
  f.state.set(f.gl.PACK_ALIGNMENT, 8)
  f.saved.state.set(f.gl.PACK_ALIGNMENT, 8)
  f.gl.enable(f.gl.DITHER)
  f.saved.enabled.add(f.gl.DITHER)
  const reads: { width: number; height: number; buffer: ArrayBufferLike }[] = []
  const framebuffer = { name: 'exportFramebuffer' }
  const texture = { name: 'exportTexture' }
  f.gl.createFramebuffer = vi.fn(() => framebuffer)
  f.gl.createTexture = vi.fn(() => texture)
  f.gl.deleteFramebuffer = vi.fn()
  f.gl.deleteTexture = vi.fn()
  f.gl.texParameteri = vi.fn()
  f.gl.texImage2D = vi.fn()
  f.gl.framebufferTexture2D = vi.fn()
  f.gl.checkFramebufferStatus = vi.fn(() => f.gl.FRAMEBUFFER_COMPLETE)
  f.gl.pixelStorei = vi.fn((key: number, value: number) => { f.state.set(key, value) })
  f.gl.readPixels = vi.fn((x: number, y: number, width: number, height: number, format: number, type: number, pixels: Uint8Array) => {
    expect([x, y]).toEqual([2, 2])
    expect([format, type]).toEqual([f.gl.RGBA, f.gl.UNSIGNED_BYTE])
    expect(pixels.length).toBe(width * height * 4)
    expect(f.state.get(f.gl.FRAMEBUFFER_BINDING)).toBe(framebuffer)
    pixels.fill(0)
    reads.push({ width, height, buffer: pixels.buffer })
    read?.(width, height, reads.length - 1, pixels)
  })
  return reads
}

async function pngData(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  const idat: Uint8Array[] = []
  for (let offset = 8; offset < bytes.length;) {
    const length = view.getUint32(offset)
    if (String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)) === 'IDAT') idat.push(bytes.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const filtered = inflateSync(Buffer.concat(idat))
  return { width, height, filtered }
}

function setupRealBatcher(runtime: any, modes: number[][]) {
  const f = setup({ x: 0, y: 0, width: 2041, height: 129 })
  const gl = f.gl
  Object.assign(gl, { ONE: 1, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771, DST_COLOR: 774, ONE_MINUS_SRC_COLOR: 769 })
  const blend = () => [gl.BLEND_SRC_RGB, gl.BLEND_DST_RGB, gl.BLEND_SRC_ALPHA, gl.BLEND_DST_ALPHA].map((key) => f.state.get(key))
  const begins: number[][] = []
  const flushes: number[][] = []
  const pixels: number[][] = []
  const events: { type: string; blend: number[] }[] = []
  const originalBlend = gl.blendFuncSeparate
  gl.blendFuncSeparate = vi.fn((...values: number[]) => {
    events.push({ type: 'blend', blend: values })
    originalBlend(...values)
  })
  const prototype = runtime.PolygonBatcher.prototype
  const originalMethods = [prototype.begin, prototype.setBlendMode]
  const nativeBatcher = Object.create(prototype)
  f.player.sceneRenderer.batcher = nativeBatcher
  let batcher: any
  let red = 0
  let alpha = 0
  const BaseRenderer = f.player.sceneRenderer.constructor
  f.player.sceneRenderer.constructor = class extends BaseRenderer {
    constructor() {
      super()
      this.batcher = batcher = Object.assign(Object.create(prototype), {
        context: f.player.context, isDrawing: false, verticesLength: 0, indicesLength: 0,
        srcColorBlend: gl.SRC_ALPHA, srcAlphaBlend: gl.ONE, dstBlend: gl.ONE_MINUS_SRC_ALPHA,
        flush() {
          if (!this.verticesLength) return
          const factors = blend()
          flushes.push(factors)
          events.push({ type: 'flush', blend: factors })
          const factor = (value: number) => value === gl.ONE ? 1 : value === gl.DST_COLOR ? red :
            value === gl.ONE_MINUS_SRC_COLOR ? 0.75 : 0.5
          for (let index = 0; index < this.verticesLength; index++) {
            red = 0.25 * factor(factors[0]) + red * factor(factors[1])
            alpha = 0.5 * factor(factors[2]) + alpha * factor(factors[3])
          }
          this.verticesLength = this.indicesLength = 0
        }
      })
    }
    begin() {
      red = alpha = 0
      super.begin()
      begins.push(blend())
    }
    end() {
      super.end()
      this.batcher.end()
      pixels.push([red, alpha])
    }
  }
  f.drawSkeleton.mockImplementation(() => {
    for (const [src, dst] of modes) {
      batcher.setBlendMode(src, gl.ONE, dst)
      expect(blend()).toEqual([src, dst, gl.ONE, gl.ONE_MINUS_SRC_ALPHA])
      batcher.verticesLength++
    }
  })
  framebufferReadback(f, (width, height, _, output) => {
    for (let pixel = 0; pixel < width * height; pixel++) output.set([Math.round(red * 255), 0, 0, Math.round(alpha * 255)], pixel * 4)
  })
  return { ...f, begins, flushes, pixels, events, originalMethods, prototype, nativeBatcher }
}

describe.each([['4.0', spine40], ['4.1', spine41]])('Spine %s export-only alpha coverage', (_, runtime) => {
  beforeEach(() => {
    vi.stubGlobal('CompressionStream', NodeCompressionStream)
    vi.stubGlobal('Blob', NodeBlob)
  })

  it.each(['sync', 'async'])('keeps repeated normal PMA tiles at 0.75 overlap alpha in %s exports', async (path) => {
    const f = setupRealBatcher(runtime, [[1, 771], [1, 771]])
    if (path === 'sync') renderTiledScreenshot(f.player, f.source, 2041)
    else {
      const png = await pngData(await renderTiledPngScreenshot(f.player, f.source, 2041))
      for (let row = 0; row < png.height; row++) {
        const offset = row * (png.width * 4 + 1)
        expect([...png.filtered.subarray(offset + 1, offset + 5)]).toEqual([128, 0, 0, 191])
        expect(png.filtered.subarray(offset + 5, offset + png.width * 4 + 1).every((value) => value === 0)).toBe(true)
      }
    }
    expect(f.pixels.length).toBeGreaterThan(1)
    expect(f.pixels.every(([red, alpha]) => red === 0.375 && alpha === 0.75 && red / alpha === 0.5)).toBe(true)
    expect(f.begins.every((values) => values[2] === 1 && values[3] === 771)).toBe(true)
    expect(f.flushes).toEqual(f.pixels.map(() => [1, 771, 1, 771]))
    expect([f.prototype.begin, f.prototype.setBlendMode]).toEqual(f.originalMethods)
    expect(f.player.sceneRenderer.batcher).toBe(f.nativeBatcher)
    expect(f.nativeBatcher.setBlendMode).toBe(f.originalMethods[1])
    f.assertRestored()
  })

  it.each(['sync', 'async'])('normalizes the no-mode-change straight-alpha path in %s exports', async (path) => {
    const f = setupRealBatcher(runtime, [[770, 771], [770, 771]])
    if (path === 'sync') renderTiledScreenshot(f.player, f.source, 2041)
    else await renderTiledPngScreenshot(f.player, f.source, 2041)
    expect(f.pixels.length).toBeGreaterThan(1)
    expect(f.pixels.every(([, alpha]) => alpha === 0.75)).toBe(true)
    expect(f.flushes.every((values) => values.join(',') === '770,771,1,771')).toBe(true)
    f.assertRestored()
  })

  it.each(['sync', 'async'])('preserves RGB modes, flush order and additive begin coverage in %s exports', async (path) => {
    const modes = [[1, 771], [1, 1], [774, 771], [1, 769], [1, 771], [1, 1]]
    const f = setupRealBatcher(runtime, modes)
    if (path === 'sync') renderTiledScreenshot(f.player, f.source, 2041)
    else await renderTiledPngScreenshot(f.player, f.source, 2041)
    expect(f.pixels.length).toBeGreaterThan(1)
    expect(f.pixels.every(([, alpha]) => alpha === 1 - 0.5 ** modes.length)).toBe(true)
    expect(f.begins[0]).toEqual([770, 771, 1, 771])
    expect(f.begins.slice(1)).toEqual(f.pixels.slice(1).map(() => [1, 1, 1, 771]))
    expect(f.flushes).toEqual(f.pixels.flatMap(() => modes.map(([src, dst]) => [src, dst, 1, 771])))
    for (let index = 0; index < f.events.length; index++) {
      const event = f.events[index]
      if (event.type !== 'flush') continue
      expect(f.events[index - 1]).toEqual({ type: 'blend', blend: event.blend })
      const next = f.events[index + 1]
      if (next?.type === 'blend') {
        // Flush the previous RGB mode before changing the alpha destination.
        if (next.blend[3] === 1) expect(f.events[index + 2].blend.slice(2)).toEqual([1, 771])
      }
    }
    f.assertRestored()
  })
})

describe('memory-bounded tiled PNG screenshots', () => {
  beforeEach(() => {
    vi.stubGlobal('CompressionStream', NodeCompressionStream)
    vi.stubGlobal('Blob', NodeBlob)
  })

  it('renders exact native bands covering the full portrait with a partial last band', async () => {
    const f = setup({ x: -123, y: 91, width: 101, height: 307 })
    const reads = framebufferReadback(f)
    const blob = await renderTiledPngScreenshot(f.player, f.source, 4097)
    const png = await pngData(blob)
    expect([png.width, png.height]).toEqual([1348, 4097])
    expect(reads).toHaveLength(66)
    expect(reads.slice(0, -2).every((read) => read.height === 128)).toBe(true)
    expect(reads[reads.length - 1].height).toBe(1)
    expect(reads.reduce((area, read) => area + read.width * read.height, 0)).toBe(1348 * 4097)
    expect(f.copies).toHaveLength(0)
    const q = Math.max(101 / 1348, 307 / 4097)
    const exportTop = 91 + (307 + 4097 * q) / 2
    for (let index = 0; index < f.tiles.length; index++) {
      const tile = f.tiles[index]
      const row = Math.floor(index / 2) * 128
      const { width, height } = reads[index]
      expect([tile.width, tile.height]).toEqual([width + 4, height + 4])
      expect(tile.zoom).toBe(q)
      expect(tile.y).toBeCloseTo(exportTop - (row + height / 2) * q, 10)
    }
    f.assertRestored()
  })

  it('caps the longest side at 16384 without allocating a full-height landscape canvas', async () => {
    const f = setup({ x: 0, y: 0, width: 16384, height: 257 })
    const reads = framebufferReadback(f)
    const widthSetter = vi.spyOn(f.source, 'width', 'set')
    const heightSetter = vi.spyOn(f.source, 'height', 'set')
    const png = await pngData(await renderTiledPngScreenshot(f.player, f.source, 99999))
    expect([png.width, png.height]).toEqual([16384, 257])
    expect(reads).toHaveLength(51)
    expect(reads.reduce((area, read) => area + read.width * read.height, 0)).toBe(16384 * 257)
    expect(new Set(reads.map((read) => read.buffer)).size).toBe(1)
    expect(f.gl.createFramebuffer).toHaveBeenCalledOnce()
    expect(f.gl.createTexture).toHaveBeenCalledOnce()
    expect(f.gl.texImage2D).toHaveBeenCalledOnce()
    expect(f.gl.texImage2D).toHaveBeenCalledWith(f.gl.TEXTURE_2D, 0, f.gl.RGBA, 1024, 132, 0, f.gl.RGBA, f.gl.UNSIGNED_BYTE, null)
    expect(f.dispose).toHaveBeenCalledOnce()
    expect(widthSetter).not.toHaveBeenCalled()
    expect(heightSetter).not.toHaveBeenCalled()
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled()
    f.assertRestored()
  })

  it.each([[1, 100000], [2, 10000]])('preserves narrow %spx output below the synchronous minimum-size clamp', async (width, worldHeight) => {
    const f = setup({ x: 0, y: 0, width: 1, height: worldHeight })
    const reads = framebufferReadback(f)
    const png = await pngData(await renderTiledPngScreenshot(f.player, f.source, 16384))
    expect([png.width, png.height]).toEqual([width, 16384])
    expect(reads).toHaveLength(128)
    expect(reads.every((read) => read.width === width && read.height === 128)).toBe(true)
    expect(f.tiles.every((tile) => tile.width === width + 4)).toBe(true)
    f.assertRestored()
  })

  it('freezes bones, weighted references, slots, deforms, attachments, sequences and draw order before awaits', async () => {
    const f = setup({ x: 0, y: 0, width: 10, height: 20 })
    class Bone { constructor(public worldX: number) {} }
    class Attachment {
      color = { r: 0.3, g: 0.4, b: 0.5, a: 0.6 }
      vertices = new Float32Array([1, 2, 3])
      uvs = new Float32Array([0.1, 0.2])
      sequence = { regions: [{ name: 'frame1' }, { name: 'frame2' }] }
      endSlot: any
    }
    class Slot {
      getAttachment() { return (this as any).attachment }
    }
    const first = Object.assign(new Bone(12), { a: 1, b: 0, c: 0, d: 1, skeleton: f.player.skeleton, children: [] as any[] })
    const second = Object.assign(new Bone(23), { skeleton: f.player.skeleton, parent: first, children: [] })
    first.children.push(second)
    const attachment = new Attachment()
    const slot = Object.assign(new Slot(), {
      bone: first, data: { index: 0, blendMode: 0 }, color: { r: 1, a: 1 }, darkColor: { r: 0.2 }, deform: [1, 2], attachment, sequenceIndex: 0
    })
    const endSlot = Object.assign(new Slot(), { bone: second, data: { index: 1 }, color: { a: 0.5 }, deform: [] })
    attachment.endSlot = endSlot.data
    Object.assign(f.player.skeleton, { bones: [first, second], slots: [slot, endSlot], drawOrder: [endSlot, slot], color: { r: 0.8, a: 1 } })
    let snapshot: any
    f.drawSkeleton.mockImplementation((skeleton) => {
      snapshot = skeleton
      expect(skeleton).not.toBe(f.player.skeleton)
      expect(skeleton.bones[0]).toBeInstanceOf(Bone)
      expect(skeleton.bones[0].worldX).toBe(12)
      expect(skeleton.bones[1].worldX).toBe(23)
      expect(skeleton.bones[0].children[0]).toBe(skeleton.bones[1])
      expect(skeleton.bones[1].parent).toBe(skeleton.bones[0])
      expect(skeleton.slots[0].bone.skeleton.bones[1]).toBe(skeleton.bones[1])
      expect(skeleton.slots[0]).toBeInstanceOf(Slot)
      expect(skeleton.slots[0].deform).toEqual([1, 2])
      expect(skeleton.slots[0].color.r).toBe(1)
      expect(skeleton.slots[0].darkColor.r).toBe(0.2)
      expect(skeleton.slots[0].attachment).toBeInstanceOf(Attachment)
      expect(skeleton.slots[0].attachment.color.r).toBe(0.3)
      expect(skeleton.slots[0].attachment.vertices[0]).toBe(1)
      expect(skeleton.slots[0].attachment.uvs[0]).toBeCloseTo(0.1)
      expect(skeleton.slots[0].attachment.sequence.regions[0].name).toBe('frame1')
      expect(skeleton.slots[0].attachment.endSlot).toBe(skeleton.slots[1].data)
      expect(skeleton.drawOrder).toEqual([skeleton.slots[1], skeleton.slots[0]])
      expect(skeleton.color.r).toBe(0.8)
    })
    const reads = framebufferReadback(f, () => {
      queueMicrotask(() => {
        first.worldX = 999
        second.worldX = 1000
        slot.deform[0] = 99
        slot.color.r = 0
        slot.darkColor.r = 0
        attachment.color.r = 0
        attachment.vertices[0] = 99
        attachment.uvs[0] = 0.9
        attachment.sequence.regions[0] = { name: 'changed' }
        f.player.skeleton.drawOrder.reverse()
        f.player.skeleton.color.r = 0
        f.player.currentViewport.height = 100000
      })
    })
    const png = await pngData(await renderTiledPngScreenshot(f.player, f.source, 512))
    expect([png.width, png.height]).toEqual([256, 512])
    expect(reads).toHaveLength(4)
    expect(snapshot.slots[0].attachment).not.toBe(attachment)
    expect(f.player.animationState.update).not.toHaveBeenCalled()
    expect(f.player.animationState.apply).not.toHaveBeenCalled()
    expect(f.player.skeleton.updateWorldTransform).not.toHaveBeenCalled()
    expect(f.player.drawFrame).not.toHaveBeenCalled()
    f.assertRestored()
  })

  it('reuses one framebuffer, renderer and CPU readback buffer across compression writes', async () => {
    const f = setup()
    const reads = framebufferReadback(f)
    let writes = 0
    vi.stubGlobal('CompressionStream', class {
      readable: any
      writable: any
      constructor() {
        const stream = new NodeCompressionStream('deflate')
        this.readable = stream.readable
        this.writable = { getWriter: () => {
          const writer = stream.writable.getWriter()
          return {
            closed: writer.closed,
            write: (value: Uint8Array) => {
              writes++
              expect(f.gl.createFramebuffer).toHaveBeenCalledOnce()
              expect(f.gl.createTexture).toHaveBeenCalledOnce()
              expect(value.length).toBeLessThanOrEqual((1500 * 4 + 1) * 128)
              return writer.write(value)
            },
            close: () => writer.close(), abort: (reason: any) => writer.abort(reason), releaseLock: () => writer.releaseLock()
          }
        } }
      }
    })
    await renderTiledPngScreenshot(f.player, f.source, 3000)
    expect(writes).toBe(24)
    expect(new Set(reads.map((read) => read.buffer)).size).toBe(1)
    expect(f.dispose).toHaveBeenCalledOnce()
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled()
  })

  it.each(['abort', 'dispose', 'error', 'context'])('stops between bands on %s and leaves GL restored', async (failure) => {
    const f = setup()
    const controller = new AbortController()
    const reads = framebufferReadback(f, () => {
      queueMicrotask(() => {
        if (failure === 'abort') controller.abort(new Error('capture cancelled'))
        if (failure === 'dispose') f.player.disposed = true
        if (failure === 'error') f.player.error = true
        if (failure === 'context') f.gl.isContextLost.mockReturnValue(true)
      })
    })
    await expect(renderTiledPngScreenshot(f.player, f.source, 3000, controller.signal)).rejects.toThrow()
    expect(reads).toHaveLength(2)
    expect(f.gl.deleteFramebuffer).toHaveBeenCalledOnce()
    expect(f.gl.deleteTexture).toHaveBeenCalledOnce()
    f.assertRestored()
  })

  it('releases the framebuffer and restores GL when pixel readback fails', async () => {
    const f = setup()
    framebufferReadback(f, () => {
      throw new Error('readback failed')
    })
    await expect(renderTiledPngScreenshot(f.player, f.source, 3000)).rejects.toThrow('readback failed')
    expect(f.gl.deleteFramebuffer).toHaveBeenCalledOnce()
    expect(f.gl.deleteTexture).toHaveBeenCalledOnce()
    f.assertRestored()
  })

  it('restores the initial GL state once without changing live camera or gesture hooks', async () => {
    const f = setup()
    let reads = 0
    framebufferReadback(f, () => {
      if (++reads === 1) queueMicrotask(() => {
        f.player.sceneRenderer.camera.zoom = 2
        f.player.__cameraPositionOffset.x = 42
      })
    })
    await renderTiledPngScreenshot(f.player, f.source, 512)
    expect(f.state.get(f.gl.VIEWPORT)).toEqual([10, 20, 2300, 1600])
    expect(f.player.sceneRenderer.camera.zoom).toBe(2)
    expect(f.player.__cameraPositionOffset.x).toBe(42)
    expect([f.source.width, f.source.height]).toEqual([2400, 1800])
  })

  it('fails explicitly without CompressionStream instead of allocating a full canvas or upscaling', async () => {
    const f = setup()
    const reads = framebufferReadback(f)
    vi.stubGlobal('CompressionStream', undefined)
    await expect(renderTiledPngScreenshot(f.player, f.source, 16384)).rejects.toThrow('CompressionStream support')
    expect(reads).toHaveLength(0)
    f.assertRestored()
  })

  it('flips readback rows, crops tile gutters and unpremultiplies alpha across tile and band boundaries', async () => {
    const f = setup({ x: 0, y: 0, width: 1025, height: 257 })
    framebufferReadback(f, (width, height, index, pixels) => {
      for (let row = 0; row < height; row++) {
        const y = Math.floor(index / 2) * 128 + height - row - 1
        for (let column = 0; column < width; column++) {
          const x = index % 2 * 1020 + column
          const color = x % 4 === 0 ? [30, 10, 5, 0] : x % 4 === 1 ? [64, 32, 16, 128] : x % 4 === 2 ? [y % 256, x % 256, 19, 255] : [1, 0, 0, 1]
          pixels.set(color, (row * width + column) * 4)
        }
      }
    })
    const png = await pngData(await renderTiledPngScreenshot(f.player, f.source, 1025))
    const stride = png.width * 4
    const pixels = new Uint8Array(stride * png.height)
    for (let row = 0; row < png.height; row++) {
      const input = row * (stride + 1)
      expect(png.filtered[input]).toBe(1)
      for (let column = 0; column < stride; column++) {
        pixels[row * stride + column] = (png.filtered[input + column + 1] + (column >= 4 ? pixels[row * stride + column - 4] : 0)) & 255
      }
    }
    for (const y of [0, 1, 127, 128, 129, 255, 256]) {
      for (const x of [0, 1, 2, 3, 1019, 1020, 1021, 1024]) {
        const expected = x % 4 === 0 ? [0, 0, 0, 0] : x % 4 === 1 ? [128, 64, 32, 128] : x % 4 === 2 ? [y % 256, x % 256, 19, 255] : [255, 0, 0, 1]
        expect([...pixels.subarray((y * png.width + x) * 4, (y * png.width + x + 1) * 4)]).toEqual(expected)
      }
    }
    f.assertRestored()
  })

  it('checks framebuffer completeness and deletes only its own allocations on failure', async () => {
    const f = setup()
    const reads = framebufferReadback(f)
    f.gl.checkFramebufferStatus.mockReturnValue(-1)
    await expect(renderTiledPngScreenshot(f.player, f.source, 3000)).rejects.toThrow('complete screenshot framebuffer')
    expect(reads).toHaveLength(0)
    expect(f.dispose).not.toHaveBeenCalled()
    expect(f.gl.deleteFramebuffer).toHaveBeenCalledWith({ name: 'exportFramebuffer' })
    expect(f.gl.deleteTexture).toHaveBeenCalledWith({ name: 'exportTexture' })
    f.assertRestored()
  })

  it.each(['Framebuffer', 'Texture'])('restores state when create%s cannot allocate a target', async (resource) => {
    const f = setup()
    framebufferReadback(f)
    f.gl[`create${resource}`].mockReturnValue(null)
    await expect(renderTiledPngScreenshot(f.player, f.source, 3000)).rejects.toThrow('allocate the screenshot framebuffer')
    expect(f.gl.readPixels).not.toHaveBeenCalled()
    f.assertRestored()
  })

  it('uses hardware-limited FBO tiles without gaps even when a band needs multiple tile rows', async () => {
    const f = setup()
    const reads = framebufferReadback(f)
    f.state.set(f.gl.MAX_VIEWPORT_DIMS, [96, 32])
    f.state.set(f.gl.MAX_TEXTURE_SIZE, 64)
    f.state.set(f.gl.MAX_RENDERBUFFER_SIZE, 48)
    const png = await pngData(await renderTiledPngScreenshot(f.player, f.source, 300))
    expect([png.width, png.height]).toEqual([150, 300])
    expect(Math.max(...f.tiles.map((tile) => tile.width))).toBe(48)
    expect(Math.max(...f.tiles.map((tile) => tile.height))).toBe(32)
    expect(reads.reduce((area, read) => area + read.width * read.height, 0)).toBe(150 * 300)
    expect(f.gl.texImage2D).toHaveBeenCalledOnce()
    f.assertRestored()
  })

  it('yields explicit macrotasks between bands even when compression writes resolve promptly', async () => {
    const f = setup({ x: 0, y: 0, width: 10, height: 20 })
    const timers = vi.spyOn(globalThis, 'setTimeout')
    let uiTaskRan = false
    framebufferReadback(f, (_, __, index) => {
      if (index === 0) setTimeout(() => { uiTaskRan = true }, 0)
      else expect(uiTaskRan).toBe(true)
    })
    await renderTiledPngScreenshot(f.player, f.source, 512)
    expect(timers.mock.calls.filter((call) => call[1] === 0)).toHaveLength(4)
    f.assertRestored()
  })

  it('cancels a pending macrotask yield and immediately releases the framebuffer on abort', async () => {
    const f = setup({ x: 0, y: 0, width: 10, height: 20 })
    const controller = new AbortController()
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout')
    const schedule = globalThis.setTimeout
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, delay?: number) => {
      if (delay === 0) schedule(() => controller.abort(new Error('abort between bands')), 0)
      return schedule(callback, delay)
    }) as typeof setTimeout)
    const reads = framebufferReadback(f)
    await expect(renderTiledPngScreenshot(f.player, f.source, 512, controller.signal)).rejects.toThrow('abort between bands')
    expect(reads).toHaveLength(1)
    expect(clearTimer).toHaveBeenCalled()
    expect(f.gl.deleteFramebuffer).toHaveBeenCalledOnce()
    f.assertRestored()
  })

  it('normalizes and restores WebGL 2 pixel-pack buffers, layout and separate framebuffer bindings', async () => {
    const f = setup()
    framebufferReadback(f)
    const keys = ['VERTEX_ARRAY_BINDING', 'READ_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER', 'PACK_ROW_LENGTH', 'PACK_SKIP_ROWS',
      'PACK_SKIP_PIXELS', 'PIXEL_PACK_BUFFER_BINDING', 'PIXEL_UNPACK_BUFFER_BINDING', 'PIXEL_PACK_BUFFER', 'PIXEL_UNPACK_BUFFER']
    keys.forEach((key, index) => { f.gl[key] = index + 200 })
    const values = new Map<number, any>([
      [f.gl.VERTEX_ARRAY_BINDING, { name: 'liveVao' }], [f.gl.READ_FRAMEBUFFER_BINDING, { name: 'liveReadFramebuffer' }],
      [f.gl.PACK_ROW_LENGTH, 99], [f.gl.PACK_SKIP_ROWS, 7], [f.gl.PACK_SKIP_PIXELS, 9],
      [f.gl.PIXEL_PACK_BUFFER_BINDING, { name: 'livePackBuffer' }], [f.gl.PIXEL_UNPACK_BUFFER_BINDING, { name: 'liveUnpackBuffer' }]
    ])
    for (const [key, value] of values) { f.state.set(key, value); f.saved.state.set(key, value) }
    f.gl.createVertexArray = vi.fn(() => ({ name: 'exportVao' }))
    f.gl.bindVertexArray = vi.fn((value) => { f.state.set(f.gl.VERTEX_ARRAY_BINDING, value) })
    f.gl.deleteVertexArray = vi.fn()
    f.gl.bindFramebuffer.mockImplementation((target: number, value: any) => {
      f.state.set(f.gl.READ_FRAMEBUFFER_BINDING, value)
      if (target !== f.gl.READ_FRAMEBUFFER) f.state.set(f.gl.FRAMEBUFFER_BINDING, value)
    })
    const originalBindBuffer = f.gl.bindBuffer
    f.gl.bindBuffer = vi.fn((target: number, value: any) => {
      if (target === f.gl.PIXEL_PACK_BUFFER) f.state.set(f.gl.PIXEL_PACK_BUFFER_BINDING, value)
      else if (target === f.gl.PIXEL_UNPACK_BUFFER) f.state.set(f.gl.PIXEL_UNPACK_BUFFER_BINDING, value)
      else originalBindBuffer(target, value)
    })
    const originalRead = f.gl.readPixels
    f.gl.readPixels = vi.fn((...args: any[]) => {
      expect(f.state.get(f.gl.PACK_ALIGNMENT)).toBe(1)
      for (const key of [f.gl.PACK_ROW_LENGTH, f.gl.PACK_SKIP_ROWS, f.gl.PACK_SKIP_PIXELS]) expect(f.state.get(key)).toBe(0)
      expect(f.state.get(f.gl.PIXEL_PACK_BUFFER_BINDING)).toBeNull()
      expect(f.state.get(f.gl.PIXEL_UNPACK_BUFFER_BINDING)).toBeNull()
      originalRead(...args)
    })
    await renderTiledPngScreenshot(f.player, f.source, 3000)
    expect(f.gl.createVertexArray).toHaveBeenCalledOnce()
    expect(f.gl.deleteVertexArray).toHaveBeenCalledOnce()
    f.assertRestored()
  })
})

describe('native tiled Spine screenshots', () => {
  it.each([
    [500, 1000, 3000, 1500, 3000],
    [1000, 500, 3000, 3000, 1500],
    [101, 307, 4097, 1348, 4097],
    [1, 10000, 16384, 2, 16384],
    [1000, 1000, 99999, 16384, 16384],
    [1000, 1000, 1, 64, 64],
    [1000, 1000, NaN, 3000, 3000]
  ])('preserves aspect and requested longest side for %sx%s at %s', (worldWidth, worldHeight, size, width, height) => {
    const f = setup({ x: -40, y: -20, width: worldWidth, height: worldHeight })
    const output = renderTiledScreenshot(f.player, f.source, size)
    expect([output.width, output.height]).toEqual([width, height])
    let area = 0
    for (const [sx, sy, sw, sh, x, y, dw, dh] of f.copies) {
      expect([sw, sh]).toEqual([dw, dh])
      expect(sx).toBe(2)
      expect(sy).toBe(1024 - sh - 2)
      expect(x + dw).toBeLessThanOrEqual(width)
      expect(y + dh).toBeLessThanOrEqual(height)
      area += dw * dh
    }
    expect(area).toBe(width * height)
    f.assertRestored()
  })

  it('uses guarded crops without gaps, overlapping output pixels or tile-specific resampling', () => {
    const f = setup({ x: -123, y: 91, width: 907, height: 1237 })
    const output = renderTiledScreenshot(f.player, f.source, 3071)
    const q = Math.max(907 / output.width, 1237 / output.height)
    const left = -123 + (907 - output.width * q) / 2
    const top = 91 + (1237 + output.height * q) / 2
    const pixels = new Uint8Array(output.width * output.height)
    f.copies.forEach(([sx, sy, sw, sh, x, y, dw, dh], index) => {
      const tile = f.tiles[index]
      expect(tile.zoom).toBe(q)
      expect([tile.width, tile.height]).toEqual([dw + 4, dh + 4])
      expect(tile.x + (sx + 0.5 - tile.width / 2) * q).toBeCloseTo(left + (x + 0.5) * q, 10)
      expect(tile.y + (1024 - sy - 0.5 - tile.height / 2) * q).toBeCloseTo(top - (y + 0.5) * q, 10)
      expect([sw, sh]).toEqual([dw, dh])
      for (let row = y; row < y + dh; row++) {
        for (let column = x; column < x + dw; column++) pixels[row * output.width + column]++
      }
    })
    expect(pixels.every((count) => count === 1)).toBe(true)
    expect(f.context.imageSmoothingEnabled).toBe(false)
  })

  it.each([1, 2, 3])('is independent of device pixel ratio %s', (dpr) => {
    vi.stubGlobal('devicePixelRatio', dpr)
    const f = setup()
    const output = renderTiledScreenshot(f.player, f.source, 3000)
    expect([output.width, output.height]).toEqual([1500, 3000])
    expect(f.tiles[0].zoom).toBe(1 / 3)
    expect(f.tiles[0].width).toBe(1024)
    f.assertRestored()
  })

  it('never updates animation, world transforms, the live camera or user camera hooks', () => {
    const f = setup()
    const skeleton = JSON.stringify(f.player.skeleton)
    const tracks = structuredClone(f.player.animationState.tracks)
    const offsets = [f.player.__cameraZoomFactor, f.player.__cameraPositionOffset, f.player.__cameraScreenOffset]
    renderTiledScreenshot(f.player, f.source, 4097)
    expect(f.tiles.length).toBeGreaterThan(1)
    for (const callback of [f.player.drawFrame, f.player.pause, f.player.play, f.player.setViewport, f.player.setAnimation,
      f.player.animationState.update, f.player.animationState.apply, f.player.skeleton.updateWorldTransform,
      f.player.skeleton.setToSetupPose, f.player.config.frame, f.player.config.update, f.player.config.draw]) {
      expect(callback).not.toHaveBeenCalled()
    }
    expect(JSON.stringify(f.player.skeleton)).toBe(skeleton)
    expect(f.player.animationState.tracks).toEqual(tracks)
    expect([f.player.__cameraZoomFactor, f.player.__cameraPositionOffset, f.player.__cameraScreenOffset]).toEqual(offsets)
    expect(f.drawSkeleton).toHaveBeenCalledWith(f.player.skeleton, true)
    expect(f.dispose).toHaveBeenCalledOnce()
    f.assertRestored()
  })

  it('unions padded animation bounds with the current pose without re-evaluating it', () => {
    const f = setup({ x: 10, y: 20, width: 100, height: 200 })
    Object.assign(f.player.currentViewport, { padLeft: 10, padRight: 20, padTop: 30, padBottom: 40 })
    f.player.skeleton.getBoundsRect.mockReturnValue({ x: -50, y: 0, width: 100, height: 300 })
    const output = renderTiledScreenshot(f.player, f.source, 3200)
    expect([output.width, output.height]).toEqual([1800, 3200])
    expect(f.player.skeleton.getBoundsRect).toHaveBeenCalledOnce()
  })

  it('ignores empty/non-finite current bounds when animation bounds are valid', () => {
    const f = setup()
    f.player.skeleton.getBoundsRect.mockReturnValue({ x: Infinity, y: Infinity, width: -Infinity, height: -Infinity })
    expect(renderTiledScreenshot(f.player, f.source, 3000).width).toBe(1500)
  })

  it('can use current bounds when no animation viewport is available', () => {
    const f = setup()
    delete f.player.currentViewport
    expect(renderTiledScreenshot(f.player, f.source, 3000).width).toBe(1500)
  })

  it.each(['draw', 'end', 'copy', 'context'])('restores canvas and GL state after a middle-tile %s failure', (stage) => {
    const f = setup()
    if (stage === 'draw') f.fixture.failDrawAt = 2
    if (stage === 'end') f.fixture.failEndAt = 2
    if (stage === 'context') f.fixture.lostAt = 2
    if (stage === 'copy') f.context.drawImage.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error('copy failed') })
    expect(() => renderTiledScreenshot(f.player, f.source, 3000)).toThrow()
    expect(f.tiles).toHaveLength(2)
    expect(f.clipEnd).toHaveBeenCalledOnce()
    f.assertRestored()
  })

  it('still restores state if renderer cleanup also throws', () => {
    const f = setup()
    f.fixture.failDrawAt = 2
    f.clipEnd.mockImplementation(() => { throw new Error('clip cleanup failed') })
    f.dispose.mockImplementation(() => { throw new Error('renderer cleanup failed') })
    expect(() => renderTiledScreenshot(f.player, f.source, 3000)).toThrow('draw failed')
    expect(f.resource.dispose).toHaveBeenCalledOnce()
    f.assertRestored()
  })

  it('respects independent viewport, texture and renderbuffer limits', () => {
    const f = setup()
    f.state.set(f.gl.MAX_VIEWPORT_DIMS, [700, 300])
    f.state.set(f.gl.MAX_TEXTURE_SIZE, 600)
    f.state.set(f.gl.MAX_RENDERBUFFER_SIZE, 500)
    renderTiledScreenshot(f.player, f.source, 3000)
    expect(Math.max(...f.tiles.map((tile) => tile.width))).toBe(500)
    expect(Math.max(...f.tiles.map((tile) => tile.height))).toBe(300)
    expect(f.copies[0][1]).toBe(2)
    f.assertRestored()
  })

  it('normalizes to actual drawing-buffer allocation when the browser clamps dimensions', () => {
    const f = setup()
    f.fixture.actualWidthLimit = 800
    f.fixture.actualHeightLimit = 400
    renderTiledScreenshot(f.player, f.source, 3000)
    expect(Math.max(...f.tiles.map((tile) => tile.width))).toBe(800)
    expect(Math.max(...f.tiles.map((tile) => tile.height))).toBe(400)
    f.assertRestored()
  })

  it('restores state when the framebuffer allocation fails', () => {
    const f = setup()
    f.fixture.actualWidthLimit = 0
    expect(() => renderTiledScreenshot(f.player, f.source, 3000)).toThrow('allocate the WebGL')
    expect(f.tiles).toHaveLength(0)
    f.assertRestored()
  })

  it('rejects unavailable 2D output before mutating the player', () => {
    const f = setup()
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    expect(() => renderTiledScreenshot(f.player, f.source, 3000)).toThrow('allocate the screenshot')
    f.assertRestored()
  })

  it('rejects a silently unallocated 2D bitmap before touching WebGL', () => {
    const f = setup()
    f.context.getImageData.mockReturnValue({ data: new Uint8ClampedArray(4) })
    expect(() => renderTiledScreenshot(f.player, f.source, 16384)).toThrow('allocate the screenshot')
    expect(f.gl.getParameter).not.toHaveBeenCalled()
    f.assertRestored()
  })

  it('rejects invalid bounds, unusable hardware limits and already lost contexts', () => {
    const f = setup()
    f.player.currentViewport.width = 0
    f.player.skeleton.getBoundsRect.mockReturnValue({ x: 0, y: 0, width: 0, height: 0 })
    expect(() => renderTiledScreenshot(f.player, f.source, 3000)).toThrow('bounds')
    f.player.currentViewport.width = 500
    f.state.set(f.gl.MAX_TEXTURE_SIZE, 4)
    expect(() => renderTiledScreenshot(f.player, f.source, 3000)).toThrow('too small')
    f.gl.isContextLost.mockReturnValue(true)
    expect(() => renderTiledScreenshot(f.player, f.source, 3000)).toThrow('not ready')
  })

  it('uses transparent clears and honors custom non-premultiplied attachment colors', () => {
    const f = setup()
    f.player.config.premultipliedAlpha = false
    renderTiledScreenshot(f.player, f.source, 3000)
    expect(f.gl.clearColor).toHaveBeenCalledWith(0, 0, 0, 0)
    expect(f.drawSkeleton).toHaveBeenCalledWith(f.player.skeleton, false)
    f.assertRestored()
  })

  it('isolates WebGL 2 vertex arrays and restores distinct read/draw framebuffers', () => {
    const f = setup()
    Object.assign(f.gl, { VERTEX_ARRAY_BINDING: 100, READ_FRAMEBUFFER_BINDING: 101, READ_FRAMEBUFFER: 102 })
    const originalVao = { name: 'liveVao' }
    const originalReadFramebuffer = { name: 'readFramebuffer' }
    const exportVao = { name: 'exportVao' }
    f.state.set(f.gl.VERTEX_ARRAY_BINDING, originalVao)
    f.state.set(f.gl.READ_FRAMEBUFFER_BINDING, originalReadFramebuffer)
    f.gl.createVertexArray = vi.fn(() => exportVao)
    f.gl.bindVertexArray = vi.fn()
    f.gl.deleteVertexArray = vi.fn()
    renderTiledScreenshot(f.player, f.source, 3000)
    expect(f.gl.bindVertexArray.mock.calls).toEqual([[exportVao], [originalVao]])
    expect(f.gl.deleteVertexArray).toHaveBeenCalledWith(exportVao)
    expect(f.gl.bindFramebuffer).toHaveBeenLastCalledWith(f.gl.READ_FRAMEBUFFER, originalReadFramebuffer)
    expect(f.gl.getExtension).not.toHaveBeenCalled()
  })

  it('isolates WebGL 1 vertex arrays through the OES extension', () => {
    const f = setup()
    const originalVao = { name: 'liveVao' }
    const exportVao = { name: 'exportVao' }
    const extension = {
      VERTEX_ARRAY_BINDING_OES: 100,
      createVertexArrayOES: vi.fn(() => exportVao), bindVertexArrayOES: vi.fn(), deleteVertexArrayOES: vi.fn()
    }
    f.state.set(extension.VERTEX_ARRAY_BINDING_OES, originalVao)
    f.gl.getExtension.mockReturnValue(extension)
    renderTiledScreenshot(f.player, f.source, 3000)
    expect(extension.bindVertexArrayOES.mock.calls).toEqual([[exportVao], [originalVao]])
    expect(extension.deleteVertexArrayOES).toHaveBeenCalledWith(exportVao)
  })

  it('restores existing WebGL 1 vertex attributes when VAOs are unavailable', () => {
    const f = setup()
    f.state.set(f.gl.MAX_VERTEX_ATTRIBS, 1)
    Object.assign(f.gl, {
      VERTEX_ATTRIB_ARRAY_ENABLED: 100, VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 101, VERTEX_ATTRIB_ARRAY_SIZE: 102,
      VERTEX_ATTRIB_ARRAY_TYPE: 103, VERTEX_ATTRIB_ARRAY_NORMALIZED: 104, VERTEX_ATTRIB_ARRAY_STRIDE: 105,
      VERTEX_ATTRIB_ARRAY_POINTER: 106
    })
    const buffer = { name: 'attributeBuffer' }
    const values = new Map<number, any>([[100, true], [101, buffer], [102, 2], [103, 5126], [104, false], [105, 48]])
    f.gl.getVertexAttrib = vi.fn((_: number, key: number) => values.get(key))
    f.gl.getVertexAttribOffset = vi.fn(() => 16)
    f.gl.vertexAttribPointer = vi.fn()
    f.gl.enableVertexAttribArray = vi.fn()
    f.gl.disableVertexAttribArray = vi.fn()
    renderTiledScreenshot(f.player, f.source, 3000)
    expect(f.gl.vertexAttribPointer).toHaveBeenCalledWith(0, 2, 5126, false, 48, 16)
    expect(f.gl.enableVertexAttribArray).toHaveBeenCalledWith(0)
    f.assertRestored()
  })

  it('cleans partially registered resources and restores GL state if renderer construction fails', () => {
    const f = setup()
    const partialResource = { dispose: vi.fn(() => { f.player.context.restorables.pop() }) }
    f.player.sceneRenderer.constructor = class {
      constructor() {
        f.player.context.restorables.push(partialResource)
        f.gl.useProgram({ name: 'partialProgram' })
        throw new Error('renderer construction failed')
      }
    }
    expect(() => renderTiledScreenshot(f.player, f.source, 3000)).toThrow('renderer construction failed')
    expect(partialResource.dispose).toHaveBeenCalledOnce()
    f.assertRestored()
  })
})
