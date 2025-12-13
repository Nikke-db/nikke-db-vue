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
        <div v-if="index === chatHistory.length - 1 && !isLoading && msg.role === 'assistant'" class="message-top-actions" style="right: 0; left: auto;">
          <n-button size="tiny" circle type="warning" @click="regenerateResponse" title="Retry this message">
            <template #icon><n-icon><Renew /></n-icon></template>
          </n-button>
        </div>
        <div v-if="index === chatHistory.length - 1 && !isLoading && msg.role !== 'system'" class="message-actions">
          <n-button size="tiny" circle type="error" @click="deleteLastMessage" title="Delete last message">
            <template #icon><n-icon><TrashCan /></n-icon></template>
          </n-button>
        </div>
      </div>
      <div v-if="isLoading" class="message assistant">
        <div class="message-content loading-container">
          <n-spin size="small" v-if="isGenerating" />
          <transition name="fade" mode="out-in">
            <span :key="loadingStatus" class="loading-text">{{ loadingStatus }}</span>
          </transition>
        </div>
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
            Your API key is stored locally in your browser's local storage, and it is never sent to Nikke-DB.
          </n-alert>
          <n-alert type="warning" style="margin-bottom: 12px" title="">
            Users are responsible for any possible cost using this functionality.
          </n-alert>
          <n-alert type="warning" style="margin-bottom: 12px" title="">
            Web search may incur additional costs. Enable 'Use Nikke-DB Knowledge' to reduce reliance on web search.
            <n-popover trigger="hover" placement="bottom" style="max-width: 300px">
              <template #trigger>
                <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                  <Help />
                </n-icon>
              </template>
              <div>
                <p>In order to ensure a better quality experience, the model will search the Goddess of Victory: NIKKE Wikia to gather certain details regarding the characters that are part of the scene, such as how they address the Commander, their personality, etc.</p>
                <p>Web search is used on the first turn and when new characters are introduced. You can disable this by enabling "Use Nikke-DB Knowledge".</p>
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
              Use Nikke-DB Knowledge <span style="font-size: smaller;">(Recommended)</span>
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Uses Nikke-DB's built-in character knowledge when available instead of searching the web.<br><br>
                  Faster and saves API costs.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="useLocalProfiles" />
          </n-form-item>

          <n-form-item v-if="useLocalProfiles">
            <template #label>
              Allow Web Search Fallback <span style="font-size: smaller;">(Recommended)</span>
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  If a character is not found in the local profiles, allow the model to search the web. Note that this may incur extra costs, depending on your API provider and model.<br><br>
                  If disabled, the model will rely on its internal knowledge for unknown characters and may degrade the experience.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="allowWebSearchFallback" />
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
              Tokens Usage
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Controls how often the story is summarized to save tokens. Will affect costs and speed.<br><br>Does not affect the Save and Load functionality.<br><br>
                  <strong>Low:</strong> Summarizes every 10 turns. Cost-efficient.<br>
                  <strong>Medium:</strong> Summarizes every 30 turns. Balanced.<br>
                  <strong>High:</strong> Summarizes every 60 turns. Uses more tokens.<br>
                  <strong>Goddess:</strong> Disables summarization and sends the full history to the model on every turn. This may result in higher costs and slower responses in time, but provides the best context for the AI.
                </div>
              </n-popover>
            </template>
            <n-select v-model:value="tokenUsage" :options="tokenUsageOptions" />
          </n-form-item>

          <n-form-item v-if="isDev">
            <template #label>
              Context Caching <span style="font-size: smaller;">(Experimental)</span>
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Adds explicit caching headers for supported models (Claude, Gemini) on OpenRouter.<br><br>
                  Significantly reduces costs for long conversations by caching the history.<br>
                  Other models (OpenAI, DeepSeek) cache automatically without this setting.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="enableContextCaching" />
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

          <n-form-item>
            <template #label>
              Text to Speech <span style="font-size: smaller;">(Experimental)</span>
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Enables TTS using a local TTS server.<br>
                  Supports AllTalk (XTTSv2) or GPT-SoVits.<br><br>
                  Character voices must be in the appropriate voices folder.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="ttsEnabled" />
          </n-form-item>

          <n-form-item label="TTS Provider" v-if="ttsEnabled">
            <n-select v-model:value="ttsProvider" :options="ttsProviderOptions" />
          </n-form-item>

          <n-form-item label="AllTalk Endpoint" v-if="ttsEnabled && ttsProvider === 'alltalk'">
            <n-input v-model:value="ttsEndpoint" placeholder="http://localhost:7851" />
          </n-form-item>

          <n-form-item label="GPT-SoVits Endpoint" v-if="ttsEnabled && ttsProvider === 'gptsovits'">
            <n-input v-model:value="gptSovitsEndpoint" placeholder="http://localhost:9880" />
          </n-form-item>

          <n-form-item v-if="ttsEnabled && ttsProvider === 'gptsovits'">
            <template #label>
              GPT-SoVits Base Path
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Path to your GPT-SoVits installation folder.<br>
                  Voice files should be at: <code>{basePath}/voices/{character}/{character}.wav</code><br>
                  Prompt text at: <code>{basePath}/voices/{character}/{character}.txt</code>
                </div>
              </n-popover>
            </template>
            <n-input v-model:value="gptSovitsBasePath" placeholder="C:/GPT-SoVITS" />
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
          <li><strong>Cost Warning:</strong> Please be aware of your API provider's pricing. Web search (enabled by default for character accuracy) may incur additional costs. You can disable it in Settings by enabling "Use Nikke-DB Knowledge".</li>
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
import { Settings, Help, Save, Upload, TrashCan, Reset, Renew } from '@vicons/carbon'
import { NIcon, NButton, NInput, NDrawer, NDrawerContent, NForm, NFormItem, NSelect, NSwitch, NPopover, NAlert, NModal, NSpin } from 'naive-ui'
import l2d from '@/utils/json/l2d.json'
import characterHonorifics from '@/utils/json/honorifics.json'
import localCharacterProfiles from '@/utils/json/characterProfiles.json'
import loadingMessages from '@/utils/json/loadingMessages.json'
import prompts from '@/utils/json/prompts.json'
import { marked } from 'marked'
import { animationMappings } from '@/utils/animationMappings'
import { cleanWikiContent, sanitizeActions, splitNarration, parseFallback, parseAIResponse, isWholeWordPresent } from '@/utils/chatUtils'
import { normalizeAiActionCharacterData } from '@/utils/aiActionNormalization'

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
const useLocalProfiles = ref(localStorage.getItem('nikke_use_local_profiles') === 'true')
const allowWebSearchFallback = ref(localStorage.getItem('nikke_allow_web_search_fallback') === 'true')
const apiProvider = ref('perplexity')
const apiKey = ref(localStorage.getItem('nikke_api_key') || '')
const model = ref('sonar')
const mode = ref('roleplay')
const tokenUsage = ref('medium')
const enableContextCaching = ref(true)
const playbackMode = ref('auto')
const ttsEnabled = ref(false)
const ttsEndpoint = ref('http://localhost:7851')
const ttsProvider = ref<'alltalk' | 'gptsovits'>('alltalk')
const gptSovitsEndpoint = ref('http://localhost:9880')
const gptSovitsBasePath = ref('C:/GPT-SoVITS')
const gptSovitsPromptTextCache = new Map<string, string>()
const userInput = ref('')
const isLoading = ref(false)
const isGenerating = ref(false)
const loadingStatus = ref('')
const isStopped = ref(false)
const waitingForNext = ref(false)
const showRetry = ref(false)
const lastPrompt = ref('')
const storySummary = ref('')
const lastSummarizedIndex = ref(0)
const summarizationRetryPending = ref(false)
const summarizationAttemptCount = ref(0)
const summarizationLastError = ref<string | null>(null)
let nextActionResolver: (() => void) | null = null
let yapTimeoutId: any = null
const chatHistory = ref<{ role: string, content: string }[]>([])
const characterProfiles = ref<Record<string, any>>({})
const characterProgression = ref<Record<string, any>>({})

// Effective profiles = base profiles + progression overlays (personality + relationships only)
const effectiveCharacterProfiles = computed<Record<string, any>>(() => {
  const base = characterProfiles.value || {}
  const progression = characterProgression.value || {}
  const merged: Record<string, any> = {}

  const progressionKeys = Object.keys(progression)

  for (const [name, profile] of Object.entries(base)) {
    const outProfile = profile && typeof profile === 'object' && !Array.isArray(profile) ? { ...(profile as any) } : profile
    const progKey = progressionKeys.find((k) => k.toLowerCase() === name.toLowerCase())
    const update = progKey ? (progression as any)[progKey] : undefined

    if (outProfile && typeof outProfile === 'object' && !Array.isArray(outProfile) && update && typeof update === 'object') {
      if ((update as any).personality) {
        ;(outProfile as any).personality = (update as any).personality
      }

      if ((update as any).relationships && typeof (update as any).relationships === 'object') {
        ;(outProfile as any).relationships = {
          ...((outProfile as any).relationships || {}),
          ...((update as any).relationships || {})
        }
      }
    }

    merged[name] = outProfile
  }

  return merged
})
const chatHistoryRef = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const openRouterModels = ref<any[]>([])
const isRestoring = ref(false)
const needsJsonReminder = ref(false)
const modelsWithoutJsonSupport = new Set<string>() // Track models that don't support json_object
const isDev = import.meta.env.DEV

// Helper to set random loading message
const setRandomLoadingMessage = () => {
  loadingStatus.value = loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
}

// Models/providers that have native web search in OpenRouter
const NATIVE_SEARCH_PREFIXES = ['openai/', 'anthropic/', 'perplexity/', 'x-ai/']
const hasNativeSearch = (modelId: string) => NATIVE_SEARCH_PREFIXES.some(prefix => modelId.startsWith(prefix))

// Options
const providerOptions = [
  { label: 'Perplexity', value: 'perplexity' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenRouter', value: 'openrouter' }
]

const ttsProviderOptions = [
  { label: 'AllTalk (XTTSv2)', value: 'alltalk' },
  { label: 'GPT-SoVits', value: 'gptsovits' }
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

const tokenUsageOptions = [
  { label: 'Low (10 turns)', value: 'low' },
  { label: 'Medium (30 turns)', value: 'medium' },
  { label: 'High (60 turns)', value: 'high' },
  { label: 'Goddess', value: 'goddess' }
]

// Watchers
watch(apiKey, (newVal) => {
  localStorage.setItem('nikke_api_key', newVal)
})

watch(useLocalProfiles, (newVal) => {
  localStorage.setItem('nikke_use_local_profiles', String(newVal))
})

watch(allowWebSearchFallback, (newVal) => {
  localStorage.setItem('nikke_allow_web_search_fallback', String(newVal))
})

watch(mode, (newVal) => {
  localStorage.setItem('nikke_mode', newVal)
})

watch(tokenUsage, (newVal) => {
  localStorage.setItem('nikke_token_usage', newVal)
})

watch(enableContextCaching, (newVal) => {
  localStorage.setItem('nikke_enable_context_caching', String(newVal))
})

watch(playbackMode, (newVal) => {
  localStorage.setItem('nikke_playback_mode', newVal)
})

watch(ttsEnabled, (newVal) => {
  localStorage.setItem('nikke_tts_enabled', String(newVal))
})

watch(ttsEndpoint, (newVal) => {
  localStorage.setItem('nikke_tts_endpoint', newVal)
})

watch(ttsProvider, (newVal) => {
  localStorage.setItem('nikke_tts_provider', newVal)
})

watch(gptSovitsEndpoint, (newVal) => {
  localStorage.setItem('nikke_gptsovits_endpoint', newVal)
})

watch(gptSovitsBasePath, (newVal) => {
  localStorage.setItem('nikke_gptsovits_basepath', newVal)
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

  const savedTts = localStorage.getItem('nikke_tts_enabled')
  if (savedTts !== null) ttsEnabled.value = (savedTts === 'true')

  const savedTtsEndpoint = localStorage.getItem('nikke_tts_endpoint')
  if (savedTtsEndpoint) ttsEndpoint.value = savedTtsEndpoint

  const savedTtsProvider = localStorage.getItem('nikke_tts_provider')
  if (savedTtsProvider === 'alltalk' || savedTtsProvider === 'gptsovits') ttsProvider.value = savedTtsProvider

  const savedGptSovitsEndpoint = localStorage.getItem('nikke_gptsovits_endpoint')
  if (savedGptSovitsEndpoint) gptSovitsEndpoint.value = savedGptSovitsEndpoint

  const savedGptSovitsBasePath = localStorage.getItem('nikke_gptsovits_basepath')
  if (savedGptSovitsBasePath) gptSovitsBasePath.value = savedGptSovitsBasePath

  const savedTokenUsage = localStorage.getItem('nikke_token_usage')
  if (savedTokenUsage && tokenUsageOptions.some((t) => t.value === savedTokenUsage)) tokenUsage.value = savedTokenUsage

  const savedContextCaching = localStorage.getItem('nikke_enable_context_caching')
  if (savedContextCaching !== null) enableContextCaching.value = (savedContextCaching === 'true')

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

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (chatHistory.value.length > 0) {
    e.preventDefault()
    e.returnValue = ''
  }
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
    characterProgression: characterProgression.value,
    storySummary: storySummary.value,
    lastSummarizedIndex: lastSummarizedIndex.value,
    mode: mode.value,
    timestamp: new Date().toISOString(),
    settings: {
      apiProvider: apiProvider.value,
      model: model.value,
      playbackMode: playbackMode.value,
      yapEnabled: market.live2d.yapEnabled,
      ttsEnabled: ttsEnabled.value,
      ttsEndpoint: ttsEndpoint.value,
      ttsProvider: ttsProvider.value,
      gptSovitsEndpoint: gptSovitsEndpoint.value,
      gptSovitsBasePath: gptSovitsBasePath.value,
      tokenUsage: tokenUsage.value,
      enableContextCaching: enableContextCaching.value,
      useLocalProfiles: useLocalProfiles.value,
      allowWebSearchFallback: allowWebSearchFallback.value
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
        if (data.characterProgression) {
          characterProgression.value = data.characterProgression
        }
        if (data.storySummary) {
          storySummary.value = data.storySummary
        }
        if (data.lastSummarizedIndex !== undefined) {
          lastSummarizedIndex.value = data.lastSummarizedIndex
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

          if (typeof data.settings.ttsEnabled === 'boolean') {
            ttsEnabled.value = data.settings.ttsEnabled
          }
          
          if (data.settings.ttsEndpoint) {
            ttsEndpoint.value = data.settings.ttsEndpoint
          }

          if (data.settings.ttsProvider === 'alltalk' || data.settings.ttsProvider === 'gptsovits') {
            ttsProvider.value = data.settings.ttsProvider
          }

          if (data.settings.gptSovitsEndpoint) {
            gptSovitsEndpoint.value = data.settings.gptSovitsEndpoint
          }

          if (data.settings.gptSovitsBasePath) {
            gptSovitsBasePath.value = data.settings.gptSovitsBasePath
          }

          if (data.settings.tokenUsage && tokenUsageOptions.some((t) => t.value === data.settings.tokenUsage)) {
            tokenUsage.value = data.settings.tokenUsage
          }

          if (typeof data.settings.enableContextCaching === 'boolean') {
            enableContextCaching.value = data.settings.enableContextCaching
          }

          if (typeof data.settings.useLocalProfiles === 'boolean') {
            useLocalProfiles.value = data.settings.useLocalProfiles
          }

          if (typeof data.settings.allowWebSearchFallback === 'boolean') {
            allowWebSearchFallback.value = data.settings.allowWebSearchFallback
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

        // FIX: Ensure we have a context window of at least 10 messages upon restore
        // This prevents the AI from relying solely on potentially outdated summaries
        if (tokenUsage.value !== 'goddess' && chatHistory.value.length > 0) {
          const safeBuffer = 10
          // If the current summarized index leaves less than safeBuffer messages, pull it back
          if (chatHistory.value.length - lastSummarizedIndex.value < safeBuffer) {
             lastSummarizedIndex.value = Math.max(0, chatHistory.value.length - safeBuffer)
             // We can't use logDebug here easily as it might not be in scope or I'd have to check imports, 
             // but console.log is safe.
             console.log(`[Restore] Adjusted lastSummarizedIndex to ${lastSummarizedIndex.value} to ensure context buffer`)
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
  isGenerating.value = true
  setRandomLoadingMessage()
  isStopped.value = false
  showRetry.value = false
  lastPrompt.value = text

  let attempts = 0
  const maxAttempts = 3
  let success = false

  while (attempts < maxAttempts && !success && !isStopped.value) {
    attempts++
    try {
      const response = await callAI(attempts > 1)
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

      if (error.message === 'RATE_LIMITED') {
        errorMessage = 'Error 429: Model is temporarily rate-limited. Please wait a moment and click Retry.'
      } else if (error.message && error.message.includes('503')) {
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

  scrollToBottom()
  isLoading.value = true
  isGenerating.value = true
  setRandomLoadingMessage()
  isStopped.value = false
  showRetry.value = false

  let attempts = 0
  const maxAttempts = 3
  let success = false

  while (attempts < maxAttempts && !success && !isStopped.value) {
    attempts++
    try {
      const response = await callAI(attempts > 1)
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

      if (error.message === 'RATE_LIMITED') {
        errorMessage = 'Error 429: Model is temporarily rate-limited. Please wait a moment and click Retry.'
      } else if (error.message && error.message.includes('503')) {
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

const regenerateResponse = async () => {
  if (chatHistory.value.length > 0) {
    const lastMsg = chatHistory.value[chatHistory.value.length - 1]
    // Only allow regenerating assistant messages
    if (lastMsg.role === 'assistant') {
      chatHistory.value.pop()
      await retryLastMessage()
    }
  }
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
    ? prompts.continue.story 
    : prompts.continue.roleplay
  // Don't add "Continue" to chat history to keep it clean, or add it as a system note?
  // Let's add it as a user prompt but maybe hidden? Or just standard user prompt.
  // For now, standard user prompt is fine to show intent.
  chatHistory.value.push({ role: 'user', content: text })
  scrollToBottom()
  isLoading.value = true
  isGenerating.value = true
  setRandomLoadingMessage()
  isStopped.value = false
  showRetry.value = false
  lastPrompt.value = text

  let attempts = 0
  const maxAttempts = 3
  let success = false

  while (attempts < maxAttempts && !success && !isStopped.value) {
    attempts++
    try {
      const response = await callAI(attempts > 1)
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

const callAI = async (isRetry: boolean = false): Promise<string> => {
  // Determine if this is the first turn (web search needed for initial characters)
  const isFirstTurn = chatHistory.value.filter((m) => m.role === 'user').length <= 1
  
  // If using local profiles, we disable initial web search to force the "needs_search" flow
  // This allows us to check local JSON first before falling back to web search
  const enableWebSearch = isFirstTurn && !useLocalProfiles.value
  
  // If using local profiles, pre-load profiles for any characters mentioned in the first prompt
  if (isFirstTurn && useLocalProfiles.value && chatHistory.value.length > 0) {
    const firstPrompt = chatHistory.value[chatHistory.value.length - 1].content
    // Use whole word matching to avoid substring matches (e.g. "Crow" from "Crown")
    const localNames = Object.keys(localCharacterProfiles)
    const foundNames = localNames.filter(name => 
      isWholeWordPresent(firstPrompt, name)
    )
    
    if (foundNames.length > 0) {
      logDebug('[callAI] Pre-loading local profiles for:', foundNames)
      await searchForCharacters(foundNames)
    }
  }
  
  logDebug(`[callAI] isFirstTurn: ${isFirstTurn}, enableWebSearch: ${enableWebSearch}`)
  
  const systemPrompt = generateSystemPrompt(enableWebSearch)
  let retryInstruction = isRetry ? prompts.reminders.retry : ''
  
  if (needsJsonReminder.value) {
      retryInstruction += prompts.reminders.json
      needsJsonReminder.value = false
  }
  
  // Add current context
  const filteredAnimations = market.live2d.animations.filter((a) => 
    a !== 'talk_start' && 
    a !== 'talk_end' && 
    a !== 'expression_0' && 
    a !== 'action'
  )
  let contextMsg = `Current Character: ${market.live2d.current_id}. Available Animations: ${JSON.stringify(filteredAnimations)}`

  // Optimization: Limit history to prevent token overflow
  // Tumbling window: Summarize every X turns
  
  let historyLimit = 30
  if (tokenUsage.value === 'low') historyLimit = 10
  else if (tokenUsage.value === 'medium') historyLimit = 30
  else if (tokenUsage.value === 'high') historyLimit = 60
  else if (tokenUsage.value === 'goddess') historyLimit = 99999 // Effectively infinite

  if (tokenUsage.value !== 'goddess') {
    const endIndex = chatHistory.value.length - 1

    let userMsgCount = 0
    // Count user messages in the unsummarized portion, excluding the current pending prompt
    for (let i = lastSummarizedIndex.value; i < endIndex; i++) {
      if (chatHistory.value[i].role === 'user') {
        userMsgCount++
      }
    }

    const shouldRetryFailedSummarization = summarizationRetryPending.value && endIndex > lastSummarizedIndex.value
    const shouldSummarizeByLimit = userMsgCount >= historyLimit

    // If summarization previously failed, retry on next user prompt/retry.
    if (shouldRetryFailedSummarization || shouldSummarizeByLimit) {
      const chunkToSummarize = chatHistory.value.slice(lastSummarizedIndex.value, endIndex)
      logDebug(`[callAI] Summarizing ${chunkToSummarize.length} messages (Tumbling Window)...`)
      const ok = await summarizeChunk(chunkToSummarize)
      setRandomLoadingMessage()

      if (ok) {
        lastSummarizedIndex.value = endIndex
        summarizationRetryPending.value = false
        summarizationAttemptCount.value = 0
      } else {
        summarizationRetryPending.value = true
        summarizationAttemptCount.value++
      }
    }
  }

  if (storySummary.value && tokenUsage.value !== 'goddess') {
    contextMsg += `\n\nPREVIOUS STORY SUMMARY:\n${storySummary.value}`
  }

  let historyToSend = chatHistory.value
  if (tokenUsage.value !== 'goddess') {
    historyToSend = chatHistory.value.slice(lastSummarizedIndex.value)
  }

  // Build hidden honorifics instruction for first turn only
  // This is injected into the first user message but NOT saved to history
  const buildHonorificsReminder = (): string => {
    if (!isFirstTurn) return ''
    
    // Get relevant honorifics from the characterHonorifics JSON
    const knownNames = Object.keys(characterProfiles.value)
    if (knownNames.length === 0) return ''
    
    const honorificExamples: string[] = []
    for (const name of knownNames) {
      const honorific = (characterHonorifics as Record<string, string>)[name]
      if (honorific && honorific !== 'Commander') {
        honorificExamples.push(`${name} calls the Commander "${honorific}"`)
      }
    }
    
    if (honorificExamples.length === 0) return ''
    
    return prompts.reminders.honorifics.replace('{examples}', honorificExamples.join('. '))
  }

  // Helper to inject honorifics reminder into the last user message (first turn only)
  const injectHonorificsReminder = (messages: any[]): any[] => {
    const reminder = buildHonorificsReminder()
    if (!reminder) return messages
    
    // Find the last user message and append the reminder
    const result = [...messages]
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].role === 'user') {
        result[i] = { ...result[i], content: result[i].content + reminder }
        break
      }
    }
    return result
  }

  let response: string

  if (apiProvider.value === 'perplexity') {
    // Perplexity: Merge context into system prompt
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}`
    
    // Sanitize history for Perplexity (Strict alternation required)
    // 1. Filter out system messages from history (we provide our own system prompt)
    // 2. Merge consecutive messages of the same role
    const rawHistory = historyToSend.filter((m) => m.role !== 'system')
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

    let messages = [
      { role: 'system', content: fullSystemPrompt },
      ...sanitizedHistory
    ]
    // Inject honorifics reminder for first turn (not saved to history)
    messages = injectHonorificsReminder(messages)
    logDebug('Sending to Perplexity:', messages)
    response = await callPerplexity(messages, enableWebSearch)
  } else if (apiProvider.value === 'gemini') {
    // Gemini: Original behavior (context as separate message at end)
    let messages = [
      { role: 'system', content: systemPrompt },
      ...historyToSend.map((m) => ({ role: m.role, content: m.content }))
    ]
    messages.push({
      role: 'system',
      content: contextMsg + retryInstruction
    })
    // Inject honorifics reminder for first turn (not saved to history)
    messages = injectHonorificsReminder(messages)
    logDebug('Sending to Gemini:', messages)
    response = await callGemini(messages, enableWebSearch)
  } else if (apiProvider.value === 'openrouter') {
    // OpenRouter: Use standard OpenAI format with context in system prompt
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}`
    
    let messages = [
      { role: 'system', content: fullSystemPrompt },
      ...historyToSend.map((m) => ({ role: m.role, content: m.content }))
    ]
    // Inject honorifics reminder for first turn (not saved to history)
    messages = injectHonorificsReminder(messages)
    logDebug('Sending to OpenRouter:', messages)
    response = await callOpenRouter(messages, enableWebSearch)
  } else {
    throw new Error('Unknown API provider')
  }

  // Check if the model needs to search for new characters
  const searchRequest = await checkForSearchRequest(response, lastPrompt.value)
  if (searchRequest && searchRequest.length > 0) {
    logDebug('[callAI] Model requested search for characters:', searchRequest)
    // Perform search for unknown characters
    await searchForCharacters(searchRequest)
    setRandomLoadingMessage()
    // Re-call the AI with updated character profiles (search disabled this time)
    return await callAIWithoutSearch(isRetry)
  }

  return response
}

// Separate function to call AI without search (after character lookup)
const callAIWithoutSearch = async (isRetry: boolean = false): Promise<string> => {
  const systemPrompt = generateSystemPrompt(false)
  let retryInstruction = isRetry ? prompts.reminders.retry : ''
  
  if (needsJsonReminder.value) {
      retryInstruction += prompts.reminders.json
      needsJsonReminder.value = false
  }
  
  const filteredAnimations = market.live2d.animations.filter((a) => 
    a !== 'talk_start' && 
    a !== 'talk_end' && 
    a !== 'expression_0' && 
    a !== 'action'
  )
  let contextMsg = `Current Character: ${market.live2d.current_id}. Available Animations: ${JSON.stringify(filteredAnimations)}`

  // Optimization: Limit history to prevent token overflow
  // Tumbling window: Summarize every X turns
  
  let historyLimit = 30
  if (tokenUsage.value === 'low') historyLimit = 10
  else if (tokenUsage.value === 'medium') historyLimit = 30
  else if (tokenUsage.value === 'high') historyLimit = 60
  else if (tokenUsage.value === 'goddess') historyLimit = 99999 // Effectively infinite

  if (tokenUsage.value !== 'goddess') {
    const endIndex = chatHistory.value.length - 1

    let userMsgCount = 0
    // Count user messages in the unsummarized portion, excluding the current pending prompt
    for (let i = lastSummarizedIndex.value; i < endIndex; i++) {
      if (chatHistory.value[i].role === 'user') {
        userMsgCount++
      }
    }

    const shouldRetryFailedSummarization = summarizationRetryPending.value && endIndex > lastSummarizedIndex.value
    const shouldSummarizeByLimit = userMsgCount >= historyLimit

    // If summarization previously failed, retry on next user prompt/retry.
    if (shouldRetryFailedSummarization || shouldSummarizeByLimit) {
      const chunkToSummarize = chatHistory.value.slice(lastSummarizedIndex.value, endIndex)
      logDebug(`[callAIWithoutSearch] Summarizing ${chunkToSummarize.length} messages (Tumbling Window)...`)
      const ok = await summarizeChunk(chunkToSummarize)
      setRandomLoadingMessage()

      if (ok) {
        lastSummarizedIndex.value = endIndex
        summarizationRetryPending.value = false
        summarizationAttemptCount.value = 0
      } else {
        summarizationRetryPending.value = true
        summarizationAttemptCount.value++
      }
    }
  }

  if (storySummary.value && tokenUsage.value !== 'goddess') {
    contextMsg += `\n\nPREVIOUS STORY SUMMARY:\n${storySummary.value}`
  }

  let historyToSend = chatHistory.value
  if (tokenUsage.value !== 'goddess') {
    historyToSend = chatHistory.value.slice(lastSummarizedIndex.value)
  }

  if (apiProvider.value === 'perplexity') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}`
    const rawHistory = historyToSend.filter((m) => m.role !== 'system')
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
      ...historyToSend.map((m) => ({ role: m.role, content: m.content }))
    ]
    messages.push({ role: 'system', content: contextMsg + retryInstruction })
    return await callGemini(messages, false)
  } else if (apiProvider.value === 'openrouter') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}`
    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...historyToSend.map((m) => ({ role: m.role, content: m.content }))
    ]
    return await callOpenRouter(messages, false)
  }
  
  throw new Error('Unknown API provider')
}

// Check if the AI response contains a search request for unknown characters
const checkForSearchRequest = async (response: string, userPrompt: string = ''): Promise<string[] | null> => {
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
        // Validate characters using whole-word matching against user prompt and AI text
        const allGeneratedText = data.map((a: any) => a.text || '').join(' ')
        
        const validatedChars = action.needs_search.filter(
          (name: string) => {
            // Skip if already known or is "Commander"
            if (characterProfiles.value[name] || name.toLowerCase() === 'commander') return false

            // Character must appear as whole word in either user prompt or AI response
            const inUserPrompt = userPrompt && isWholeWordPresent(userPrompt, name)
            const inGeneratedText = allGeneratedText && isWholeWordPresent(allGeneratedText, name)

            return inUserPrompt || inGeneratedText
          }
        )
        
        if (validatedChars.length > 0) {
          return validatedChars
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
  
  if (useLocalProfiles.value) {
    loadingStatus.value = "Searching for characters in the database..."
  } else {
    loadingStatus.value = "Searching the web for characters..."
  }
  
  let charsToSearch = [...characterNames]

  // Check local profiles first if enabled
  if (useLocalProfiles.value) {
    const remainingChars: string[] = []
    
    for (const name of charsToSearch) {
      // Case-insensitive lookup in local profiles
      const localKey = Object.keys(localCharacterProfiles).find(
        k => k.toLowerCase() === name.toLowerCase()
      )
      
      if (localKey) {
        const profile = (localCharacterProfiles as any)[localKey]
        // Use the name requested by the AI as the key, but the data from the local profile
        characterProfiles.value[name] = {
          ...profile,
          // Ensure ID is present (it is in the JSON, but fallback to l2d list just in case)
          id: profile.id || l2d.find(c => c.name.toLowerCase() === name.toLowerCase())?.id
        }
        logDebug(`[searchForCharacters] Found local profile for ${name}`)
      } else {
        remainingChars.push(name)
      }
    }
    
    charsToSearch = remainingChars
  }

  if (charsToSearch.length === 0) {
    logDebug('[searchForCharacters] All characters found locally.')
    setRandomLoadingMessage()
    return
  }

  // If fallback is disabled, stop here
  if (useLocalProfiles.value && !allowWebSearchFallback.value) {
    logDebug('[searchForCharacters] Web search fallback disabled. Skipping search for:', charsToSearch)
    setRandomLoadingMessage()
    return
  }

  loadingStatus.value = "Searching the web for characters..."

  // For Perplexity, search each character individually for better results
  if (apiProvider.value === 'perplexity') {
    await searchForCharactersPerplexity(charsToSearch)
    return
  }
  
  // For Gemini, use native search
  if (apiProvider.value === 'gemini') {
    await searchForCharactersWithNativeSearch(charsToSearch)
    return
  }
  
  // For OpenRouter, check if model has native search
  if (apiProvider.value === 'openrouter') {
    if (hasNativeSearch(model.value)) {
      // Use native web search for OpenAI, Anthropic, Perplexity, xAI models
      await searchForCharactersWithNativeSearch(charsToSearch)
    } else {
      // For models without native search (e.g., Claude via OpenRouter, DeepSeek, etc.)
      // Fetch wiki pages directly and have the model summarize
      await searchForCharactersViaWikiFetch(charsToSearch)
    }
    return
  }
}

// Fetch wiki page content directly and have the model summarize it
// Used for OpenRouter models that don't have native web search.
// We are using a Cloudflare Worker proxy to avoid CORS issues.
// Its code is open-sourced and available in the 
const WIKI_PROXY_URL = 'https://nikke-wiki-proxy.rhysticone.workers.dev'

const fetchWikiContent = async (characterName: string): Promise<string | null> => {
  const wikiName = characterName.replace(/ /g, '_')
  
  try {
    // Fetch the Story page via our Cloudflare Worker proxy
    // The worker fetches only Description, Personality, and Backstory sections
    const response = await fetch(`${WIKI_PROXY_URL}?page=${encodeURIComponent(wikiName + '/Story')}`)
    const data = await response.json()
    
    // Check for errors
    if (data.error) {
      console.warn(`[fetchWikiContent] Wiki page not found for ${characterName}:`, data.error)
      return null
    }
    
    // Extract wikitext from parse response
    const wikitext = data.parse?.wikitext?.['*']
    if (!wikitext) {
      console.warn(`[fetchWikiContent] No content found for ${characterName}`)
      return null
    }
    
    return wikitext
  } catch (e) {
    console.error(`[fetchWikiContent] Error fetching wiki for ${characterName}:`, e)
    return null
  }
}

// Search for characters by fetching wiki pages directly (for models without native search)
const searchForCharactersViaWikiFetch = async (characterNames: string[]): Promise<void> => {
  logDebug('[searchForCharactersViaWikiFetch] Fetching wiki pages for:', characterNames)
  
  for (const name of characterNames) {
    if (characterProfiles.value[name]) continue
    
    const wikiContent = await fetchWikiContent(name)
    if (!wikiContent) {
      console.warn(`[searchForCharactersViaWikiFetch] No wiki content found for ${name}`)
      continue
    }
    
    const cleanedContent = cleanWikiContent(wikiContent)
    logDebug(`[searchForCharactersViaWikiFetch] Fetched ${cleanedContent.length} chars for ${name}`)
    
    const summarizePrompt = prompts.search.wikiFetch
      .replace(/{name}/g, name)
      .replace('{content}', cleanedContent)

    const messages = [
      { role: 'system', content: 'You are a helpful assistant that extracts character information from wiki content and returns it in JSON format.' },
      { role: 'user', content: summarizePrompt }
    ]
    
    let attempts = 0
    const maxAttempts = 3
    let success = false
    
    while (attempts < maxAttempts && !success) {
      try {
        // Call OpenRouter WITHOUT web search - we already have the content
        const result = await callOpenRouter(messages, false)
        
        let jsonStr = result.replace(/```json\n?|\n?```/g, '').trim()
        const start = jsonStr.indexOf('{')
        const end = jsonStr.lastIndexOf('}')
        if (start !== -1 && end !== -1) {
          jsonStr = jsonStr.substring(start, end + 1)
        }
        
        const profiles = JSON.parse(jsonStr)
        
        // Add character IDs
        for (const charName of Object.keys(profiles)) {
          const char = l2d.find((c) => c.name.toLowerCase() === charName.toLowerCase())
          if (char) {
            profiles[charName].id = char.id
          }
        }
        
        characterProfiles.value = { ...characterProfiles.value, ...profiles }
        logDebug(`[searchForCharactersViaWikiFetch] Added profile for ${name}:`, profiles)
        success = true
      } catch (e) {
        attempts++
        if (attempts >= maxAttempts) {
          console.error(`[searchForCharactersViaWikiFetch] Failed to process ${name} after ${maxAttempts} attempts:`, e)
        } else {
          console.warn(`[searchForCharactersViaWikiFetch] Attempt ${attempts} failed for ${name}, retrying...`)
        }
      }
    }
  }
}

// Search for characters using native web search (Gemini, OpenRouter with native search)
const searchForCharactersWithNativeSearch = async (characterNames: string[]): Promise<void> => {
  logDebug('[searchForCharactersWithNativeSearch] Searching for:', characterNames)
  
  for (const name of characterNames) {
    if (characterProfiles.value[name]) continue

    const wikiName = name.replace(/ /g, '_')
    const storyUrl = `https://nikke-goddess-of-victory-international.fandom.com/wiki/${wikiName}/Story`

    const searchPrompt = prompts.search.native
      .replace(/{name}/g, name)
      .replace('{url}', storyUrl)

    const messages = [
      { role: 'system', content: 'You are a research assistant. Search for information about NIKKE: Goddess of Victory game characters and return what you find in JSON format.' },
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
        
        let jsonStr = result.replace(/```json\n?|\n?```/g, '').trim()
        const start = jsonStr.indexOf('{')
        const end = jsonStr.lastIndexOf('}')
        if (start !== -1 && end !== -1) {
          jsonStr = jsonStr.substring(start, end + 1)
        }
        
        const profiles = JSON.parse(jsonStr)
        
        for (const charName of Object.keys(profiles)) {
          const char = l2d.find((c) => c.name.toLowerCase() === charName.toLowerCase())
          if (char) {
            profiles[charName].id = char.id
          }
        }
        
        characterProfiles.value = { ...characterProfiles.value, ...profiles }
        logDebug(`[searchForCharactersWithNativeSearch] Added profile for ${name}:`, profiles)
        success = true
      } catch (e) {
        console.error(`[searchForCharactersWithNativeSearch] Attempt ${attempts} failed for ${name}:`, e)
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          console.error(`[searchForCharactersWithNativeSearch] All attempts failed for ${name}.`)
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
    const searchPrompt = prompts.search.perplexity
      .replace(/{name}/g, name)
      .replace('{url}', storyUrl)

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
  const knownCharacterNames = Object.keys(effectiveCharacterProfiles.value)
  
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
  
  let prompt = `${prompts.systemPrompt.intro}
  
  ${mode.value === 'roleplay' ? prompts.systemPrompt.modes.roleplay : prompts.systemPrompt.modes.story}
  
  ${prompts.systemPrompt.honorifics.header}
  ${Object.keys(relevantHonorifics).length > 0 ? JSON.stringify(relevantHonorifics, null, 2) : '(No characters loaded yet - honorifics will be provided once characters appear)'
  }
  
  ${prompts.systemPrompt.honorifics.rules}
  
  ${enableWebSearch 
    ? prompts.systemPrompt.characterResearch.enabled
    : prompts.systemPrompt.characterResearch.disabled}
  
  ${prompts.systemPrompt.criticalErrors}

  ${prompts.systemPrompt.jsonStructure}
  
  ${prompts.systemPrompt.knownProfiles}
  ${knownCharacterNames.length > 0 ? JSON.stringify(effectiveCharacterProfiles.value, null, 2) : '(None yet - this is the first turn, use web search to gather information)'}
  
  ${prompts.systemPrompt.idReference}
  ${relevantCharacterIds.length > 0 ? relevantCharacterIds.join(', ') : 'No characters loaded yet. Use the character NAME and the system will resolve it.'}
  
  ${prompts.systemPrompt.instructions}
  `
  return prompt
}

const callOpenRouter = async (messages: any[], enableWebSearch: boolean = false, searchUrl?: string) => {
  let processedMessages = messages

  if (enableContextCaching.value) {
    // Clone messages to avoid mutating the original array
    processedMessages = messages.map(m => ({ ...m }))

    // 1. Cache System Message (Index 0)
    // Anthropic/OpenRouter expects content blocks for caching
    if (processedMessages.length > 0 && processedMessages[0].role === 'system') {
      const systemContent = processedMessages[0].content
      processedMessages[0] = {
        ...processedMessages[0],
        content: [
          { 
            type: "text", 
            text: systemContent, 
            cache_control: { type: "ephemeral" } 
          }
        ]
      }
    }

    // 2. Cache the last history message (The one before the current prompt)
    // Structure is usually [System, ...History, CurrentPrompt]
    // We want to cache the end of the History prefix.
    // We target the second-to-last message.
    if (processedMessages.length >= 2) {
      const lastHistoryIndex = processedMessages.length - 2
      // Ensure we don't cache the system message again if history is empty (though length check handles that)
      // and ensure it's not the user prompt (last message)
      if (lastHistoryIndex > 0 || (lastHistoryIndex === 0 && processedMessages[0].role !== 'system')) {
         const msg = processedMessages[lastHistoryIndex]
         // Only convert if it's a string content (standard)
         if (typeof msg.content === 'string') {
           processedMessages[lastHistoryIndex] = {
             ...msg,
             content: [
               { 
                 type: "text", 
                 text: msg.content,
                 cache_control: { type: "ephemeral" }
               }
             ]
           }
         }
      }
    }
  }

  // Add a final user message to FORCE JSON output - models pay more attention to recent messages
  const messagesWithEnforcement = [
    ...processedMessages,
    { role: 'user', content: prompts.reminders.jsonEnforcement }
  ]
  
  // Build web plugin configuration if web search is enabled
  const buildWebPlugin = () => {
    if (!enableWebSearch) return undefined
    
    // If local profiles are enabled and fallback is disabled, DO NOT use web search
    if (useLocalProfiles.value && !allowWebSearchFallback.value) {
      return undefined
    }

    // Use default web plugin - Exa will search based on the prompt content
    // For models with native search (OpenAI, Anthropic, etc.), this uses their built-in search
    // For other models, it uses Exa search
    return [{ id: 'web', max_results: 10 }]
  }
  
  // Helper function to make the API call without json_object constraint
  const callWithoutJsonFormat = async () => {
    const requestBody: any = {
      model: model.value,
      messages: messagesWithEnforcement,
      max_tokens: 8192
    }
    
    const webPlugin = buildWebPlugin()
    if (webPlugin) {
      requestBody.plugins = webPlugin
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
      
      // Check for 429 rate limit error
      if (response.status === 429 && errorData?.error?.message?.includes('is temporarily rate-limited upstream')) {
        throw new Error('RATE_LIMITED')
      }
      
      throw new Error(`OpenRouter API Error: ${response.status} ${JSON.stringify(errorData)}`)
    }
    
    const data = await response.json()
    return data.choices[0].message.content
  }
  
  // If this model is known to not support json_object, skip directly to fallback
  if (modelsWithoutJsonSupport.has(model.value)) {
    return callWithoutJsonFormat()
  }
  
  const requestBody: any = {
    model: model.value,
    messages: messagesWithEnforcement,
    max_tokens: 8192,
    // Force JSON output format
    response_format: { type: 'json_object' },
    // Require providers that actually support response_format
    provider: {
      require_parameters: true
    }
  }
  
  const webPlugin = buildWebPlugin()
  if (webPlugin) {
    requestBody.plugins = webPlugin
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
    
    // Check for 429 rate limit error
    if (response.status === 429 && errorData?.error?.message?.includes('is temporarily rate-limited upstream')) {
      throw new Error('RATE_LIMITED')
    }
    
    // If error is 404 with exact "No endpoints found" message - model doesn't support json_object response format
    // Remember this model and retry without response_format constraint (e.g., Claude models don't support it)
    if (response.status === 404 && errorData?.error?.message?.includes('No endpoints found that can handle the requested parameters.')) {
      console.warn(`Model ${model.value} does not support json_object response format, remembering and retrying without it...`)
      modelsWithoutJsonSupport.add(model.value)
      return callWithoutJsonFormat()
    }
    
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
  
  // Force disable search if local profiles are enabled and fallback is disabled
  const shouldSearch = enableWebSearch && !(useLocalProfiles.value && !allowWebSearchFallback.value)

  if (shouldSearch) {
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
  
  // Check if we have a system message (first message with role 'system' or just need to treat first as system)
  // If there's only one message, treat it as user content (no system instruction)
  const hasSystemMessage = messages.length > 1 || messages[0]?.role === 'system'
  
  let contents: any[]
  let systemMessage: any = null
  
  if (hasSystemMessage && messages.length > 1) {
    // Extract system prompt (first message)
    systemMessage = messages[0]
    // Filter out system message and map the rest to Gemini format
    contents = messages.slice(1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  } else {
    // No system message, all messages are content
    contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.value}:generateContent?key=${apiKey.value}`
  
  const requestBody: any = {
    contents: contents,
    generationConfig: {
      // responseMimeType: "application/json" // Incompatible with tools
    }
  }
  
  // Only add systemInstruction if we have a system message
  if (systemMessage) {
    requestBody.systemInstruction = {
      parts: [{ text: systemMessage.content }]
    }
  }
  
  // Force disable search if local profiles are enabled and fallback is disabled
  const shouldSearch = enableWebSearch && !(useLocalProfiles.value && !allowWebSearchFallback.value)

  if (shouldSearch) {
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

const enrichActionsWithAnimations = async (actions: any[]): Promise<any[]> => {
  logDebug('Enriching actions with animations...')
  
  const filteredAnimations = market.live2d.animations.filter((a) => 
    a !== 'talk_start' && 
    a !== 'talk_end' && 
    a !== 'expression_0' && 
    a !== 'action'
  )
  
  const prompt = `
  I have a sequence of story actions. I need you to assign the most appropriate animation/emotion to each action based on the text.
  
  Available Animations for Current Character (${market.live2d.current_id}): ${JSON.stringify(filteredAnimations)}
  
  Use this mapping guide to choose the correct intensity (e.g. 'angry_02' vs 'angry_03'):
  ${JSON.stringify(animationMappings, null, 2)}
  
  IMPORTANT: If the text is in ALL CAPS (e.g. "STOP IT!"), you MUST assign a high-intensity 'angry' or 'surprise' animation (e.g. 'angry_02', 'shock').
  For other characters, use generic emotion names (e.g., happy, angry, sad, surprise, idle).
  
  Actions:
  ${JSON.stringify(actions.map((a, i) => ({ index: i, text: a.text, character: a.character })), null, 2)}
  
  Return ONLY a JSON array of strings representing the animation name for each action in order.
  Example: ["idle", "angry_02", "happy"]
  `
  
  const messages = [{ role: 'user', content: prompt }]
  
  try {
      let response: string
      if (apiProvider.value === 'perplexity') {
        response = await callPerplexity(messages, false)
      } else if (apiProvider.value === 'gemini') {
        response = await callGemini(messages, false)
      } else if (apiProvider.value === 'openrouter') {
        response = await callOpenRouter(messages, false)
      } else {
        return actions
      }
      
      let jsonStr = response.replace(/```json\n?|\n?```/g, '').trim()
      const start = jsonStr.indexOf('[')
      const end = jsonStr.lastIndexOf(']')
      if (start !== -1 && end !== -1) {
        jsonStr = jsonStr.substring(start, end + 1)
        const animations = JSON.parse(jsonStr)
        
        if (Array.isArray(animations) && animations.length === actions.length) {
            return actions.map((action, index) => ({
                ...action,
                animation: animations[index]
            }))
        }
      }
  } catch (e) {
      console.error('Failed to enrich animations via API, using local fallback', e)
  }
  
  // Local fallback: use animationMappings to match keywords to animations
  const availableAnimations = market.live2d.animations || []
  return actions.map(action => {
    const text = (action.text || '').toLowerCase()
    let animation = 'idle'
    
    // Check for ALL CAPS (shouting/anger)
    const originalText = action.text || ''
    const capsWords = originalText.match(/\b[A-Z]{2,}\b/g)
    const isShouting = capsWords && capsWords.length > 0
    
    if (isShouting) {
      animation = availableAnimations.find((a: string) => a.includes('angry') || a.includes('shock')) || 'angry'
    } else {
      // Use animationMappings to find matching animation
      for (const [animationType, keywords] of Object.entries(animationMappings)) {
        const hasKeyword = keywords.some(keyword => text.includes(keyword.toLowerCase()))
        if (hasKeyword) {
          // Find the best available animation matching this type
          const matchedAnim = availableAnimations.find((a: string) => a.includes(animationType))
          if (matchedAnim) {
            animation = matchedAnim
          } else {
            animation = animationType
          }
          break
        }
      }
    }
    
    return { ...action, animation }
  })
}

const processAIResponse = async (responseStr: string) => {
  loadingStatus.value = "Processing response..."
  logDebug('Raw AI Response:', responseStr)
  
  // Check for empty or too-short responses (model sometimes returns nothing)
  if (!responseStr || responseStr.trim().length < 20) {
    console.warn('Response too short or empty, triggering retry...')
    throw new Error('JSON_PARSE_ERROR')
  }
  
  let data: any[] = []
  
  try {
    data = parseAIResponse(responseStr)
  } catch (e) {
    console.warn('JSON parse failed, attempting text fallback parsing...', e)
    
    try {
      data = parseFallback(responseStr)
      if (data.length === 0) {
         throw new Error('Fallback parsing yielded no actions')
      }
      logDebug('Fallback parsing successful:', data)
      
      // Enrich with animations via AI
      data = await enrichActionsWithAnimations(data)
      
      // Fallback was successful, but we should remind the model to use JSON next time
      needsJsonReminder.value = true
      
    } catch (fallbackError) {
      console.error('Failed to parse JSON response and Fallback failed', e, fallbackError)
      throw new Error('JSON_PARSE_ERROR')
    }
  }

  logDebug('Parsed Action Sequence:', data)

  // Ensure narration/dialogue separation even when the model returns a single mixed text step.
  data = sanitizeActions(data)
  logDebug('Sanitized Action Sequence:', data)

  isGenerating.value = false
  loadingStatus.value = "..."

  for (const action of data) {
    if (isStopped.value) {
      logDebug('Execution stopped by user.')
      break
    }
    await executeAction(action)
  }
}

const getCharacterName = (id: string): string | null => {
  if (!id || id === 'none') return null
  if (id === 'current') return getCharacterName(market.live2d.current_id)

  const char = l2d.find((c) => c.id.toLowerCase() === id.toLowerCase() || c.name.toLowerCase() === id.toLowerCase())

  return char ? char.name : id
}

const playTTSGptSovits = async (text: string, characterName: string) => {
  // Clean up character name to match folder/filename
  // e.g. "Anis: Sparkling Summer" -> "anis_sparkling_summer"
  const cleanName = characterName.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')
  
  logDebug(`[TTS-GPTSoVits] Requesting TTS for ${characterName} (${cleanName})`)

  try {
    let baseUrl = gptSovitsEndpoint.value
    baseUrl = baseUrl.replace(/\/$/, '')
    
    // Handle CORS in dev mode by using Vite proxy
    if (import.meta.env.DEV && (baseUrl.includes('localhost:9880') || baseUrl.includes('127.0.0.1:9880'))) {
      baseUrl = '/gptsovits'
    }

    // Construct paths for reference audio and prompt text
    // User must place files at: {basePath}/GPT_SoVITS/voices/{character}/{character}.wav
    // And prompt text at: {basePath}/GPT_SoVITS/voices/{character}/{character}.txt
    // Clean up the base path: remove trailing slashes/backslashes, normalize to forward slashes
    const basePath = gptSovitsBasePath.value
      .replace(/[\\/]+$/, '')  // Remove trailing slashes (both / and \)
      .replace(/\\/g, '/')     // Convert backslashes to forward slashes
    const refAudioPath = `${basePath}/GPT_SoVITS/voices/${cleanName}/${cleanName}.wav`
    const promptTextPath = `${basePath}/GPT_SoVITS/voices/${cleanName}/${cleanName}.txt`

    // Fetch prompt text from cache or API
    let promptText = gptSovitsPromptTextCache.get(cleanName)
    if (!promptText) {
      try {
        const promptResponse = await fetch(`${baseUrl}/read_prompt_text?path=${encodeURIComponent(promptTextPath)}`)
        if (promptResponse.ok) {
          const promptData = await promptResponse.json()
          promptText = promptData.text || ''
          if (promptText) {
            gptSovitsPromptTextCache.set(cleanName, promptText)
            logDebug(`[TTS-GPTSoVits] Loaded prompt text for ${cleanName}: "${promptText}"`)
          }
        } else {
          console.warn(`[TTS-GPTSoVits] Could not fetch prompt text for ${cleanName}`)
          promptText = ''
        }
      } catch (e) {
        console.warn(`[TTS-GPTSoVits] Error fetching prompt text for ${cleanName}:`, e)
        promptText = ''
      }
    }

    // Call the TTS endpoint
    const payload = {
      text: text,
      text_lang: 'en',
      text_split_method: 'cut0',
      ref_audio_path: refAudioPath,
      prompt_text: promptText,
      prompt_lang: 'en',
      media_type: 'wav',
      streaming_mode: false,
      // Quality parameters
      top_k: 10,
      top_p: 0.8,
      temperature: 0.8,
      speed_factor: 1.0
    }

    logDebug(`[TTS-GPTSoVits] Calling ${baseUrl}/tts with payload:`, payload)

    const response = await fetch(`${baseUrl}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text()
      console.warn(`[TTS-GPTSoVits] API Error: ${response.status} - ${errText}`)
      return
    }

    // Response is audio blob
    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    audio.volume = 1.0

    // Sync yapping with audio
    audio.onplay = () => {
      market.live2d.isYapping = true
    }
    audio.onended = () => {
      market.live2d.isYapping = false
      URL.revokeObjectURL(audioUrl) // Clean up
    }
    audio.onerror = () => {
      market.live2d.isYapping = false
      URL.revokeObjectURL(audioUrl)
    }

    audio.play().catch(e => {
      console.warn('[TTS-GPTSoVits] Playback failed:', e)
      market.live2d.isYapping = false
      URL.revokeObjectURL(audioUrl)
    })
  } catch (e) {
    console.warn('[TTS-GPTSoVits] Error:', e)
  }
}

const playTTS = async (text: string, characterName: string) => {
  if (!ttsEnabled.value || !characterName) return

  // Dispatch to appropriate TTS provider
  if (ttsProvider.value === 'gptsovits') {
    return playTTSGptSovits(text, characterName)
  }

  // AllTalk implementation (default)
  // Clean up character name to match filename
  // Remove special chars, replace spaces with underscores
  // e.g. "Anis: Sparkling Summer" -> "anis_sparkling_summer.wav"
  const cleanName = characterName.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')
  const voiceFile = `${cleanName}.wav`
  
  logDebug(`[TTS] Requesting TTS for ${characterName} (${voiceFile})`)

  try {
    let baseUrl = ttsEndpoint.value
    // Clean up the base URL to ensure we have the root (remove /v1, /api, trailing slashes)
    baseUrl = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '').replace(/\/api$/, '')
    
    // Handle CORS in dev mode by using Vite proxy
    // This requires the proxy to be configured in vite.config.ts
    if (import.meta.env.DEV && (baseUrl.includes('localhost:7851') || baseUrl.includes('127.0.0.1:7851'))) {
        baseUrl = '/alltalk'
    }

    // Use Standard API via proxy (better support for custom filenames)
    const url = `${baseUrl}/api/tts-generate`
    
    logDebug(`[TTS] Calling URL: ${url}`)

    const params = new URLSearchParams()
    params.append('text_input', text)
    params.append('character_voice_gen', voiceFile)
    params.append('narrator_enabled', 'false')
    params.append('text_not_inside', 'character')
    params.append('language', 'en')
    params.append('output_file_name', 'nikke_tts_gen')
    params.append('output_file_timestamp', 'true')
    params.append('autoplay', 'false')
    params.append('autoplay_volume', '0.8')
    params.append('text_filtering', 'standard')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    })

    if (!response.ok) {
       const errText = await response.text()
       console.error(`[TTS] API Error: ${response.status} - ${errText}`)
       return
    }

    const data = await response.json()
    
    if (data.status === 'generate-success' && data.output_file_url) {
        // Construct audio URL using the same base (proxy or direct)
        // data.output_file_url usually starts with /audio/
        const audioUrl = `${baseUrl}${data.output_file_url}`
        const audio = new Audio(audioUrl)
        audio.volume = 1.0
        
        // Sync yapping with audio
        audio.onplay = () => {
            market.live2d.isYapping = true
        }
        audio.onended = () => {
            market.live2d.isYapping = false
        }
        audio.onerror = () => {
            market.live2d.isYapping = false
        }
        
        audio.play().catch(e => {
            console.error('[TTS] Playback failed:', e)
            market.live2d.isYapping = false
        })
    }
  } catch (e) {
    console.error('[TTS] Error:', e)
  }
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

  // Compatibility Fix: Map legacy/hallucinated 'characterProfile' or 'characterProfiles' to 'memory'
  // This ensures they are treated as NEW character definitions and IGNORED if the character already exists.
  if (data.characterProfile || data.characterProfiles) {
    const legacyData = data.characterProfile || data.characterProfiles
    logDebug('[AI Compatibility] Remapping characterProfile/s to memory (Read-Only for existing):', legacyData)
    
    if (!data.memory) {
      data.memory = legacyData
    } else {
      data.memory = { ...data.memory, ...legacyData }
    }
  }

  // Normalize legacy/misused profile updates (e.g., DeepSeek using characterProfile/memory) so they
  // cannot overwrite existing profiles and instead become characterProgression updates.
  data = normalizeAiActionCharacterData(data, characterProfiles.value)

  if (data.memory) {
    logDebug('[AI Memory Update - New Characters Only]:', data.memory)
    const newProfiles: Record<string, any> = {}
    
    for (const [charName, profile] of Object.entries(data.memory)) {
      // 1. Check if already in active profiles (Case-Insensitive)
      const existingKey = Object.keys(characterProfiles.value).find(k => k.toLowerCase() === charName.toLowerCase())
      
      if (existingKey) {
        logDebug(`[AI Memory] Skipping existing character '${charName}' (matched '${existingKey}') in memory block. Use characterProgression to update.`)
        continue
      }

      // 2. Check if in LOCAL profiles (if enabled) - ENFORCE READ-ONLY FROM DB
      if (useLocalProfiles.value) {
         const localKey = Object.keys(localCharacterProfiles).find(k => k.toLowerCase() === charName.toLowerCase())
         if (localKey) {
             logDebug(`[AI Memory] Found local profile for '${charName}' (matched '${localKey}'). IGNORING AI memory and loading local profile instead.`)
             
             const localProfile = (localCharacterProfiles as any)[localKey]
             // Add the LOCAL profile to newProfiles, effectively overwriting the AI's suggestion with the correct data
             newProfiles[charName] = {
                 ...localProfile,
                 id: localProfile.id || l2d.find(c => c.name.toLowerCase() === charName.toLowerCase())?.id
             }
             continue
         }
      }

      if (typeof profile === 'object' && profile !== null) {
        const { honorific_for_commander, honorific_to_commander, honorific, relationships, ...rest } = profile as any
        
        // Filter Commander out of relationships if present
        let filteredRelationships = relationships
        if (relationships && typeof relationships === 'object') {
          const { Commander, commander, ...otherRelationships } = relationships
          filteredRelationships = Object.keys(otherRelationships).length > 0 ? otherRelationships : undefined
        }
        
        newProfiles[charName] = {
          ...rest,
          ...(filteredRelationships && { relationships: filteredRelationships })
        }
      } else {
        newProfiles[charName] = profile
      }
    }
    
    if (Object.keys(newProfiles).length > 0) {
      characterProfiles.value = { ...characterProfiles.value, ...newProfiles }
    }
  }

  // Handle 'characterProgression' - For EXISTING characters (Personality/Relationships ONLY)
  if (data.characterProgression) {
    logDebug('[AI Character Progression]:', data.characterProgression)
    const updatedProgression = { ...characterProgression.value }
    let hasUpdates = false

    for (const [charName, progression] of Object.entries(data.characterProgression)) {
      // Find target profile (Case-Insensitive) in BASE profiles.
      const targetKey = Object.keys(characterProfiles.value).find(k => k.toLowerCase() === charName.toLowerCase())
      const resolvedKey = targetKey || charName

      if (typeof progression === 'object' && progression !== null) {
        const updates = progression as any
        const current = (updatedProgression as any)[resolvedKey] && typeof (updatedProgression as any)[resolvedKey] === 'object'
          ? (updatedProgression as any)[resolvedKey]
          : {}

        if (updates.personality) {
          current.personality = updates.personality
          hasUpdates = true
        }

        if (updates.relationships && typeof updates.relationships === 'object') {
          // NOTE: We allow "Commander" here as a dynamic relationship/attitude field.
          current.relationships = {
            ...(current.relationships || {}),
            ...(updates.relationships || {})
          }
          hasUpdates = true
        }

        // CRITICAL: Explicitly IGNORE speech_style updates
        if (updates.speech_style) {
          logDebug(`[AI Character Progression] BLOCKED attempt to change speech_style for '${resolvedKey}'`)
        }

        ;(updatedProgression as any)[resolvedKey] = current
      }
    }

    if (hasUpdates) {
      characterProgression.value = updatedProgression
    }
  }

  // Resolve Character ID EARLY to ensure TTS gets the right name
  let effectiveCharId = data.character
  
  // Handle 'current' character resolution and speaker detection
  if (effectiveCharId === 'current') {
      // Check for speaker override in text
      const speakerMatch = data.text ? data.text.match(/^\s*(?:\*\*)?([^*]+?)(?:\*\*)?\s*:\s*/) : null
      if (speakerMatch) {
        const speakerName = speakerMatch[1].trim()
        const charObj = l2d.find((c) => c.name.toLowerCase() === speakerName.toLowerCase())
        if (charObj && charObj.id !== market.live2d.current_id) {
             logDebug(`[Chat] Detected speaker '${speakerName}' in text. Switching from 'current' to: ${charObj.id}`)
             effectiveCharId = charObj.id
             // Update data.character so subsequent logic uses the new ID
             data.character = effectiveCharId
        } else {
             effectiveCharId = market.live2d.current_id
        }
      } else {
         effectiveCharId = market.live2d.current_id
      }
  }

  // Add text to chat
  if (data.text) {
    let content = data.text
      
    // Add speaker name if speaking
    if (data.speaking) {
      let name = null
        
      if (effectiveCharId === 'none') {
        // If character is explicitly none, it's likely the Commander in Story Mode
        if (mode.value === 'story') {
          name = 'Commander'
        }
      } else {
        name = getCharacterName(effectiveCharId)
      }

      if (name) {
        // Trigger TTS
        if (ttsEnabled.value) {
          playTTS(data.text, name)
        }

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
    // Handle specific character switch (including resolved 'current')
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
  if (data.speaking && !ttsEnabled.value) {
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
    loadingStatus.value = "Click Next to advance..."
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
    loadingStatus.value = "..."
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

const resetSession = () => {
  if (chatHistory.value.length === 0) return
  
  const confirmed = window.confirm('Are you sure you want to reset the story? All unsaved progress will be lost.')
  if (confirmed) {
    chatHistory.value = []
    characterProfiles.value = {}
    characterProgression.value = {}
    storySummary.value = ''
    lastSummarizedIndex.value = 0
    summarizationRetryPending.value = false
    summarizationAttemptCount.value = 0
    summarizationLastError.value = null
    lastPrompt.value = ''
    market.live2d.isVisible = false
  }
}

const summarizeChunk = async (messages: { role: string, content: string }[]): Promise<boolean> => {
  if (messages.length === 0) return true

  loadingStatus.value = "Summarizing story so far..."
  const textToSummarize = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
  const prompt = `Summarize the following story events concisely, focusing on key plot points and character developments. Do not lose important details.\n\n${textToSummarize}`

  const systemMsg = { role: 'system', content: 'You are a helpful assistant that summarizes story events.' }
  const userMsg = { role: 'user', content: prompt }
  const msgs = [systemMsg, userMsg]

  try {
    let summary = ''
    if (apiProvider.value === 'perplexity') {
      summary = await callPerplexity(msgs, false)
    } else if (apiProvider.value === 'gemini') {
      summary = await callGemini(msgs, false)
    } else if (apiProvider.value === 'openrouter') {
      summary = await callOpenRouter(msgs, false)
    }
    
    if (summary && summary.trim().length > 0) {
      if (storySummary.value) {
        storySummary.value += '\n\n' + summary
      } else {
        storySummary.value = summary
      }
      summarizationLastError.value = null
      return true
    }
    summarizationLastError.value = 'Summarization returned empty output.'
    return false
  } catch (e) {
    console.error('Failed to summarize chunk:', e)
    summarizationLastError.value = e instanceof Error ? e.message : String(e)
    return false
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

    .message-top-actions {
      position: absolute;
      top: -10px;
      left: 0;
      opacity: 0.5;
      transition: opacity 0.2s;
      
      &:hover {
        opacity: 1;
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

.loading-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading-text {
  font-style: italic;
  opacity: 0.8;
  font-size: 0.9em;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
