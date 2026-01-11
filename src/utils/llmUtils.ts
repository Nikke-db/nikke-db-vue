// LLM utility functions for summarization and API calls
// These functions handle higher token limits for summarization tasks

import { ref } from 'vue'
import { animationMappings } from '@/utils/animationMappings'

export const modelsWithoutJsonSupport = ref<Set<string>>(new Set(JSON.parse(localStorage.getItem('modelsWithoutJsonSupport') || '[]')))

export const providerOptions = [
  { label: 'Perplexity', value: 'perplexity' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Pollinations', value: 'pollinations' },
  { label: 'Local (Beta, OpenAPI)', value: 'local' }
]

export const tokenUsageOptions = [
  { label: 'Low (10 turns)', value: 'low' },
  { label: 'Medium (30 turns)', value: 'medium' },
  { label: 'High (60 turns)', value: 'high' },
  { label: 'Goddess', value: 'goddess' }
]

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
  let models: any[] = []

  try {
    const headers: Record<string, string> = {}

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    const url = apiKey ? 'https://gen.pollinations.ai/text/models' : 'https://text.pollinations.ai/models'
    const response = await fetch(url, { headers })
    const data = await response.json()
    models = data

    // Handle both old format (array of strings) and new format (array of objects)
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
      models = data.map((name) => ({ name, pricing: { input_token_price: 0 } }))
    }

    return models
      .filter((m: any) => {
        if (!apiKey) {
          const allowedModels = ['gemini', 'gemini-search', 'mistral']
          return allowedModels.includes(m.name)
        } else {
          const hiddenModels = ['qwen-coder', 'chickytutor', 'midijourney', 'openai-audio']
          return !hiddenModels.includes(m.name)
        }
      })
      .map((m: any) => {
        const isFree = m.pricing && m.pricing.input_token_price === 0

        return {
          label: (isFree ? '[FREE] ' : '') + m.name,
          value: m.name,
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
    console.error('Failed to fetch Pollinations models:', error)
    // Fallback to hardcoded models
    models = [
      { name: 'gemini', pricing: { input_token_price: 0 } },
      { name: 'gemini-search', pricing: { input_token_price: 0 } },
      { name: 'mistral', pricing: { input_token_price: 0 } }
    ]

    return models.map((m: any) => ({
      label: '[FREE] ' + m.name,
      value: m.name,
      isFree: true,
      style: { color: '#18a058', fontWeight: 'bold' }
    }))
  }
}

export const callOpenRouterSummarization = async (messages: any[], apiKey: string, model: string) => {
  // Use higher max_tokens for summarization to handle long inputs
  const requestBody: any = {
    model: model,
    messages: messages,
    max_tokens: 16384 // Double the normal limit for summarization
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'Nikke DB Story Gen',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('OpenRouter Summarization Error Details:', errorData)

    // If max_tokens is too high for this model, try with standard limit
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
        body: JSON.stringify(requestBody)
      })

      if (!retryResponse.ok) {
        throw new Error(`OpenRouter API Error: ${retryResponse.status} ${JSON.stringify(await retryResponse.json().catch(() => ({})))}`)
      }
      const retryData = await retryResponse.json()
      return retryData.choices[0].message.content
    }

    throw new Error(`OpenRouter API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()

  return data.choices[0].message.content
}

export const callPollinationsSummarization = async (messages: any[], apiKey: string, model: string, enableContextCaching: boolean = false) => {
  // Use higher max_tokens for summarization to handle long inputs
  const requestBody: any = {
    model: model,
    messages: enableContextCaching ? messages.map((m) => ({ ...m, cache_control: { type: 'ephemeral' } })) : messages,
    max_tokens: 16384 // Double the normal limit for summarization
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const url = apiKey ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai'

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Pollinations Summarization API Error Details:', errorData)

    // If max_tokens is too high for this model, try with standard limit
    if (response.status === 400 && errorData?.error?.message?.includes('max_tokens')) {
      console.warn(`Model ${model} doesn't support 16384 max_tokens, falling back to 8192...`)
      requestBody.max_tokens = 8192
      const retryResponse = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      })

      if (!retryResponse.ok) {
        throw new Error(`Pollinations API Error: ${retryResponse.status} ${JSON.stringify(await retryResponse.json().catch(() => ({})))}`)
      }
      const retryData = await retryResponse.json()
      return retryData.choices[0].message.content
    }

    throw new Error(`Pollinations API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()

  return data.choices[0].message.content
}

export const callGeminiSummarization = async (messages: any[], apiKey: string, model: string) => {
  // Gemini API format is different, need to adapt

  // Check if we have a system message (first message with role 'system' or just need to treat first as system)
  // If there's only one message, treat it as user content (no system instruction)
  const hasSystemMessage = messages.length > 1 || messages[0]?.role === 'system'

  let contents: any[]
  let systemMessage: any = null

  if (hasSystemMessage && messages.length > 1) {
    // Extract system prompt (first message)
    systemMessage = messages[0]
    // Filter out system message and map the rest to Gemini format
    contents = messages.slice(1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  } else {
    // No system message, all messages are content
    contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const requestBody: any = {
    contents: contents,
    generationConfig: {
      maxOutputTokens: 8192 // Higher limit for summarization
    }
  }

  // Only add systemInstruction if we have a system message
  if (systemMessage) {
    requestBody.systemInstruction = {
      parts: [{ text: systemMessage.content }]
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error('Gemini Summarization Error Details:', errorData)
    if (response.status === 503) {
      throw new Error('Gemini API Error: 503 Service Unavailable')
    }
    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()

  // Handle various response formats from Gemini
  if (!data.candidates || data.candidates.length === 0) {
    console.error('Gemini returned no candidates:', data)

    throw new Error('Gemini API Error: No candidates in response')
  }

  const candidate = data.candidates[0]

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    console.error('Gemini returned empty content:', candidate)

    throw new Error('Gemini API Error: Empty content in response')
  }

  // Find the text part (there might be other parts like function calls when using tools)
  const textPart = candidate.content.parts.find((p: any) => p.text !== undefined)

  if (!textPart) {
    console.error('Gemini returned no text part:', candidate.content.parts)

    throw new Error('Gemini API Error: No text in response')
  }

  return textPart.text
}

export const callPollinations = async (
  messages: any[],
  opts: {
    model: string
    apiKey?: string
    useLocalProfiles: boolean
    allowWebSearchFallback: boolean
    modeIsGame: boolean
    enableWebSearch?: boolean
    reasoningEffort?: string
    enableContextCaching?: boolean
  }
) => {
  const { model, apiKey, modeIsGame, reasoningEffort, enableContextCaching } = opts

  if (modelsWithoutJsonSupport.value.has(model)) {
    console.log(`Model ${model} known to not support json_schema, using text fallback...`)
    return callPollinationsWithoutJson(messages, { model, apiKey, reasoningEffort, enableContextCaching })
  }

  const requestBody: any = {
    model: model,
    messages: enableContextCaching ? messages.map((m) => ({ ...m, cache_control: { type: 'ephemeral' } })) : messages,
    max_tokens: 16384,
    response_format: buildStoryResponseSchema(modeIsGame),
    private: true
  }

  if (reasoningEffort && reasoningEffort !== 'default') {
    requestBody.reasoning_effort = reasoningEffort
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const url = apiKey ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai'

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Pollinations API Error Details:', errorData)

    if (response.status === 429) {
      throw new Error('RATE_LIMITED')
    }

    if (response.status === 400 && (errorData?.error?.message?.includes('response_format') || errorData?.error?.message?.includes('json_schema') || errorData?.error?.message?.includes('controlled generation'))) {
      console.warn(`Model ${model} does not support json_schema response format, remembering and retrying without it...`)
      modelsWithoutJsonSupport.value.add(model)
      localStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport.value]))
      return callPollinationsWithoutJson(messages, { model, apiKey, enableContextCaching })
    }

    throw new Error(`Pollinations API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()

  return data.choices[0].message.content
}

export const callPollinationsWithoutJson = async (messages: any[], opts: { model: string; apiKey?: string; reasoningEffort?: string; enableContextCaching?: boolean }) => {
  const { model, apiKey, reasoningEffort, enableContextCaching } = opts

  const requestBody: any = {
    model: model,
    messages: enableContextCaching ? messages.map((m) => ({ ...m, cache_control: { type: 'ephemeral' } })) : messages,
    max_tokens: 16384
  }

  if (reasoningEffort && reasoningEffort !== 'default') {
    requestBody.reasoning_effort = reasoningEffort
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const url = apiKey ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai'

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Pollinations API Error Details:', errorData)
    if (response.status === 429) {
      throw new Error('RATE_LIMITED')
    }
    throw new Error(`Pollinations API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()

  return data.choices[0].message.content
}

export const callLocalSummarization = async (messages: any[], opts: { model?: string; maxTokens?: number; apiKey?: string; localUrl: string }) => {
  const { model, maxTokens = 16384, apiKey, localUrl } = opts

  let endpoint = localUrl.replace(/\/$/, '')
  if (!endpoint.endsWith('/chat/completions')) {
    endpoint = `${endpoint}/chat/completions`
  }

  const requestBody: any = {
    messages: messages,
    max_tokens: maxTokens
  }
  if (model) requestBody.model = model

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Local Summarization API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()
  return data.choices[0].message.content
}

export const callLocal = async (
  messages: any[],
  opts: {
    model?: string
    maxTokens?: number
    apiKey?: string
    localUrl: string
    modeIsGame: boolean
  }
) => {
  const { model, maxTokens = 8192, apiKey, localUrl, modeIsGame } = opts

  // Ensure URL ends with /chat/completions if not present
  let endpoint = localUrl.replace(/\/$/, '')
  if (!endpoint.endsWith('/chat/completions')) {
    endpoint = `${endpoint}/chat/completions`
  }

  const callWithoutJsonFormat = async () => {
    const requestBody: any = {
      messages: messages,
      max_tokens: maxTokens
    }
    if (model) requestBody.model = model

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Local API Error: ${response.status} ${JSON.stringify(errorData)}`)
    }
    const data = await response.json()
    return data.choices[0].message.content
  }

  if (model && modelsWithoutJsonSupport.value.has(model)) {
    console.log(`Model ${model} known to not support json_schema, using text fallback...`)
    return callWithoutJsonFormat()
  }

  const responseSchema = buildStoryResponseSchema(modeIsGame)

  const requestBody: any = {
    messages: messages,
    max_tokens: maxTokens,
    response_format: responseSchema
  }
  if (model) requestBody.model = model

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Local API Error Details:', errorData)

    // Check for 400 error related to response_format
    if (response.status === 400 && (JSON.stringify(errorData).includes('response_format') || JSON.stringify(errorData).includes('json_schema') || JSON.stringify(errorData).includes('schema'))) {
      console.warn(`Model ${model || 'local'} does not support json_schema response format, remembering and retrying without it...`)
      if (model) {
        modelsWithoutJsonSupport.value.add(model)
        localStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport.value]))
      }
      return callWithoutJsonFormat()
    }

    throw new Error(`Local API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Helper: filter out internal/unsupported animations
export const getFilteredAnimations = (animations?: string[]) => {
  return (animations || []).filter((a) => a !== 'talk' && a !== 'talk_start' && a !== 'talk_end' && a !== 'expression_0' && a !== 'action')
}

// Structured output schema builder (used by ChatInterface for OpenRouter/Pollinations JSON schema mode)
export const buildStoryResponseSchema = (isGameMode: boolean) => ({
  type: 'json_schema',
  json_schema: {
    name: 'StoryResponse',
    schema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              needs_search: { type: 'array', items: { type: 'string' } },
              memory: { type: 'object' },
              characterProgression: { type: 'object' },
              text: { type: 'string' },
              character: { type: 'string' },
              animation: { type: 'string' },
              speaking: { type: 'boolean' },
              duration: { type: 'number' }
            },
            required: ['text', 'character', 'speaking', 'animation']
          }
        },
        // Game Mode ONLY: choices returned at top-level, then we attach them to the last action.
        choices: isGameMode
          ? {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  type: { type: 'string', enum: ['dialogue', 'action'] }
                },
                required: ['text', 'type']
              }
            }
          : undefined
      },
      required: isGameMode ? ['actions', 'choices'] : ['actions']
    }
  }
})

export const summarizeChunk = async (
  messages: { role: string; content: string }[],
  opts: {
    apiProvider: string
    apiKey: string
    model: string
    localMaxTokens: number
    localUrl: string
    prompts: any
    enableContextCaching?: boolean
  }
) => {
  if (messages.length === 0) return ''

  const textToSummarize = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')

  const systemMsg = { role: 'system', content: opts.prompts.summarizeChunk.system }
  const userMsg = { role: 'user', content: opts.prompts.summarizeChunk.user.replace('${textToSummarize}', textToSummarize) }
  const msgs = [systemMsg, userMsg]

  let summary = ''

  if (opts.apiProvider === 'perplexity') {
    summary = await callPerplexity(msgs, { model: opts.model, apiKey: opts.apiKey, useLocalProfiles: false, allowWebSearchFallback: false })
  } else if (opts.apiProvider === 'gemini') {
    summary = await callGeminiSummarization(msgs, opts.apiKey, opts.model)
  } else if (opts.apiProvider === 'openrouter') {
    summary = await callOpenRouterSummarization(msgs, opts.apiKey, opts.model)
  } else if (opts.apiProvider === 'pollinations') {
    summary = await callPollinationsSummarization(msgs, opts.apiKey, opts.model, opts.enableContextCaching)
  } else if (opts.apiProvider === 'local') {
    summary = await callLocalSummarization(msgs, { maxTokens: opts.localMaxTokens, apiKey: opts.apiKey, localUrl: opts.localUrl })
  }

  if (summary && summary.trim().length > 0) {
    return summary
  }

  throw new Error('Summarization returned empty output.')
}

// --- Exported network helpers moved from ChatInterface.vue ---

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
  }
) => {
  const { model, apiKey, enableContextCaching, useLocalProfiles, allowWebSearchFallback, modeIsGame, enableWebSearch = false, prompts, reasoningEffort } = opts

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
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenRouter API Error Details:', errorData)

      if (response.status === 429 && errorData?.error?.message?.includes('is temporarily rate-limited upstream')) {
        throw new Error('RATE_LIMITED')
      }

      throw new Error(`OpenRouter API Error: ${response.status} ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  if (modelsWithoutJsonSupport.value.has(model)) {
    console.log(`Model ${model} known to not support json_object, skipping to fallback...`)
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
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('OpenRouter API Error Details:', errorData)

    if (response.status === 429 && errorData?.error?.message?.includes('is temporarily rate-limited upstream')) {
      throw new Error('RATE_LIMITED')
    }

    if (response.status === 404 && errorData?.error?.message?.includes('No endpoints found that can handle the requested parameters.')) {
      console.warn(`Model ${model} does not support json_object response format, remembering and retrying without it...`)
      modelsWithoutJsonSupport.value.add(model)
      localStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport.value]))
      return callWithoutJsonFormat()
    }

    throw new Error(`OpenRouter API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()

  return data.choices[0].message.content
}

export const callPerplexity = async (messages: any[], opts: { model: string; apiKey: string; useLocalProfiles: boolean; allowWebSearchFallback: boolean; enableWebSearch?: boolean; searchUrl?: string }) => {
  const { model, apiKey, useLocalProfiles, allowWebSearchFallback, enableWebSearch = false, searchUrl } = opts

  const requestBody: any = { model: model, messages: messages }

  const shouldSearch = enableWebSearch && !(useLocalProfiles && !allowWebSearchFallback)

  if (shouldSearch) {
    if (searchUrl) {
      const urlMatch = searchUrl.match(/https?:\/\/([^/]+)/)
      if (urlMatch) {
        requestBody.search_domain_filter = [urlMatch[1]]
      }
    }

    requestBody.web_search_options = { search_context_size: 'medium' }
  } else {
    requestBody.disable_search = true
  }

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Perplexity API Error Details:', errorData)
    throw new Error(`Perplexity API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export const callGemini = async (messages: any[], opts: { model: string; apiKey: string; useLocalProfiles: boolean; allowWebSearchFallback: boolean; enableWebSearch?: boolean; reasoningEffort?: string }) => {
  const { model, apiKey, useLocalProfiles, allowWebSearchFallback, enableWebSearch = false, reasoningEffort } = opts

  const hasSystemMessage = messages.length > 1 || messages[0]?.role === 'system'

  let contents: any[]
  let systemMessage: any = null

  if (hasSystemMessage && messages.length > 1) {
    systemMessage = messages[0]
    contents = messages.slice(1).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  } else {
    contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const shouldSearch = enableWebSearch && !(useLocalProfiles && !allowWebSearchFallback)

  const requestBody: any = {
    contents: contents,
    generationConfig: {
      responseMimeType: shouldSearch ? undefined : 'application/json'
    }
  }

  if (reasoningEffort && reasoningEffort !== 'default') {
    if (model.includes('gemini-2.5')) {
      // Gemini 2.5: Use thinkingBudget
      let budget = 4096 // Default
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
      // Gemini 3: Use thinkingLevel
      let level = 'LOW' // Default
      const isFlash = model.includes('flash')

      if (isFlash) {
        // Flash supports MINIMAL, LOW, MEDIUM, HIGH
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
        // Pro supports LOW, HIGH
        switch (reasoningEffort) {
          case 'minimal':
            level = 'LOW'
            break
          case 'low':
            level = 'LOW'
            break
          case 'medium':
            level = 'HIGH'
            break // Map medium to high for Pro
          case 'high':
            level = 'HIGH'
            break
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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error('Gemini API Error Details:', errorData)
    if (response.status === 503) {
      throw new Error('Gemini API Error: 503 Service Unavailable')
    }
    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

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

export const enrichActionsWithAnimations = async (
  actions: any[],
  opts: {
    apiProvider: string
    apiKey: string
    model?: string
    maxTokens?: number
    currentCharacterId: string
    filteredAnimations: string[]
    animationEnrichmentPrompt: string
    preserveExistingAnimations?: boolean
    localUrl?: string
  }
): Promise<any[]> => {
  console.log('Enriching actions with animations...')

  const { apiProvider, apiKey, model, maxTokens, currentCharacterId, filteredAnimations, animationEnrichmentPrompt, preserveExistingAnimations = true, localUrl } = opts

  const hasMeaningfulAnimation = (anim: any): boolean => {
    if (typeof anim !== 'string') return false
    const t = anim.trim().toLowerCase()
    if (!t) return false
    return t !== 'idle' && t !== 'none'
  }

  const prompt = animationEnrichmentPrompt
    .replace('{currentCharacterId}', currentCharacterId)
    .replace('{filteredAnimations}', JSON.stringify(filteredAnimations))
    .replace('{animationMappings}', JSON.stringify(animationMappings, null, 2))
    .replace(
      '{actions}',
      JSON.stringify(
        actions.map((a, i) => ({ index: i, text: a.text, character: a.character, speaking: Boolean(a.speaking) })),
        null,
        2
      )
    )

  const messages = [{ role: 'user', content: prompt }]
  let enrichedActions: any[] = []

  try {
    let response: string

    if (apiProvider === 'perplexity') {
      response = await callPerplexity(messages, { model: model!, apiKey, useLocalProfiles: false, allowWebSearchFallback: false })
    } else if (apiProvider === 'gemini') {
      response = await callGemini(messages, { model: model!, apiKey, useLocalProfiles: false, allowWebSearchFallback: false })
    } else if (apiProvider === 'openrouter') {
      response = await callOpenRouter(messages, {
        model: model!,
        apiKey,
        enableContextCaching: false,
        useLocalProfiles: false,
        allowWebSearchFallback: false,
        modeIsGame: false,
        prompts: {} as any // Not needed for this call
      })
    } else if (apiProvider === 'pollinations') {
      response = await callPollinations(messages, {
        model: model!,
        apiKey,
        useLocalProfiles: false,
        allowWebSearchFallback: false,
        modeIsGame: false
      })
    } else if (apiProvider === 'local' && localUrl) {
      response = await callLocal(messages, {
        model,
        maxTokens,
        apiKey,
        localUrl,
        modeIsGame: false
      })
    } else {
      return actions
    }

    let jsonStr = response.replace(/```json\n?|\n?```/g, '').trim()
    const start = jsonStr.indexOf('[')
    const end = jsonStr.lastIndexOf(']')

    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1)
      const animations = JSON.parse(jsonStr)

      if (Array.isArray(animations) && animations.length === actions.length) {
        enrichedActions = actions.map((action, index) => ({
          ...action,
          animation: animations[index]
        }))
      }
    }
  } catch (e) {
    console.error('Failed to enrich animations via API, using local fallback', e)
  }

  if (enrichedActions.length === 0) {
    // Local fallback: use animationMappings to match keywords to animations
    enrichedActions = actions.map((action) => {
      const text = (action.text || '').toLowerCase()
      let animation = 'idle'

      // Use animationMappings to find matching animation
      for (const [animationType, keywords] of Object.entries(animationMappings)) {
        const hasKeyword = keywords.some((keyword) => text.includes(keyword.toLowerCase()))

        if (hasKeyword) {
          // Find the best available animation matching this type
          const matchedAnim = filteredAnimations.find((a: string) => a.includes(animationType))
          if (matchedAnim) {
            animation = matchedAnim
          } else {
            animation = animationType
          }
          break
        }
      }

      return { ...action, animation }
    })
  }

  // Merge: preserve existing non-idle animations unless explicitly missing.
  // This prevents a late enrichment pass (post-sanitize) from degrading already-good model choices.
  const mergedActions = enrichedActions.map((action, index) => {
    if (!preserveExistingAnimations) return action
    const original = actions[index]
    if (original && hasMeaningfulAnimation(original.animation)) {
      return { ...action, animation: original.animation }
    }
    return action
  })

  // FINAL PASS: Force high intensity for ALL CAPS (shouting/anger)
  // This applies to both preserved and enriched results.
  return mergedActions.map((action) => {
    const originalText = action.text || ''
    const capsWords = originalText.match(/\b[A-Z]{2,}\b/g)
    const isShouting = capsWords && capsWords.length > 0

    if (isShouting) {
      // Prefer high-intensity variants: angry_02, then shock, then angry
      const bestHighIntensity = filteredAnimations.find((a) => a.toLowerCase().includes('angry_02')) || filteredAnimations.find((a) => a.toLowerCase().includes('shock')) || filteredAnimations.find((a) => a.toLowerCase().includes('angry'))

      if (bestHighIntensity) {
        return { ...action, animation: bestHighIntensity }
      } else if (action.character !== currentCharacterId) {
        // For non-current characters, use generic high-intensity name
        return { ...action, animation: 'angry_02' }
      }
    }
    return action
  })
}
