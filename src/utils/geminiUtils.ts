import { AIError } from '@/utils/chatUtils'

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

const buildGeminiGenerateContentUrl = (model: string) => `${GEMINI_API_BASE_URL}/${model}:generateContent`

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

const extractGeminiText = (data: any, opts?: { checkProhibitedContent?: boolean }) => {
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

  const textPart = candidate.content.parts.find((p: any) => p.text !== undefined)

  if (!textPart) {
    console.error('Gemini returned no text part:', candidate.content.parts)
    throw new Error('Gemini API Error: No text in response')
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

export const callGemini = async (messages: any[], opts: { model: string; apiKey: string; allowWebSearchFallback: boolean; enableWebSearch?: boolean; reasoningEffort?: string; signal?: AbortSignal }) => {
  const { model, apiKey, allowWebSearchFallback, enableWebSearch = false, reasoningEffort, signal } = opts
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
        includeThoughts: false,
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
        includeThoughts: false,
        thinkingLevel: level
      }
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
  return extractGeminiText(data, { checkProhibitedContent: true })
}
