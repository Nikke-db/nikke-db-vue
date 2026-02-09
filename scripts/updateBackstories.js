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
 *
 * Options:
 *   --no-skip-existing    Process characters even if they already have data (default: skip existing)
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

// Mode and paths
let MODE = 'base' // 'base' or 'variants'
let PROFILES_PATH = PROFILES_BASE_PATH

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

// Character name mappings for wiki search (base characters)
const WIKI_NAME_MAPPINGS_BASE = {
  Ada: 'Ada Wong'
}

// Character name mappings for wiki search (variant characters)
// Variants use their full name with underscore format in wiki URLs
const WIKI_NAME_MAPPINGS_VARIANTS = {}

// Utility: Delay function for rate limiting
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
  if (MODE === 'base') {
    const mapped = WIKI_NAME_MAPPINGS_BASE[characterName]
    if (mapped) return mapped
  } else {
    const mapped = WIKI_NAME_MAPPINGS_VARIANTS[characterName]
    if (mapped) return mapped
    // For variants, convert "Name: Variant" to "Name:_Variant" format (keep the colon)
    return characterName.replace(': ', ':_')
  }
  return characterName
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

// Check if character should be skipped (variants mode checks all fields)
function shouldSkipCharacter(profile) {
  if (MODE === 'base') {
    // Base mode: skip only if backstory exists
    return 'backstory' in profile
  } else {
    // Variants mode: skip only if ALL fields exist and are non-empty
    const hasBackstory = 'backstory' in profile && !isFieldEmpty(profile.backstory)
    const hasPersonality = 'personality' in profile && !isFieldEmpty(profile.personality)
    const hasSpeechStyle = 'speech_style' in profile && !isFieldEmpty(profile.speech_style)
    const hasRelationships = 'relationships' in profile && !isFieldEmpty(profile.relationships)

    return hasBackstory && hasPersonality && hasSpeechStyle && hasRelationships
  }
}

// Call Gemini API to extract data
async function extractDataGemini(characterName, wikiContent) {
  const promptTemplate = MODE === 'base' ? BASE_PROMPT : VARIANTS_PROMPT
  const prompt = promptTemplate.replace('{name}', characterName).replace('{content}', wikiContent)

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
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

    return parseApiResponse(text, characterName)
  } catch (e) {
    console.error(`  Error extracting data for ${characterName}:`, e.message)
    return null
  }
}

// Call OpenRouter API to extract data
async function extractDataOpenRouter(characterName, wikiContent) {
  const promptTemplate = MODE === 'base' ? BASE_PROMPT : VARIANTS_PROMPT
  const prompt = promptTemplate.replace('{name}', characterName).replace('{content}', wikiContent)

  const requestBody = {
    model: OPENROUTER_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt
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

    return parseApiResponse(text, characterName)
  } catch (e) {
    console.error(`  Error extracting data for ${characterName}:`, e.message)
    return null
  }
}

// Parse API response and extract fields
function parseApiResponse(text, characterName) {
  // Extract JSON from response
  let jsonStr = text.replace(/```json\n?|\n?```/g, '').trim()
  const start = jsonStr.indexOf('{')
  const end = jsonStr.lastIndexOf('}')

  if (start !== -1 && end !== -1) {
    jsonStr = jsonStr.substring(start, end + 1)
  }

  try {
    const result = JSON.parse(jsonStr)

    if (MODE === 'base') {
      // Base mode: only return backstory
      if (result.backstory && result.backstory !== 'Failed to extract backstory') {
        return { backstory: result.backstory }
      }
    } else {
      // Variants mode: return all fields
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
    }

    return null
  } catch (parseError) {
    console.log(`  JSON parse failed, trying regex extraction...`)

    if (MODE === 'base') {
      // Try to extract backstory with regex
      const backstoryMatch = jsonStr.match(/"backstory"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (backstoryMatch) {
        const extracted = backstoryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
        if (extracted && extracted.length > 10) {
          console.log(`  ✓ Extracted backstory using regex fallback`)
          return { backstory: extracted }
        }
      }
    } else {
      // Variants mode: try to extract all fields with regex
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
        console.log(`  ✓ Extracted data using regex fallback`)
        return data
      }
    }

    console.error(`  Error extracting data for ${characterName}:`, parseError.message)
    return null
  }
}

// Select mode (base or variants)
async function selectMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  console.log('\nWhich character profiles would you like to update?')
  console.log('1) Base characters (characterProfiles.json)')
  console.log('2) Variant characters (characterProfilesVariants.json)')

  const answer = await new Promise((resolve) => {
    rl.question('\nEnter choice (1 or 2): ', (input) => {
      resolve(input.trim())
    })
  })

  rl.close()

  if (answer === '2') {
    MODE = 'variants'
    PROFILES_PATH = PROFILES_VARIANTS_PATH
    console.log('Selected: Variant characters\n')
  } else {
    MODE = 'base'
    PROFILES_PATH = PROFILES_BASE_PATH
    console.log('Selected: Base characters\n')
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
async function extractData(characterName, wikiContent) {
  if (API_PROVIDER === 'openrouter') {
    return extractDataOpenRouter(characterName, wikiContent)
  }
  return extractDataGemini(characterName, wikiContent)
}

// Apply extracted data to profile
function applyData(profile, data) {
  if (!data) return false

  let updated = false

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

  return updated
}

async function main() {
  await selectMode()
  await selectProvider()

  console.log('='.repeat(60))
  console.log('Character Backstory Update Script')
  console.log('='.repeat(60))
  console.log(`Mode: ${MODE === 'base' ? 'Base Characters' : 'Variant Characters'}`)
  console.log(`Provider: ${API_PROVIDER}`)
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between calls`)
  console.log(`Profiles file: ${PROFILES_PATH}`)
  console.log(`Skip existing: ${SKIP_EXISTING ? 'yes' : 'no'}`)
  console.log('')

  // Load character profiles
  console.log('Loading character profiles...')
  let profiles
  try {
    const data = fs.readFileSync(PROFILES_PATH, 'utf8')
    profiles = JSON.parse(data)
  } catch (e) {
    console.error('Error loading profiles file:', e.message)
    process.exit(1)
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
        console.log(`  ✓ Already has backstory key, skipping (use --no-skip-existing to override)`)
      } else {
        console.log(`  ✓ All fields already populated, skipping (use --no-skip-existing to override)`)
      }
      skippedCount++
      continue
    }

    // Fetch wiki content
    console.log(`  Fetching wiki content...`)
    const wikiContent = await fetchWikiContent(charName)

    if (!wikiContent) {
      console.log(`  ✗ No wiki content available, skipping character`)
      failCount++
      continue
    }

    console.log(`  Wiki content: ${wikiContent.length} chars`)

    // Extract data using selected provider
    const extractFields = MODE === 'base' ? 'backstory' : 'personality, speech_style, backstory, relationships'
    console.log(`  Extracting ${extractFields} with ${API_PROVIDER}...`)
    const data = await extractData(charName, wikiContent)

    if (data && applyData(profile, data)) {
      const updatedFields = []
      if (data.backstory) updatedFields.push('backstory')
      if (data.personality) updatedFields.push('personality')
      if (data.speech_style) updatedFields.push('speech_style')
      if (data.relationships) updatedFields.push('relationships')

      console.log(`  ✓ Data extracted and applied (${updatedFields.join(', ')})`)
      successCount++

      // Save immediately after successful processing
      console.log('  Saving character profile...')
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2))
    } else if (data) {
      console.log(`  ✓ No new fields to update (all required fields already populated)`)
      skippedCount++
    } else {
      console.log(`  ✗ Failed to extract data, skipping save`)
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
  console.log(`Results saved to ${MODE === 'base' ? 'characterProfiles.json' : 'characterProfilesVariants.json'}`)
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
