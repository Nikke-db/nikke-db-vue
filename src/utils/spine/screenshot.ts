import { encodeRgbaPng } from './png'

type ScreenshotFrame = { width: number; height: number; zoom: number; left: number; top: number }

function getScreenshotFrame(player: any, screenshotSize: number): ScreenshotFrame {
  const skeleton = player.skeleton
  const viewport = player.currentViewport
  const rectangles = [viewport && {
    x: viewport.x - (viewport.padLeft || 0),
    y: viewport.y - (viewport.padBottom || 0),
    width: viewport.width + (viewport.padLeft || 0) + (viewport.padRight || 0),
    height: viewport.height + (viewport.padBottom || 0) + (viewport.padTop || 0)
  }, skeleton.getBoundsRect?.()].filter((bounds) => bounds &&
    [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) &&
    bounds.width > 0 && bounds.height > 0)
  if (!rectangles.length) throw new Error('The character has no valid screenshot bounds.')
  const left = Math.min(...rectangles.map((bounds) => bounds.x))
  const bottom = Math.min(...rectangles.map((bounds) => bounds.y))
  const right = Math.max(...rectangles.map((bounds) => bounds.x + bounds.width))
  const top = Math.max(...rectangles.map((bounds) => bounds.y + bounds.height))
  const worldWidth = right - left
  const worldHeight = top - bottom
  if (![left, bottom, right, top, worldWidth, worldHeight].every(Number.isFinite)) {
    throw new Error('The character has no valid screenshot bounds.')
  }
  const size = Math.max(64, Math.min(16384, Math.round(Number.isFinite(screenshotSize) ? screenshotSize : 3000)))
  const width = worldWidth >= worldHeight ? size : Math.max(1, Math.round(size * worldWidth / worldHeight))
  const height = worldWidth >= worldHeight ? Math.max(1, Math.round(size * worldHeight / worldWidth)) : size
  const zoom = Math.max(worldWidth / width, worldHeight / height)
  return { width, height, zoom, left: (left + right - width * zoom) / 2, top: (bottom + top + height * zoom) / 2 }
}

function assertScreenshotPlayer(player: any, signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (!player?.sceneRenderer?.camera || !player.skeleton || !player.context?.gl || player.disposed || player.error || player.context.gl.isContextLost()) {
    throw new Error('The Spine player is not ready for a screenshot.')
  }
}

function captureRenderState(player: any) {
  const gl: WebGLRenderingContext | WebGL2RenderingContext = player.context.gl
  const saved = {
    viewport: gl.getParameter(gl.VIEWPORT) as Int32Array,
    clearColor: gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array,
    colorMask: gl.getParameter(gl.COLOR_WRITEMASK) as boolean[],
    framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null,
    program: gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null,
    arrayBuffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null,
    elementBuffer: gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) as WebGLBuffer | null,
    activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE) as number,
    blend: [gl.BLEND_SRC_RGB, gl.BLEND_DST_RGB, gl.BLEND_SRC_ALPHA, gl.BLEND_DST_ALPHA].map((key) => gl.getParameter(key) as number),
    capabilities: [gl.BLEND, gl.CULL_FACE, gl.SCISSOR_TEST, gl.DEPTH_TEST, gl.STENCIL_TEST].map((key) => [key, gl.isEnabled(key)] as const)
  }
  gl.activeTexture(gl.TEXTURE0)
  const texture = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
  gl.activeTexture(saved.activeTexture)
  const gl2 = 'createVertexArray' in gl ? gl as WebGL2RenderingContext : null
  const vaoExtension = gl2 ? null : gl.getExtension('OES_vertex_array_object')
  const oldVao = gl2 ? gl2.getParameter(gl2.VERTEX_ARRAY_BINDING) : vaoExtension && gl.getParameter(vaoExtension.VERTEX_ARRAY_BINDING_OES)
  const readFramebuffer = gl2 && gl2.getParameter(gl2.READ_FRAMEBUFFER_BINDING)
  const restorables = new Set(player.context.restorables || [])
  let vao: WebGLVertexArrayObject | WebGLVertexArrayObjectOES | null = null
  const attributes = gl2 || vaoExtension ? [] : Array.from({ length: gl.getParameter(gl.MAX_VERTEX_ATTRIBS) }, (_, index) => ({
    index,
    enabled: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
    buffer: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
    size: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_SIZE),
    type: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_TYPE),
    normalized: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
    stride: gl.getVertexAttrib(index, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
    offset: gl.getVertexAttribOffset(index, gl.VERTEX_ATTRIB_ARRAY_POINTER)
  }))
  return {
    gl2,
    begin() {
      if (gl2) {
        vao = gl2.createVertexArray()
        if (!vao) throw new Error('Could not allocate screenshot vertex bindings.')
        gl2.bindVertexArray(vao)
      } else if (vaoExtension) {
        vao = vaoExtension.createVertexArrayOES()
        if (!vao) throw new Error('Could not allocate screenshot vertex bindings.')
        vaoExtension.bindVertexArrayOES(vao)
      }
    },
    dispose(renderer: any) {
      try { renderer?.skeletonRenderer?.clipper?.clipEnd() } catch { /* Restore GL state even if clip cleanup fails. */ }
      try { renderer?.dispose() } catch { /* Dispose remaining registered resources below. */ }
      for (const resource of [...(player.context.restorables || [])]) {
        if (!restorables.has(resource)) {
          try { resource.dispose() } catch { /* Keep restoring state if the context is lost or cleanup fails. */ }
        }
      }
    },
    restore() {
      if (gl2) {
        gl2.bindVertexArray(oldVao)
        gl2.deleteVertexArray(vao)
      } else if (vaoExtension) {
        vaoExtension.bindVertexArrayOES(oldVao)
        vaoExtension.deleteVertexArrayOES(vao)
      } else {
        for (const attribute of attributes) {
          if (attribute.buffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, attribute.buffer)
            gl.vertexAttribPointer(attribute.index, attribute.size, attribute.type, attribute.normalized, attribute.stride, attribute.offset)
          }
          if (attribute.enabled) gl.enableVertexAttribArray(attribute.index)
          else gl.disableVertexAttribArray(attribute.index)
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, saved.framebuffer)
      if (gl2) gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, readFramebuffer)
      gl.useProgram(saved.program)
      gl.bindBuffer(gl.ARRAY_BUFFER, saved.arrayBuffer)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, saved.elementBuffer)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.activeTexture(saved.activeTexture)
      gl.blendFuncSeparate(saved.blend[0], saved.blend[1], saved.blend[2], saved.blend[3])
      for (const [capability, enabled] of saved.capabilities) {
        if (enabled) gl.enable(capability)
        else gl.disable(capability)
      }
      gl.colorMask(saved.colorMask[0], saved.colorMask[1], saved.colorMask[2], saved.colorMask[3])
      gl.clearColor(saved.clearColor[0], saved.clearColor[1], saved.clearColor[2], saved.clearColor[3])
      gl.viewport(saved.viewport[0], saved.viewport[1], saved.viewport[2], saved.viewport[3])
    }
  }
}

function configureExportAlpha(renderer: any, gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const batcher = renderer.batcher
  const begin = batcher.begin
  const setBlendMode = batcher.setBlendMode
  const normalizeAlpha = () => gl.blendFuncSeparate(batcher.srcColorBlend, batcher.dstBlend, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  batcher.begin = function (...args: any[]) {
    begin.apply(this, args)
    normalizeAlpha()
  }
  batcher.setBlendMode = function (...args: any[]) {
    // Flush pending vertices with the previous RGB mode before updating alpha blending.
    setBlendMode.apply(this, args)
    normalizeAlpha()
  }
}

/** Render the evaluated pose without advancing animation or running frame callbacks. */
export function renderTiledScreenshot(player: any, source: HTMLCanvasElement, screenshotSize: number): HTMLCanvasElement {
  assertScreenshotPlayer(player)
  return renderScreenshotFrame(player, source, getScreenshotFrame(player, screenshotSize))
}

function renderScreenshotFrame(player: any, source: HTMLCanvasElement, frame: ScreenshotFrame): HTMLCanvasElement {
  const liveRenderer = player.sceneRenderer
  const skeleton = player.skeleton
  const gl: WebGLRenderingContext | WebGL2RenderingContext = player.context.gl
  const { width, height, zoom, left: exportLeft, top: exportTop } = frame
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('2d')
  if (!context || output.width !== width || output.height !== height) {
    throw new Error('The browser could not allocate the screenshot canvas.')
  }
  // A 2D context can exist even when the browser cannot allocate its backing bitmap.
  context.fillRect(width - 1, height - 1, 1, 1)
  if (context.getImageData(width - 1, height - 1, 1, 1).data[3] !== 255) {
    throw new Error('The browser could not allocate the screenshot canvas.')
  }
  context.clearRect(width - 1, height - 1, 1, 1)
  context.imageSmoothingEnabled = false

  const limits = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array
  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
  const maxRenderbuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number
  const bufferWidth = Math.floor(Math.min(1024, limits[0], maxTexture, maxRenderbuffer))
  const bufferHeight = Math.floor(Math.min(1024, limits[1], maxTexture, maxRenderbuffer))
  const gutter = 2
  if (!(bufferWidth > gutter * 2 && bufferHeight > gutter * 2)) {
    throw new Error('The WebGL framebuffer is too small for screenshot tiles.')
  }

  const saved = {
    width: source.width,
    height: source.height,
    style: source.getAttribute('style')
  }
  const state = captureRenderState(player)
  let renderer: any

  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    state.begin()
    renderer = new liveRenderer.constructor(source, player.context, liveRenderer.twoColorTint)
    configureExportAlpha(renderer, gl)
    source.width = bufferWidth
    source.height = bufferHeight
    if (gl.drawingBufferWidth < source.width || gl.drawingBufferHeight < source.height) {
      source.width = Math.min(source.width, gl.drawingBufferWidth)
      source.height = Math.min(source.height, gl.drawingBufferHeight)
    }
    if (gl.isContextLost() || source.width !== gl.drawingBufferWidth || source.height !== gl.drawingBufferHeight ||
      source.width <= gutter * 2 || source.height <= gutter * 2) {
      throw new Error('The browser could not allocate the WebGL screenshot tiles.')
    }
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.STENCIL_TEST)
    gl.colorMask(true, true, true, true)
    gl.clearColor(0, 0, 0, 0)
    const camera = renderer.camera
    const tileWidth = source.width - gutter * 2
    const tileHeight = source.height - gutter * 2

    // Render tiles synchronously to preserve the evaluated bones, slots, deform arrays and draw order.
    for (let y = 0; y < height; y += tileHeight) {
      const h = Math.min(tileHeight, height - y)
      for (let x = 0; x < width; x += tileWidth) {
        const w = Math.min(tileWidth, width - x)
        camera.setViewport(w + gutter * 2, h + gutter * 2)
        camera.zoom = zoom
        camera.position.x = exportLeft + (x + w / 2) * zoom
        camera.position.y = exportTop - (y + h / 2) * zoom
        gl.viewport(0, 0, camera.viewportWidth, camera.viewportHeight)
        gl.clear(gl.COLOR_BUFFER_BIT)
        renderer.begin()
        renderer.drawSkeleton(skeleton, player.config.premultipliedAlpha)
        renderer.end()
        if (gl.isContextLost()) throw new Error('The WebGL context was lost during the screenshot.')
        // WebGL crops use a bottom-left origin; drawImage crops use a top-left origin.
        context.drawImage(source, gutter, source.height - h - gutter, w, h, x, y, w, h)
      }
    }
    return output
  } finally {
    // Dispose partially constructed renderers without flushing a batch that may have failed.
    state.dispose(renderer)
    try {
      if (source.width !== saved.width) source.width = saved.width
      if (source.height !== saved.height) source.height = saved.height
      if (source.getAttribute('style') !== saved.style) {
        if (saved.style === null) source.removeAttribute('style')
        else source.setAttribute('style', saved.style)
      }
    } finally {
      state.restore()
    }
  }
}

function snapshotSkeleton(skeleton: any): any {
  const copy = (value: any) => value === null || value === undefined ? value : Object.assign(Object.create(Object.getPrototypeOf(value)), value)
  const frozen = copy(skeleton)
  frozen.color = copy(skeleton.color)
  const bones = new Map<any, any>((skeleton.bones || []).map((bone: any) => [bone, copy(bone)]))
  frozen.bones = [...bones.values()]
  for (const [bone, snapshot] of bones) {
    snapshot.skeleton = frozen
    snapshot.parent = bones.get(bone.parent) || null
    snapshot.children = (bone.children || []).map((child: any) => bones.get(child))
  }
  const attachments = new Map<any, any>()
  const slots = new Map<any, any>((skeleton.slots || []).map((slot: any) => {
    const snapshot = copy(slot)
    snapshot.bone = bones.get(slot.bone)
    snapshot.data = copy(slot.data)
    snapshot.color = copy(slot.color)
    snapshot.darkColor = copy(slot.darkColor)
    snapshot.deform = slot.deform?.slice() || []
    const attachment = slot.getAttachment?.() || slot.attachment
    if (attachment && !attachments.has(attachment)) {
      const clonedAttachment = copy(attachment)
      clonedAttachment.color = copy(attachment.color)
      clonedAttachment.tempColor = copy(attachment.tempColor)
      for (const key of ['bones', 'vertices', 'uvs', 'regionUVs', 'offset', 'triangles', 'edges']) {
        if (attachment[key]) clonedAttachment[key] = attachment[key].slice()
      }
      // Sequence.apply changes the attachment's region, UVs and offsets while computing vertices.
      if (attachment.sequence) {
        clonedAttachment.sequence = copy(attachment.sequence)
        clonedAttachment.sequence.regions = attachment.sequence.regions.slice()
      }
      attachments.set(attachment, clonedAttachment)
    }
    snapshot.attachment = attachments.get(attachment) || null
    return [slot, snapshot]
  }))
  frozen.slots = [...slots.values()]
  const slotData = new Map([...slots].map(([slot, snapshot]) => [slot.data, snapshot.data]))
  for (const attachment of attachments.values()) {
    if (slotData.has(attachment.endSlot)) attachment.endSlot = slotData.get(attachment.endSlot)
  }
  frozen.drawOrder = (skeleton.drawOrder || skeleton.slots || []).map((slot: any) => slots.get(slot))
  return frozen
}

/** Suspend native player draws until this promise settles. */
export async function renderTiledPngScreenshot(
  player: any,
  source: HTMLCanvasElement,
  screenshotSize: number,
  signal?: AbortSignal
): Promise<Blob> {
  assertScreenshotPlayer(player, signal)
  const captured = {
    sceneRenderer: player.sceneRenderer,
    context: player.context,
    config: { premultipliedAlpha: player.config.premultipliedAlpha },
    currentViewport: player.currentViewport && { ...player.currentViewport },
    skeleton: snapshotSkeleton(player.skeleton)
  }
  const frame = getScreenshotFrame(captured, screenshotSize)
  const gl: WebGLRenderingContext | WebGL2RenderingContext = captured.context.gl
  const viewportLimits = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array
  const sizeLimit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
  const gutter = 2
  const bufferWidth = Math.floor(Math.min(1024, sizeLimit, viewportLimits[0]))
  const bufferHeight = Math.floor(Math.min(128 + gutter * 2, sizeLimit, viewportLimits[1]))
  if (!(bufferWidth > gutter * 2 && bufferHeight > gutter * 2)) {
    throw new Error('The WebGL framebuffer is too small for screenshot tiles.')
  }
  const state = captureRenderState(player)
  const gl2 = state.gl2
  const packKeys = [gl.PACK_ALIGNMENT, ...(gl2 ? [gl2.PACK_ROW_LENGTH, gl2.PACK_SKIP_ROWS, gl2.PACK_SKIP_PIXELS] : [])]
  const packValues = packKeys.map((key) => gl.getParameter(key) as number)
  const packBuffer = gl2 && gl2.getParameter(gl2.PIXEL_PACK_BUFFER_BINDING)
  const unpackBuffer = gl2 && gl2.getParameter(gl2.PIXEL_UNPACK_BUFFER_BINDING)
  const dither = gl.isEnabled(gl.DITHER)
  let framebuffer: WebGLFramebuffer | null = null
  let texture: WebGLTexture | null = null
  let renderer: any
  try {
    state.begin()
    framebuffer = gl.createFramebuffer()
    texture = gl.createTexture()
    if (!framebuffer || !texture) throw new Error('Could not allocate the screenshot framebuffer.')
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    if (gl2) {
      gl2.bindBuffer(gl2.PIXEL_PACK_BUFFER, null)
      gl2.bindBuffer(gl2.PIXEL_UNPACK_BUFFER, null)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bufferWidth, bufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('The browser could not allocate a complete screenshot framebuffer.')
    }
    renderer = new captured.sceneRenderer.constructor(source, captured.context, captured.sceneRenderer.twoColorTint)
    configureExportAlpha(renderer, gl)
    for (const capability of [gl.SCISSOR_TEST, gl.DEPTH_TEST, gl.STENCIL_TEST, gl.DITHER]) gl.disable(capability)
    gl.colorMask(true, true, true, true)
    gl.clearColor(0, 0, 0, 0)
    packKeys.forEach((key, index) => gl.pixelStorei(key, index === 0 ? 1 : 0))
    const tileWidth = bufferWidth - gutter * 2
    const tileHeight = bufferHeight - gutter * 2
    const pixels = new Uint8Array(frame.width * Math.min(128, frame.height) * 4)
    const tilePixels = new Uint8Array(tileWidth * tileHeight * 4)
    const bands = async function* () {
      for (let y = 0; y < frame.height; y += 128) {
        assertScreenshotPlayer(player, signal)
        const rows = Math.min(128, frame.height - y)
        for (let tileY = 0; tileY < rows; tileY += tileHeight) {
          const h = Math.min(tileHeight, rows - tileY)
          for (let x = 0; x < frame.width; x += tileWidth) {
            assertScreenshotPlayer(player, signal)
            const w = Math.min(tileWidth, frame.width - x)
            const camera = renderer.camera
            camera.setViewport(w + gutter * 2, h + gutter * 2)
            camera.zoom = frame.zoom
            camera.position.x = frame.left + (x + w / 2) * frame.zoom
            camera.position.y = frame.top - (y + tileY + h / 2) * frame.zoom
            gl.viewport(0, 0, camera.viewportWidth, camera.viewportHeight)
            gl.clear(gl.COLOR_BUFFER_BIT)
            renderer.begin()
            renderer.drawSkeleton(captured.skeleton, captured.config.premultipliedAlpha)
            renderer.end()
            gl.readPixels(gutter, gutter, w, h, gl.RGBA, gl.UNSIGNED_BYTE, tilePixels.subarray(0, w * h * 4))
            if (gl.isContextLost()) throw new Error('The WebGL context was lost during the screenshot.')
            for (let row = 0; row < h; row++) {
              const offset = ((tileY + row) * frame.width + x) * 4
              const input = (h - row - 1) * w * 4
              pixels.set(tilePixels.subarray(input, input + w * 4), offset)
              // Convert the framebuffer's premultiplied RGB to PNG's straight-alpha RGBA.
              for (let column = 0; column < w; column++) {
                const pixel = offset + column * 4
                const alpha = pixels[pixel + 3]
                if (alpha !== 255) {
                  for (let channel = 0; channel < 3; channel++) {
                    pixels[pixel + channel] = alpha ? Math.min(255, Math.round(pixels[pixel + channel] * 255 / alpha)) : 0
                  }
                }
              }
            }
          }
        }
        yield pixels.subarray(0, frame.width * rows * 4)
        // CompressionStream writes can finish in microtasks; yield to the event loop for UI updates and cleanup.
        if (y + rows < frame.height) await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer)
            signal?.removeEventListener('abort', abort)
            reject(signal?.reason)
          }
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', abort)
            resolve()
          }, 0)
          signal?.addEventListener('abort', abort, { once: true })
          if (signal?.aborted) abort()
        })
      }
      assertScreenshotPlayer(player, signal)
    }
    const blob = await encodeRgbaPng(frame.width, frame.height, bands(), signal)
    assertScreenshotPlayer(player, signal)
    return blob
  } finally {
    try {
      state.dispose(renderer)
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(texture)
    } finally {
      packKeys.forEach((key, index) => gl.pixelStorei(key, packValues[index]))
      if (gl2) {
        gl2.bindBuffer(gl2.PIXEL_PACK_BUFFER, packBuffer)
        gl2.bindBuffer(gl2.PIXEL_UNPACK_BUFFER, unpackBuffer)
      }
      if (dither) gl.enable(gl.DITHER)
      else gl.disable(gl.DITHER)
      state.restore()
    }
  }
}
