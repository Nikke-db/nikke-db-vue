import { resolveBackgroundSelectionToFilename } from '@/utils/backgroundUtils'

type BackgroundLike = string | { key?: string; variant?: string } | null | undefined

export type BackgroundLoadFeedback = {
  info: string[]
  warnings: string[]
}

export const formatBackgroundFolderLoadFeedback = (params: {
  folderName: string
  matchCount: number
  aliasMatchCount: number
  unmatchedImageCount: number
}): BackgroundLoadFeedback => {
  const info: string[] = []
  const warnings: string[] = []

  if (params.matchCount === 0) {
    warnings.push('[Background Images] No matching background images found. Ensure the background pack was extracted correctly.')
    return { info, warnings }
  }

  info.push(`[Background Images] Loaded ${params.matchCount} background image${params.matchCount === 1 ? '' : 's'} from "${params.folderName}"`)

  if (params.aliasMatchCount > 0) {
    info.push(`[Background Images] Resolved ${params.aliasMatchCount} typo or alias filename${params.aliasMatchCount === 1 ? '' : 's'} to canonical background names.`)
  }

  if (params.unmatchedImageCount > 0) {
    warnings.push(`[Background Images] Ignored ${params.unmatchedImageCount} image file${params.unmatchedImageCount === 1 ? '' : 's'} that do not match the supported background pack.`)
  }

  return { info, warnings }
}

export const resolveAiBackgroundSelection = (params: {
  background: BackgroundLike
  availableFilenames: Iterable<string>
}): { action: 'clear' | 'keep' | 'apply'; filename?: string; label?: string } => {
  const rawBackground = params.background
  const key = typeof rawBackground === 'string'
    ? rawBackground.trim()
    : rawBackground && typeof rawBackground === 'object' && typeof rawBackground.key === 'string'
      ? rawBackground.key.trim()
      : ''
  const variant = rawBackground && typeof rawBackground === 'object' && typeof rawBackground.variant === 'string'
    ? rawBackground.variant.trim()
    : undefined

  if (key === 'none') {
    return { action: 'clear' }
  }

  if (key === '' || key === 'current') {
    return { action: 'keep' }
  }

  const filename = resolveBackgroundSelectionToFilename({
    selection: key,
    variant,
    availableFilenames: params.availableFilenames
  })

  return {
    action: 'apply',
    filename,
    label: variant ? `${key} (${variant})` : key
  }
}
