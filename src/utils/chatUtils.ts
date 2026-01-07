// src/utils/chatUtils.ts
import { type Ref } from 'vue'
import l2d from '@/utils/json/l2d.json'
import characterHonorifics from '@/utils/json/honorifics.json'

// Helper to merge base profiles with progression overlays (personality + relationships only)
export const getEffectiveCharacterProfiles = (base: Record<string, any>, progression: Record<string, any>): Record<string, any> => {
  const merged: Record<string, any> = {}
  const progressionKeys = Object.keys(progression || {})

  for (const [name, profile] of Object.entries(base || {})) {
    const outProfile = profile && typeof profile === 'object' && !Array.isArray(profile) ? { ...(profile as any) } : profile
    const progKey = progressionKeys.find((k) => k.toLowerCase() === name.toLowerCase())
    const update = progKey ? (progression as any)[progKey] : undefined

    if (outProfile && typeof outProfile === 'object' && !Array.isArray(outProfile) && update && typeof update === 'object') {
      if ((update as any).personality) {
        ;(outProfile as any).personality = (update as any).personality
      }

      if ((update as any).relationships && typeof (update as any).relationships === 'object') {
        ;(outProfile as any).relationships = {
          ...((outProfile as any).relationships || {}),
          ...((update as any).relationships || {})
        }
      }
    }

    merged[name] = outProfile
  }

  return merged
}

// Simple debug helper used across chat components
export const logDebug = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

// Helper to get honorific with fallback to "Commander"
export const getHonorific = (characterName: string): string => {
  return (characterHonorifics as Record<string, string>)[characterName] || 'Commander'
}

// Typewriter controller factory: keeps internal interval state out of component and
// returns `start` and `stop` functions bound to the provided refs.
export const createTypewriterController = (opts: { displayedRef: Ref<string>, currentTextRef: Ref<string>, typingRef: Ref<boolean> }) => {
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

// Helper to identify speaker labels.
// Supports plain "Name:" and bolded "**Name:**" (colon inside the bold).
const isSpeakerLabel = (s: string) => {
  const normalized = (s || '').replace(/\u00A0/g, ' ').trim()
  return /^\s*(?:\*\*)?\s*[^*:\n]+?\s*:\s*(?:\*\*)?\s*$/.test(normalized)
}

// Helper to check if a word appears as a whole word in text (case-insensitive)
export const isWholeWordPresent = (text: string, word: string): boolean => {
  if (!text || !word) return false
  // Escape special regex chars in word
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return regex.test(text)
}

// Clean up wikitext for the model
export const cleanWikiContent = (wikitext: string): string => {
  let text = wikitext
  // Remove wiki markup templates like {{...}}
  text = text.replace(/\{\{[^}]*\}\}/g, '')
  // Remove [[ ]] link markup but keep the text
  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
  // Remove remaining brackets
  text = text.replace(/\[|\]/g, '')
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  // Remove section headers markup (== Header ==)
  text = text.replace(/^=+\s*(.+?)\s*=+$/gm, '$1:')
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/\s+/g, ' ').trim()
  // Limit length to avoid token limits
  if (text.length > 4000) {
    text = text.substring(0, 4000) + '...'
  }
  return text
}

// Parse AI response string into actions array
export const parseAIResponse = (responseStr: string): any[] => {
  const originalResponse = responseStr
  let jsonStr = responseStr
  
  // FIRST: Try to extract JSON from markdown code blocks (highest priority)
  const jsonBlockMatch = responseStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim()
  } else {
    // Remove any stray markdown markers
    jsonStr = responseStr.replace(/```json\n?|\n?```/g, '').trim()
  }
  
  // Attempt to extract JSON structure (array or object) if mixed with text
  const firstOpenBrace = jsonStr.indexOf('{')
  const firstOpenBracket = jsonStr.indexOf('[')
  
  let start = -1
  let end = -1
  
  // Determine if we should look for an array or an object based on which appears first
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

  // Try to repair common JSON errors
  const tryParseJSON = (str: string): any => {
    const trimmed = (str || '').trim()

    // Heuristic: If we got a truncated JSON array, try to salvage by cutting at the last complete object.
    // This specifically helps when the model output is cut mid-string near the end of the response.
    if (trimmed.startsWith('[') && trimmed.lastIndexOf(']') === -1) {
      const lastObjEnd = trimmed.lastIndexOf('}')
      if (lastObjEnd !== -1) {
        const candidate = (trimmed.slice(0, lastObjEnd + 1).replace(/,\s*$/, '') + ']').trim()
        try {
          return JSON.parse(candidate)
        } catch {
          // Fall through to the normal repair logic
        }
      }
    }

    // First attempt: parse as-is
    try {
      return JSON.parse(trimmed)
    } catch (e) {
      // Repair attempt: fix unbalanced braces/brackets
      let repaired = trimmed
      
      // Count braces and brackets
      const openBraces = (repaired.match(/{/g) || []).length
      const closeBraces = (repaired.match(/}/g) || []).length
      const openBrackets = (repaired.match(/\[/g) || []).length
      const closeBrackets = (repaired.match(/]/g) || []).length
      
      // Add missing closing braces
      if (openBraces > closeBraces) {
        repaired += '}'.repeat(openBraces - closeBraces)
      }
      // Add missing closing brackets
      if (openBrackets > closeBrackets) {
        repaired += ']'.repeat(openBrackets - closeBrackets)
      }
      
      // Try again with repaired string
      try {
        return JSON.parse(repaired)
      } catch (e2) {
        // If still failing, try removing the memory object entirely (it's optional)
        let cleaned = str.replace(/"memory"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}\s*,?/g, '')
        try {
          return JSON.parse(cleaned)
        } catch (e3) {
          // If still failing, try removing legacy/hallucinated characterProfile blocks (often huge / malformed)
          cleaned = cleaned
            .replace(/"characterProfile"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}\s*,?/g, '')
            .replace(/"characterProfiles"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}\s*,?/g, '')
          try {
            return JSON.parse(cleaned)
          } catch (e4) {
            // Last resort: remove characterProgression (it's optional)
            cleaned = cleaned.replace(/"characterProgression"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}\s*,?/g, '')
            return JSON.parse(cleaned)
          }
        }
      }
    }
  }

  let data: any = null

  // Special-case: model sometimes outputs normal prose + a "choices" JSON array block.
  // Example:
  //   ...narration...\n\n**choices:**\n[ {"text": "...", "type": "dialogue"}, ... ]
  // In that case, we should parse the choices array and attach it to the final action
  // parsed from the narrative, instead of treating the array as the action list.
  const extractChoicesArrayBlock = (raw: string): { beforeText: string, choicesJson: string } | null => {
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
        const actions = Array.isArray(actionsFromNarrative) && actionsFromNarrative.length > 0
          ? actionsFromNarrative
          : [{ text: extractedChoices.beforeText || '...', character: 'current', animation: 'idle', speaking: false }]

        actions[actions.length - 1].choices = parsedChoices

        return actions
      }
    } catch {
      // Fall through to the normal parsing pipeline.
    }
  }
  
  try {
    data = tryParseJSON(jsonStr)
  } catch (e) {
    // Main parse failed. Try "Salvage Strategy": Extract individual action objects
    // This helps when one part of the JSON (like memory/progression) is broken but actions are fine
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

  // If we still don't have data, check for DeepSeek nested JSON
  if (!data) {
    // Try parsing as is one last time to trigger the catch block in the caller if needed
    // or just let it fall through to the array check which will fail
    try {
      data = JSON.parse(jsonStr)
    } catch (e) {
      // Ignore
    }
  }

  // DeepSeek Fix: Check if the model returned the JSON array INSIDE the 'text' field of a wrapper object
  // Example: { "text": "[{...}]", ... }
  const potentialObject = data as any

  if (!Array.isArray(data) && typeof potentialObject === 'object' && potentialObject !== null && potentialObject.text && typeof potentialObject.text === 'string') {
    const textContent = potentialObject.text.trim()
    // Check if it looks like a JSON array or object
    if ((textContent.startsWith('[') || textContent.startsWith('{'))) {
      try {
        const nestedData = tryParseJSON(textContent)
        // If successful, use the nested data
        if (nestedData) {
          data = nestedData
        }
      } catch (e) {
        // Failed to parse nested JSON, use original object
      }
    }
  }
  
  // Response Healing Schema support: Check if the object has an 'actions' array
  if (!Array.isArray(data) && data && typeof data === 'object' && Array.isArray(data.actions)) {
    const topLevelChoices = data.choices
    data = data.actions
    
    // If there were top-level choices, attach them to the last action
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

  // If the "actions" we parsed are actually just a choices array (text+type only),
  // attach them as choices to fallback-parsed narrative instead of treating them as actions.
  const looksLikeChoicesOnly = (arr: any[]): boolean => {
    if (!Array.isArray(arr) || arr.length === 0) return false

    return arr.every((x) => x && typeof x === 'object'
      && typeof x.text === 'string'
      && (x.type === 'dialogue' || x.type === 'action')
      && !('character' in x)
      && !('speaking' in x)
      && !('animation' in x)
    )
  }

  if (looksLikeChoicesOnly(data)) {
    const actionsFromNarrative = parseFallback(originalResponse.replace(/\n\s*\*\*choices\*\*\s*:\s*[\s\S]*$/i, '').trim())
    const actions = Array.isArray(actionsFromNarrative) && actionsFromNarrative.length > 0
      ? actionsFromNarrative
      : [{ text: '...', character: 'current', animation: 'idle', speaking: false }]
    actions[actions.length - 1].choices = data

    return actions
  }

  return data
}

// Sanitize actions to ensure narration/dialogue separation
export const sanitizeActions = (actions: any[]): any[] => {
  const newActions: any[] = []

  // Metadata fields that should not be duplicated if we split an action into multiple ones.
  // These can trigger side-effects (search, profile updates, debug panels).
  const nonDuplicatedFields = new Set([
    'needs_search',
    'memory',
    'characterProgression',
    'characterProfile',
    'characterProfiles',
    'debug_info',
    'choices'
  ])

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

      // Speaker label ("Name:")
      if (nextChar === ':') return false

      // Direct address ("Name,")
      if (nextChar === ',') return false

      // Possessive narration: "Name's ..." / "Name’s ..."
      if (nextChar === '\'' || nextChar === '’') {
        const poss = after.slice(0, 2)

        if (poss === '\'s' || poss === '’s') return true
      }

      // Strong narration clue: "Name ..., her/his/ ..." early in the sentence.
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

  const resolveCharacterIdFromSpeakerLabel = (labelText: string): string | undefined => {
    const cleaned = (labelText || '').replace(/\*\*/g, '').trim()

    if (!cleaned) return undefined

    const name = cleaned.endsWith(':') ? cleaned.slice(0, -1).trim() : cleaned

    if (!name) return undefined
    if (name.toLowerCase() === 'commander') return 'commander'

    const exact = l2d.find((c: any) => typeof c?.name === 'string' && c.name.toLowerCase() === name.toLowerCase())

    return exact ? (exact as any).id : undefined
  }

  const resolveCharacterIdFromLeadingName = (rawText: string): string | undefined => {
    const t = (rawText || '').replace(/\u00A0/g, ' ').trimStart()
    if (!t) return undefined

    // Commander special-case
    if (t.toLowerCase().startsWith('commander')) {
      const after = t.slice('commander'.length)
      const next = after.charAt(0)
      if (!next || /[\s,.:;!?\-—–'’]/.test(next)) return 'commander'
    }

    for (const char of l2d as any[]) {
      const name = typeof char?.name === 'string' ? (char.name as string) : ''
      const id = typeof char?.id === 'string' ? (char.id as string) : ''
      if (!name || !id) continue

      const nameLower = name.toLowerCase()
      if (!t.toLowerCase().startsWith(nameLower)) continue

      const after = t.slice(name.length)
      const next = after.charAt(0)
      // Accept boundaries that imply "Name ..." is the subject of narration.
      if (!next || /[\s,.:;!?\-—–'’]/.test(next)) return id
    }

    return undefined
  }

  for (const action of actions) {
    if (!action.text || typeof action.text !== 'string') {
      newActions.push(action)

      continue
    }

    // Extra fallback: some models ignore JSON and output plain prose with inline speaker labels
    // like "**Chime:** ..." or "Chime: ..." without quotes.
    // In that case, split the action into narration + dialogue segments and mark dialogue as speaking.
    const splitOnSpeakerLabels = (raw: string): { text: string, speaking: boolean, character?: string }[] | null => {
      const input = (raw || '').trim()
      if (!input) return null

      // Match a potential speaker label. We validate against known character names to avoid false positives.
      // Example matches: "Chime:", "**Chime:**" (colon can be outside/inside bold; sanitize handles both).
      const labelRegex = /(^|[\s\n.!?]|[-—–])(?:\*\*)?([A-Za-z0-9\s\-()]{1,40})(?:\*\*)?\s*:\s*/g
      const matches: Array<{ start: number, end: number, name: string }> = []

      let m: RegExpExecArray | null
      while ((m = labelRegex.exec(raw)) !== null) {
        const boundary = m[1] || ''
        const name = (m[2] || '').trim().replace(/\s+/g, ' ')

        if (!name) continue

        // Validate name by resolving to an l2d character or Commander.
        // IMPORTANT: Do NOT do substring matching here. It causes false positives like "Crow" matching "Crown".
        const resolved = name.toLowerCase() === 'commander'
          ? 'commander'
          : l2d.find((c: any) => typeof c?.name === 'string' && c.name.toLowerCase() === name.toLowerCase())

        if (!resolved) continue

        const start = m.index + boundary.length
        const end = labelRegex.lastIndex
        matches.push({ start, end, name })
      }

      if (matches.length === 0) return null

      const out: { text: string, speaking: boolean, character?: string }[] = []
      let cursor = 0

      const resolveId = (name: string): string | undefined => {
        if (!name) return undefined
        if (name.toLowerCase() === 'commander') return 'commander'

        const exact = l2d.find((c: any) => typeof c?.name === 'string' && c.name.toLowerCase() === name.toLowerCase())

        return exact ? (exact as any).id : undefined
      }

      for (let i = 0; i < matches.length; i++) {
        const curr = matches[i]
        const next = matches[i + 1]

        const narrationBefore = raw.slice(cursor, curr.start).trim()

        if (narrationBefore) {
          out.push({ text: narrationBefore, speaking: false })
        }

        const dialogueText = raw.slice(curr.end, next ? next.start : raw.length).trim()

        if (dialogueText) {
          out.push({ text: dialogueText, speaking: true, character: resolveId(curr.name) })
        }

        cursor = next ? next.start : raw.length
      }

      return out.length > 0 ? out : null
    }

    // Check if the text contains dialogue.
    // Supports straight quotes ("...") and curly quotes (open “ ... close ”).
    // Curly quotes are asymmetric, so we match them as a pair explicitly.
    const text = action.text
    const dialogueRegex = /("[\s\S]*?"|“[\s\S]*?”)/g

    if (!dialogueRegex.test(text)) {
      // No quotes. If the text includes inline speaker labels, split them into dialogue segments.
      const speakerSplit = splitOnSpeakerLabels(text)

      if (speakerSplit) {
        for (let i = 0; i < speakerSplit.length; i++) {
          const part = speakerSplit[i]

          if (!part.text.trim()) continue

          const base: any = { ...action }

          if (i > 0) {
            for (const key of Object.keys(base)) {
              if (nonDuplicatedFields.has(key)) {
                if (key === 'needs_search') base[key] = []
                else delete base[key]
              }
            }
          }

          // Move choices to the last segment.
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

      // No quotes. If the model marked it as speaking, keep it UNLESS it looks like third-person narration.
      if (action.speaking === true && looksLikeNarrationWithoutQuotes(text)) {
        newActions.push({ ...action, speaking: false })
      } else {
        newActions.push(action)
      }

      continue
    }

    // Split on dialogue quotes only, being very precise
    const parts: { text: string, isDialogue: boolean, character?: string }[] = []
    let lastIndex = 0
    
    // Reset regex for splitting
    dialogueRegex.lastIndex = 0
    let match
    
    while ((match = dialogueRegex.exec(text)) !== null) {
      // Add any narration before this dialogue
      const narrationBefore = text.substring(lastIndex, match.index).trim()
      // If this chunk is ONLY a speaker label (e.g. "**Chime:**"), treat it as metadata:
      // - Assign the character for the upcoming dialogue
      // - Do NOT include the label in the dialogue text
      const isLabelOnly = !!narrationBefore && isSpeakerLabel(narrationBefore)

      if (narrationBefore && !isLabelOnly) {
        parts.push({ text: narrationBefore, isDialogue: false })
      }

      // Add the dialogue (with quotes)
      const dialogue = match[0] // Full match including quotes
      const speakerId = isLabelOnly ? resolveCharacterIdFromSpeakerLabel(narrationBefore) : undefined
      parts.push({ text: dialogue, isDialogue: true, character: speakerId })
      
      lastIndex = match.index + match[0].length
    }
    
    // Add any remaining narration
    const remaining = text.substring(lastIndex).trim()
    if (remaining) {
      parts.push({ text: remaining, isDialogue: false })
    }
    
    // Convert parts to actions
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part.text.trim()) continue

      // Preserve all original fields by default, but avoid duplicating side-effect fields.
      const base: any = { ...action }
      if (i > 0) {
        for (const key of Object.keys(base)) {
          if (nonDuplicatedFields.has(key)) {
            if (key === 'needs_search') base[key] = []
            else delete base[key]
          }
        }
      }

      // Special handling for choices: Move to the LAST part
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
        // Keep the original character for narration (the narration is *about* that character).
        // This prevents narration like from being treated/displayed as spoken dialogue.
        newActions.push({
          ...base,
          text: part.text.trim(),
          speaking: false
        })
      }
    }
  }

  // Post-process: If narration starts with a known character name, assign that character.
  // This fixes common model mistakes where narration about "Chime ..." is tagged as the previous speaker.
  for (const action of newActions) {
    if (action?.speaking !== false) continue
    if (typeof action.text !== 'string') continue

    const inferred = resolveCharacterIdFromLeadingName(action.text)
    if (inferred) {
      action.character = inferred
    }
  }

  // Post-process: Force high intensity for ALL CAPS (shouting/anger)
  for (const action of newActions) {
    const originalText = action.text || ''
    // Match words with at least 2 uppercase letters to avoid single-letter words like "I" or "A"
    const capsWords = originalText.match(/\b[A-Z]{2,}\b/g)
    const isShouting = capsWords && capsWords.length > 0

    if (isShouting) {
      const currentAnim = (action.animation || '').toLowerCase()
      // If it's already a high-intensity animation, don't overwrite it.
      const isAlreadyHighIntensity = currentAnim.includes('_02') || currentAnim === 'shock' || currentAnim === 'furious' || currentAnim === 'shouting'

      if (!isAlreadyHighIntensity && (!currentAnim || currentAnim === 'idle' || currentAnim.includes('angry') || currentAnim.includes('shock') || currentAnim.includes('surprise'))) {
        // We use 'angry_02' as the canonical high-intensity anger. 
        // Loader.vue will handle falling back to 'angry' or 'shock' if 'angry_02' isn't available.
        action.animation = 'angry_02'
      }
    }
  }

  // Post-process: If a narration action (speaking=false) is followed by a dialogue action (speaking=true),
  // copy the animation from the narration to the dialogue.
  // This ensures the emotion set during narration persists into the dialogue.
  for (let i = 1; i < newActions.length; i++) {
    const prev = newActions[i - 1]
    const curr = newActions[i]

    const hasMeaningfulAnimation = (anim: any): boolean => {
      if (typeof anim !== 'string') return false
      const t = anim.trim().toLowerCase()
      if (!t) return false
      return t !== 'idle' && t !== 'none'
    }

    // Check if previous is narration, current is dialogue
    if (prev.speaking === false &&
        curr.speaking === true &&
        prev.animation && prev.animation !== 'idle' &&
        prev.character && curr.character &&
        prev.character === curr.character &&
        (!curr.animation || curr.animation === 'idle')) {
      // Only carry over animation for the SAME character, and only when the dialogue didn't specify one.
      curr.animation = prev.animation
    }

    // Also handle the inverse: if a dialogue chunk has an emotion but the adjacent narration chunk
    // (created by splitting a combined line) doesn't, copy dialogue's animation to narration.
    if (prev.character && curr.character && prev.character === curr.character) {
      // Narration -> dialogue continuity (copy dialogue emotion back onto preceding narration if narration is missing)
      if (prev.speaking === false && curr.speaking === true &&
          hasMeaningfulAnimation(curr.animation) &&
          (!prev.animation || String(prev.animation).toLowerCase() === 'idle' || String(prev.animation).trim() === '')) {
        prev.animation = curr.animation
      }

      // Dialogue -> narration
      if (prev.speaking === true && curr.speaking === false &&
          hasMeaningfulAnimation(prev.animation) &&
          (!curr.animation || String(curr.animation).toLowerCase() === 'idle' || String(curr.animation).trim() === '')) {
        curr.animation = prev.animation
      }

      // Narration -> dialogue (more permissive than the earlier block, but only when dialogue is missing)
      if (prev.speaking === false && curr.speaking === true &&
          hasMeaningfulAnimation(prev.animation) &&
          (!curr.animation || String(curr.animation).toLowerCase() === 'idle' || String(curr.animation).trim() === '')) {
        curr.animation = prev.animation
      }
    }
  }

  return newActions
}

export type GameModeChoice = {
  text: string
  type?: 'dialogue' | 'action'
  // Backward compatibility: older responses may include label
  label?: string
}

export const getChoiceText = (choice: any): string => {
  return String(choice?.text ?? choice?.label ?? '').trim()
}

export const inferEffectiveChoiceType = (
  choiceText: string,
  declaredType?: unknown
): 'dialogue' | 'action' | null => {
  const normalizedType: 'dialogue' | 'action' | null =
    declaredType === 'dialogue' || declaredType === 'action' ? (declaredType as any) : null

  return normalizedType
}

export const formatChoiceAsUserTurn = (choice: any): string => {
  const text = getChoiceText(choice)
  const effectiveType = inferEffectiveChoiceType(text, choice?.type)

  if (effectiveType === 'dialogue') return text
  if (effectiveType === 'action') {
    // Keep existing brackets if already present
    const first = text.charAt(0)
    const last = text.charAt(text.length - 1)

    if (first === '[' && last === ']') return text

    return `[${text}]`
  }

  // If the model did not provide a valid type, do NOT guess.
  // Return as-is to avoid misclassifying an action as dialogue (or vice versa).
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
    // Strip common speaker prefixes (markdown or plain)
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

// Split narration into actions
export const splitNarration = (text: string): any[] => {
  const actions: any[] = []
  // First, split into paragraphs on double newlines
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim())

  for (const paragraph of paragraphs) {
    // Split each paragraph into sentences, handling common punctuation.
    const sentences = paragraph.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g)

    if (!sentences) {
      // If no sentences, treat the whole paragraph as one
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
        // Check for "Name " or "Name's" or "Name." or just "Name" at start
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

  // If the text looks like JSON (starts with [ or {), DO NOT parse it as narration.
  // This prevents raw JSON strings from being displayed to the user when JSON parsing fails.
  if (cleanText.startsWith('[') || cleanText.startsWith('{')) {
    // Try one last desperate regex extraction for objects with "text" and "character"
    // This handles cases where the JSON is so broken that tryParseJSON failed, but we can still see objects
    const objectRegex = /\{\s*"text"\s*:\s*"([^"]+)"\s*,\s*"character"\s*:\s*"([^"]+)"/g
    let match
    let found = false

    while ((match = objectRegex.exec(cleanText)) !== null) {
      found = true
      actions.push({
        text: match[1],
        character: match[2],
        animation: 'idle',
        speaking: true // Assume speaking if it has this structure
      })
    }
      
    if (found) return actions
      
    // If no objects found, return empty to signal failure rather than showing raw JSON
    return []
  }

  // Regex to find speaker labels.
  // We support both quoted dialogue ("...") and unquoted dialogue (common for NIKKE-style outputs).
  const regex = /(^|[\s\n.!?]|[-—–])([A-Za-z0-9\s\-()]{1,40})\s*:\s*/g

  let lastIndex = 0
  let match

  // Collect all label matches first so we can slice dialogue until the next label.
  const labels: Array<{ index: number, end: number, name: string }> = []
  while ((match = regex.exec(cleanText)) !== null) {
    const boundary = match[1] || ''
    const name = (match[2] || '').trim().replace(/\s+/g, ' ')
    if (!name) continue

    // Resolve Character ID; if it doesn't resolve to a known character (or Commander), ignore.
    const isCommander = name.toLowerCase() === 'commander'
    const charObj = isCommander ? null : l2d.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (!charObj && !isCommander) continue

    labels.push({
      index: match.index + boundary.length,
      end: regex.lastIndex,
      name
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

    const name = curr.name
    const index = curr.index

    // 1. Narration (text before the speaker)
    const narration = cleanText.substring(lastIndex, index).trim()

    // Resolve Character ID
    let charId = 'current'

    if (name.toLowerCase() === 'commander') {
      charId = 'commander'
    } else {
      const charObj = l2d.find((c) => c.name.toLowerCase() === name.toLowerCase())

      if (charObj) charId = charObj.id
    }

    if (narration) {
      const narrationActions = splitNarration(narration)

      // If the last narration action has 'none' character, it might belong to the upcoming speaker
      if (narrationActions.length > 0) {
        const lastAction = narrationActions[narrationActions.length - 1]

        if (lastAction.character === 'none') {
          lastAction.character = charId
        }
      }

      actions.push(...narrationActions)
    }

    // 2. Dialogue (unquoted or quoted) runs until the next speaker label
    const dialogue = cleanText.substring(curr.end, next ? next.index : cleanText.length).trim()

    if (dialogue) {
      actions.push({
        text: dialogue,
        character: charId,
        animation: 'idle',
        speaking: true
      })
    }

    lastIndex = next ? next.index : cleanText.length
  }

  // Trailing text
  const trailing = cleanText.substring(lastIndex).trim()

  if (trailing) actions.push(...splitNarration(trailing))

  return actions
}

export const calculateYapDuration = (text: string): number => {
  if (!text) return 3000
  // Approx 60ms per character + 300ms base (Slightly faster than reading speed for natural feel)
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

  // Replay Animation
  if (msg.animation) {
    ctx.market.live2d.current_animation = msg.animation
  }

  // Switch Character
  if (msg.character && msg.character !== 'none' && msg.character !== ctx.market.live2d.current_id) {
    const charObj = l2d.find((c) => c.id.toLowerCase() === msg.character.toLowerCase() || c.name.toLowerCase() === msg.character.toLowerCase())
    if (charObj) {
      ctx.market.live2d.change_current_spine(charObj)
    }
  }

  // Speaking / Yapping
  if (msg.speaking && !ctx.ttsEnabled) {
    const text = msg.text || msg.content || ''
    const yapDuration = calculateYapDuration(text)
    ctx.manageYap(yapDuration)
  }

  // NIKKE Mode Overlay
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
