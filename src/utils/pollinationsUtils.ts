// Pollinations API utilities
import { AIError, logDebug } from '@/utils/chatUtils'
import { modelsWithoutJsonSupport, modelsWithoutCacheControlSupport, modelsRequiringStreamForHighTokens } from './providerConfigUtils'
import { buildStoryResponseSchema } from '@/utils/providerConfigUtils'

const buildPollinationsMessages = (messages: any[], model: string, enableContextCaching?: boolean) => {
  const shouldAddCacheControl = !!enableContextCaching && !modelsWithoutCacheControlSupport.value.has(model)
  const processedMessages = shouldAddCacheControl ? messages.map((m) => ({ ...m, cache_control: { type: 'ephemeral' } })) : messages
  return { processedMessages, shouldAddCacheControl }
}

/**
 * Handles the cache_control retry logic for Pollinations requests.
 * When a model rejects cache_control, remembers the model, strips cache_control,
 * and re-fetches. Returns the retry Response on success, or throws/returns error data
 * for the caller to handle secondary errors.
 *
 * Returns null if this error is not a cache_control error (caller should continue its own error handling).
 * Returns { retryResponse, retryErrorData } if it is — retryResponse is set on success, retryErrorData on failure.
 */
const handleCacheControlRetry = async (status: number, errorData: any, shouldAddCacheControl: boolean, model: string, messages: any[], requestBody: any, url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<{ retryResponse: Response; retryErrorData?: undefined } | { retryResponse?: undefined; retryErrorData: any } | null> => {
  if (!(status === 400 && shouldAddCacheControl && errorData?.error?.message?.includes('cache_control'))) {
    return null
  }

  console.warn(`Model ${model} does not support cache_control, remembering and retrying without it...`)
  modelsWithoutCacheControlSupport.value.add(model)
  sessionStorage.setItem('modelsWithoutCacheControlSupport', JSON.stringify([...modelsWithoutCacheControlSupport.value]))

  requestBody.messages = messages
  const retryResponse = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody),
    signal
  })

  if (!retryResponse.ok) {
    const retryErrorData = await retryResponse.json().catch(() => ({}))
    return { retryErrorData }
  }

  return { retryResponse }
}

const parsePollinationsStreamResponse = async (response: Response) => {
  if (!response.body) {
    throw new Error('Pollinations API Error: Missing response body for stream')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let content = ''

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed?.choices?.[0]?.delta?.content
        const message = parsed?.choices?.[0]?.message?.content
        if (typeof delta === 'string') {
          content += delta
        } else if (typeof message === 'string') {
          content += message
        }
      } catch (error) {
        console.warn('Pollinations stream chunk parse error:', error)
      }
    }
  }

  return content
}

const getRequiredPollinationsApiKey = (apiKey?: string) => {
  const trimmedApiKey = apiKey?.trim()

  if (!trimmedApiKey) {
    throw new AIError(401, 'Pollinations API key is required.')
  }

  return trimmedApiKey
}

export const callPollinationsSummarization = async (messages: any[], apiKey: string, model: string, enableContextCaching?: boolean, signal?: AbortSignal) => {
  const pollinationsApiKey = getRequiredPollinationsApiKey(apiKey)
  const { processedMessages, shouldAddCacheControl } = buildPollinationsMessages(messages, model, enableContextCaching)

  const requestBody: any = {
    model: model,
    messages: processedMessages,
    max_tokens: 32768 // Double the normal limit for summarization
  }

  if (modelsRequiringStreamForHighTokens.value.has(model) && requestBody.max_tokens > 4096) {
    requestBody.stream = true
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${pollinationsApiKey}`
  }

  const url = 'https://gen.pollinations.ai/v1/chat/completions'

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Pollinations Summarization API Error Details:', errorData)

    if (response.status === 400 && errorData?.error?.message?.includes('max_tokens >') && errorData?.error?.message?.includes('stream=true')) {
      console.warn('Pollinations requires stream=true for max_tokens > 16000, retrying with stream enabled...')
      requestBody.stream = true
      modelsRequiringStreamForHighTokens.value.add(model)
      sessionStorage.setItem('modelsRequiringStreamForHighTokens', JSON.stringify([...modelsRequiringStreamForHighTokens.value]))
      const retryResponse = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        signal
      })

      if (!retryResponse.ok) {
        const retryErrorData = await retryResponse.json().catch(() => ({}))
        throw new AIError(retryErrorData?.error?.code ?? retryResponse.status, retryErrorData?.error?.message ?? retryResponse.statusText ?? 'Unknown error')
      }
      return await parsePollinationsStreamResponse(retryResponse)
    }

    const cacheRetry = await handleCacheControlRetry(response.status, errorData, shouldAddCacheControl, model, messages, requestBody, url, headers, signal)
    if (cacheRetry) {
      if (cacheRetry.retryResponse) {
        if (requestBody.stream) {
          return await parsePollinationsStreamResponse(cacheRetry.retryResponse)
        }
        const retryData = await cacheRetry.retryResponse.json()
        return retryData.choices[0].message.content
      }
      // Retry failed — check if max_tokens is also too high
      if (cacheRetry.retryErrorData?.error?.message?.includes('max_tokens')) {
        console.warn(`Model ${model} also doesn't support 32768 max_tokens, falling back to 16384...`)
        requestBody.max_tokens = 16384
        const fallbackResponse = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
          signal
        })

        if (!fallbackResponse.ok) {
          const fallbackErrorData = await fallbackResponse.json().catch(() => ({}))
          throw new AIError(fallbackErrorData?.error?.code ?? fallbackResponse.status, fallbackErrorData?.error?.message ?? fallbackResponse.statusText ?? 'Unknown error')
        }
        const fallbackData = await fallbackResponse.json()
        return fallbackData.choices[0].message.content
      }
      throw new AIError(cacheRetry.retryErrorData?.error?.code ?? 'UNKNOWN', cacheRetry.retryErrorData?.error?.message ?? 'Unknown error')
    }

    // If max_tokens is too high for this model, try with standard limit
    if (response.status === 400 && errorData?.error?.message?.includes('max_tokens')) {
      console.warn(`Model ${model} doesn't support 32768 max_tokens, falling back to 16384...`)
      requestBody.max_tokens = 16384
      const retryResponse = await fetch(url, {
        method: 'POST',
        headers: headers,
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

    throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
  }

  if (requestBody.stream) {
    return await parsePollinationsStreamResponse(response)
  }

  const data = await response.json()
  return data.choices[0].message.content
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
    signal?: AbortSignal
  }
) => {
  const { model, apiKey, modeIsGame, reasoningEffort, enableContextCaching, signal } = opts
  const pollinationsApiKey = getRequiredPollinationsApiKey(apiKey)

  if (modelsWithoutJsonSupport.value.has(model)) {
    logDebug(`Model ${model} known to not support json_schema, using text fallback...`)
    return callPollinationsWithoutJson(messages, { model, apiKey, reasoningEffort, enableContextCaching, signal })
  }

  const { processedMessages, shouldAddCacheControl } = buildPollinationsMessages(messages, model, enableContextCaching)

  const requestBody: any = {
    model: model,
    messages: processedMessages,
    max_tokens: 16384,
    response_format: buildStoryResponseSchema(modeIsGame),
    private: true
  }

  if (modelsRequiringStreamForHighTokens.value.has(model) && requestBody.max_tokens > 4096) {
    requestBody.stream = true
  }

  if (reasoningEffort && reasoningEffort !== 'default') {
    requestBody.reasoning_effort = reasoningEffort
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${pollinationsApiKey}`
  }

  const url = 'https://gen.pollinations.ai/v1/chat/completions'

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Pollinations API Error Details:', errorData)

    if (response.status === 429) {
      throw new Error('RATE_LIMITED')
    }

    if (response.status === 400 && errorData?.error?.message?.includes('max_tokens >') && errorData?.error?.message?.includes('stream=true')) {
      console.warn('Pollinations requires stream=true for max_tokens > 16000, retrying with stream enabled...')
      requestBody.stream = true
      modelsRequiringStreamForHighTokens.value.add(model)
      sessionStorage.setItem('modelsRequiringStreamForHighTokens', JSON.stringify([...modelsRequiringStreamForHighTokens.value]))
      const retryResponse = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        signal
      })

      if (!retryResponse.ok) {
        const retryErrorData = await retryResponse.json().catch(() => ({}))
        throw new AIError(retryErrorData?.error?.code ?? retryResponse.status, retryErrorData?.error?.message ?? retryResponse.statusText ?? 'Unknown error')
      }
      return await parsePollinationsStreamResponse(retryResponse)
    }

    const cacheRetry = await handleCacheControlRetry(response.status, errorData, shouldAddCacheControl, model, messages, requestBody, url, headers, signal)
    if (cacheRetry) {
      if (cacheRetry.retryResponse) {
        if (requestBody.stream) {
          return await parsePollinationsStreamResponse(cacheRetry.retryResponse)
        }
        const retryData = await cacheRetry.retryResponse.json()
        return retryData.choices[0].message.content
      }
      // Retry failed — check if this model also doesn't support json_schema
      if (cacheRetry.retryErrorData?.error?.message?.includes('response_format') || cacheRetry.retryErrorData?.error?.message?.includes('json_schema') || cacheRetry.retryErrorData?.error?.message?.includes('controlled generation')) {
        console.warn(`Model ${model} also does not support json_schema response format, remembering and retrying without it...`)
        modelsWithoutJsonSupport.value.add(model)
        sessionStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport.value]))
        return callPollinationsWithoutJson(messages, { model, apiKey, enableContextCaching, signal })
      }
      throw new AIError(cacheRetry.retryErrorData?.error?.code ?? 'UNKNOWN', cacheRetry.retryErrorData?.error?.message ?? 'Unknown error')
    }

    if (response.status === 400 && (errorData?.error?.message?.includes('response_format') || errorData?.error?.message?.includes('json_schema') || errorData?.error?.message?.includes('controlled generation'))) {
      console.warn(`Model ${model} does not support json_schema response format, remembering and retrying without it...`)
      modelsWithoutJsonSupport.value.add(model)
      sessionStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport.value]))
      return callPollinationsWithoutJson(messages, { model, apiKey, enableContextCaching, signal })
    }

    throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
  }

  if (requestBody.stream) {
    return await parsePollinationsStreamResponse(response)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export const callPollinationsWithoutJson = async (messages: any[], opts: { model: string; apiKey?: string; reasoningEffort?: string; enableContextCaching?: boolean; signal?: AbortSignal }) => {
  const { model, apiKey, reasoningEffort, enableContextCaching, signal } = opts
  const pollinationsApiKey = getRequiredPollinationsApiKey(apiKey)

  const { processedMessages, shouldAddCacheControl } = buildPollinationsMessages(messages, model, enableContextCaching)

  const requestBody: any = {
    model: model,
    messages: processedMessages,
    max_tokens: 16384
  }

  if (modelsRequiringStreamForHighTokens.value.has(model) && requestBody.max_tokens > 4096) {
    requestBody.stream = true
  }

  if (reasoningEffort && reasoningEffort !== 'default') {
    requestBody.reasoning_effort = reasoningEffort
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${pollinationsApiKey}`
  }

  const url = 'https://gen.pollinations.ai/v1/chat/completions'

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Pollinations API Error Details:', errorData)
    if (response.status === 429) {
      throw new Error('RATE_LIMITED')
    }
    if (response.status === 400 && errorData?.error?.message?.includes('max_tokens > 4096') && errorData?.error?.message?.includes('stream=true')) {
      console.warn('Pollinations requires stream=true for max_tokens > 4096, retrying with stream enabled...')
      requestBody.stream = true
      modelsRequiringStreamForHighTokens.value.add(model)
      sessionStorage.setItem('modelsRequiringStreamForHighTokens', JSON.stringify([...modelsRequiringStreamForHighTokens.value]))
      const retryResponse = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        signal
      })

      if (!retryResponse.ok) {
        const retryErrorData = await retryResponse.json().catch(() => ({}))
        throw new AIError(retryErrorData?.error?.code ?? retryResponse.status, retryErrorData?.error?.message ?? retryResponse.statusText ?? 'Unknown error')
      }
      return await parsePollinationsStreamResponse(retryResponse)
    }
    const cacheRetry = await handleCacheControlRetry(response.status, errorData, shouldAddCacheControl, model, messages, requestBody, url, headers, signal)
    if (cacheRetry) {
      if (cacheRetry.retryResponse) {
        if (requestBody.stream) {
          return await parsePollinationsStreamResponse(cacheRetry.retryResponse)
        }
        const retryData = await cacheRetry.retryResponse.json()
        return retryData.choices[0].message.content
      }
      throw new AIError(cacheRetry.retryErrorData?.error?.code ?? 'UNKNOWN', cacheRetry.retryErrorData?.error?.message ?? 'Unknown error')
    }
    throw new AIError(errorData?.error?.code ?? response.status, errorData?.error?.message ?? response.statusText ?? 'Unknown error')
  }

  if (requestBody.stream) {
    return await parsePollinationsStreamResponse(response)
  }

  const data = await response.json()
  return data.choices[0].message.content
}