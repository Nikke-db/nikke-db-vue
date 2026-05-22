import { ref } from 'vue'

export const modelsWithoutJsonSupport = ref<Set<string>>(new Set(JSON.parse(sessionStorage.getItem('modelsWithoutJsonSupport') || '[]')))
export const modelsRequiringStreamForHighTokens = ref<Set<string>>(new Set(JSON.parse(sessionStorage.getItem('modelsRequiringStreamForHighTokens') || '[]')))
export const modelsWithoutCacheControlSupport = ref<Set<string>>(new Set(JSON.parse(sessionStorage.getItem('modelsWithoutCacheControlSupport') || '[]')))
export const modelsWithoutReasoningSupport = ref<Set<string>>(new Set(JSON.parse(sessionStorage.getItem('modelsWithoutReasoningSupport') || '[]')))

export const providerOptions = [
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenCode Go', value: 'opencode-go' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Pollinations', value: 'pollinations' },
  { label: 'Local (OpenAI-compatible API)', value: 'local' }
]

export const OPENCODE_GO_CHAT_COMPLETIONS_URL = '/opencode-go/zen/go/v1/chat/completions'
export const OPENCODE_GO_MODELS_URL = '/opencode-go/zen/go/v1/models'
export const OPENCODE_GO_EXCLUDED_MODEL_IDS = new Set([
  'minimax-m2.5',
  'minimax-m2.7'
])

export const tokenUsageOptions = [
  { label: 'Low (10 turns)', value: 'low' },
  { label: 'Medium (30 turns)', value: 'medium' },
  { label: 'High (60 turns)', value: 'high' },
  { label: 'Goddess', value: 'goddess' }
]

/**
 * Returns the reasoning effort dropdown options for the given API provider.
 * In production, restricts options to 'medium' and below.
 */
export const getReasoningEffortOptions = (provider: string): { label: string; value: string }[] => {
  let options: { label: string; value: string }[] = []

  if (provider === 'openrouter' || provider === 'pollinations' || provider === 'local' || provider === 'opencode-go') {
    options = [
      { label: 'Default', value: 'default' },
      { label: 'None', value: 'none' },
      { label: 'Minimal', value: 'minimal' },
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Extra High', value: 'xhigh' }
    ]
  } else if (provider === 'gemini') {
    options = [
      { label: 'Default', value: 'default' },
      { label: 'Minimal', value: 'minimal' },
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Extra High', value: 'xhigh' }
    ]
  }

  // Restrict options in production since anything beyond 'medium' is silly
  if (!import.meta.env.DEV) {
    const allowedValues = ['default', 'none', 'minimal', 'low', 'medium']
    options = options.filter((o) => allowedValues.includes(o.value))
  }

  return options
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
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              needs_search: { type: 'array', items: { type: 'string' } },
              memory: { type: 'object' },
              characterProgression: { type: 'object' },
              text: { type: 'string' },
              character: { type: 'string' },
              animation: { type: 'string' },
              background: {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      variant: { type: 'string' }
                    },
                    required: ['key'],
                    additionalProperties: false
                  }
                ]
              },
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
