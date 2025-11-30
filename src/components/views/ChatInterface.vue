<template>
  <div class="chat-interface">
    <n-button class="settings-btn" circle @click="showSettings = true">
      <template #icon>
        <n-icon><Settings /></n-icon>
      </template>
    </n-button>

    <n-button class="help-btn" circle @click="showGuide = true">
      <template #icon>
        <n-icon><Help /></n-icon>
      </template>
    </n-button>

    <div class="chat-container">
      <div class="chat-history" ref="chatHistoryRef">
      <div v-for="(msg, index) in chatHistory" :key="index" :class="['message', msg.role]">
        <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
        <div v-if="index === chatHistory.length - 1 && !isLoading && msg.role !== 'system'" class="message-actions">
          <n-button size="tiny" circle type="error" @click="deleteLastMessage" title="Delete last message">
            <template #icon><n-icon><TrashCan /></n-icon></template>
          </n-button>
        </div>
      </div>
      <div v-if="isLoading" class="message assistant">
      <div class="message-content">...</div>
      </div>
      </div>

      <div class="chat-input-area" style="gap: 6px;">
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

      <div class="session-controls" style="justify-content: flex-start; gap: 2px;">
      <n-button
      type="error"
      size="small"
      @click="saveSession"
      :disabled="chatHistory.length === 0 || isLoading"
      :style="{ opacity: (chatHistory.length === 0 || isLoading) ? 0.4 : 0.8, transition: 'opacity 0.15s' }"
      >
      <template #icon><n-icon><Save /></n-icon></template>
      Save
      </n-button>
      <n-button type="warning" size="small" @click="triggerRestore" :disabled="isLoading" :style="{ marginLeft: '4px', opacity: isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
      <template #icon><n-icon><Upload /></n-icon></template>
      Load
      </n-button>
      <n-button
        type="error"
        size="small"
        @click="resetSession"
        :disabled="isLoading || chatHistory.length === 0"
        :style="{ marginLeft: '4px', opacity: (chatHistory.length === 0 || isLoading) ? 0.4 : 0.8, transition: 'opacity 0.15s' }"
      >
        <template #icon><n-icon><Reset /></n-icon></template>
        Reset
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
          <n-alert type="info" style="margin-bottom: 12px" title="">
            Your API key is stored locally in your browser's local storage, and it is never sent to Nikke-DB or any other server except the API provider when making requests.
          </n-alert>
          <n-alert type="warning" style="margin-bottom: 12px" title="">
            Users are responsible for any possible cost using this functionality.
          </n-alert>
          <n-alert type="warning" style="margin-bottom: 12px" title="">
            Web search may incur additional costs, even with free models. Please consult your API provider's pricing documentation.
            <n-popover trigger="hover" placement="bottom" style="max-width: 300px">
              <template #trigger>
                <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                  <Help />
                </n-icon>
              </template>
              <div>
                <p>In order to ensure a better quality experience, the model will search the Goddess of Victory: NIKKE Wikia to gather certain details regarding the characters that are part of the scene, such as how they address the Commander, their personality, etc.</p>
                <p>Web search is used on the first turn and when new characters are introduced. The system minimizes searches to reduce costs.</p>
                <p>It is strongly suggested to check your provider's documentation and model page for information regarding possible costs.</p>
                <p>It is also recommended to select a limit on your API key to prevent unexpected charges.</p>
              </div>
            </n-popover>
          </n-alert>
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

    <input
      type="file"
      ref="fileInput"
      style="display: none"
      accept=".json"
      @change="handleFileUpload"
    />

    <n-modal v-model:show="showGuide" :mask-closable="false" preset="card" title="Story/Roleplaying Generator Guide" style="width: 700px; max-width: 95vw;">
      <div class="guide-content">
        <p>In this section you can create interactive stories or roleplay scenarios with Nikke characters using your preferred AI LLM.</p>
        
        <h3>🔑 Getting Started</h3>
        <ul>
          <li><strong>API Key Required:</strong> You need an API key to use this feature. Currently supported providers: <strong>Perplexity</strong>, <strong>Google Gemini</strong>, and <strong>OpenRouter</strong>.</li>
          <li><strong>Setup:</strong> Click the <strong>Settings (Gear Icon)</strong> to enter your API key and select a model.</li>
          <li><strong>Privacy:</strong> Your API key is stored locally and sent only to the selected API provider. Stories and keys are never shared with Nikke-DB; check your provider's policy, as some may use data for training.</li>
          <li><strong>Cost Warning:</strong> Please be aware of your API provider's pricing. Web search (enabled and mandatory for character accuracy) may incur additional costs, even for free models.</li>
        </ul>

        <h3>🎭 Modes</h3>
        <ul>
          <li><strong>Roleplay Mode:</strong> You play as the Commander. The AI controls the Nikkes.
            <ul>
              <li>Use <code>[brackets]</code> for actions or descriptions (e.g., <code>[I nod slowly]</code>).</li>
              <li>Type normally for dialogue (e.g., <code>Good work today, Rapi.</code>).</li>
            </ul>
          </li>
          <li><strong>Story Mode:</strong> You act as the director. The AI generates the narrative.
            <ul>
              <li><strong>Tip:</strong> In your first message, clearly state the <strong>Setting</strong> and <strong>Characters</strong> you want in the scene.</li>
              <li>Example: <code>Scene: The Command Center. Characters: Rapi, Anis, Neon. They are discussing the next mission.</code></li>
            </ul>
          </li>
        </ul>

        <h3>✨ Features</h3>
        <ul>
          <li><strong>Yap Mode:</strong> When enabled in Settings, characters on screen will lip-sync to the generated text.</li>
          <li><strong>Playback Control:</strong>
            <ul>
              <li><strong>Auto:</strong> The story advances automatically after each message, while giving you enough time to read through it.</li>
              <li><strong>Manual:</strong> The story waits for you to click 'Next' or 'Continue'.</li>
            </ul>
          </li>
          <li>If you don't like the last message, you can delete it by clicking the trash can icon on the left side of the message bubble. You can then write something different, or press <strong>Continue</strong>.</li>
          <li>If you do not want to perform any action, simply press <strong>Continue</strong>.</li>
          <li>You can <strong>Save</strong> and <strong>Load</strong> your session at any time.</li>
        </ul>

        <h3>💡 Tips</h3>
        <ul>
          <li>If you receive an error message, use the <strong>Retry</strong> button.</li>
          <li>The quality of the session highly depends on the model that you have selected.</li>
          <li>Be patient. Some providers/models may take a while to respond to the first prompt in particular.</li>
          <li>Check your API usage regularly on your provider's dashboard, and set limits to prevent from overspending or being charged while using a free model.</li>
        </ul>
        
        <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
          <n-button type="primary" @click="closeGuide">Got it!</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useMarket } from '@/stores/market'
import { Settings, Help, Save, Upload, TrashCan, Reset } from '@vicons/carbon'
import { NIcon, NButton, NInput, NDrawer, NDrawerContent, NForm, NFormItem, NSelect, NSwitch, NPopover, NAlert, NModal } from 'naive-ui'
import l2d from '@/utils/json/l2d.json'
import characterHonorifics from '@/utils/json/honorifics.json'
import { marked } from 'marked'
import { animationMappings } from '@/utils/animationMappings'

// Helper to get honorific with fallback to "Commander"
const getHonorific = (characterName: string): string => {
  return (characterHonorifics as Record<string, string>)[characterName] || 'Commander'
}

const market = useMarket()

// Helper for debug logging
const logDebug = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args)
  }
}

// State
const showSettings = ref(false)
const showGuide = ref(false)
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
const fileInput = ref<HTMLInputElement | null>(null)
const openRouterModels = ref<any[]>([])
const isRestoring = ref(false)

// Options
const providerOptions = [
  { label: 'Perplexity', value: 'perplexity' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenRouter', value: 'openrouter' }
]

const modelOptions = computed(() => {
  if (apiProvider.value === 'perplexity') {
    return [
      { label: 'Sonar', value: 'sonar' },
      { label: 'Sonar Pro', value: 'sonar-pro' },
    ]
  } else if (apiProvider.value === 'gemini') {
    return [
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
      { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    ]
  } else if (apiProvider.value === 'openrouter') {
    return openRouterModels.value
  }
  return []
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

watch(mode, (newVal) => {
  localStorage.setItem('nikke_mode', newVal)
})

watch(playbackMode, (newVal) => {
  localStorage.setItem('nikke_playback_mode', newVal)
})

watch(model, (newVal) => {
  if (newVal) localStorage.setItem('nikke_model', newVal)
})

watch(() => market.live2d.yapEnabled, (newVal) => {
  localStorage.setItem('nikke_yap_enabled', String(newVal))
})

watch(apiProvider, async (newVal) => {
  localStorage.setItem('nikke_api_provider', newVal)
  
  if (isRestoring.value) return

  // Reset model when provider changes
  if (apiProvider.value === 'perplexity') {
    model.value = 'sonar'
  } else if (apiProvider.value === 'gemini') {
    model.value = 'gemini-2.5-flash'
  } else if (apiProvider.value === 'openrouter') {
    model.value = ''
    await fetchOpenRouterModels()
    if (openRouterModels.value.length > 0) {
      model.value = openRouterModels.value[0].value
    }
  }
})

const fetchOpenRouterModels = async () => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models')
    const data = await response.json()
    let models = data.data
    
    openRouterModels.value = models.map((m: any) => {
      const isFree = m.pricing.prompt === '0' && m.pricing.completion === '0'

      return {
        label: (isFree ? '[FREE] ' : '') + m.name,
        value: m.id,
        isFree: isFree,
        style: isFree ? { color: '#18a058', fontWeight: 'bold' } : {}
      }
    }).sort((a: any, b: any) => {
      if (a.isFree && !b.isFree) return -1
      if (!a.isFree && b.isFree) return 1

      return a.label.localeCompare(b.label)
    })
    
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error)
  }
}

const checkGuide = () => {
  const seen = localStorage.getItem('chat-guide-seen')
  if (!seen) {
    showGuide.value = true
  }
}

const closeGuide = () => {
  showGuide.value = false
  localStorage.setItem('chat-guide-seen', 'true')
}

const initializeSettings = async () => {
  isRestoring.value = true
  
  // Load simple settings
  const savedMode = localStorage.getItem('nikke_mode')
  if (savedMode && modeOptions.some((m) => m.value === savedMode)) mode.value = savedMode
  
  const savedPlayback = localStorage.getItem('nikke_playback_mode')
  if (savedPlayback && playbackOptions.some((p) => p.value === savedPlayback)) playbackMode.value = savedPlayback
  
  const savedYap = localStorage.getItem('nikke_yap_enabled')
  if (savedYap !== null) market.live2d.yapEnabled = (savedYap === 'true')

  // Load Provider and Model
  const savedProvider = localStorage.getItem('nikke_api_provider')
  const savedModel = localStorage.getItem('nikke_model')
  
  if (savedProvider && providerOptions.some((p) => p.value === savedProvider)) {
    apiProvider.value = savedProvider
    
    if (savedProvider === 'openrouter') {
      await fetchOpenRouterModels()
    }
    
    // Validate and set model
    let validModels: string[] = []

    if (savedProvider === 'perplexity') {
      validModels = ['sonar', 'sonar-pro']
    } else if (savedProvider === 'gemini') {
      validModels = ['gemini-2.5-flash', 'gemini-2.5-pro']
    } else if (savedProvider === 'openrouter') {
      validModels = openRouterModels.value.map((m) => m.value)
    }
    
    if (savedModel && validModels.includes(savedModel)) {
      model.value = savedModel
    } else {
      // Fallback to default if saved model is invalid
      if (savedProvider === 'perplexity') model.value = 'sonar'
      else if (savedProvider === 'gemini') model.value = 'gemini-2.5-flash'
      else if (savedProvider === 'openrouter' && openRouterModels.value.length > 0) model.value = openRouterModels.value[0].value
      
      if (savedModel) {
        console.warn(`Saved model '${savedModel}' is invalid or unavailable. Using default.`)
      }
    }
  }
  
  isRestoring.value = false
}

onMounted(() => {
  checkGuide()
  initializeSettings()
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave((to, from) => {
  if (chatHistory.value.length > 0) {
    const confirmed = window.confirm('Are you sure you want to leave? All unsaved progress will be lost.')
    if (!confirmed) {
      return false
    }
  }
})

// Methods
const deleteLastMessage = () => {
  if (chatHistory.value.length > 0) {
    chatHistory.value.pop()
  }
}

const saveSession = () => {
  const sessionData = {
    chatHistory: chatHistory.value,
    characterProfiles: characterProfiles.value,
    mode: mode.value,
    timestamp: new Date().toISOString(),
    settings: {
      apiProvider: apiProvider.value,
      model: model.value,
      playbackMode: playbackMode.value,
      yapEnabled: market.live2d.yapEnabled
    }
  }
  
  const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
  a.download = `nikke-session-${timestamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const triggerRestore = () => {
  fileInput.value?.click()
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        
        isRestoring.value = true

        if (data.chatHistory && Array.isArray(data.chatHistory)) {
          chatHistory.value = data.chatHistory
        }
        if (data.characterProfiles) {
          characterProfiles.value = data.characterProfiles
        }
        if (data.mode) {
          mode.value = data.mode
        }
        
        // Restore Settings
        if (data.settings) {
          // Restore simple settings
          if (data.settings.playbackMode && playbackOptions.some((p) => p.value === data.settings.playbackMode)) {
            playbackMode.value = data.settings.playbackMode
          }
          
          if (typeof data.settings.yapEnabled === 'boolean') {
            market.live2d.yapEnabled = data.settings.yapEnabled
          }
          
          // Restore Provider and Model
          const savedProvider = data.settings.apiProvider
          const savedModel = data.settings.model
          
          if (savedProvider && providerOptions.some((p) => p.value === savedProvider)) {
            apiProvider.value = savedProvider
            
            if (savedProvider === 'openrouter') {
              await fetchOpenRouterModels()
            }
            
            // Validate and set model
            let validModels: string[] = []
            if (savedProvider === 'perplexity') {
              validModels = ['sonar', 'sonar-pro']
            } else if (savedProvider === 'gemini') {
              validModels = ['gemini-2.5-flash', 'gemini-2.5-pro']
            } else if (savedProvider === 'openrouter') {
              validModels = openRouterModels.value.map((m) => m.value)
            }
            
            if (savedModel && validModels.includes(savedModel)) {
              model.value = savedModel
            } else {
              // Fallback to default if saved model is invalid
              if (savedProvider === 'perplexity') model.value = 'sonar'
              else if (savedProvider === 'gemini') model.value = 'gemini-2.5-flash'
              else if (savedProvider === 'openrouter' && openRouterModels.value.length > 0) model.value = openRouterModels.value[0].value
              
              if (savedModel) {
                chatHistory.value.push({ role: 'system', content: `Warning: Saved model '${savedModel}' is invalid or unavailable. Using default.` })
              }
            }
          }
        }
        
        isRestoring.value = false

        // Clear input value so same file can be selected again if needed
        target.value = ''
        
        // Close settings
        showSettings.value = false
        
        // Scroll to bottom
        scrollToBottom()
        
        // Add system message to confirm restore
        chatHistory.value.push({ role: 'system', content: 'Session restored successfully.' })
        
      } catch (error) {
        console.error('Failed to parse session file:', error)
        chatHistory.value.push({ role: 'system', content: 'Error: Failed to restore session. Invalid JSON file.' })
        isRestoring.value = false
      }
    }
    reader.readAsText(file)
  }
}

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

  let attempts = 0
  const maxAttempts = 3
  let success = false

  while (attempts < maxAttempts && !success && !isStopped.value) {
    attempts++
    try {
      const response = await callAI()
      if (!isStopped.value) {
        await processAIResponse(response)
        success = true
      }
    } catch (error: any) {
      if (error.message === 'JSON_PARSE_ERROR' && attempts < maxAttempts) {
        console.warn(`JSON parse error, retrying (${attempts}/${maxAttempts})...`)
        continue
      }

      console.error('AI Error:', error)
      let errorMessage = 'Error: Failed to get response from AI.'
      showRetry.value = true

      if (error.message && error.message.includes('503')) {
        errorMessage = 'Error 503: Model Overloaded. Please try again.'
      } else if (error.message === 'JSON_PARSE_ERROR') {
        errorMessage = 'Error: Failed to parse AI response after multiple attempts. Please try again.'
      }
      chatHistory.value.push({ role: 'system', content: errorMessage })
      break
    }
  }

  isLoading.value = false
  scrollToBottom()
}

const retryLastMessage = async () => {
  // Remove the last system error message
  if (chatHistory.value.length > 0 && chatHistory.value[chatHistory.value.length - 1].role === 'system') {
    chatHistory.value.pop()
  }

  const text = '[Send as JSON and retry turn]'
  chatHistory.value.push({ role: 'user', content: text })
  scrollToBottom()
  isLoading.value = true
  isStopped.value = false
  showRetry.value = false

  let attempts = 0
  const maxAttempts = 3
  let success = false

  while (attempts < maxAttempts && !success && !isStopped.value) {
    attempts++
    try {
      const response = await callAI()
      if (!isStopped.value) {
        await processAIResponse(response)
        success = true
      }
    } catch (error: any) {
      if (error.message === 'JSON_PARSE_ERROR' && attempts < maxAttempts) {
        console.warn(`JSON parse error, retrying (${attempts}/${maxAttempts})...`)
        continue
      }

      console.error('AI Error:', error)
      let errorMessage = 'Error: Failed to get response from AI.'
      showRetry.value = true

      if (error.message && error.message.includes('503')) {
        errorMessage = 'Error 503: Model Overloaded. Please try again.'
      } else if (error.message === 'JSON_PARSE_ERROR') {
        errorMessage = 'Error: Failed to parse AI response after multiple attempts. Please try again.'
      }
      chatHistory.value.push({ role: 'system', content: errorMessage })
      break
    }
  }

  isLoading.value = false
  scrollToBottom()
}

const stopGeneration = () => {
  isStopped.value = true
  isLoading.value = false

  // If we are waiting for user input (Manual mode), cancel that wait so the loop can exit
  if (waitingForNext.value && nextActionResolver) {
    nextActionResolver()
    nextActionResolver = null
    waitingForNext.value = false
  }
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
  
  const text = mode.value === 'story' 
    ? 'Continue the story. Do not repeat previous events.' 
    : '[Continue the roleplay. Do not repeat the last response.]'
  // Don't add "Continue" to chat history to keep it clean, or add it as a system note?
  // Let's add it as a user prompt but maybe hidden? Or just standard user prompt.
  // For now, standard user prompt is fine to show intent.
  chatHistory.value.push({ role: 'user', content: text })
  scrollToBottom()
  isLoading.value = true
  isStopped.value = false
  showRetry.value = false
  lastPrompt.value = text

  let attempts = 0
  const maxAttempts = 3
  let success = false

  while (attempts < maxAttempts && !success && !isStopped.value) {
    attempts++
    try {
      const response = await callAI()
      if (!isStopped.value) {
        await processAIResponse(response)
        success = true
      }
    } catch (error: any) {
      if (error.message === 'JSON_PARSE_ERROR' && attempts < maxAttempts) {
        console.warn(`JSON parse error, retrying (${attempts}/${maxAttempts})...`)
        continue
      }

      console.error('AI Error:', error)
      let errorMessage = 'Error: Failed to get response from AI.'
      showRetry.value = true

      if (error.message && error.message.includes('503')) {
        errorMessage = 'Error 503: Model Overloaded. Please try again.'
      } else if (error.message === 'JSON_PARSE_ERROR') {
        errorMessage = 'Error: Failed to parse AI response after multiple attempts. Please try again.'
      }
      chatHistory.value.push({ role: 'system', content: errorMessage })
      break
    }
  }

  isLoading.value = false
  scrollToBottom()
}

const callAI = async (): Promise<string> => {
  // Determine if this is the first turn (web search needed for initial characters)
  const isFirstTurn = chatHistory.value.filter((m) => m.role === 'user').length <= 1
  const enableWebSearch = isFirstTurn
  
  logDebug(`[callAI] isFirstTurn: ${isFirstTurn}, enableWebSearch: ${enableWebSearch}`)
  
  const systemPrompt = generateSystemPrompt(enableWebSearch)
  
  // Add current context
  const filteredAnimations = market.live2d.animations.filter((a) => 
    a !== 'talk_start' && 
    a !== 'talk_end' && 
    a !== 'expression_0' && 
    a !== 'action'
  )
  const contextMsg = `Current Character: ${market.live2d.current_id}. Available Animations: ${JSON.stringify(filteredAnimations)}`

  let response: string

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
    response = await callPerplexity(messages, enableWebSearch)
  } else if (apiProvider.value === 'gemini') {
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
    response = await callGemini(messages, enableWebSearch)
  } else if (apiProvider.value === 'openrouter') {
    // OpenRouter: Use standard OpenAI format with context in system prompt
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}`
    
    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...chatHistory.value.map((m) => ({ role: m.role, content: m.content }))
    ]
    logDebug('Sending to OpenRouter:', messages)
    response = await callOpenRouter(messages, enableWebSearch)
  } else {
    throw new Error('Unknown API provider')
  }

  // Check if the model needs to search for new characters
  const searchRequest = await checkForSearchRequest(response)
  if (searchRequest && searchRequest.length > 0) {
    logDebug('[callAI] Model requested search for characters:', searchRequest)
    // Perform search for unknown characters
    await searchForCharacters(searchRequest)
    // Re-call the AI with updated character profiles (search disabled this time)
    return await callAIWithoutSearch()
  }

  return response
}

// Separate function to call AI without search (after character lookup)
const callAIWithoutSearch = async (): Promise<string> => {
  const systemPrompt = generateSystemPrompt(false)
  
  const filteredAnimations = market.live2d.animations.filter((a) => 
    a !== 'talk_start' && 
    a !== 'talk_end' && 
    a !== 'expression_0' && 
    a !== 'action'
  )
  const contextMsg = `Current Character: ${market.live2d.current_id}. Available Animations: ${JSON.stringify(filteredAnimations)}`

  if (apiProvider.value === 'perplexity') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}`
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
    return await callPerplexity(messages, false)
  } else if (apiProvider.value === 'gemini') {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.value.map((m) => ({ role: m.role, content: m.content }))
    ]
    messages.push({ role: 'system', content: contextMsg })
    return await callGemini(messages, false)
  } else if (apiProvider.value === 'openrouter') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}`
    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...chatHistory.value.map((m) => ({ role: m.role, content: m.content }))
    ]
    return await callOpenRouter(messages, false)
  }
  
  throw new Error('Unknown API provider')
}

// Check if the AI response contains a search request for unknown characters
const checkForSearchRequest = async (response: string): Promise<string[] | null> => {
  try {
    let jsonStr = response.replace(/```json\n?|\n?```/g, '').trim()
    const start = jsonStr.indexOf('[')
    const end = jsonStr.lastIndexOf(']')
    
    // Try array format first
    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1)
    }
    
    let data = JSON.parse(jsonStr)
    if (!Array.isArray(data)) {
      data = [data]
    }
    
    // Look for needs_search field in any action
    for (const action of data) {
      if (action.needs_search && Array.isArray(action.needs_search) && action.needs_search.length > 0) {
        // Filter out characters we already have profiles for
        const unknownChars = action.needs_search.filter(
          (name: string) => !characterProfiles.value[name]
        )
        if (unknownChars.length > 0) {
          return unknownChars
        }
      }
    }
  } catch (e) {
    // If parsing fails, no search request
  }
  return null
}

// Search for character information using web search
const searchForCharacters = async (characterNames: string[]): Promise<void> => {
  logDebug('[searchForCharacters] Searching for:', characterNames)
  
  // For Perplexity, search each character individually for better results
  if (apiProvider.value === 'perplexity') {
    await searchForCharactersPerplexity(characterNames)
    return
  }
  
  // For OpenRouter/Gemini, also search individually to ensure all characters are found
  for (const name of characterNames) {
    if (characterProfiles.value[name]) continue

    const searchPrompt = `Search the NIKKE Wiki (https://nikke-goddess-of-victory-international.fandom.com/wiki/) for the character "${name}" and provide their information:
- Find their personality traits, speech patterns/voice, and how they address OTHER NIKKE characters.

IMPORTANT: Do NOT include how they address the Commander - that information is already provided separately.

Return ONLY a JSON object with the character profile in this format:
{
  "${name}": {
    "personality": "Brief personality description",
    "speech_style": "How they speak (formal, casual, archaic, playful, etc.)",
    "relationships": { "OtherNikkeName": "What they CALL them + relationship dynamic (e.g. 'Her Highness - deeply devoted')" }
  }
}
Do NOT include Commander in relationships. Do not include any other text.`

    const messages = [
      { role: 'system', content: 'You are a research assistant. Search the wiki and return character information in JSON format only.' },
      { role: 'user', content: searchPrompt }
    ]

    let attempts = 0
    const maxAttempts = 3
    let success = false

    while (attempts < maxAttempts && !success) {
      attempts++
      try {
        let result: string
        
        if (apiProvider.value === 'gemini') {
          result = await callGemini(messages, true)
        } else {
          result = await callOpenRouter(messages, true)
        }
        
        // Parse and merge character profiles
        let jsonStr = result.replace(/```json\n?|\n?```/g, '').trim()
        const start = jsonStr.indexOf('{')
        const end = jsonStr.lastIndexOf('}')
        if (start !== -1 && end !== -1) {
          jsonStr = jsonStr.substring(start, end + 1)
        }
        
        const profiles = JSON.parse(jsonStr)
        
        // Add character IDs to the profiles for easier reference
        for (const charName of Object.keys(profiles)) {
          const char = l2d.find((c) => c.name.toLowerCase() === charName.toLowerCase())
          if (char) {
            profiles[charName].id = char.id
          }
        }
        
        characterProfiles.value = { ...characterProfiles.value, ...profiles }
        logDebug(`[searchForCharacters] Added profile for ${name}:`, profiles)
        success = true
      } catch (e) {
        console.error(`[searchForCharacters] Attempt ${attempts} failed for ${name}:`, e)
        if (attempts < maxAttempts) {
          // Add a small delay before retrying
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          console.error(`[searchForCharacters] All attempts failed for ${name}. Continuing without search results.`)
        }
      }
    }
  }
}

// Perplexity-specific search: search each character individually for better results
const searchForCharactersPerplexity = async (characterNames: string[]): Promise<void> => {
  logDebug('[searchForCharactersPerplexity] Searching individually for:', characterNames)
  
  for (const name of characterNames) {
    // Skip if we already have this character's profile
    if (characterProfiles.value[name]) {
      logDebug(`[searchForCharactersPerplexity] Skipping ${name} - already have profile`)
      continue
    }
    
    // Build the direct wiki URL for this character's Story page
    // Replace spaces with underscores for wiki URL format
    const wikiName = name.replace(/ /g, '_')
    const storyUrl = `https://nikke-goddess-of-victory-international.fandom.com/wiki/${wikiName}/Story`
    
    // Search prompt pointing directly to the Story page for personality info
    const searchPrompt = `Read this exact wiki page and extract information for NIKKE character "${name}":
${storyUrl}

Find the following information:
1. Personality traits - how they behave, their temperament
2. Speech style - how they talk (formal, casual, archaic, playful, etc.)
3. Relationships with OTHER NIKKEs - what they call them and how they feel about them

IMPORTANT: Do NOT include anything about the Commander - that is provided separately.

Only return information that is ACTUALLY on the wiki page.

Return ONLY a JSON object:
{
  "${name}": {
    "personality": "From the wiki page only",
    "speech_style": "From the wiki page only (e.g. 'archaic/royal language', 'casual', 'formal')",
    "relationships": { "OtherNikkeName": "What they call them + dynamic (e.g. 'Her Highness - deeply devoted')" }
  }
}

Do NOT include Commander in relationships. If you cannot find information, use "Unknown".`

    const messages = [
      { role: 'system', content: 'You are a factual research assistant. You MUST only return information that is explicitly written on the wiki page. Do NOT hallucinate, guess, or embellish. If information is not found, say "Unknown".' },
      { role: 'user', content: searchPrompt }
    ]

    try {
      const result = await callPerplexity(messages, true, storyUrl)
      
      let jsonStr = result.replace(/```json\n?|\n?```/g, '').trim()
      const start = jsonStr.indexOf('{')
      const end = jsonStr.lastIndexOf('}')
      if (start !== -1 && end !== -1) {
        jsonStr = jsonStr.substring(start, end + 1)
      }
      
      const profile = JSON.parse(jsonStr)
      
      // Add character ID
      for (const charName of Object.keys(profile)) {
        const char = l2d.find((c) => c.name.toLowerCase() === charName.toLowerCase())
        if (char) {
          profile[charName].id = char.id
        }
      }
      
      characterProfiles.value = { ...characterProfiles.value, ...profile }
      logDebug(`[searchForCharactersPerplexity] Added profile for ${name}:`, profile)
    } catch (e) {
      console.error(`[searchForCharactersPerplexity] Failed to search for ${name}:`, e)
      // Continue with other characters
    }
  }
  
  logDebug('[searchForCharactersPerplexity] Final profiles:', characterProfiles.value)
}

const generateSystemPrompt = (enableWebSearch: boolean) => {
  const knownCharacterNames = Object.keys(characterProfiles.value)
  
  // Build a minimal character ID lookup for characters mentioned in profiles or current character
  // This prevents massive token usage from including all 200+ characters
  const relevantCharacterIds: string[] = []
  const relevantCharacterNames: string[] = []
  
  // Add current character
  if (market.live2d.current_id) {
    const currentChar = l2d.find((c) => c.id === market.live2d.current_id)
    if (currentChar) {
      relevantCharacterIds.push(`${currentChar.name} = ${currentChar.id}`)
      relevantCharacterNames.push(currentChar.name)
    }
  }
  
  // Add characters from profiles
  for (const name of knownCharacterNames) {
    const char = l2d.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (char && !relevantCharacterIds.some((r) => r.includes(char.id))) {
      relevantCharacterIds.push(`${char.name} = ${char.id}`)
      relevantCharacterNames.push(char.name)
    }
  }
  
  // Build honorifics map for only relevant characters to save tokens
  const relevantHonorifics: Record<string, string> = {}
  for (const name of relevantCharacterNames) {
    relevantHonorifics[name] = (characterHonorifics as Record<string, string>)[name] || 'Commander'
  }
  
  let prompt = `You are the Game Master and Narrator for a Goddess of Victory: NIKKE roleplay.
  
  Mode: ${mode.value === 'roleplay' ? 'Roleplay Mode. The user plays as the Commander. You control all other characters.' : 'Story Mode. You narrate the scene based on user prompts. The user is an observer.'}
  
  CHARACTER HONORIFICS (How each character addresses the Commander - USE THESE EXACTLY):
  ${Object.keys(relevantHonorifics).length > 0 ? JSON.stringify(relevantHonorifics, null, 2) : '(No characters loaded yet - honorifics will be provided once characters appear)'}
  
  HONORIFIC RULES:
  - CRITICAL: When a character speaks TO the Commander, use their honorific from the list above.
  - Example: Neon says "Master" not "Commander". Drake says "Moron" not "Commander".
  - If a character is NOT in the honorifics list, default to "Commander".
  - CRITICAL: These honorifics are EXCLUSIVE to addressing the Commander. When characters address EACH OTHER, use their relationship-specific titles (see KNOWN CHARACTER PROFILES).
  - FAILURE to use the correct honorific is a critical error.
  
  CHARACTER RESEARCH:
  ${enableWebSearch 
    ? `Web search is ENABLED for this turn. You MUST use web search to research the characters involved:
    - Search the NIKKE Wiki: https://nikke-goddess-of-victory-international.fandom.com/wiki/[CharacterName]/Story
    - Find: Personality traits, speech patterns/voice, and how they address OTHER characters (not the Commander).
    - DO NOT search for or store how they address the Commander - that is already provided in CHARACTER HONORIFICS above.
    - Example: Chime speaks in archaic/royal language and calls Crown "Her Highness".
    - Store what you find in the "memory" field (personality, speech_style, relationships only - NO honorifics for Commander).`
    : `Web search is DISABLED. Use the KNOWN CHARACTER PROFILES below for personality and relationship info.
    
    *** IMPORTANT: NEW CHARACTER DETECTION ***
    If a NEW character enters the scene who is NOT listed in KNOWN CHARACTER PROFILES below, you MUST:
    1. Include "needs_search": ["CharacterName"] in your JSON response
    2. The system will then search for their personality/relationships and re-prompt you
    3. Do NOT proceed with dialogue for that character until you have their profile
    
    Example: If Drake enters but is not in the profiles, respond with: { "needs_search": ["Drake"], "text": "Drake enters the room..." }`}
  
  - FAILURE to act according to personality (e.g. Chime accepting insults calmly) is a critical error.
  - FAILURE to mimic the character's unique voice/tone (e.g. Chime's archaic/royal speech) is a critical error.
  - IMPORTANT: Remember that the Commander is a man. Do not use neutral pronouns when characters address him.

  You must output your response in JSON format ONLY. Do not include any text outside the JSON object.
  
  JSON Structure:
  You can return a single object OR an array of objects to play out a scene.
  [
    {
      "needs_search": ["CharacterName1", "CharacterName2"], // CRITICAL: Include this if ANY character in your response is NOT in KNOWN CHARACTER PROFILES. The system will search and re-prompt you.
      "memory": { "CharacterName": { "relationships": { "OtherNikkeName": "How they address them + dynamic" }, "personality": "...", "speech_style": "..." } }, // Store personality and relationships with OTHER NIKKEs only. Do NOT include Commander - honorifics are in CHARACTER HONORIFICS above.
      "text": "The dialogue or narration text to display to the user.",
      "character": "The ID of the character to display on screen (e.g., c010). If no character change is needed, use 'current'. If no character should be shown, use 'none'.",
      "animation": "The name of the animation to play (e.g., idle, happy, angry). Use 'idle' as default.",
      "speaking": true/false, // Set to TRUE ONLY if the character is actually saying words. Set to FALSE for narration, internal thoughts, or descriptions of actions.
      "duration": 2000 // Duration in milliseconds for the animation/speaking.
    }
  ]
  
  KNOWN CHARACTER PROFILES (Use these to maintain consistency - if a character is NOT here, use needs_search):
  ${knownCharacterNames.length > 0 ? JSON.stringify(characterProfiles.value, null, 2) : '(None yet - this is the first turn, use web search to gather information)'}
  
  CHARACTER ID REFERENCE (Use these IDs in the "character" field):
  ${relevantCharacterIds.length > 0 ? relevantCharacterIds.join(', ') : 'No characters loaded yet. Use the character NAME and the system will resolve it.'}
  
  Instructions:
  - If the user uses [], it is a stage direction.
  - CRITICAL: For the "character" field, use the character ID (e.g., "c010") from the CHARACTER ID REFERENCE above, or use the character's NAME if their ID is not listed. The system will resolve names to IDs.
  - Choose the most appropriate character to show based on who is speaking or the focus of the scene.
  - Choose animations that match the emotion.
  - Check the "Available Animations" list provided in the context for the CURRENT character.
  - If the character is the CURRENT one, you MUST pick an animation from that list.
  - SUFFIX GUIDE: "_02" usually indicates HIGH intensity (e.g. furious, laughing), and "_03" usually indicates LOW intensity (e.g. annoyed, chuckling). Use these if they appear in the list and match the scene's intensity.
  - If the character is NEW (not current), prefer using DESCRIPTIVE emotion words (e.g. 'furious', 'annoyed', 'gloom') instead of the generic category if you want to convey intensity. The system will map these to the best available animation (e.g. 'furious' -> 'angry_02').
  - Do NOT use specific suffixes like '_02' for NEW characters. Use the descriptive word (e.g. 'furious') and let the system handle the mapping.
  - If you are unsure, you can use descriptive terms like "very angry" or "furious", and the system will try to map them using these patterns: ${JSON.stringify(animationMappings)}.
  - CRITICAL: Do NOT reset animations to 'idle' during narration steps if the character is still emotional. Only change the animation if the emotion changes or the character calms down.
  - CRITICAL: If a character is performing an action described by the narrator, set 'character' to that character's ID, even if they are not speaking. Only use 'none' if NO character should be visible (e.g. scene transition, or focus on environment).
  - CRITICAL: Set 'speaking' to FALSE if the text is narration (e.g. "Neon looks around nervously.") or internal thought.
  - RULE OF THUMB: If the text does NOT contain quotation marks (" "), 'speaking' MUST be FALSE.
  - Only set 'speaking' to TRUE if the text contains spoken dialogue inside quotation marks.
  - CRITICAL: If the text contains BOTH narration and dialogue (e.g. 'She sighed. "Fine."'), you MUST split it into two separate steps in the array. Step 1: Narration (speaking: false). Step 2: Dialogue (speaking: true).
  - CRITICAL: When a character speaks, you MUST set 'character' to that character's ID. Do NOT use 'current' when switching speakers.
  - In Story Mode, you MUST generate a long, detailed sequence of actions (an array) to play out the scene fully, switching characters as they speak. Do not summarize. Write out the full dialogue.
  - CRITICAL: Do NOT return a single large block of text. Split dialogue and narration into multiple small steps in the array to create a dynamic flow. Each step should be one sentence or one turn of dialogue.
  - CRITICAL: Do NOT output numbered lists, outlines, plans, or thoughts. Output ONLY the JSON array. Do not include any text before or after the JSON.
  - In Story Mode, use THIRD PERSON narration. Refer to the protagonist as "The Commander", NEVER as "you".
  - In Story Mode, NEVER display the Commander sprite. Use 'character': 'none' when the Commander is speaking or acting.
  - In Roleplay Mode, generate 1-3 turns of dialogue/action. If the conversation has stalled, introduce a new topic or event based on the character's personality.
  - CRITICAL: If the user clicks "Continue", DO NOT repeat the last action. ADVANCE the plot or reaction. NEVER repeat the user's dialogue or the last character's dialogue. You must ALWAYS provide a NEW response or reaction.
  - CRITICAL: Do not rephrase the previous turn. Move the story FORWARD.
  - CRITICAL: If you are in Roleplay Mode, NEVER output dialogue that is identical or nearly identical to the User's previous input. You speak for the NPCs. Only perform actions for the user if explicitly instructed in [] or if it is missing from the user's input and absolutely necessary in a logic sense to proceed.
  `
  return prompt
}

const callOpenRouter = async (messages: any[], enableWebSearch: boolean = false) => {
  const requestBody: any = {
    model: model.value,
    messages: messages,
    max_tokens: 8192
  }
  
  if (enableWebSearch) {
    requestBody.plugins = [{ id: 'web' }]
  }
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.value}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'Nikke DB Story Gen',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('OpenRouter API Error Details:', errorData)
    throw new Error(`OpenRouter API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()
  return data.choices[0].message.content
}

const callPerplexity = async (messages: any[], enableWebSearch: boolean = false, searchUrl?: string) => {
  const requestBody: any = {
    model: model.value,
    messages: messages
  }
  
  if (enableWebSearch) {
    // If a specific URL is provided, use the full subdomain for more targeted search
    if (searchUrl) {
      // Extract the subdomain from the URL (e.g., "nikke-goddess-of-victory-international.fandom.com")
      const urlMatch = searchUrl.match(/https?:\/\/([^\/]+)/)
      if (urlMatch) {
        requestBody.search_domain_filter = [urlMatch[1]]
      }
    }
    // No domain filter if no specific URL provided - let Perplexity search freely
    requestBody.web_search_options = {
      search_context_size: 'medium'
    }
  } else {
    // Disable search completely using Perplexity's disable_search parameter
    requestBody.disable_search = true
  }
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.value}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Perplexity API Error Details:', errorData)
    throw new Error(`Perplexity API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()
  return data.choices[0].message.content
}

const callGemini = async (messages: any[], enableWebSearch: boolean = false) => {
  // Gemini API format is different, need to adapt
  
  // Extract system prompt (first message)
  const systemMessage = messages[0]
  
  // Filter out system message and map the rest to Gemini format
  const contents = messages.slice(1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.value}:generateContent?key=${apiKey.value}`
  
  const requestBody: any = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: systemMessage.content }]
    },
    generationConfig: {
      // responseMimeType: "application/json" // Incompatible with tools
    }
  }
  
  if (enableWebSearch) {
    requestBody.tools = [{ googleSearch: {} }]
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
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
  
  // Handle various response formats from Gemini
  if (!data.candidates || data.candidates.length === 0) {
    console.error('Gemini returned no candidates:', data)
    throw new Error('Gemini API Error: No candidates in response')
  }
  
  const candidate = data.candidates[0]
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    console.error('Gemini returned empty content:', candidate)
    throw new Error('Gemini API Error: Empty content in response')
  }
  
  // Find the text part (there might be other parts like function calls when using tools)
  const textPart = candidate.content.parts.find((p: any) => p.text !== undefined)
  if (!textPart) {
    console.error('Gemini returned no text part:', candidate.content.parts)
    throw new Error('Gemini API Error: No text in response')
  }
  
  return textPart.text
}

const sanitizeActions = (actions: any[]) => {
  const newActions: any[] = []
  
  // Helper to identify speaker labels
  // Updated to handle cases where bold tags wrap the colon (e.g. **Name:**)
  const isSpeakerLabel = (s: string) => /^\s*(?:\*\*)?[^*]+?(?:\*\*)?\s*:\s*(?:\*\*)?\s*$/.test(s)

  for (const action of actions) {
    if (!action.text || typeof action.text !== 'string') {
      newActions.push(action)

      continue
    }

    // Check if text contains quotes
    // We look for standard quotes " and smart quotes “ ”
    const hasQuotes = /["“”]/.test(action.text)
    
    if (!hasQuotes) {
      // Case 1: No quotes at all.
      
      // Filter out standalone speaker labels
      if (isSpeakerLabel(action.text)) {
        continue
      }

      // If it was marked as speaking, only force to false if it looks like a stage direction
      if (action.speaking) {
        // Check for stage directions starting with *, (, or [
        if (/^[\s]*[\[\(*]/.test(action.text)) {
          action.speaking = false
        }
        // Otherwise, trust the AI's speaking flag even without quotes
        // This handles cases where the AI forgets quotes around dialogue
      }
      newActions.push(action)

      continue
    }

    // Case 2: Has quotes. We need to split.
    // Regex to match quoted sections including the quotes
    const splitRegex = /([“"][^”"]*[”"])/g
    
    const parts = action.text.split(splitRegex).filter((p: string) => p.trim().length > 0)
    
    if (parts.length === 0) {
      newActions.push(action)

      continue
    }

    // Helper to determine if a part is a quote
    // Use [\s\S] to match any character including newlines
    const isQuote = (s: string) => /^[“"][\s\S]*[”"]$/.test(s.trim())

    // Merge trailing punctuation into previous part to avoid tiny separate messages
    const mergedParts: { text: string, isQuoted: boolean, characterId: string }[] = []
    let effectiveCharacterId = action.character
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const quoted = isQuote(part)
      
      // Filter out standalone speaker labels (e.g. "**Anis:** ")
      // These are often artifacts from splitting "Name: Quote"
      if (isSpeakerLabel(part) && !quoted) {
        continue
      }

      // If this part is just punctuation/space and we have a previous part, merge it
      // This handles cases like: "Hello". -> "Hello" + .
      if (mergedParts.length > 0 && !quoted && /^[.,;!?\s]+$/.test(part)) {
        mergedParts[mergedParts.length - 1].text += part
      } else {
        mergedParts.push({ text: part, isQuoted: quoted, characterId: effectiveCharacterId })
      }
    }

    for (const partObj of mergedParts) {
      // Create new action
      const newAction = { ...action, text: partObj.text, character: partObj.characterId }
      
      if (partObj.isQuoted) {
        newAction.speaking = true
      } else {
        newAction.speaking = false
      }
      
      // Remove fixed duration so it gets recalculated based on text length
      if (newAction.duration) {
        delete newAction.duration
      }
      
      newActions.push(newAction)
    }
  }
  
  return newActions
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

    // Sanitize and split actions to ensure narration/dialogue separation
    data = sanitizeActions(data)

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

    throw new Error('JSON_PARSE_ERROR')
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
    // Filter out any honorific fields and Commander from relationships - we use the static honorifics.json for those
    const filteredMemory: Record<string, any> = {}
    for (const [charName, profile] of Object.entries(data.memory)) {
      if (typeof profile === 'object' && profile !== null) {
        const { honorific_for_commander, honorific_to_commander, honorific, relationships, ...rest } = profile as any
        
        // Filter Commander out of relationships if present
        let filteredRelationships = relationships
        if (relationships && typeof relationships === 'object') {
          const { Commander, commander, ...otherRelationships } = relationships
          filteredRelationships = Object.keys(otherRelationships).length > 0 ? otherRelationships : undefined
        }
        
        filteredMemory[charName] = {
          ...rest,
          ...(filteredRelationships && { relationships: filteredRelationships })
        }
      } else {
        filteredMemory[charName] = profile
      }
    }
    characterProfiles.value = { ...characterProfiles.value, ...filteredMemory }
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
        // Check if the text already starts with the name to avoid duplication
        // We check for "Name:", "**Name:**", "Name :", etc.
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const namePattern = new RegExp(`^\\**${escapedName}\\**\\s*:`, 'i')
        
        // Also check for ANY bolded name at the start (e.g. "**Chime:**") to prevent double naming
        // if the AI messed up the character ID but got the text right.
        const anyNamePattern = /^\*\*[^*]+\*\*:/

        if (!namePattern.test(content) && !anyNamePattern.test(content)) {
          content = `**${name}:** ${content}`
        }
      }
    }

    chatHistory.value.push({ role: 'assistant', content: content })
    scrollToBottom()
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
      // If the text contains a speaker name (e.g. "**Anis:**"), we should try to switch to that character
      // instead of blindly trusting 'current', because the AI often messes this up.
      const speakerMatch = data.text ? data.text.match(/^\s*(?:\*\*)?([^*]+?)(?:\*\*)?\s*:\s*/) : null
      if (speakerMatch) {
        const speakerName = speakerMatch[1].trim()
        // Try to find character by name
        const charObj = l2d.find((c) => c.name.toLowerCase() === speakerName.toLowerCase())
        
        if (charObj && charObj.id !== market.live2d.current_id) {
          logDebug(`[Chat] Detected speaker '${speakerName}' in text. Switching from 'current' to: ${charObj.id}`)
          // Recursively call with corrected character ID
          // We only update the character part, skipping text addition since it's already added
          const newData = { ...data, character: charObj.id, text: null } 
          await executeAction(newData)

          return // Stop execution of this 'current' branch since we delegated to the recursive call
        }
      }

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
    
  // Play Animation
  if (data.animation) {
    logDebug(`[Chat] Requesting animation: ${data.animation}`)
    market.live2d.current_animation = data.animation
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

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (chatHistory.value.length > 0) {
    e.preventDefault()
    e.returnValue = ''
  }
}

const resetSession = () => {
  if (chatHistory.value.length === 0) return
  
  const confirmed = window.confirm('Are you sure you want to reset the story? All unsaved progress will be lost.')
  if (confirmed) {
    chatHistory.value = []
    characterProfiles.value = {}
    lastPrompt.value = ''
    market.live2d.isVisible = false
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

  @media (max-width: 768px) {
    top: 150px;
    right: 10px;
  }
}

.help-btn {
  position: absolute;
  top: 150px;
  right: 70px;
  pointer-events: auto;
  z-index: 1001;

  @media (max-width: 768px) {
    top: 150px;
    right: 60px;
  }
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

  @media (max-width: 768px) {
    left: 10px;
    right: 10px;
    bottom: 10px;
    width: auto;
    max-height: 50vh;
  }
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 10px;
  max-height: 400px;
  
  @media (max-width: 768px) {
    max-height: none;
  }

  .message {
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 8px;
    position: relative;
    
    &.user {
      background: rgba(0, 123, 255, 0.5);
      align-self: flex-end;
      max-width: 85%;
    }
    
    &.assistant {
      background: rgba(255, 255, 255, 0.1);
      max-width: 95%;
    }
    
    &.system {
      color: #ff4d4f;
      font-size: 0.8em;
    }
    
    .message-content {
      color: white;
      word-wrap: break-word;

      :deep(img) {
        max-width: 100%;
        height: auto;
      }
    }

    .message-actions {
      position: absolute;
      bottom: -10px;
      left: 0;
      opacity: 0.5;
      transition: opacity 0.2s;
      
      &:hover {
        opacity: 1;
      }
    }
  }
}

.chat-input-area {
  display: flex;
  gap: 10px;
  align-items: flex-end;

  @media (max-width: 768px) {
    flex-wrap: wrap;
    
    .n-input {
      width: 100%;
      order: 1;
    }
    
    .n-button {
      flex: 1;
      order: 2;
    }
  }
}

.session-controls {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.guide-content {
  padding: 20px;

  h3 {
    margin-top: 16px;
    margin-bottom: 8px;
    font-size: 18px;
    font-weight: bold;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    list-style-type: disc;

    li {
      margin-bottom: 8px;
    }
  }

  code {
    background: rgba(128, 128, 128, 0.2);
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 14px;
  }
}
</style>
