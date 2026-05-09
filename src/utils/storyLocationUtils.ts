import locationProfiles from '@/utils/json/locationProfiles.json'

type ChatHistoryEntry = {
  role: string
  content: string
}

type LocationTriggerSources = {
  userText?: boolean
  recentChat?: boolean
  profileText?: boolean
}

export type LocationProfile = {
  aliases?: string[]
  profileKeywords?: string[]
  relatedCharacters?: string[]
  triggerSources?: LocationTriggerSources
  visuals: string
  description: string
}

export type ResolvedLocation = {
  name: string
  profile: LocationProfile
  score: number
  matchedByUser: boolean
  matchedByRecentChat: boolean
  matchedByProfile: boolean
}

const LOCATION_PROFILE_FIELDS = ['backstory', 'relationships', 'characterProgression'] as const
const RECENT_LOCATION_HISTORY_LIMIT = 8
const MAX_RELEVANT_LOCATIONS = 2

const joinProfileText = (profile: any): string => {
  if (!profile || typeof profile !== 'object') return ''

  const parts: string[] = []

  for (const field of LOCATION_PROFILE_FIELDS) {
    const value = profile[field]
    if (!value) continue

    if (typeof value === 'string') {
      parts.push(value)
      continue
    }

    if (typeof value === 'object') {
      parts.push(JSON.stringify(value))
    }
  }

  return parts.join(' ')
}

const getRecentChatText = (chatHistory: ChatHistoryEntry[] = [], currentUserPrompt: string = ''): string => {
  const recentHistory = chatHistory
    .filter((entry) => entry.role !== 'system')
    .slice(-RECENT_LOCATION_HISTORY_LIMIT)
    .map((entry) => entry.content)
    .join('\n')

  return currentUserPrompt ? `${recentHistory}\n${currentUserPrompt}` : recentHistory
}

const hasLocationTermMatch = (text: string, terms: string[], isWholeWordPresent: (text: string, word: string) => boolean): boolean => {
  if (!text || terms.length === 0) return false
  return terms.some((term) => isWholeWordPresent(text, term))
}

export const resolveRelevantLocations = (params: {
  profiles: Record<string, any>
  currentUserPrompt?: string
  chatHistory?: ChatHistoryEntry[]
  isWholeWordPresent: (text: string, word: string) => boolean
}): ResolvedLocation[] => {
  const userText = params.currentUserPrompt || ''
  const recentChatText = getRecentChatText(params.chatHistory, userText)
  const locationMap = locationProfiles as Record<string, LocationProfile>
  const matches: ResolvedLocation[] = []

  for (const [name, profile] of Object.entries(locationMap)) {
    const aliases = Array.from(new Set([name, ...(profile.aliases || [])]))
    const profileKeywords = Array.from(new Set([...(profile.profileKeywords || []), ...aliases]))
    const triggerSources = profile.triggerSources || {}
    const relatedCharacters = new Set((profile.relatedCharacters || []).map((charName) => charName.toLowerCase()))

    const matchedByUser = triggerSources.userText !== false && hasLocationTermMatch(userText, aliases, params.isWholeWordPresent)
    const matchedByRecentChat = !matchedByUser && triggerSources.recentChat !== false && hasLocationTermMatch(recentChatText, aliases, params.isWholeWordPresent)

    let matchedByProfile = false
    if (!matchedByUser && !matchedByRecentChat && triggerSources.profileText) {
      for (const [characterName, characterProfile] of Object.entries(params.profiles || {})) {
        if (relatedCharacters.size > 0 && !relatedCharacters.has(characterName.toLowerCase())) continue
        if (hasLocationTermMatch(joinProfileText(characterProfile), profileKeywords, params.isWholeWordPresent)) {
          matchedByProfile = true
          break
        }
      }
    }

    if (!matchedByUser && !matchedByRecentChat && !matchedByProfile) continue

    const score = matchedByUser ? 3 : matchedByRecentChat ? 2 : 1
    matches.push({
      name,
      profile,
      score,
      matchedByUser,
      matchedByRecentChat,
      matchedByProfile
    })
  }

  const strongestExplicitMatch = matches.some((location) => location.matchedByUser)
  const filteredMatches = strongestExplicitMatch ? matches.filter((location) => location.matchedByUser) : matches

  return filteredMatches
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.name.localeCompare(b.name)
    })
    .slice(0, MAX_RELEVANT_LOCATIONS)
}

export const getFilteredLocationsForAI = (locations: ResolvedLocation[]): Record<string, { description: string; visuals: string }> => {
  return locations.reduce<Record<string, { description: string; visuals: string }>>((acc, location) => {
    acc[location.name] = {
      description: location.profile.description,
      visuals: location.profile.visuals
    }
    return acc
  }, {})
}
