import { afterEach, expect, test, vi } from 'vitest'
import { fetchPollinationsModels } from './llmUtils'
import { usesPollinationsAutoFallback } from './aiWebSearchUtils'

afterEach(() => vi.unstubAllGlobals())

test('keeps native search controls when the catalog uses canonical names', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      { name: 'perplexity/sonar', aliases: ['perplexity-fast'] },
      { name: 'openai/gpt-audio-mini', aliases: ['openai-audio'] },
      { name: 'openai/gpt-5.4-nano', aliases: ['openai'] }
    ]
  }))
  const models = await fetchPollinationsModels('test-key')
  expect(models).toEqual([
    { label: 'openai/gpt-5.4-nano', value: 'openai/gpt-5.4-nano' },
    { label: 'perplexity/sonar', value: 'perplexity-fast' }
  ])
  expect(usesPollinationsAutoFallback('pollinations', models[1].value)).toBe(false)
  expect(usesPollinationsAutoFallback('pollinations', models[0].value)).toBe(true)
})

test('keeps legacy and unknown catalog entries unchanged', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ name: 'gemini-search' }, { name: 'new/model' }]
  }))
  expect(await fetchPollinationsModels('test-key')).toEqual([
    { label: 'gemini-search', value: 'gemini-search' },
    { label: 'new/model', value: 'new/model' }
  ])
})
