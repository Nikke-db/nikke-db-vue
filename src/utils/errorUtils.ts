// Custom error class for AI API errors, preserving structured code and message from the response.
export class AIError extends Error {
  code: number | string
  apiMessage: string

  constructor(code: number | string, apiMessage: string) {
    super(`${code}: ${apiMessage}`)
    this.name = 'AIError'
    this.code = code
    this.apiMessage = apiMessage
  }
}

// Maps known AI error codes/messages to user-friendly error strings.
export const getAIErrorMessage = (error: any): string => {
  if (error.message === 'RATE_LIMITED') {
    return 'Error 429: Model is temporarily rate-limited. Please wait a moment and click Retry.'
  } else if (error.message === 'FREE_MODEL_RATE_LIMITED') {
    return 'Error: OpenRouter is restricting your ability to use free models due to anti-spam, rate-limiting policies. To remove this restriction, you must add at least $10 of credits to your OpenRouter account. This operation needs to be performed only once.'
  } else if (error.message === 'GUARDRAIL_RESTRICTION') {
    return 'Error: The only available endpoints for the requested model are incompatible with your OpenRouter privacy settings (train on your prompts or publish them). To continue, either change your restrictions on your OpenRouter account to allow endpoints for free (or paid) models to train on your prompts, or use a different model that does not require these changes.'
  } else if (error.message && error.message.includes('503')) {
    return 'Error 503: Model Overloaded. Please try again.'
  } else if (error.message === 'JSON_PARSE_ERROR') {
    return 'Error: Failed to parse AI response after multiple attempts. Please try again.'
  } else if (error.message === 'GEMINI_PROHIBITED_CONTENT') {
    return 'Error: response filtered by Gemini\'s built-in, irremovable safety filters (false positives are possible).'
  }
  if (error instanceof AIError) {
    return `Error ${error.code}: ${error.apiMessage}`
  }
  return 'Error: Failed to get response from AI.'
}

// Simple debug helper used across chat components
export const logDebug = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}
