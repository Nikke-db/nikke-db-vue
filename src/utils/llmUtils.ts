// LLM utility functions for summarization and API calls
// These functions handle higher token limits for summarization tasks

import { animationMappings } from '@/utils/animationMappings'

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
      'Authorization': `Bearer ${apiKey}`,
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
          'Authorization': `Bearer ${apiKey}`,
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

export const callPollinationsSummarization = async (messages: any[], apiKey: string, model: string) => {
  // Use higher max_tokens for summarization to handle long inputs
  const requestBody: any = {
    model: model,
    messages: messages,
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
    model: string,
    apiKey?: string,
    useLocalProfiles: boolean,
    allowWebSearchFallback: boolean,
    modeIsGame: boolean,
    enableWebSearch?: boolean,
    modelsWithoutJsonSupport: Set<string>
  }
) => {
  const { model, apiKey, useLocalProfiles, allowWebSearchFallback, modeIsGame, enableWebSearch = false, modelsWithoutJsonSupport } = opts

  if (modelsWithoutJsonSupport.has(model)) {
    console.log(`Model ${model} known to not support json_schema, using text fallback...`)
    return callPollinationsWithoutJson(messages, { model, apiKey })
  }

  const requestBody: any = {
    model: model,
    messages: messages,
    max_tokens: 16384,
    response_format: buildStoryResponseSchema(modeIsGame),
    tools: [] // Explicitly disable tools to avoid conflict with controlled generation (Gemini 3)
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
      modelsWithoutJsonSupport.add(model)
      localStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport]))
      return callPollinationsWithoutJson(messages, { model, apiKey })
    }
    
    throw new Error(`Pollinations API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()

  return data.choices[0].message.content
}

export const callPollinationsWithoutJson = async (
  messages: any[],
  opts: { model: string, apiKey?: string }
) => {
  const { model, apiKey } = opts

  const requestBody: any = {
    model: model,
    messages: messages,
    max_tokens: 16384
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

export const callLocalSummarization = async (messages: any[], opts: { model?: string, maxTokens?: number, apiKey?: string, localUrl: string }) => {
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
    model?: string,
    maxTokens?: number,
    apiKey?: string,
    localUrl: string,
    modeIsGame: boolean,
    modelsWithoutJsonSupport: Set<string>
  }
) => {
  const { model, maxTokens = 8192, apiKey, localUrl, modeIsGame, modelsWithoutJsonSupport } = opts

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

  if (model && modelsWithoutJsonSupport.has(model)) {
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
        modelsWithoutJsonSupport.add(model)
        localStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport]))
      }
      return callWithoutJsonFormat()
    }

    throw new Error(`Local API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
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

// --- Exported network helpers moved from ChatInterface.vue ---

export const callOpenRouter = async (
  messages: any[],
  opts: {
    model: string,
    apiKey: string,
    enableContextCaching: boolean,
    useLocalProfiles: boolean,
    allowWebSearchFallback: boolean,
    modeIsGame: boolean,
    enableWebSearch?: boolean,
    searchUrl?: string,
    prompts: any,
    modelsWithoutJsonSupport: Set<string>
  }
) => {
  const {
    model,
    apiKey,
    enableContextCaching,
    useLocalProfiles,
    allowWebSearchFallback,
    modeIsGame,
    enableWebSearch = false,
    searchUrl,
    prompts,
    modelsWithoutJsonSupport
  } = opts

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

  const messagesWithEnforcement = [
    ...processedMessages,
    { role: 'user', content: prompts.reminders.jsonEnforcement }
  ]

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

    const webPlugin = buildWebPlugin()
    if (webPlugin) {
      requestBody.plugins = webPlugin
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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

  if (modelsWithoutJsonSupport.has(model)) {
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

  let plugins: any[] = []
  const webPlugin = buildWebPlugin()
  if (webPlugin) plugins = [...webPlugin]
  plugins.push({ id: 'response-healing' })

  if (plugins.length > 0) requestBody.plugins = plugins

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
      modelsWithoutJsonSupport.add(model)
      localStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport]))
      return callWithoutJsonFormat()
    }

    throw new Error(`OpenRouter API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()

  return data.choices[0].message.content
}

export const callPerplexity = async (
  messages: any[],
  opts: { model: string, apiKey: string, useLocalProfiles: boolean, allowWebSearchFallback: boolean, enableWebSearch?: boolean, searchUrl?: string }
) => {
  const { model, apiKey, useLocalProfiles, allowWebSearchFallback, enableWebSearch = false, searchUrl } = opts

  const requestBody: any = { model: model, messages: messages }

  const shouldSearch = enableWebSearch && !(useLocalProfiles && !allowWebSearchFallback)

  if (shouldSearch) {
    if (searchUrl) {
      const urlMatch = searchUrl.match(/https?:\/\/([^\/]+)/)
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
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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

export const callGemini = async (
  messages: any[],
  opts: { model: string, apiKey: string, useLocalProfiles: boolean, allowWebSearchFallback: boolean, enableWebSearch?: boolean }
) => {
  const { model, apiKey, useLocalProfiles, allowWebSearchFallback, enableWebSearch = false } = opts

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
    apiProvider: string,
    apiKey: string,
    model?: string,
    maxTokens?: number,
    currentCharacterId: string,
    filteredAnimations: string[],
    animationEnrichmentPrompt: string,
    preserveExistingAnimations?: boolean,
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
    .replace('{actions}', JSON.stringify(actions.map((a, i) => ({ index: i, text: a.text, character: a.character, speaking: Boolean(a.speaking) })), null, 2))

  const messages = [{ role: 'user', content: prompt }]
  let enrichedActions: any[] = []

  try {
    let response: string

    if (apiProvider === 'perplexity') {
      response = await callPerplexity(messages, { model, apiKey, useLocalProfiles: false, allowWebSearchFallback: false })
    } else if (apiProvider === 'gemini') {
      response = await callGemini(messages, { model, apiKey, useLocalProfiles: false, allowWebSearchFallback: false })
    } else if (apiProvider === 'openrouter') {
      response = await callOpenRouter(messages, {
        model,
        apiKey,
        enableContextCaching: false,
        useLocalProfiles: false,
        allowWebSearchFallback: false,
        modeIsGame: false,
        prompts: {} as any, // Not needed for this call
        modelsWithoutJsonSupport: new Set()
      })
    } else if (apiProvider === 'pollinations') {
      response = await callPollinations(messages, {
        model,
        apiKey,
        useLocalProfiles: false,
        allowWebSearchFallback: false,
        modeIsGame: false,
        modelsWithoutJsonSupport: new Set()
      })
    } else if (apiProvider === 'local' && localUrl) {
      response = await callLocal(messages, {
        model,
        maxTokens,
        apiKey,
        localUrl,
        modeIsGame: false,
        modelsWithoutJsonSupport: new Set()
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
      const bestHighIntensity = 
        filteredAnimations.find((a) => a.toLowerCase().includes('angry_02')) ||
        filteredAnimations.find((a) => a.toLowerCase().includes('shock')) ||
        filteredAnimations.find((a) => a.toLowerCase().includes('angry'))
      
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