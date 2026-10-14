export function getCameraScreenScale(
  camera: { viewportWidth: number; viewportHeight: number },
  rect: { width: number; height: number }
) {
  return {
    x: camera.viewportWidth / Math.max(1, rect.width),
    y: camera.viewportHeight / Math.max(1, rect.height)
  }
}

export function getPresentationSize(width: number, height: number, dpr: number, maxDimension: number) {
  const scale = Math.min(dpr, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}
