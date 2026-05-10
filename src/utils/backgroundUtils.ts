import backgroundImagesList from '@/utils/json/backgroundImages.json'

type BackgroundSceneOverride = {
  key?: string
  label?: string
  locations?: string[]
  aiSelectable?: boolean
}

type BackgroundSceneCatalogEntry = {
  key: string
  label: string
  locations: string[]
  aiSelectable: boolean
  filenamesByVariant: Record<string, string>
}

type AvailableBackgroundScene = BackgroundSceneCatalogEntry & {
  variants: string[]
}

export type BackgroundLoadResult = {
  matchCount: number
  aliasMatches: Array<{ uploaded: string; canonical: string }>
  unmatchedImageFiles: string[]
}

export type BackgroundPromptScene = {
  key: string
  label: string
  locations?: string[]
  variants?: string[]
}

export type CurrentBackgroundPromptState = {
  key: string
  label: string
  variant?: string
  locations?: string[]
}

const VARIANT_SUFFIX_REGEX = /_(d|n|s|e|i|r)$/i
const BACKGROUND_PROMPT_SCENE_LIMIT = 20
const VARIANT_ORDER = ['default', 'day', 'night', 'sunset', 'event', 'special', 'alternate']
const VARIANT_LABELS: Record<string, string> = {
  d: 'day',
  n: 'night',
  s: 'sunset',
  e: 'event',
  i: 'special',
  r: 'alternate'
}
const VARIANT_ALIASES: Record<string, string> = {
  '': 'default',
  default: 'default',
  base: 'default',
  normal: 'default',
  standard: 'default',
  d: 'day',
  day: 'day',
  n: 'night',
  night: 'night',
  s: 'sunset',
  sunset: 'sunset',
  evening: 'sunset',
  e: 'event',
  event: 'event',
  i: 'special',
  special: 'special',
  r: 'alternate',
  alt: 'alternate',
  alternate: 'alternate'
}

const NON_SELECTABLE_SCENE_STEMS = new Set([
  '2025FoolsDay',
  'Opacity_60',
  'black',
  'red',
  'Launcher_load',
  'Launcher_load 1',
  'talkative_action_01',
  'talkative_action_02'
])

// Most filenames can be auto-humanized into usable scene keys. Override only the
// cases where we need cleaner labels, stable AI-facing keys, or explicit location
// routing that the generic stem parser would not infer correctly.
const BACKGROUND_SCENE_OVERRIDES: Record<string, BackgroundSceneOverride> = {
  APillar: { key: 'observatory_pillar', label: 'Observatory Pillar', locations: ['Observatory'] },
  AirView: { key: 'observatory_view', label: 'Observatory View', locations: ['Observatory'] },
  Ark: { locations: ['The Ark'] },
  ArkCleanIndoor: { label: 'Ark Clean Interior', locations: ['The Ark'] },
  ArkRuinIndoor: { label: 'Ark Ruined Interior', locations: ['The Ark'] },
  Ark_02: { key: 'ark_city', label: 'Ark City', locations: ['The Ark'] },
  Armory: { locations: ['Armory'] },
  AZXIn: { key: 'azx_interior', label: 'AZX Interior', locations: ['Train Station'] },
  Bar: { locations: ['Trendy Bar', 'Seedy Club'] },
  BriefingRoom: { key: 'briefing_room', label: 'Briefing Room', locations: ['The Ark'] },
  Cafe: { locations: ['Maid Cafe', 'Cafe Sweety'] },
  Church: { locations: ['Church'] },
  ClothingStore: { key: 'clothing_store', label: 'Clothing Store', locations: ['Clothing Store'] },
  CoinRushDrinkZone: { key: 'coin_rush_drink_zone', label: 'Coin Rush Drink Zone', locations: ['Amusement Park'] },
  CoinRushGameZone: { key: 'coin_rush_game_zone', label: 'Coin Rush Game Zone', locations: ['Amusement Park'] },
  CoinRushIndoor: { key: 'coin_rush_indoor', label: 'Coin Rush Interior', locations: ['Amusement Park'] },
  CoinRushMainHall: { key: 'coin_rush_main_hall', label: 'Coin Rush Main Hall', locations: ['Amusement Park'] },
  CommanderRoom: { key: 'commander_room', label: 'Commander Room', locations: ['The Ark'] },
  Corridor: { locations: ['The Ark'] },
  CrownKingdomCastleBedroom: { key: 'crown_kingdom_castle_bedroom', label: 'Crown Kingdom Castle Bedroom', locations: ['Crown Kingdom'] },
  CrownKingdomCastleDiningRoom: { key: 'crown_kingdom_castle_dining_room', label: 'Crown Kingdom Castle Dining Room', locations: ['Crown Kingdom'] },
  CrownKingdomCastleFrontYard: { key: 'crown_kingdom_castle_front_yard', label: 'Crown Kingdom Castle Front Yard', locations: ['Crown Kingdom'] },
  CrownKingdomCastleGate: { key: 'crown_kingdom_castle_gate', label: 'Crown Kingdom Castle Gate', locations: ['Crown Kingdom'] },
  CrownKingdomCastlePanorama: { key: 'crown_kingdom_castle_panorama', label: 'Crown Kingdom Castle Panorama', locations: ['Crown Kingdom'] },
  dancepracticeroom: { key: 'dance_practice_room', label: 'Dance Practice Room', locations: ['Fitness Club'] },
  Eden: { locations: ['Eden'] },
  EdenIndoor: { key: 'eden_interior', label: 'Eden Interior', locations: ['Eden'] },
  EdenLobby: { key: 'eden_lobby', label: 'Eden Lobby', locations: ['Eden'] },
  Elevator: { locations: ['The Ark'] },
  ElevatorOut: { key: 'elevator_exterior', label: 'Elevator Exterior', locations: ['The Ark'] },
  EnikkRoom: { key: 'enikk_room', label: 'Enikk Room', locations: ['The Ark'] },
  FlowerGarden: { key: 'flower_garden', label: 'Flower Garden', locations: ['Flower Park'] },
  FlowerRoad: { key: 'flower_road', label: 'Flower Road', locations: ['Flower Park'] },
  GiantParticleCannon: { key: 'generator_core', label: 'Generator Core', locations: ['Generator'] },
  GoddessOfVictory: { key: 'goddess_of_victory_statue', label: 'Goddess of Victory Statue', locations: ['Goddess of Victory statue'] },
  Gym: { locations: ['Fitness Club'] },
  HarmonyCube: { key: 'radio_tower', label: 'Radio Tower', locations: ['Radio Tower'] },
  Hospital: { locations: ['Hospital'] },
  Hotel: { locations: ['Hotel'] },
  Library: { locations: ['Library'] },
  MachineRoom: { key: 'machine_room', label: 'Machine Room', locations: ['Workshop'] },
  Mafiaoffice: { key: 'mafia_office', label: 'Mafia Office', locations: [] },
  MaidCafe: { key: 'maid_cafe', label: 'Maid Cafe', locations: ['Maid Cafe'] },
  MissilisOffice: { key: 'missilis_office', label: 'Missilis Office', locations: ['The Ark'] },
  NikkeCorridor: { key: 'nikke_corridor', label: 'Nikke Corridor', locations: ['The Ark'] },
  NikkeRoom: { key: 'nikke_room', label: 'Nikke Room', locations: ['The Ark'] },
  Office: { locations: ['The Ark'] },
  OutpostOut: { key: 'outpost_exterior', label: 'Outpost Exterior', locations: ['The Outpost'] },
  Park: { locations: ['Flower Park'] },
  PiratePub: { key: 'pirate_pub', label: 'Pirate Pub', locations: ['Trendy Bar'] },
  Police: { key: 'police_station', label: 'Police Station', locations: ['Police Station'] },
  RestArea: { key: 'guest_camp_rest_area', label: 'Guest Camp Rest Area', locations: ['Guest Camp'] },
  SecretGarden: { key: 'secret_garden', label: 'Secret Garden', locations: ['Eden'] },
  ShoppingMall: { key: 'shopping_mall', label: 'Shopping Mall', locations: ['Shopping Mall'] },
  ShoppingStreet: { key: 'shopping_street', label: 'Shopping Street', locations: ['Shopping Mall'] },
  Stage: { locations: ['Amusement Park'] },
  Station: { locations: ['Train Station'] },
  TemporaryCamp: { key: 'temporary_camp', label: 'Temporary Camp', locations: ['The Outpost', 'Guest Camp'] },
  Theater: { locations: ['Theater'] },
  ToyShop: { key: 'toy_store', label: 'Toy Store', locations: ['Toy Store'] },
  TrainingField: { key: 'training_field', label: 'Training Field', locations: ['The Outpost'] },
  WasteLand_01: { key: 'wasteland_01', label: 'Wasteland 01', locations: ['Wasteland'] },
  WasteLand_02: { key: 'wasteland_02', label: 'Wasteland 02', locations: ['Wasteland'] },
  WasteLand_03: { key: 'wasteland_03', label: 'Wasteland 03', locations: ['Wasteland'] },
  WasteLand_04: { key: 'wasteland_04', label: 'Wasteland 04', locations: ['Wasteland'] },
  Wasteland_03: { key: 'wasteland_03_alt', label: 'Wasteland 03 Alt', locations: ['Wasteland'] },
  WhiteHouse: { key: 'courthouse', label: 'Courthouse', locations: ['Courthouse'] },
  WingOfVictory: { key: 'wings_of_victory_statue', label: 'Wings of Victory Statue', locations: ['Wings of Victory statue'] },
  Winter_AmusementPark: { key: 'winter_amusement_park', label: 'Winter Amusement Park', locations: ['Amusement Park'] },
  Workshop: { locations: ['Workshop'] }
}

const canonicalFilenames = backgroundImagesList as string[]

const stripExtension = (filename: string): string => filename.replace(/\.[^.]+$/, '')

const stripVariantSuffix = (stem: string): string => stem.replace(VARIANT_SUFFIX_REGEX, '')

const getVariantName = (stem: string): string => {
  const match = stem.match(VARIANT_SUFFIX_REGEX)
  if (!match) return 'default'
  return VARIANT_LABELS[match[1].toLowerCase()] || 'default'
}

const normalizeToken = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')

const normalizeFilenameForMatching = (filename: string): string => stripExtension(filename)
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')

const humanizeStem = (stem: string): string => stem
  .replace(/_/g, ' ')
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/([A-Za-z])(\d)/g, '$1 $2')
  .replace(/(\d)([A-Za-z])/g, '$1 $2')
  .replace(/\s+/g, ' ')
  .trim()

const sortVariants = (variants: string[]): string[] => variants
  .slice()
  .sort((a, b) => {
    const aIndex = VARIANT_ORDER.indexOf(a)
    const bIndex = VARIANT_ORDER.indexOf(b)
    if (aIndex !== -1 || bIndex !== -1) {
      const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex
      const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex
      if (safeA !== safeB) return safeA - safeB
    }
    return a.localeCompare(b)
  })

const dedupe = <T>(values: T[]): T[] => Array.from(new Set(values))

const sceneCatalogByKey = new Map<string, BackgroundSceneCatalogEntry>()
const sceneCatalogByFilename = new Map<string, { key: string; variant: string }>()
const canonicalByLowercase = new Map<string, string>()
const canonicalByNormalizedFilename = new Map<string, string[]>()
const canonicalNormalizedCache = new Map<string, string>()
const canonicalByVariant = new Map<string, string[]>()

/**
 * Build the canonical background scene catalog once at module load.
 *
 * The rest of the background flow needs the same source filenames indexed in a few
 * different ways: by semantic scene key, by canonical filename, by typo-tolerant
 * normalized filename, and by variant. Keep these maps in sync so every filename
 * entry can always resolve back to a scene entry.
 */
for (const canonicalFilename of canonicalFilenames) {
  canonicalByLowercase.set(canonicalFilename.toLowerCase(), canonicalFilename)

  const normalizedFilename = normalizeFilenameForMatching(canonicalFilename)
  const existingNormalizedMatches = canonicalByNormalizedFilename.get(normalizedFilename) || []
  existingNormalizedMatches.push(canonicalFilename)
  canonicalByNormalizedFilename.set(normalizedFilename, existingNormalizedMatches)
  canonicalNormalizedCache.set(canonicalFilename, normalizedFilename)

  const stem = stripExtension(canonicalFilename)
  const canonicalStem = stripVariantSuffix(stem)
  const variant = getVariantName(stem)
  const override = BACKGROUND_SCENE_OVERRIDES[canonicalStem] || {}
  const key = override.key || normalizeToken(humanizeStem(canonicalStem))

  let scene = sceneCatalogByKey.get(key)
  if (!scene) {
    scene = {
      key,
      label: override.label || humanizeStem(canonicalStem),
      locations: dedupe(override.locations || []),
      aiSelectable: override.aiSelectable ?? !NON_SELECTABLE_SCENE_STEMS.has(canonicalStem),
      filenamesByVariant: {}
    }
    sceneCatalogByKey.set(key, scene)
  } else if (override.locations?.length) {
    scene.locations = dedupe([...scene.locations, ...override.locations])
  }

  scene.filenamesByVariant[variant] = canonicalFilename
  sceneCatalogByFilename.set(canonicalFilename, { key, variant })

  const filenamesForVariant = canonicalByVariant.get(variant) || []
  filenamesForVariant.push(canonicalFilename)
  canonicalByVariant.set(variant, filenamesForVariant)
}

const sceneCatalogEntries = Array.from(sceneCatalogByKey.values())
const sceneByNormalizedKey = new Map(sceneCatalogEntries.map((scene) => [normalizeToken(scene.key), scene]))
const sceneByNormalizedLabel = new Map(sceneCatalogEntries.map((scene) => [normalizeToken(scene.label), scene]))

const getAvailableScenes = (availableFilenames: Iterable<string>): AvailableBackgroundScene[] => {
  const availableByKey = new Map<string, BackgroundSceneCatalogEntry>()

  for (const canonicalFilename of availableFilenames) {
    const info = sceneCatalogByFilename.get(canonicalFilename)
    if (!info) continue

    const catalogEntry = sceneCatalogByKey.get(info.key)
    if (!catalogEntry) continue

    const existing = availableByKey.get(info.key)
    if (!existing) {
      availableByKey.set(info.key, {
        key: catalogEntry.key,
        label: catalogEntry.label,
        locations: [...catalogEntry.locations],
        aiSelectable: catalogEntry.aiSelectable,
        filenamesByVariant: { [info.variant]: canonicalFilename }
      })
      continue
    }

    existing.filenamesByVariant[info.variant] = canonicalFilename
  }

  return Array.from(availableByKey.values())
    .map((scene) => ({
      ...scene,
      variants: sortVariants(Object.keys(scene.filenamesByVariant))
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

const getSceneForFilename = (filename: string, availableScenes?: AvailableBackgroundScene[]): AvailableBackgroundScene | undefined => {
  if (availableScenes) {
    return availableScenes.find((scene) => Object.values(scene.filenamesByVariant).includes(filename))
  }

  const info = sceneCatalogByFilename.get(filename)
  if (!info) return undefined

  const scene = sceneCatalogByKey.get(info.key)
  if (!scene) return undefined

  return {
    ...scene,
    variants: sortVariants(Object.keys(scene.filenamesByVariant))
  }
}

const normalizeVariant = (value?: string): string => {
  const normalized = normalizeToken(value || '')
  return VARIANT_ALIASES[normalized] || normalized
}

const getPreferredVariantFilename = (scene: AvailableBackgroundScene | BackgroundSceneCatalogEntry, requestedVariant?: string): string | undefined => {
  const normalizedVariant = normalizeVariant(requestedVariant)
  if (normalizedVariant && scene.filenamesByVariant[normalizedVariant]) {
    return scene.filenamesByVariant[normalizedVariant]
  }
  if (scene.filenamesByVariant.default) {
    return scene.filenamesByVariant.default
  }
  const fallbackVariant = sortVariants(Object.keys(scene.filenamesByVariant))[0]
  return fallbackVariant ? scene.filenamesByVariant[fallbackVariant] : undefined
}

/**
 * Compute Damerau-Levenshtein distance where one adjacent transposition counts as a
 * single edit.
 *
 * This is specifically used for uploaded background packs that contain small naming
 * mistakes such as swapped letters in long Crown Kingdom filenames.
 */
const damerauLevenshtein = (source: string, target: string): number => {
  if (source === target) return 0
  if (source.length === 0) return target.length
  if (target.length === 0) return source.length

  const rows = source.length + 1
  const cols = target.length + 1
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))

  for (let i = 0; i < rows; i++) matrix[i][0] = i
  for (let j = 0; j < cols; j++) matrix[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )

      if (
        i > 1
        && j > 1
        && source[i - 1] === target[j - 2]
        && source[i - 2] === target[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost)
      }
    }
  }

  return matrix[source.length][target.length]
}

/**
 * Last-resort fuzzy matcher for user-uploaded background filenames.
 *
 * We first prefer candidates that share the same detected variant (`day`, `night`,
 * etc.). A fuzzy match is accepted only when it is close enough and strictly better
 * than the runner-up so we do not silently map unrelated files to the wrong scene.
 */
const getFuzzyCanonicalMatch = (uploadedFilename: string): string | undefined => {
  const normalizedUploaded = normalizeFilenameForMatching(uploadedFilename)
  if (!normalizedUploaded) return undefined

  const uploadedVariant = getVariantName(stripExtension(uploadedFilename))
  const candidates = canonicalByVariant.get(uploadedVariant) || canonicalFilenames
  // Long filenames can absorb one extra typo without becoming meaningfully ambiguous.
  const threshold = normalizedUploaded.length >= 24 ? 3 : 2

  let bestCandidate = ''
  let bestDistance = Number.MAX_SAFE_INTEGER
  let secondBestDistance = Number.MAX_SAFE_INTEGER

  for (const candidate of candidates) {
    const candidateNormalized = canonicalNormalizedCache.get(candidate) || normalizeFilenameForMatching(candidate)
    const lengthDelta = Math.abs(candidateNormalized.length - normalizedUploaded.length)
    if (lengthDelta > threshold) continue

    const distance = damerauLevenshtein(normalizedUploaded, candidateNormalized)
    if (distance < bestDistance) {
      secondBestDistance = bestDistance
      bestDistance = distance
      bestCandidate = candidate
    } else if (distance < secondBestDistance) {
      secondBestDistance = distance
    }
  }

  if (bestCandidate && bestDistance <= threshold && bestDistance < secondBestDistance) {
    return bestCandidate
  }

  return undefined
}

export const resolveCanonicalBackgroundFilename = (uploadedFilename: string): string | undefined => {
  const exactMatch = canonicalByLowercase.get(uploadedFilename.toLowerCase())
  if (exactMatch) return exactMatch

  const normalizedMatches = canonicalByNormalizedFilename.get(normalizeFilenameForMatching(uploadedFilename))
  if (normalizedMatches?.length === 1) {
    return normalizedMatches[0]
  }

  return getFuzzyCanonicalMatch(uploadedFilename)
}

/**
 * Build a compact semantic shortlist for the AI instead of injecting every loaded
 * filename into the prompt.
 *
 * Priority order:
 * 1. the current scene
 * 2. scenes tied to the currently relevant locations
 * 3. other scenes from the current scene's locations
 * 4. generic fallbacks
 */
export const getBackgroundPromptScenes = (params: {
  availableFilenames: Iterable<string>
  relevantLocations?: string[]
  currentBackgroundFilename?: string
}): BackgroundPromptScene[] => {
  const availableScenes = getAvailableScenes(params.availableFilenames).filter((scene) => scene.aiSelectable)
  if (availableScenes.length === 0) return []

  const relevantLocations = params.relevantLocations || []
  const relevantLocationSet = new Set(relevantLocations)
  const currentScene = params.currentBackgroundFilename
    ? getSceneForFilename(params.currentBackgroundFilename, availableScenes)
    : undefined
  const currentLocationSet = new Set(currentScene?.locations || [])

  const ordered = [
    currentScene,
    ...availableScenes.filter((scene) => scene !== currentScene && scene.locations.some((location) => relevantLocationSet.has(location))),
    ...availableScenes.filter((scene) => scene !== currentScene && !scene.locations.some((location) => relevantLocationSet.has(location)) && scene.locations.some((location) => currentLocationSet.has(location))),
    ...availableScenes.filter((scene) => scene !== currentScene && !scene.locations.some((location) => relevantLocationSet.has(location)) && !scene.locations.some((location) => currentLocationSet.has(location)))
      .sort((a, b) => {
        const aHasLocation = a.locations.length > 0 ? 0 : 1
        const bHasLocation = b.locations.length > 0 ? 0 : 1
        if (aHasLocation !== bHasLocation) return aHasLocation - bHasLocation
        return a.label.localeCompare(b.label)
      })
  ]

  const seen = new Set<string>()
  const shortlist: BackgroundPromptScene[] = []

  for (const scene of ordered) {
    if (!scene || seen.has(scene.key)) continue
    seen.add(scene.key)
    shortlist.push({
      key: scene.key,
      label: scene.label,
      ...(scene.locations.length > 0 ? { locations: scene.locations } : {}),
      ...(scene.variants.length > 1 ? { variants: scene.variants } : {})
    })
    if (shortlist.length >= BACKGROUND_PROMPT_SCENE_LIMIT) break
  }

  return shortlist
}

export const getCurrentBackgroundPromptState = (params: {
  currentBackgroundFilename?: string
  availableFilenames: Iterable<string>
}): CurrentBackgroundPromptState | undefined => {
  if (!params.currentBackgroundFilename) return undefined

  const availableScenes = getAvailableScenes(params.availableFilenames)
  const currentScene = getSceneForFilename(params.currentBackgroundFilename, availableScenes)
  if (!currentScene || !currentScene.aiSelectable) return undefined

  const info = sceneCatalogByFilename.get(params.currentBackgroundFilename)
  if (!info) return undefined

  return {
    key: currentScene.key,
    label: currentScene.label,
    ...(info.variant !== 'default' ? { variant: info.variant } : {}),
    ...(currentScene.locations.length > 0 ? { locations: currentScene.locations } : {})
  }
}

/**
 * Resolve an AI background selection back to a concrete loaded file.
 *
 * This accepts both the legacy filename-style responses and the newer semantic
 * scene-key flow. Resolution order is exact loaded filename, canonicalized filename,
 * then scene key/label plus optional variant selection.
 */
export const resolveBackgroundSelectionToFilename = (params: {
  selection: string
  variant?: string
  availableFilenames: Iterable<string>
}): string | undefined => {
  const trimmedSelection = params.selection.trim()
  if (!trimmedSelection) return undefined

  const availableFilenameSet = new Set(params.availableFilenames)

  if (availableFilenameSet.has(trimmedSelection)) {
    return trimmedSelection
  }

  const canonicalFilename = resolveCanonicalBackgroundFilename(trimmedSelection)
  if (canonicalFilename && availableFilenameSet.has(canonicalFilename)) {
    return canonicalFilename
  }

  const availableScenes = getAvailableScenes(availableFilenameSet)
  const normalizedSelection = normalizeToken(trimmedSelection)
  const scene = availableScenes.find((availableScene) => normalizeToken(availableScene.key) === normalizedSelection)
    || availableScenes.find((availableScene) => normalizeToken(availableScene.label) === normalizedSelection)
    || sceneByNormalizedKey.get(normalizedSelection)
    || sceneByNormalizedLabel.get(normalizedSelection)

  if (!scene) return undefined

  if ('variants' in scene) {
    return getPreferredVariantFilename(scene, params.variant)
  }

  const availableScene = availableScenes.find((candidate) => candidate.key === scene.key)
  return availableScene ? getPreferredVariantFilename(availableScene, params.variant) : undefined
}
