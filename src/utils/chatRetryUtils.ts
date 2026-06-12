import type { Ref } from 'vue'
import { logDebug, getAIErrorMessage } from '@/utils/chatUtils'

export interface AiTurnContext {
  isLoading: Ref<boolean>
  isGenerating: Ref<boolean>
  isStopped: Ref<boolean>
  showRetry: Ref<boolean>
  chatHistory: Ref<{ role: string; content: string }[]>
  getActiveAbortController: () => AbortController | null
  setActiveAbortController: (ctrl: AbortController | null) => void
  setRandomLoadingMessage: () => void
  scrollToBottom: () => void
  callAI: (isRetry: boolean) => Promise<string>
  processAIResponse: (response: string) => Promise<void>
  clearRemindersAfterSuccess: () => void
  flushPendingGameChoice: () => void
  logTag: string
}

export async function executeAiTurn(ctx: AiTurnContext): Promise<void> {
  ctx.isLoading.value = true
  ctx.isGenerating.value = true
  ctx.setRandomLoadingMessage()
  ctx.isStopped.value = false
  ctx.setActiveAbortController(new AbortController())
  ctx.showRetry.value = false

  const maxAttempts = 3
  let attempts = 0
  let success = false

  while (attempts < maxAttempts && !success && !ctx.isStopped.value) {
    attempts++
    try {
      const response = await ctx.callAI(attempts > 1)

      if (!ctx.isStopped.value) {
        await ctx.processAIResponse(response)
        success = true
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logDebug(`[${ctx.logTag}] Fetch aborted by user.`)
        break
      }

      if (error.message === 'JSON_PARSE_ERROR' && attempts < maxAttempts) {
        console.warn(`JSON parse error, retrying (${attempts}/${maxAttempts})...`)
        continue
      }

      console.error('AI Error:', error)
      ctx.showRetry.value = true
      ctx.chatHistory.value.push({ role: 'system', content: getAIErrorMessage(error) })
      break
    }
  }

  if (success) {
    ctx.clearRemindersAfterSuccess()
  }

  ctx.isGenerating.value = false
  ctx.isLoading.value = false
  ctx.scrollToBottom()
  ctx.flushPendingGameChoice()
}
