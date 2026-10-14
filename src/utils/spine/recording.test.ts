import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordCanvasAnimation } from './recording'

describe('animation recording lifecycle', () => {
  let recorder: FakeRecorder
  let controller: AbortController
  let frames: Map<number, FrameRequestCallback>
  let nextFrame: number
  let player: {
    disposed: boolean
    error: Error | null
    play: () => void
    animationState: { tracks: Array<{ animationLast: number; animationEnd: number }> }
  }
  const restore = vi.fn()
  const stopTrack = vi.fn()
  const onStart = vi.fn()
  const captureStream = vi.fn(() => ({ getTracks: () => [{ stop: stopTrack }] }))
  const failure = new Error('Recorder failed')
  let constructorFails = false
  let startFails = false

  class FakeRecorder {
    state = 'inactive'
    onstart: (() => void) | null = null
    onstop: (() => void) | null = null
    onerror: ((error: unknown) => void) | null = null
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    start = vi.fn(() => {
      if (startFails) throw failure
      this.state = 'recording'
      this.onstart?.()
    })
    stop = vi.fn(() => {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['last frame']) })
      this.onstop?.()
    })
    constructor() {
      if (constructorFails) throw failure
      recorder = this
    }
  }

  const record = (prepare = () => ({ canvas: { captureStream } as unknown as HTMLCanvasElement, restore })) => recordCanvasAnimation({
    prepare,
    signal: controller.signal,
    frameRate: 30,
    timeSlice: 10,
    mimeType: 'video/webm',
    videoBitsPerSecond: 10000000,
    player
  })

  const tick = () => {
    const pending = [...frames.entries()]
    frames.clear()
    pending.forEach(([, callback]) => callback(0))
  }

  beforeEach(() => {
    vi.resetAllMocks()
    controller = new AbortController()
    frames = new Map()
    nextFrame = 0
    constructorFails = false
    startFails = false
    captureStream.mockImplementation(() => ({ getTracks: () => [{ stop: stopTrack }] }))
    player = {
      disposed: false,
      error: null,
      play: onStart,
      animationState: { tracks: [{ animationLast: -1, animationEnd: 1 }] }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder)
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((frame: number) => frames.delete(frame)))
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('restores after synchronous capture failure', async () => {
    captureStream.mockImplementation(() => { throw failure })
    await expect(record()).rejects.toBe(failure)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(stopTrack).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('stops capture tracks and restores after constructor failure', async () => {
    constructorFails = true
    await expect(record()).rejects.toBe(failure)
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })

  it('stops capture tracks and restores after start failure', async () => {
    startFails = true
    await expect(record()).rejects.toBe(failure)
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(recorder.onstop).toBeNull()
    expect(frames.size).toBe(0)
  })

  it('cleans up once after an asynchronous recorder error and ignores late callbacks', async () => {
    const promise = record()
    const lateStop = recorder.onstop!
    const lateStart = recorder.onstart!
    const lateError = recorder.onerror!
    const lateFrame = [...frames.values()][0]
    lateError(failure)
    await expect(promise).rejects.toBe(failure)
    lateStop()
    lateStart()
    lateFrame(0)
    lateError(failure)
    controller.abort()
    expect(recorder.stop).toHaveBeenCalledTimes(1)
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })

  it('aborts active recording synchronously and cancels completion polling', async () => {
    const promise = record()
    controller.abort()
    expect(recorder.state).toBe('inactive')
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('does not prepare or capture an already aborted recording', async () => {
    controller.abort()
    await expect(record()).rejects.toMatchObject({ name: 'AbortError' })
    expect(captureStream).not.toHaveBeenCalled()
    expect(restore).not.toHaveBeenCalled()
  })

  it('restores if preparation itself causes navigation cancellation', async () => {
    const promise = record(() => {
      controller.abort()
      return { canvas: { captureStream } as unknown as HTMLCanvasElement, restore }
    })
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(captureStream).not.toHaveBeenCalled()
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it('does not rearm completion polling after playback causes cancellation', async () => {
    onStart.mockImplementation(() => controller.abort())
    await expect(record()).rejects.toMatchObject({ name: 'AbortError' })
    expect(recorder.stop).toHaveBeenCalledTimes(1)
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })

  it.each([1, 1.1])('finishes at or beyond animationEnd (%s), includes final data, and cleans up once', async (last) => {
    const promise = record()
    recorder.ondataavailable?.({ data: new Blob(['first frame']) })
    tick()
    expect(recorder.stop).not.toHaveBeenCalled()
    expect(frames.size).toBe(1)
    player.animationState.tracks[0].animationLast = last
    tick()
    const blob = await promise
    expect(blob.type).toBe('video/webm')
    expect(blob.size).toBe(21)
    expect(recorder.stop).toHaveBeenCalledTimes(1)
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
    controller.abort()
    expect(restore).toHaveBeenCalledTimes(1)
  })

  it.each(['disposed', 'error'])('cleans up when player %s makes completion polling fail', async (state) => {
    const promise = record()
    if (state === 'disposed') player.disposed = true
    else player.error = failure
    tick()
    await expect(promise).rejects.toThrow('Spine player is unavailable.')
    expect(recorder.stop).toHaveBeenCalledTimes(1)
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })

  it('cleans up when starting player playback throws', async () => {
    onStart.mockImplementation(() => { throw failure })
    await expect(record()).rejects.toBe(failure)
    expect(recorder.stop).toHaveBeenCalledTimes(1)
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })

  it('stops tracks even when surface restoration throws', async () => {
    restore.mockImplementation(() => { throw failure })
    const promise = record()
    player.animationState.tracks[0].animationLast = 1
    tick()
    await expect(promise).rejects.toBe(failure)
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
  })
})
