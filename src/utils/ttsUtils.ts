import { ref } from 'vue'

export type TTSProvider = 'alltalk' | 'gptsovits' | 'chatterbox'

export const ttsProviderOptions = [
  { label: 'AllTalk (XTTSv2)', value: 'alltalk' },
  { label: 'GPT-SoVits', value: 'gptsovits' },
  { label: 'Chatterbox TTS', value: 'chatterbox' }
]

// TTS State
export const ttsEnabled = ref(localStorage.getItem('nikke_tts_enabled') === 'true')
export const ttsEndpoint = ref(localStorage.getItem('nikke_tts_endpoint') || 'http://localhost:7851')
export const ttsProvider = ref<TTSProvider>((localStorage.getItem('nikke_tts_provider') as TTSProvider) || 'alltalk')
export const gptSovitsEndpoint = ref(localStorage.getItem('nikke_gptsovits_endpoint') || 'http://localhost:9880')
export const gptSovitsBasePath = ref(localStorage.getItem('nikke_gptsovits_basepath') || 'C:/GPT-SoVITS')
export const gptSovitsPromptTextCache = new Map<string, string>()
export const chatterboxEndpoint = ref(localStorage.getItem('nikke_chatterbox_endpoint') || 'http://localhost:7860')
export const chatterboxVoicesPath = ref(localStorage.getItem('nikke_chatterbox_voices_path') || 'C:/chatterbox-tts-api/voices')

// Helper for debug logging
const logDebug = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

export const playTTSGptSovits = async (text: string, characterName: string, market: any) => {
  // Clean up character name to match folder/filename
  // e.g. "Anis: Sparkling Summer" -> "anis_sparkling_summer"
  const cleanName = characterName.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')

  logDebug(`[TTS-GPTSoVits] Requesting TTS for ${characterName} (${cleanName})`)

  try {
    let baseUrl = gptSovitsEndpoint.value
    baseUrl = baseUrl.replace(/\/$/, '')

    // Handle CORS in dev mode by using Vite proxy
    if (import.meta.env.DEV && (baseUrl.includes('localhost:9880') || baseUrl.includes('127.0.0.1:9880'))) {
      baseUrl = '/gptsovits'
    }

    // Construct paths for reference audio and prompt text
    // User must place files at: {basePath}/GPT_SoVITS/voices/{character}/{character}.wav
    // And prompt text at: {basePath}/GPT_SoVITS/voices/{character}/{character}.txt
    // Clean up the base path: remove trailing slashes/backslashes, normalize to forward slashes
    const basePath = gptSovitsBasePath.value
      .replace(/[\\/]+$/, '')  // Remove trailing slashes (both / and \)
      .replace(/\\/g, '/')     // Convert backslashes to forward slashes
    const refAudioPath = `${basePath}/GPT_SoVITS/voices/${cleanName}/${cleanName}.wav`
    const promptTextPath = `${basePath}/GPT_SoVITS/voices/${cleanName}/${cleanName}.txt`

    // Fetch prompt text from cache or API
    let promptText = gptSovitsPromptTextCache.get(cleanName)
    if (!promptText) {
      try {
        const promptResponse = await fetch(`${baseUrl}/read_prompt_text?path=${encodeURIComponent(promptTextPath)}`)
        if (promptResponse.ok) {
          const promptData = await promptResponse.json()
          promptText = promptData.text || ''
          if (promptText) {
            gptSovitsPromptTextCache.set(cleanName, promptText)
            logDebug(`[TTS-GPTSoVits] Loaded prompt text for ${cleanName}: "${promptText}"`)
          }
        } else {
          console.warn(`[TTS-GPTSoVits] Could not fetch prompt text for ${cleanName}`)
          promptText = ''
        }
      } catch (e) {
        console.warn(`[TTS-GPTSoVits] Error fetching prompt text for ${cleanName}:`, e)
        promptText = ''
      }
    }

    // Call the TTS endpoint
    const payload = {
      text: text,
      text_lang: 'en',
      text_split_method: 'cut0',
      ref_audio_path: refAudioPath,
      prompt_text: promptText,
      prompt_lang: 'en',
      media_type: 'wav',
      streaming_mode: false,
      top_k: 10,
      top_p: 0.8,
      temperature: 0.8,
      speed_factor: 1.0
    }

    logDebug(`[TTS-GPTSoVits] Calling ${baseUrl}/tts with payload:`, payload)

    const response = await fetch(`${baseUrl}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text()
      console.warn(`[TTS-GPTSoVits] API Error: ${response.status} - ${errText}`)

      return
    }

    // Response is audio blob
    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    audio.volume = 1.0

    // Sync yapping with audio
    audio.onplay = () => {
      market.live2d.isYapping = true
    }
    audio.onended = () => {
      market.live2d.isYapping = false
      URL.revokeObjectURL(audioUrl) // Clean up
    }
    audio.onerror = () => {
      market.live2d.isYapping = false
      URL.revokeObjectURL(audioUrl)
    }

    audio.play().catch((e) => {
      console.warn('[TTS-GPTSoVits] Playback failed:', e)
      market.live2d.isYapping = false
      URL.revokeObjectURL(audioUrl)
    })
  } catch (e) {
    console.warn('[TTS-GPTSoVits] Error:', e)
  }
}

export const playTTSChatterbox = async (text: string, characterName: string, market: any) => {
  // Clean up character name to match voice file
  const cleanName = characterName.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')

  logDebug(`[TTS-Chatterbox] Requesting TTS for ${characterName} (${cleanName})`)  

  try {
    let baseUrl = chatterboxEndpoint.value
    baseUrl = baseUrl.replace(/\/$/, '')

    if (import.meta.env.DEV && (baseUrl.includes('localhost:7860') || baseUrl.includes('127.0.0.1:7860'))) {
      baseUrl = '/chatterbox'
    }

    const voicePreset = characterName 
      ? `${cleanName}.wav` 
      : ""  // Empty string for default voice (no cloning)

    const callGenerate = async (preset: string): Promise<string | null> => {  // Renamed param for clarity
      const startPayload = {
        data: [
          null,          // 1. State
          text,          // 2. Text to synthesize
          null,          // 3. Reference Audio (null - no upload; using preset instead)
          preset,        // 4. Voice Preset filename (string, e.g., "anis_sparkling_summer.wav" or "")
          0.8,           // 5. Temperature
          0,             // 6. Random seed
          0.0,           // 7. Min P
          0.95,          // 8. Top P
          1000,          // 9. Top K
          1.2,           // 10. Repetition Penalty
          true           // 11. Normalize loudness
        ]
      }

      logDebug(`[TTS-Chatterbox] Calling ${baseUrl}/gradio_api/call/generate with payload:`, startPayload)

      const startResponse = await fetch(`${baseUrl}/gradio_api/call/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(startPayload)
      })

      if (!startResponse.ok) {
        const errText = await startResponse.text()
        console.warn(`[TTS-Chatterbox] API Error (start): ${startResponse.status} - ${errText}`)
        return null
      }

      const startResult = await startResponse.json()
      const eventId: string | undefined = startResult?.event_id
      if (!eventId) {
        console.warn('[TTS-Chatterbox] Missing event_id in response:', startResult)
        return null
      }

      const sseResponse = await fetch(`${baseUrl}/gradio_api/call/generate/${encodeURIComponent(eventId)}`)
      if (!sseResponse.ok) {
        const errText = await sseResponse.text()
        console.warn(`[TTS-Chatterbox] API Error (sse): ${sseResponse.status} - ${errText}`)
        return null
      }

      const sseText = await sseResponse.text()
      let currentEvent = ''
      let completeData: string | null = null
      let sawErrorEvent = false
      for (const rawLine of sseText.split(/\r?\n/)) {
        const line = rawLine.trimEnd()
        if (line.startsWith('event:')) {
          currentEvent = line.slice('event:'.length).trim()
          if (currentEvent === 'error') sawErrorEvent = true
          continue
        }
        if (line.startsWith('data:')) {
          const payload = line.slice('data:'.length).trim()
          if (currentEvent === 'complete') {
            completeData = payload
          }
        }
      }

      if (!completeData) {
        if (sawErrorEvent) {
          console.warn('[TTS-Chatterbox] Gradio returned event:error. This often means the reference audio path was invalid or not allowed by Gradio allowed_paths.')
        }
        console.warn('[TTS-Chatterbox] No complete data in SSE response:', sseText)
        return null
      }

      try {
        const data = JSON.parse(completeData)
        const audioUrl = data?.[0]?.url
        return audioUrl || null
      } catch (e) {
        console.warn('[TTS-Chatterbox] Failed to parse SSE complete data:', completeData, e)
        return null
      }
    }

    // Single call – server auto-fallbacks if preset invalid
    let audioUrl = await callGenerate(voicePreset)

    if (!audioUrl) {
      logDebug('[TTS-Chatterbox] Retrying with explicit default voice.')
      audioUrl = await callGenerate("")  // Force default (no cloning)
    }

    if (!audioUrl) {
      return
    }

    // When using the Vite proxy, rewrite returned absolute URLs to go through it.
    // This avoids cross-origin fetch issues in dev.
    if (import.meta.env.DEV && baseUrl === '/chatterbox') {
      audioUrl = audioUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1):7860/i, '')
      if (!audioUrl.startsWith('/')) audioUrl = `/${audioUrl}`
      audioUrl = `/chatterbox${audioUrl}`
    }

    logDebug(`[TTS-Chatterbox] Received audio URL: ${audioUrl}`)

    // Play the audio
    const audio = new Audio(audioUrl)
    audio.volume = 1.0

    // Sync yapping with audio
    audio.onplay = () => {
      market.live2d.isYapping = true
    }
    audio.onended = () => {
      market.live2d.isYapping = false
    }
    audio.onerror = () => {
      market.live2d.isYapping = false
    }

    audio.play().catch((e) => {
      console.warn('[TTS-Chatterbox] Playback failed:', e)
      market.live2d.isYapping = false
    })
  } catch (e) {
    console.warn('[TTS-Chatterbox] Error:', e)
  }
}

export const playTTS = async (text: string, characterName: string, market: any) => {
  if (!ttsEnabled.value || !characterName) return

  if (ttsProvider.value === 'gptsovits') {
    return playTTSGptSovits(text, characterName, market)
  }

  if (ttsProvider.value === 'chatterbox') {
    return playTTSChatterbox(text, characterName, market)
  }

  // AllTalk implementation (default)
  // Clean up character name to match filename
  // Remove special chars, replace spaces with underscores
  // e.g. "Anis: Sparkling Summer" -> "anis_sparkling_summer.wav"
  const cleanName = characterName.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')
  const voiceFile = `${cleanName}.wav`

  logDebug(`[TTS] Requesting TTS for ${characterName} (${voiceFile})`)

  try {
    let baseUrl = ttsEndpoint.value
    // Clean up the base URL to ensure we have the root (remove /v1, /api, trailing slashes)
    baseUrl = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '').replace(/\/api$/, '')

    // Handle CORS in dev mode by using Vite proxy
    // This requires the proxy to be configured in vite.config.ts
    if (import.meta.env.DEV && (baseUrl.includes('localhost:7851') || baseUrl.includes('127.0.0.1:7851'))) {
      baseUrl = '/alltalk'
    }

    // Use Standard API via proxy (better support for custom filenames)
    const url = `${baseUrl}/api/tts-generate`

    logDebug(`[TTS] Calling URL: ${url}`)

    const params = new URLSearchParams()
    params.append('text_input', text)
    params.append('character_voice_gen', voiceFile)
    params.append('narrator_enabled', 'false')
    params.append('text_not_inside', 'character')
    params.append('language', 'en')
    params.append('output_file_name', 'nikke_tts_gen')
    params.append('output_file_timestamp', 'true')
    params.append('autoplay', 'false')
    params.append('autoplay_volume', '0.8')
    params.append('text_filtering', 'standard')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[TTS] API Error: ${response.status} - ${errText}`)
      return
    }

    const data = await response.json()

    if (data.status === 'generate-success' && data.output_file_url) {
      // Construct audio URL using the same base (proxy or direct)
      // data.output_file_url usually starts with /audio/
      const audioUrl = `${baseUrl}${data.output_file_url}`
      const audio = new Audio(audioUrl)
      audio.volume = 1.0

      // Sync yapping with audio
      audio.onplay = () => {
        market.live2d.isYapping = true
      }
      audio.onended = () => {
        market.live2d.isYapping = false
      }
      audio.onerror = () => {
        market.live2d.isYapping = false
      }

      audio.play().catch((e) => {
        console.error('[TTS] Playback failed:', e)
        market.live2d.isYapping = false
      })
    }
  } catch (e) {
    console.error('[TTS] Error:', e)
  }
}