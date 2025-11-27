<template>
  <div class="chat-interface">
    <n-button class="settings-btn" circle @click="showSettings = true">
      <template #icon>
        <n-icon><Settings /></n-icon>
      </template>
    </n-button>

    <div class="chat-container">
      <div class="chat-history" ref="chatHistoryRef">
        <div v-for="(msg, index) in chatHistory" :key="index" :class="['message', msg.role]">
          <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
        </div>
        <div v-if="isLoading" class="message assistant">
          <div class="message-content">...</div>
        </div>
      </div>

      <div class="chat-input-area">
        <n-input
          v-model:value="userInput"
          type="textarea"
          :placeholder="apiKey ? 'Type your message...' : 'Please enter API Key in settings'"
          :disabled="!apiKey"
          :autosize="{ minRows: 1, maxRows: 4 }"
          @keydown.enter.prevent="handleEnter"
        />
        <n-button type="primary" @click="sendMessage" :disabled="isLoading || !userInput.trim() || !apiKey">Send</n-button>
        <n-button type="error" @click="stopGeneration" v-if="isLoading">Stop</n-button>
        <n-button type="warning" @click="retryLastMessage" v-if="showRetry && !isLoading">Retry</n-button>
        <n-button type="success" @click="nextAction" v-if="(waitingForNext || !isLoading) && chatHistory.length > 0">
          {{ waitingForNext ? 'Next' : 'Continue' }}
        </n-button>
      </div>
    </div>

    <n-drawer v-model:show="showSettings" width="300" placement="right">
      <n-drawer-content title="Settings">
        <n-form>
          <n-form-item label="API Provider">
            <n-select v-model:value="apiProvider" :options="providerOptions" />
          </n-form-item>
          <n-form-item label="API Key">
            <n-input v-model:value="apiKey" type="password" show-password-on="click" placeholder="Enter API Key" />
          </n-form-item>
          <n-form-item label="Model">
            <n-select v-model:value="model" :options="modelOptions" />
          </n-form-item>
          <n-form-item>
            <template #label>
              Mode
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  <strong>Roleplay:</strong> Play as the Protagonist (the Commander). Your input in the chatbox is treated as dialogue. Wrap your text in [] for actions and to steer the story.<br><br>
                  <strong>Story:</strong> Automatically generates a story based on your input. It is strongly recommended to enter the names of the characters you want in the scene and its setting in the first prompt. While the story is being played out, you can send more prompts to steer the narrative in the direction you want, or click 'Continue' to advance.
                </div>
              </n-popover>
            </template>
            <n-select v-model:value="mode" :options="modeOptions" />
          </n-form-item>
          <n-form-item>
            <template #label>
              Playback
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  <strong>Auto:</strong> Advances automatically.<br>
                  <strong>Manual:</strong> Click 'Next' to advance.
                </div>
              </n-popover>
            </template>
            <n-select v-model:value="playbackMode" :options="playbackOptions" />
          </n-form-item>
          <n-form-item>
            <template #label>
              Yap Mode
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Enables lip-sync animation when characters speak.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="market.live2d.yapEnabled" />
          </n-form-item>
        </n-form>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useMarket } from '@/stores/market'
import { Settings, Help } from '@vicons/carbon'
import { NIcon, NButton, NInput, NDrawer, NDrawerContent, NForm, NFormItem, NSelect, NSwitch, NPopover } from 'naive-ui'
import l2d from '@/utils/json/l2d.json'
import { marked } from 'marked'

const market = useMarket()

// Helper for debug logging
const logDebug = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

// State
const showSettings = ref(false)
const apiProvider = ref('perplexity')
const apiKey = ref(localStorage.getItem('nikke_api_key') || '')
const model = ref('sonar')
const mode = ref('roleplay')
const playbackMode = ref('auto')
const userInput = ref('')
const isLoading = ref(false)
const isStopped = ref(false)
const waitingForNext = ref(false)
const showRetry = ref(false)
const lastPrompt = ref('')
let nextActionResolver: (() => void) | null = null
let yapTimeoutId: any = null
const chatHistory = ref<{ role: string, content: string }[]>([])
const characterProfiles = ref<Record<string, any>>({})
const chatHistoryRef = ref<HTMLElement | null>(null)

// Options
const providerOptions = [
  { label: 'Perplexity', value: 'perplexity' },
  { label: 'Gemini', value: 'gemini' }
]

const modelOptions = computed(() => {
  if (apiProvider.value === 'perplexity') {
    return [
      { label: 'Sonar', value: 'sonar' },
      { label: 'Sonar Pro', value: 'sonar-pro' },
    ]
  } else {
    return [
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
      { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    ]
  }
})

const modeOptions = [
  { label: 'Roleplay Mode', value: 'roleplay' },
  { label: 'Story Mode', value: 'story' }
]

const playbackOptions = [
  { label: 'Auto', value: 'auto' },
  { label: 'Manual', value: 'manual' }
]

// Watchers
watch(apiKey, (newVal) => {
  localStorage.setItem('nikke_api_key', newVal)
})

watch(apiProvider, () => {
  // Reset model when provider changes
  if (apiProvider.value === 'perplexity') {
    model.value = 'sonar'
  } else {
    model.value = 'gemini-2.5-flash'
  }
})

// Methods
const renderMarkdown = (text: string) => {
  return marked(text)
}

const handleEnter = (e: KeyboardEvent) => {
  if (!e.shiftKey) {
    sendMessage()
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatHistoryRef.value) {
      chatHistoryRef.value.scrollTop = chatHistoryRef.value.scrollHeight
    }
  })
}

const sendMessage = async () => {
  if (!userInput.value.trim() || isLoading.value) return

  const text = userInput.value
  userInput.value = ''
  chatHistory.value.push({ role: 'user', content: text })
  scrollToBottom()
  isLoading.value = true
  isStopped.value = false
  showRetry.value = false
  lastPrompt.value = text

  try {
    const response = await callAI()
    if (!isStopped.value) {
      await processAIResponse(response)
    }
  } catch (error: any) {
    console.error('AI Error:', error)
    let errorMessage = 'Error: Failed to get response from AI.'
    if (error.message && error.message.includes('503')) {
      errorMessage = 'Error 503: Model Overloaded. Please try again.'
      showRetry.value = true
    }
    chatHistory.value.push({ role: 'system', content: errorMessage })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

const retryLastMessage = () => {
  if (lastPrompt.value) {
    userInput.value = lastPrompt.value
    
    // Remove the last system error message
    if (chatHistory.value.length > 0 && chatHistory.value[chatHistory.value.length - 1].role === 'system') {
      chatHistory.value.pop()
    }
    // Remove the last user message (since sendMessage will add it back)
    if (chatHistory.value.length > 0 && chatHistory.value[chatHistory.value.length - 1].role === 'user' && chatHistory.value[chatHistory.value.length - 1].content === lastPrompt.value) {
      chatHistory.value.pop()
    }
    
    sendMessage()
  }
}

const stopGeneration = () => {
  isStopped.value = true
  isLoading.value = false
}

const nextAction = () => {
  if (nextActionResolver) {
    nextActionResolver()
    nextActionResolver = null
    waitingForNext.value = false
  } else if (!isLoading.value) {
    // If no action is pending, request continuation
    continueStory()
  }
}

const continueStory = async () => {
  if (isLoading.value) return
  
  const text = mode.value === 'story' ? 'Continue the story.' : 'Continue.'
  // Don't add "Continue" to chat history to keep it clean, or add it as a system note?
  // Let's add it as a user prompt but maybe hidden? Or just standard user prompt.
  // For now, standard user prompt is fine to show intent.
  chatHistory.value.push({ role: 'user', content: text })
  scrollToBottom()
  isLoading.value = true
  isStopped.value = false
  showRetry.value = false
  lastPrompt.value = text

  try {
    const response = await callAI()
    if (!isStopped.value) {
      await processAIResponse(response)
    }
  } catch (error: any) {
    console.error('AI Error:', error)
    let errorMessage = 'Error: Failed to get response from AI.'
    if (error.message && error.message.includes('503')) {
      errorMessage = 'Error 503: Model Overloaded. Please try again.'
      showRetry.value = true
    }
    chatHistory.value.push({ role: 'system', content: errorMessage })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

const callAI = async () => {
  const systemPrompt = generateSystemPrompt()
  
  // Add current context
  const filteredAnimations = market.live2d.animations.filter((a) => 
    a !== 'talk_start' && 
    a !== 'talk_end' && 
    a !== 'expression_0' && 
    a !== 'action'
  )
  const contextMsg = `Current Character: ${market.live2d.current_id}. Available Animations: ${JSON.stringify(filteredAnimations)}`

  if (apiProvider.value === 'perplexity') {
    // Perplexity: Merge context into system prompt
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}`
    
    // Sanitize history for Perplexity (Strict alternation required)
    // 1. Filter out system messages from history (we provide our own system prompt)
    // 2. Merge consecutive messages of the same role
    const rawHistory = chatHistory.value.filter((m) => m.role !== 'system')
    const sanitizedHistory: any[] = []
    
    if (rawHistory.length > 0) {
      let currentMsg = { role: rawHistory[0].role, content: rawHistory[0].content }
      
      for (let i = 1; i < rawHistory.length; i++) {
        const msg = rawHistory[i]
        if (msg.role === currentMsg.role) {
          currentMsg.content += '\n\n' + msg.content
        } else {
          sanitizedHistory.push(currentMsg)
          currentMsg = { role: msg.role, content: msg.content }
        }
      }
      sanitizedHistory.push(currentMsg)
    }

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...sanitizedHistory
    ]
    logDebug('Sending to Perplexity:', messages)
    return await callPerplexity(messages)
  } else {
    // Gemini: Original behavior (context as separate message at end)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.value.map((m) => ({ role: m.role, content: m.content }))
    ]
    messages.push({
      role: 'system',
      content: contextMsg
    })
    logDebug('Sending to Gemini:', messages)
    return await callGemini(messages)
  }
}

const generateSystemPrompt = () => {
  const characterList = l2d.map((c) => `${c.name} (ID: ${c.id})`).join(', ')
  const isStart = chatHistory.value.length <= 1
  
  let prompt = `You are the Game Master and Narrator for a Goddess of Victory: NIKKE roleplay.
  
  Mode: ${mode.value === 'roleplay' ? 'Roleplay Mode. The user plays as the Commander. You control all other characters.' : 'Story Mode. You narrate the scene based on user prompts. The user is an observer.'}
  
  CRITICAL RESEARCH INSTRUCTION:
  ${isStart ? 'Since this is the START of the conversation, you MUST use the Google Search tool to verify the speech patterns, personality, and backstory of the characters involved on the NIKKE Wiki (https://nikke-goddess-of-victory-international.fandom.com/wiki/). Search for "[Character Name] Nikke Wiki Story" and look for the "Honorific" section. EXAMPLE: Chime calls the Commander "Rapscallion". Also research their personality traits (e.g. Chime is proud and easily offended by doubts about her competence).' : 'Recall the honorifics, personality, and speech patterns you researched at the start of the conversation. Do not search again unless a NEW character is introduced.'}
  - FAILURE to use the correct honorific (e.g. having Chime say "Commander") is a critical error.
  - CRITICAL: The honorifics you find (e.g. "Rapscallion", "Master") are EXCLUSIVE to the Commander. NEVER use them when characters address each other.
  - Research how characters address EACH OTHER. (e.g. Chime calls Crown "Your Majesty").
  - FAILURE to act according to personality (e.g. Chime accepting insults calmly) is a critical error.
  - FAILURE to mimic the character's unique voice/tone (e.g. Chime's archaic/royal speech) is a critical error.

  You must output your response in JSON format ONLY. Do not include any text outside the JSON object.
  
  JSON Structure:
  You can return a single object OR an array of objects to play out a scene.
  [
    {
      "memory": { "CharacterName": { "honorific_for_commander": "...", "relationships": { "OtherCharName": "How they address them" }, "role": "...", "personality": "..." } }, // OPTIONAL: Update this field with any new character info you researched.
      "debug_info": "Search result for [Character]: Found honorific '[Honorific]'",
      "text": "The dialogue or narration text to display to the user.",
      "character": "The ID of the character to display on screen (e.g., c010). If no character change is needed, use 'current'. If no character should be shown, use 'none'.",
      "animation": "The name of the animation to play (e.g., idle, happy, angry). Use 'idle' as default.",
      "speaking": true/false, // Whether the character is speaking (lip-sync)
      "duration": 2000 // Duration in milliseconds for the animation/speaking.
    }
  ]
  
  KNOWN CHARACTER PROFILES (Use these to maintain consistency):
  ${JSON.stringify(characterProfiles.value, null, 2)}

  Available Characters: ${characterList}
  
  Instructions:
  - If the user uses [], it is a stage direction.
  - Choose the most appropriate character to show based on who is speaking or the focus of the scene.
  - Choose animations that match the emotion.
  - Check the "Available Animations" list provided in the context. If you see animations with suffixes like "_02" or "_03", they often indicate intensity variations.
  - "_02" usually means HIGH intensity (e.g. very angry, furious, laughing hard).
  - "_03" usually means LOW intensity (e.g. annoyed, frowning, chuckling).
  - PREFER using the specific animation name from the list (e.g. "angry_02") if it matches the scene's intensity.
  - If you are unsure, you can use descriptive terms like "very angry" or "furious", and the system will try to map them.
  - CRITICAL: Do NOT reset animations to 'idle' during narration steps if the character is still emotional. Only change the animation if the emotion changes or the character calms down.
  - In Story Mode, you MUST generate a long, detailed sequence of actions (an array) to play out the scene fully, switching characters as they speak. Do not summarize. Write out the full dialogue.
  - CRITICAL: Do NOT return a single large block of text. Split dialogue and narration into multiple small steps in the array to create a dynamic flow. Each step should be one sentence or one turn of dialogue.
  - CRITICAL: Do NOT output numbered lists, outlines, plans, or thoughts. Output ONLY the JSON array. Do not include any text before or after the JSON.
  - In Story Mode, use THIRD PERSON narration. Refer to the protagonist as "The Commander", NEVER as "you".
  - In Story Mode, NEVER display the Commander sprite. Use 'character': 'none' when the Commander is speaking or acting.
  - In Roleplay Mode, generate 1-3 turns of dialogue/action. If the user clicks "Continue", DO NOT repeat the last action. ADVANCE the plot or reaction. If the conversation has stalled, introduce a new topic or event based on the character's personality.
  `
  return prompt
}

const callPerplexity = async (messages: any[]) => {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.value}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model.value,
      messages: messages,
      search_domain_filter: ['nikke-goddess-of-victory-international.fandom.com']
    })
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Perplexity API Error Details:', errorData)
    throw new Error(`Perplexity API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()
  return data.choices[0].message.content
}

const callGemini = async (messages: any[]) => {
  // Gemini API format is different, need to adapt
  
  // Extract system prompt (first message)
  const systemMessage = messages[0]
  
  // Filter out system message and map the rest to Gemini format
  const contents = messages.slice(1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.value}:generateContent?key=${apiKey.value}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemMessage.content }]
      },
      tools: [
        { googleSearch: {} }
      ],
      generationConfig: {
        // responseMimeType: "application/json" // Incompatible with tools
      }
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error('Gemini API Error Details:', errorData)
    if (response.status === 503) {
      throw new Error('Gemini API Error: 503 Service Unavailable')
    }
    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}

const processAIResponse = async (responseStr: string) => {
  logDebug('Raw AI Response:', responseStr)
  try {
    // Clean up response if it contains markdown code blocks
    let jsonStr = responseStr.replace(/```json\n?|\n?```/g, '').trim()
    
    // Attempt to extract JSON array if mixed with text
    const start = jsonStr.indexOf('[')
    const end = jsonStr.lastIndexOf(']')
    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1)
    }

    let data = JSON.parse(jsonStr)
    
    if (!Array.isArray(data)) {
      data = [data]
    }

    logDebug('Parsed Action Sequence:', data)

    for (const action of data) {
      if (isStopped.value) {
        logDebug('Execution stopped by user.')
        break
      }
      await executeAction(action)
    }
    
  } catch (e) {
    console.error('Failed to parse JSON response', e)
    // Try to continue by handling the plaintext as action
    const fallbackAction = {
      text: responseStr,
      character: 'current',
      animation: 'idle',
      speaking: true
    }
    await executeAction(fallbackAction)
  }
}

const getCharacterName = (id: string): string | null => {
  if (!id || id === 'none') return null
  if (id === 'current') return getCharacterName(market.live2d.current_id)
  const char = l2d.find((c) => c.id.toLowerCase() === id.toLowerCase() || c.name.toLowerCase() === id.toLowerCase())
  return char ? char.name : id
}

const executeAction = async (data: any) => {
  logDebug('Executing Action:', data)

  // Always reset yapping state to ensure the watcher triggers for the new turn
  market.live2d.isYapping = false
  await new Promise((r) => setTimeout(r, 100))

  // Log debug info
  if (data.debug_info) {
    logDebug('[AI Debug Info]:', data.debug_info)
  }

  if (data.memory) {
    logDebug('[AI Memory Update]:', data.memory)
    characterProfiles.value = { ...characterProfiles.value, ...data.memory }
  }

  // Add text to chat
  if (data.text) {
    let content = data.text
      
    // Add speaker name if speaking
    if (data.speaking) {
      let name = null
        
      if (data.character === 'none') {
        // If character is explicitly none, it's likely the Commander in Story Mode
        if (mode.value === 'story') {
          name = 'Commander'
        }
      } else {
        const charId = (data.character) ? data.character : 'current'
        name = getCharacterName(charId)
      }

      if (name) {
        content = `**${name}:** ${content}`
      }
    }

    chatHistory.value.push({ role: 'assistant', content: content })
    scrollToBottom()
  }
    
  // Play Animation
  if (data.animation) {
    logDebug(`[Chat] Requesting animation: ${data.animation}`)
    market.live2d.current_animation = data.animation
  }

  // Update Character
  if (data.character) {
    // Handle 'none' character
    if (data.character === 'none') {
      logDebug('[Chat] Hiding character sprite')
      market.live2d.isVisible = false
    } 
    // Handle 'current' character
    else if (data.character === 'current') {
      // Ensure visible if it was hidden
      if (!market.live2d.isVisible) {
        logDebug('[Chat] Showing current character sprite')
        market.live2d.isVisible = true
      }
    }
    // Handle specific character switch
    else {
      // Force 'none' if in Story Mode and character is Commander
      if (mode.value === 'story' && (data.character.toLowerCase().includes('commander') || data.character === 'c000')) {
        logDebug('[Chat] Hiding Commander sprite in Story Mode')
        market.live2d.isVisible = false
      } else {
        // Find character object
        // Case-insensitive search for name or ID
        const charObj = l2d.find((c) => 
          c.id.toLowerCase() === data.character.toLowerCase() || 
            c.name.toLowerCase() === data.character.toLowerCase()
        )
          
        if (charObj) {
          // Ensure visible
          logDebug('[Chat] Setting visibility to true')
          market.live2d.isVisible = true
            
          // Check if character is already active to avoid unnecessary reload
          if (charObj.id === market.live2d.current_id) {
            logDebug(`[Chat] Character ${charObj.name} (${charObj.id}) is already active. Skipping reload.`)
            // Force visibility update again just in case
            market.live2d.isVisible = true
          } else {
            logDebug(`[Chat] Switching character to: ${data.character}`)
            const previousLoadTime = market.live2d.finishedLoading
            market.live2d.change_current_spine(charObj)
              
            // Wait for load to complete
            logDebug('[Chat] Waiting for character load...')
            await new Promise<void>((r) => {
              const unwatch = watch(() => market.live2d.finishedLoading, (newVal) => {
                if (newVal > previousLoadTime) {
                  logDebug('[Chat] Character loaded.')
                  unwatch()
                  // Add a small delay to ensure the spine player is fully ready to accept new tracks
                  setTimeout(r, 100)
                }
              })
              // Safety timeout
              setTimeout(() => {
                unwatch()
                r()
              }, 10000)
            })
          }
        } else {
          console.warn(`[Chat] Character not found: ${data.character}`)
        }
      }
    }
  }
    
  // Speaking
  let calculatedYapDuration = 0
  if (data.speaking) {
    logDebug('Starting yap')
      
    // Clear previous timeout if exists
    if (yapTimeoutId) {
      clearTimeout(yapTimeoutId)
      yapTimeoutId = null
    }
      
    market.live2d.isYapping = true
      
    // Calculate yap duration based on text length
    // Approx 60ms per character + 300ms base (Slightly faster than reading speed for natural feel)
    let yapDuration = 3000
    if (data.text) {
      yapDuration = Math.max(1000, data.text.length * 60 + 300)
    } else if (data.duration) {
      yapDuration = data.duration
    }
    calculatedYapDuration = yapDuration
      
    logDebug(`Yap duration calculated: ${yapDuration}ms`)
      
    // Auto-stop yap after calculated duration
    yapTimeoutId = setTimeout(() => {
      if (market.live2d.isYapping) {
        logDebug('Auto-stopping yap based on text length')
        market.live2d.isYapping = false
      }
      yapTimeoutId = null
    }, yapDuration)
  }

  const duration = data.duration || 3000
    
  if (playbackMode.value === 'manual') {
    logDebug('Waiting for user input (Manual Mode)')
    waitingForNext.value = true
    await new Promise<void>((r) => {
      nextActionResolver = r
    })
    // Stop yapping when moving to next (just in case)
    if (data.speaking) {
      market.live2d.isYapping = false
      if (yapTimeoutId) {
        clearTimeout(yapTimeoutId)
        yapTimeoutId = null
      }
    }
  } else {
    // Auto Mode
    // If text is long, ensure we wait long enough to read it
    let autoDuration = Math.max(duration, 2000)
    if (data.text) {
      // Reading speed approx 50ms per char + base
      const readDuration = data.text.length * 50 + 1500
      autoDuration = Math.max(autoDuration, readDuration)
    }

    // Ensure we wait at least 2 seconds after yapping finishes
    if (data.speaking && calculatedYapDuration > 0) {
      autoDuration = Math.max(autoDuration, calculatedYapDuration + 2000)
    }
      
    logDebug(`Waiting for ${autoDuration}ms (Auto Mode)`)
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        if (data.speaking) {
          logDebug('Stopping yap (Auto Mode transition)')
          market.live2d.isYapping = false
        }
        resolve()
      }, autoDuration)
    })
  }
}

</script>

<style scoped lang="less">
.chat-interface {
  position: absolute;
  top: -15px;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; // Let clicks pass through to visualizer
  z-index: 1000;
}

.settings-btn {
  position: absolute;
  top: 150px;
  right: 20px;
  pointer-events: auto;
  z-index: 1001;
}

.chat-container {
  position: absolute;
  bottom: 20px;
  left: 300px;
  width: 400px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 10px;
  padding: 10px;
  pointer-events: auto;
  transition: opacity 0.3s;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 10px;
  max-height: 400px;
  
  .message {
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 8px;
    
    &.user {
      background: rgba(0, 123, 255, 0.5);
      align-self: flex-end;
    }
    
    &.assistant {
      background: rgba(255, 255, 255, 0.1);
    }
    
    &.system {
      color: #ff4d4f;
      font-size: 0.8em;
    }
    
    .message-content {
      color: white;
      word-wrap: break-word;
    }
  }
}

.chat-input-area {
  display: flex;
  gap: 10px;
}
</style>
