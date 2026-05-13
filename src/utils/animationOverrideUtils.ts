import overrideData from '@/utils/json/characterAnimationsOverride.json'
import l2d from '@/utils/json/l2d.json'
import localProfiles from '@/utils/json/characterProfiles.json'
import variantProfiles from '@/utils/json/characterProfilesVariants.json'

export interface AnimationOverrideEntry {
  original: string
  replaced: string
}

interface OverrideGroup {
  ids: string[]
  name: string
  overrides: AnimationOverrideEntry[]
}

const overridesArray = (overrideData as any).overrides as OverrideGroup[]

// Build a flat map: id -> overrides[]
const overrideMap = new Map<string, AnimationOverrideEntry[]>()

for (const group of overridesArray) {
  for (const id of group.ids) {
    const existing = overrideMap.get(id) || []
    overrideMap.set(id, [...existing, ...group.overrides])
  }
}

export const validateAnimationOverrides = (): void => {
  const l2dIds = new Set((l2d as Array<{ id: string }>).map((c) => c.id))
  const allProfileNames = new Set([
    ...Object.keys(localProfiles as Record<string, any>),
    ...Object.keys(variantProfiles as Record<string, any>)
  ])
  const seenIds = new Set<string>()

  for (const group of overridesArray) {
    for (const id of group.ids) {
      if (seenIds.has(id)) {
        console.warn(`[AnimationOverride] Duplicate ID in override groups: ${id}`)
      }
      seenIds.add(id)

      if (!l2dIds.has(id)) {
        console.warn(`[AnimationOverride] Unknown character ID in overrides: ${id} (name: ${group.name})`)
      }
    }

    if (!allProfileNames.has(group.name)) {
      console.warn(`[AnimationOverride] Override group name not found in profiles: ${group.name}`)
    }
  }
}

const tryGetOverrides = (id: string): AnimationOverrideEntry[] | null => {
  if (!id) return null

  const exact = overrideMap.get(id)
  if (exact && exact.length > 0) return exact

  // Fallback: strip _XX suffix to get base ID
  const baseId = id.replace(/_\d+$/, '')
  if (baseId !== id) {
    const baseOverrides = overrideMap.get(baseId)
    if (baseOverrides && baseOverrides.length > 0) return baseOverrides
  }

  return null
}

export const getAnimationOverrides = (characterId: string): AnimationOverrideEntry[] => {
  return tryGetOverrides(characterId) || []
}

export const applyOverridesForContext = (characterId: string, animations: string[]): string[] => {
  const overrides = tryGetOverrides(characterId)
  if (!overrides || overrides.length === 0) return animations

  return animations.map((anim) => {
    const override = overrides.find((o) => o.original === anim)
    return override ? override.replaced : anim
  })
}

export const resolveAnimationOverride = (characterId: string, requestedAnimation: string): string => {
  const overrides = tryGetOverrides(characterId)
  if (!overrides || overrides.length === 0) return requestedAnimation

  const override = overrides.find((o) => o.replaced === requestedAnimation)
  return override ? override.original : requestedAnimation
}
