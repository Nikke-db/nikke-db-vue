/** Immutable snapshot of the state needed by the tumbling-window logic. */
export interface TumblingWindowState {
  tokenUsage: string
  chatHistory: { role: string; content: string }[]
  lastSummarizedIndex: number
  isLoadedSession: boolean
  summarizationRetryPending: boolean
  summarizationAttemptCount: number
  summarizationSuccessCount: number
  summaryJustCompacted: boolean
  autoCompactSummaries: boolean
  autoCompactFrequency: number
  storySummary: string
  isStopped: boolean
  compactMinLength: number
}

/** Callbacks the component must supply so the pure logic can delegate side-effects. */
export interface TumblingWindowCallbacks {
  summarizeChunk: (messages: { role: string; content: string }[]) => Promise<boolean>
  performCompaction: () => Promise<boolean>
  getOverlapMessageCount: (summarizeUpTo: number) => number
  setRandomLoadingMessage: () => void
}

/** Describes every ref mutation + contextMsg / historyToSend the caller should apply. */
export interface TumblingWindowResult {
  /** New value for lastSummarizedIndex (undefined = no change) */
  lastSummarizedIndex?: number
  /** New value for isLoadedSession (undefined = no change) */
  isLoadedSession?: boolean
  /** New value for summarizationRetryPending (undefined = no change) */
  summarizationRetryPending?: boolean
  /** New value for summarizationAttemptCount (undefined = no change) */
  summarizationAttemptCount?: number
  /** New value for summarizationSuccessCount (undefined = no change) */
  summarizationSuccessCount?: number
  /** New value for summaryJustCompacted (undefined = no change) */
  summaryJustCompacted?: boolean
  /** The contextMsg suffix to append (story summary line, or empty) */
  contextSuffix: string
  /** The sliced history to send to the provider */
  historyToSend: { role: string; content: string }[]
}

/**
 * Shared tumbling-window summarization logic used by both `callAI` and
 * `callAIWithoutSearch`.  The function is *almost* pure: it reads the
 * supplied state snapshot and delegates all async side-effects through
 * callbacks.  It returns a result object that tells the caller which
 * refs to update.
 *
 * @param state   Snapshot of every reactive value the logic reads.
 * @param cbs     Async callbacks for side-effects (summarize, compact, …).
 * @param logTag  Label used in logDebug messages (e.g. "[callAI]").
 */
export async function handleTumblingWindowSummarization(state: TumblingWindowState, cbs: TumblingWindowCallbacks, logTag: string): Promise<TumblingWindowResult> {
  const result: TumblingWindowResult = {
    contextSuffix: '',
    historyToSend: state.chatHistory
  }

  if (state.tokenUsage === 'goddess') {
    // Goddess mode: send everything, no summarization
    return result
  }

  let historyLimit = 30
  if (state.tokenUsage === 'low') historyLimit = 10
  else if (state.tokenUsage === 'medium') historyLimit = 30
  else if (state.tokenUsage === 'high') historyLimit = 60
  else if (state.tokenUsage === 'goddess') historyLimit = 99999

  // --- working copies of mutable indices (will be written back via result) ---
  let lastSumIdx = state.lastSummarizedIndex
  let retryPending = state.summarizationRetryPending
  let attemptCount = state.summarizationAttemptCount
  let successCount = state.summarizationSuccessCount
  let justCompacted = state.summaryJustCompacted
  let loadedSession = state.isLoadedSession
  let changed = false // track whether any ref-level mutation is needed

  const endIndex = state.chatHistory.length - 1
  const unsummarizedCount = endIndex - lastSumIdx
  const maxContextMessages = historyLimit * 2

  const overflowThreshold = Math.floor(maxContextMessages * 1.5)
  const shouldSummarizeDueToOverflow = loadedSession && unsummarizedCount > overflowThreshold

  let userMsgCount = 0
  for (let i = lastSumIdx; i < endIndex; i++) {
    if (state.chatHistory[i].role === 'user') {
      userMsgCount++
    }
  }

  const shouldRetryFailedSummarization = retryPending && endIndex > lastSumIdx
  const shouldSummarizeByLimit = userMsgCount >= historyLimit

  if ((shouldRetryFailedSummarization || shouldSummarizeByLimit || shouldSummarizeDueToOverflow) && !state.isStopped) {
    let summarizeUpTo = endIndex
    if (shouldSummarizeDueToOverflow && !shouldSummarizeByLimit && !shouldRetryFailedSummarization) {
      summarizeUpTo = endIndex - maxContextMessages
    }

    const chunkToSummarize = state.chatHistory.slice(lastSumIdx, summarizeUpTo)
    // logDebug call handled by caller via their own import
    if (import.meta.env.DEV) console.log(`${logTag} Summarizing ${chunkToSummarize.length} messages (Tumbling Window, overflow: ${shouldSummarizeDueToOverflow})...`)
    const ok = await cbs.summarizeChunk(chunkToSummarize)
    cbs.setRandomLoadingMessage()

    if (ok) {
      const overlapMessages = cbs.getOverlapMessageCount(summarizeUpTo)
      lastSumIdx = summarizeUpTo - overlapMessages
      retryPending = false
      attemptCount = 0
      successCount++
      justCompacted = false
      if (shouldSummarizeDueToOverflow) {
        loadedSession = false
      }
      // Auto-compact summary if enabled and threshold reached
      // NOTE: we read storySummary from state — the value may have been updated by summarizeChunk,
      // but the caller will re-read the ref after applying the result.  The length check here uses
      // the *pre-call* value which is conservative (the summary only grows).
      if (state.autoCompactSummaries && successCount > 0 && successCount % state.autoCompactFrequency === 0 && state.storySummary.length >= state.compactMinLength && !state.isStopped) {
        if (import.meta.env.DEV) console.log(`${logTag} Auto-compacting summary (after ${successCount} summarizations)...`)
        await cbs.performCompaction()
        cbs.setRandomLoadingMessage()
      }
      changed = true
    } else {
      retryPending = true
      attemptCount++
      changed = true
    }
  }

  if (changed) {
    result.lastSummarizedIndex = lastSumIdx
    result.isLoadedSession = loadedSession
    result.summarizationRetryPending = retryPending
    result.summarizationAttemptCount = attemptCount
    result.summarizationSuccessCount = successCount
    result.summaryJustCompacted = justCompacted
  }

  // Append story summary to context if available
  if (state.storySummary) {
    result.contextSuffix = `\n\nPREVIOUS STORY SUMMARY:\n${state.storySummary}`
  }

  // Slice history from the (possibly updated) lastSummarizedIndex
  const effectiveIdx = changed ? lastSumIdx : state.lastSummarizedIndex
  result.historyToSend = state.chatHistory.slice(effectiveIdx)

  return result
}
