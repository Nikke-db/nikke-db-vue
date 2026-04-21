// Settings utility functions
// Extracted from ChatInterface.vue — reads localStorage and returns validated plain values.

import { tokenUsageOptions, providerOptions } from '@/utils/llmUtils'

// --- Types ---

/** All settings that can be loaded from localStorage. */
export interface StoredSettings {
  mode?: 'roleplay' | 'story' | 'game'
  playbackMode?: 'auto' | 'manual'
  yapEnabled?: boolean
  hqAssets?: boolean
  ttsEnabled?: boolean
  ttsEndpoint?: string
  ttsProvider?: 'alltalk' | 'gptsovits' | 'chatterbox'
  gptSovitsEndpoint?: string
  gptSovitsBasePath?: string
  chatterboxEndpoint?: string
  tokenUsage?: string
  enableContextCaching?: boolean
  autoCompactSummaries?: boolean
  autoCompactFrequency?: number
  enableAnimationReplay?: boolean
  apiProvider?: string
  model?: string
}

/**
 * Reads all chat-related settings from localStorage and returns them as a
 * validated plain object.  Does NOT touch any refs or do any async work —
 * the caller is responsible for applying the returned values and fetching
 * model lists.
 */
export function loadSettingsFromStorage(): StoredSettings {
  const result: StoredSettings = {}

  const savedMode = localStorage.getItem('nikke_mode')
  if (savedMode === 'roleplay' || savedMode === 'story' || savedMode === 'game') {
    result.mode = savedMode
  }

  const savedPlayback = localStorage.getItem('nikke_playback_mode')
  if (savedPlayback === 'auto' || savedPlayback === 'manual') {
    result.playbackMode = savedPlayback
  }

  const savedYap = localStorage.getItem('nikke_yap_enabled')
  if (savedYap !== null) {
    result.yapEnabled = savedYap === 'true'
  }

  const savedHQAssets = localStorage.getItem('nikke_hq_assets')
  if (savedHQAssets !== null) {
    result.hqAssets = savedHQAssets === 'true'
  } else {
    result.hqAssets = false
  }

  const savedTts = localStorage.getItem('nikke_tts_enabled')
  if (savedTts !== null) {
    result.ttsEnabled = savedTts === 'true'
  }

  const savedTtsEndpoint = localStorage.getItem('nikke_tts_endpoint')
  if (savedTtsEndpoint) {
    result.ttsEndpoint = savedTtsEndpoint
  }

  const savedTtsProvider = localStorage.getItem('nikke_tts_provider')
  if (savedTtsProvider === 'alltalk' || savedTtsProvider === 'gptsovits' || savedTtsProvider === 'chatterbox') {
    result.ttsProvider = savedTtsProvider
  }

  const savedGptSovitsEndpoint = localStorage.getItem('nikke_gptsovits_endpoint')
  if (savedGptSovitsEndpoint) {
    result.gptSovitsEndpoint = savedGptSovitsEndpoint
  }

  const savedGptSovitsBasePath = localStorage.getItem('nikke_gptsovits_basepath')
  if (savedGptSovitsBasePath) {
    result.gptSovitsBasePath = savedGptSovitsBasePath
  }

  const savedChatterboxEndpoint = localStorage.getItem('nikke_chatterbox_endpoint')
  if (savedChatterboxEndpoint) {
    result.chatterboxEndpoint = savedChatterboxEndpoint
  }

  const savedTokenUsage = localStorage.getItem('nikke_token_usage')
  if (savedTokenUsage && tokenUsageOptions.some((t) => t.value === savedTokenUsage)) {
    result.tokenUsage = savedTokenUsage
  }

  const savedContextCaching = localStorage.getItem('nikke_enable_context_caching')
  if (savedContextCaching !== null) {
    result.enableContextCaching = savedContextCaching === 'true'
  }

  const savedAutoCompact = localStorage.getItem('nikke_auto_compact_summaries')
  if (savedAutoCompact !== null) {
    result.autoCompactSummaries = savedAutoCompact !== 'false'
  }

  const savedAutoCompactFreq = localStorage.getItem('nikke_auto_compact_frequency')
  if (savedAutoCompactFreq !== null) {
    const parsed = Number(savedAutoCompactFreq)
    if ([3, 4, 5, 10].includes(parsed)) {
      result.autoCompactFrequency = parsed
    }
  }

  const savedAnimationReplay = localStorage.getItem('nikke_enable_animation_replay')
  result.enableAnimationReplay = savedAnimationReplay !== 'false'

  // Provider + model (raw values — caller must validate model against fetched lists)
  const savedProvider = localStorage.getItem('nikke_api_provider')
  if (savedProvider && providerOptions.some((p) => p.value === savedProvider)) {
    result.apiProvider = savedProvider
  }

  const savedModel = localStorage.getItem('nikke_model')
  if (savedModel) {
    result.model = savedModel
  }

  return result
}

/**
 * Validates a saved model ID against a list of valid models for the provider.
 * Returns the valid model or a provider-specific default.
 */
export function validateSavedModel(savedProvider: string, savedModel: string | undefined, validModels: string[], firstOpenRouterModel?: string): { model: string | undefined; warning?: string } {
  if (savedModel && validModels.includes(savedModel)) {
    return { model: savedModel }
  }

  // Fallback to default
  let fallback: string | undefined
  if (savedProvider === 'gemini') fallback = 'gemini-2.5-flash'
  else if (savedProvider === 'openrouter' && firstOpenRouterModel) fallback = firstOpenRouterModel

  const warning = savedModel ? `Saved model '${savedModel}' is invalid or unavailable. Using default.` : undefined

  return { model: fallback, warning }
}
