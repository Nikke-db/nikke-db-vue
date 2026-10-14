const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function chunk(type: string, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data.length + 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, data.length)
  for (let index = 0; index < 4; index++) bytes[index + 4] = type.charCodeAt(index)
  bytes.set(data, 8)
  let crc = 0xffffffff
  for (let index = 4; index < bytes.length - 4; index++) crc = crcTable[(crc ^ bytes[index]) & 255] ^ (crc >>> 8)
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0)
  return bytes
}

/** Encode RGBA in bands to bound raw and filtered memory; retain compressed PNG chunks. */
export async function encodeRgbaPng(
  width: number,
  height: number,
  bands: AsyncIterable<Uint8Array | Uint8ClampedArray>,
  signal?: AbortSignal
): Promise<Blob> {
  if (![width, height].every((size) => Number.isInteger(size) && size > 0 && size <= 16384)) {
    throw new Error('Invalid PNG dimensions.')
  }
  signal?.throwIfAborted()
  if (typeof CompressionStream === 'undefined') {
    throw new Error('High-resolution PNG export requires browser CompressionStream support.')
  }
  let compressor: CompressionStream
  try {
    compressor = new CompressionStream('deflate')
  } catch {
    throw new Error('High-resolution PNG export requires CompressionStream deflate support.')
  }
  const writer = compressor.writable.getWriter()
  const reader = compressor.readable.getReader()
  const header = new Uint8Array(13)
  const headerView = new DataView(header.buffer)
  headerView.setUint32(0, width)
  headerView.setUint32(4, height)
  header[8] = 8
  header[9] = 6 // 8-bit RGBA; no palette or interlacing.
  const parts: BlobPart[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header)]
  const draining = (async () => {
    let result = await reader.read()
    while (!result.done) {
      // Store compressed chunks as Blobs to keep them outside the JS heap and avoid a final byte-array copy.
      if (result.value.length) parts.push(new Blob([chunk('IDAT', result.value)]))
      result = await reader.read()
    }
  })()
  // Read compressed output while writing input so a full readable queue cannot block compression.
  void draining.catch((error) => {
    void writer.abort(error).catch(() => {})
    void reader.cancel(error).catch(() => {})
  })
  void writer.closed.catch(() => {})
  const abort = () => {
    void writer.abort(signal?.reason).catch(() => {})
    void reader.cancel(signal?.reason).catch(() => {})
  }
  signal?.addEventListener('abort', abort, { once: true })
  const stride = width * 4
  let rows = 0
  try {
    for await (const pixels of bands) {
      signal?.throwIfAborted()
      if (!pixels.length || pixels.length % stride || rows + pixels.length / stride > height) {
        throw new Error('PNG bands must contain complete RGBA rows within the image height.')
      }
      for (let start = 0; start < pixels.length; start += stride * 128) {
        const count = Math.min(128, (pixels.length - start) / stride)
        const filtered = new Uint8Array((stride + 1) * count)
        for (let row = 0; row < count; row++) {
          const destination = row * (stride + 1)
          const source = start + row * stride
          filtered[destination] = 1 // Sub filter: subtract the previous pixel's channels, starting fresh each row.
          for (let column = 0; column < stride; column++) {
            filtered[destination + column + 1] = (pixels[source + column] - (column >= 4 ? pixels[source + column - 4] : 0)) & 255
          }
        }
        signal?.throwIfAborted()
        await writer.write(filtered)
        signal?.throwIfAborted()
        rows += count
      }
    }
    if (rows !== height) throw new Error('PNG bands did not contain the entire image.')
    await writer.close()
    await draining
    signal?.throwIfAborted()
    parts.push(chunk('IEND', new Uint8Array()))
    return new Blob(parts, { type: 'image/png' })
  } catch (error) {
    await Promise.allSettled([writer.abort(error), reader.cancel(error), draining])
    signal?.throwIfAborted()
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
    writer.releaseLock()
    reader.releaseLock()
  }
}
