export type SpineCanvasPlacement = {
  left?: string
  top?: string
  transform?: string
}

export const getSpineCanvas = (): HTMLCanvasElement | null => {
  const container = document.querySelector('#player-container')
  const canvas = container?.querySelector('canvas')
  return canvas instanceof HTMLCanvasElement ? canvas : null
}

export const captureSpineCanvasPlacement = (): SpineCanvasPlacement | null => {
  if (typeof document === 'undefined') return null
  const canvas = getSpineCanvas()
  if (!canvas) return null
  return {
    left: canvas.style.left,
    top: canvas.style.top,
    transform: canvas.style.transform,
  }
}

export const restoreSpineCanvasPlacement = async (placement: SpineCanvasPlacement | null) => {
  if (!placement || typeof document === 'undefined') return

  // Wait a few frames for the new canvas to exist after a character switch.
  for (let i = 0; i < 30; i++) {
    const canvas = getSpineCanvas()
    if (canvas) {
      if (placement.left) canvas.style.left = placement.left
      if (placement.top) canvas.style.top = placement.top
      if (placement.transform) canvas.style.transform = placement.transform
      return
    }
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }
}