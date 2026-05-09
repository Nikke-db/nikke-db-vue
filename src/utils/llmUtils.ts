// LLM utility functions for summarization and API calls
// These functions handle higher token limits for summarization tasks

import { AIError, logDebug } from '@/utils/chatUtils'
import { callGeminiSummarization } from '@/utils/geminiUtils'
import { callPollinationsSummarization } from '@/utils/pollinationsUtils'
import { modelsWithoutJsonSupport, modelsWithoutReasoningSupport, OPENCODE_GO_CHAT_COMPLETIONS_URL, OPENCODE_GO_MODELS_URL, OPENCODE_GO_EXCLUDED_MODEL_IDS, buildStoryResponseSchema } from '@/utils/providerConfigUtils'

// Re-exports from extracted modules
export { modelsWithoutJsonSupport, modelsRequiringStreamForHighTokens, modelsWithoutCacheControlSupport, modelsWithoutReasoningSupport, providerOptions, tokenUsageOptions, getReasoningEffortOptions, buildStoryResponseSchema } from '@/utils/providerConfigUtils'
export { callPollinationsSummarization, callPollinations, callPollinationsWithoutJson } from '@/utils/pollinationsUtils'
export { getFilteredAnimations, enrichActionsWithAnimations, formatAnimationsForContext } from '@/utils/animationEnrichmentUtils'
export { handleTumblingWindowSummarization, type TumblingWindowState, type TumblingWindowCallbacks, type TumblingWindowResult } from '@/utils/tumblingWindowUtils'
export { callGemini, callGeminiSummarization } from '@/utils/geminiUtils'

// --- Internal helpers for OpenAI-compatible APIs ---

const buildOpenAiCompatibleRequestBody = (opts: {
  messages: any[]
  maxTokens: number
  model?: string
  modeIsGame?: boolean
  reasoningEffort?: string
  includeJsonSchema?: boolean
  reasoningExclude?: boolean
}) => {
  const { messages, maxTokens, model, modeIsGame = false, reasoningEffort, includeJsonSchema = false, reasoningExclude = false } = opts
  const requestBody: any = {
    messages,
    max_tokens: maxTokens
  }

  if (model) requestBody.model = model
  if (includeJsonSchema) {
    requestBody.response_format = buildStoryResponseSchema(modeIsGame)
  }
  if (reasoningEffort && reasoningEffort !== 'default') {
    requestBody.reasoning = {
      effort: reasoningEffort,
      exclude: reasoningExclude
    }
  }

  return requestBody
}

const getOpenAiCompatibleHeaders = (apiKey?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  return headers
}

const parseOpenAiCompatibleTextResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
  }

  const data = await response.json()
  return data.choices[0].message.content
}

const sendOpenAiCompatibleRequest = async (url: string, opts: { requestBody: any; apiKey?: string; signal?: AbortSignal }) => {
  return await fetch(url, {
    method: 'POST',
    headers: getOpenAiCompatibleHeaders(opts.apiKey),
    body: JSON.stringify(opts.requestBody),
    signal: opts.signal
  })
}

const sendOpenCodeGoRequest = async (requestBody: any, apiKey: string, signal?: AbortSignal) => {
  const response = await sendOpenAiCompatibleRequest(OPENCODE_GO_CHAT_COMPLETIONS_URL, {
    requestBody,
    apiKey,
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('OpenCode Go API Error Details:', errorData)

    if (response.status === 429) {
      throw new Error('RATE_LIMITED')
    }

    return { response, errorData }
  }

  return { response }
}

const isReasoningParameterError = (errorData: any) => {
  const msg = (errorData?.error?.message || '') + ' ' + (errorData?.error?.code || '')
  return msg.toLowerCase().includes('reasoning') || (typeof errorData?.message === 'string' && errorData.message.toLowerCase().includes('reasoning'))
}

const callOpenCodeGoTextRequest = async (opts: { messages: any[]; model: string; apiKey: string; maxTokens: number; reasoningEffort?: string; signal?: AbortSignal }) => {
  const { messages, model, apiKey, maxTokens, signal } = opts
  let { reasoningEffort } = opts

  if (reasoningEffort && reasoningEffort !== 'default' && modelsWithoutReasoningSupport.value.has(model)) {
    reasoningEffort = undefined
  }

  const requestBody = buildOpenAiCompatibleRequestBody({
    messages,
    maxTokens,
    model,
    reasoningEffort
  })

  const result = await sendOpenCodeGoRequest(requestBody, apiKey, signal)

  if (!result.response.ok) {
    if (result.response.status === 400 && isReasoningParameterError(result.errorData)) {
      console.warn(`Model ${model} rejected reasoning settings, remembering and retrying without reasoning...`)
      modelsWithoutReasoningSupport.value.add(model)
      sessionStorage.setItem('modelsWithoutReasoningSupport', JSON.stringify([...modelsWithoutReasoningSupport.value]))
      const retryRequestBody = buildOpenAiCompatibleRequestBody({
        messages,
        maxTokens,
        model
      })
      const retryResult = await sendOpenCodeGoRequest(retryRequestBody, apiKey, signal)

      if (!retryResult.response.ok) {
        throw new AIError(retryResult.errorData?.error?.code ?? retryResult.response.status, retryResult.errorData?.error?.message ?? retryResult.response.statusText ?? 'Unknown error')
      }

      return await parseOpenAiCompatibleTextResponse(retryResult.response)
    }

    throw new AIError(result.errorData?.error?.code ?? result.response.status, result.errorData?.error?.message ?? result.response.statusText ?? 'Unknown error')
  }

  return await parseOpenAiCompatibleTextResponse(result.response)
}

// --- Model fetching ---

export const fetchOpenRouterModels = async () => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models')
    const data = await response.json()
    const models = data.data

    return models
      .map((m: any) => {
        const isFree = m.pricing.prompt === '0' && m.pricing.completion === '0'

        return {
          label: (isFree ? '[FREE] ' : '') + m.name,
          value: m.id,
          isFree: isFree,
          style: isFree ? { color: '#18a058', fontWeight: 'bold' } : {}
        }
      })
      .sort((a: any, b: any) => {
        if (a.isFree && !b.isFree) return -1
        if (!a.isFree && b.isFree) return 1

        return a.label.localeCompare(b.label)
      })
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error)
    return []
  }
}

export const fetchPollinationsModels = async (apiKey?: string) => {
  const trimmedApiKey = apiKey?.trim()

  if (!trimmedApiKey) {
    return []
  }

  let models: any[] = []

  try {
    const response = await fetch('https://gen.pollinations.ai/text/models', {
      headers: {
        Authorization: `Bearer ${trimmedApiKey}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
    }

    const data = await response.json()
    models = data

    // Handle both old format (array of strings) and new format (array of objects)
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
      models = data.map((name) => ({ name }))
    }

    return models
      .filter((m: any) => {
        const hiddenModels = ['qwen-coder', 'chickytutor', 'midijourney', 'openai-audio']
        return !hiddenModels.includes(m.name)
      })
      .map((m: any) => ({
        label: m.name,
        value: m.name
      }))
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
  } catch (error) {
    console.error('Failed to fetch Pollinations models:', error)
    return []
  }
}

export const fetchOpenCodeGoModels = async (apiKey?: string) => {
  try {
    const headers: Record<string, string> = {}
    if (apiKey?.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`
    }

    const response = await fetch(OPENCODE_GO_MODELS_URL, { headers })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
    }

    const data = await response.json()
    const models = Array.isArray(data?.data) ? data.data : []

    return models
      .filter((m: any) => typeof m?.id === 'string' && !OPENCODE_GO_EXCLUDED_MODEL_IDS.has(m.id))
      .map((m: any) => ({
        label: m.id,
        value: m.id
      }))
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
  } catch (error) {
    console.error('Failed to fetch OpenCode Go models:', error)
    return []
  }
}

// --- Provider-specific summarization ---

export const callOpenRouterSummarization = async (messages: any[], apiKey: string, model: string, signal?: AbortSignal) => {
  const requestBody: any = {
    model: model,
    messages: messages,
    max_tokens: 16384
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'Nikke DB Story Gen',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('OpenRouter Summarization Error Details:', errorData)

    if (response.status === 400 && errorData?.error?.message?.includes('max_tokens')) {
      console.warn(`Model ${model} doesn't support 16384 max_tokens, falling back to 8192...`)
      requestBody.max_tokens = 8192
      const retryResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'Nikke DB Story Gen',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal
      })

      if (!retryResponse.ok) {
        const retryErrorData = await retryResponse.json().catch(() => ({}))
        throw new AIError(retryErrorData?.error?.code ?? retryResponse.status, retryErrorData?.error?.message ?? retryResponse.statusText ?? 'Unknown error')
      }
      const retryData = await retryResponse.json()
      return retryData.choices[0].message.content
    }

    if (response.status === 429 && errorData?.error?.message?.includes('Free-models-per-day')) {
      throw new Error('FREE_MODEL_RATE_LIMITED')
    }

    if (response.status === 404 && errorData?.error?.message?.includes('No endpoints available matching your guardrail restrictions')) {
      throw new Error('GUARDRAIL_RESTRICTION')
    }

    throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
  }
  const data = await response.json()

  return data.choices[0].message.content
}

export const callLocalSummarization = async (messages: any[], opts: { model?: string; maxTokens?: number; apiKey?: string; localUrl: string; reasoningEffort?: string; signal?: AbortSignal }) => {
  const { model, maxTokens = 16384, apiKey, localUrl, reasoningEffort, signal } = opts

  let endpoint = localUrl.replace(/\/$/, '')
  if (!endpoint.endsWith('/chat/completions')) {
    endpoint = `${endpoint}/chat/completions`
  }

  const requestBody = buildOpenAiCompatibleRequestBody({
    messages,
    maxTokens,
    model,
    reasoningEffort
  })

  const response = await sendOpenAiCompatibleRequest(endpoint, {
    requestBody,
    apiKey,
    signal
  })

  return await parseOpenAiCompatibleTextResponse(response)
}

// --- Provider-specific main call functions ---

export const callLocal = async (
  messages: any[],
  opts: {
    model?: string
    maxTokens?: number
    apiKey?: string
    localUrl: string
    modeIsGame: boolean
    reasoningEffort?: string
    signal?: AbortSignal
  }
) => {
  const { model, maxTokens = 16384, apiKey, localUrl, modeIsGame, reasoningEffort, signal } = opts

  let endpoint = localUrl.replace(/\/$/, '')
  if (!endpoint.endsWith('/chat/completions')) {
    endpoint = `${endpoint}/chat/completions`
  }

  const callWithoutJsonFormat = async () => {
    const requestBody = buildOpenAiCompatibleRequestBody({
      messages,
      maxTokens,
      model,
      reasoningEffort
    })

    const response = await sendOpenAiCompatibleRequest(endpoint, {
      requestBody,
      apiKey,
      signal
    })

    return await parseOpenAiCompatibleTextResponse(response)
  }

  if (model && modelsWithoutJsonSupport.value.has(model)) {
    logDebug(`Model ${model} known to not support json_schema, using text fallback...`)
    return callWithoutJsonFormat()
  }

  const requestBody = buildOpenAiCompatibleRequestBody({
    messages,
    maxTokens,
    model,
    modeIsGame,
    reasoningEffort,
    includeJsonSchema: true
  })

  const response = await sendOpenAiCompatibleRequest(endpoint, {
    requestBody,
    apiKey,
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Local API Error Details:', errorData)

    if (response.status === 400 && (JSON.stringify(errorData).includes('response_format') || JSON.stringify(errorData).includes('json_schema') || JSON.stringify(errorData).includes('schema'))) {
      console.warn(`Model ${model || 'local'} does not support json_schema response format, remembering and retrying without it...`)
      if (model) {
        modelsWithoutJsonSupport.value.add(model)
        sessionStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport.value]))
      }
      return callWithoutJsonFormat()
    }

    throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export const callOpenCodeGoSummarization = async (messages: any[], opts: { model: string; apiKey: string; maxTokens?: number; reasoningEffort?: string; signal?: AbortSignal }) => {
  const { model, apiKey, maxTokens = 16384, reasoningEffort, signal } = opts

  return await callOpenCodeGoTextRequest({
    messages,
    model,
    apiKey,
    maxTokens,
    reasoningEffort,
    signal
  })
}

export const callOpenCodeGo = async (
  messages: any[],
  opts: {
    model: string
    apiKey: string
    modeIsGame: boolean
    maxTokens?: number
    reasoningEffort?: string
    signal?: AbortSignal
  }
) => {
  const { model, apiKey, modeIsGame, maxTokens = 16384, signal } = opts
  let { reasoningEffort } = opts

  if (reasoningEffort && reasoningEffort !== 'default' && modelsWithoutReasoningSupport.value.has(model)) {
    reasoningEffort = undefined
  }

  const callWithoutJsonFormat = async () => {
    return await callOpenCodeGoTextRequest({
      messages,
      model,
      apiKey,
      maxTokens,
      reasoningEffort
    })
  }

  if (modelsWithoutJsonSupport.value.has(model)) {
    logDebug(`Model ${model} known to not support json_schema, using text fallback...`)
    return callWithoutJsonFormat()
  }

  const requestBody = buildOpenAiCompatibleRequestBody({
    messages,
    maxTokens,
    model,
    modeIsGame,
    reasoningEffort,
    includeJsonSchema: true
  })

  const result = await sendOpenCodeGoRequest(requestBody, apiKey, signal)

  if (!result.response.ok) {
    if (result.response.status === 400 && (JSON.stringify(result.errorData).includes('response_format') || JSON.stringify(result.errorData).includes('json_schema') || JSON.stringify(result.errorData).includes('schema'))) {
      console.warn(`Model ${model} does not support json_schema response format, remembering and retrying without it...`)
      modelsWithoutJsonSupport.value.add(model)
      sessionStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport.value]))
      return callWithoutJsonFormat()
    }

    if (result.response.status === 400 && isReasoningParameterError(result.errorData)) {
      console.warn(`Model ${model} rejected reasoning settings, remembering and retrying without reasoning...`)
      modelsWithoutReasoningSupport.value.add(model)
      sessionStorage.setItem('modelsWithoutReasoningSupport', JSON.stringify([...modelsWithoutReasoningSupport.value]))
      const retryRequestBody = buildOpenAiCompatibleRequestBody({
        messages,
        maxTokens,
        model,
        modeIsGame,
        includeJsonSchema: true
      })
      const retryResult = await sendOpenCodeGoRequest(retryRequestBody, apiKey, signal)

      if (!retryResult.response.ok) {
        if (retryResult.response.status === 400 && (JSON.stringify(retryResult.errorData).includes('response_format') || JSON.stringify(retryResult.errorData).includes('json_schema') || JSON.stringify(retryResult.errorData).includes('schema'))) {
          console.warn(`Model ${model} does not support json_schema response format after retrying without reasoning, remembering and retrying without it...`)
          modelsWithoutJsonSupport.value.add(model)
          sessionStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport.value]))
          return callWithoutJsonFormat()
        }

        throw new AIError(retryResult.errorData?.error?.code ?? retryResult.response.status, retryResult.errorData?.error?.message ?? retryResult.response.statusText ?? 'Unknown error')
      }

      const retryData = await retryResult.response.json()
      return retryData.choices[0].message.content
    }

    throw new AIError(result.errorData?.error?.code ?? result.response.status, result.errorData?.error?.message ?? result.response.statusText ?? 'Unknown error')
  }

  const data = await result.response.json()
  return data.choices[0].message.content
}

export const callOpenRouter = async (
  messages: any[],
  opts: {
    model: string
    apiKey: string
    enableContextCaching: boolean
    useLocalProfiles: boolean
    allowWebSearchFallback: boolean
    modeIsGame: boolean
    enableWebSearch?: boolean
    searchUrl?: string
    prompts: any
    reasoningEffort?: string
    signal?: AbortSignal
  }
) => {
  const { model, apiKey, enableContextCaching, useLocalProfiles, allowWebSearchFallback, modeIsGame, enableWebSearch = false, prompts, reasoningEffort, signal } = opts

  let processedMessages = messages

  if (enableContextCaching) {
    processedMessages = messages.map((m) => ({ ...m }))

    if (processedMessages.length > 0 && processedMessages[0].role === 'system') {
      const systemContent = processedMessages[0].content
      processedMessages[0] = {
        ...processedMessages[0],
        content: [
          {
            type: 'text',
            text: systemContent,
            cache_control: { type: 'ephemeral' }
          }
        ]
      }
    }

    if (processedMessages.length >= 2) {
      const lastHistoryIndex = processedMessages.length - 2
      if (lastHistoryIndex > 0 || (lastHistoryIndex === 0 && processedMessages[0].role !== 'system')) {
        const msg = processedMessages[lastHistoryIndex]
        if (typeof msg.content === 'string') {
          processedMessages[lastHistoryIndex] = {
            ...msg,
            content: [
              {
                type: 'text',
                text: msg.content,
                cache_control: { type: 'ephemeral' }
              }
            ]
          }
        }
      }
    }
  }

  const messagesWithEnforcement = [...processedMessages, { role: 'user', content: prompts.reminders.jsonEnforcement }]

  const buildWebPlugin = () => {
    if (!enableWebSearch) return undefined
    if (useLocalProfiles && !allowWebSearchFallback) return undefined
    return [{ id: 'web', max_results: 10 }]
  }

  const callWithoutJsonFormat = async () => {
    const requestBody: any = {
      model: model,
      messages: messagesWithEnforcement,
      max_tokens: 16384
    }

    if (reasoningEffort && reasoningEffort !== 'default') {
      requestBody.reasoning = {
        effort: reasoningEffort,
        exclude: true
      }
    }

    const webPlugin = buildWebPlugin()
    if (webPlugin) {
      requestBody.plugins = webPlugin
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'Nikke DB Story Gen',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenRouter API Error Details:', errorData)

      if (response.status === 429 && errorData?.error?.message?.includes('is temporarily rate-limited upstream')) {
        throw new Error('RATE_LIMITED')
      }

      if (response.status === 429 && errorData?.error?.message?.includes('Free-models-per-day')) {
        throw new Error('FREE_MODEL_RATE_LIMITED')
      }

      if (response.status === 404 && errorData?.error?.message?.includes('No endpoints available matching your guardrail restrictions')) {
        throw new Error('GUARDRAIL_RESTRICTION')
      }

      throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  if (modelsWithoutJsonSupport.value.has(model)) {
    logDebug(`Model ${model} known to not support json_object, skipping to fallback...`)
    return callWithoutJsonFormat()
  }

  const responseSchema = buildStoryResponseSchema(modeIsGame)

  const requestBody: any = {
    model: model,
    messages: processedMessages,
    max_tokens: 16384,
    response_format: responseSchema,
    provider: { require_parameters: true }
  }

  if (reasoningEffort && reasoningEffort !== 'default') {
    requestBody.reasoning = {
      effort: reasoningEffort,
      exclude: true
    }
  }

  let plugins: any[] = []
  const webPlugin = buildWebPlugin()
  if (webPlugin) plugins = [...webPlugin]
  plugins.push({ id: 'response-healing' })

  if (plugins.length > 0) requestBody.plugins = plugins

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'Nikke DB Story Gen',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('OpenRouter API Error Details:', errorData)

    if (response.status === 429 && errorData?.error?.message?.includes('is temporarily rate-limited upstream')) {
      throw new Error('RATE_LIMITED')
    }

    if (response.status === 429 && errorData?.error?.message?.includes('Free-models-per-day')) {
      throw new Error('FREE_MODEL_RATE_LIMITED')
    }

    if (response.status === 404 && errorData?.error?.message?.includes('No endpoints available matching your guardrail restrictions')) {
      throw new Error('GUARDRAIL_RESTRICTION')
    }

    if (response.status === 404 && errorData?.error?.message?.includes('No endpoints found that can handle the requested parameters.')) {
      console.warn(`Model ${model} does not support json_object response format, remembering and retrying without it...`)
      modelsWithoutJsonSupport.value.add(model)
      sessionStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport.value]))
      return callWithoutJsonFormat()
    }

    throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
  }

  const data = await response.json()

  return data.choices[0].message.content
}

// --- Summarization orchestration ---

export const summarizeChunk = async (
  messages: { role: string; content: string }[],
  opts: {
    apiProvider: string
    apiKey: string
    model: string
    localUrl: string
    prompts: any
    enableContextCaching?: boolean
    reasoningEffort?: string
    signal?: AbortSignal
    existingSummary?: string
  }
) => {
  if (messages.length === 0) return ''

  const textToSummarize = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')

  const systemMsg = { role: 'system', content: opts.prompts.summarizeChunk.system }

  let userContent: string
  if (opts.existingSummary && opts.existingSummary.trim().length > 0) {
    userContent = opts.prompts.summarizeChunk.userContinuation.replace('${existingSummary}', opts.existingSummary).replace('${textToSummarize}', textToSummarize)
  } else {
    userContent = opts.prompts.summarizeChunk.user.replace('${textToSummarize}', textToSummarize)
  }

  const userMsg = { role: 'user', content: userContent }
  const msgs = [systemMsg, userMsg]

  let summary = ''

  if (opts.apiProvider === 'gemini') {
    summary = await callGeminiSummarization(msgs, opts.apiKey, opts.model, opts.signal)
  } else if (opts.apiProvider === 'opencode-go') {
    summary = await callOpenCodeGoSummarization(msgs, { model: opts.model, apiKey: opts.apiKey, reasoningEffort: opts.reasoningEffort, signal: opts.signal })
  } else if (opts.apiProvider === 'openrouter') {
    summary = await callOpenRouterSummarization(msgs, opts.apiKey, opts.model, opts.signal)
  } else if (opts.apiProvider === 'pollinations') {
    summary = await callPollinationsSummarization(msgs, opts.apiKey, opts.model, opts.enableContextCaching, opts.signal)
  } else if (opts.apiProvider === 'local') {
    summary = await callLocalSummarization(msgs, { apiKey: opts.apiKey, localUrl: opts.localUrl, signal: opts.signal, reasoningEffort: opts.reasoningEffort })
  }

  if (summary && summary.trim().length > 0) {
    return summary
  }

  throw new Error('Summarization returned empty output.')
}

export const compactSummary = async (
  fullSummary: string,
  opts: {
    apiProvider: string
    apiKey: string
    model: string
    localUrl: string
    prompts: any
    enableContextCaching?: boolean
    reasoningEffort?: string
    signal?: AbortSignal
  }
) => {
  if (!fullSummary || fullSummary.trim().length === 0) return ''

  const systemMsg = { role: 'system', content: opts.prompts.compactSummary.system }
  const userContent = opts.prompts.compactSummary.user.replace('${fullSummary}', fullSummary)
  const userMsg = { role: 'user', content: userContent }
  const msgs = [systemMsg, userMsg]

  let summary = ''

  if (opts.apiProvider === 'gemini') {
    summary = await callGeminiSummarization(msgs, opts.apiKey, opts.model, opts.signal)
  } else if (opts.apiProvider === 'opencode-go') {
    summary = await callOpenCodeGoSummarization(msgs, { model: opts.model, apiKey: opts.apiKey, reasoningEffort: opts.reasoningEffort, signal: opts.signal })
  } else if (opts.apiProvider === 'openrouter') {
    summary = await callOpenRouterSummarization(msgs, opts.apiKey, opts.model, opts.signal)
  } else if (opts.apiProvider === 'pollinations') {
    summary = await callPollinationsSummarization(msgs, opts.apiKey, opts.model, opts.enableContextCaching, opts.signal)
  } else if (opts.apiProvider === 'local') {
    summary = await callLocalSummarization(msgs, { apiKey: opts.apiKey, localUrl: opts.localUrl, signal: opts.signal, reasoningEffort: opts.reasoningEffort })
  }

  if (summary && summary.trim().length > 0) {
    return summary
  }

  throw new Error('Summary compaction returned empty output.')
}
