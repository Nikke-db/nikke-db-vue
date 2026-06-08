import { ref, watch } from 'vue'
import { loadPresets, createPreset, deletePreset as deletePresetUtil, deleteAllPresets as deleteAllPresetsUtil, renamePreset as renamePresetUtil, exportAllPresets as exportAllPresetsUtil, importPresetsFromFile, type PresetEntry } from '@/utils/rosterPresetUtils'
import { loadFirstTurnPresets, createFirstTurnPreset, deleteFirstTurnPreset as deleteFirstTurnPresetUtil, deleteAllFirstTurnPresets as deleteAllFirstTurnPresetsUtil, exportAllFirstTurnPresets as exportAllFirstTurnPresetsUtil, importFirstTurnPresetsFromFile, updateFirstTurnPreset as updateFirstTurnPresetUtil, type FirstTurnPresetEntry, type FirstTurnPresetUpdate } from '@/utils/firstTurnPresetUtils'
import { parseSelectionValue, type StoryCharacterEntry } from '@/utils/storyCharacterUtils'

interface CharacterCatalog {
  idToName: Record<string, string>
  variants: { id: string; name: string }[]
}

export function usePresets(catalog: CharacterCatalog) {
  const showPresetsModal = ref(false)
  const activePresetTab = ref('roster')

  const presets = ref<PresetEntry[]>([])
  const editingPresetId = ref<string | null>(null)
  const editingPresetName = ref('')
  const deletePresetTarget = ref<string | null>(null)
  const presetImportWarning = ref('')
  const presetImportSuccess = ref('')
  const presetFileInput = ref<HTMLInputElement | null>(null)
  const showSavingPresetInput = ref(false)
  const savingPresetName = ref('')

  const firstTurnPresets = ref<FirstTurnPresetEntry[]>([])
  const deleteFirstTurnPresetTarget = ref<string | null>(null)
  const firstTurnPresetImportWarning = ref('')
  const firstTurnPresetImportSuccess = ref('')
  const firstTurnPresetFileInput = ref<HTMLInputElement | null>(null)
  const showSavingFirstTurnInput = ref(false)
  const savingFirstTurnName = ref('')

  const formatPresetDate = (timestamp: number) => {
    const d = new Date(timestamp)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const formatSessionType = (sessionType?: string) => {
    if (sessionType === 'roleplay') return 'Roleplay'
    if (sessionType === 'story') return 'Story'
    if (sessionType === 'game') return 'Game'
    return ''
  }

  const getPresetCharName = (entry: StoryCharacterEntry) => {
    const parsed = parseSelectionValue(entry.selection)
    if (!parsed) return 'Unknown'
    if (parsed.type === 'base') return parsed.baseName
    const variant = catalog.variants.find((v) => v.id === parsed.variantId)
    return variant ? variant.name.split(':')[0].trim() : parsed.variantId
  }

  const refreshPresetList = () => { presets.value = loadPresets() }
  const refreshFirstTurnPresetList = () => { firstTurnPresets.value = loadFirstTurnPresets() }

  const saveRosterAsPreset = () => {
    showSavingPresetInput.value = true
    savingPresetName.value = ''
  }

  const confirmSavePreset = (rosterRows: StoryCharacterEntry[]) => {
    const name = savingPresetName.value.trim()
    if (!name) return
    createPreset(name, rosterRows)
    showSavingPresetInput.value = false
    savingPresetName.value = ''
    refreshPresetList()
  }

  const cancelSavePreset = () => {
    showSavingPresetInput.value = false
    savingPresetName.value = ''
  }

  const startRename = (preset: PresetEntry) => {
    if (editingPresetId.value === preset.id) {
      editingPresetId.value = null
      editingPresetName.value = ''
      return
    }
    editingPresetId.value = preset.id
    editingPresetName.value = preset.name
  }

  const confirmRename = (id: string) => {
    const name = editingPresetName.value.trim()
    if (!name) {
      editingPresetId.value = null
      editingPresetName.value = ''
      return
    }
    renamePresetUtil(id, name)
    editingPresetId.value = null
    editingPresetName.value = ''
    refreshPresetList()
  }

  const deletePresetConfirm = (id: string) => {
    deletePresetUtil(id)
    deletePresetTarget.value = null
    refreshPresetList()
  }

  const deleteAllPresetsConfirm = () => {
    deleteAllPresetsUtil()
    refreshPresetList()
  }

  const triggerPresetImport = () => { presetFileInput.value?.click() }
  const exportAllPresetsAction = () => exportAllPresetsUtil()

  const handlePresetFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    if (!target.files || target.files.length === 0) return
    const file = target.files[0]
    try {
      const result = await importPresetsFromFile(file)
      refreshPresetList()
      if (result.merged > 0) {
        presetImportSuccess.value = `Imported ${result.merged} preset(s).`
      }
      if (result.warnings.length > 0) {
        presetImportWarning.value = result.warnings.join('\n')
      }
    } catch (e: any) {
      presetImportWarning.value = e?.message || 'Failed to import presets.'
      presetImportSuccess.value = ''
    }
    target.value = ''
  }

  const saveFirstTurnAsPreset = () => {
    showSavingFirstTurnInput.value = true
    savingFirstTurnName.value = ''
  }

  const confirmSaveFirstTurnPreset = (
    userInput: string,
    isCustomPlayer: boolean,
    playerCharacterKey: string | null,
    rosterRows: StoryCharacterEntry[],
    sessionType?: 'roleplay' | 'story' | 'game'
  ) => {
    const name = savingFirstTurnName.value.trim()
    if (!name || !userInput.trim()) return
    createFirstTurnPreset(
      name,
      userInput,
      isCustomPlayer,
      isCustomPlayer && playerCharacterKey ? playerCharacterKey : undefined,
      rosterRows,
      sessionType
    )
    showSavingFirstTurnInput.value = false
    savingFirstTurnName.value = ''
    refreshFirstTurnPresetList()
  }

  const cancelSaveFirstTurnPreset = () => {
    showSavingFirstTurnInput.value = false
    savingFirstTurnName.value = ''
  }

  const updateFirstTurnPresetEntry = (id: string, updates: FirstTurnPresetUpdate) => {
    updateFirstTurnPresetUtil(id, updates)
    refreshFirstTurnPresetList()
  }

  const deleteFirstTurnPresetConfirm = (id: string) => {
    deleteFirstTurnPresetUtil(id)
    deleteFirstTurnPresetTarget.value = null
    refreshFirstTurnPresetList()
  }

  const deleteAllFirstTurnPresetsConfirm = () => {
    deleteAllFirstTurnPresetsUtil()
    refreshFirstTurnPresetList()
  }

  const triggerFirstTurnPresetImport = () => { firstTurnPresetFileInput.value?.click() }
  const exportAllFirstTurnPresetsAction = () => exportAllFirstTurnPresetsUtil()

  const handleFirstTurnPresetFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    if (!target.files || target.files.length === 0) return
    const file = target.files[0]
    try {
      const result = await importFirstTurnPresetsFromFile(file)
      refreshFirstTurnPresetList()
      if (result.merged > 0) {
        firstTurnPresetImportSuccess.value = `Imported ${result.merged} preset(s).`
      }
      if (result.warnings.length > 0) {
        firstTurnPresetImportWarning.value = result.warnings.join('\n')
      }
    } catch (e: any) {
      firstTurnPresetImportWarning.value = e?.message || 'Failed to import presets.'
      firstTurnPresetImportSuccess.value = ''
    }
    target.value = ''
  }

  watch(showPresetsModal, (val) => {
    if (val) {
      refreshPresetList()
      refreshFirstTurnPresetList()
      presetImportWarning.value = ''
      presetImportSuccess.value = ''
      firstTurnPresetImportWarning.value = ''
      firstTurnPresetImportSuccess.value = ''
      editingPresetId.value = null
      editingPresetName.value = ''
      deletePresetTarget.value = null
      deleteFirstTurnPresetTarget.value = null
      activePresetTab.value = 'roster'
    }
  })

  return {
    showPresetsModal,
    activePresetTab,
    presets,
    editingPresetId,
    editingPresetName,
    deletePresetTarget,
    presetImportWarning,
    presetImportSuccess,
    presetFileInput,
    showSavingPresetInput,
    savingPresetName,
    firstTurnPresets,
    deleteFirstTurnPresetTarget,
    firstTurnPresetImportWarning,
    firstTurnPresetImportSuccess,
    firstTurnPresetFileInput,
    showSavingFirstTurnInput,
    savingFirstTurnName,
    formatPresetDate,
    formatSessionType,
    getPresetCharName,
    refreshPresetList,
    refreshFirstTurnPresetList,
    saveRosterAsPreset,
    confirmSavePreset,
    cancelSavePreset,
    startRename,
    confirmRename,
    deletePresetConfirm,
    deleteAllPresetsConfirm,
    triggerPresetImport,
    exportAllPresets: exportAllPresetsAction,
    handlePresetFileUpload,
    saveFirstTurnAsPreset,
    confirmSaveFirstTurnPreset,
    cancelSaveFirstTurnPreset,
    updateFirstTurnPresetEntry,
    deleteFirstTurnPresetConfirm,
    deleteAllFirstTurnPresetsConfirm,
    triggerFirstTurnPresetImport,
    exportAllFirstTurnPresets: exportAllFirstTurnPresetsAction,
    handleFirstTurnPresetFileUpload
  }
}
