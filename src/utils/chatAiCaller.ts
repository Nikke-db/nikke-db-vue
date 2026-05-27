import { logDebug } from '@/utils/chatUtils'

export interface ProviderCallFunctions {
  callGemini: (messages: any[], enableWebSearch: boolean) => Promise<string>
  callOpenRouter: (messages: any[], searchUrl?: string, enableWebSearch?: boolean) => Promise<string>
  callPollinations: (messages: any[], enableWebSearch: boolean) => Promise<string>
  callOpenCodeGo: (messages: any[]) => Promise<string>
  callLocal: (messages: any[]) => Promise<string>
}

export async function dispatchToProvider(
  provider: string,
  messages: any[],
  enableWebSearch: boolean,
  calls: ProviderCallFunctions
): Promise<string> {
  switch (provider) {
    case 'gemini':
      logDebug('Sending to Gemini:', messages)
      return await calls.callGemini(messages, enableWebSearch)
    case 'opencode-go':
      logDebug('Sending to OpenCode Go:', messages)
      return await calls.callOpenCodeGo(messages)
    case 'openrouter':
      logDebug('Sending to OpenRouter:', messages)
      return await calls.callOpenRouter(messages, undefined, enableWebSearch)
    case 'pollinations':
      logDebug('Sending to Pollinations:', messages)
      return await calls.callPollinations(messages, enableWebSearch)
    case 'local':
      logDebug('Sending to Local:', messages)
      return await calls.callLocal(messages)
    default:
      throw new Error('Unknown API provider')
  }
}

export function buildFirstTurnHonorificsReminder(
  isFirstTurn: boolean,
  isCustomPlayerCharacterActive: boolean,
  activePlayerCharacterName: string,
  knownProfileNames: string[],
  getHonorificFn: (name: string) => string | undefined,
  promptsReminders: Record<string, string>
): string {
  if (!isFirstTurn) return ''

  if (isCustomPlayerCharacterActive) {
    return promptsReminders.playerCharacterReminder.replaceAll('{playerCharacter}', activePlayerCharacterName)
  }

  if (knownProfileNames.length === 0) return ''

  const honorificExamples: string[] = []
  for (const name of knownProfileNames) {
    const honorific = getHonorificFn(name)
    if (honorific && honorific !== 'Commander') {
      honorificExamples.push(`${name} calls the Commander "${honorific}"`)
    }
  }

  if (honorificExamples.length === 0) return ''
  return promptsReminders.honorifics.replace('{examples}', honorificExamples.join('. '))
}

export function injectFirstTurnReminder(messages: any[], reminder: string): any[] {
  if (!reminder) return messages

  const result = [...messages]
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].role === 'user') {
      result[i] = { ...result[i], content: result[i].content + reminder }
      break
    }
  }

  return result
}
