import { ref, watch } from 'vue'
import { buildUserReminders, type ReminderToggleState } from '@/utils/chatUtils'

export function useStoryReminders() {
  const showRemindersDropdown = ref(false)
  const invalidJsonToggle = ref(false)
  const invalidJsonPersist = ref(false)
  const invalidJsonAuto = ref(true)
  const emptyActionsRetry = ref(false)
  const honorificsToggle = ref(false)
  const aiControllingUserToggle = ref(false)
  const narrationAndDialogueNotSplitToggle = ref(false)
  const wrongSpeechStylesToggle = ref(false)
  const incorrectAnimationsToggle = ref(false)
  const incorrectAnimationsPersist = ref(false)
  const incorrectSpeakerLabelingToggle = ref(false)
  const narrationAsDialogueToggle = ref(false)
  const wrongCharacterOnScreenToggle = ref(false)
  const npcUsingCommanderHonorificsToggle = ref(false)
  const commanderPresentButSilentToggle = ref(false)

  watch(invalidJsonPersist, (val) => {
    if (val) {
      invalidJsonToggle.value = true
      invalidJsonAuto.value = false
    }
  })

  watch(invalidJsonToggle, (val) => {
    if (val) {
      invalidJsonAuto.value = false
    }
    if (!val) {
      invalidJsonPersist.value = false
    }
  })

  watch(incorrectAnimationsPersist, (val) => {
    if (val) {
      incorrectAnimationsToggle.value = true
    }
  })

  watch(incorrectAnimationsToggle, (val) => {
    if (!val) {
      incorrectAnimationsPersist.value = false
    }
  })

  const getUserReminders = (mode: string, reminders: Record<string, string>, opts?: { playerCharacterName?: string; customPlayerCharacterActive?: boolean }) => {
    const toggles: ReminderToggleState = {
      invalidJson: invalidJsonToggle.value,
      invalidJsonPersist: invalidJsonPersist.value,
      emptyActionsRetry: emptyActionsRetry.value,
      honorifics: honorificsToggle.value,
      narrationAndDialogueNotSplit: narrationAndDialogueNotSplitToggle.value,
      aiControllingUser: aiControllingUserToggle.value,
      wrongSpeechStyles: wrongSpeechStylesToggle.value,
      incorrectAnimations: incorrectAnimationsToggle.value,
      incorrectAnimationsPersist: incorrectAnimationsPersist.value,
      incorrectSpeakerLabeling: incorrectSpeakerLabelingToggle.value,
      narrationAsDialogue: narrationAsDialogueToggle.value,
      wrongCharacterOnScreen: wrongCharacterOnScreenToggle.value,
      npcUsingCommanderHonorifics: npcUsingCommanderHonorificsToggle.value,
      commanderPresentButSilent: commanderPresentButSilentToggle.value
    }
    return buildUserReminders(toggles, mode, reminders, opts)
  }

  const clearRemindersAfterSuccess = () => {
    if (!invalidJsonPersist.value) invalidJsonToggle.value = false
    if (!incorrectAnimationsPersist.value) incorrectAnimationsToggle.value = false
    honorificsToggle.value = false
    narrationAndDialogueNotSplitToggle.value = false
    aiControllingUserToggle.value = false
    wrongSpeechStylesToggle.value = false
    npcUsingCommanderHonorificsToggle.value = false
    commanderPresentButSilentToggle.value = false
  }

  return {
    showRemindersDropdown,
    invalidJsonToggle,
    invalidJsonPersist,
    invalidJsonAuto,
    emptyActionsRetry,
    honorificsToggle,
    aiControllingUserToggle,
    narrationAndDialogueNotSplitToggle,
    wrongSpeechStylesToggle,
    incorrectAnimationsToggle,
    incorrectAnimationsPersist,
    incorrectSpeakerLabelingToggle,
    narrationAsDialogueToggle,
    wrongCharacterOnScreenToggle,
    npcUsingCommanderHonorificsToggle,
    commanderPresentButSilentToggle,
    getUserReminders,
    clearRemindersAfterSuccess
  }
}