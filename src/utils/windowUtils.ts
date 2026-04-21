// Window management utilities: dragging, resizing, viewport zoom lock, and scroll lock.
// Extracted from ChatInterface.vue to keep the component lean.

import type { Ref } from 'vue'

// ── Types ──────────────────────────────────────────────────────────────

export type WindowPosition = { x: number; y: number }
export type WindowSize = { width: number; height: number }
export type ResizeStartState = { x: number; y: number; width: number; height: number; initialX: number; initialY: number }

export type WindowRefs = {
  chatPosition: Ref<WindowPosition>
  chatSize: Ref<WindowSize>
  isDragging: Ref<boolean>
  isResizing: Ref<boolean>
  resizeDirection: Ref<string>
  dragOffset: Ref<WindowPosition>
  resizeStart: Ref<ResizeStartState>
}

// ── Chat window layout ────────────────────────────────────────────────

export const initChatLayout = (chatSize: Ref<WindowSize>, chatPosition: Ref<WindowPosition>) => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (viewportWidth <= 768) {
    // Mobile default: Bottom sheet style
    const width = Math.min(viewportWidth - 20, 400)
    const height = viewportHeight * 0.5
    chatSize.value = { width, height }
    chatPosition.value = {
      x: (viewportWidth - width) / 2,
      y: viewportHeight - height - 20
    }
  } else {
    // Desktop default
    chatSize.value = { width: 400, height: 600 }
    chatPosition.value = { x: 300, y: viewportHeight - 620 }
  }
}

// ── Dragging ──────────────────────────────────────────────────────────

export const createDragHandlers = (refs: Pick<WindowRefs, 'chatPosition' | 'chatSize' | 'isDragging' | 'dragOffset'>) => {
  const onDrag = (e: MouseEvent | TouchEvent) => {
    if (!refs.isDragging.value) return

    // Safety check: if mouse button is not pressed, stop dragging
    if (e instanceof MouseEvent && e.buttons === 0) {
      stopDrag()
      return
    }

    e.preventDefault()

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

    let newX = clientX - refs.dragOffset.value.x
    let newY = clientY - refs.dragOffset.value.y

    // Boundaries
    const maxX = window.innerWidth - 50 // Keep at least 50px visible
    const maxY = window.innerHeight - 50

    newX = Math.max(-refs.chatSize.value.width + 50, Math.min(newX, maxX))
    newY = Math.max(0, Math.min(newY, maxY))

    refs.chatPosition.value = { x: newX, y: newY }
  }

  const stopDrag = () => {
    refs.isDragging.value = false
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('touchmove', onDrag)
    window.removeEventListener('mouseup', stopDrag)
    window.removeEventListener('touchend', stopDrag)
  }

  const startDrag = (e: MouseEvent | TouchEvent) => {
    // Only allow dragging from the handle
    if ((e.target as HTMLElement).closest('.window-controls') || (e.target as HTMLElement).closest('.n-button')) return

    // Prevent default to avoid text selection which can interfere with mouseup events
    if (e instanceof MouseEvent) {
      e.preventDefault()
    }

    refs.isDragging.value = true
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

    refs.dragOffset.value = {
      x: clientX - refs.chatPosition.value.x,
      y: clientY - refs.chatPosition.value.y
    }

    window.addEventListener('mousemove', onDrag)
    window.addEventListener('touchmove', onDrag, { passive: false })
    window.addEventListener('mouseup', stopDrag)
    window.addEventListener('touchend', stopDrag)
  }

  return { startDrag, onDrag, stopDrag }
}

// ── Resizing ──────────────────────────────────────────────────────────

export const createResizeHandlers = (refs: Pick<WindowRefs, 'chatPosition' | 'chatSize' | 'isResizing' | 'resizeDirection' | 'resizeStart'>) => {
  const onResize = (e: MouseEvent | TouchEvent) => {
    if (!refs.isResizing.value) return

    if (e instanceof MouseEvent && e.buttons === 0) {
      stopResize()
      return
    }

    e.preventDefault()

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

    const deltaX = clientX - refs.resizeStart.value.x
    const deltaY = clientY - refs.resizeStart.value.y

    let newWidth = refs.resizeStart.value.width
    let newHeight = refs.resizeStart.value.height
    let newX = refs.resizeStart.value.initialX
    let newY = refs.resizeStart.value.initialY

    const dir = refs.resizeDirection.value

    // Horizontal
    if (dir.includes('e')) {
      newWidth += deltaX
    } else if (dir.includes('w')) {
      newWidth -= deltaX
      newX += deltaX
    }

    // Vertical
    if (dir.includes('s')) {
      newHeight += deltaY
    } else if (dir.includes('n')) {
      newHeight -= deltaY
      newY += deltaY
    }

    // Min dimensions
    const minWidth = 300
    const minHeight = 200

    if (newWidth < minWidth) {
      if (dir.includes('w')) newX = refs.resizeStart.value.initialX + (refs.resizeStart.value.width - minWidth)
      newWidth = minWidth
    }

    if (newHeight < minHeight) {
      if (dir.includes('n')) newY = refs.resizeStart.value.initialY + (refs.resizeStart.value.height - minHeight)
      newHeight = minHeight
    }

    refs.chatSize.value = { width: newWidth, height: newHeight }
    refs.chatPosition.value = { x: newX, y: newY }
  }

  const stopResize = () => {
    refs.isResizing.value = false
    window.removeEventListener('mousemove', onResize)
    window.removeEventListener('touchmove', onResize)
    window.removeEventListener('mouseup', stopResize)
    window.removeEventListener('touchend', stopResize)
  }

  const startResize = (e: MouseEvent | TouchEvent, direction: string) => {
    e.stopPropagation()
    e.preventDefault()
    refs.isResizing.value = true
    refs.resizeDirection.value = direction

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

    refs.resizeStart.value = {
      x: clientX,
      y: clientY,
      width: refs.chatSize.value.width,
      height: refs.chatSize.value.height,
      initialX: refs.chatPosition.value.x,
      initialY: refs.chatPosition.value.y
    }

    window.addEventListener('mousemove', onResize)
    window.addEventListener('touchmove', onResize, { passive: false })
    window.addEventListener('mouseup', stopResize)
    window.addEventListener('touchend', stopResize)
  }

  return { startResize, onResize, stopResize }
}

// ── Mobile viewport / scroll lock ─────────────────────────────────────

export const createViewportHandlers = () => {
  let originalViewportMetaContent: string | null = null
  let viewportMetaWasModified = false
  let originalBodyStyle: Partial<CSSStyleDeclaration> | null = null
  let originalHtmlOverflow: string | null = null
  let scrollLockY = 0

  const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches

  const restoreViewportZoom = () => {
    if (typeof document === 'undefined') return
    if (!viewportMetaWasModified) return

    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) return

    if (originalViewportMetaContent !== null) {
      meta.setAttribute('content', originalViewportMetaContent)
    }

    viewportMetaWasModified = false
  }

  const preventMobileZoomOnThisView = () => {
    if (typeof document === 'undefined') return
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!meta) return

    if (originalViewportMetaContent === null) {
      originalViewportMetaContent = meta.getAttribute('content') || ''
    }

    if (!isMobileViewport()) return

    // Prevent browser page zoom so Spine's custom pinch-zoom can work reliably.
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    viewportMetaWasModified = true
  }

  const lockMobilePageScroll = () => {
    if (typeof document === 'undefined') return
    if (!isMobileViewport()) return

    const html = document.documentElement
    const body = document.body
    if (!body) return

    scrollLockY = window.scrollY || window.pageYOffset || 0

    if (originalBodyStyle === null) {
      originalBodyStyle = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
        overscrollBehavior: (body.style as any).overscrollBehavior
      }
    }
    if (originalHtmlOverflow === null) {
      originalHtmlOverflow = html.style.overflow
    }

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    ;(body.style as any).overscrollBehavior = 'none'
    body.style.position = 'fixed'
    body.style.top = `-${scrollLockY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
  }

  const unlockMobilePageScroll = () => {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    const body = document.body
    if (!body) return

    if (originalHtmlOverflow !== null) {
      html.style.overflow = originalHtmlOverflow
      originalHtmlOverflow = null
    }

    if (originalBodyStyle) {
      body.style.position = originalBodyStyle.position || ''
      body.style.top = originalBodyStyle.top || ''
      body.style.left = originalBodyStyle.left || ''
      body.style.right = originalBodyStyle.right || ''
      body.style.width = originalBodyStyle.width || ''
      body.style.overflow = originalBodyStyle.overflow || ''
      ;(body.style as any).overscrollBehavior = (originalBodyStyle as any).overscrollBehavior || ''
      originalBodyStyle = null
    }

    if (scrollLockY) {
      window.scrollTo(0, scrollLockY)
    }
    scrollLockY = 0
  }

  return { restoreViewportZoom, preventMobileZoomOnThisView, lockMobilePageScroll, unlockMobilePageScroll }
}
