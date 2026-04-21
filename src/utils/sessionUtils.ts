// Session save/restore utility functions
// Extracted from ChatInterface.vue to keep serialization logic testable and reusable.

import { tokenUsageOptions, providerOptions } from '@/utils/llmUtils'
import { type StoryCharacterEntry } from '@/utils/storyCharacterUtils'

// --- Types ---

export interface ChatMessage {
  role: string
  content: string
  animation?: string
  character?: string
  speaking?: boolean
  text?: string
}

export interface SessionSettings {
  apiProvider: string
  model: string
  playbackMode: string
  yapEnabled: boolean
  ttsEnabled: boolean
  ttsEndpoint: string
  ttsProvider: string
  gptSovitsEndpoint: string
  gptSovitsBasePath: string
  tokenUsage: string
  enableContextCaching: boolean
  useLocalProfiles: boolean
  allowWebSearchFallback: boolean
  reasoningEffort: string
  autoCompactSummaries: boolean
  autoCompactFrequency: number
}

export interface SessionData {
  chatHistory: any[]
  characterProfiles: Record<string, string>
  characterProgression: any
  storySummary: string
  lastSummarizedIndex: number
  summarizationSuccessCount: number
  summaryJustCompacted: boolean
  mode: string
  timestamp: string
  rosterRows: StoryCharacterEntry[]
  settings: SessionSettings
}

/** Parameters for building the session export data. */
export interface BuildSessionExportParams {
  chatHistory: ChatMessage[]
  characterProfiles: Record<string, string>
  characterProgression: any
  storySummary: string
  lastSummarizedIndex: number
  summarizationSuccessCount: number
  summaryJustCompacted: boolean
  mode: string
  rosterRows: StoryCharacterEntry[]
  enableAnimationReplay: boolean
  apiProvider: string
  model: string
  playbackMode: string
  yapEnabled: boolean
  ttsEnabled: boolean
  ttsEndpoint: string
  ttsProvider: string
  gptSovitsEndpoint: string
  gptSovitsBasePath: string
  tokenUsage: string
  enableContextCaching: boolean
  useLocalProfiles: boolean
  allowWebSearchFallback: boolean
  reasoningEffort: string
  autoCompactSummaries: boolean
  autoCompactFrequency: number
}

// --- Export (save) helpers ---

/**
 * Returns true if a system message should be excluded from exported session files
 * (e.g. "Session restored successfully." or model-unavailable warnings).
 */
export function shouldExcludeFromExport(msg: any): boolean {
  if (msg?.role !== 'system' || typeof msg?.content !== 'string') return false

  const content = msg.content

  if (content === 'Session restored successfully.') return true
  if (content.startsWith('Warning: Saved model \'') && content.endsWith('Using default.')) return true

  return false
}

/**
 * Builds the plain JSON-serialisable session data object from the supplied
 * component state.  This is a pure function with no side-effects.
 */
export function buildSessionExportData(params: BuildSessionExportParams): SessionData {
  const exportedChatHistory = params.chatHistory
    .filter((msg) => !shouldExcludeFromExport(msg))
    .map((msg) => {
      if (!params.enableAnimationReplay) {
        // Old format: just role and content
        return { role: msg.role, content: msg.content }
      } else {
        // New format: remove content if text is present to save space
        if (msg.role === 'assistant' && msg.text) {
          const rest = { ...msg }
          delete (rest as any).content
          return rest
        }
        return msg
      }
    })

  return {
    chatHistory: exportedChatHistory,
    characterProfiles: params.characterProfiles,
    characterProgression: params.characterProgression,
    storySummary: params.storySummary,
    lastSummarizedIndex: params.lastSummarizedIndex,
    summarizationSuccessCount: params.summarizationSuccessCount,
    summaryJustCompacted: params.summaryJustCompacted,
    mode: params.mode,
    timestamp: new Date().toISOString(),
    rosterRows: params.rosterRows,
    settings: {
      apiProvider: params.apiProvider,
      model: params.model,
      playbackMode: params.playbackMode,
      yapEnabled: params.yapEnabled,
      ttsEnabled: params.ttsEnabled,
      ttsEndpoint: params.ttsEndpoint,
      ttsProvider: params.ttsProvider,
      gptSovitsEndpoint: params.gptSovitsEndpoint,
      gptSovitsBasePath: params.gptSovitsBasePath,
      tokenUsage: params.tokenUsage,
      enableContextCaching: params.enableContextCaching,
      useLocalProfiles: params.useLocalProfiles,
      allowWebSearchFallback: params.allowWebSearchFallback,
      reasoningEffort: params.reasoningEffort,
      autoCompactSummaries: params.autoCompactSummaries,
      autoCompactFrequency: params.autoCompactFrequency
    }
  }
}

/**
 * Triggers a browser download of the given session data as a JSON file.
 */
export function downloadSessionFile(sessionData: SessionData): void {
  const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
  a.download = `nikke-session-${timestamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// --- Import (restore) helpers ---

/**
 * Reconstructs chat messages from stored format.  When animation replay data
 * is present (`text` field without `content`), we rebuild `content` from the
 * character name and the stored text.
 *
 * @param messages   Raw chat messages from the JSON file.
 * @param getCharName  Function to resolve a character ID to its display name.
 */
export function reconstructChatHistory(messages: any[], getCharName: (id: string) => string | null): ChatMessage[] {
  return messages.map((msg: any) => {
    if (!msg.content && msg.text) {
      // Reconstruct content
      let reconstructedContent = msg.text
      if (msg.speaking && msg.character && msg.character !== 'none') {
        const name = getCharName(msg.character)
        if (name) {
          // Check if the text already starts with the name to avoid duplication
          const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const namePattern = new RegExp(`^\\**${escapedName}\\**\\s*:`, 'i')
          const anyNamePattern = /^\*\*\s*[^*]+\s*\*\*:/

          if (!namePattern.test(reconstructedContent) && !anyNamePattern.test(reconstructedContent)) {
            reconstructedContent = `**${name}:** ${reconstructedContent}`
          }
        }
      }
      return { ...msg, content: reconstructedContent }
    }
    return msg
  })
}

/** The validated settings that should be applied after restoring a session. */
export interface ValidatedSessionSettings {
  playbackMode?: 'auto' | 'manual'
  yapEnabled?: boolean
  ttsEnabled?: boolean
  ttsEndpoint?: string
  ttsProvider?: 'alltalk' | 'gptsovits'
  gptSovitsEndpoint?: string
  gptSovitsBasePath?: string
  tokenUsage?: string
  enableContextCaching?: boolean
  useLocalProfiles?: boolean
  allowWebSearchFallback?: boolean
  reasoningEffort?: string
  autoCompactSummaries?: boolean
  autoCompactFrequency?: number
  apiProvider?: string
  model?: string
  /** If the saved model was invalid, this is the warning message to show. */
  modelWarning?: string
  /** If the provider is openrouter, we need to fetch models before validating. */
  needsOpenRouterModelFetch?: boolean
}

/**
 * Validates and extracts session settings from raw parsed JSON data.
 * Returns a plain object of validated values (only those that passed validation).
 * Does NOT apply values to refs — that is left to the caller.
 *
 * @param settings  The `data.settings` object from the parsed session file.
 * @param validModels  List of valid model IDs for the saved provider (already fetched).
 */
export function validateSessionSettings(settings: any, validModels: string[]): ValidatedSessionSettings {
  const result: ValidatedSessionSettings = {}

  if (!settings) return result

  // Simple settings
  if (settings.playbackMode === 'auto' || settings.playbackMode === 'manual') {
    result.playbackMode = settings.playbackMode
  }
  if (typeof settings.yapEnabled === 'boolean') {
    result.yapEnabled = settings.yapEnabled
  }
  if (typeof settings.ttsEnabled === 'boolean') {
    result.ttsEnabled = settings.ttsEnabled
  }
  if (settings.ttsEndpoint) {
    result.ttsEndpoint = settings.ttsEndpoint
  }
  if (settings.ttsProvider === 'alltalk' || settings.ttsProvider === 'gptsovits') {
    result.ttsProvider = settings.ttsProvider
  }
  if (settings.gptSovitsEndpoint) {
    result.gptSovitsEndpoint = settings.gptSovitsEndpoint
  }
  if (settings.gptSovitsBasePath) {
    result.gptSovitsBasePath = settings.gptSovitsBasePath
  }
  if (settings.tokenUsage && tokenUsageOptions.some((t) => t.value === settings.tokenUsage)) {
    result.tokenUsage = settings.tokenUsage
  }
  if (typeof settings.enableContextCaching === 'boolean') {
    result.enableContextCaching = settings.enableContextCaching
  }
  if (typeof settings.useLocalProfiles === 'boolean') {
    result.useLocalProfiles = settings.useLocalProfiles
  }
  if (typeof settings.allowWebSearchFallback === 'boolean') {
    result.allowWebSearchFallback = settings.allowWebSearchFallback
  }
  if (settings.reasoningEffort) {
    result.reasoningEffort = settings.reasoningEffort
  }
  if (typeof settings.autoCompactSummaries === 'boolean') {
    result.autoCompactSummaries = settings.autoCompactSummaries
  }
  if (typeof settings.autoCompactFrequency === 'number' && [3, 4, 5, 10].includes(settings.autoCompactFrequency)) {
    result.autoCompactFrequency = settings.autoCompactFrequency
  }

  // Provider + model
  const savedProvider = settings.apiProvider
  const savedModel = settings.model

  if (savedProvider && providerOptions.some((p) => p.value === savedProvider)) {
    result.apiProvider = savedProvider
    result.needsOpenRouterModelFetch = savedProvider === 'openrouter'

    if (savedModel && validModels.includes(savedModel)) {
      result.model = savedModel
    } else {
      // Fallback to default
      if (savedProvider === 'gemini') result.model = 'gemini-2.5-flash'
      else if (savedProvider === 'openrouter' && validModels.length > 0) result.model = validModels[0]

      if (savedModel) {
        result.modelWarning = `Warning: Saved model '${savedModel}' is invalid or unavailable. Using default.`
      }
    }
  }

  return result
}

/**
 * Adjusts `lastSummarizedIndex` after a restore to ensure a minimum context
 * window of messages is available.
 */
export function adjustLastSummarizedIndex(chatHistoryLength: number, lastSummarizedIndex: number, tokenUsage: string, safeBuffer: number = 10): number {
  if (tokenUsage === 'goddess' || chatHistoryLength === 0) {
    return lastSummarizedIndex
  }
  if (chatHistoryLength - lastSummarizedIndex < safeBuffer) {
    const adjusted = Math.max(0, chatHistoryLength - safeBuffer)
    console.log(`[Restore] Adjusted lastSummarizedIndex to ${adjusted} to ensure context buffer`)
    return adjusted
  }
  return lastSummarizedIndex
}
