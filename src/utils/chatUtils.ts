// src/utils/chatUtils.ts
import l2d from '@/utils/json/l2d.json'

// Helper to identify speaker labels
const isSpeakerLabel = (s: string) => /^\s*(?:\*\*)?[^*]+?(?:\*\*)?\s*:\s*$/.test(s)

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
    // First attempt: parse as-is
    try {
      return JSON.parse(str)
    } catch (e) {
      // Repair attempt: fix unbalanced braces/brackets
      let repaired = str
      
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
          // If still failing, try removing the characterProgression object entirely (it's optional)
          cleaned = cleaned.replace(/"characterProgression"\s*:\s*\{[^}]*(\{[^}]*\}[^}]*)*\}\s*,?/g, '')
          try {
            return JSON.parse(cleaned)
          } catch (e4) {
            throw e // Throw original error
          }
        }
      }
    }
  }

  let data: any = null
  
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
  
  if (!Array.isArray(data)) {
    if (data) {
        data = [data]
    } else {
        throw new Error('Failed to parse JSON')
    }
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
    'debug_info'
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
        if (poss === "'s" || poss === '’s') return true
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

  for (const action of actions) {
    if (!action.text || typeof action.text !== 'string') {
      newActions.push(action)
      continue
    }

    // Check if the text contains dialogue.
    // Supports straight quotes ("...") and curly quotes (open “ ... close ”).
    // Curly quotes are asymmetric, so we match them as a pair explicitly.
    const text = action.text
    const dialogueRegex = /("[\s\S]*?"|“[\s\S]*?”)/g

    if (!dialogueRegex.test(text)) {
      // No quotes. If the model marked it as speaking, keep it UNLESS it looks like third-person narration.
      if (action.speaking === true && looksLikeNarrationWithoutQuotes(text)) {
        newActions.push({ ...action, speaking: false })
      } else {
        newActions.push(action)
      }
      continue
    }

    // Split on dialogue quotes only, being very precise
    const parts: { text: string, isDialogue: boolean }[] = []
    let lastIndex = 0
    
    // Reset regex for splitting
    dialogueRegex.lastIndex = 0
    let match
    
    while ((match = dialogueRegex.exec(text)) !== null) {
      // Add any narration before this dialogue
      const narrationBefore = text.substring(lastIndex, match.index).trim()
      if (narrationBefore) {
        parts.push({ text: narrationBefore, isDialogue: false })
      }
      
      // Add the dialogue (with quotes)
      const dialogue = match[0] // Full match including quotes
      parts.push({ text: dialogue, isDialogue: true })
      
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
      
      if (part.isDialogue) {
        newActions.push({
          ...base,
          text: part.text.trim(),
          speaking: true
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

  // Post-process: If a narration action (speaking=false) is followed by a dialogue action (speaking=true),
  // copy the animation from the narration to the dialogue.
  // This ensures the emotion set during narration persists into the dialogue.
  for (let i = 1; i < newActions.length; i++) {
    const prev = newActions[i - 1]
    const curr = newActions[i]

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
  }

  return newActions
}

// Split narration into actions
export const splitNarration = (text: string): any[] => {
  const actions: any[] = []
  // First, split into paragraphs on double newlines
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())

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

  // CRITICAL: If the text looks like JSON (starts with [ or {), DO NOT parse it as narration.
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

  // Regex to find "Name: "Dialogue"" pattern  
  // Matches: Name (alphanumeric+spaces+dashes+parentheses) followed by colon and quoted text
  const regex = /([A-Za-z0-9\s\-\(\)]+):\s*([“”"][\s\S]*?[“”"])/g

  let lastIndex = 0
  let match

  while ((match = regex.exec(cleanText)) !== null) {
    const fullMatch = match[0]
    const name = match[1].trim()
    const dialogue = match[2]
    const index = match.index

    // 1. Narration (text before the speaker)
    const narration = cleanText.substring(lastIndex, index).trim()

    // Resolve Character ID
    let charId = 'current'
    // Try exact match first
    let charObj = l2d.find(c => c.name.toLowerCase() === name.toLowerCase())
    // If not found, try partial match for names with spaces
    if (!charObj) {
       charObj = l2d.find(c => name.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(name.toLowerCase()))
    }
    if (charObj) charId = charObj.id

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

    // 2. Dialogue
    actions.push({
      text: dialogue,
      character: charId,
      animation: 'idle',
      speaking: true
    })

    lastIndex = index + fullMatch.length
  }

  // Trailing text
  const trailing = cleanText.substring(lastIndex).trim()
  if (trailing) {
     actions.push(...splitNarration(trailing))
  }

  return actions
}