import { ref } from 'vue'
import l2d from '@/utils/json/l2d.json'
import localCharacterProfiles from '@/utils/json/characterProfiles.json'
import prompts from '@/utils/json/prompts.json'
import { cleanWikiContent } from '@/utils/chatUtils'

// Web search state
export const allowWebSearchFallback = ref(localStorage.getItem('nikke_allow_web_search_fallback') === 'true')

// Constants
export const NATIVE_SEARCH_PREFIXES = ['openai/', 'anthropic/', 'perplexity/', 'x-ai/']
export const POLLINATIONS_NATIVE_SEARCH_MODELS = ['gemini-search', 'perplexity-fast', 'perplexity-reasoning']
export const WIKI_PROXY_URL = 'https://nikke-wiki-proxy.rhysticone.workers.dev'

// Helper functions
export const hasNativeSearch = (modelId: string) => NATIVE_SEARCH_PREFIXES.some((prefix) => modelId.startsWith(prefix))

export const usesWikiFetch = (apiProvider: string, model: string) => apiProvider === 'openrouter' && !hasNativeSearch(model)

export const usesPollinationsAutoFallback = (apiProvider: string, model: string) => {
  if (apiProvider !== 'pollinations') return false
  // These models should NOT have auto-enabled fallback
  return !POLLINATIONS_NATIVE_SEARCH_MODELS.includes(model)
}

export const webSearchFallbackHelpText = (usesWikiFetchVal: boolean, usesPollinationsAutoFallbackVal: boolean) => {
  if (usesWikiFetchVal || usesPollinationsAutoFallbackVal) {
    return 'If a character is not found in the local profiles, allow the model to search the web.<br><br>Web search fallback is free for models without native search thanks to Cloudflare Workers, and is therefore always enabled with your current selection.'
  } else {
    return 'If a character is not found in the local profiles, allow the model to search the web. Note that this may incur extra costs, depending on your API provider and model.<br><br>If disabled, the model will rely on its internal knowledge for unknown characters and may degrade the experience.'
  }
}

// Helper for debug logging
const logDebug = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

export const fetchWikiContent = async (characterName: string): Promise<string | null> => {
  const wikiName = characterName.replace(/ /g, '_')

  try {
    // Fetch the Story page via our Cloudflare Worker proxy
    // The worker fetches only Description, Personality, and Backstory sections
    const response = await fetch(`${WIKI_PROXY_URL}?page=${encodeURIComponent(wikiName + '/Story')}`)
    const data = await response.json()

    // Check for errors
    if (data.error) {
      console.warn(`[fetchWikiContent] Wiki page not found for ${characterName}:`, data.error)
      return null
    }

    // Extract wikitext from parse response
    const wikitext = data.parse?.wikitext?.['*']
    if (!wikitext) {
      console.warn(`[fetchWikiContent] No content found for ${characterName}`)
      return null
    }

    return wikitext
  } catch (e) {
    console.error(`[fetchWikiContent] Error fetching wiki for ${characterName}:`, e)
    return null
  }
}

export const searchForCharactersViaWikiFetch = async (characterNames: string[], characterProfiles: Record<string, any>, apiProvider: string, callGemini: Function, callOpenRouter: Function, callPollinations: Function): Promise<void> => {
  logDebug('[searchForCharactersViaWikiFetch] Fetching wiki pages for:', characterNames)

  for (const name of characterNames) {
    if (characterProfiles[name]) continue

    const wikiContent = await fetchWikiContent(name)
    if (!wikiContent) {
      console.warn(`[searchForCharactersViaWikiFetch] No wiki content found for ${name}`)
      continue
    }

    const cleanedContent = cleanWikiContent(wikiContent)
    logDebug(`[searchForCharactersViaWikiFetch] Fetched ${cleanedContent.length} chars for ${name}`)

    const summarizePrompt = prompts.search.wikiFetch.replace(/{name}/g, name).replace('{content}', cleanedContent)

    const messages = [
      { role: 'system', content: prompts.search.system.wikiFetch },
      { role: 'user', content: summarizePrompt }
    ]

    let attempts = 0
    const maxAttempts = 3
    let success = false

    while (attempts < maxAttempts && !success) {
      try {
        let result: string

        if (apiProvider === 'gemini') {
          result = await callGemini(messages, false)
        } else if (apiProvider === 'openrouter') {
          result = await callOpenRouter(messages, false)
        } else if (apiProvider === 'pollinations') {
          result = await callPollinations(messages, false)
        } else {
          // Fallback to OpenRouter for other providers
          result = await callOpenRouter(messages, false)
        }

        let jsonStr = result.replace(/```json\n?|\n?```/g, '').trim()
        const start = jsonStr.indexOf('{')
        const end = jsonStr.lastIndexOf('}')
        if (start !== -1 && end !== -1) {
          jsonStr = jsonStr.substring(start, end + 1)
        }

        const profiles = JSON.parse(jsonStr)

        // Add character IDs
        for (const charName of Object.keys(profiles)) {
          const char = l2d.find((c) => c.name.toLowerCase() === charName.toLowerCase())
          if (char) {
            profiles[charName].id = char.id
          }
        }

        Object.assign(characterProfiles, profiles)
        logDebug(`[searchForCharactersViaWikiFetch] Added profile for ${name}:`, profiles)
        success = true
      } catch (e) {
        attempts++
        if (attempts >= maxAttempts) {
          console.error(`[searchForCharactersViaWikiFetch] Failed to process ${name} after ${maxAttempts} attempts:`, e)
        } else {
          console.warn(`[searchForCharactersViaWikiFetch] Attempt ${attempts} failed for ${name}, retrying...`)
        }
      }
    }
  }
}

export const searchForCharactersWithNativeSearch = async (characterNames: string[], characterProfiles: Record<string, any>, apiProvider: string, callGemini: Function, callOpenRouter: Function, callPollinations: Function): Promise<void> => {
  logDebug('[searchForCharactersWithNativeSearch] Searching for:', characterNames)

  for (const name of characterNames) {
    if (characterProfiles[name]) continue

    const wikiName = name.replace(/ /g, '_')
    const storyUrl = `https://nikke-goddess-of-victory-international.fandom.com/wiki/${wikiName}/Story`

    const searchPrompt = prompts.search.native.replace(/{name}/g, name).replace('{url}', storyUrl)

    const messages = [
      { role: 'system', content: prompts.search.system.native },
      { role: 'user', content: searchPrompt }
    ]

    let attempts = 0
    const maxAttempts = 3

    let success = false

    while (attempts < maxAttempts && !success) {
      attempts++
      try {
        let result: string

        if (apiProvider === 'gemini') {
          result = await callGemini(messages, true)
        } else if (apiProvider === 'openrouter') {
          result = await callOpenRouter(messages, true)
        } else if (apiProvider === 'pollinations') {
          result = await callPollinations(messages, true)
        } else {
          throw new Error(`Unsupported provider for native search: ${apiProvider}`)
        }

        let jsonStr = result.replace(/```json\n?|\n?```/g, '').trim()
        const start = jsonStr.indexOf('{')
        const end = jsonStr.lastIndexOf('}')
        if (start !== -1 && end !== -1) {
          jsonStr = jsonStr.substring(start, end + 1)
        }

        const profiles = JSON.parse(jsonStr)

        for (const charName of Object.keys(profiles)) {
          const char = l2d.find((c) => c.name.toLowerCase() === charName.toLowerCase())
          if (char) {
            profiles[charName].id = char.id
          }
        }

        Object.assign(characterProfiles, profiles)
        logDebug(`[searchForCharactersWithNativeSearch] Added profile for ${name}:`, profiles)
        success = true
      } catch (e) {
        console.error(`[searchForCharactersWithNativeSearch] Attempt ${attempts} failed for ${name}:`, e)
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } else {
          console.error(`[searchForCharactersWithNativeSearch] All attempts failed for ${name}.`)
        }
      }
    }
  }
}

export const searchForCharacters = async (characterNames: string[], characterProfiles: Record<string, any>, useLocalProfiles: boolean, allowWebSearchFallback: boolean, apiProvider: string, model: string, loadingStatus: any, setRandomLoadingMessage: Function, searchForCharactersWithNativeSearch: Function, searchForCharactersViaWikiFetch: Function): Promise<void> => {
  logDebug('[searchForCharacters] Searching for:', characterNames)

  if (useLocalProfiles) {
    loadingStatus.value = 'Searching for characters in the database...'
  } else {
    loadingStatus.value = 'Searching the web for characters...'
  }

  let charsToSearch = [...characterNames]

  // Check local profiles first if enabled
  if (useLocalProfiles) {
    const remainingChars: string[] = []

    for (const name of charsToSearch) {
      // Case-insensitive lookup in local profiles
      const localKey = Object.keys(localCharacterProfiles).find((k) => k.toLowerCase() === name.toLowerCase())

      if (localKey) {
        const profile = (localCharacterProfiles as any)[localKey]
        // Use the name requested by the AI as the key, but the data from the local profile
        characterProfiles[name] = {
          ...profile,
          // Ensure ID is present (it is in the JSON, but fallback to l2d list just in case)
          id: profile.id || l2d.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id
        }
        logDebug(`[searchForCharacters] Found local profile for ${name}`)
      } else {
        remainingChars.push(name)
      }
    }

    charsToSearch = remainingChars
  }

  if (charsToSearch.length === 0) {
    logDebug('[searchForCharacters] All characters found locally.')
    setRandomLoadingMessage()
    return
  }

  // If fallback is disabled, stop here
  if (useLocalProfiles && !allowWebSearchFallback) {
    logDebug('[searchForCharacters] Web search fallback disabled. Skipping search for:', charsToSearch)
    setRandomLoadingMessage()
    return
  }

  loadingStatus.value = 'Searching the web for characters...'

  // For Gemini, use native search
  if (apiProvider === 'gemini') {
    await searchForCharactersWithNativeSearch(charsToSearch)
    return
  }

  // For OpenRouter, check if model has native search
  if (apiProvider === 'openrouter') {
    if (hasNativeSearch(model)) {
      // Use native web search for OpenAI, Anthropic, Perplexity, xAI models
      await searchForCharactersWithNativeSearch(charsToSearch)
    } else {
      // For models without native search (e.g., Claude via OpenRouter, DeepSeek, etc.)
      // Fetch wiki pages directly and have the model summarize
      await searchForCharactersViaWikiFetch(charsToSearch)
    }
    return
  }

  // For Pollinations, check if model has native search
  if (apiProvider === 'pollinations') {
    if (POLLINATIONS_NATIVE_SEARCH_MODELS.includes(model)) {
      // Use native web search for these models
      await searchForCharactersWithNativeSearch(charsToSearch)
    } else {
      // For models without native search, fetch wiki pages directly
      await searchForCharactersViaWikiFetch(charsToSearch)
    }
    return
  }
}
