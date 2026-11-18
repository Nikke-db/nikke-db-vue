export interface RenderSize {
  width: number
  height: number
}

// Pixel budget for the live canvas. Character art is about 2000 px tall,
// so a bigger buffer costs VRAM without adding detail.
export const MAX_LIVE_PIXELS = 4096 * 4096

// Largest size with the wanted aspect ratio that fits the pixel budget and the GPU side limit.
export const fitRenderSize = (wanted: RenderSize, maxPixels: number, maxSide: number): RenderSize => {
  const scale = Math.min(
    1,
    Math.sqrt(maxPixels / (wanted.width * wanted.height)),
    maxSide / wanted.width,
    maxSide / wanted.height
  )

  return {
    width: Math.max(1, Math.floor(wanted.width * scale)),
    height: Math.max(1, Math.floor(wanted.height * scale))
  }
}

// Makes the player render into a bounded buffer. The canvas keeps its CSS size.
export const boundRenderSize = (player: any) => {
  const renderer = player.sceneRenderer
  if (!renderer) return

  const canvas: HTMLCanvasElement = renderer.canvas
  const gl: WebGLRenderingContext = renderer.context.gl
  const maxSide = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS))

  const liveSize = () => {
    const dpr = window.devicePixelRatio || 1
    const displayed = {
      width: Math.round(canvas.clientWidth * dpr),
      height: Math.round(canvas.clientHeight * dpr)
    }
    return fitRenderSize(displayed, MAX_LIVE_PIXELS, maxSide)
  }

  const squareSize = (side: number) => {
    const boundedSide = Math.min(side, maxSide)
    return { width: boundedSide, height: boundedSide }
  }

  renderer.resize = () => {
    const size = player.fixedRenderSide ? squareSize(player.fixedRenderSide) : liveSize()

    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width
      canvas.height = size.height
    }

    // Chrome shrinks any WebGL buffer above 7680x4320 pixels. The viewport
    // uses the size the browser granted, so the scene is never cropped.
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    renderer.camera.setViewport(canvas.width, canvas.height)
    renderer.camera.update()
  }
}

// Draws one square frame for a screenshot and returns the side that was drawn.
export const drawSquareFrame = (player: any, side: number): number => {
  const canvas: HTMLCanvasElement = player.canvas
  const gl: WebGLRenderingContext = player.context.gl

  player.fixedRenderSide = side
  player.drawFrame(false)

  // The browser granted a smaller buffer. Draw again at that size so the PNG is not upscaled.
  if (gl.drawingBufferWidth < canvas.width) {
    player.fixedRenderSide = gl.drawingBufferWidth
    player.drawFrame(false)
  }

  player.fixedRenderSide = 0
  return canvas.width
}
