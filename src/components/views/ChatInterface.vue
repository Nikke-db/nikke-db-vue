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
      :placeholder="(apiKey || apiProvider === 'pollinations') ? 'Type your message...' : 'Please enter API Key in settings'"
      :disabled="!apiKey && apiProvider !== 'pollinations'"
      :autosize="{ minRows: 1, maxRows: 4 }"
      @keydown.enter.prevent="handleEnter"
      />
      <n-button type="primary" @click="sendMessage" :disabled="isLoading || !userInput.trim() || (!apiKey && apiProvider !== 'pollinations')">Send</n-button>
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
      <n-popover trigger="click" v-model:show="showRemindersDropdown" placement="top">
        <template #trigger>
          <n-button 
            type="info" 
            size="small" 
            :style="{ marginLeft: '4px', opacity: isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }"
          >
            <template #icon>
              <n-icon><Help /></n-icon>
            </template>
            Problems?
          </n-button>
        </template>
        <div style="display: flex; flex-direction: column; gap: 8px; padding: 4px; min-width: 150px;">
          <div style="font-weight: 600; font-size: 12px; opacity: 0.7; border-bottom: 1px solid var(--n-border-color); padding-bottom: 4px; margin-bottom: 2px;">
            Inject one or more reminders to the model for the next turn:
          </div>
          <n-checkbox v-model:checked="invalidJsonToggle">Invalid JSON Schema</n-checkbox>
          <n-checkbox v-model:checked="honorificsToggle">Incorrect Honorifics</n-checkbox>
          <n-checkbox v-model:checked="narrationAndDialogueNotSplitToggle">Narration and Dialogue Not Split</n-checkbox>
          <n-checkbox v-model:checked="wrongSpeechStylesToggle">Using Wrong Speech Styles</n-checkbox>
          <n-checkbox v-if="mode === 'roleplay'" v-model:checked="aiControllingUserToggle">AI Is Controlling Me</n-checkbox>
        </div>
      </n-popover>
    </div>
    </div>

    <n-drawer v-model:show="showSettings" width="300" placement="right">
      <n-drawer-content title="Settings">
      <n-form>
          <h4 class="settings-section-header accent-blue">AI Provider & Model</h4>
          <n-divider />
          <n-form-item label="API Provider">
            <n-select v-model:value="apiProvider" :options="providerOptions" />
          </n-form-item>

          <n-form-item label="API Key">
            <n-input v-model:value="apiKey" type="password" show-password-on="click" placeholder="Enter API Key" />
          </n-form-item>
          <n-alert type="info" style="margin-bottom: 12px" title="">
            Your API key is stored locally in your browser's local storage, and it is never sent to Nikke-DB.
          </n-alert>
          <n-alert v-if="apiProvider === 'pollinations'" type="info" style="margin-bottom: 12px" title="">
            For Pollinations, the API key is optional. Register at <a href="https://enter.pollinations.ai" target="_blank">enter.pollinations.ai</a> for a Secret key to increase rates and available models.
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
          <n-divider />

          <h4 class="settings-section-header accent-green">AI Settings</h4>
          <n-divider />
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
          <n-divider />

          <h4 class="settings-section-header accent-light-blue">Knowledge & Search</h4>
          <n-divider />
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
                <div v-html="computedWebSearchFallbackHelpText"></div>
              </n-popover>
            </template>
            <n-switch v-model:value="allowWebSearchFallback" :disabled="computedUsesWikiFetch || computedUsesPollinationsAutoFallback" />
          </n-form-item>
          <n-divider />

          <h4 class="settings-section-header accent-orange">Story Mode & Features</h4>
          <n-divider />
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
              God Mode
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Prevents any action in the story from causing the Commander's death.<br><br>
                  Note that it is possible the model may still override this instruction. If this happens, simply delete the last messages of the story and try again.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="godModeEnabled" />
          </n-form-item>
          <n-divider />

          <h4 class="settings-section-header accent-red">Interface & Audio</h4>
          <n-divider />
          <n-form-item>
            <template #label>
              Asset Quality
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  <strong>High:</strong> Best visual quality, but uses more GPU resources and VRAM.<br><br>
                  <strong>Low:</strong> Slightly worse quality and detail, but much better performance on low-end systems.
                </div>
              </n-popover>
            </template>
            <n-select v-model:value="assetQuality" :options="assetQualityOptions" />
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

          <n-form-item label="Chatterbox Endpoint" v-if="ttsEnabled && ttsProvider === 'chatterbox'">
            <n-input v-model:value="chatterboxEndpoint" placeholder="http://localhost:7860" />
          </n-form-item>

          <n-form-item v-if="ttsEnabled && ttsProvider === 'chatterbox'">
            <template #label>
              Chatterbox Voices Path
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Path to your Chatterbox voices folder.<br>
                  Voice files should be placed at: <code>{voicesPath}/{character}.wav</code><br>
                  Example: <code>anis.wav</code>, <code>neon.wav</code>, etc.
                </div>
              </n-popover>
            </template>
            <n-input v-model:value="chatterboxVoicesPath" placeholder="C:/chatterbox-tts-api/voices" />
          </n-form-item>
          <n-divider />
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
          <li><strong>API Key:</strong> You need an API key to use this feature, except when using Pollinations. Currently supported providers: <strong>Perplexity</strong>, <strong>Google Gemini</strong>, <strong>OpenRouter</strong>, and <strong>Pollinations</strong>.</li>
          <ul>
          <li>When using Pollinations without an API key, only a small subset of models is shown. You will also likely be rate-limited. Adding or removing a Pollinations API key will immediately refresh the available model list.</li>
          </ul>
          <li><strong>Setup:</strong> Click the <strong>Settings (Gear Icon)</strong> to enter your API key and select a model.</li>
          <li><strong>Privacy:</strong> Your API key is stored locally and sent only to the selected API provider. Stories and keys are never shared with Nikke-DB; check your provider's policy, as some may use data for training.</li>
          <li><strong>Cost Warning:</strong> Please be aware of your API provider's pricing. Web search for certain models/providers may incur additional costs. You can disable it in Settings.</li>
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
          <li>If you don't like the last message, you can delete it by clicking the trash can icon on the left side of the message bubble. You can then write something different, or press <strong>Continue</strong>. Alternatively, you can click on the <strong>Retry</strong> button in the upper right corner of the message.</li>
          <li>If you do not want to perform any action, simply press <strong>Continue</strong>.</li>
          <li>You can <strong>Save</strong> and <strong>Load</strong> your session at any time.</li>
        </ul>

        <h3>💡 Tips</h3>
        <ul>
          <li>If the model is misbehaving, try using one of the options in the <strong>Problems?</strong> button.</li>
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
import { Settings, Help, Save, Upload, TrashCan, Reset, Renew, Notification } from '@vicons/carbon'
import { NIcon, NButton, NInput, NDrawer, NDrawerContent, NForm, NFormItem, NSelect, NSwitch, NPopover, NAlert, NModal, NSpin, NCheckbox } from 'naive-ui'
import l2d from '@/utils/json/l2d.json'
import characterHonorifics from '@/utils/json/honorifics.json'
import localCharacterProfiles from '@/utils/json/characterProfiles.json'
import loadingMessages from '@/utils/json/loadingMessages.json'
import prompts from '@/utils/json/prompts.json'
import { marked } from 'marked'
import { animationMappings } from '@/utils/animationMappings'
import { cleanWikiContent, sanitizeActions, splitNarration, parseFallback, parseAIResponse, isWholeWordPresent } from '@/utils/chatUtils'
import { normalizeAiActionCharacterData } from '@/utils/aiActionNormalization'
import { ttsEnabled, ttsEndpoint, ttsProvider, gptSovitsEndpoint, gptSovitsBasePath, chatterboxEndpoint, chatterboxVoicesPath, ttsProviderOptions, playTTS } from '@/utils/ttsUtils'
import { allowWebSearchFallback, NATIVE_SEARCH_PREFIXES, POLLINATIONS_NATIVE_SEARCH_MODELS, hasNativeSearch, usesWikiFetch, usesPollinationsAutoFallback, webSearchFallbackHelpText, searchForCharacters, searchForCharactersPerplexity, searchForCharactersWithNativeSearch, searchForCharactersViaWikiFetch } from '@/utils/aiWebSearchUtils'
import { callOpenRouterSummarization, callPollinationsSummarization, callGeminiSummarization } from '@/utils/llmUtils'

// Helper to get honorific with fallback to "Commander"
const getHonorific = (characterName: string): string => {
  return (characterHonorifics as Record<string, string>)[characterName] || 'Commander'
}

const market = useMarket()

// Helper to get the response schema for structured output
const getResponseSchema = () => ({
  type: 'json_schema',
  json_schema: {
    name: 'StoryResponse',
    schema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              needs_search: { type: 'array', items: { type: 'string' } },
              memory: { type: 'object' },
              characterProgression: { type: 'object' },
              text: { type: 'string' },
              character: { type: 'string' },
              animation: { type: 'string' },
              speaking: { type: 'boolean' },
              duration: { type: 'number' }
            },
            required: ['text', 'character', 'speaking', 'animation']
          }
        }
      },
      required: ['actions']
    }
  }
})

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
const apiProvider = ref('perplexity')
const apiKey = ref(localStorage.getItem('nikke_api_key') || '')
const model = ref('sonar')
const mode = ref('roleplay')
const tokenUsage = ref('medium')
const enableContextCaching = ref(true)
const playbackMode = ref('auto')
const godModeEnabled = ref(localStorage.getItem('nikke_god_mode_enabled') === 'true')
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
const pollinationsModels = ref<any[]>([])
const isRestoring = ref(false)
const needsJsonReminder = ref(false)
// Track models that don't support json_object, persisting to localStorage
const modelsWithoutJsonSupport = new Set<string>(JSON.parse(localStorage.getItem('modelsWithoutJsonSupport') || '[]'))
const isDev = import.meta.env.DEV

// AI Reminders state
const showRemindersDropdown = ref(false)
const invalidJsonToggle = ref(false)
const honorificsToggle = ref(false)
const aiControllingUserToggle = ref(false)
const narrationAndDialogueNotSplitToggle = ref(false)
const wrongSpeechStylesToggle = ref(false)

// Helper to set random loading message
const setRandomLoadingMessage = () => {
  loadingStatus.value = loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
}

// Models/providers that have native web search in OpenRouter

// Options
const providerOptions = [
  { label: 'Perplexity', value: 'perplexity' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Pollinations', value: 'pollinations' }
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
      { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' },
      { label: 'Gemini 3 Pro', value: 'gemini-3-pro-preview' }
    ]
  } else if (apiProvider.value === 'openrouter') {
    return openRouterModels.value
  } else if (apiProvider.value === 'pollinations') {
    return pollinationsModels.value
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

const assetQualityOptions = [
  { label: 'High', value: 'high' },
  { label: 'Low', value: 'low' }
]

const tokenUsageOptions = [
  { label: 'Low (10 turns)', value: 'low' },
  { label: 'Medium (30 turns)', value: 'medium' },
  { label: 'High (60 turns)', value: 'high' },
  { label: 'Goddess', value: 'goddess' }
]

// Computed
const isWebSearchAllowed = computed(() => true)

const computedUsesWikiFetch = computed(() => usesWikiFetch(apiProvider.value, model.value))

const computedUsesPollinationsAutoFallback = computed(() => usesPollinationsAutoFallback(apiProvider.value, model.value))

const computedWebSearchFallbackHelpText = computed(() => webSearchFallbackHelpText(computedUsesWikiFetch.value, computedUsesPollinationsAutoFallback.value))

const assetQuality = computed({
  get: () => market.live2d.HQassets ? 'high' : 'low',
  set: (val: string) => {
    market.live2d.HQassets = val === 'high'
  }
})

// Watchers
watch(apiKey, async (newVal) => {
  localStorage.setItem('nikke_api_key', newVal)
  if (apiProvider.value === 'pollinations') {
    await fetchPollinationsModels()
    if (pollinationsModels.value.length > 0) {
      model.value = pollinationsModels.value[0].value
    }
  }
})

watch(useLocalProfiles, (newVal) => {
  localStorage.setItem('nikke_use_local_profiles', String(newVal))
})

watch(allowWebSearchFallback, (newVal) => {
  localStorage.setItem('nikke_allow_web_search_fallback', String(newVal))
})

watch(computedUsesWikiFetch, (newVal) => {
  if (newVal) {
    allowWebSearchFallback.value = true
  }
})

watch(computedUsesPollinationsAutoFallback, (newVal) => {
  if (newVal) {
    allowWebSearchFallback.value = true
  }
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

watch(chatterboxEndpoint, (newVal) => {
  localStorage.setItem('nikke_chatterbox_endpoint', newVal)
})

watch(chatterboxVoicesPath, (newVal) => {
  localStorage.setItem('nikke_chatterbox_voices_path', newVal)
})

watch(godModeEnabled, (newVal) => {
  localStorage.setItem('nikke_god_mode_enabled', String(newVal))
})

watch(model, (newVal) => {
  if (newVal) localStorage.setItem('nikke_model', newVal)
})

watch(() => market.live2d.yapEnabled, (newVal) => {
  localStorage.setItem('nikke_yap_enabled', String(newVal))
})

watch(() => market.live2d.HQassets, (newVal) => {
  localStorage.setItem('nikke_hq_assets', String(newVal))
  market.live2d.triggerResetPlacement()
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
  } else if (apiProvider.value === 'pollinations') {
    model.value = ''
    await fetchPollinationsModels()

    if (pollinationsModels.value.length > 0) {
      model.value = pollinationsModels.value[0].value
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

const fetchPollinationsModels = async () => {
  let models: any[] = []

  try {
    const headers: Record<string, string> = {}

    if (apiKey.value) {
      headers['Authorization'] = `Bearer ${apiKey.value}`
    }
    const url = apiKey.value ? 'https://gen.pollinations.ai/text/models' : 'https://text.pollinations.ai/models'
    const response = await fetch(url, { headers })
    const data = await response.json()
    models = data
    
    // Handle both old format (array of strings) and new format (array of objects)
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
      models = data.map((name) => ({ name, pricing: { input_token_price: 0 } }))
    }
    
    pollinationsModels.value = models
      .filter((m: any) => {
        if (!apiKey.value) {
          const allowedModels = ['gemini', 'gemini-search', 'mistral']
          return allowedModels.includes(m.name)
        } else {
          const hiddenModels = ['qwen-coder', 'chickytutor', 'midijourney', 'openai-audio']
          return !hiddenModels.includes(m.name)
        }
      })
      .map((m: any) => {
        const isFree = m.pricing && m.pricing.input_token_price === 0

        return {
          label: (isFree ? '[FREE] ' : '') + m.name,
          value: m.name,
          isFree: isFree,
          style: isFree ? { color: '#18a058', fontWeight: 'bold' } : {}
        }
      }).sort((a: any, b: any) => {
        if (a.isFree && !b.isFree) return -1
        if (!a.isFree && b.isFree) return 1

        return a.label.localeCompare(b.label)
      })
    
  } catch (error) {
    console.error('Failed to fetch Pollinations models:', error)
    // Fallback to hardcoded models
    models = [
      { name: 'gemini', pricing: { input_token_price: 0 } },
      { name: 'gemini-search', pricing: { input_token_price: 0 } },
      { name: 'mistral', pricing: { input_token_price: 0 } }
    ]
    
    pollinationsModels.value = models.map((m: any) => ({
      label: '[FREE] ' + m.name,
      value: m.name,
      isFree: true,
      style: { color: '#18a058', fontWeight: 'bold' }
    }))
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

  const savedHQAssets = localStorage.getItem('nikke_hq_assets')
  if (savedHQAssets !== null) market.live2d.HQassets = (savedHQAssets === 'true')

  const savedTts = localStorage.getItem('nikke_tts_enabled')
  if (savedTts !== null) ttsEnabled.value = (savedTts === 'true')

  const savedTtsEndpoint = localStorage.getItem('nikke_tts_endpoint')
  if (savedTtsEndpoint) ttsEndpoint.value = savedTtsEndpoint

  const savedTtsProvider = localStorage.getItem('nikke_tts_provider')
  if (savedTtsProvider === 'alltalk' || savedTtsProvider === 'gptsovits' || savedTtsProvider === 'chatterbox') ttsProvider.value = savedTtsProvider

  const savedGptSovitsEndpoint = localStorage.getItem('nikke_gptsovits_endpoint')
  if (savedGptSovitsEndpoint) gptSovitsEndpoint.value = savedGptSovitsEndpoint

  const savedGptSovitsBasePath = localStorage.getItem('nikke_gptsovits_basepath')
  if (savedGptSovitsBasePath) gptSovitsBasePath.value = savedGptSovitsBasePath

  const savedChatterboxEndpoint = localStorage.getItem('nikke_chatterbox_endpoint')
  if (savedChatterboxEndpoint) chatterboxEndpoint.value = savedChatterboxEndpoint

  const savedChatterboxVoicesPath = localStorage.getItem('nikke_chatterbox_voices_path')
  if (savedChatterboxVoicesPath) chatterboxVoicesPath.value = savedChatterboxVoicesPath

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
    } else if (savedProvider === 'pollinations') {
      await fetchPollinationsModels()
    }
    
    // Validate and set model
    let validModels: string[] = []

    if (savedProvider === 'perplexity') {
      validModels = ['sonar', 'sonar-pro']
    } else if (savedProvider === 'gemini') {
      validModels = ['gemini-2.5-flash', 'gemini-2.5-pro']
    } else if (savedProvider === 'openrouter') {
      validModels = openRouterModels.value.map((m) => m.value)
    } else if (savedProvider === 'pollinations') {
      validModels = pollinationsModels.value.map((m) => m.value)
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

  let text = userInput.value

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

  if (success) {
    invalidJsonToggle.value = false
    honorificsToggle.value = false
    narrationAndDialogueNotSplitToggle.value = false
    aiControllingUserToggle.value = false
    wrongSpeechStylesToggle.value = false
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

  if (success) {
    invalidJsonToggle.value = false
    honorificsToggle.value = false
    narrationAndDialogueNotSplitToggle.value = false
    aiControllingUserToggle.value = false
    wrongSpeechStylesToggle.value = false
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

  if (success) {
    invalidJsonToggle.value = false
    honorificsToggle.value = false
    narrationAndDialogueNotSplitToggle.value = false
    aiControllingUserToggle.value = false
    wrongSpeechStylesToggle.value = false
  }

  isLoading.value = false
  scrollToBottom()
}

// Helper to inject user-toggled reminders into the last user message
const injectUserReminders = (messages: any[]): any[] => {
  let reminders = ''

  if (invalidJsonToggle.value) {
    reminders += '\n\n' + prompts.reminders.invalidJsonReminder
  }
  if (honorificsToggle.value) {
    reminders += '\n\n' + prompts.reminders.honorificsReminder
  }
  if (narrationAndDialogueNotSplitToggle.value) {
    reminders += '\n\n' + prompts.reminders.narrationAndDialogueNotSplit
  }
  if (aiControllingUserToggle.value) {
    reminders += '\n\n' + prompts.reminders.aiControllingUserReminder
  }
  if (wrongSpeechStylesToggle.value) {
    reminders += '\n\n' + prompts.reminders.wrongSpeechStylesReminder
  }
  
  if (!reminders) return messages

  const result = [...messages]
  // Find the last user message
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].role === 'user') {
      result[i] = { ...result[i], content: result[i].content + reminders }

      break
    }
  }

  return result
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
    const foundNames = localNames.filter((name) => 
      isWholeWordPresent(firstPrompt, name)
    )
    
    if (foundNames.length > 0) {
      logDebug('[callAI] Pre-loading local profiles for:', foundNames)
      await wrappedSearchForCharacters(foundNames)
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
    
    // Inject user toggled reminders
    messages = injectUserReminders(messages)
    
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
    
    // Inject user toggled reminders
    messages = injectUserReminders(messages)
    
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
    
    // Inject user toggled reminders
    messages = injectUserReminders(messages)
    
    logDebug('Sending to OpenRouter:', messages)
    response = await callOpenRouter(messages, enableWebSearch)
  } else if (apiProvider.value === 'pollinations') {
    // Pollinations: Use standard OpenAI format with context in system prompt
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}`
    
    let messages = [
      { role: 'system', content: fullSystemPrompt },
      ...historyToSend.map((m) => ({ role: m.role, content: m.content }))
    ]
    // Inject honorifics reminder for first turn (not saved to history)
    messages = injectHonorificsReminder(messages)
    
    // Inject user toggled reminders
    messages = injectUserReminders(messages)
    
    logDebug('Sending to Pollinations:', messages)
    response = await callPollinations(messages, enableWebSearch)
  } else {
    throw new Error('Unknown API provider')
  }

  // Check if the model needs to search for new characters
  const searchRequest = await checkForSearchRequest(response, lastPrompt.value)

  if (searchRequest && searchRequest.length > 0) {
    logDebug('[callAI] Model requested search for characters:', searchRequest)
    // Perform search for unknown characters
    await wrappedSearchForCharacters(searchRequest)
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

    const messagesWithReminders = injectUserReminders(messages)

    return await callPerplexity(messagesWithReminders, false)
  } else if (apiProvider.value === 'gemini') {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyToSend.map((m) => ({ role: m.role, content: m.content }))
    ]
    messages.push({ role: 'system', content: contextMsg + retryInstruction })
    const messagesWithReminders = injectUserReminders(messages)
    return await callGemini(messagesWithReminders, false)
  } else if (apiProvider.value === 'openrouter') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}`
    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...historyToSend.map((m) => ({ role: m.role, content: m.content }))
    ]
    const messagesWithReminders = injectUserReminders(messages)
    return await callOpenRouter(messagesWithReminders, false)
  } else if (apiProvider.value === 'pollinations') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}`
    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...historyToSend.map((m) => ({ role: m.role, content: m.content }))
    ]
    const messagesWithReminders = injectUserReminders(messages)
    return await callPollinations(messagesWithReminders, false)
  }
  
  throw new Error('Unknown API provider')
}

// Check if the AI response contains a search request for unknown characters
const checkForSearchRequest = async (response: string, userPrompt: string = ''): Promise<string[] | null> => {
  const validateNames = (names: string[], textForValidation: string): string[] => {
    const unique = Array.from(new Set(names.map((n) => (typeof n === 'string' ? n.trim() : '')).filter(Boolean)))
    return unique.filter((name) => {
      if (characterProfiles.value[name] || name.toLowerCase() === 'commander') return false
      const inUserPrompt = userPrompt && isWholeWordPresent(userPrompt, name)
      const inGeneratedText = textForValidation && isWholeWordPresent(textForValidation, name)
      return !!(inUserPrompt || inGeneratedText)
    })
  }

  // Preferred path: shared robust parser
  try {
    const actions = parseAIResponse(response)
    const allGeneratedText = actions.map((a: any) => a?.text || '').join(' ')

    for (const action of actions) {
      if (action?.needs_search && Array.isArray(action.needs_search) && action.needs_search.length > 0) {
        const validated = validateNames(action.needs_search, allGeneratedText)
        if (validated.length > 0) return validated
      }
    }
  } catch {
    // Fall back to regex extraction
  }

  // Fallback: extract needs_search even when JSON is truncated/malformed
  try {
    const m = response.match(/"needs_search"\s*:\s*\[([\s\S]*?)\]/)
    if (m && m[1]) {
      const names = Array.from(m[1].matchAll(/"([^\"]+)"/g)).map((x) => x[1])
      const validated = validateNames(names, response)
      if (validated.length > 0) return validated
    }
  } catch {
    // Ignore
  }
  
  // For Pollinations, only allow search if web search fallback is enabled
  if (apiProvider.value === 'pollinations' && !allowWebSearchFallback.value) {
    return null
  }

  return null
}

// Fetch wiki page content directly and have the model summarize it
// Used for OpenRouter models that don't have native web search.
// We are using a Cloudflare Worker proxy to avoid CORS issues.
// Its code is open-sourced and available in the

// Wrapper functions for web search
const wrappedSearchForCharactersPerplexity = async (characterNames: string[]) => {
  return searchForCharactersPerplexity(characterNames, characterProfiles.value, callPerplexity)
}

const wrappedSearchForCharactersWithNativeSearch = async (characterNames: string[]) => {
  return searchForCharactersWithNativeSearch(characterNames, characterProfiles.value, apiProvider.value, callGemini, callOpenRouter, callPollinations)
}

const wrappedSearchForCharactersViaWikiFetch = async (characterNames: string[]) => {
  return searchForCharactersViaWikiFetch(characterNames, characterProfiles.value, apiProvider.value, callGemini, callOpenRouter, callPollinations)
}

const wrappedSearchForCharacters = async (characterNames: string[]) => {
  return searchForCharacters(
    characterNames,
    characterProfiles.value,
    useLocalProfiles.value,
    allowWebSearchFallback.value,
    apiProvider.value,
    model.value,
    loadingStatus,
    setRandomLoadingMessage,
    wrappedSearchForCharactersPerplexity,
    wrappedSearchForCharactersWithNativeSearch,
    wrappedSearchForCharactersViaWikiFetch
  )
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
  ${knownCharacterNames.length > 0 ? JSON.stringify(effectiveCharacterProfiles.value, null, 2) : prompts.systemPrompt.noProfilesMessage}
  
  ${prompts.systemPrompt.idReference}
  ${relevantCharacterIds.length > 0 ? relevantCharacterIds.join(', ') : prompts.systemPrompt.noIdsMessage}
  
  ${prompts.systemPrompt.instructions}
  ${godModeEnabled.value ? prompts.systemPrompt.godMode : ''}
  `

  return prompt
}

const callOpenRouter = async (messages: any[], enableWebSearch: boolean = false, searchUrl?: string) => {
  let processedMessages = messages

  if (enableContextCaching.value) {
    // Clone messages to avoid mutating the original array
    processedMessages = messages.map((m) => ({ ...m }))

    // 1. Cache System Message (Index 0)
    // Anthropic/OpenRouter expects content blocks for caching
    if (processedMessages.length > 0 && processedMessages[0].role === 'system') {
      const systemContent = processedMessages[0].content
      processedMessages[0] = {
        ...processedMessages[0],
        content: [
          { 
            type: 'text', 
            text: systemContent, 
            cache_control: { type: 'ephemeral' } 
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
                type: 'text', 
                text: msg.content,
                cache_control: { type: 'ephemeral' }
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

  // Check if we already know this model doesn't support json_object
  if (modelsWithoutJsonSupport.has(model.value)) {
    console.log(`Model ${model.value} known to not support json_object, skipping to fallback...`)
    return callWithoutJsonFormat()
  }
  
  // Define Schema for Response Healing (following documentation example)
  const responseSchema = getResponseSchema()
  
  const requestBody: any = {
    model: model.value,
    messages: processedMessages, // Use processedMessages directly to avoid conflicting with schema
    max_tokens: 8192,
    // Force JSON Schema output format for Response Healing
    response_format: responseSchema,
    // Require providers that actually support response_format
    provider: {
      require_parameters: true
    }
  }
  
  let plugins: any[] = []
  const webPlugin = buildWebPlugin()
  if (webPlugin) {
    plugins = [...webPlugin]
  }
  // Add Response Healing plugin
  plugins.push({ id: 'response-healing' })
  
  if (plugins.length > 0) {
    requestBody.plugins = plugins
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
      localStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport]))
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

const callPollinations = async (messages: any[], enableWebSearch: boolean = false) => {
  // Check if we already know this model doesn't support json_schema
  if (modelsWithoutJsonSupport.has(model.value)) {
    console.log(`Model ${model.value} known to not support json_schema, using text fallback...`)
    return callPollinationsWithoutJson(messages, enableWebSearch)
  }

  const requestBody: any = {
    model: model.value,
    messages: messages,
    max_tokens: 8192,
    response_format: getResponseSchema()
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (apiKey.value) {
    headers['Authorization'] = `Bearer ${apiKey.value}`
  }

  const url = apiKey.value ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai'

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Pollinations API Error Details:', errorData)
    
    if (response.status === 429) {
      throw new Error('RATE_LIMITED')
    }
    
    // If error indicates json_schema not supported, remember and retry without
    if (response.status === 400 && (errorData?.error?.message?.includes('response_format') || errorData?.error?.message?.includes('json_schema'))) {
      console.warn(`Model ${model.value} does not support json_schema response format, remembering and retrying without it...`)
      modelsWithoutJsonSupport.add(model.value)
      localStorage.setItem('modelsWithoutJsonSupport', JSON.stringify([...modelsWithoutJsonSupport]))
      return callPollinationsWithoutJson(messages, enableWebSearch)
    }
    
    throw new Error(`Pollinations API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()

  return data.choices[0].message.content
}

const callPollinationsWithoutJson = async (messages: any[], enableWebSearch: boolean = false) => {
  const requestBody: any = {
    model: model.value,
    messages: messages,
    max_tokens: 8192
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (apiKey.value) {
    headers['Authorization'] = `Bearer ${apiKey.value}`
  }

  const url = apiKey.value ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai'

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Pollinations API Error Details:', errorData)
    if (response.status === 429) {
      throw new Error('RATE_LIMITED')
    }
    throw new Error(`Pollinations API Error: ${response.status} ${JSON.stringify(errorData)}`)
  }
  const data = await response.json()

  return data.choices[0].message.content
}

const enrichActionsWithAnimations = async (actions: any[]): Promise<any[]> => {
  logDebug('Enriching actions with animations...')
  
  const filteredAnimations = market.live2d.animations.filter((a) => 
    a !== 'talk_start' && 
    a !== 'talk_end' && 
    a !== 'expression_0' && 
    a !== 'action'
  )
  
  const prompt = prompts.animationEnrichment
    .replace('{currentCharacterId}', market.live2d.current_id)
    .replace('{filteredAnimations}', JSON.stringify(filteredAnimations))
    .replace('{animationMappings}', JSON.stringify(animationMappings, null, 2))
    .replace('{actions}', JSON.stringify(actions.map((a, i) => ({ index: i, text: a.text, character: a.character, speaking: Boolean(a.speaking) })), null, 2))
  
  const messages = [{ role: 'user', content: prompt }]
  
  try {
    let response: string

    if (apiProvider.value === 'perplexity') {
      response = await callPerplexity(messages, false)
    } else if (apiProvider.value === 'gemini') {
      response = await callGemini(messages, false)
    } else if (apiProvider.value === 'openrouter') {
      response = await callOpenRouter(messages, false)
    } else if (apiProvider.value === 'pollinations') {
      response = await callPollinations(messages, false)
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
  const availableAnimations = (market.live2d.animations || []).filter((a) => 
    a !== 'talk_start' && 
    a !== 'talk_end' && 
    a !== 'expression_0' && 
    a !== 'action'
  )
  return actions.map((action) => {
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
        const hasKeyword = keywords.some((keyword) => text.includes(keyword.toLowerCase()))

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

const processAIResponse = async (responseStr: string, depth: number = 0) => {
  loadingStatus.value = 'Processing response...'
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

  // Fallback: handle needs_search directives here (in case the earlier callAI() detection
  // missed them due to truncated/malformed JSON).
  const collectValidatedNeedsSearch = (actions: any[], userPrompt: string = ''): string[] => {
    const allGeneratedText = actions.map((a: any) => a?.text || '').join(' ')
    const requested: string[] = []

    for (const action of actions) {
      if (!action?.needs_search || !Array.isArray(action.needs_search)) continue
      for (const name of action.needs_search) {
        if (typeof name !== 'string') continue
        const trimmed = name.trim()
        if (trimmed) requested.push(trimmed)
      }
    }

    const unique = Array.from(new Set(requested))

    return unique.filter((name) => {
      if (characterProfiles.value[name] || name.toLowerCase() === 'commander') return false
      const inUserPrompt = userPrompt && isWholeWordPresent(userPrompt, name)
      const inGeneratedText = allGeneratedText && isWholeWordPresent(allGeneratedText, name)
      return !!(inUserPrompt || inGeneratedText)
    })
  }

  const needsSearch = collectValidatedNeedsSearch(data, lastPrompt.value)
  if (needsSearch.length > 0) {
    if (depth >= 2) {
      logDebug('[processAIResponse] needs_search detected but recursion limit reached:', needsSearch)
    } else {
      logDebug('[processAIResponse] Detected needs_search directive(s):', needsSearch)
      await wrappedSearchForCharacters(needsSearch)
      setRandomLoadingMessage()
      const followUp = await callAIWithoutSearch(false)
      await processAIResponse(followUp, depth + 1)
      return
    }
  }

  // Ensure narration/dialogue separation even when the model returns a single mixed text step.
  data = sanitizeActions(data)
  logDebug('Sanitized Action Sequence:', data)

  isGenerating.value = false
  loadingStatus.value = '...'

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
          playTTS(data.text, name, market)
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
    loadingStatus.value = 'Click Next to advance...'
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
    loadingStatus.value = '...'
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

  loadingStatus.value = 'Summarizing story so far...'
  const textToSummarize = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')
  const prompt = `Summarize the following story events concisely, focusing on key plot points and character developments. Do not lose important details.\n\n${textToSummarize}`

  const systemMsg = { role: 'system', content: 'You are a helpful assistant that summarizes story events.' }
  const userMsg = { role: 'user', content: prompt }
  const msgs = [systemMsg, userMsg]

  try {
    let summary = ''

    if (apiProvider.value === 'perplexity') {
      summary = await callPerplexity(msgs, false)
    } else if (apiProvider.value === 'gemini') {
      summary = await callGeminiSummarization(msgs, apiKey.value, model.value)
    } else if (apiProvider.value === 'openrouter') {
      summary = await callOpenRouterSummarization(msgs, apiKey.value, model.value)
    } else if (apiProvider.value === 'pollinations') {
      summary = await callPollinationsSummarization(msgs, apiKey.value, model.value)
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

/* Settings section headers */
.settings-section-header {
  margin: 16px 0 8px 0;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent, #1565c0);
  border-left: 4px solid var(--accent, #1565c0);
  background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(0,0,0,0));
}

.accent-blue { --accent: #1565c0; }
.accent-green { --accent: #2e7d32; }
.accent-purple { --accent: #6a1b9a; }
.accent-light-blue { --accent: #00eeff; }
.accent-orange { --accent: #ef6c00; }
.accent-red { --accent: #c62828; }
</style>
