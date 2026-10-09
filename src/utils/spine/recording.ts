interface RecordingOptions {
  prepare: () => { canvas: HTMLCanvasElement; restore: () => void }
  signal: AbortSignal
  frameRate: number
  timeSlice: number
  mimeType: string
  videoBitsPerSecond: number
  player: {
    disposed?: boolean
    error?: unknown
    play: () => void
    animationState: { tracks: Array<{ animationLast: number; animationEnd: number } | null> }
  }
}

export function recordCanvasAnimation(options: RecordingOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let surface: ReturnType<RecordingOptions['prepare']> | undefined
    let stream: MediaStream | undefined
    let recorder: MediaRecorder | undefined
    let frame: number | undefined
    let settled = false
    const chunks: BlobPart[] = []

    const finish = (blob?: Blob, error?: unknown) => {
      if (settled) return
      settled = true
      let cleanupError: unknown
      const clean = (action: () => void) => {
        try {
          action()
        } catch (err) {
          cleanupError ??= err
        }
      }
      options.signal.removeEventListener('abort', abort)
      if (frame !== undefined) clean(() => cancelAnimationFrame(frame!))
      if (recorder) {
        recorder.onstart = null
        recorder.onstop = null
        recorder.onerror = null
        recorder.ondataavailable = null
        clean(() => {
          if (recorder!.state !== 'inactive') recorder!.stop()
        })
      }
      stream?.getTracks().forEach((track) => clean(() => track.stop()))
      if (surface) clean(surface.restore)
      if (blob && !cleanupError) resolve(blob)
      else reject(error ?? cleanupError ?? new Error('Recording failed.'))
    }

    const abort = () => finish(undefined, new DOMException('Recording aborted.', 'AbortError'))
    const poll = () => {
      if (settled) return
      frame = undefined
      try {
        if (options.player.disposed || options.player.error) throw new Error('Spine player is unavailable.')
        const track = options.player.animationState?.tracks?.[0]
        if (!track) throw new Error('Animation track is unavailable.')
        if (track.animationLast >= track.animationEnd) recorder!.stop()
        else frame = requestAnimationFrame(poll)
      } catch (error) {
        finish(undefined, error)
      }
    }

    if (options.signal.aborted) {
      abort()
      return
    }
    try {
      surface = options.prepare()
      if (options.signal.aborted) {
        abort()
        return
      }
      stream = surface.canvas.captureStream(options.frameRate)
      recorder = new MediaRecorder(stream, {
        mimeType: options.mimeType,
        videoBitsPerSecond: options.videoBitsPerSecond
      })
      recorder.ondataavailable = (event) => {
        if (!settled && event.data.size) chunks.push(event.data)
      }
      recorder.onerror = (event) => finish(undefined, event)
      recorder.onstop = () => {
        try {
          finish(new Blob(chunks, { type: options.mimeType }))
        } catch (error) {
          finish(undefined, error)
        }
      }
      recorder.onstart = () => {
        if (settled) return
        try {
          if (options.player.disposed || options.player.error) throw new Error('Spine player is unavailable.')
          options.player.play()
          if (!settled) frame = requestAnimationFrame(poll)
        } catch (error) {
          finish(undefined, error)
        }
      }
      options.signal.addEventListener('abort', abort, { once: true })
      if (options.signal.aborted) abort()
      else recorder.start(options.timeSlice)
    } catch (error) {
      finish(undefined, error)
    }
  })
}
