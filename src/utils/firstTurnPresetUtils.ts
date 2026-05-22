const PRESETS_STORAGE_KEY = 'nikke_first_turn_presets'
const MAX_PRESETS = 10

export interface FirstTurnPresetEntry {
  id: string
  name: string
  message: string
  createdAt: number
}

export interface FirstTurnImportResult {
  merged: number
  skipped: number
  warnings: string[]
}

function isValidFirstTurnPreset(preset: any): preset is FirstTurnPresetEntry {
  return (
    preset &&
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    typeof preset.message === 'string' &&
    typeof preset.createdAt === 'number'
  )
}

export function loadFirstTurnPresets(): FirstTurnPresetEntry[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidFirstTurnPreset)
  } catch {
    return []
  }
}

function saveFirstTurnPresets(presets: FirstTurnPresetEntry[]): void {
  const limited = presets.slice(0, MAX_PRESETS)
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(limited))
}

export function createFirstTurnPreset(name: string, message: string): FirstTurnPresetEntry {
  const presets = loadFirstTurnPresets()
  const entry: FirstTurnPresetEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    message: message,
    createdAt: Date.now()
  }
  presets.unshift(entry)
  saveFirstTurnPresets(presets)
  return entry
}

export function deleteFirstTurnPreset(id: string): void {
  const presets = loadFirstTurnPresets()
  saveFirstTurnPresets(presets.filter((p) => p.id !== id))
}

export function renameFirstTurnPreset(id: string, name: string): void {
  const presets = loadFirstTurnPresets()
  const preset = presets.find((p) => p.id === id)
  if (preset) {
    preset.name = name.trim()
    saveFirstTurnPresets(presets)
  }
}

export function exportAllFirstTurnPresets(): void {
  const presets = loadFirstTurnPresets()
  const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
  a.download = `nikke-first-turn-presets-${timestamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importFirstTurnPresetsFromFile(file: File): Promise<FirstTurnImportResult> {
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

      const existing = loadFirstTurnPresets()
      const result: FirstTurnImportResult = { merged: 0, skipped: 0, warnings: [] }

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
        if (!item.message || typeof item.message !== 'string' || !item.message.trim()) {
          result.skipped++
          result.warnings.push(`Skipped preset "${item.name}": empty message.`)
          continue
        }

        const presetEntry: FirstTurnPresetEntry = {
          id:
            item.id && typeof item.id === 'string'
              ? item.id
              : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: item.name.trim(),
          message: item.message,
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
        }

        const existingIndex = existing.findIndex(
          (p) => p.name.toLowerCase() === presetEntry.name.toLowerCase()
        )
        if (existingIndex >= 0) {
          existing[existingIndex] = presetEntry
        } else {
          existing.unshift(presetEntry)
        }

        result.merged++
      }

      saveFirstTurnPresets(existing)
      resolve(result)
    }

    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsText(file)
  })
}
