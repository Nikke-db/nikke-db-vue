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

const OPENCODE_GO_BASE = import.meta.env.DEV ? '/opencode-go' : 'https://opencode.ai'
export const OPENCODE_GO_CHAT_COMPLETIONS_URL = `${OPENCODE_GO_BASE}/zen/go/v1/chat/completions`
export const OPENCODE_GO_MESSAGES_URL = `${OPENCODE_GO_BASE}/zen/go/v1/messages`
export const OPENCODE_GO_MODELS_URL = `${OPENCODE_GO_BASE}/zen/go/v1/models`
export const OPENCODE_GO_EXCLUDED_MODEL_IDS = new Set([
  'minimax-m2.5',
  'minimax-m2.7'
])
export const OPENCODE_GO_ANTHROPIC_MODELS = new Set([
  'minimax-m3',
  'minimax-m2.7',
  'minimax-m2.5',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.6-plus'
])

const OPENCODE_GO_SESSION_STORAGE_KEY = 'nikke_opencode_go_session'
const OPENCODE_GO_CLIENT_ID = 'nikke-db-story-gen'

export const getOpenCodeGoSessionId = (): string => {
  let id = sessionStorage.getItem(OPENCODE_GO_SESSION_STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(OPENCODE_GO_SESSION_STORAGE_KEY, id)
  }

  return id
}

export const rotateOpenCodeGoSessionId = (): string => {
  const id = crypto.randomUUID()
  sessionStorage.setItem(OPENCODE_GO_SESSION_STORAGE_KEY, id)

  return id
}

export const buildOpenCodeGoHeaders = (base: Record<string, string> = {}): Record<string, string> => {
  return {
    ...base,
    'x-opencode-session': getOpenCodeGoSessionId(),
    'x-opencode-client': OPENCODE_GO_CLIENT_ID
  }
}

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

const nullableSchema = (schema: Record<string, any>) => {
  return { anyOf: [schema, { type: 'null' }] }
}

const strictObject = (properties: Record<string, any>) => {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties)
  }
}

const stringMapSchema = {
  type: 'object',
  properties: {},
  required: [] as string[],
  additionalProperties: { type: 'string' }
}

const openMapSchema = (valueSchema: Record<string, any>) => {
  return {
    type: 'object',
    properties: {},
    required: [] as string[],
    additionalProperties: valueSchema
  }
}

const memoryProfileSchema = strictObject({
  personality: nullableSchema({ type: 'string' }),
  speech_style: nullableSchema({ type: 'string' }),
  backstory: nullableSchema({ type: 'string' }),
  relationships: stringMapSchema
})

const progressionProfileSchema = strictObject({
  personality: nullableSchema({ type: 'string' }),
  backstory: nullableSchema({ type: 'string' }),
  relationships: stringMapSchema
})

const backgroundObjectSchema = strictObject({
  key: { type: 'string' },
  variant: nullableSchema({ type: 'string' })
})

// Structured output schema builder (used by ChatInterface for OpenRouter/Pollinations JSON schema mode)
export const buildStoryResponseSchema = (isGameMode: boolean, includeAnimReason = false) => {
  const actionProperties: Record<string, any> = {
    needs_search: { type: 'array', items: { type: 'string' } },
    memory: openMapSchema(memoryProfileSchema),
    characterProgression: openMapSchema(progressionProfileSchema),
    text: { type: 'string' },
    character: { type: 'string' },
    animation: { type: 'string' }
  }

  if (includeAnimReason) {
    actionProperties.anim_reason = { type: 'string' }
  }

  actionProperties.background = {
    anyOf: [{ type: 'string' }, backgroundObjectSchema, { type: 'null' }]
  }
  actionProperties.speaking = { type: 'boolean' }
  actionProperties.duration = nullableSchema({ type: 'number' })

  const properties: Record<string, any> = {
    actions: {
      type: 'array',
      minItems: 1,
      items: strictObject(actionProperties)
    }
  }

  if (isGameMode) {
    properties.choices = {
      type: 'array',
      items: strictObject({
        text: { type: 'string' },
        type: { type: 'string', enum: ['dialogue', 'action'] }
      })
    }
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: 'StoryResponse',
      schema: {
        type: 'object',
        properties,
        required: Object.keys(properties)
      }
    }
  }
}
