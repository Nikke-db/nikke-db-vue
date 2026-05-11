// src/utils/chatUtils.ts
import { type Ref } from 'vue'
import l2d from '@/utils/json/l2d.json'
import prompts from '@/utils/json/prompts.json'
import { parseSelectionValue, type StoryCharacterEntry, type CharacterCatalog } from '@/utils/storyCharacterUtils'
import { getBackgroundPromptScenes, getCurrentBackgroundPromptState } from '@/utils/backgroundUtils'
import { resolveRelevantLocations, getFilteredLocationsForAI } from '@/utils/storyLocationUtils'
import { findCharacterByName, findCharacterIdByName, findCharacterByIdOrName, hasMeaningfulAnimation, NON_DUPLICATED_FIELDS, getHonorific } from '@/utils/characterLookupUtils'

// Re-exports from extracted modules
export { AIError, getAIErrorMessage, logDebug } from '@/utils/errorUtils'
export { findCharacterByName, findCharacterIdByName, findCharacterByIdOrName, hasMeaningfulAnimation, getHonorific, getEffectiveCharacterProfiles } from '@/utils/characterLookupUtils'

type ChatHistoryEntry = {
  role: string
  content: string
}

// Toggle state snapshot used by buildUserReminders
export type ReminderToggleState = {
  invalidJson: boolean
  invalidJsonPersist: boolean
  emptyActionsRetry: boolean
  honorifics: boolean
  narrationAndDialogueNotSplit: boolean
  aiControllingUser: boolean
  wrongSpeechStyles: boolean
  incorrectAnimations: boolean
  incorrectAnimationsPersist: boolean
  incorrectSpeakerLabeling: boolean
  narrationAsDialogue: boolean
  wrongCharacterOnScreen: boolean
  npcUsingCommanderHonorifics: boolean
  commanderPresentButSilent: boolean
}

/**
 * Build the user-toggled reminders string and return which toggles should be cleared.
 * Pure function — no Vue reactivity, so the caller handles clearing.
 */
export const buildUserReminders = (
  toggles: ReminderToggleState,
  mode: string,
  reminders: Record<string, string>,
  opts?: { playerCharacterName?: string; customPlayerCharacterActive?: boolean }
): { text: string; togglesToClear: (keyof ReminderToggleState)[] } => {
  let text = ''
  const togglesToClear: (keyof ReminderToggleState)[] = []

  if (toggles.invalidJson) {
    let jsonReminder: string
    if (toggles.emptyActionsRetry && mode === 'game' && reminders.emptyActionsReminderGame) {
      jsonReminder = reminders.emptyActionsReminderGame
    } else {
      jsonReminder = mode === 'game' ? reminders.invalidJsonReminderGame : reminders.invalidJsonReminder
    }
    text += '\n\n' + jsonReminder
    if (!toggles.invalidJsonPersist) togglesToClear.push('invalidJson')
    if (toggles.emptyActionsRetry) togglesToClear.push('emptyActionsRetry')
  }
  if (toggles.honorifics) {
    text += '\n\n' + reminders.honorificsReminder
    togglesToClear.push('honorifics')
  }
  if (toggles.narrationAndDialogueNotSplit) {
    text += '\n\n' + reminders.narrationAndDialogueNotSplit
    togglesToClear.push('narrationAndDialogueNotSplit')
  }
  if (toggles.aiControllingUser) {
    const reminder = opts?.customPlayerCharacterActive && opts.playerCharacterName && reminders.aiControllingUserReminderCustom
      ? reminders.aiControllingUserReminderCustom.replaceAll('{playerCharacter}', opts.playerCharacterName)
      : reminders.aiControllingUserReminder
    text += '\n\n' + reminder
    togglesToClear.push('aiControllingUser')
  }
  if (toggles.wrongSpeechStyles) {
    text += '\n\n' + reminders.wrongSpeechStylesReminder
    togglesToClear.push('wrongSpeechStyles')
  }
  if (toggles.incorrectAnimations) {
    text += '\n\n' + reminders.incorrectAnimationsReminder
    if (!toggles.incorrectAnimationsPersist) togglesToClear.push('incorrectAnimations')
  }
  if (toggles.incorrectSpeakerLabeling) {
    text += '\n\n' + reminders.incorrectSpeakerLabeling
    togglesToClear.push('incorrectSpeakerLabeling')
  }
  if (toggles.narrationAsDialogue) {
    text += '\n\n' + reminders.narrationAsDialogue
    togglesToClear.push('narrationAsDialogue')
  }
  if (toggles.wrongCharacterOnScreen) {
    text += '\n\n' + reminders.wrongCharacterOnScreen
    togglesToClear.push('wrongCharacterOnScreen')
  }
  if (toggles.npcUsingCommanderHonorifics) {
    const reminder = opts?.customPlayerCharacterActive && opts.playerCharacterName && reminders.npcUsingCommanderHonorificsReminderCustom
      ? reminders.npcUsingCommanderHonorificsReminderCustom.replaceAll('{playerCharacter}', opts.playerCharacterName)
      : reminders.npcUsingCommanderHonorificsReminder
    text += '\n\n' + reminder
    togglesToClear.push('npcUsingCommanderHonorifics')
  }
  if (toggles.commanderPresentButSilent) {
    text += '\n\n' + reminders.commanderPresentButSilentReminder
    togglesToClear.push('commanderPresentButSilent')
  }

  return { text, togglesToClear }
}

// Typewriter controller factory: keeps internal interval state out of component and
// returns `start` and `stop` functions bound to the provided refs.
export const createTypewriterController = (opts: { displayedRef: Ref<string>; currentTextRef: Ref<string>; typingRef: Ref<boolean> }) => {
  let interval: any = null

  const start = (text: string) => {
    if (interval) clearInterval(interval)
    opts.displayedRef.value = ''
    opts.typingRef.value = true
    let index = 0

    interval = setInterval(() => {
      if (index < text.length) {
        opts.displayedRef.value += text[index]
        index++
      } else {
        stop()
      }
    }, 30)
  }

  const stop = () => {
    if (interval) clearInterval(interval)
    opts.displayedRef.value = opts.currentTextRef.value
    opts.typingRef.value = false
  }

  return { start, stop }
}

// Helper to check if a word appears as a whole word in text (case-insensitive)
export const isWholeWordPresent = (text: string, word: string): boolean => {
  if (!text || !word) return false
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return regex.test(text)
}

// Clean up wikitext for the model
export const cleanWikiContent = (wikitext: string): string => {
  let text = wikitext
  text = text.replace(/\{\{[^}]*\}\}/g, '')
  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
  text = text.replace(/\[|\]/g, '')
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  text = text.replace(/^=+\s*(.+?)\s*=+$/gm, '$1:')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/\s+/g, ' ').trim()
  if (text.length > 4000) {
    text = text.substring(0, 4000) + '...'
  }
  return text
}

// Parse AI response string into actions array
export const parseAIResponse = (responseStr: string): any[] => {
  const originalResponse = responseStr
  let jsonStr = responseStr

  const jsonBlockMatch = responseStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim()
  } else {
    jsonStr = responseStr.replace(/```json\n?|\n?```/g, '').trim()
  }

  const firstOpenBrace = jsonStr.indexOf('{')
  const firstOpenBracket = jsonStr.indexOf('[')

  let start = -1
  let end = -1

  if (firstOpenBracket !== -1 && (firstOpenBrace === -1 || firstOpenBracket < firstOpenBrace)) {
    start = firstOpenBracket
    end = jsonStr.lastIndexOf(']')
  } else if (firstOpenBrace !== -1) {
    start = firstOpenBrace
    end = jsonStr.lastIndexOf('}')
  }

  if (start !== -1 && end !== -1) {
    jsonStr = jsonStr.substring(start, end + 1)
  }

  const tryParseJSON = (str: string): any => {
    const trimmed = (str || '').trim()

    if (trimmed.startsWith('[') && trimmed.lastIndexOf(']') === -1) {
      const lastObjEnd = trimmed.lastIndexOf('}')
      if (lastObjEnd !== -1) {
        const candidate = (trimmed.slice(0, lastObjEnd + 1).replace(/,\s*$/, '') + ']').trim()
        try {
          return JSON.parse(candidate)
        } catch {
          // Fall through to normal repair
        }
      }
    }

    try {
      return JSON.parse(trimmed)
    } catch (e) {
      let repaired = trimmed

      const openBraces = (repaired.match(/{/g) || []).length
      const closeBraces = (repaired.match(/}/g) || []).length
      const openBrackets = (repaired.match(/\[/g) || []).length
      const closeBrackets = (repaired.match(/]/g) || []).length

      if (openBraces > closeBraces) {
        repaired += '}'.repeat(openBraces - closeBraces)
      }
      if (openBrackets > closeBrackets) {
        repaired += ']'.repeat(openBrackets - closeBrackets)
      }

      try {
        return JSON.parse(repaired)
      } catch (e2) {
        let cleaned = str.replace(/"memory"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}\s*,?/g, '')
        try {
          return JSON.parse(cleaned)
        } catch (e3) {
          cleaned = cleaned.replace(/"characterProfile"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}\s*,?/g, '').replace(/"characterProfiles"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}\s*,?/g, '')
          try {
            return JSON.parse(cleaned)
          } catch (e4) {
            cleaned = cleaned.replace(/"characterProgression"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}\s*,?/g, '')
            return JSON.parse(cleaned)
          }
        }
      }
    }
  }

  let data: any = null

  const extractChoicesArrayBlock = (raw: string): { beforeText: string; choicesJson: string } | null => {
    if (!raw) return null

    const match = raw.match(/\n\s*\*\*choices\*\*\s*:\s*/i)

    if (!match || typeof match.index !== 'number') return null

    const headerIndex = match.index
    const afterHeader = raw.slice(headerIndex + match[0].length)
    const openIndexRel = afterHeader.indexOf('[')

    if (openIndexRel === -1) return null

    const openIndex = headerIndex + match[0].length + openIndexRel
    let depth = 0
    let inString = false
    let stringQuote: '"' | '\'' | null = null
    let escaped = false
    let closeIndex = -1

    for (let i = openIndex; i < raw.length; i++) {
      const ch = raw[i]

      if (escaped) {
        escaped = false

        continue
      }
      if (ch === '\\') {
        escaped = true

        continue
      }
      if (inString) {
        if (stringQuote && ch === stringQuote) {
          inString = false
          stringQuote = null
        }

        continue
      }
      if (ch === '"' || ch === '\'') {
        inString = true
        stringQuote = ch as any

        continue
      }
      if (ch === '[') depth++
      if (ch === ']') {
        depth--
        if (depth === 0) {
          closeIndex = i

          break
        }
      }
    }

    if (closeIndex === -1) return null

    return {
      beforeText: raw.slice(0, headerIndex).trim(),
      choicesJson: raw.slice(openIndex, closeIndex + 1)
    }
  }

  const extractedChoices = extractChoicesArrayBlock(originalResponse)

  if (extractedChoices) {
    try {
      const parsedChoices = tryParseJSON(extractedChoices.choicesJson)

      if (Array.isArray(parsedChoices) && parsedChoices.length > 0) {
        const actionsFromNarrative = parseFallback(extractedChoices.beforeText)
        const actions = Array.isArray(actionsFromNarrative) && actionsFromNarrative.length > 0 ? actionsFromNarrative : [{ text: extractedChoices.beforeText || '...', character: 'current', animation: 'idle', speaking: false }]

        actions[actions.length - 1].choices = parsedChoices

        return actions
      }
    } catch {
      // Fall through to normal parsing
    }
  }

  try {
    data = tryParseJSON(jsonStr)
  } catch (e) {
    const actionMatches = jsonStr.match(/\{\s*"text"\s*:\s*(?:".*?"|'.*?')\s*,\s*"character"\s*:\s*(?:".*?"|'.*?')\s*(?:,\s*"[^"]+"\s*:\s*(?:".*?"|'.*?'|true|false|\d+|\[.*?\]|\{.*?\}))*\s*\}/gs)

    if (actionMatches && actionMatches.length > 0) {
      const salvagedActions = []
      for (const match of actionMatches) {
        try {
          const action = JSON.parse(match)

          if (action.text && action.character) {
            salvagedActions.push(action)
          }
        } catch (err) {
          // Ignore malformed individual actions
        }
      }

      if (salvagedActions.length > 0) {
        data = salvagedActions
      }
    }
  }

  if (!data) {
    try {
      data = JSON.parse(jsonStr)
    } catch (e) {
      // Ignore parse error
    }
  }

  const potentialObject = data as any

  if (!Array.isArray(data) && typeof potentialObject === 'object' && potentialObject !== null && potentialObject.text && typeof potentialObject.text === 'string') {
    const textContent = potentialObject.text.trim()
    if (textContent.startsWith('[') || textContent.startsWith('{')) {
      try {
        const nestedData = tryParseJSON(textContent)
        if (nestedData) {
          data = nestedData
        }
      } catch (e) {
        // Failed to parse nested JSON
      }
    }
  }

  if (!Array.isArray(data) && data && typeof data === 'object' && Array.isArray(data.actions)) {
    const topLevelChoices = data.choices
    data = data.actions

    if (Array.isArray(topLevelChoices) && topLevelChoices.length > 0 && data.length > 0) {
      const lastAction = data[data.length - 1]

      if (lastAction && typeof lastAction === 'object' && !lastAction.choices) {
        lastAction.choices = topLevelChoices
      }
    }
  }

  if (!Array.isArray(data)) {
    if (data) {
      data = [data]
    } else {
      throw new Error('Failed to parse JSON')
    }
  }

  const looksLikeChoicesOnly = (arr: any[]): boolean => {
    if (!Array.isArray(arr) || arr.length === 0) return false

    return arr.every((x) => x && typeof x === 'object' && typeof x.text === 'string' && (x.type === 'dialogue' || x.type === 'action') && !('character' in x) && !('speaking' in x) && !('animation' in x))
  }

  if (looksLikeChoicesOnly(data)) {
    const actionsFromNarrative = parseFallback(originalResponse.replace(/\n\s*\*\*choices\*\*\s*:\s*[\s\S]*$/i, '').trim())
    const actions = Array.isArray(actionsFromNarrative) && actionsFromNarrative.length > 0 ? actionsFromNarrative : [{ text: '...', character: 'current', animation: 'idle', speaking: false }]
    actions[actions.length - 1].choices = data

    return actions
  }

  return data
}

// Sanitize actions to ensure narration/dialogue separation
export const sanitizeActions = (actions: any[]): any[] => {
  const newActions: any[] = []

  const looksLikeNarrationWithoutQuotes = (rawText: string): boolean => {
    const t = (rawText || '').trim()

    if (!t) return false

    const lower = t.toLowerCase()

    for (const char of l2d) {
      const name = (char as any).name as string
      if (!name) continue

      const nameLower = name.toLowerCase()
      if (!lower.startsWith(nameLower)) continue

      const after = t.slice(name.length)
      const nextChar = after.charAt(0)

      if (nextChar === ':') return false

      if (nextChar === ',') return false

      if (nextChar === '\'' || nextChar === '\u2019') {
        const poss = after.slice(0, 2)

        if (poss === '\'s' || poss === '\u2019s') return true
      }

      if (nextChar && /\s/.test(nextChar)) {
        const rest = after.trimStart().slice(0, 80).toLowerCase()
        if (rest.includes(', her ') || rest.includes(', his ')) {
          return true
        }
      }

      return false
    }

    return false
  }

  const resolveCharacterIdFromLeadingName = (rawText: string): string | undefined => {
    const t = (rawText || '').replace(/\u00A0/g, ' ').trimStart()
    if (!t) return undefined

    if (t.toLowerCase().startsWith('commander')) {
      const after = t.slice('commander'.length)
      const next = after.charAt(0)
      if (!next || /[\s,.:;!?\-—–'']/.test(next)) return 'commander'
    }

    for (const char of l2d as any[]) {
      const name = typeof char?.name === 'string' ? (char.name as string) : ''
      const id = typeof char?.id === 'string' ? (char.id as string) : ''
      if (!name || !id) continue

      const nameLower = name.toLowerCase()
      if (!t.toLowerCase().startsWith(nameLower)) continue

      const after = t.slice(name.length)
      const next = after.charAt(0)
      if (!next || /[\s,.:;!?\-—–'']/.test(next)) return id
    }

    return undefined
  }

  const splitActionOnDoubleNewlines = (action: any): any[] => {
    if (!action || typeof action.text !== 'string') return [action]

    const rawText = action.text
    if (!/\n\n+/.test(rawText)) return [action]

    const parts = rawText
      .split(/\n\n+/)
      .map((part: string) => part.trim())
      .filter((part: string) => part.length > 0)

    if (parts.length <= 1) return [action]

    const dialogueQuotePattern = /("[\s\S]*?"|"\s*[\s\S]*?\s*")/
    const originalHadQuotes = action.speaking === true && dialogueQuotePattern.test(rawText)

    const out: any[] = []

    for (let i = 0; i < parts.length; i++) {
      const partAction: any = { ...action, text: parts[i] }

      if (originalHadQuotes && !dialogueQuotePattern.test(parts[i])) {
        partAction.speaking = false
      }

      if (i > 0) {
        for (const key of Object.keys(partAction)) {
          if (NON_DUPLICATED_FIELDS.has(key)) {
            if (key === 'needs_search') partAction[key] = []
            else delete partAction[key]
          }
        }
      }

      if (action.choices) {
        if (i === parts.length - 1) partAction.choices = action.choices
        else delete partAction.choices
      }

      out.push(partAction)
    }

    return out
  }

  const isSpeakerLabel = (s: string): boolean => {
    const normalized = (s || '').replace(/\u00A0/g, ' ').trim()
    return /^\s*(?:\*\*)?\s*[^*:\n]+?\s*:\s*(?:\*\*)?\s*$/.test(normalized)
  }

  const resolveCharacterIdFromSpeakerLabel = (labelText: string): string | undefined => {
    const cleaned = (labelText || '').replace(/\*\*/g, '').trim()
    if (!cleaned) return undefined
    const name = cleaned.endsWith(':') ? cleaned.slice(0, -1).trim() : cleaned
    return findCharacterIdByName(name)
  }

  for (const rawAction of actions) {
    const actionParts = splitActionOnDoubleNewlines(rawAction)

    for (const action of actionParts) {
      if (!action.text || typeof action.text !== 'string') {
        newActions.push(action)

        continue
      }

      const splitOnSpeakerLabels = (raw: string): { text: string; speaking: boolean; character?: string }[] | null => {
        const input = (raw || '').trim()
        if (!input) return null

        const labelRegex = /(^|[\s\n.!?]|[-—–])(?:\*\*)?([A-Za-z0-9\s\-()]{1,40})(?:\*\*)?\s*:\s*/g
        const matches: Array<{ start: number; end: number; name: string }> = []

        let m: RegExpExecArray | null
        while ((m = labelRegex.exec(raw)) !== null) {
          const boundary = m[1] || ''
          const name = (m[2] || '').trim().replace(/\s+/g, ' ')

          if (!name) continue

          const resolved = findCharacterByName(name)
          if (!resolved) continue

          const start = m.index + boundary.length
          const end = labelRegex.lastIndex
          matches.push({ start, end, name })
        }

        if (matches.length === 0) return null

        const out: { text: string; speaking: boolean; character?: string }[] = []
        let cursor = 0

        for (let i = 0; i < matches.length; i++) {
          const curr = matches[i]
          const next = matches[i + 1]

          const narrationBefore = raw.slice(cursor, curr.start).trim()

          if (narrationBefore) {
            out.push({ text: narrationBefore, speaking: false })
          }

          const dialogueText = raw.slice(curr.end, next ? next.start : raw.length).trim()

          if (dialogueText) {
            out.push({ text: dialogueText, speaking: true, character: findCharacterIdByName(curr.name) })
          }

          cursor = next ? next.start : raw.length
        }

        return out.length > 0 ? out : null
      }

      const text = action.text
      const dialogueRegex = /("[\s\S]*?"|“[\s\S]*?”)/g

      if (!dialogueRegex.test(text)) {
        const speakerSplit = splitOnSpeakerLabels(text)

        if (speakerSplit) {
          for (let i = 0; i < speakerSplit.length; i++) {
            const part = speakerSplit[i]

            if (!part.text.trim()) continue

            const base: any = { ...action }

            if (i > 0) {
              for (const key of Object.keys(base)) {
                if (NON_DUPLICATED_FIELDS.has(key)) {
                  if (key === 'needs_search') base[key] = []
                  else delete base[key]
                }
              }
            }

            if (action.choices) {
              if (i === speakerSplit.length - 1) base.choices = action.choices
              else delete base.choices
            }

            newActions.push({
              ...base,
              text: part.text.trim(),
              speaking: part.speaking,
              character: part.character || base.character
            })
          }

          continue
        }

        if (action.speaking === true) {
          const charId = action.character
          let charName = ''

          if (charId === 'commander') {
            charName = 'Commander'
          } else if (charId && charId !== 'none' && charId !== 'current') {
            const c = findCharacterByIdOrName(charId)
            if (c) charName = c.name
          }

          if (charName) {
            const fusedRegex = new RegExp(`([.!?])\\s+(${charName}\\b)`, 'i')
            const splitMatch = text.match(fusedRegex)

            if (splitMatch && splitMatch.index !== undefined) {
              const splitIndex = splitMatch.index + 1
              const dialoguePart = text.slice(0, splitIndex).trim()
              const narrationPart = text.slice(splitIndex).trim()

              newActions.push({
                ...action,
                text: dialoguePart,
                speaking: true
              })

              const narrationAction: any = { ...action, text: narrationPart, speaking: false }

              if (action.choices) {
                delete newActions[newActions.length - 1].choices
                narrationAction.choices = action.choices
              }

              for (const key of Object.keys(narrationAction)) {
                if (NON_DUPLICATED_FIELDS.has(key) && key !== 'choices') {
                  if (key === 'needs_search') narrationAction[key] = []
                  else delete narrationAction[key]
                }
              }

              newActions.push(narrationAction)
              continue
            }
          }
        }

        if (action.speaking === true && looksLikeNarrationWithoutQuotes(text)) {
          newActions.push({ ...action, speaking: false })
        } else {
          newActions.push(action)
        }

        continue
      }

      const parts: { text: string; isDialogue: boolean; character?: string }[] = []
      let lastIndex = 0

      dialogueRegex.lastIndex = 0
      let match

      while ((match = dialogueRegex.exec(text)) !== null) {
        const narrationBefore = text.substring(lastIndex, match.index).trim()
        const isLabelOnly = !!narrationBefore && isSpeakerLabel(narrationBefore)

        if (narrationBefore && !isLabelOnly) {
          parts.push({ text: narrationBefore, isDialogue: false })
        }

        const dialogue = match[0]
        const speakerId = isLabelOnly ? resolveCharacterIdFromSpeakerLabel(narrationBefore) : undefined
        parts.push({ text: dialogue, isDialogue: true, character: speakerId })

        lastIndex = match.index + match[0].length
      }

      const remaining = text.substring(lastIndex).trim()
      if (remaining) {
        parts.push({ text: remaining, isDialogue: false })
      }

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part.text.trim()) continue

        const base: any = { ...action }
        if (i > 0) {
          for (const key of Object.keys(base)) {
            if (NON_DUPLICATED_FIELDS.has(key)) {
              if (key === 'needs_search') base[key] = []
              else delete base[key]
            }
          }
        }

        if (action.choices) {
          if (i === parts.length - 1) {
            base.choices = action.choices
          } else {
            delete base.choices
          }
        }

        if (part.isDialogue) {
          newActions.push({
            ...base,
            text: part.text.trim(),
            speaking: true,
            character: part.character || base.character
          })
        } else {
          newActions.push({
            ...base,
            text: part.text.trim(),
            speaking: false
          })
        }
      }
    }
  }

  for (const action of newActions) {
    if (action?.speaking !== false) continue
    if (typeof action.text !== 'string') continue

    const inferred = resolveCharacterIdFromLeadingName(action.text)
    if (inferred) {
      action.character = inferred
    }
  }

  for (let i = 1; i < newActions.length; i++) {
    const prev = newActions[i - 1]
    const curr = newActions[i]

    if (prev.speaking === false && curr.speaking === true && prev.animation && prev.animation !== 'idle' && prev.character && curr.character && prev.character === curr.character && (!curr.animation || curr.animation === 'idle')) {
      curr.animation = prev.animation
    }

    if (prev.character && curr.character && prev.character === curr.character) {
      if (prev.speaking === false && curr.speaking === true && hasMeaningfulAnimation(curr.animation) && !hasMeaningfulAnimation(prev.animation)) {
        prev.animation = curr.animation
      }

      if (prev.speaking === true && curr.speaking === false && hasMeaningfulAnimation(prev.animation) && !hasMeaningfulAnimation(curr.animation)) {
        curr.animation = prev.animation
      }

      if (prev.speaking === false && curr.speaking === true && hasMeaningfulAnimation(prev.animation) && !hasMeaningfulAnimation(curr.animation)) {
        curr.animation = prev.animation
      }
    }
  }

  return newActions
}

export type GameModeChoice = {
  text: string
  type?: 'dialogue' | 'action'
  label?: string
}

export const getChoiceText = (choice: any): string => {
  return String(choice?.text ?? choice?.label ?? '').trim()
}

export const inferEffectiveChoiceType = (choiceText: string, declaredType?: unknown): 'dialogue' | 'action' | null => {
  const normalizedType: 'dialogue' | 'action' | null = declaredType === 'dialogue' || declaredType === 'action' ? (declaredType as any) : null

  return normalizedType
}

export const formatChoiceAsUserTurn = (choice: any): string => {
  const text = getChoiceText(choice)
  const effectiveType = inferEffectiveChoiceType(text, choice?.type)

  if (effectiveType === 'dialogue') return text
  if (effectiveType === 'action') {
    const first = text.charAt(0)
    const last = text.charAt(text.length - 1)

    if (first === '[' && last === ']') return text

    return `[${text}]`
  }

  return text
}

export const stripChoicesWhenNotGameMode = (actions: any[], isGameMode: boolean): any[] => {
  if (isGameMode) return actions
  for (const action of actions) {
    if (action && typeof action === 'object' && 'choices' in action) {
      delete action.choices
    }
  }

  return actions
}

export const ensureGameModeChoicesFallback = (actions: any[], isGameMode: boolean): any[] => {
  if (!isGameMode || !Array.isArray(actions) || actions.length === 0) return actions
  const hasChoices = actions.some((a: any) => a?.choices && Array.isArray(a.choices) && a.choices.length > 0)
  if (!hasChoices) {
    actions[actions.length - 1].choices = [{ text: 'Continue', type: 'action' }]
  }

  return actions
}

export const filterEchoedUserChoiceDialogueInGameMode = (actions: any[], lastUserTurn: string, isGameMode: boolean): any[] => {
  if (!isGameMode) return actions
  if (!lastUserTurn) return actions

  const normalizeUserTurn = (s: string): string => {
    let out = (s || '').trim()

    if (out.startsWith('[') && out.endsWith(']')) out = out.slice(1, -1)

    out = out.replace(/^["']|["']$/g, '').trim()

    return out
  }

  const normalizeModelLine = (s: string): string => {
    let out = (s || '').trim()
    out = out.replace(/^["']|["']$/g, '').trim()
    out = out.replace(/^\*\*[^*]+\*\*:\s*/g, '')
    out = out.replace(/^[^:]{1,30}:\s*/g, '')

    return out.trim()
  }

  const userLine = normalizeUserTurn(lastUserTurn)
  if (!userLine) return actions

  return actions.filter((a: any) => {
    if (!a || typeof a !== 'object') return true
    if (!a.speaking) return true
    if (typeof a.text !== 'string') return true

    const modelLine = normalizeModelLine(a.text)

    if (!modelLine) return true
    if (modelLine.toLowerCase() === userLine.toLowerCase()) return false
    if (modelLine.toLowerCase().includes(userLine.toLowerCase()) && Math.abs(modelLine.length - userLine.length) < 12) {
      return false
    }

    return true
  })
}

/**
 * Extract a trailing speaker label from text (e.g., "Some narration.\n\nGuard:" -> { text: "Some narration.", speaker: "guard_id" })
 */
const extractTrailingSpeakerLabel = (text: string): { text: string; speakerId: string | null } => {
  if (!text) return { text, speakerId: null }

  const match = text.match(/(?:\n+|\s+)?([A-Za-z0-9][A-Za-z0-9\s\-()]{0,39}):\s*$/)

  if (!match) return { text, speakerId: null }

  const name = match[1].trim()

  if (!name) return { text, speakerId: null }

  const isCommander = name.toLowerCase() === 'commander'

  if (isCommander) {
    return {
      text: text.slice(0, match.index).trim(),
      speakerId: 'commander'
    }
  }

  const charObj = findCharacterByName(name)

  if (charObj) {
    return {
      text: text.slice(0, match.index).trim(),
      speakerId: charObj.id
    }
  }

  return { text, speakerId: null }
}

// Split narration into actions
export const splitNarration = (text: string): any[] => {
  const actions: any[] = []
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim())

  for (const paragraph of paragraphs) {
    const sentences = paragraph.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g)

    if (!sentences) {
      const trimmed = paragraph.trim()

      if (!trimmed) continue

      let foundCharId = null
      for (const char of l2d) {
        const name = char.name

        if (trimmed.toLowerCase().startsWith(name.toLowerCase())) {
          const nextChar = trimmed.charAt(name.length)

          if (!nextChar || /[\s'’.,!?]/.test(nextChar)) {
            foundCharId = char.id

            break
          }
        }
      }
      if (foundCharId) {
        actions.push({
          text: trimmed,
          character: foundCharId,
          animation: 'idle',
          speaking: false
        })
      } else {
        actions.push({
          text: trimmed,
          character: 'none',
          animation: 'idle',
          speaking: false
        })
      }
      continue
    }

    let currentAction: any = null

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim()

      if (!sentence) continue

      let foundCharId = null

      for (const char of l2d) {
        const name = char.name
        if (sentence.toLowerCase().startsWith(name.toLowerCase())) {
          const nextChar = sentence.charAt(name.length)

          if (!nextChar || /[\s'’.,!?]/.test(nextChar)) {
            foundCharId = char.id

            break
          }
        }
      }

      if (foundCharId) {
        if (currentAction) {
          actions.push(currentAction)
        }
        currentAction = {
          text: sentence,
          character: foundCharId,
          animation: 'idle',
          speaking: false
        }
      } else {
        if (currentAction) {
          currentAction.text += ' ' + sentence
        } else {
          currentAction = {
            text: sentence,
            character: 'none',
            animation: 'idle',
            speaking: false
          }
        }
      }
    }

    if (currentAction) {
      actions.push(currentAction)
    }
  }

  return actions
}

// Fallback parsing for AI response
export const parseFallback = (text: string): any[] => {
  const actions: any[] = []
  const cleanText = text.replace(/\*\*/g, '').trim()

  if (cleanText.startsWith('[') || cleanText.startsWith('{')) {
    const objectRegex = /\{\s*"text"\s*:\s*"([^"]+)"\s*,\s*"character"\s*:\s*"([^"]+)"/g
    let match
    let found = false

    while ((match = objectRegex.exec(cleanText)) !== null) {
      found = true
      actions.push({
        text: match[1],
        character: match[2],
        animation: 'idle',
        speaking: true
      })
    }

    if (found) return actions

    return []
  }

  const regex = /(^|[\s\n.!?]|[-—–]|["“”])([A-Za-z0-9\s\-()]{1,40})\s*:\s*/g

  let lastIndex = 0
  let match

  const labels: Array<{ index: number; end: number; name: string; charId: string }> = []
  while ((match = regex.exec(cleanText)) !== null) {
    const boundary = match[1] || ''
    const name = (match[2] || '').trim().replace(/\s+/g, ' ')
    if (!name) continue

    const charId = findCharacterIdByName(name)
    if (!charId) continue

    labels.push({
      index: match.index + boundary.length,
      end: regex.lastIndex,
      name,
      charId
    })
  }

  if (labels.length === 0) {
    const trailing = cleanText.trim()
    if (trailing) actions.push(...splitNarration(trailing))
    return actions
  }

  lastIndex = 0

  for (let i = 0; i < labels.length; i++) {
    const curr = labels[i]
    const next = labels[i + 1]

    const index = curr.index
    const charId = curr.charId || 'current'

    const narration = cleanText.substring(lastIndex, index).trim()

    if (narration) {
      const narrationActions = splitNarration(narration)

      if (narrationActions.length > 0) {
        const lastAction = narrationActions[narrationActions.length - 1]

        if (lastAction.character === 'none') {
          lastAction.character = charId
        }

        if (lastAction.text) {
          const { text: cleanedText, speakerId: trailingSpeaker } = extractTrailingSpeakerLabel(lastAction.text)

          if (trailingSpeaker && cleanedText !== lastAction.text) {
            lastAction.text = cleanedText

            if (!cleanedText.trim()) {
              narrationActions.pop()
            }

            narrationActions.push({
              _pendingSpeaker: trailingSpeaker,
              _isPendingMarker: true
            })
          }
        }
      }

      actions.push(...narrationActions)
    }

    const dialogue = cleanText.substring(curr.end, next ? next.index : cleanText.length).trim()

    const splitQuotedSegments = (input: string): { text: string; isDialogue: boolean }[] | null => {
      if (!input) return null

      const quoteRegex = /("[\s\S]*?"|“[\s\S]*?”)/g
      if (!quoteRegex.test(input)) return null

      quoteRegex.lastIndex = 0
      const parts: { text: string; isDialogue: boolean }[] = []
      let cursor = 0
      let quoteMatch

      while ((quoteMatch = quoteRegex.exec(input)) !== null) {
        const narrationBefore = input.substring(cursor, quoteMatch.index).trim()
        if (narrationBefore) {
          parts.push({ text: narrationBefore, isDialogue: false })
        }

        parts.push({ text: quoteMatch[0], isDialogue: true })
        cursor = quoteMatch.index + quoteMatch[0].length
      }

      const remaining = input.substring(cursor).trim()
      if (remaining) {
        parts.push({ text: remaining, isDialogue: false })
      }

      return parts.length > 0 ? parts : null
    }

    if (dialogue) {
      const dialogueSegments = dialogue
        .replace(/([.!?]+)(?=[^\s.!?"”])/g, '$1__DIALOGUE_SPLIT__')
        .split('__DIALOGUE_SPLIT__')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)

      for (const segment of dialogueSegments) {
        const paragraphs = segment.split(/\n\n+/).filter((p) => p.trim())

        if (paragraphs.length <= 1) {
          const { text: cleanedDialogue, speakerId: trailingSpeaker } = extractTrailingSpeakerLabel(segment)

          if (cleanedDialogue) {
            const quotedParts = splitQuotedSegments(cleanedDialogue)

            if (quotedParts) {
              for (const part of quotedParts) {
                actions.push({
                  text: part.text,
                  character: charId,
                  animation: 'idle',
                  speaking: part.isDialogue
                })
              }
            } else {
              actions.push({
                text: cleanedDialogue,
                character: charId,
                animation: 'idle',
                speaking: true
              })
            }
          }

          if (trailingSpeaker) {
            actions.push({
              _pendingSpeaker: trailingSpeaker,
              _isPendingMarker: true
            })
          }
        } else {
          for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
            const para = paragraphs[pIdx].trim()

            if (!para) continue

            const { text: cleanedPara, speakerId: trailingSpeaker } = extractTrailingSpeakerLabel(para)

            if (cleanedPara) {
              const quotedParts = splitQuotedSegments(cleanedPara)

              if (quotedParts) {
                for (const part of quotedParts) {
                  actions.push({
                    text: part.text,
                    character: charId,
                    animation: 'idle',
                    speaking: part.isDialogue
                  })
                }
              } else {
                const isSpeaking = pIdx === 0

                actions.push({
                  text: cleanedPara,
                  character: charId,
                  animation: 'idle',
                  speaking: isSpeaking
                })
              }
            }

            if (trailingSpeaker) {
              actions.push({
                _pendingSpeaker: trailingSpeaker,
                _isPendingMarker: true
              })
            }
          }
        }
      }
    }

    lastIndex = next ? next.index : cleanText.length
  }

  const trailing = cleanText.substring(lastIndex).trim()

  if (trailing) {
    const trailingActions = splitNarration(trailing)

    if (trailingActions.length > 0) {
      const lastTrailing = trailingActions[trailingActions.length - 1]

      if (lastTrailing.text) {
        const { text: cleanedText, speakerId: trailingSpeaker } = extractTrailingSpeakerLabel(lastTrailing.text)

        if (trailingSpeaker && cleanedText !== lastTrailing.text) {
          lastTrailing.text = cleanedText

          trailingActions.push({
            _pendingSpeaker: trailingSpeaker,
            _isPendingMarker: true
          })
        }
      }
    }

    actions.push(...trailingActions)
  }

  const finalActions: any[] = []
  let pendingSpeaker: string | null = null

  for (const action of actions) {
    if (action._isPendingMarker) {
      pendingSpeaker = action._pendingSpeaker
      continue
    }

    if (pendingSpeaker && action.speaking === true) {
      action.character = pendingSpeaker
      pendingSpeaker = null
    } else if (pendingSpeaker && action.speaking === false && action.character === 'none') {
      action.character = pendingSpeaker
      pendingSpeaker = null
    }

    finalActions.push(action)
  }

  return finalActions
}

export const calculateYapDuration = (text: string): number => {
  if (!text) return 3000
  return Math.max(1000, text.length * 60 + 300)
}

export interface ReplayContext {
  enableAnimationReplay: boolean
  selectedMessageIndex: Ref<number | null>
  chatMode: string
  nikkeOverlayVisible: Ref<boolean>
  market: any
  ttsEnabled: boolean
  isTyping: Ref<boolean>
  nikkeCurrentText: Ref<string>
  nikkeCurrentSpeaker: Ref<string>
  nikkeSpeakerColor: Ref<string>
  effectiveCharacterProfiles: Record<string, any>
  getCharacterName: (id: string) => string | null
  startTypewriter: (text: string) => void
  stopTypewriter: () => void
  manageYap: (duration: number) => void
}

export const replayMessage = async (msg: any, index: number, ctx: ReplayContext) => {
  if (!ctx.enableAnimationReplay) return
  if (!msg.animation && !msg.character) return

  if (ctx.selectedMessageIndex.value === index) {
    if (ctx.chatMode === 'nikke' && ctx.isTyping.value) {
      ctx.stopTypewriter()
      return
    }
    ctx.selectedMessageIndex.value = null
    if (ctx.chatMode === 'nikke') {
      ctx.nikkeOverlayVisible.value = false
    }
    return
  }

  ctx.selectedMessageIndex.value = index

  if (msg.animation) {
    ctx.market.live2d.current_animation = msg.animation
  }

  if (msg.character && msg.character !== 'none' && msg.character !== ctx.market.live2d.current_id) {
    const charObj = findCharacterByIdOrName(msg.character)
    if (charObj) {
      ctx.market.live2d.change_current_spine(charObj)
    }
  }

  if (msg.speaking && !ctx.ttsEnabled) {
    const text = msg.text || msg.content || ''
    const yapDuration = calculateYapDuration(text)
    ctx.manageYap(yapDuration)
  }

  if (ctx.chatMode === 'nikke') {
    ctx.nikkeOverlayVisible.value = true

    let textToDisplay = msg.text || msg.content
    if (!msg.text && msg.content) {
      textToDisplay = textToDisplay.replace(/^\*\*\s*[^*]+\s*\*\*:\s*/, '')
    }

    ctx.nikkeCurrentText.value = textToDisplay

    let speakerName = ''
    if (msg.character && msg.character !== 'none') {
      speakerName = ctx.getCharacterName(msg.character) || ''
    }
    ctx.nikkeCurrentSpeaker.value = speakerName

    const profile = ctx.effectiveCharacterProfiles[speakerName]
    ctx.nikkeSpeakerColor.value = profile?.color || '#ffffff'

    ctx.startTypewriter(textToDisplay)
  }
}

// ── System prompt generation ──────────────────────────────────────────

export type SystemPromptParams = {
  enableWebSearch: boolean
  effectiveCharacterProfiles: Record<string, any>
  rosterRows: StoryCharacterEntry[]
  currentLive2dId: string
  mode: string
  godModeEnabled: boolean
  realisticModeEnabled: boolean
  lowContextMode: boolean
  characterCatalog: CharacterCatalog
  currentUserPrompt?: string
  chatHistory?: ChatHistoryEntry[]
  playerCharacterName?: string
  customPlayerCharacterActive?: boolean
  backgroundImagesEnabled?: boolean
  backgroundImageMap?: Map<string, File>
  currentBackgroundFilename?: string
}

/**
 * Build the full system prompt string.
 * Pure function — no Vue reactivity, no side effects.
 */
export const generateSystemPrompt = (params: SystemPromptParams): string => {
  const { enableWebSearch, effectiveCharacterProfiles: originalProfiles, rosterRows, currentLive2dId, mode, godModeEnabled, realisticModeEnabled, lowContextMode, characterCatalog, currentUserPrompt, chatHistory, playerCharacterName = 'Commander', customPlayerCharacterActive = false } = params

  let profiles = originalProfiles
  if (!customPlayerCharacterActive && mode !== 'story') {
    profiles = {}
    for (const [name, profile] of Object.entries(originalProfiles)) {
      const normalized = name.trim().toLowerCase()
      if (normalized === 'commander' || normalized.startsWith('commander (')) {
        continue
      }
      profiles[name] = profile
    }
  }

  const knownCharacterNames = Object.keys(profiles)
  const relevantLocations = lowContextMode ? [] : resolveRelevantLocations({ profiles, currentUserPrompt, chatHistory, isWholeWordPresent })

  const getFilteredProfilesForAI = (): Record<string, any> => {
    const filtered: Record<string, any> = {}

    for (const [name, profile] of Object.entries(profiles)) {
      const rosterEntry = rosterRows.find((entry) => {
        const parsed = parseSelectionValue(entry.selection)
        return parsed?.type === 'base' && parsed.baseName === name
      })

      const filteredProfile: Record<string, any> = { ...(profile as any) }

      if (rosterEntry?.skinId && profile.id && rosterEntry.skinId !== profile.id) {
        delete filteredProfile.defaultSkin
      }

      if (lowContextMode) {
        delete filteredProfile.backstory
      }

      filtered[name] = filteredProfile
    }

    // Merge base character context into variant profiles and remove standalone base entries.
    // This gives the AI the base character's backstory/personality/relationships as labeled
    // reference fields nested inside the variant profile, without confusing the AI into
    // thinking two separate characters are present.
    for (const [name] of Object.entries(filtered)) {
      if (!name.includes(':')) continue

      const baseName = name.split(':')[0].trim()
      const baseProfile = filtered[baseName]
      if (!baseProfile || !baseProfile.backstory) continue

      const variant = filtered[name]

      variant.base_character = baseName
      variant.base_backstory = baseProfile.backstory
      if (baseProfile.personality) variant.base_personality = baseProfile.personality
      if (baseProfile.speech_style) variant.base_speech_style = baseProfile.speech_style
      if (baseProfile.relationships) variant.base_relationships = baseProfile.relationships

      // Remove the standalone base entry — it's now nested inside the variant
      delete filtered[baseName]
    }

    return filtered
  }

  const relevantCharacterIds: string[] = []
  const relevantCharacterNames: string[] = []

  if (currentLive2dId) {
    const currentChar = (l2d as any[]).find((c) => c.id === currentLive2dId)
    if (currentChar) {
      relevantCharacterIds.push(`${currentChar.name} = ${currentChar.id}`)
      relevantCharacterNames.push(currentChar.name)
    }
  }

  for (const name of knownCharacterNames) {
    // Skip base character profiles that are loaded purely for context
    // (because a variant is the active character).  Prevents the AI
    // from thinking two separate characters are present.
    if (!name.includes(':')) {
      const hasVariantInRoster = rosterRows.some((entry) => {
        const sel = parseSelectionValue(entry.selection)
        if (sel?.type !== 'variant') return false
        const variantName = characterCatalog.idToName[sel.variantId]
        return variantName && variantName.split(':')[0].trim().toLowerCase() === name.toLowerCase()
      })
      if (hasVariantInRoster) continue
    }

    if (name.toLowerCase() === 'commander') {
      if (!relevantCharacterIds.some((r) => r.includes('= commander'))) {
        relevantCharacterIds.push('Commander = commander')
        relevantCharacterNames.push('Commander')
      }
      continue
    }

    const matchingChars = (l2d as any[]).filter((c) => c.name.toLowerCase() === name.toLowerCase())
    if (matchingChars.length === 0) continue

    const char = matchingChars.sort((a, b) => a.id.localeCompare(b.id))[0]
    if (char && !relevantCharacterIds.some((r) => r.includes(char.id))) {
      relevantCharacterIds.push(`${char.name} = ${char.id}`)
      relevantCharacterNames.push(char.name)
    }
  }

  for (const entry of rosterRows) {
    const selection = parseSelectionValue(entry.selection)
    if (!selection) continue

    if (selection.type === 'base') {
      const baseEntry = characterCatalog.baseMap[selection.baseName]
      if (baseEntry && !relevantCharacterIds.some((r) => r.includes(baseEntry.baseId))) {
        relevantCharacterIds.push(`${selection.baseName} = ${baseEntry.baseId}`)
        relevantCharacterNames.push(selection.baseName)
      }
    } else if (selection.type === 'variant') {
      const variantName = characterCatalog.idToName[selection.variantId]
      if (variantName && variantName.includes(':')) {
        if (!relevantCharacterIds.some((r) => r.includes(selection.variantId))) {
          relevantCharacterIds.push(`${variantName} = ${selection.variantId}`)
          relevantCharacterNames.push(variantName)
        }
      }
    }
  }

  const relevantHonorifics: Record<string, string> = {}
  for (const name of relevantCharacterNames) {
    relevantHonorifics[name] = getHonorific(name)
  }

  const replacePlayerCharacterToken = (value: string) => value.replaceAll('{playerCharacter}', playerCharacterName)

  let modeInstructions = ''
  if (mode === 'game') {
    modeInstructions = customPlayerCharacterActive
      ? replacePlayerCharacterToken((prompts.systemPrompt.instructions as any).gameCustom)
      : prompts.systemPrompt.instructions.game
  } else if (mode === 'story') {
    modeInstructions = prompts.systemPrompt.instructions.story
  } else {
    modeInstructions = customPlayerCharacterActive
      ? replacePlayerCharacterToken((prompts.systemPrompt.instructions as any).roleplayCustom)
      : prompts.systemPrompt.instructions.roleplay
  }

  const modePrompt = mode === 'story'
    ? prompts.systemPrompt.modes.story
    : mode === 'game'
      ? customPlayerCharacterActive
        ? replacePlayerCharacterToken((prompts.systemPrompt.modes as any).gameCustom)
        : prompts.systemPrompt.modes.game
      : customPlayerCharacterActive
        ? replacePlayerCharacterToken((prompts.systemPrompt.modes as any).roleplayCustom)
        : prompts.systemPrompt.modes.roleplay

  const criticalErrors = customPlayerCharacterActive
    ? replacePlayerCharacterToken((prompts.systemPrompt as any).criticalErrorsCustom)
    : prompts.systemPrompt.criticalErrors

  const honorificRules = customPlayerCharacterActive
    ? replacePlayerCharacterToken((prompts.systemPrompt.honorifics as any).rulesCustom)
    : prompts.systemPrompt.honorifics.rules

  const playerCharacterContext = customPlayerCharacterActive
    ? `

  ${replacePlayerCharacterToken((prompts.systemPrompt as any).playerCharacterContext)}`
    : ''

  const godModeText = !godModeEnabled
    ? ''
    : realisticModeEnabled && mode !== 'story'
      ? customPlayerCharacterActive
        ? replacePlayerCharacterToken((prompts.systemPrompt as any).godModeRealisticCustom)
        : (prompts.systemPrompt as any).godModeRealistic
      : customPlayerCharacterActive
        ? replacePlayerCharacterToken((prompts.systemPrompt as any).godModeCustom)
        : prompts.systemPrompt.godMode

  const realisticModeText = realisticModeEnabled && mode !== 'story'
    ? customPlayerCharacterActive
      ? replacePlayerCharacterToken((prompts.systemPrompt as any).realisticModeCustom)
      : (prompts.systemPrompt as any).realisticMode
    : ''

  const isBackgroundEnabled = params.backgroundImagesEnabled
    && params.backgroundImageMap
    && params.backgroundImageMap.size > 0

  let backgroundSection = ''
  if (isBackgroundEnabled) {
    const availableFilenames = [...params.backgroundImageMap!.keys()].sort()
    const relevantLocationNames = relevantLocations.map((location) => location.name)
    const availableScenes = getBackgroundPromptScenes({
      availableFilenames,
      relevantLocations: relevantLocationNames,
      currentBackgroundFilename: params.currentBackgroundFilename
    })
    const currentBackground = getCurrentBackgroundPromptState({
      currentBackgroundFilename: params.currentBackgroundFilename,
      availableFilenames
    })

    backgroundSection = `

${(prompts.systemPrompt as any).backgroundImages.header}

Available Background Scene Keys:
${JSON.stringify(availableScenes, null, 2)}

Current Background Scene:
${currentBackground ? JSON.stringify(currentBackground, null, 2) : 'none'}

${(prompts.systemPrompt as any).backgroundImages.schemaAddition}
`
  }

  const prompt = `${prompts.systemPrompt.intro}

  ${modePrompt}

  ${prompts.systemPrompt.honorifics.header}
  ${Object.keys(relevantHonorifics).length > 0 ? JSON.stringify(relevantHonorifics, null, 2) : '(No characters loaded yet - honorifics will be provided once characters appear)'}

  ${honorificRules}

  ${playerCharacterContext}

  ${enableWebSearch ? prompts.systemPrompt.characterResearch.enabled : prompts.systemPrompt.characterResearch.disabled}

  ${criticalErrors}

  ${mode === 'game' ? (prompts.systemPrompt as any).jsonStructureGame : (prompts.systemPrompt as any).jsonStructureBase}

  ${prompts.systemPrompt.knownProfiles}
  ${knownCharacterNames.length > 0 ? JSON.stringify(getFilteredProfilesForAI(), null, 2) : prompts.systemPrompt.noProfilesMessage}

  ${prompts.systemPrompt.knownLocations}
  ${relevantLocations.length > 0 ? JSON.stringify(getFilteredLocationsForAI(relevantLocations), null, 2) : prompts.systemPrompt.noLocationsMessage}

  ${prompts.systemPrompt.idReference}
  ${relevantCharacterIds.length > 0 ? relevantCharacterIds.join(', ') : prompts.systemPrompt.noIdsMessage}

  ${prompts.systemPrompt.instructions.base}
  ${modeInstructions}
  ${prompts.systemPrompt.instructions.closing}
  ${backgroundSection}
  ${godModeText}
  ${realisticModeText}
  `

  return prompt
}
