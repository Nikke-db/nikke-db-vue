export type AiAction = Record<string, any>

const normalizeKey = (name: string): string => {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
}

const resolveExistingProfileKey = (name: string, existingKeys: string[]): string | undefined => {
  if (!name) return undefined

  // 1) Case-insensitive exact match
  const exact = existingKeys.find((k) => k.toLowerCase() === name.toLowerCase())
  if (exact) return exact

  // 2) Normalized match, but ONLY if unique
  const needle = normalizeKey(name)
  if (!needle) return undefined

  const matches = existingKeys.filter((k) => normalizeKey(k) === needle)
  if (matches.length === 1) return matches[0]

  return undefined
}

const looksLikeCharacterRecord = (obj: any): obj is Record<string, any> => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false

  // If it's a direct profile object (personality/speech_style/relationships), it's NOT a record.
  const directProfileKeys = new Set(['personality', 'speech_style', 'relationships', 'id', 'name'])
  const keys = Object.keys(obj)
  if (keys.length > 0 && keys.every((k) => directProfileKeys.has(k))) return false

  // Heuristic: a record has at least one value that is an object
  return keys.some((k) => typeof (obj as any)[k] === 'object' && (obj as any)[k] !== null)
}

const mergeProgressionUpdate = (target: any, incoming: any) => {
  if (!incoming || typeof incoming !== 'object') return

  if (incoming.personality) {
    target.personality = incoming.personality
  }

  if (incoming.relationships && typeof incoming.relationships === 'object') {
    target.relationships = {
      ...(target.relationships || {}),
      ...incoming.relationships
    }
  }
}

/**
 * Normalizes an AI action so that:
 * - Any legacy/hallucinated `characterProfile` / `characterProfiles` blocks are NOT allowed to overwrite existing profiles.
 * - If a legacy/memory block targets an existing character, we extract allowed progression updates
 *   (personality + relationships) and move them into `characterProgression`.
 * - Unsafe fields (e.g. `speech_style`) are silently ignored (they will also be blocked later in executeAction).
 */
export const normalizeAiActionCharacterData = (
  action: AiAction,
  knownCharacterProfiles: Record<string, any>
): AiAction => {
  const out: AiAction = { ...(action || {}) }
  const existingKeys = Object.keys(knownCharacterProfiles || {})

  // 1) Fold legacy keys into memory (but we'll re-route existing characters into characterProgression)
  const legacyBlocks: any[] = []
  if (out.characterProfile) legacyBlocks.push(out.characterProfile)
  if (out.characterProfiles) legacyBlocks.push(out.characterProfiles)

  if (legacyBlocks.length > 0) {
    delete out.characterProfile
    delete out.characterProfiles

    for (const legacy of legacyBlocks) {
      if (!looksLikeCharacterRecord(legacy)) continue
      out.memory = {
        ...(out.memory && typeof out.memory === 'object' ? out.memory : {}),
        ...legacy
      }
    }
  }

  // 2) If memory targets an existing character, convert to characterProgression.
  if (out.memory && typeof out.memory === 'object' && !Array.isArray(out.memory)) {
    const newMemory: Record<string, any> = {}

    for (const [rawName, profileLike] of Object.entries(out.memory)) {
      const resolvedExistingKey = resolveExistingProfileKey(rawName, existingKeys)

      if (resolvedExistingKey && profileLike && typeof profileLike === 'object' && !Array.isArray(profileLike)) {
        out.characterProgression = {
          ...(out.characterProgression && typeof out.characterProgression === 'object' ? out.characterProgression : {})
        }

        const current =
          (out.characterProgression as any)[resolvedExistingKey] &&
          typeof (out.characterProgression as any)[resolvedExistingKey] === 'object'
            ? (out.characterProgression as any)[resolvedExistingKey]
            : {}

        mergeProgressionUpdate(current, profileLike)
        ;(out.characterProgression as any)[resolvedExistingKey] = current

        // Do NOT keep this entry in memory (prevents profile override/duplication)
        continue
      }

      newMemory[rawName] = profileLike
    }

    out.memory = newMemory
    if (Object.keys(out.memory).length === 0) delete out.memory
  }

  return out
}
