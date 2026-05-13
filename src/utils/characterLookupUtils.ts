import l2d from '@/utils/json/l2d.json'
import characterHonorifics from '@/utils/json/honorifics.json'

const L2D_CHAR_FIELDS = (c: any): string => typeof c?.name === 'string' ? c.name : ''

export const findCharacterByName = (name: string): { id: string; name: string } | undefined => {
  if (!name) return undefined
  const lower = name.toLowerCase()
  if (lower === 'commander') return { id: 'commander', name: 'Commander' }
  return (l2d as any[]).find((c) => L2D_CHAR_FIELDS(c).toLowerCase() === lower) as { id: string; name: string } | undefined
}

export const findCharacterIdByName = (name: string): string | undefined => {
  const char = findCharacterByName(name)
  return char ? char.id : undefined
}

export const findCharacterByIdOrName = (idOrName: string): { id: string; name: string } | undefined => {
  if (!idOrName) return undefined
  const lower = idOrName.toLowerCase()
  return (l2d as any[]).find((c) =>
    (typeof c?.id === 'string' && c.id.toLowerCase() === lower) ||
    (typeof c?.name === 'string' && c.name.toLowerCase() === lower)
  ) as { id: string; name: string } | undefined
}

export const hasMeaningfulAnimation = (anim: any): boolean => {
  if (typeof anim !== 'string') return false
  const t = anim.trim().toLowerCase()
  return t !== '' && t !== 'idle' && t !== 'none'
}

export const NON_DUPLICATED_FIELDS = new Set(['needs_search', 'memory', 'characterProgression', 'characterProfile', 'characterProfiles', 'debug_info', 'choices'])

// Helper to get honorific with fallback to "Commander"
export const getHonorific = (characterName: string): string => {
  return (characterHonorifics as Record<string, string>)[characterName] || 'Commander'
}

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
        // Store progression as a separate field so the AI always sees the original personality alongside the evolution.
        ;(outProfile as any).characterProgression = (update as any).personality
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
