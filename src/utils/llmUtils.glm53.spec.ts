import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callOpenCodeGo, callOpenCodeGoSummarization } from '@/utils/llmUtils'
import { modelsWithoutJsonSupport, modelsWithoutReasoningSupport } from '@/utils/providerConfigUtils'

const UPSTREAM_REASONING_REJECTION = {
  error: {
    type: 'invalid_request_error',
    code: 'invalid_request_error',
    message: "Upstream request failed: [invalid_request_error] Extra inputs are not permitted, field: 'reasoning'"
  }
}

const GLM_5_3_EFFORTS = ['low', 'high', 'max']

const messages = [{ role: 'user', content: 'Reply with the single word ok.' }]

let requests: any[] = []

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

// Strict stand-in for the Z.AI schema OpenCode Go forwards to.
// `reasoning` is not a property. `reasoning_effort` is low | high | max.
const strictGlmUpstream = (body: any) => {
  if (Object.prototype.hasOwnProperty.call(body, 'reasoning')) {
    return jsonResponse(400, UPSTREAM_REASONING_REJECTION)
  }

  if (body.reasoning_effort !== undefined && !GLM_5_3_EFFORTS.includes(body.reasoning_effort)) {
    return jsonResponse(400, {
      error: {
        type: 'invalid_request_error',
        code: 'invalid_request_error',
        message: `Upstream request failed: [invalid_request_error] Invalid reasoning_effort '${body.reasoning_effort}'`
      }
    })
  }

  return jsonResponse(200, {
    choices: [{ message: { role: 'assistant', content: 'ok', reasoning_content: 'thought' } }]
  })
}

describe('OpenCode Go glm-5.3 reasoning field', () => {
  beforeEach(() => {
    requests = []
    modelsWithoutJsonSupport.value.clear()
    modelsWithoutReasoningSupport.value.clear()
    sessionStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}'))
        requests.push(body)

        if (body.model === 'glm-5.3' || body.model === 'glm-5.3-flash') {
          return strictGlmUpstream(body)
        }

        return jsonResponse(200, {
          choices: [{ message: { role: 'assistant', content: 'other-ok' } }]
        })
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends reasoning_effort for glm-5.3 and the upstream accepts the first request', async () => {
    const result = await callOpenCodeGo(messages, {
      model: 'glm-5.3',
      apiKey: 'test-key',
      modeIsGame: false,
      maxTokens: 32,
      reasoningEffort: 'high'
    })

    const sent = requests[0]

    expect(requests, JSON.stringify({ sent, upstream: requests.length > 1 ? 'retried after rejection' : 'accepted' })).toHaveLength(1)
    expect(sent.reasoning, JSON.stringify(sent)).toBeUndefined()
    expect(sent.reasoning_effort).toBe('high')
    expect(sent.model).toBe('glm-5.3')
    expect(result).toBe('ok')
    expect(modelsWithoutReasoningSupport.value.has('glm-5.3')).toBe(false)
  })

  it('hardcodes None to low for glm-5.3 and glm-5.3-flash', async () => {
    for (const model of ['glm-5.3', 'glm-5.3-flash']) {
      requests = []
      modelsWithoutReasoningSupport.value.clear()
      await callOpenCodeGo(messages, {
        model,
        apiKey: 'test-key',
        modeIsGame: false,
        maxTokens: 32,
        reasoningEffort: 'none'
      })
      expect(requests, model).toHaveLength(1)
      expect(requests[0].reasoning, model).toBeUndefined()
      expect(requests[0].reasoning_effort, model).toBe('low')
    }
  })

  it('maps the effort dropdown onto low, high, and max', async () => {
    const cases = [
      ['none', 'low'],
      ['minimal', 'low'],
      ['low', 'low'],
      ['medium', 'high'],
      ['high', 'high'],
      ['xhigh', 'max']
    ] as const

    for (const [selected, expected] of cases) {
      requests = []
      modelsWithoutReasoningSupport.value.clear()
      await callOpenCodeGo(messages, {
        model: 'glm-5.3',
        apiKey: 'test-key',
        modeIsGame: false,
        maxTokens: 32,
        reasoningEffort: selected
      })
      expect(requests[0].reasoning, `${selected} body ${JSON.stringify(requests[0])}`).toBeUndefined()
      expect(requests[0].reasoning_effort, selected).toBe(expected)
      expect(requests, selected).toHaveLength(1)
    }
  })

  it('sends reasoning_effort on the text summarization path', async () => {
    await callOpenCodeGoSummarization(messages, {
      model: 'glm-5.3',
      apiKey: 'test-key',
      maxTokens: 32,
      reasoningEffort: 'low'
    })

    expect(requests).toHaveLength(1)
    expect(requests[0].reasoning).toBeUndefined()
    expect(requests[0].reasoning_effort).toBe('low')
    expect(requests[0].response_format).toBeUndefined()
  })

  it('omits both reasoning fields when effort is default', async () => {
    await callOpenCodeGo(messages, {
      model: 'glm-5.3',
      apiKey: 'test-key',
      modeIsGame: false,
      maxTokens: 32,
      reasoningEffort: 'default'
    })

    expect(requests).toHaveLength(1)
    expect(requests[0].reasoning).toBeUndefined()
    expect(requests[0].reasoning_effort).toBeUndefined()
  })

  it('still sends the reasoning object for another OpenCode Go chat model', async () => {
    const result = await callOpenCodeGo(messages, {
      model: 'kimi-k2.6',
      apiKey: 'test-key',
      modeIsGame: false,
      maxTokens: 32,
      reasoningEffort: 'high'
    })

    expect(requests).toHaveLength(1)
    expect(requests[0].reasoning).toEqual({ effort: 'high', exclude: false })
    expect(requests[0].reasoning_effort).toBeUndefined()
    expect(result).toBe('other-ok')

    requests = []
    await callOpenCodeGo(messages, {
      model: 'kimi-k2.6',
      apiKey: 'test-key',
      modeIsGame: false,
      maxTokens: 32,
      reasoningEffort: 'none'
    })
    expect(requests[0].reasoning).toEqual({ effort: 'none', exclude: false })
    expect(requests[0].reasoning_effort).toBeUndefined()
  })
})
