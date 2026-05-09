// Animation enrichment utilities
import { animationMappings } from '@/utils/animationMappings'
import { logDebug } from '@/utils/chatUtils'
import { getRosterIdPairs, type StoryCharacterEntry, type CharacterCatalog } from '@/utils/storyCharacterUtils'
import { applyOverridesForContext } from '@/utils/animationOverrideUtils'
import l2d from '@/utils/json/l2d.json'
import { callGemini } from '@/utils/geminiUtils'
import { callOpenCodeGo } from '@/utils/llmUtils'
import { callOpenRouter } from '@/utils/llmUtils'
import { callPollinations } from '@/utils/pollinationsUtils'
import { callLocal } from '@/utils/llmUtils'

export const getFilteredAnimations = (animations?: string[]) => {
  return (animations || []).filter((a) => a !== 'talk' && a !== 'talk_start' && a !== 'talk_end' && a !== 'expression_0' && a !== 'expression_0_alt' && a !== 'action')
}

const hasMeaningfulAnimation = (anim: any): boolean => {
  if (typeof anim !== 'string') return false
  const t = anim.trim().toLowerCase()
  if (!t) return false
  return t !== 'idle' && t !== 'none'
}

export const enrichActionsWithAnimations = async (
  actions: any[],
  opts: {
    apiProvider: string
    apiKey: string
    model?: string
    currentCharacterId: string
    filteredAnimations: string[]
    animationEnrichmentPrompt: string
    preserveExistingAnimations?: boolean
    localUrl?: string
    rawResponseText?: string
    characterAnimations?: Record<string, string[]>
    signal?: AbortSignal
  }
): Promise<any[]> => {
  logDebug('Enriching actions with animations...')

  const { apiProvider, apiKey, model, currentCharacterId, filteredAnimations, animationEnrichmentPrompt, preserveExistingAnimations = true, localUrl, rawResponseText, characterAnimations, signal } = opts

  // Get unique characters present in the scene
  const charactersInScene = Array.from(new Set(actions.map((a) => a.character).filter((c) => c && c !== 'none')))

  // Build formatted animation list for ALL characters in the scene
  let formattedAnimations = ''
  if (characterAnimations) {
    // Get character names
    const l2dData = await import('@/utils/json/l2d.json')
    const l2dArray = l2dData.default as Array<{ id: string; name: string }>

    formattedAnimations = charactersInScene
      .filter((charId) => charId.toLowerCase() !== 'commander') // Never include commander
      .map((charId) => {
        const charData = l2dArray.find((c) => c.id === charId)
        const charName = charData?.name || charId
        const anims = characterAnimations[charId]

        if (anims && anims.length > 0) {
          const filtered = getFilteredAnimations(applyOverridesForContext(charId, anims))
          return `Available Animations for ${charName} (${charId}): ${JSON.stringify(filtered)}`
        } else {
          return `Available Animations for ${charName} (${charId}): (not loaded yet - use generic emotions)`
        }
      })
      .join('\n')
  } else {
    // Fallback to old format if no characterAnimations provided
    formattedAnimations = `Available Animations for Current Character (${currentCharacterId}): ${JSON.stringify(applyOverridesForContext(currentCharacterId, filteredAnimations))}`
  }

  const prompt = animationEnrichmentPrompt
    .replace('{currentCharacterId}', currentCharacterId)
    .replace('{filteredAnimations}', formattedAnimations)
    .replace('{charactersInScene}', JSON.stringify(charactersInScene))
    .replace('{rawResponseText}', rawResponseText || 'No raw response text available')
    .replace(
      '{actions}',
      JSON.stringify(
        actions.map((a, i) => ({ index: i, text: a.text, character: a.character, speaking: Boolean(a.speaking) })),
        null,
        2
      )
    )

  const messages = [{ role: 'user', content: prompt }]
  logDebug('[enrichActionsWithAnimations] Full prompt being sent to model:', prompt)
  let enrichedActions: any[] = []

  try {
    let response: string

    if (apiProvider === 'gemini') {
      response = await callGemini(messages, { model: model!, apiKey, useLocalProfiles: false, allowWebSearchFallback: false, signal })
    } else if (apiProvider === 'opencode-go') {
      response = await callOpenCodeGo(messages, {
        model: model!,
        apiKey,
        modeIsGame: false,
        signal
      })
    } else if (apiProvider === 'openrouter') {
      response = await callOpenRouter(messages, {
        model: model!,
        apiKey,
        enableContextCaching: false,
        useLocalProfiles: false,
        allowWebSearchFallback: false,
        modeIsGame: false,
        prompts: {} as any, // Not needed for this call
        signal
      })
    } else if (apiProvider === 'pollinations') {
      response = await callPollinations(messages, {
        model: model!,
        apiKey,
        useLocalProfiles: false,
        allowWebSearchFallback: false,
        modeIsGame: false,
        signal
      })
    } else if (apiProvider === 'local' && localUrl) {
      response = await callLocal(messages, {
        model,
        apiKey,
        localUrl,
        modeIsGame: false,
        signal
      })
    } else {
      console.warn('[enrichActionsWithAnimations] No valid API provider, returning original actions')
      return actions
    }

    logDebug('[enrichActionsWithAnimations] API response:', response?.substring(0, 200))

    let jsonStr = response.replace(/```json\n?|\n?```/g, '').trim()
    const start = jsonStr.indexOf('[')
    const end = jsonStr.lastIndexOf(']')

    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1)
      const animations = JSON.parse(jsonStr)

      logDebug('[enrichActionsWithAnimations] Parsed animations:', animations.length, 'expected:', actions.length)

      if (Array.isArray(animations)) {
        // Use API animations where available, fall back to local for missing ones
        enrichedActions = actions.map((action, index) => {
          const apiAnimation = animations[index]
          if (apiAnimation && typeof apiAnimation === 'string') {
            return { ...action, animation: apiAnimation }
          } else {
            const text = (action.text || '').toLowerCase()
            let animation = 'idle'

            // Use animationMappings to find matching animation
            for (const [animationType, keywords] of Object.entries(animationMappings)) {
              const foundKeyword = keywords.find((keyword) => text.includes(keyword.toLowerCase()))

              if (foundKeyword) {
                const matchedAnim = filteredAnimations.find((a: string) => a.toLowerCase().includes(animationType.toLowerCase()))
                if (matchedAnim) {
                  animation = matchedAnim
                } else {
                  animation = animationType
                }
                break
              }
            }

            if (animation !== 'idle') {
              logDebug(`[enrichActionsWithAnimations] Action ${index}: matched keyword -> ${animation}`)
            }

            return { ...action, animation }
          }
        })

        const apiCount = enrichedActions.filter((_, idx) => animations[idx] && typeof animations[idx] === 'string').length
        const localCount = enrichedActions.length - apiCount
        logDebug(`[enrichActionsWithAnimations] Mixed enrichment: ${apiCount} from API, ${localCount} from local fallback`)
      } else {
        console.warn('[enrichActionsWithAnimations] API response is not an array')
      }
    } else {
      console.warn('[enrichActionsWithAnimations] Could not find JSON array in response')
    }
  } catch (e) {
    console.error('[enrichActionsWithAnimations] API call failed, using full local fallback', e)

    // Full local fallback when API completely fails
    enrichedActions = actions.map((action, idx) => {
      const text = (action.text || '').toLowerCase()
      let animation = 'idle'
      let matchedKeyword = ''

      for (const [animationType, keywords] of Object.entries(animationMappings)) {
        const foundKeyword = keywords.find((keyword) => text.includes(keyword.toLowerCase()))

        if (foundKeyword) {
          matchedKeyword = foundKeyword
          // Find the best available animation matching this type
          const matchedAnim = filteredAnimations.find((a: string) => a.toLowerCase().includes(animationType.toLowerCase()))
          if (matchedAnim) {
            animation = matchedAnim
          } else {
            animation = animationType
          }
          break
        }
      }

      if (animation !== 'idle') {
        logDebug(`[enrichActionsWithAnimations] Action ${idx}: matched "${matchedKeyword}" -> ${animation}`)
      }

      return { ...action, animation }
    })

    const nonIdleCount = enrichedActions.filter((a) => a.animation !== 'idle').length
    logDebug(`[enrichActionsWithAnimations] Full local fallback complete: ${nonIdleCount}/${enrichedActions.length} actions got non-idle animations`)
  }

  if (enrichedActions.length === 0) {
    console.warn('[enrichActionsWithAnimations] No animations were generated, returning original actions')
    return actions
  }

  // Merge: preserve existing non-idle animations unless explicitly missing.
  // This prevents a late enrichment pass (post-sanitize) from degrading already-good model choices.
  const mergedActions = enrichedActions.map((action, index) => {
    if (!preserveExistingAnimations) return action
    const original = actions[index]
    if (original && hasMeaningfulAnimation(original.animation)) {
      return { ...action, animation: original.animation }
    }
    return action
  })

  return mergedActions
}

/**
 * Build a formatted string listing available animations for each character in context.
 * Used to give the AI model awareness of which animations are available.
 */
export const formatAnimationsForContext = (opts: { characterProfiles: Record<string, any>; rosterRows: StoryCharacterEntry[]; characterCatalog: CharacterCatalog; currentLive2dId: string; currentLive2dAnimations: string[]; animationCache: Record<string, string[]> }): string => {
  const placeholderAnimations = ['angry', 'angry_02', 'angry_03', 'cry', 'delight', 'idle', 'pain', 'sad', 'sad_02', 'shy', 'smile', 'surprise', 'void']

  const getCharacterInfo = (id: string) => {
    const charData = (l2d as any[]).find((c) => c.id === id)
    return {
      name: charData?.name || id,
      id: id
    }
  }

  const getCachedAnimations = (id: string): string[] | null => {
    let anims = opts.animationCache[id]
    if (!anims && id === opts.currentLive2dId) {
      anims = opts.currentLive2dAnimations
    }
    if (anims && anims.length > 0) {
      return getFilteredAnimations(applyOverridesForContext(id, anims))
    }
    return null
  }

  const formatAnimsForChar = (info: { name: string; id: string }, animations: string[]): string => {
    return `Animations for ${info.name} (${info.id}): ${JSON.stringify(animations)}`
  }

  const formatPlaceholderForChar = (info: { name: string; id: string }): string => {
    return `Animations for ${info.name} (${info.id}): ${JSON.stringify(applyOverridesForContext(info.id, placeholderAnimations))}`
  }

  const allCharacterIds = new Set<string>()

  for (const profileKey of Object.keys(opts.characterProfiles)) {
    if (profileKey.toLowerCase() !== 'commander') {
      const profile = opts.characterProfiles[profileKey]
      const id = profile.id || profileKey
      allCharacterIds.add(id)
    }
  }

  for (const pair of getRosterIdPairs(opts.rosterRows, opts.characterCatalog)) {
    allCharacterIds.add(pair.id)
  }

  if (opts.currentLive2dId) {
    allCharacterIds.add(opts.currentLive2dId)
  }

  const animsList = Array.from(allCharacterIds).map((id) => {
    const cached = getCachedAnimations(id)
    const info = getCharacterInfo(id)
    if (cached) {
      logDebug(`[AnimationContext] Using cached animations for ${id} (${info.name}): ${cached.length} animations`)
      return formatAnimsForChar(info, cached)
    }
    logDebug(`[AnimationContext] No cached animations for ${id} (${info.name}), using placeholder array`)
    return formatPlaceholderForChar(info)
  })

  if (animsList.length === 0) return 'No characters available yet.'
  return animsList.join('\n')
}