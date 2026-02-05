#!/usr/bin/env node

/**
 * Backstory Update Script
 *
 * This script updates existing characters in characterProfiles.json with backstory data
 * by fetching wiki content and using either Gemini 3 Pro or Grok 4.1 Fast to extract story information.
 *
 * Usage:
 *   node scripts/updateBackstories.js
 *   node scripts/updateBackstories.js --no-skip-existing    # Re-process all characters
 *
 * Options:
 *   --no-skip-existing    Process characters even if they already have a backstory key (default: skip existing)
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
const WIKI_PROXY_URL = 'https://nikke-wiki-proxy.rhysticone.workers.dev'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'x-ai/grok-4.1-fast'
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS) || 2000
const PROFILES_PATH = path.join(__dirname, '..', 'src', 'utils', 'json', 'characterProfiles.json')

const args = process.argv.slice(2)
const SKIP_EXISTING = !args.includes('--no-skip-existing') // Default: true (skip existing)

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

// Prompt template for extracting backstory
const BACKSTORY_PROMPT = `Based on the following wiki content about the NIKKE character "{name}", extract their backstory and key story events.

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

// Character name mappings for wiki search
const WIKI_NAME_MAPPINGS = {
  Ada: 'Ada Wong'
}

async function fetchWikiContent(characterName) {
  const wikiSearchName = WIKI_NAME_MAPPINGS[characterName] || characterName
  const wikiName = wikiSearchName.replace(/ /g, '_')
  const url = `${WIKI_PROXY_URL}?page=${encodeURIComponent(wikiName + '/Story')}`

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

// Call Gemini API to extract backstory
async function extractBackstoryGemini(characterName, wikiContent) {
  const prompt = BACKSTORY_PROMPT.replace('{name}', characterName).replace('{content}', wikiContent)

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048
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

    // Check for various response issues
    if (!data.candidates || data.candidates.length === 0) {
      // Check for safety blocks or finish reasons
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

    // Extract JSON from response
    let jsonStr = text.replace(/```json\n?|\n?```/g, '').trim()
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')

    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1)
    }

    // Try to parse JSON with error handling
    try {
      const result = JSON.parse(jsonStr)
      if (result.backstory && result.backstory !== 'Failed to extract backstory') {
        return result.backstory
      }
    } catch (parseError) {
      console.log(`  JSON parse failed, trying regex extraction...`)

      // Look for backstory field with various quote styles
      const backstoryMatch = jsonStr.match(/"backstory"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (backstoryMatch) {
        // Unescape any escaped characters
        const extracted = backstoryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
        if (extracted && extracted.length > 10) {
          console.log(`  ✓ Extracted backstory using regex fallback`)
          return extracted
        }
      }

      // Try alternate pattern with single quotes
      const singleQuoteMatch = jsonStr.match(/'backstory'\s*:\s*'([^']+)'/)
      if (singleQuoteMatch) {
        const extracted = singleQuoteMatch[1]
        if (extracted && extracted.length > 10) {
          console.log(`  ✓ Extracted backstory using single quote regex`)
          return extracted
        }
      }

      console.error(`  Error extracting backstory for ${characterName}:`, parseError.message)
    }

    return null
  } catch (e) {
    console.error(`  Error extracting backstory for ${characterName}:`, e.message)
    return null
  }
}

// Call OpenRouter API to extract backstory
async function extractBackstoryOpenRouter(characterName, wikiContent) {
  const prompt = BACKSTORY_PROMPT.replace('{name}', characterName).replace('{content}', wikiContent)

  const requestBody = {
    model: OPENROUTER_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    max_tokens: 2048
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

    // Extract JSON from response
    let jsonStr = text.replace(/```json\n?|\n?```/g, '').trim()
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')

    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1)
    }

    // Try to parse JSON with error handling
    try {
      const result = JSON.parse(jsonStr)
      if (result.backstory && result.backstory !== 'Failed to extract backstory') {
        return result.backstory
      }
    } catch (parseError) {
      console.log(`  JSON parse failed, trying regex extraction...`)

      // Look for backstory field with various quote styles
      const backstoryMatch = jsonStr.match(/"backstory"\s*:\s*"([^"]+(?:\\.[^"]*)*)"/)
      if (backstoryMatch) {
        // Unescape any escaped characters
        const extracted = backstoryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\/g, '')
        if (extracted && extracted.length > 10) {
          console.log(`  ✓ Extracted backstory using regex fallback`)
          return extracted
        }
      }

      // Try alternate pattern with single quotes
      const singleQuoteMatch = jsonStr.match(/'backstory'\s*:\s*'([^']+)'/)
      if (singleQuoteMatch) {
        const extracted = singleQuoteMatch[1]
        if (extracted && extracted.length > 10) {
          console.log(`  ✓ Extracted backstory using single quote regex`)
          return extracted
        }
      }

      console.error(`  Error extracting backstory for ${characterName}:`, parseError.message)
    }

    return null
  } catch (e) {
    console.error(`  Error extracting backstory for ${characterName}:`, e.message)
    return null
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
async function extractBackstory(characterName, wikiContent) {
  if (API_PROVIDER === 'openrouter') {
    return extractBackstoryOpenRouter(characterName, wikiContent)
  }
  return extractBackstoryGemini(characterName, wikiContent)
}

async function main() {
  await selectProvider()

  console.log('='.repeat(60))
  console.log('Character Backstory Update Script')
  console.log('='.repeat(60))
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
    console.error('Error loading characterProfiles.json:', e.message)
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

    // Skip if already has backstory (for resume functionality)
    if (SKIP_EXISTING && 'backstory' in profile) {
      console.log(`  ✓ Already has backstory key, skipping (use --no-skip-existing to override)`)
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

    // Extract backstory using selected provider
    console.log(`  Extracting backstory with ${API_PROVIDER}...`)
    const backstory = await extractBackstory(charName, wikiContent)

    if (backstory) {
      profile.backstory = backstory
      console.log(`  ✓ Backstory extracted (${backstory.length} chars)`)
      successCount++

      // Save immediately after successful processing
      console.log('  Saving character profile...')
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2))
    } else {
      console.log(`  ✗ Failed to extract backstory, skipping save`)
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
  console.log(`Skipped (already had backstory): ${skippedCount}`)
  console.log('')
  console.log('Results saved to characterProfiles.json')
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
