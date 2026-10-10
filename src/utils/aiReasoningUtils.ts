let pendingReasoning: string | undefined

export function resetModelReasoning() {
  pendingReasoning = undefined
}

export function captureModelReasoning(reasoning?: string) {
  const trimmed = typeof reasoning === 'string' ? reasoning.trim() : ''
  pendingReasoning = trimmed || undefined
}

export function consumeModelReasoning(): string | undefined {
  const value = pendingReasoning
  pendingReasoning = undefined

  return value
}

export function extractOpenAiReasoning(message: any): string | undefined {
  if (!message || typeof message !== 'object') return undefined

  if (typeof message.reasoning === 'string' && message.reasoning.trim()) {
    return message.reasoning
  }

  if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
    return message.reasoning_content
  }

  if (Array.isArray(message.reasoning_details)) {
    const parts = message.reasoning_details
      .map((detail: any) => {
        if (typeof detail === 'string') return detail
        if (typeof detail?.text === 'string') return detail.text
        if (typeof detail?.summary === 'string') return detail.summary

        return ''
      })
      .filter(Boolean)

    if (parts.length) return parts.join('\n')
  }

  return undefined
}

export function captureReasoningFromOpenAiData(data: any, includeReasoning: boolean) {
  if (!includeReasoning) return

  captureModelReasoning(extractOpenAiReasoning(data?.choices?.[0]?.message))
}

export function takeOpenAiMessageContent(data: any, includeReasoning = false): string {
  captureReasoningFromOpenAiData(data, includeReasoning)

  return data?.choices?.[0]?.message?.content
}

export function extractAnthropicTextAndReasoning(data: any): { content: string; reasoning?: string } {
  const blocks = Array.isArray(data?.content) ? data.content : []
  const thinking = blocks
    .filter((block: any) => block.type === 'thinking')
    .map((block: any) => block.thinking || block.text)
    .filter(Boolean)
  const textBlock = blocks.find((block: any) => block.type === 'text' && typeof block.text === 'string')

  return {
    content: textBlock?.text ?? '',
    reasoning: thinking.length ? thinking.join('\n') : undefined
  }
}
