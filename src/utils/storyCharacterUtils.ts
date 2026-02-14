import l2d from '@/utils/json/l2d.json'
import filteredIdsJson from '@/utils/json/filteredCharacterIds.json'

export type StoryCharacterSource = 'user' | 'ai'

export type StoryCharacterEntry = {
  key: string
  selection: string
  skinId?: string
  source: StoryCharacterSource
}

type CharacterItem = { id: string; name: string }

type CharacterCatalogEntry = {
  baseName: string
  baseId: string
  skins: CharacterItem[]
}

type CharacterVariant = {
  id: string
  name: string
  baseName: string
}

export type CharacterCatalog = {
  baseMap: Record<string, CharacterCatalogEntry>
  variants: CharacterVariant[]
  idToName: Record<string, string>
  nameToId: Record<string, string>
  baseNames: string[]
}

const filteredIds = new Set((filteredIdsJson as any).filteredIds || [])

const isVariantName = (name: string) => name.includes(':')

const isIdFiltered = (id: string) => filteredIds.has(id)

const toKey = (value: string) => (value || '').trim().toLowerCase()

const buildBaseMap = (items: CharacterItem[]) => {
  const baseMap: Record<string, CharacterCatalogEntry> = {}

  for (const item of items) {
    if (!item?.name || !item?.id) continue
    if (isIdFiltered(item.id)) continue
    if (isVariantName(item.name)) continue
    if (item.id.includes('_')) continue

    baseMap[item.name] = {
      baseName: item.name,
      baseId: item.id,
      skins: []
    }
  }

  return baseMap
}

const findBaseNameForSkin = (name: string, baseNames: string[]) => {
  const lower = toKey(name)
  let matched: string | null = null

  const sorted = [...baseNames].sort((a, b) => b.length - a.length)
  for (const baseName of sorted) {
    const baseLower = toKey(baseName)
    if (!lower.startsWith(baseLower)) continue
    const nextChar = name.slice(baseName.length, baseName.length + 1)
    if (nextChar !== ' ') continue
    matched = baseName
    break
  }

  return matched
}

export const buildCharacterCatalog = (items: CharacterItem[] = l2d as CharacterItem[]): CharacterCatalog => {
  const idToName: Record<string, string> = {}
  const nameToId: Record<string, string> = {}

  for (const item of items) {
    if (!item?.name || !item?.id) continue
    if (isIdFiltered(item.id)) continue
    idToName[item.id] = item.name

    // For nameToId, keep the lowest ID when there are duplicates
    const key = toKey(item.name)
    if (!nameToId[key] || item.id.localeCompare(nameToId[key]) < 0) {
      nameToId[key] = item.id
    }
  }

  const baseMap = buildBaseMap(items)
  const baseNames = Object.keys(baseMap)
  const variants: CharacterVariant[] = []

  for (const item of items) {
    if (!item?.name || !item?.id) continue
    if (isIdFiltered(item.id)) continue

    if (isVariantName(item.name)) {
      const baseName = item.name.split(':')[0].trim()
      variants.push({ id: item.id, name: item.name, baseName })
      continue
    }

    if (item.id.includes('_')) {
      const baseName = findBaseNameForSkin(item.name, baseNames)
      if (baseName && baseMap[baseName]) {
        baseMap[baseName].skins.push({ id: item.id, name: item.name })
      }
    }
  }

  // Filter skins that are in filteredIds
  for (const baseName of baseNames) {
    baseMap[baseName].skins = baseMap[baseName].skins.filter((skin) => !isIdFiltered(skin.id))
    baseMap[baseName].skins.sort((a, b) => a.name.localeCompare(b.name))
  }

  variants.sort((a, b) => a.name.localeCompare(b.name))

  return {
    baseMap,
    variants,
    idToName,
    nameToId,
    baseNames: baseNames.sort((a, b) => a.localeCompare(b))
  }
}

export const getSelectionValueForBase = (baseName: string) => `base::${baseName}`

export const getSelectionValueForVariant = (variantId: string) => `variant::${variantId}`

export const parseSelectionValue = (value: string): { type: 'base'; baseName: string } | { type: 'variant'; variantId: string } | null => {
  if (!value) return null
  if (value.startsWith('base::')) {
    const baseName = value.slice('base::'.length)
    return baseName ? { type: 'base', baseName } : null
  }
  if (value.startsWith('variant::')) {
    const variantId = value.slice('variant::'.length)
    return variantId ? { type: 'variant', variantId } : null
  }
  return null
}

export const getCharacterSelectOptions = (catalog: CharacterCatalog) => {
  const baseOptions = catalog.baseNames.map((name) => ({ label: name, value: getSelectionValueForBase(name) }))
  const variantOptions = catalog.variants.map((variant) => ({ label: variant.name, value: getSelectionValueForVariant(variant.id) }))
  const allOptions = [...baseOptions, ...variantOptions]
  return allOptions.sort((a, b) => a.label.localeCompare(b.label))
}

export const getSkinOptionsForBase = (catalog: CharacterCatalog, baseName: string) => {
  const entry = catalog.baseMap[baseName]
  if (!entry) return []
  const options = [{ label: `Default (${baseName})`, value: entry.baseId }]
  for (const skin of entry.skins) {
    options.push({ label: skin.name, value: skin.id })
  }
  return options
}

export const getSelectionForName = (name: string, catalog: CharacterCatalog): { selection: string; skinId?: string } | null => {
  if (!name) return null
  const key = toKey(name)
  const exactId = catalog.nameToId[key]

  if (exactId) {
    if (isVariantName(name)) {
      return { selection: getSelectionValueForVariant(exactId) }
    }

    if (exactId.includes('_')) {
      const baseName = findBaseNameForSkin(name, catalog.baseNames)
      if (baseName) {
        return { selection: getSelectionValueForBase(baseName), skinId: exactId }
      }
    }

    if (catalog.baseMap[name]) {
      return { selection: getSelectionValueForBase(name) }
    }

    for (const baseName of catalog.baseNames) {
      if (toKey(baseName) === key) {
        return { selection: getSelectionValueForBase(baseName) }
      }
    }
  }

  if (isVariantName(name)) {
    const variant = catalog.variants.find((v) => toKey(v.name) === key)
    if (variant) return { selection: getSelectionValueForVariant(variant.id) }
  }

  for (const baseName of catalog.baseNames) {
    if (toKey(baseName) === key) {
      return { selection: getSelectionValueForBase(baseName) }
    }
  }

  return null
}

export const getSelectionForId = (id: string, catalog: CharacterCatalog): { selection: string; skinId?: string } | null => {
  if (!id) return null
  const name = catalog.idToName[id]
  if (!name) return null

  if (isVariantName(name)) {
    return { selection: getSelectionValueForVariant(id) }
  }

  if (id.includes('_')) {
    const baseName = findBaseNameForSkin(name, catalog.baseNames)
    if (baseName) {
      return { selection: getSelectionValueForBase(baseName), skinId: id }
    }
  }

  if (catalog.baseMap[name]) {
    return { selection: getSelectionValueForBase(name) }
  }

  return null
}

export const getSelectedCharacterId = (entry: StoryCharacterEntry, catalog: CharacterCatalog): string | null => {
  const selection = parseSelectionValue(entry.selection)
  if (!selection) return null

  if (selection.type === 'variant') {
    return selection.variantId
  }

  const base = catalog.baseMap[selection.baseName]
  if (!base) return null
  return entry.skinId || base.baseId
}

export const getCharacterNameById = (catalog: CharacterCatalog, id: string): string | null => {
  return catalog.idToName[id] || null
}

export const getRosterIdPairs = (roster: StoryCharacterEntry[], catalog: CharacterCatalog) => {
  const seen = new Set<string>()
  const pairs: Array<{ name: string; id: string }> = []

  for (const entry of roster) {
    const id = getSelectedCharacterId(entry, catalog)
    if (!id || seen.has(id)) continue
    seen.add(id)

    const name = getCharacterNameById(catalog, id) || id
    pairs.push({ name, id })
  }

  return pairs
}

export const resolveCharacterIdFromInput = (input: string, roster: StoryCharacterEntry[], catalog: CharacterCatalog): string | null => {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // Check if input is a valid ID in the catalog
  const inputName = catalog.idToName[trimmed]

  // If it's a valid ID, check roster for matching entry with potential skin
  if (inputName) {
    // Check roster entries - if this base character is in roster with a skin, return the skin ID
    for (const entry of roster) {
      const selectedId = getSelectedCharacterId(entry, catalog)
      if (!selectedId) continue

      const selectedName = catalog.idToName[selectedId]
      if (!selectedName) continue

      // Check if roster entry is for the same character (base name matches)
      const entrySelection = parseSelectionValue(entry.selection)
      if (!entrySelection) continue

      if (entrySelection.type === 'base') {
        // For base entries, check if the input matches this base
        const baseEntry = catalog.baseMap[entrySelection.baseName]
        if (baseEntry && baseEntry.baseId === trimmed) {
          // Return the skin ID if one is selected, otherwise the base
          return selectedId
        }
        // Also check if input name starts with this base name (for skin variants in roster)
        if (inputName.toLowerCase().startsWith(entrySelection.baseName.toLowerCase() + ' ') || inputName.toLowerCase() === entrySelection.baseName.toLowerCase()) {
          return selectedId
        }
      } else if (entrySelection.type === 'variant') {
        // For variant entries, check if input matches the variant
        const variantId = entrySelection.variantId
        const variantName = catalog.idToName[variantId]
        if (variantId === trimmed || (variantName && toKey(variantName) === toKey(inputName))) {
          return selectedId
        }
      }
    }

    // No roster match found, but check if this base ID has a variant in the roster
    // If so, return the variant ID instead (AI might send base ID even when variant is selected)
    const baseName = inputName.includes(':') ? inputName.split(':')[0].trim() : inputName
    for (const entry of roster) {
      const selection = parseSelectionValue(entry.selection)
      if (!selection || selection.type !== 'variant') continue

      const variantId = selection.variantId
      const variantName = catalog.idToName[variantId]
      if (!variantName || !variantName.includes(':')) continue

      const variantBaseName = variantName.split(':')[0].trim()
      if (toKey(variantBaseName) === toKey(baseName)) {
        // Found a variant of this base character in the roster
        return variantId
      }
    }

    // Return the original ID
    return trimmed
  }

  // Input is not a valid ID, try to match by name
  const key = toKey(trimmed)
  for (const entry of roster) {
    const selection = parseSelectionValue(entry.selection)
    if (!selection) continue
    if (selection.type === 'variant') {
      const variantName = catalog.idToName[selection.variantId]
      if (variantName && toKey(variantName) === key) {
        return getSelectedCharacterId(entry, catalog)
      }
      continue
    }

    if (toKey(selection.baseName) === key) {
      return getSelectedCharacterId(entry, catalog)
    }
  }

  // Check if input name matches a base character name, but a variant of that character is in the roster
  // If so, return the variant ID instead of the base ID
  for (const entry of roster) {
    const selection = parseSelectionValue(entry.selection)
    if (!selection || selection.type !== 'variant') continue

    const variantId = selection.variantId
    const variantName = catalog.idToName[variantId]
    if (!variantName || !variantName.includes(':')) continue

    const variantBaseName = variantName.split(':')[0].trim()
    if (toKey(variantBaseName) === key) {
      // Found a variant of this base character name in the roster
      return variantId
    }
  }

  const directId = catalog.nameToId[key]
  if (directId) return directId

  return null
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const resolveRosterIdsFromPrompt = (prompt: string, catalog: CharacterCatalog): string[] => {
  if (!prompt) return []
  const ids = new Set<string>()
  const names = Object.values(catalog.idToName)

  for (const name of names) {
    if (!name) continue
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i')
    if (pattern.test(prompt)) {
      const id = catalog.nameToId[toKey(name)]
      if (id) ids.add(id)
    }
  }

  return Array.from(ids)
}
