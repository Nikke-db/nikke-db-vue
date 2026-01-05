// Overlay / touch helpers used by the Nikke overlay
export const isInteractiveOverlayTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest(
    '.nikke-overlay-controls, .game-choices-overlay, button, a, input, textarea, select, [role="button"], [contenteditable="true"]'
  )
}

export const isSpineCanvasAtPoint = (x: number, y: number): boolean => {
  const overlay = document.querySelector('.nikke-chat-overlay') as HTMLElement | null
  if (!overlay) return false

  // Temporarily disable overlay hit-testing to see what's underneath.
  const prevPointerEvents = overlay.style.pointerEvents
  overlay.style.pointerEvents = 'none'
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  overlay.style.pointerEvents = prevPointerEvents

  if (!el) return false

  // Only allow pass-through if the actual canvas is under the finger.
  if (el instanceof HTMLCanvasElement) return !!el.closest('#player-container')
  const canvas = el.closest('#player-container canvas')
  return canvas instanceof HTMLCanvasElement
}

export const getEventPoint = (e: MouseEvent | TouchEvent) => {
  if ('touches' in e) {
    const t = e.touches[0] || (e.changedTouches ? e.changedTouches[0] : null)
    return t ? { x: t.clientX, y: t.clientY, touches: e.touches.length } : { x: 0, y: 0, touches: 0 }
  }
  return { x: e.clientX, y: e.clientY, touches: 0 }
}