// src/utils/chatUtils.ts
import l2d from '@/utils/json/l2d.json'

// Helper to identify speaker labels
const isSpeakerLabel = (s: string) => /^\s*(?:\*\*)?[^*]+?(?:\*\*)?\s*:\s*$/.test(s)

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

// Sanitize actions to ensure narration/dialogue separation
export const sanitizeActions = (actions: any[]): any[] => {
  const newActions: any[] = []

  for (const action of actions) {
    if (!action.text || typeof action.text !== 'string') {
      newActions.push(action)
      continue
    }

    // Check if text contains quotes
    // We look for standard quotes " and smart quotes " "
    const hasQuotes = /["""]/.test(action.text)

    if (!hasQuotes) {
      // Case 1: No quotes at all.

      // Filter out standalone speaker labels
      if (isSpeakerLabel(action.text)) {
        continue
      }

      // If it was marked as speaking, only force to false if it looks like a stage direction
      if (action.speaking) {
        // Check for stage directions starting with *, (, or [
        if (/^[\s]*[\[\(*]/.test(action.text)) {
          action.speaking = false
        }
        // Otherwise, trust the AI's speaking flag even without quotes
        // This handles cases where the AI forgets quotes around dialogue
      }
      newActions.push(action)
      continue
    }

    // Case 2: Has quotes. We need to split.
    // Regex to match quoted sections including the quotes
    const splitRegex = /([""][^""]*[""])/g

    const parts = action.text.split(splitRegex).filter((p: string) => p.trim().length > 0)

    if (parts.length === 0) {
      newActions.push(action)
      continue
    }

    // Helper to determine if a part is a quote
    // Use [\s\S] to match any character including newlines
    const isQuote = (s: string) => /^[""][\s\S]*[""]$/.test(s.trim())

    // Merge trailing punctuation into previous part to avoid tiny separate messages
    const mergedParts: { text: string, isQuoted: boolean, characterId: string }[] = []
    let effectiveCharacterId = action.character

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const quoted = isQuote(part)

      // Filter out standalone speaker labels (e.g. "**Anis:**")
      // These are often artifacts from splitting "Name: Quote"

      if (isSpeakerLabel(part) && !quoted) {
        continue
      }

      // If this part is just punctuation/space and we have a previous part, merge it
      // This handles cases like: "Hello". -> "Hello" + .
      if (mergedParts.length > 0 && !quoted && /^[.,;!?\s]+$/.test(part)) {
        mergedParts[mergedParts.length - 1].text += part
      } else {
        mergedParts.push({ text: part, isQuoted: quoted, characterId: effectiveCharacterId })
      }
    }

    for (const partObj of mergedParts) {
      // Create new action
      const newAction = { ...action, text: partObj.text, character: partObj.characterId }

      if (partObj.isQuoted) {
        newAction.speaking = true
      } else {
        newAction.speaking = false
      }

      // Remove fixed duration so it gets recalculated based on text length
      if (newAction.duration) {
        delete newAction.duration
      }

      newActions.push(newAction)
    }
  }

  // Post-process: If a narration action (speaking=false) is followed by a dialogue action (speaking=true)
  // for the same character, copy the animation from the narration to the dialogue.
  // This ensures the emotion set during narration persists into the dialogue.
  for (let i = 1; i < newActions.length; i++) {
    const prev = newActions[i - 1]
    const curr = newActions[i]

    // Check if same character, previous is narration, current is dialogue
    if (prev.character && curr.character &&
        prev.character === curr.character &&
        prev.speaking === false &&
        curr.speaking === true &&
        prev.animation && prev.animation !== 'idle') {
      // Copy the narration animation to the dialogue
      curr.animation = prev.animation
    }
  }

  return newActions
}

// Split narration into actions
export const splitNarration = (text: string): any[] => {
  const actions: any[] = []
  // Split into sentences, handling common punctuation. 
  const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g)

  if (!sentences) {
      return [{ text, character: 'none', animation: 'idle', speaking: false }]
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

  return actions
}

// Fallback parsing for AI response
export const parseFallback = (text: string): any[] => {
  const actions: any[] = []
  // Remove bold markers to simplify regex matching
  const cleanText = text.replace(/\*\*/g, '')

  // Regex to find "Name: "Dialogue"" pattern
  // Matches: Name (alphanumeric+spaces+dashes+parentheses) followed by colon and quoted text
  const regex = /([A-Za-z0-9\s\-\(\)]+):\s*([""][\s\S]*?[""])/g

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