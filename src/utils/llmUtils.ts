// LLM utility functions for summarization and API calls
// These functions handle higher token limits for summarization tasks

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