#!/usr/bin/env node

/**
 * Backstory Update Script
 *
 * This script updates existing characters in characterProfiles.json or characterProfilesVariants.json
 * by fetching wiki content and using either Gemini 3 Pro or Grok 4.1 Fast to extract information.
 *
 * Usage:
 *   node scripts/updateBackstories.js
 *   node scripts/updateBackstories.js --no-skip-existing    # Re-process all characters
 *   node scripts/updateBackstories.js --skip-preview         # In update mode, save without confirmation
 *
 * Options:
 *   --no-skip-existing    Process characters even if they already have data (default: skip existing)
 *   --skip-preview        In "Update characters' backstories" mode, save changes immediately without
 *                         showing a preview and asking for confirmation (default: show preview)
 *
 * Environment Variables:
 *   GEMINI_API_KEY - Your Gemini API key
 *   OPENROUTER_API_KEY - Your OpenRouter API key
 *   RATE_LIMIT_MS - Delay between API calls in milliseconds (default: 2000)
 *
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')

// Configuration
// Wiki proxy worker fetches sections: description, nikke backstory, personality, background, story
const WIKI_PROXY_URL = 'https://nikke-wiki-proxy.rhysticone.workers.dev'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'x-ai/grok-4.1-fast'
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS) || 2000

const PROFILES_BASE_PATH = path.join(__dirname, '..', 'src', 'utils', 'json', 'characterProfiles.json')
const PROFILES_VARIANTS_PATH = path.join(__dirname, '..', 'src', 'utils', 'json', 'characterProfilesVariants.json')

const args = process.argv.slice(2)
const SKIP_EXISTING = !args.includes('--no-skip-existing') // Default: true (skip existing)
const SKIP_PREVIEW = args.includes('--skip-preview') // For update mode: save without confirmation

// Mode and paths
let MODE = 'base' // 'base', 'variants', 'visual', 'create', 'commander', or 'update'
let PROFILES_PATH = PROFILES_BASE_PATH

// Create mode state
let CREATE_CHAR_NAME = null
let CREATE_PROFILES_PATH = null

// Update mode state
let UPDATE_CHAR_NAME = null // single character name, or null for all
let UPDATE_SCOPE = 'all' // 'single' or 'all'

// API Provider selection
let API_PROVIDER = null
let GEMINI_API_KEY = process.env.GEMINI_API_KEY
let OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

if (!GEMINI_API_KEY && !OPENROUTER_API_KEY) {
  console.error('Error: Either GEMINI_API_KEY or OPENROUTER_API_KEY environment variable is required')
  console.error('Set one with:')
  console.error('  export GEMINI_API_KEY=your_gemini_key_here')
  console.error('  OR')
  console.error('  export OPENROUTER_API_KEY=your_openrouter_key_here')
  process.exit(1)
}

// Prompt template for base characters (backstory only)
const BASE_PROMPT = `Based on the following wiki content about the NIKKE character "{name}", extract their backstory and key story events.

WIKI CONTENT:
{content}

Extract the following information:
Backstory - Summarize their key story events, history, and major plot points. Focus on IMPORTANT and RELEVANT events that shaped the character. Remove minor events, filler content, and very insignificant details. Include: major character arcs, formative experiences, key relationships development, and significant turning points.

Return ONLY a JSON object:
{
  "backstory": "Summary of key story events and character history - focus on major plot points and important events only. Be comprehensive but concise."
}

If no story information is found, return:
{
  "backstory": "No significant story events found in wiki."
}`

// Prompt template for variant characters (all fields)
const VARIANTS_PROMPT = `Based on the following wiki content about the NIKKE character "{name}", extract detailed information about this variant character.

WIKI CONTENT:
{content}

Extract the following information:
Personality - Describe the character's personality traits, demeanor, and behavioral characteristics. Focus on what makes this variant unique compared to the base character.

Speech Style - Describe how the character speaks, including their tone, vocabulary level, any verbal quirks, accent patterns, or unique mannerisms. Include example phrases if available.

Backstory - Summarize their key story events, history, and major plot points specific to this variant. Focus on IMPORTANT and RELEVANT events that shaped this version of the character.

Relationships - An object describing key relationships this variant has with other characters. Each key should be a character name, and the value should describe the relationship dynamic.

Return ONLY a JSON object:
{
  "personality": "Detailed personality description...",
  "speech_style": "Description of speech patterns and mannerisms...",
  "backstory": "Summary of key story events and character history...",
  "relationships": {
    "CharacterName": "Description of relationship...",
    "AnotherCharacter": "Description of relationship..."
  }
}

If any field cannot be determined from the wiki, use an empty string for that field (or empty object for relationships). Never use null.`

// Prompt template for visual analysis (appearance, defaultSkin, defaultWeapon)
const VISUAL_PROMPT = 'Analyze the image of this videogame character and provide a description in JSON format of her appearance (using the key `appearance`) and her clothing in the image (using `defaultSkin`). The descriptions MUST be concise and consist of a handful of words (e.g. \'blue eyes, long brown hair\' etc.). If the character is shown with a weapon, also describe it using `defaultWeapon`).'

// Prompt template for extracting Commander/Protagonist relationship only
const COMMANDER_RELATIONSHIP_PROMPT = `Based on the following wiki content about the NIKKE character "{name}", extract ONLY information about this character's relationship with the Commander (also known as the Protagonist, Master, or Servant depending on the character).

WIKI CONTENT:
{content}

The Commander/Protagonist is the player character who leads Nikke squads. Different characters refer to him differently (e.g. "Commander", "Protagonist", "Master", etc.).

Extract the character's relationship with the Commander/Protagonist. Describe the relationship dynamic, how they interact, and any significant events between them.

Return ONLY a JSON object:
{
  "relationship": "Description of the relationship dynamic with the Commander/Protagonist..."
}

If no relationship with the Commander/Protagonist can be determined from the wiki content, return:
{
  "relationship": ""
}`

// Prompt template for updating existing backstories by comparing with wiki content
const UPDATE_BACKSTORY_PROMPT = `You are comparing the existing backstory of the NIKKE character "{name}" with fresh wiki content to identify any notable missing or conflicting information.

EXISTING BACKSTORY (from our database):
{existing_backstory}

FRESH WIKI CONTENT (from the wiki):
{content}

Your task:
1. Treat the EXISTING BACKSTORY as the authoritative base. Preserve its writing style, phrasing, and level of detail.
2. Carefully compare the two sources and identify:
   a) Notable events, character arcs, or plot points present in the wiki content but MISSING from the existing backstory.
   b) Information in the existing backstory that CONFLICTS with important new information from the wiki (e.g. new game content that changes or expands on previous events).
3. If you find missing or conflicting content, produce an updated backstory that:
   - Keeps the existing text as intact as possible (same style, same structure)
   - Seamlessly integrates the new information where it fits naturally
   - Only modifies existing sentences if they directly conflict with important new canon
4. If the existing backstory is already comprehensive and nothing notable is missing, return it unchanged.

Return ONLY a JSON object:
{
  "backstory": "The full updated backstory text (or the unchanged existing backstory if no updates needed)...",
  "changed": true,
  "changes_summary": "Brief description of what was added or modified, e.g. 'Added details about Chapter 35 events and new relationship with X'"
}

If no changes are needed, return:
{
  "backstory": "The existing backstory text unchanged...",
  "changed": false,
  "changes_summary": "No notable new information found in wiki content."
}`

// Character name mappings for wiki search (base characters)
const WIKI_NAME_MAPPINGS_BASE = {
  Ada: 'Ada Wong'
}

// Character name mappings for wiki search (variant characters)
// Variants use their full name with underscore format in wiki URLs
const WIKI_NAME_MAPPINGS_VARIANTS = {}

// Utility: Delay function for rate limiting
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ANSI color codes for terminal output
const ANSI_GREEN = '\x1b[32m'
const ANSI_RESET = '\x1b[0m'

// Utility: Word-level diff that highlights new/changed parts in green
// Uses Longest Common Subsequence (LCS) to find what was added
function highlightDiff(oldText, newText) {
  const oldWords = oldText.split(/(\s+)/)
  const newWords = newText.split(/(\s+)/)

  // Build LCS table
  const m = oldWords.length
  const n = newWords.length
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find which new words are additions
  const isNew = new Array(n).fill(true)
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (oldWords[i - 1] === newWords[j - 1]) {
      isNew[j - 1] = false
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  // Build output with green highlighting for new segments
  let result = ''
  let inGreen = false

  for (let k = 0; k < n; k++) {
    if (isNew[k]) {
      // Skip coloring pure whitespace tokens on their own
      if (newWords[k].trim() === '') {
        result += newWords[k]
        continue
      }
      if (!inGreen) {
        result += ANSI_GREEN
        inGreen = true
      }
      result += newWords[k]
    } else {
      if (inGreen) {
        result += ANSI_RESET
        inGreen = false
      }
      result += newWords[k]
    }
  }

  if (inGreen) {
    result += ANSI_RESET
  }

  return result
}

// Utility: Clean wiki content
function cleanWikiContent(wikitext) {
  if (!wikitext) return ''

  return wikitext
    .replace(/\{\{[^}]+\}\}/g, '') // Remove templates
    .replace(/\[\[([^|\]]+)\|?[^\]]*\]\]/g, '$1') // Clean wiki links
    .replace(/\[([^\]]+)\]/g, '$1') // Clean external links
    .replace(/'''([^']+)'''/g, '$1') // Remove bold
    .replace(/''([^']+)''/g, '$1') // Remove italics
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n') // Normalize newlines
    .trim()
}

// Convert character name to wiki page name
function getWikiPageName(characterName) {
  if (MODE === 'base' || MODE === 'visual') {
    // Apply base mappings for both base mode and visual mode
    const mapped = WIKI_NAME_MAPPINGS_BASE[characterName]
    if (mapped) return mapped
  }
  if (MODE === 'variants') {
    const mapped = WIKI_NAME_MAPPINGS_VARIANTS[characterName]
    if (mapped) return mapped
    // For variants, convert "Name: Variant" to "Name:_Variant" format (keep the colon)
    return characterName.replace(': ', ':_')
  }
  if (MODE === 'create') {
    // For create mode, replace spaces with underscores (preserving colons for variant names)
    // e.g. "Eunhwa: Tactical Upgrade" -> "Eunhwa:_Tactical_Upgrade"
    return characterName.replace(/: /g, ':_').replace(/ /g, '_')
  }
  return characterName
}

// Construct image URL for character (wiki page URL)
function getImageUrl(characterName) {
  const wikiBaseUrl = 'https://nikke-goddess-of-victory-international.fandom.com/wiki/File:'
  // Replace spaces and colons with underscores, remove any special characters
  const formattedName = characterName.replace(/[: ]/g, '_')
  return `${wikiBaseUrl}${formattedName}_FB.png`
}

// Fetch direct image URL from wiki API
async function fetchImageUrl(characterName) {
  // Apply name mapping for visual mode (same as other modes)
  const mappedName = getWikiPageName(characterName)
  const formattedName = mappedName.replace(/[: ]/g, '_')
  const fileName = `${formattedName}_FB.png`
  const apiUrl = `https://nikke-goddess-of-victory-international.fandom.com/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json`

  try {
    const response = await fetch(apiUrl)
    if (!response.ok) {
      console.warn(`  API request failed: ${response.status}`)
      return null
    }

    const data = await response.json()

    // Navigate through the response structure
    const pages = data.query?.pages
    if (!pages) {
      console.warn('  No pages found in API response')
      return null
    }

    // Get the first page (should be the only one)
    const page = Object.values(pages)[0]
    if (page.missing || !page.imageinfo || page.imageinfo.length === 0) {
      console.warn(`  Image not found: ${fileName}`)
      return null
    }

    const directUrl = page.imageinfo[0].url
    if (!directUrl) {
      console.warn('  No URL in imageinfo')
      return null
    }

    return directUrl
  } catch (e) {
    console.error(`  Error fetching image URL for ${characterName}:`, e.message)
    return null
  }
}

// Download image and convert to base64
async function fetchImageAsBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.warn(`  Failed to download image: ${response.status}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return base64
  } catch (e) {
    console.error('  Error downloading image:', e.message)
    return null
  }
}

async function fetchWikiContent(characterName) {
  const wikiSearchName = getWikiPageName(characterName)
  const wikiName = wikiSearchName.replace(/ /g, '_')
  const pageName = wikiName + '/Story'
  const url = `${WIKI_PROXY_URL}?page=${encodeURIComponent(pageName)}`

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.error) {
      console.warn(`  Wiki page not found for ${characterName}:`, data.error)
      return null
    }

    const wikitext = data.parse?.wikitext?.['*']
    if (!wikitext) {
      console.warn(`  No content found for ${characterName}`)
      return null
    }

    return cleanWikiContent(wikitext)
  } catch (e) {
    console.error(`  Error fetching wiki for ${characterName}:`, e.message)
    return null
  }
}

// Check if a field is empty (for skip logic)
function isFieldEmpty(value) {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (typeof value === 'object' && Object.keys(value).length === 0) return true
  return false
}

// Check if character has a Commander/Protagonist relationship key
function hasCommanderRelationship(profile) {
  if (!profile.relationships || typeof profile.relationships !== 'object') return false
  return Object.keys(profile.relationships).some((key) => key.includes('Commander') || key.includes('Protagonist'))
}

// Check if character should be skipped (variants mode checks all fields)
function shouldSkipCharacter(profile) {
  if (MODE === 'base') {
    // Base mode: skip only if backstory exists
    return 'backstory' in profile
  } else if (MODE === 'variants') {
    // Variants mode: skip only if ALL fields exist and are non-empty
    const hasBackstory = 'backstory' in profile && !isFieldEmpty(profile.backstory)
    const hasPersonality = 'personality' in profile && !isFieldEmpty(profile.personality)
    const hasSpeechStyle = 'speech_style' in profile && !isFieldEmpty(profile.speech_style)
    const hasRelationships = 'relationships' in profile && !isFieldEmpty(profile.relationships)

    return hasBackstory && hasPersonality && hasSpeechStyle && hasRelationships
  } else if (MODE === 'visual') {
    // Visual mode: skip only if appearance or defaultSkin are filled (ignore defaultWeapon)
    const hasAppearance = 'appearance' in profile && !isFieldEmpty(profile.appearance)
    const hasDefaultSkin = 'defaultSkin' in profile && !isFieldEmpty(profile.defaultSkin)

    return hasAppearance || hasDefaultSkin
  }
}

// Call Gemini API to extract data
async function extractDataGemini(characterName, wikiContent, imageUrl = null, modeOverride = null, extraContext = null) {
  const effectiveMode = modeOverride || MODE
  let prompt
  let parts

  if (effectiveMode === 'visual' && imageUrl) {
    // Visual mode: download image and use base64 inline data
    console.log('  Downloading image...')
    const base64Image = await fetchImageAsBase64(imageUrl)

    if (!base64Image) {
      console.error(`  Failed to download image for ${characterName}`)
      return null
    }

    console.log(`  Image downloaded (${Math.round(base64Image.length / 1024)}KB)`)

    prompt = VISUAL_PROMPT
    parts = [
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64Image
        }
      },
      { text: prompt }
    ]
  } else {
    // Text mode: use appropriate prompt
    let promptTemplate
    if (effectiveMode === 'base') {
      promptTemplate = BASE_PROMPT
    } else if (effectiveMode === 'commander') {
      promptTemplate = COMMANDER_RELATIONSHIP_PROMPT
    } else if (effectiveMode === 'update') {
      promptTemplate = UPDATE_BACKSTORY_PROMPT
    } else {
      promptTemplate = VARIANTS_PROMPT
    }
    prompt = promptTemplate.replace('{name}', characterName).replace('{content}', wikiContent)
    if (effectiveMode === 'update' && extraContext?.existingBackstory) {
      prompt = prompt.replace('{existing_backstory}', extraContext.existingBackstory)
    }
    parts = [{ text: prompt }]
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: parts
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096
    }
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    if (!data.candidates || data.candidates.length === 0) {
      const promptFeedback = data.promptFeedback
      if (promptFeedback?.blockReason) {
        console.error(`  Content blocked: ${promptFeedback.blockReason}`)
      }
      throw new Error('No candidates in API response')
    }

    const candidate = data.candidates[0]

    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`  Finish reason: ${candidate.finishReason}`)
    }

    if (candidate.safetyRatings) {
      const blocked = candidate.safetyRatings.filter((r) => r.probability === 'HIGH' || r.probability === 'MEDIUM')
      if (blocked.length > 0) {
        console.warn(`  Safety concerns: ${blocked.map((r) => r.category).join(', ')}`)
      }
    }

    const text = candidate.content?.parts?.[0]?.text

    if (!text) {
      throw new Error('No content in API response parts')
    }

    return parseApiResponse(text, characterName, modeOverride)
  } catch (e) {
    console.error(`  Error extracting data for ${characterName}:`, e.message)
    return null
  }
}

// Call OpenRouter API to extract data
async function extractDataOpenRouter(characterName, wikiContent, imageUrl = null, modeOverride = null, extraContext = null) {
  const effectiveMode = modeOverride || MODE
  let prompt
  let content

  if (effectiveMode === 'visual' && imageUrl) {
    // Visual mode: use vision capabilities
    prompt = VISUAL_PROMPT
    content = [
      {
        type: 'text',
        text: prompt
      },
      {
        type: 'image_url',
        image_url: {
          url: imageUrl
        }
      }
    ]
  } else {
    // Text mode: use appropriate prompt
    let promptTemplate
    if (effectiveMode === 'base') {
      promptTemplate = BASE_PROMPT
    } else if (effectiveMode === 'commander') {
      promptTemplate = COMMANDER_RELATIONSHIP_PROMPT
    } else if (effectiveMode === 'update') {
      promptTemplate = UPDATE_BACKSTORY_PROMPT
    } else {
      promptTemplate = VARIANTS_PROMPT
    }
    prompt = promptTemplate.replace('{name}', characterName).replace('{content}', wikiContent)
    if (effectiveMode === 'update' && extraContext?.existingBackstory) {
      prompt = prompt.replace('{existing_backstory}', extraContext.existingBackstory)
    }
    content = prompt
  }

  const requestBody = {
    model: OPENROUTER_MODEL,
    messages: [
      {
        role: 'user',
        content: content
      }
    ],
    temperature: 0.3,
    max_tokens: 4096
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/nikke-db-story-gen',
        'X-Title': 'NIKKE Story Generator'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    const text = data.choices?.[0]?.message?.content

    if (!text) {
      throw new Error('No content in API response')
    }

    return parseApiResponse(text, characterName, modeOverride)
  } catch (e) {
    console.error(`  Error extracting data for ${characterName}:`, e.message)
    return null
  }
}

// Parse API response and extract fields
function parseApiResponse(text, characterName, modeOverride = null) {
  const effectiveMode = modeOverride || MODE
  // Extract JSON from response
  let jsonStr = text.replace(/```json\n?|\n?```/g, '').trim()
  const start = jsonStr.indexOf('{')
  const end = jsonStr.lastIndexOf('}')

  if (start !== -1 && end !== -1) {
    jsonStr = jsonStr.substring(start, end + 1)
  }

  try {
    const result = JSON.parse(jsonStr)

    if (effectiveMode === 'base') {
      // Base mode: only return backstory
      if (result.backstory && result.backstory !== 'Failed to extract backstory') {
        return { backstory: result.backstory }
      }
    } else if (effectiveMode === 'variants' || effectiveMode === 'create') {
      // Variants/create mode: return all fields
      const data = {}

      if (result.personality && result.personality.trim() !== '' && result.personality !== 'Failed to extract personality') {
        data.personality = result.personality
      }
      if (result.speech_style && result.speech_style.trim() !== '' && result.speech_style !== 'Failed to extract speech style') {
        data.speech_style = result.speech_style
      }
      if (result.backstory && result.backstory.trim() !== '' && result.backstory !== 'Failed to extract backstory') {
        data.backstory = result.backstory
      }
      if (result.relationships && typeof result.relationships === 'object' && Object.keys(result.relationships).length > 0) {
        data.relationships = result.relationships
      }

      if (Object.keys(data).length > 0) {
        return data
      }
    } else if (effectiveMode === 'visual') {
      // Visual mode: return appearance, defaultSkin, defaultWeapon
      const data = {}

      if (result.appearance && result.appearance.trim() !== '' && result.appearance !== 'Failed to extract appearance') {
        data.appearance = result.appearance
      }
      if (result.defaultSkin && result.defaultSkin.trim() !== '' && result.defaultSkin !== 'Failed to extract defaultSkin') {
        data.defaultSkin = result.defaultSkin
      }
      if (result.defaultWeapon && result.defaultWeapon.trim() !== '' && result.defaultWeapon !== 'Failed to extract defaultWeapon') {
        data.defaultWeapon = result.defaultWeapon
      }

      if (Object.keys(data).length > 0) {
        return data
      }
    } else if (effectiveMode === 'commander') {
      // Commander mode: return relationship with fixed key
      if (result.relationship && result.relationship.trim() !== '') {
        return { commanderRelationship: result.relationship }
      }
    } else if (effectiveMode === 'update') {
      // Update mode: return backstory with change metadata
      if (result.backstory && result.backstory.trim() !== '') {
        return {
          backstory: result.backstory,
          changed: result.changed !== false, // default to true if missing
          changes_summary: result.changes_summary || 'No summary provided.'
        }
      }
    }

    return null
  } catch (parseError) {
    console.log('  JSON parse failed, trying regex extraction...')

    if (effectiveMode === 'base') {
      // Try to extract backstory with regex
      const backstoryMatch = jsonStr.match(/"backstory"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (backstoryMatch) {
        const extracted = backstoryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
        if (extracted && extracted.length > 10) {
          console.log('  ✓ Extracted backstory using regex fallback')
          return { backstory: extracted }
        }
      }
    } else if (effectiveMode === 'variants' || effectiveMode === 'create') {
      // Variants/create mode: try to extract all fields with regex
      const data = {}

      const personalityMatch = jsonStr.match(/"personality"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (personalityMatch) {
        data.personality = personalityMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
      }

      const speechStyleMatch = jsonStr.match(/"speech_style"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (speechStyleMatch) {
        data.speech_style = speechStyleMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
      }

      const backstoryMatch = jsonStr.match(/"backstory"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (backstoryMatch) {
        data.backstory = backstoryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
      }

      // Try to extract relationships object
      const relationshipsMatch = jsonStr.match(/"relationships"\s*:\s*\{([^}]*)\}/)
      if (relationshipsMatch) {
        try {
          const relStr = `{${relationshipsMatch[1]}}`
          data.relationships = JSON.parse(relStr)
        } catch (e) {
          // If parsing fails, skip relationships
        }
      }

      if (Object.keys(data).length > 0) {
        console.log('  ✓ Extracted data using regex fallback')
        return data
      }
    } else if (effectiveMode === 'visual') {
      // Visual mode: try to extract appearance, defaultSkin, defaultWeapon with regex
      const data = {}

      const appearanceMatch = jsonStr.match(/"appearance"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (appearanceMatch) {
        data.appearance = appearanceMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
      }

      const defaultSkinMatch = jsonStr.match(/"defaultSkin"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (defaultSkinMatch) {
        data.defaultSkin = defaultSkinMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
      }

      const defaultWeaponMatch = jsonStr.match(/"defaultWeapon"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (defaultWeaponMatch) {
        data.defaultWeapon = defaultWeaponMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
      }

      if (Object.keys(data).length > 0) {
        console.log('  ✓ Extracted data using regex fallback')
        return data
      }
    } else if (effectiveMode === 'commander') {
      // Commander mode: try to extract relationship with regex
      const relationshipMatch = jsonStr.match(/"relationship"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (relationshipMatch) {
        const extracted = relationshipMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
        if (extracted && extracted.trim() !== '') {
          console.log('  ✓ Extracted Commander relationship using regex fallback')
          return { commanderRelationship: extracted }
        }
      }
    } else if (effectiveMode === 'update') {
      // Update mode: try to extract backstory and changed flag with regex
      const backstoryMatch = jsonStr.match(/"backstory"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (backstoryMatch) {
        const extracted = backstoryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
        if (extracted && extracted.length > 10) {
          const changedMatch = jsonStr.match(/"changed"\s*:\s*(true|false)/)
          const summaryMatch = jsonStr.match(/"changes_summary"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
          console.log('  ✓ Extracted update data using regex fallback')
          return {
            backstory: extracted,
            changed: changedMatch ? changedMatch[1] === 'true' : true,
            changes_summary: summaryMatch ? summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '') : 'No summary provided.'
          }
        }
      }
    }

    console.error(`  Error extracting data for ${characterName}:`, parseError.message)
    return null
  }
}

// Select mode (base, variants, visual, create, commander, or update)
async function selectMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  console.log('\nWhich character profiles would you like to update?')
  console.log('1) Base characters - backstory only (characterProfiles.json)')
  console.log('2) Variant characters - full profile (characterProfilesVariants.json)')
  console.log('3) Visual analysis - appearance, clothing, weapon (both files)')
  console.log('4) Create new character entry - all fields for a single character')
  console.log('5) Fill missing Commander relationships (both files)')
  console.log('6) Update characters\' backstories - compare & merge with wiki (both files)')

  const answer = await new Promise((resolve) => {
    rl.question('\nEnter choice (1, 2, 3, 4, 5, or 6): ', (input) => {
      resolve(input.trim())
    })
  })

  rl.close()

  if (answer === '2') {
    MODE = 'variants'
    PROFILES_PATH = PROFILES_VARIANTS_PATH
    console.log('Selected: Variant characters\n')
  } else if (answer === '3') {
    MODE = 'visual'
    PROFILES_PATH = PROFILES_BASE_PATH // Visual mode processes both files
    console.log('Selected: Visual analysis\n')
  } else if (answer === '4') {
    MODE = 'create'
    console.log('Selected: Create new character entry\n')
  } else if (answer === '5') {
    MODE = 'commander'
    console.log('Selected: Fill missing Commander relationships\n')
  } else if (answer === '6') {
    MODE = 'update'
    console.log('Selected: Update characters\' backstories\n')
  } else {
    MODE = 'base'
    PROFILES_PATH = PROFILES_BASE_PATH
    console.log('Selected: Base characters\n')
  }
}

// Prompt for new character name and target file (create mode only)
async function selectNewCharacter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const charName = await new Promise((resolve) => {
    rl.question('Enter the character name to create (e.g. "Eunhwa: Tactical Upgrade"): ', (input) => {
      resolve(input.trim())
    })
  })

  if (!charName) {
    rl.close()
    console.error('Error: No character name provided.')
    process.exit(1)
  }

  console.log('')
  console.log('Which file should this entry be saved to?')
  console.log('1) characterProfiles.json (base characters)')
  console.log('2) characterProfilesVariants.json (variant characters)')

  const fileChoice = await new Promise((resolve) => {
    rl.question('\nEnter choice (1 or 2): ', (input) => {
      resolve(input.trim())
    })
  })

  rl.close()

  CREATE_CHAR_NAME = charName
  if (fileChoice === '2') {
    CREATE_PROFILES_PATH = PROFILES_VARIANTS_PATH
    console.log(`\nWill create "${charName}" in characterProfilesVariants.json\n`)
  } else {
    CREATE_PROFILES_PATH = PROFILES_BASE_PATH
    console.log(`\nWill create "${charName}" in characterProfiles.json\n`)
  }
}

// Prompt for update target: single character or all characters (update mode only)
async function selectUpdateTarget() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  console.log('How would you like to update backstories?')
  console.log('1) Update a single character (type exact name)')
  console.log('2) Update all characters in both JSON files')

  const scopeChoice = await new Promise((resolve) => {
    rl.question('\nEnter choice (1 or 2): ', (input) => {
      resolve(input.trim())
    })
  })

  if (scopeChoice === '1') {
    UPDATE_SCOPE = 'single'

    const charName = await new Promise((resolve) => {
      rl.question('\nEnter the exact character name (e.g. "Rapi" or "Anis: Sparkling Summer"): ', (input) => {
        resolve(input.trim())
      })
    })

    rl.close()

    if (!charName) {
      console.error('Error: No character name provided.')
      process.exit(1)
    }

    // Validate the character exists in one of the two JSON files
    let foundInBase = false
    let foundInVariants = false

    try {
      const baseData = JSON.parse(fs.readFileSync(PROFILES_BASE_PATH, 'utf8'))
      foundInBase = charName in baseData
    } catch (e) {
      // ignore
    }

    try {
      const variantsData = JSON.parse(fs.readFileSync(PROFILES_VARIANTS_PATH, 'utf8'))
      foundInVariants = charName in variantsData
    } catch (e) {
      // ignore
    }

    if (!foundInBase && !foundInVariants) {
      console.error(`\nError: "${charName}" was not found in either characterProfiles.json or characterProfilesVariants.json.`)
      console.error('Please check the spelling and try again.')
      process.exit(1)
    }

    UPDATE_CHAR_NAME = charName
    const fileLabel = foundInBase ? 'characterProfiles.json' : 'characterProfilesVariants.json'
    console.log(`\nWill update backstory for "${charName}" (found in ${fileLabel})\n`)
  } else {
    UPDATE_SCOPE = 'all'
    rl.close()
    console.log('\nWill update backstories for all characters in both JSON files\n')
  }
}

// Select API provider
async function selectProvider() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  // If only one key is available, use it automatically
  if (GEMINI_API_KEY && !OPENROUTER_API_KEY) {
    console.log('Using Gemini API (only GEMINI_API_KEY found)')
    API_PROVIDER = 'gemini'
    rl.close()
    return
  }

  if (!GEMINI_API_KEY && OPENROUTER_API_KEY) {
    console.log('Using OpenRouter API (only OPENROUTER_API_KEY found)')
    API_PROVIDER = 'openrouter'
    rl.close()
    return
  }

  // Both keys available - ask user
  console.log('\nMultiple API keys found. Which provider would you like to use?')
  console.log('1) Gemini (Google)')
  console.log('2) OpenRouter (x-ai/grok-4.1-fast)')

  const answer = await new Promise((resolve) => {
    rl.question('\nEnter choice (1 or 2): ', (input) => {
      resolve(input.trim())
    })
  })

  rl.close()

  if (answer === '2') {
    API_PROVIDER = 'openrouter'
    console.log('Selected: OpenRouter\n')
  } else {
    API_PROVIDER = 'gemini'
    console.log('Selected: Gemini\n')
  }
}

// Route to appropriate extraction function
async function extractData(characterName, wikiContent, imageUrl = null, modeOverride = null, extraContext = null) {
  if (API_PROVIDER === 'openrouter') {
    return extractDataOpenRouter(characterName, wikiContent, imageUrl, modeOverride, extraContext)
  }
  return extractDataGemini(characterName, wikiContent, imageUrl, modeOverride, extraContext)
}

// Apply extracted data to profile
function applyData(profile, data) {
  if (!data) return false

  let updated = false

  if (MODE === 'visual') {
    // Visual mode: update appearance, defaultSkin, defaultWeapon
    if (data.appearance && isFieldEmpty(profile.appearance)) {
      profile.appearance = data.appearance
      updated = true
    }

    if (data.defaultSkin && isFieldEmpty(profile.defaultSkin)) {
      profile.defaultSkin = data.defaultSkin
      updated = true
    }

    if (data.defaultWeapon && isFieldEmpty(profile.defaultWeapon)) {
      profile.defaultWeapon = data.defaultWeapon
      updated = true
    }
  } else {
    // Text modes: update backstory and other text fields
    if (data.backstory && isFieldEmpty(profile.backstory)) {
      profile.backstory = data.backstory
      updated = true
    }

    if (MODE === 'variants') {
      if (data.personality && isFieldEmpty(profile.personality)) {
        profile.personality = data.personality
        updated = true
      }

      if (data.speech_style && isFieldEmpty(profile.speech_style)) {
        profile.speech_style = data.speech_style
        updated = true
      }

      if (data.relationships && isFieldEmpty(profile.relationships)) {
        profile.relationships = data.relationships
        updated = true
      }
    }
  }

  return updated
}

async function createNewEntry() {
  const charName = CREATE_CHAR_NAME
  const filePath = CREATE_PROFILES_PATH
  const fileLabel = filePath === PROFILES_BASE_PATH ? 'characterProfiles.json' : 'characterProfilesVariants.json'

  console.log(`\nCreating new entry for: ${charName}`)
  console.log(`Target file: ${fileLabel}`)
  console.log('-'.repeat(60))

  // Load profiles file
  let profiles
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    profiles = JSON.parse(data)
  } catch (e) {
    console.error(`Error loading ${fileLabel}:`, e.message)
    return
  }

  // Check for duplicate
  if (charName in profiles) {
    console.warn(`\nWarning: "${charName}" already exists in ${fileLabel}.`)

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const answer = await new Promise((resolve) => {
      rl.question('Overwrite the existing entry? (y/N): ', (input) => {
        resolve(input.trim().toLowerCase())
      })
    })

    rl.close()

    if (answer !== 'y' && answer !== 'yes') {
      console.log('Aborted. No changes made.')
      return
    }

    console.log('Proceeding to overwrite...\n')
  }

  // --- Text pass (variants prompt: personality, speech_style, backstory, relationships) ---
  console.log('  Fetching wiki content...')
  const wikiContent = await fetchWikiContent(charName)

  let textData = null
  if (!wikiContent) {
    console.log('  ✗ No wiki content found. Text fields will be empty.')
  } else {
    console.log(`  Wiki content: ${wikiContent.length} chars`)
    console.log(`  Extracting personality, speech_style, backstory, relationships with ${API_PROVIDER}...`)
    textData = await extractData(charName, wikiContent, null, 'variants')
    if (textData) {
      const fields = Object.keys(textData).join(', ')
      console.log(`  ✓ Text data extracted (${fields})`)
    } else {
      console.log('  ✗ Text extraction failed. Text fields will be empty.')
    }
  }

  // --- Visual pass (appearance, defaultSkin, defaultWeapon) ---
  console.log('  Fetching image URL...')
  const imageUrl = await fetchImageUrl(charName)

  let visualData = null
  if (!imageUrl) {
    console.log('  ✗ No image URL found. Visual fields will be empty.')
  } else {
    console.log(`  Image URL: ${imageUrl}`)
    console.log(`  Extracting appearance, defaultSkin, defaultWeapon with ${API_PROVIDER}...`)
    visualData = await extractData(charName, null, imageUrl, 'visual')
    if (visualData) {
      const fields = Object.keys(visualData).join(', ')
      console.log(`  ✓ Visual data extracted (${fields})`)
    } else {
      console.log('  ✗ Visual extraction failed. Visual fields will be empty.')
    }
  }

  // --- Build new profile entry ---
  const newProfile = {
    appearance: visualData?.appearance || '',
    defaultSkin: visualData?.defaultSkin || '',
    defaultWeapon: visualData?.defaultWeapon || '',
    personality: textData?.personality || '',
    speech_style: textData?.speech_style || '',
    backstory: textData?.backstory || '',
    relationships: textData?.relationships || {}
  }

  // Preserve any existing non-extracted fields (e.g. id, color) if overwriting
  if (charName in profiles) {
    const existing = profiles[charName]
    if (existing.id) newProfile.id = existing.id
    if (existing.color) newProfile.color = existing.color
  }

  profiles[charName] = newProfile

  // Save
  fs.writeFileSync(filePath, JSON.stringify(profiles, null, 2))
  console.log(`\n  ✓ Entry saved to ${fileLabel}`)
  console.log('')
  console.log('='.repeat(60))
  console.log(`Created: ${charName}`)
  Object.entries(newProfile).forEach(([k, v]) => {
    const display = typeof v === 'object' ? JSON.stringify(v) : v
    console.log(`  ${k}: ${display ? display.substring(0, 80) : '(empty)'}${display && display.length > 80 ? '...' : ''}`)
  })
  console.log('='.repeat(60))
}

async function processProfilesFile(filePath, fileLabel) {
  console.log(`\nProcessing ${fileLabel}...`)
  console.log('-'.repeat(60))

  // Load character profiles
  let profiles
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    profiles = JSON.parse(data)
  } catch (e) {
    console.error(`Error loading ${fileLabel}:`, e.message)
    return { successCount: 0, failCount: 0, skippedCount: 0, total: 0 }
  }

  const characters = Object.keys(profiles)
  const total = characters.length

  console.log(`Found ${total} characters to process`)
  console.log('')

  // Statistics
  let successCount = 0
  let failCount = 0
  let skippedCount = 0

  // Process each character
  for (let i = 0; i < characters.length; i++) {
    const charName = characters[i]
    const profile = profiles[charName]

    console.log(`[${i + 1}/${total}] Processing: ${charName}`)

    // Skip if already has required data
    if (SKIP_EXISTING && shouldSkipCharacter(profile)) {
      if (MODE === 'base') {
        console.log('  ✓ Already has backstory key, skipping (use --no-skip-existing to override)')
      } else if (MODE === 'visual') {
        console.log('  ✓ All visual fields already populated, skipping (use --no-skip-existing to override)')
      } else {
        console.log('  ✓ All fields already populated, skipping (use --no-skip-existing to override)')
      }
      skippedCount++
      continue
    }

    let wikiContent = null
    let imageUrl = null

    if (MODE === 'visual') {
      // Visual mode: fetch direct image URL from wiki API
      console.log('  Fetching image URL...')
      imageUrl = await fetchImageUrl(charName)

      if (!imageUrl) {
        console.log('  ✗ No image URL available, skipping character')
        failCount++
        continue
      }

      console.log(`  Image URL: ${imageUrl}`)
    } else {
      // Text modes: fetch wiki content
      console.log('  Fetching wiki content...')
      wikiContent = await fetchWikiContent(charName)

      if (!wikiContent) {
        console.log('  ✗ No wiki content available, skipping character')
        failCount++
        continue
      }

      console.log(`  Wiki content: ${wikiContent.length} chars`)
    }

    // Extract data using selected provider
    let extractFields
    if (MODE === 'base') {
      extractFields = 'backstory'
    } else if (MODE === 'visual') {
      extractFields = 'appearance, defaultSkin, defaultWeapon'
    } else {
      extractFields = 'personality, speech_style, backstory, relationships'
    }
    console.log(`  Extracting ${extractFields} with ${API_PROVIDER}...`)
    const data = await extractData(charName, wikiContent, imageUrl)

    if (data && applyData(profile, data)) {
      const updatedFields = []
      if (MODE === 'visual') {
        if (data.appearance) updatedFields.push('appearance')
        if (data.defaultSkin) updatedFields.push('defaultSkin')
        if (data.defaultWeapon) updatedFields.push('defaultWeapon')
      } else {
        if (data.backstory) updatedFields.push('backstory')
        if (data.personality) updatedFields.push('personality')
        if (data.speech_style) updatedFields.push('speech_style')
        if (data.relationships) updatedFields.push('relationships')
      }

      console.log(`  ✓ Data extracted and applied (${updatedFields.join(', ')})`)
      successCount++

      // Save immediately after successful processing
      console.log('  Saving character profile...')
      fs.writeFileSync(filePath, JSON.stringify(profiles, null, 2))
    } else if (data) {
      console.log('  ✓ No new fields to update (all required fields already populated)')
      skippedCount++
    } else {
      console.log('  ✗ Failed to extract data, skipping save')
      failCount++
    }

    // Rate limiting
    if (i < characters.length - 1) {
      process.stdout.write(`  Waiting ${RATE_LIMIT_MS}ms...`)
      await delay(RATE_LIMIT_MS)
      console.log(' done')
    }

    console.log('')
  }

  // Summary
  console.log('')
  console.log('='.repeat(60))
  console.log('Update Complete!')
  console.log('='.repeat(60))
  console.log(`Total characters: ${total}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Skipped (already had data): ${skippedCount}`)
  console.log('')

  return { successCount, failCount, skippedCount, total }
}

async function processCommanderRelationships() {
  const COMMANDER_KEY = 'Commander (Protagonist)'

  const filesToProcess = [
    { path: PROFILES_BASE_PATH, label: 'Base Characters', nameMode: 'base' },
    { path: PROFILES_VARIANTS_PATH, label: 'Variant Characters', nameMode: 'variants' }
  ]

  let totalStats = { successCount: 0, failCount: 0, skippedCount: 0, total: 0 }

  for (const fileInfo of filesToProcess) {
    console.log(`\nProcessing ${fileInfo.label}...`)
    console.log('-'.repeat(60))

    let profiles
    try {
      const data = fs.readFileSync(fileInfo.path, 'utf8')
      profiles = JSON.parse(data)
    } catch (e) {
      console.error(`Error loading ${fileInfo.label}:`, e.message)
      continue
    }

    const characters = Object.keys(profiles)
    const total = characters.length
    totalStats.total += total

    console.log(`Found ${total} characters to scan`)
    console.log('')

    let successCount = 0
    let failCount = 0
    let skippedCount = 0

    for (let i = 0; i < characters.length; i++) {
      const charName = characters[i]
      const profile = profiles[charName]

      console.log(`[${i + 1}/${total}] Scanning: ${charName}`)

      // Check if Commander/Protagonist relationship already exists
      if (hasCommanderRelationship(profile)) {
        const matchingKey = Object.keys(profile.relationships).find((key) => key.includes('Commander') || key.includes('Protagonist'))
        console.log(`  ✓ Already has "${matchingKey}" relationship, skipping`)
        skippedCount++
        continue
      }

      // Fetch wiki content using the appropriate name mode
      // Temporarily set MODE for getWikiPageName() resolution
      const savedMode = MODE
      MODE = fileInfo.nameMode
      console.log('  Fetching wiki content...')
      const wikiContent = await fetchWikiContent(charName)
      MODE = savedMode

      if (!wikiContent) {
        console.log('  ✗ No wiki content available, skipping character')
        failCount++
        continue
      }

      console.log(`  Wiki content: ${wikiContent.length} chars`)
      console.log(`  Extracting Commander relationship with ${API_PROVIDER}...`)

      const data = await extractData(charName, wikiContent, null, 'commander')

      if (data && data.commanderRelationship) {
        // Ensure the relationships object exists
        if (!profile.relationships || typeof profile.relationships !== 'object') {
          profile.relationships = {}
        }

        profile.relationships[COMMANDER_KEY] = data.commanderRelationship
        console.log(`  ✓ Added "${COMMANDER_KEY}" relationship`)
        successCount++

        // Save immediately after successful update
        console.log('  Saving character profile...')
        fs.writeFileSync(fileInfo.path, JSON.stringify(profiles, null, 2))
      } else {
        console.log('  ✗ Failed to extract Commander relationship')
        failCount++
      }

      // Rate limiting
      if (i < characters.length - 1) {
        process.stdout.write(`  Waiting ${RATE_LIMIT_MS}ms...`)
        await delay(RATE_LIMIT_MS)
        console.log(' done')
      }

      console.log('')
    }

    totalStats.successCount += successCount
    totalStats.failCount += failCount
    totalStats.skippedCount += skippedCount

    console.log('')
    console.log(`${fileInfo.label} summary:`)
    console.log(`  Total: ${total} | Added: ${successCount} | Failed: ${failCount} | Skipped: ${skippedCount}`)
  }

  return totalStats
}

async function processBackstoryUpdates() {
  const filesToProcess = []

  if (UPDATE_SCOPE === 'single') {
    // Single character: find which file it's in
    try {
      const baseData = JSON.parse(fs.readFileSync(PROFILES_BASE_PATH, 'utf8'))
      if (UPDATE_CHAR_NAME in baseData) {
        filesToProcess.push({ path: PROFILES_BASE_PATH, label: 'Base Characters', nameMode: 'base', characters: [UPDATE_CHAR_NAME] })
      }
    } catch (e) {
      // ignore
    }

    try {
      const variantsData = JSON.parse(fs.readFileSync(PROFILES_VARIANTS_PATH, 'utf8'))
      if (UPDATE_CHAR_NAME in variantsData) {
        filesToProcess.push({ path: PROFILES_VARIANTS_PATH, label: 'Variant Characters', nameMode: 'variants', characters: [UPDATE_CHAR_NAME] })
      }
    } catch (e) {
      // ignore
    }
  } else {
    // All characters: process both files
    filesToProcess.push({ path: PROFILES_BASE_PATH, label: 'Base Characters', nameMode: 'base', characters: null })
    filesToProcess.push({ path: PROFILES_VARIANTS_PATH, label: 'Variant Characters', nameMode: 'variants', characters: null })
  }

  let totalStats = { successCount: 0, failCount: 0, skippedCount: 0, unchangedCount: 0, generatedCount: 0, total: 0 }

  for (const fileInfo of filesToProcess) {
    console.log(`\nProcessing ${fileInfo.label}...`)
    console.log('-'.repeat(60))

    let profiles
    try {
      const data = fs.readFileSync(fileInfo.path, 'utf8')
      profiles = JSON.parse(data)
    } catch (e) {
      console.error(`Error loading ${fileInfo.label}:`, e.message)
      continue
    }

    const characters = fileInfo.characters || Object.keys(profiles)
    const total = characters.length
    totalStats.total += total

    console.log(`Found ${total} characters to process`)
    console.log('')

    let successCount = 0
    let failCount = 0
    let skippedCount = 0
    let unchangedCount = 0
    let generatedCount = 0

    for (let i = 0; i < characters.length; i++) {
      const charName = characters[i]
      const profile = profiles[charName]

      if (!profile) {
        console.log(`[${i + 1}/${total}] Character not found: ${charName}`)
        failCount++
        continue
      }

      console.log(`[${i + 1}/${total}] Processing: ${charName}`)

      const existingBackstory = profile.backstory
      const hasExistingBackstory = existingBackstory && typeof existingBackstory === 'string' && existingBackstory.trim() !== ''

      // Temporarily set MODE for correct wiki name resolution
      const savedMode = MODE
      MODE = fileInfo.nameMode
      console.log('  Fetching wiki content...')
      const wikiContent = await fetchWikiContent(charName)
      MODE = savedMode

      if (!wikiContent) {
        console.log('  ✗ No wiki content available, skipping character')
        failCount++
        continue
      }

      console.log(`  Wiki content: ${wikiContent.length} chars`)

      let data
      if (hasExistingBackstory) {
        // Has existing backstory: use update mode to compare and merge
        console.log(`  Existing backstory: ${existingBackstory.length} chars`)
        console.log(`  Comparing & merging with ${API_PROVIDER}...`)
        data = await extractData(charName, wikiContent, null, 'update', { existingBackstory })
      } else {
        // No existing backstory: generate from scratch using base prompt
        console.log('  No existing backstory found, generating from scratch...')
        console.log(`  Extracting backstory with ${API_PROVIDER}...`)
        data = await extractData(charName, wikiContent, null, 'base')
      }

      if (!data) {
        console.log('  ✗ Failed to extract data')
        failCount++
      } else if (hasExistingBackstory) {
        // Update mode result
        if (!data.changed) {
          console.log('  ✓ No notable changes needed')
          console.log(`    Summary: ${data.changes_summary}`)
          unchangedCount++
        } else {
          console.log('  ✓ Changes detected!')
          console.log(`    Summary: ${data.changes_summary}`)

          let shouldSave = true

          if (!SKIP_PREVIEW) {
            // Show preview and ask for confirmation
            console.log('')
            console.log('  --- EXISTING BACKSTORY ---')
            console.log(`  ${existingBackstory}`)
            console.log('')
            console.log('  --- UPDATED BACKSTORY (new parts in green) ---')
            console.log(`  ${highlightDiff(existingBackstory, data.backstory)}`)
            console.log('')

            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            })

            const answer = await new Promise((resolve) => {
              rl.question('  Apply this update? (y/N): ', (input) => {
                resolve(input.trim().toLowerCase())
              })
            })

            rl.close()

            shouldSave = answer === 'y' || answer === 'yes'
          }

          if (shouldSave) {
            profile.backstory = data.backstory
            console.log('  Saving updated backstory...')
            fs.writeFileSync(fileInfo.path, JSON.stringify(profiles, null, 2))
            console.log('  ✓ Backstory updated and saved')
            successCount++
          } else {
            console.log('  ✗ Update rejected by user')
            skippedCount++
          }
        }
      } else {
        // Generated from scratch
        if (data.backstory) {
          profile.backstory = data.backstory
          console.log('  ✓ Backstory generated from scratch')

          let shouldSave = true

          if (!SKIP_PREVIEW) {
            console.log('')
            console.log('  --- GENERATED BACKSTORY ---')
            console.log(`  ${data.backstory}`)
            console.log('')

            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            })

            const answer = await new Promise((resolve) => {
              rl.question('  Save this backstory? (y/N): ', (input) => {
                resolve(input.trim().toLowerCase())
              })
            })

            rl.close()

            shouldSave = answer === 'y' || answer === 'yes'
          }

          if (shouldSave) {
            console.log('  Saving generated backstory...')
            fs.writeFileSync(fileInfo.path, JSON.stringify(profiles, null, 2))
            console.log('  ✓ Backstory saved')
            generatedCount++
          } else {
            console.log('  ✗ Generation rejected by user')
            // Revert the in-memory change
            profile.backstory = existingBackstory || ''
            skippedCount++
          }
        } else {
          console.log('  ✗ Failed to generate backstory')
          failCount++
        }
      }

      // Rate limiting
      if (i < characters.length - 1) {
        process.stdout.write(`  Waiting ${RATE_LIMIT_MS}ms...`)
        await delay(RATE_LIMIT_MS)
        console.log(' done')
      }

      console.log('')
    }

    totalStats.successCount += successCount
    totalStats.failCount += failCount
    totalStats.skippedCount += skippedCount
    totalStats.unchangedCount += unchangedCount
    totalStats.generatedCount += generatedCount

    console.log('')
    console.log(`${fileInfo.label} summary:`)
    console.log(`  Total: ${total} | Updated: ${successCount} | Generated: ${generatedCount} | Unchanged: ${unchangedCount} | Failed: ${failCount} | Skipped: ${skippedCount}`)
  }

  return totalStats
}

async function main() {
  await selectMode()

  // Create mode: gather character name and target file before selecting provider
  if (MODE === 'create') {
    await selectNewCharacter()
  }

  // Update mode: gather target scope before selecting provider
  if (MODE === 'update') {
    await selectUpdateTarget()
  }

  await selectProvider()

  console.log('='.repeat(60))
  console.log('Character Backstory Update Script')
  console.log('='.repeat(60))

  let modeLabel
  if (MODE === 'base') {
    modeLabel = 'Base Characters'
  } else if (MODE === 'visual') {
    modeLabel = 'Visual Analysis'
  } else if (MODE === 'create') {
    modeLabel = `Create New Entry: ${CREATE_CHAR_NAME}`
  } else if (MODE === 'commander') {
    modeLabel = 'Fill Missing Commander Relationships'
  } else if (MODE === 'update') {
    modeLabel = UPDATE_SCOPE === 'single' ? `Update Backstory: ${UPDATE_CHAR_NAME}` : 'Update Characters\' Backstories'
  } else {
    modeLabel = 'Variant Characters'
  }

  console.log(`Mode: ${modeLabel}`)
  console.log(`Provider: ${API_PROVIDER}`)
  if (MODE !== 'create' && MODE !== 'commander' && MODE !== 'update') {
    console.log(`Rate limit: ${RATE_LIMIT_MS}ms between calls`)
    console.log(`Skip existing: ${SKIP_EXISTING ? 'yes' : 'no'}`)
  } else if (MODE === 'commander' || MODE === 'update') {
    console.log(`Rate limit: ${RATE_LIMIT_MS}ms between calls`)
    if (MODE === 'update') {
      console.log(`Preview changes: ${SKIP_PREVIEW ? 'no (--skip-preview)' : 'yes'}`)
    }
  }
  console.log('')

  if (MODE === 'create') {
    // Create mode: single character, all fields
    await createNewEntry()
    return
  }

  if (MODE === 'commander') {
    // Commander mode: scan both files and fill missing Commander relationships
    const totalStats = await processCommanderRelationships()

    console.log('')
    console.log('='.repeat(60))
    console.log('Update Complete!')
    console.log('='.repeat(60))
    console.log(`Total characters scanned: ${totalStats.total}`)
    console.log(`Relationships added: ${totalStats.successCount}`)
    console.log(`Failed: ${totalStats.failCount}`)
    console.log(`Skipped (already had Commander relationship): ${totalStats.skippedCount}`)
    console.log('')
    console.log('Results saved to both characterProfiles.json and characterProfilesVariants.json')
    return
  }

  if (MODE === 'update') {
    // Update mode: compare and merge backstories with wiki content
    const totalStats = await processBackstoryUpdates()

    console.log('')
    console.log('='.repeat(60))
    console.log('Update Complete!')
    console.log('='.repeat(60))
    console.log(`Total characters processed: ${totalStats.total}`)
    console.log(`Backstories updated: ${totalStats.successCount}`)
    console.log(`Backstories generated from scratch: ${totalStats.generatedCount}`)
    console.log(`Unchanged (no new info): ${totalStats.unchangedCount}`)
    console.log(`Failed: ${totalStats.failCount}`)
    console.log(`Skipped (rejected by user): ${totalStats.skippedCount}`)
    console.log('')
    console.log('Results saved to characterProfiles.json and/or characterProfilesVariants.json')
    return
  }

  let totalStats = { successCount: 0, failCount: 0, skippedCount: 0, total: 0 }

  if (MODE === 'visual') {
    // Visual mode: process both files
    const baseStats = await processProfilesFile(PROFILES_BASE_PATH, 'Base Characters')
    const variantStats = await processProfilesFile(PROFILES_VARIANTS_PATH, 'Variant Characters')

    totalStats.successCount = baseStats.successCount + variantStats.successCount
    totalStats.failCount = baseStats.failCount + variantStats.failCount
    totalStats.skippedCount = baseStats.skippedCount + variantStats.skippedCount
    totalStats.total = baseStats.total + variantStats.total
  } else {
    // Text modes: process single file
    const stats = await processProfilesFile(PROFILES_PATH, modeLabel)
    totalStats = stats
  }

  // Summary
  console.log('')
  console.log('='.repeat(60))
  console.log('Update Complete!')
  console.log('='.repeat(60))
  console.log(`Total characters: ${totalStats.total}`)
  console.log(`Successful: ${totalStats.successCount}`)
  console.log(`Failed: ${totalStats.failCount}`)
  console.log(`Skipped (already had data): ${totalStats.skippedCount}`)
  console.log('')

  if (MODE === 'visual') {
    console.log('Results saved to both characterProfiles.json and characterProfilesVariants.json')
  } else if (MODE === 'base') {
    console.log('Results saved to characterProfiles.json')
  } else if (MODE === 'variants') {
    console.log('Results saved to characterProfilesVariants.json')
  }
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
