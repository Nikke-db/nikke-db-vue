import { describe, expect, it } from 'vitest'
import { getCameraScreenScale, getPresentationSize } from './camera'

describe('camera pointer scaling', () => {
  it.each([
    [3200, 2000, 1280, 800, 2.5],
    [1920, 1200, 1280, 800, 1.5],
    [4096, 2560, 2560, 1600, 1.6],
    [2048, 1280, 2560, 1600, 0.8],
    [975, 2110, 195, 422, 5]
  ])('uses the actual render/presentation ratio for %sx%s', (width, height, cssWidth, cssHeight, scale) => {
    expect(getCameraScreenScale(
      { viewportWidth: width, viewportHeight: height },
      { width: cssWidth, height: cssHeight }
    )).toEqual({ x: scale, y: scale })
  })

  it('handles independently rounded axes and zero-sized layout', () => {
    expect(getCameraScreenScale(
      { viewportWidth: 975, viewportHeight: 2110 },
      { width: 0, height: 0 }
    )).toEqual({ x: 975, y: 2110 })
  })

  it.each([
    [1920, 1080, 2, 4096, 3840, 2160],
    [3840, 2160, 3, 4096, 4096, 2304],
    [8000, 8000, 2, 4096, 4096, 4096],
    [390, 844, 3, 2048, 946, 2048]
  ])('bounds presentation memory for %sx%s at DPR %s', (width, height, dpr, limit, expectedWidth, expectedHeight) => {
    expect(getPresentationSize(width, height, dpr, limit)).toEqual({
      width: expectedWidth,
      height: expectedHeight
    })
  })
})
