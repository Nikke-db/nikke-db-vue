import { type StoryCharacterEntry, type CharacterCatalog, buildCharacterCatalog } from '@/utils/storyCharacterUtils'

const PRESETS_STORAGE_KEY = 'nikke_roster_presets'
const MAX_PRESETS = 10

export interface PresetEntry {
  id: string
  name: string
  roster: StoryCharacterEntry[]
  createdAt: number
}

export interface ImportResult {
  merged: number
  skipped: number
  warnings: string[]
}

function isValidRosterEntry(entry: any): entry is StoryCharacterEntry {
  return (
    entry &&
    typeof entry.key === 'string' &&
    typeof entry.selection === 'string' &&
    (entry.source === 'user' || entry.source === 'ai') &&
    (!entry.skinId || typeof entry.skinId === 'string')
  )
}

function validateEntryAgainstCatalog(
  entry: StoryCharacterEntry,
  catalog: CharacterCatalog
): boolean {
  if (entry.selection.startsWith('base::')) {
    const baseName = entry.selection.slice('base::'.length)
    return baseName in catalog.baseMap
  }
  if (entry.selection.startsWith('variant::')) {
    const variantId = entry.selection.slice('variant::'.length)
    return catalog.variants.some((v) => v.id === variantId)
  }
  return false
}

function isValidPreset(preset: any): preset is PresetEntry {
  return (
    preset &&
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    typeof preset.createdAt === 'number' &&
    Array.isArray(preset.roster) &&
    preset.roster.every(isValidRosterEntry)
  )
}

export function loadPresets(): PresetEntry[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidPreset)
  } catch {
    return []
  }
}

function savePresets(presets: PresetEntry[]): void {
  const limited = presets.slice(0, MAX_PRESETS)
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(limited))
}

export function createPreset(name: string, roster: StoryCharacterEntry[]): PresetEntry {
  const presets = loadPresets()
  const entry: PresetEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    roster: [...roster],
    createdAt: Date.now()
  }
  presets.unshift(entry)
  savePresets(presets)
  return entry
}

export function deletePreset(id: string): void {
  const presets = loadPresets()
  savePresets(presets.filter((p) => p.id !== id))
}

export function deleteAllPresets(): void {
  localStorage.removeItem(PRESETS_STORAGE_KEY)
}

export function renamePreset(id: string, name: string): void {
  const presets = loadPresets()
  const preset = presets.find((p) => p.id === id)
  if (preset) {
    preset.name = name.trim()
    savePresets(presets)
  }
}

export function exportAllPresets(): void {
  const presets = loadPresets()
  const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
  a.download = `nikke-roster-presets-${timestamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importPresetsFromFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      let parsed: any
      try {
        const content = reader.result as string
        parsed = JSON.parse(content)
      } catch {
        reject(new Error('Invalid JSON file. Could not parse the file contents.'))
        return
      }

      if (!Array.isArray(parsed)) {
        reject(new Error('Invalid presets file: expected a JSON array of presets.'))
        return
      }

      const catalog = buildCharacterCatalog()
      const existing = loadPresets()
      const result: ImportResult = { merged: 0, skipped: 0, warnings: [] }

      for (const item of parsed) {
        if (!item || typeof item !== 'object') {
          result.skipped++
          result.warnings.push('Skipped an invalid preset entry (not an object).')
          continue
        }
        if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
          result.skipped++
          result.warnings.push('Skipped a preset with no name.')
          continue
        }
        if (!Array.isArray(item.roster)) {
          result.skipped++
          result.warnings.push(`Skipped preset "${item.name}": invalid roster (not an array).`)
          continue
        }

        const validRoster: StoryCharacterEntry[] = []
        let invalidCount = 0

        for (const rosterItem of item.roster) {
          if (!isValidRosterEntry(rosterItem)) {
            invalidCount++
            continue
          }
          if (!validateEntryAgainstCatalog(rosterItem, catalog)) {
            invalidCount++
            continue
          }
          validRoster.push({
            key: rosterItem.key,
            selection: rosterItem.selection,
            skinId: rosterItem.skinId,
            source: rosterItem.source
          })
        }

        if (invalidCount > 0) {
          result.warnings.push(
            `Preset "${item.name}": ${invalidCount} character(s) not found in database — skipped.`
          )
        }

        if (validRoster.length === 0) {
          result.skipped++
          result.warnings.push(
            `Skipped preset "${item.name}": no valid characters after validation.`
          )
          continue
        }

        const presetEntry: PresetEntry = {
          id:
            item.id && typeof item.id === 'string'
              ? item.id
              : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: item.name.trim(),
          roster: validRoster,
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
        }

        const existingIndex = existing.findIndex((p) => p.name.toLowerCase() === presetEntry.name.toLowerCase())
        if (existingIndex >= 0) {
          existing[existingIndex] = presetEntry
        } else {
          existing.unshift(presetEntry)
        }

        result.merged++
      }

      savePresets(existing)
      resolve(result)
    }

    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsText(file)
  })
}
