import { AIError } from '@/utils/chatUtils'
import { captureModelReasoning } from '@/utils/aiReasoningUtils'

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export const GEMINI_DEFAULT_MODEL = 'gemini-3.7-flash'

export const GEMINI_FALLBACK_MODEL_OPTIONS = [
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite' },
  { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
  { label: 'Gemini 3.7 Flash', value: 'gemini-3.7-flash' },
  { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' },
  { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro-preview' }
]

const GEMINI_MODEL_ID_EXCLUDE_PATTERN = /-tts|-image|-native-audio|-live|embedding|aqa|thinking-exp/

const buildGeminiGenerateContentUrl = (model: string) => `${GEMINI_API_BASE_URL}/${model}:generateContent`

const toGeminiModelId = (name: string) => name.replace(/^models\//, '')

export const fetchGeminiModels = async (apiKey?: string) => {
  const trimmedApiKey = apiKey?.trim()

  if (!trimmedApiKey) {
    return []
  }

  try {
    const models: any[] = []
    let pageToken: string | undefined

    do {
      const url = pageToken
        ? `${GEMINI_API_BASE_URL}?pageSize=1000&pageToken=${encodeURIComponent(pageToken)}`
        : `${GEMINI_API_BASE_URL}?pageSize=1000`

      const response = await fetch(url, { headers: buildGeminiHeaders(trimmedApiKey) })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
      }

      const data = await response.json()
      models.push(...(Array.isArray(data?.models) ? data.models : []))
      pageToken = typeof data?.nextPageToken === 'string' && data.nextPageToken ? data.nextPageToken : undefined
    } while (pageToken && models.length < 2000)

    return models
      .filter((m: any) => {
        const id = typeof m?.name === 'string' ? toGeminiModelId(m.name) : ''
        return (
          id.startsWith('gemini') &&
          !GEMINI_MODEL_ID_EXCLUDE_PATTERN.test(id) &&
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
        )
      })
      .map((m: any) => ({
        label: m.displayName || toGeminiModelId(m.name),
        value: toGeminiModelId(m.name)
      }))
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
  } catch (error) {
    console.error('Failed to fetch Gemini models:', error)
    return []
  }
}

const buildGeminiHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  // Keep the key out of the query string so it does not end up in request URLs.
  'x-goog-api-key': apiKey.trim()
})

const buildGeminiContents = (messages: any[]) => {
  const hasSystemMessage = messages.length > 1 || messages[0]?.role === 'system'

  let contents: any[]
  let systemMessage: any = null

  if (hasSystemMessage && messages.length > 1) {
    systemMessage = messages[0]
    contents = messages.slice(1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  } else {
    contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  }

  return { contents, systemMessage }
}

const extractGeminiText = (data: any, opts?: { checkProhibitedContent?: boolean; includeReasoning?: boolean }) => {
  if (opts?.checkProhibitedContent && data.promptFeedback?.blockReason === 'PROHIBITED_CONTENT') {
    console.error('Gemini content blocked:', data)
    throw new Error('GEMINI_PROHIBITED_CONTENT')
  }

  if (!data.candidates || data.candidates.length === 0) {
    console.error('Gemini returned no candidates:', data)
    throw new Error('Gemini API Error: No candidates in response')
  }

  const candidate = data.candidates[0]

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    console.error('Gemini returned empty content:', candidate)
    throw new Error('Gemini API Error: Empty content in response')
  }

  const parts = candidate.content.parts
  const thoughtTexts = parts
    .filter((p: any) => p.thought === true && typeof p.text === 'string' && p.text)
    .map((p: any) => p.text)
  const textPart = parts.find((p: any) => p.text !== undefined && !p.thought) || parts.find((p: any) => p.text !== undefined)

  if (!textPart) {
    console.error('Gemini returned no text part:', candidate.content.parts)
    throw new Error('Gemini API Error: No text in response')
  }

  if (opts?.includeReasoning) {
    captureModelReasoning(thoughtTexts.join('\n'))
  }

  return textPart.text
}

export const callGeminiSummarization = async (messages: any[], apiKey: string, model: string, signal?: AbortSignal) => {
  const { contents, systemMessage } = buildGeminiContents(messages)

  const requestBody: any = {
    contents,
    generationConfig: {
      maxOutputTokens: 32768
    }
  }

  if (systemMessage) {
    requestBody.systemInstruction = {
      parts: [{ text: systemMessage.content }]
    }
  }

  const response = await fetch(buildGeminiGenerateContentUrl(model), {
    method: 'POST',
    headers: buildGeminiHeaders(apiKey),
    body: JSON.stringify(requestBody),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Gemini Summarization Error Details:', errorData)
    if (response.status === 503) {
      throw new Error('Gemini API Error: 503 Service Unavailable')
    }
    throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
  }

  const data = await response.json()
  return extractGeminiText(data)
}

export const callGemini = async (messages: any[], opts: { model: string; apiKey: string; allowWebSearchFallback: boolean; enableWebSearch?: boolean; reasoningEffort?: string; includeReasoning?: boolean; signal?: AbortSignal }) => {
  const { model, apiKey, allowWebSearchFallback, enableWebSearch = false, reasoningEffort, includeReasoning = false, signal } = opts
  const { contents, systemMessage } = buildGeminiContents(messages)

  const shouldSearch = enableWebSearch && allowWebSearchFallback

  const requestBody: any = {
    contents,
    generationConfig: {
      responseMimeType: shouldSearch ? undefined : 'application/json'
    }
  }

  if (reasoningEffort && reasoningEffort !== 'default') {
    if (model.includes('gemini-2.5')) {
      let budget = 4096
      switch (reasoningEffort) {
        case 'minimal':
          budget = 1024
          break
        case 'low':
          budget = 2048
          break
        case 'medium':
          budget = 8192
          break
        case 'high':
          budget = 16384
          break
        case 'xhigh':
          budget = 32768
          break
        default:
          budget = 4096
      }

      requestBody.generationConfig.thinkingConfig = {
        includeThoughts: includeReasoning,
        thinkingBudget: budget
      }
    } else if (model.includes('gemini-3')) {
      let level = 'LOW'
      const isFlash = model.includes('flash')

      if (isFlash) {
        switch (reasoningEffort) {
          case 'minimal':
            level = 'MINIMAL'
            break
          case 'low':
            level = 'LOW'
            break
          case 'medium':
            level = 'MEDIUM'
            break
          case 'high':
            level = 'HIGH'
            break
          case 'xhigh':
            level = 'HIGH'
            break
          default:
            level = 'LOW'
        }
      } else {
        switch (reasoningEffort) {
          case 'minimal':
          case 'low':
            level = 'LOW'
            break
          case 'medium':
            level = 'MEDIUM'
            break
          case 'high':
          case 'xhigh':
            level = 'HIGH'
            break
          default:
            level = 'LOW'
        }
      }

      requestBody.generationConfig.thinkingConfig = {
        includeThoughts: includeReasoning,
        thinkingLevel: level
      }
    } else if (includeReasoning) {
      requestBody.generationConfig.thinkingConfig = {
        includeThoughts: true
      }
    }
  } else if (includeReasoning) {
    requestBody.generationConfig.thinkingConfig = {
      includeThoughts: true
    }
  }

  if (systemMessage) {
    requestBody.systemInstruction = { parts: [{ text: systemMessage.content }] }
  }

  if (shouldSearch) {
    requestBody.tools = [{ googleSearch: {} }]
  }

  const response = await fetch(buildGeminiGenerateContentUrl(model), {
    method: 'POST',
    headers: buildGeminiHeaders(apiKey),
    body: JSON.stringify(requestBody),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Gemini API Error Details:', errorData)
    if (response.status === 503) {
      throw new Error('Gemini API Error: 503 Service Unavailable')
    }
    throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
  }

  const data = await response.json()
  return extractGeminiText(data, { checkProhibitedContent: true, includeReasoning })
}
