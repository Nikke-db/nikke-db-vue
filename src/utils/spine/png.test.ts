import { Blob as NodeBlob } from 'node:buffer'
import * as webStreams from 'node:stream/web'
import { inflateSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeRgbaPng } from './png'

const NodeCompressionStream = (webStreams as unknown as { CompressionStream: typeof CompressionStream }).CompressionStream

async function* bands(...values: Uint8Array[]) {
  for (const value of values) yield value
}

function parsePng(bytes: Uint8Array) {
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: { type: string; data: Uint8Array }[] = []
  for (let offset = 8; offset < bytes.length;) {
    const size = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    let crc = 0xffffffff
    for (const value of bytes.subarray(offset + 4, offset + 8 + size)) {
      crc ^= value
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    expect(view.getUint32(offset + 8 + size)).toBe((crc ^ 0xffffffff) >>> 0)
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + size) })
    offset += size + 12
    expect(offset).toBeLessThanOrEqual(bytes.length)
  }
  expect(chunks[0].type).toBe('IHDR')
  expect(chunks[chunks.length - 1].type).toBe('IEND')
  const header = chunks[0].data
  const width = new DataView(header.buffer, header.byteOffset).getUint32(0)
  const height = new DataView(header.buffer, header.byteOffset).getUint32(4)
  expect([...header.subarray(8)]).toEqual([8, 6, 0, 0, 0])
  const filtered = inflateSync(Buffer.concat(chunks.filter((entry) => entry.type === 'IDAT').map((entry) => entry.data)))
  expect(filtered.length).toBe((width * 4 + 1) * height)
  const pixels = new Uint8Array(width * height * 4)
  const stride = width * 4
  for (let row = 0; row < height; row++) {
    const start = row * (stride + 1)
    expect(filtered[start]).toBe(1)
    for (let column = 0; column < stride; column++) {
      pixels[row * stride + column] = (filtered[start + column + 1] + (column >= 4 ? pixels[row * stride + column - 4] : 0)) & 255
    }
  }
  return { width, height, pixels, chunks }
}

beforeEach(() => {
  vi.stubGlobal('CompressionStream', NodeCompressionStream)
  vi.stubGlobal('Blob', NodeBlob)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('streaming RGBA PNG encoding', () => {
  it('writes valid PNG headers, CRCs, zlib data and lossless RGB/alpha across multiple bands', async () => {
    const first = new Uint8Array([255, 0, 32, 0, 1, 2, 3, 127, 10, 20, 30, 255, 11, 12, 13, 254])
    const second = new Uint8Array([0, 0, 0, 0, 255, 255, 255, 255])
    const blob = await encodeRgbaPng(2, 3, bands(first, second))
    expect(blob.type).toBe('image/png')
    const png = parsePng(new Uint8Array(await blob.arrayBuffer()))
    expect([png.width, png.height]).toEqual([2, 3])
    expect(png.pixels).toEqual(new Uint8Array([...first, ...second]))
    expect(png.chunks.filter((entry) => entry.type === 'IDAT').length).toBeGreaterThan(0)
  })

  it.each([1, 2, 16384])('encodes narrow and maximum-width %spx rows without changing dimensions', async (width) => {
    const pixels = Uint8Array.from({ length: width * 4 }, (_, index) => index % 256)
    const png = parsePng(new Uint8Array(await (await encodeRgbaPng(width, 1, bands(pixels))).arrayBuffer()))
    expect(png.width).toBe(width)
    expect(png.pixels).toEqual(pixels)
  })

  it('bounds filtered writes to 128 rows even when input provides a larger band', async () => {
    const writes: number[] = []
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
            write: (value: Uint8Array) => { writes.push(value.length); return writer.write(value) },
            close: () => writer.close(), abort: (reason: any) => writer.abort(reason), releaseLock: () => writer.releaseLock()
          }
        } }
      }
    })
    const raw = Uint8Array.from({ length: 4 * 300 * 4 }, (_, index) => index % 251)
    const png = parsePng(new Uint8Array(await (await encodeRgbaPng(4, 300, bands(raw))).arrayBuffer()))
    expect(writes).toEqual([17 * 128, 17 * 128, 17 * 44])
    expect(png.pixels).toEqual(raw)
  })

  it.each([
    [0, 1], [1, 0], [16385, 1], [1, 16385], [1.5, 2], [NaN, 2]
  ])('rejects invalid dimensions %sx%s before reading bands', async (width, height) => {
    const next = vi.fn()
    await expect(encodeRgbaPng(width, height, { [Symbol.asyncIterator]: () => ({ next }) })).rejects.toThrow('dimensions')
    expect(next).not.toHaveBeenCalled()
  })

  it.each([
    [new Uint8Array(3)], [new Uint8Array(0)], [new Uint8Array(12)]
  ])('rejects invalid/overflow RGBA bands', async (pixels) => {
    await expect(encodeRgbaPng(1, 2, bands(pixels))).rejects.toThrow('complete RGBA rows')
  })

  it('rejects missing rows rather than producing a truncated PNG', async () => {
    await expect(encodeRgbaPng(1, 2, bands(new Uint8Array(4)))).rejects.toThrow('entire image')
  })

  it('rejects unsupported CompressionStream and deflate without consuming bands', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    await expect(encodeRgbaPng(1, 1, bands(new Uint8Array(4)))).rejects.toThrow('CompressionStream support')
    vi.stubGlobal('CompressionStream', class { constructor() { throw new Error('unsupported') } })
    await expect(encodeRgbaPng(1, 1, bands(new Uint8Array(4)))).rejects.toThrow('deflate support')
  })

  it('rejects pre-aborted signals without starting the compressor', async () => {
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    const compressor = vi.fn()
    vi.stubGlobal('CompressionStream', compressor)
    await expect(encodeRgbaPng(1, 1, bands(new Uint8Array(4)), controller.signal)).rejects.toThrow('cancelled')
    expect(compressor).not.toHaveBeenCalled()
  })

  it('aborts both stream endpoints and closes the band iterator on cancellation during backpressure', async () => {
    const controller = new AbortController()
    const abort = vi.fn()
    const cancel = vi.fn()
    const releaseWriter = vi.fn()
    const releaseReader = vi.fn()
    let iteratorClosed = false
    vi.stubGlobal('CompressionStream', class {
      readable: any
      writable: any
      constructor() {
        const stream = new NodeCompressionStream('deflate')
        this.readable = { getReader: () => {
          const reader = stream.readable.getReader()
          return {
            read: () => reader.read(),
            cancel: (reason: any) => { cancel(reason); return reader.cancel(reason) },
            releaseLock: () => { releaseReader(); reader.releaseLock() }
          }
        } }
        this.writable = { getWriter: () => {
          const writer = stream.writable.getWriter()
          return {
            closed: writer.closed,
            write: (value: Uint8Array) => {
              controller.abort(new Error('cancelled during write'))
              return writer.write(value)
            },
            close: () => writer.close(),
            abort: (reason: any) => { abort(reason); return writer.abort(reason) },
            releaseLock: () => { releaseWriter(); writer.releaseLock() }
          }
        } }
      }
    })
    async function* input() {
      try { yield new Uint8Array(4) } finally { iteratorClosed = true }
    }
    await expect(encodeRgbaPng(1, 1, input(), controller.signal)).rejects.toThrow('cancelled during write')
    expect(abort).toHaveBeenCalled()
    expect(cancel).toHaveBeenCalled()
    expect(releaseWriter).toHaveBeenCalledOnce()
    expect(releaseReader).toHaveBeenCalledOnce()
    expect(iteratorClosed).toBe(true)
  })

  it('propagates band-render errors without leaving a stream reader pending', async () => {
    async function* input() {
      yield new Uint8Array(4)
      throw new Error('band render failed')
    }
    await expect(encodeRgbaPng(1, 2, input())).rejects.toThrow('band render failed')
  })

  it('cancels the output reader and releases both locks when compression writes fail', async () => {
    const cancel = vi.fn()
    const writable = new webStreams.WritableStream({ write() { throw new Error('compression failed') } })
    const readable = new webStreams.ReadableStream({ cancel })
    vi.stubGlobal('CompressionStream', class {
      writable = writable
      readable = readable
    })
    await expect(encodeRgbaPng(1, 1, bands(new Uint8Array(4)))).rejects.toThrow('compression failed')
    expect(cancel).toHaveBeenCalledOnce()
    expect(writable.locked).toBe(false)
    expect(readable.locked).toBe(false)
  })

  it('aborts pending input and releases locks when the compressed reader fails', async () => {
    const abort = vi.fn()
    const writable = new webStreams.WritableStream({ abort })
    const readable = new webStreams.ReadableStream({ start(controller) { controller.error(new Error('compressed reader failed')) } })
    vi.stubGlobal('CompressionStream', class {
      writable = writable
      readable = readable
    })
    await expect(encodeRgbaPng(1, 1, bands(new Uint8Array(4)))).rejects.toThrow('compressed reader failed')
    expect(abort).toHaveBeenCalledOnce()
    expect(writable.locked).toBe(false)
    expect(readable.locked).toBe(false)
  })
})
