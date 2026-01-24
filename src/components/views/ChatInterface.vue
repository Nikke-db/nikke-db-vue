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

    <n-button class="reset-btn" circle @click="resetCharacterPlacement" title="Reset Character Position">
      <template #icon>
        <n-icon><Reset /></n-icon>
      </template>
    </n-button>

    <div
      class="chat-container"
      v-show="chatMode === 'classic' || (chatMode === 'nikke' && !nikkeOverlayVisible)"
      :style="{
        top: chatPosition.y + 'px',
        left: chatPosition.x + 'px',
        width: chatSize.width + 'px',
        height: chatSize.height + 'px',
        bottom: 'auto',
        maxHeight: 'none'
      }"
    >
      <!-- Drag Handle -->
      <div class="chat-drag-handle" @mousedown="startDrag" @touchstart="startDrag">
        <div class="drag-indicator">
          <n-icon size="16"><Draggable /></n-icon>
          <span class="drag-title">Chat</span>
        </div>
        <div class="window-controls">
          <n-button size="tiny" circle quaternary @click="initChatLayout" title="Reset Position">
            <template #icon
              ><n-icon><Reset /></n-icon
            ></template>
          </n-button>
        </div>
      </div>

      <div class="chat-history" ref="chatHistoryRef">
        <div v-for="(msg, index) in chatHistory" :key="index" :class="['message', msg.role, { 'replay-enabled': enableAnimationReplay && msg.role !== 'user' && (msg.animation || msg.character), selected: selectedMessageIndex === index }]" @click="msg.role !== 'user' ? replayMessage(msg, index) : null">
          <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
          <div v-if="index === chatHistory.length - 1 && !isLoading && msg.role === 'assistant'" class="message-top-actions" style="right: 0; left: auto">
            <n-button size="tiny" circle type="warning" @click.stop="regenerateResponse" title="Retry this message">
              <template #icon
                ><n-icon><Renew /></n-icon
              ></template>
            </n-button>
          </div>
          <div v-if="index === chatHistory.length - 1 && !isLoading && msg.role !== 'system'" class="message-actions">
            <n-button size="tiny" circle type="error" @click.stop="deleteLastMessage" title="Delete last message">
              <template #icon
                ><n-icon><TrashCan /></n-icon
              ></template>
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

      <div class="chat-input-area" style="gap: 6px">
        <n-input v-model:value="userInput" type="textarea" :placeholder="apiKey || apiProvider === 'pollinations' || apiProvider === 'local' ? 'Type your message...' : 'Please enter API Key in settings'" :disabled="!apiKey && apiProvider !== 'pollinations' && apiProvider !== 'local'" :autosize="{ minRows: 1, maxRows: 4 }" @keydown.enter.prevent="handleEnter" />
        <n-button type="primary" @click="sendMessage" :disabled="isLoading || !userInput.trim() || (!apiKey && apiProvider !== 'pollinations' && apiProvider !== 'local')">Send</n-button>
        <n-button type="error" @click="stopGeneration" v-if="isLoading">Stop</n-button>
        <n-button type="warning" @click="retryLastMessage" v-if="showRetry && !isLoading">Retry</n-button>
        <n-button type="success" @click="nextAction" v-if="(waitingForNext || !isLoading) && chatHistory.length > 0">
          {{ waitingForNext ? 'Next' : 'Continue' }}
        </n-button>
      </div>

      <div class="session-controls" style="justify-content: flex-start; gap: 2px">
        <n-button type="error" size="small" @click="saveSession" :disabled="chatHistory.length === 0 || isLoading" :style="{ opacity: chatHistory.length === 0 || isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
          <template #icon
            ><n-icon><Save /></n-icon
          ></template>
          Save
        </n-button>
        <n-button type="warning" size="small" @click="triggerRestore" :disabled="isLoading" :style="{ marginLeft: '4px', opacity: isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
          <template #icon
            ><n-icon><Upload /></n-icon
          ></template>
          Load
        </n-button>
        <n-button type="error" size="small" @click="resetSession" :disabled="isLoading || chatHistory.length === 0" :style="{ marginLeft: '4px', opacity: chatHistory.length === 0 || isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
          <template #icon
            ><n-icon><Reset /></n-icon
          ></template>
          Reset
        </n-button>
        <n-popover trigger="click" v-model:show="showRemindersDropdown" placement="top">
          <template #trigger>
            <n-button type="info" size="small" :style="{ marginLeft: '4px', opacity: isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
              <template #icon>
                <n-icon><Help /></n-icon>
              </template>
              Problems?
            </n-button>
          </template>
          <div style="display: flex; flex-direction: column; gap: 8px; padding: 4px; min-width: 150px">
            <div style="font-weight: 600; font-size: 12px; opacity: 0.7; border-bottom: 1px solid var(--n-border-color); padding-bottom: 4px; margin-bottom: 2px">Inject one or more reminders to the model for the next turn:</div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">
              <n-checkbox v-model:checked="invalidJsonToggle">Invalid JSON Schema</n-checkbox>
              <n-checkbox v-model:checked="invalidJsonPersist" size="small">Persist</n-checkbox>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">
              <n-checkbox v-model:checked="incorrectAnimationsToggle">Incorrect or Lazy Animations</n-checkbox>
              <n-checkbox v-model:checked="incorrectAnimationsPersist" size="small">Persist</n-checkbox>
            </div>
            <n-checkbox v-model:checked="honorificsToggle">Incorrect Honorifics</n-checkbox>
            <n-checkbox v-model:checked="narrationAndDialogueNotSplitToggle">Narration and Dialogue Not Split</n-checkbox>
            <n-checkbox v-model:checked="wrongSpeechStylesToggle">Using Wrong Speech Styles</n-checkbox>
            <n-checkbox v-if="mode === 'roleplay'" v-model:checked="aiControllingUserToggle">AI Is Controlling Me</n-checkbox>
          </div>
        </n-popover>
      </div>

      <!-- Resize Handles -->
      <div class="resize-handle nw" @mousedown="startResize($event, 'nw')" @touchstart="startResize($event, 'nw')"></div>
      <div class="resize-handle ne" @mousedown="startResize($event, 'ne')" @touchstart="startResize($event, 'ne')"></div>
      <div class="resize-handle sw" @mousedown="startResize($event, 'sw')" @touchstart="startResize($event, 'sw')"></div>
      <div class="resize-handle se" @mousedown="startResize($event, 'se')" @touchstart="startResize($event, 'se')">
        <n-icon size="16"><Maximize /></n-icon>
      </div>
    </div>

    <!-- NIKKE Mode Overlay -->
    <transition name="fade">
      <div v-if="chatMode === 'nikke' && nikkeOverlayVisible" class="nikke-chat-overlay" :class="{ passthrough: nikkeOverlayPassthrough }">
        <div class="nikke-vignette"></div>

        <!-- Stop Button for NIKKE Mode -->
        <div class="nikke-overlay-controls">
          <n-button type="error" circle @mousedown.stop="stopGeneration" @touchstart.stop="stopGeneration" title="Stop Generation">
            <template #icon
              ><n-icon><Close /></n-icon
            ></template>
          </n-button>
        </div>

        <div class="nikke-dialogue-container">
          <div v-if="nikkeCurrentSpeaker" class="nikke-speaker-name">
            <div class="nikke-speaker-indicator" :style="{ backgroundColor: nikkeSpeakerColor }"></div>
            <span>{{ nikkeCurrentSpeaker }}</span>
          </div>
          <div class="nikke-dialogue-text">
            {{ nikkeDisplayedText }}
          </div>
        </div>

        <!-- Game Mode Choices Overlay -->
        <transition name="fade">
          <div v-if="gameChoices.length > 0" class="game-choices-overlay">
            <div class="choices-container">
              <div v-for="(choice, index) in gameChoices" :key="index" class="choice-btn" @click="handleGameChoice(choice)">
                <div class="choice-marker"></div>
                <span class="choice-text">{{ (choice.text || (choice as any).label || '').replace(/^["']|["']$/g, '') }}</span>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </transition>

    <n-drawer v-model:show="showSettings" width="300" placement="right">
      <n-drawer-content title="Settings">
        <n-form>
          <h4 class="settings-section-header accent-blue">AI Provider & Model</h4>
          <n-divider />
          <n-form-item label="API Provider">
            <n-select v-model:value="apiProvider" :options="providerOptions" />
          </n-form-item>

          <n-form-item label="Local Endpoint URL" v-if="apiProvider === 'local'">
            <n-input v-model:value="localUrl" placeholder="http://localhost:5001/v1" />
          </n-form-item>

          <n-form-item v-if="apiProvider === 'local'">
            <template #label>
              Maximum Tokens
              <n-popover trigger="hover" placement="bottom" style="max-width: 300px">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  <p>This value should be equal to or lower than the context limit set in your local model runner (e.g., LM Studio, Ollama). Using higher values may result in errors.</p>
                  <p>Acceptable values are between 8192 and 98304. The lower the number, the worse your experience will be. Note that higher values will require much higher system requirements.</p>
                </div>
              </n-popover>
            </template>
            <n-input-number v-model:value="localMaxTokens" :min="8192" :max="98304" :step="1024" placeholder="8192" style="width: 100%" />
          </n-form-item>

          <n-form-item label="API Key" v-if="apiProvider !== 'local'">
            <n-input v-model:value="apiKey" type="password" show-password-on="click" placeholder="Enter API Key" />
          </n-form-item>
          <n-alert type="info" style="margin-bottom: 12px" title=""> Your API key is stored locally in your browser's local storage, and it is never sent to Nikke-DB. </n-alert>
          <n-alert v-if="apiProvider === 'pollinations'" type="info" style="margin-bottom: 12px" title=""> For Pollinations, the API key is optional. Register at <a href="https://enter.pollinations.ai" target="_blank">enter.pollinations.ai</a> for a Secret key to increase rates and available models. </n-alert>
          <n-alert type="warning" style="margin-bottom: 12px" title=""> Users are responsible for any possible cost using this functionality. </n-alert>
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
          <n-form-item label="Model" v-if="apiProvider !== 'local'">
            <n-select v-model:value="model" :options="modelOptions" />
          </n-form-item>

          <n-form-item v-if="reasoningEffortOptions.length > 0">
            <template #label>
              Reasoning Effort
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Controls how much time/budget the model spends "thinking" before answering.<br /><br />
                  Recommended to use lower values or disable thinking entirely. <br /><br />
                  Has no effect on models without thinking capabilities.
                </div>
              </n-popover>
            </template>
            <n-select v-model:value="reasoningEffort" :options="reasoningEffortOptions" />
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
                  Controls how often the story is summarized to save tokens. Will affect costs and speed.<br /><br />Does not affect the Save and Load functionality.<br /><br />
                  <strong>Low:</strong> Summarizes every 10 turns. Cost-efficient.<br />
                  <strong>Medium:</strong> Summarizes every 30 turns. Balanced.<br />
                  <strong>High:</strong> Summarizes every 60 turns. Uses more tokens.<br />
                  <strong>Goddess:</strong> Disables summarization and sends the full history to the model on every turn. This may result in higher costs and slower responses in time, but provides the best context for the AI.
                </div>
              </n-popover>
            </template>
            <n-select v-model:value="tokenUsage" :options="tokenUsageOptions" />
          </n-form-item>

          <n-form-item v-if="isDev">
            <template #label>
              Context Caching <span style="font-size: smaller">(Experimental)</span>
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Adds explicit caching headers for supported models (Claude, Gemini) on OpenRouter and Pollinations.<br /><br />
                  Significantly reduces costs for long conversations by caching the history.<br />
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
              Use Nikke-DB Knowledge <span style="font-size: smaller">(Recommended)</span>
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Uses Nikke-DB's built-in character knowledge when available instead of searching the web.<br /><br />
                  Faster and saves API costs.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="useLocalProfiles" :disabled="!isDev" />
          </n-form-item>

          <n-form-item v-if="useLocalProfiles">
            <template #label>
              Allow Web Search Fallback <span style="font-size: smaller">(Recommended)</span>
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
                  <strong>Roleplay:</strong> Play as the Protagonist (the Commander). Your input in the chatbox is treated as dialogue. Wrap your text in [] for actions and to steer the story.<br /><br />
                  <strong>Story:</strong> Automatically generates a story based on your input. It is strongly recommended to enter the names of the characters you want in the scene and its setting in the first prompt. While the story is being played out, you can send more prompts to steer the narrative in the direction you want, or click 'Continue' to advance.<br /><br />
                  <strong>Game:</strong> Similar to Roleplay, but instead of typing in the chatbox, you are presented choices similarly to the videogame. You may still override the choices by typing your own after pressing the red X icon on the upper right corner.
                </div>
              </n-popover>
            </template>
            <n-radio-group v-model:value="mode" name="modegroup">
              <n-radio-button value="roleplay">Roleplay</n-radio-button>
              <n-radio-button value="story">Story</n-radio-button>
              <n-radio-button value="game">Game</n-radio-button>
            </n-radio-group>
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
                  Prevents any action in the story from causing the Commander's death.<br /><br />
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
                  <strong>Low:</strong> Slightly worse quality and detail, but much better performance on low-end systems.<br /><br />
                  <strong>High:</strong> Best visual quality, but uses more GPU resources and VRAM.
                </div>
              </n-popover>
            </template>
            <n-radio-group v-model:value="assetQuality" name="assetqualitygroup">
              <n-radio-button value="low">Low</n-radio-button>
              <n-radio-button value="high">High</n-radio-button>
            </n-radio-group>
          </n-form-item>

          <n-form-item>
            <template #label>
              Chat Mode
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  <strong>Classic:</strong> More similar to a standard LLM interface, with a traditional chat layout.<br />Not available in Game Mode.<br /><br />
                  <strong>NIKKE:</strong> Interface looks much more similar to the videogame, with overlay text and typewriter effects.
                </div>
              </n-popover>
            </template>
            <n-radio-group v-model:value="chatMode" name="chatmodegroup">
              <n-radio-button :disabled="mode === 'game'" value="classic">Classic</n-radio-button>
              <n-radio-button value="nikke">NIKKE</n-radio-button>
            </n-radio-group>
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
                  <strong>Auto:</strong> Advances automatically.<br />
                  <strong>Manual:</strong> Click 'Next' to advance.
                </div>
              </n-popover>
            </template>
            <n-radio-group v-model:value="playbackMode" name="playbackgroup">
              <n-radio-button value="auto">Auto</n-radio-button>
              <n-radio-button value="manual">Manual</n-radio-button>
            </n-radio-group>
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
                <div>Enables lip-sync animation when characters speak.</div>
              </n-popover>
            </template>
            <n-switch v-model:value="market.live2d.yapEnabled" />
          </n-form-item>

          <n-form-item>
            <template #label>
              Enable Animation Replay
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Allows you to click on a message to replay the animation and character associated with it.<br />
                  Slightly increases file sizes and local memory usage.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="enableAnimationReplay" />
          </n-form-item>

          <n-form-item>
            <template #label>
              Text to Speech <span style="font-size: smaller">(Experimental)</span>
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Enables TTS using a local TTS server.<br />
                  Supports AllTalk (XTTSv2) or GPT-SoVits.<br /><br />
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
                  Path to your GPT-SoVits installation folder.<br />
                  Voice files should be at: <code>{basePath}/voices/{character}/{character}.wav</code><br />
                  Prompt text at: <code>{basePath}/voices/{character}/{character}.txt</code>
                </div>
              </n-popover>
            </template>
            <n-input v-model:value="gptSovitsBasePath" placeholder="C:/GPT-SoVITS" />
          </n-form-item>

          <n-form-item label="Chatterbox Endpoint" v-if="ttsEnabled && ttsProvider === 'chatterbox'">
            <n-input v-model:value="chatterboxEndpoint" placeholder="http://localhost:4123" />
          </n-form-item>
          <n-divider />
        </n-form>
      </n-drawer-content>
    </n-drawer>

    <input type="file" ref="fileInput" style="display: none" accept=".json" @change="handleFileUpload" />

    <n-modal v-model:show="showGuide" :mask-closable="false" preset="card" title="Story/Roleplaying Generator Guide" style="width: 700px; max-width: 95vw">
      <div class="guide-content">
        <div v-if="guidePage === 1" class="guide-page">
          <h3>🚀 Welcome to the Story Generator</h3>
          <p>Create interactive stories or roleplay scenarios with Nikke characters using your preferred AI LLM.</p>

          <div class="guide-section">
            <h4>🔑 API Setup</h4>
            <ul>
              <li><strong>Providers:</strong> Supports <strong>Gemini</strong>, <strong>OpenRouter</strong>, <strong>Pollinations</strong>, and <strong>Local</strong> (OpenAI-compatible).</li>
              <li><strong>Pollinations:</strong> Can be used without a key, but with limited models and rate limits.</li>
              <li><strong>Privacy:</strong> Your API keys are stored <strong>locally</strong> in your browser and never sent to Nikke-DB.</li>
              <li><strong>Cost:</strong> Be mindful of your provider's usage. Web search may incur extra costs. You are solely responsible for this.</li>
            </ul>
          </div>
        </div>

        <div v-if="guidePage === 2" class="guide-page">
          <h3>🎭 Interaction Modes</h3>
          <div class="guide-section">
            <ul>
              <li>
                <strong>Roleplay Mode:</strong> You play as the Commander. The AI controls the narrative.
                <ul>
                  <li>Use <code>[brackets]</code> for actions (e.g., <code>[I nod slowly]</code>).</li>
                  <li>Type normally for dialogue (e.g., <code>Good work today, Rapi.</code>).</li>
                </ul>
              </li>
              <li>
                <strong>Story Mode:</strong> You act as the director. The AI generates the narrative.
                <ul>
                  <li><strong>Tip:</strong> Start by defining the <strong>Setting</strong> and <strong>Characters</strong>.</li>
                </ul>
              </li>
              <li>
                <strong>Game Mode:</strong> A NIKKE-like experience.
                <ul>
                  <li>The AI narrates, and you choose from generated options.</li>
                  <li>You can still override choices by clicking the red X and then typing as you would in Roleplay Mode..</li>
                </ul>
              </li>
            </ul>
          </div>
        </div>

        <div v-if="guidePage === 3" class="guide-page">
          <h3>✨ Immersive Features</h3>
          <div class="guide-section">
            <ul>
              <li><strong>Yap Mode:</strong> Enables real-time lip-syncing for characters on screen.</li>
              <li><strong>Text-to-Speech (TTS):</strong> Experimental support for <strong>AllTalk</strong>, <strong>GPT-SoVits</strong>, and <strong>Chatterbox</strong> for voiced dialogue.</li>
              <li><strong>Animation Replay:</strong> Click on any message in the history to replay the character's animation and expression from that moment.</li>
              <li><strong>Playback:</strong> Choose <strong>Auto</strong> for a continuous flow or <strong>Manual</strong> to advance at your own pace.</li>
            </ul>
          </div>
        </div>

        <div v-if="guidePage === 4" class="guide-page">
          <h3>🧠 Knowledge & Search</h3>
          <div class="guide-section">
            <ul>
              <li><strong>Nikke-DB Knowledge:</strong> Uses built-in character profiles for better accuracy and lower costs.</li>
              <li><strong>AI Memory:</strong> The AI can track <strong>Character Progression</strong>, updating personalities and relationships as the story develops.</li>
              <li><strong>Web Search Fallback:</strong> If the AI doesn't know a character or event, it can search the web (supported by some OpenRouter models) or fetch from the Nikke Wiki.</li>
              <li><strong>Local Models:</strong> Connect to your own local LLM server (like LM Studio or Ollama) via the <strong>Local</strong> provider.</li>
            </ul>
          </div>
        </div>

        <div v-if="guidePage === 5" class="guide-page">
          <h3>💡 Tips & Troubleshooting</h3>
          <div class="guide-section">
            <ul>
              <li><strong>Problems? Button:</strong> Use this if the AI is misbehaving, such as showing garbled text, using wrong speech styles for characters, etc.</li>
              <li><strong>Model Quality:</strong> The experience varies greatly between models. Larger models generally perform better. Avoid using models tuned for other tasks such as coding.</li>
              <li><strong>Save/Load:</strong> Use the <strong>Save</strong> icon to download your session. You can resume it later by loading the file.</li>
              <li><strong>Context Usage:</strong> Adjust "Tokens Usage" in settings to balance between speed and cost.</li>
            </ul>
          </div>
        </div>

        <div class="guide-footer">
          <div class="guide-steps">
            <div v-for="p in 5" :key="p" class="guide-step" :class="{ active: guidePage === p }"></div>
          </div>
          <div class="guide-actions">
            <n-button v-if="guidePage > 1" @click="guidePage--" style="margin-right: 10px">
              <template #icon
                ><n-icon><ChevronLeft /></n-icon
              ></template>
              Back
            </n-button>
            <n-button v-if="guidePage < 5" type="primary" @click="guidePage++">
              Next
              <template #icon
                ><n-icon><ChevronRight /></n-icon
              ></template>
            </n-button>
            <n-button v-else type="primary" @click="closeGuide">Got it!</n-button>
          </div>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useMarket } from '@/stores/market'
import { Settings, Help, Save, Upload, TrashCan, Reset, Renew, Draggable, Maximize, Close, ChevronLeft, ChevronRight } from '@vicons/carbon'
import { NIcon, NButton, NInput, NDrawer, NDrawerContent, NForm, NFormItem, NSelect, NSwitch, NPopover, NAlert, NModal, NSpin, NCheckbox } from 'naive-ui'
import l2d from '@/utils/json/l2d.json'
import localCharacterProfiles from '@/utils/json/characterProfiles.json'
import loadingMessages from '@/utils/json/loadingMessages.json'
import prompts from '@/utils/json/prompts.json'
import { marked } from 'marked'
import { sanitizeActions, parseFallback, parseAIResponse, isWholeWordPresent, formatChoiceAsUserTurn, filterEchoedUserChoiceDialogueInGameMode, stripChoicesWhenNotGameMode, ensureGameModeChoicesFallback, calculateYapDuration, replayMessage as replayMessageUtil, getHonorific, createTypewriterController, getEffectiveCharacterProfiles, logDebug } from '@/utils/chatUtils'
import { normalizeAiActionCharacterData } from '@/utils/aiActionNormalization'
import { ttsEnabled, ttsEndpoint, ttsProvider, gptSovitsEndpoint, gptSovitsBasePath, chatterboxEndpoint, ttsProviderOptions, playTTS } from '@/utils/ttsUtils'
import { allowWebSearchFallback, usesWikiFetch, usesPollinationsAutoFallback, webSearchFallbackHelpText, searchForCharacters, searchForCharactersWithNativeSearch, searchForCharactersViaWikiFetch } from '@/utils/aiWebSearchUtils'
import { callOpenRouter as callOpenRouterImpl, callGemini as callGeminiImpl, callPollinations as callPollinationsImpl, enrichActionsWithAnimations, callLocal as callLocalImpl, summarizeChunk as summarizeChunkImpl, getFilteredAnimations, providerOptions, tokenUsageOptions, fetchOpenRouterModels, fetchPollinationsModels } from '@/utils/llmUtils'
import { captureSpineCanvasPlacement, restoreSpineCanvasPlacement } from '@/utils/spineUtils'
import { isInteractiveOverlayTarget, isSpineCanvasAtPoint, getEventPoint } from '@/utils/overlayUtils'

const market = useMarket()

const pendingGameChoiceText = ref<string | null>(null)
const abortCurrentPlaybackForChoice = ref(false)

// State
const showSettings = ref(false)
const showGuide = ref(false)
const guidePage = ref(1)
const useLocalProfiles = ref(localStorage.getItem('nikke_use_local_profiles') !== 'false')
const apiProvider = ref('openrouter')
const apiKey = ref(localStorage.getItem('nikke_api_key') || '')
const localUrl = ref(localStorage.getItem('nikke_local_url') || 'http://localhost:5001/v1')
const localMaxTokens = ref(Number(localStorage.getItem('nikke_local_max_tokens')) || 8192)
const model = ref('')
const mode = ref('roleplay')
const tokenUsage = ref('medium')
const reasoningEffort = ref(localStorage.getItem('nikke_reasoning_effort') || 'default')

watch(reasoningEffort, (val) => {
  localStorage.setItem('nikke_reasoning_effort', val)
})

const reasoningEffortOptions = computed(() => {
  let options: { label: string; value: string }[] = []

  if (apiProvider.value === 'openrouter' || apiProvider.value === 'pollinations') {
    options = [
      { label: 'Default', value: 'default' },
      { label: 'None', value: 'none' },
      { label: 'Minimal', value: 'minimal' },
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Extra High', value: 'xhigh' }
    ]
  } else if (apiProvider.value === 'gemini') {
    options = [
      { label: 'Default', value: 'default' },
      { label: 'Minimal', value: 'minimal' },
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Extra High', value: 'xhigh' }
    ]
  }

  // Restrict options in production since anything beyond 'medium' is silly
  if (!import.meta.env.DEV) {
    const allowedValues = ['default', 'none', 'minimal', 'low', 'medium']
    options = options.filter((o) => allowedValues.includes(o.value))
  }

  return options
})
const enableContextCaching = ref(true)
const playbackMode = ref('manual')
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
const isLoadedSession = ref(false) // Flag to track if session was restored from file
let nextActionResolver: (() => void) | null = null
let yapTimeoutId: any = null
const chatHistory = ref<{ role: string; content: string; animation?: string; character?: string; speaking?: boolean; text?: string }[]>([])
const characterProfiles = ref<Record<string, any>>({})
const characterProgression = ref<Record<string, any>>({})
const gameChoices = ref<{ text: string; type?: 'dialogue' | 'action'; label?: string }[]>([])
const pendingGameChoices = ref<{ text: string; type?: 'dialogue' | 'action'; label?: string }[]>([])
const choicesAwaitingReveal = ref(false)
const animationCache = ref<Record<string, string[]>>({})

// Settings
const enableAnimationReplay = ref(false)
const selectedMessageIndex = ref<number | null>(null)
const originalHQAssets = ref(true)

// NIKKE Mode State
const chatMode = ref(localStorage.getItem('nikke_chat_mode') || 'nikke')
const nikkeOverlayVisible = ref(false)
const nikkeOverlayPassthrough = ref(false)
const nikkeCurrentSpeaker = ref('')
const nikkeCurrentText = ref('')
const nikkeDisplayedText = ref('')
const isTyping = ref(false)
const nikkeSpeakerColor = ref('#ffffff')

// Typewriter controller (moved to utils). Instantiate a controller bound to the
// component's refs so we keep the interval state out of the component.
const { start: startTypewriter, stop: stopTypewriter } = createTypewriterController({ displayedRef: nikkeDisplayedText, currentTextRef: nikkeCurrentText, typingRef: isTyping })

const handleOverlayClick = (e: MouseEvent | TouchEvent) => {
  if (e && 'stopPropagation' in e) {
    if ('cancelable' in e && e.cancelable) e.preventDefault()
    e.stopPropagation()
  }

  // If in replay mode, close overlay and deselect
  if (selectedMessageIndex.value !== null) {
    if (isTyping.value) {
      stopTypewriter()
      return
    }
    nikkeOverlayVisible.value = false
    selectedMessageIndex.value = null
    return
  }

  // If choices are visible, clicking anywhere else should do nothing.
  if (gameChoices.value.length > 0) {
    return
  }

  // If choices are pending, require an extra click AFTER typewriter finishes.
  if (choicesAwaitingReveal.value) {
    if (isTyping.value) {
      stopTypewriter()
      return
    }

    if (pendingGameChoices.value.length > 0) {
      gameChoices.value = pendingGameChoices.value
      pendingGameChoices.value = []
      choicesAwaitingReveal.value = false
      loadingStatus.value = 'Waiting for choice...'
    }

    return
  }

  if (isTyping.value) {
    stopTypewriter()
  } else if (chatMode.value === 'nikke' && nikkeOverlayVisible.value) {
    nextAction()
  }
}

// NIKKE overlay: tap anywhere to advance, but never when interacting with the spine canvas.
const nikkeTapState = {
  startedOnSpineCanvas: false,
  startedOnInteractive: false,
  moved: false,
  startX: 0,
  startY: 0,
  multiTouch: false
}

let lastNikkeTouchTs = 0
let lastNikkeHandledTs = 0

const onNikkeGlobalStart = (e: MouseEvent | TouchEvent) => {
  if (chatMode.value !== 'nikke' || !nikkeOverlayVisible.value) return

  const { x, y, touches } = getEventPoint(e)
  nikkeTapState.startX = x
  nikkeTapState.startY = y
  nikkeTapState.moved = false
  nikkeTapState.multiTouch = touches >= 2

  const target = e.target
  nikkeTapState.startedOnInteractive = isInteractiveOverlayTarget(target)

  // Only pass-through if the finger starts on the actual canvas.
  nikkeTapState.startedOnSpineCanvas = typeof document !== 'undefined' && isSpineCanvasAtPoint(x, y)
  nikkeOverlayPassthrough.value = nikkeTapState.startedOnSpineCanvas

  if ('touches' in e) {
    lastNikkeTouchTs = Date.now()
  }
}

const onNikkeGlobalMove = (e: MouseEvent | TouchEvent) => {
  if (chatMode.value !== 'nikke' || !nikkeOverlayVisible.value) return
  if (!nikkeTapState.startedOnSpineCanvas) return

  const { x, y, touches } = getEventPoint(e)
  if (touches >= 2) {
    nikkeTapState.multiTouch = true
    nikkeTapState.moved = true
    return
  }

  const dx = Math.abs(x - nikkeTapState.startX)
  const dy = Math.abs(y - nikkeTapState.startY)
  if (dx > 6 || dy > 6) nikkeTapState.moved = true
}

const onNikkeGlobalEnd = (e: MouseEvent | TouchEvent) => {
  if (chatMode.value !== 'nikke' || !nikkeOverlayVisible.value) return

  // Always restore overlay hit-testing after the gesture.
  nikkeOverlayPassthrough.value = false

  // Ignore mouse events right after touch (mobile "ghost" mouse events).
  const now = Date.now()
  if (!('touches' in e) && now - lastNikkeTouchTs < 800) return

  // De-dupe rapid double-fires.
  if (now - lastNikkeHandledTs < 250) return
  lastNikkeHandledTs = now

  // Never advance if the gesture started on spine, or on an interactive overlay element.
  if (nikkeTapState.startedOnInteractive) return
  if (nikkeTapState.moved || nikkeTapState.multiTouch) return

  // Allow tap-to-advance on the spine canvas too (but only if it was a tap, not a drag/pinch).
  // If choices are visible, let the choice UI handle it.
  if (gameChoices.value.length > 0) return

  // Regression fix: a single tap should never both finish typing AND advance.
  if (isTyping.value) {
    stopTypewriter()
    return
  }

  handleOverlayClick(e)
}

// Window Management State
const chatPosition = ref({ x: 0, y: 0 })
const chatSize = ref({ width: 400, height: 600 })
const isDragging = ref(false)
const isResizing = ref(false)
const resizeDirection = ref('')
const dragOffset = ref({ x: 0, y: 0 })
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0, initialX: 0, initialY: 0 })

// Effective profiles = base profiles + progression overlays (personality + relationships only)
const effectiveCharacterProfiles = computed<Record<string, any>>(() => {
  return getEffectiveCharacterProfiles(characterProfiles.value, characterProgression.value)
})
const chatHistoryRef = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const openRouterModels = ref<any[]>([])
const pollinationsModels = ref<any[]>([])
const isRestoring = ref(false)
const needsJsonReminder = ref(false)
const isDev = import.meta.env.DEV

if (!isDev) useLocalProfiles.value = true

// AI Reminders state
const showRemindersDropdown = ref(false)
const invalidJsonToggle = ref(false)
const invalidJsonPersist = ref(false)
const honorificsToggle = ref(false)
const aiControllingUserToggle = ref(false)
const narrationAndDialogueNotSplitToggle = ref(false)
const wrongSpeechStylesToggle = ref(false)
const incorrectAnimationsToggle = ref(false)
const incorrectAnimationsPersist = ref(false)

watch(invalidJsonPersist, (val) => {
  if (val) {
    invalidJsonToggle.value = true
  }
})

watch(invalidJsonToggle, (val) => {
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

// Helper to set random loading message
const setRandomLoadingMessage = () => {
  loadingStatus.value = loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
}

// Models/providers that have native web search in OpenRouter

// Options
// Handled by llmUtils.ts

const modelOptions = computed(() => {
  if (apiProvider.value === 'gemini') {
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

// Computed

const computedUsesWikiFetch = computed(() => usesWikiFetch(apiProvider.value, model.value))

const computedUsesPollinationsAutoFallback = computed(() => usesPollinationsAutoFallback(apiProvider.value, model.value))

const computedWebSearchFallbackHelpText = computed(() => webSearchFallbackHelpText(computedUsesWikiFetch.value, computedUsesPollinationsAutoFallback.value))

const assetQuality = computed({
  get: () => (market.live2d.HQassets ? 'high' : 'low'),
  set: (val: string) => {
    market.live2d.HQassets = val === 'high'
  }
})

// Watchers
watch(chatMode, (newVal) => {
  // Prevent selecting Classic while in Game mode
  if (newVal === 'classic' && mode.value === 'game') {
    // If we're in game mode, force NIKKE mode instead
    chatMode.value = 'nikke'
    return
  }
  localStorage.setItem('nikke_chat_mode', newVal)
})

watch(apiKey, async (newVal) => {
  localStorage.setItem('nikke_api_key', newVal)
  if (apiProvider.value === 'pollinations') {
    pollinationsModels.value = await fetchPollinationsModels(apiKey.value)
    if (pollinationsModels.value.length > 0) {
      model.value = pollinationsModels.value[0].value
    }
  }
})

watch(localUrl, (newVal) => {
  localStorage.setItem('nikke_local_url', newVal)
})

watch(localMaxTokens, (newVal) => {
  localStorage.setItem('nikke_local_max_tokens', String(newVal))
})

watch(useLocalProfiles, (newVal) => {
  if (isDev || newVal) {
    localStorage.setItem('nikke_use_local_profiles', String(newVal))
  } else {
    useLocalProfiles.value = true
  }
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
  // If switching to Game mode, ensure chatMode is not 'classic'
  if (newVal === 'game' && chatMode.value === 'classic') {
    chatMode.value = 'nikke'
  }
})

watch(tokenUsage, (newVal) => {
  localStorage.setItem('nikke_token_usage', newVal)
})

watch(enableContextCaching, (newVal) => {
  localStorage.setItem('nikke_enable_context_caching', String(newVal))
})

watch(enableAnimationReplay, (newVal) => {
  localStorage.setItem('nikke_enable_animation_replay', String(newVal))
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

watch(godModeEnabled, (newVal) => {
  localStorage.setItem('nikke_god_mode_enabled', String(newVal))
})

watch(model, (newVal) => {
  if (newVal) localStorage.setItem('nikke_model', newVal)
})

watch(
  () => market.live2d.yapEnabled,
  (newVal) => {
    localStorage.setItem('nikke_yap_enabled', String(newVal))
  }
)

watch(
  () => market.live2d.HQassets,
  (newVal) => {
    localStorage.setItem('nikke_hq_assets', String(newVal))
    market.live2d.triggerResetPlacement()
  }
)

// Cache animations when they're loaded for any character
watch(
  () => market.live2d.animations,
  (animations) => {
    const currentId = market.live2d.current_id
    if (!currentId || !animations || animations.length === 0) return

    const existing = animationCache.value[currentId]
    if (existing && existing.length >= animations.length) {
      logDebug(`[AnimationCache] Skipping cache update for ${currentId}: existing has ${existing.length}, new has ${animations.length}`)
      return
    }

    animationCache.value[currentId] = [...animations]
    logDebug(`[AnimationCache] Cached ${animations.length} animations for ${currentId}`)
  },
  { deep: true }
)

watch(apiProvider, async (newVal) => {
  localStorage.setItem('nikke_api_provider', newVal)

  if (isRestoring.value) return

  // Reset reasoning effort
  reasoningEffort.value = 'default'

  // Reset model when provider changes
  if (apiProvider.value === 'gemini') {
    model.value = 'gemini-2.5-flash'
  } else if (apiProvider.value === 'openrouter') {
    model.value = ''
    openRouterModels.value = await fetchOpenRouterModels()

    if (openRouterModels.value.length > 0) {
      model.value = openRouterModels.value[0].value
    }
  } else if (apiProvider.value === 'pollinations') {
    model.value = ''
    pollinationsModels.value = await fetchPollinationsModels(apiKey.value)

    if (pollinationsModels.value.length > 0) {
      model.value = pollinationsModels.value[0].value
    }
  }
})

const checkGuide = () => {
  const seen = localStorage.getItem('chat-guide-seen')

  if (!seen) {
    showGuide.value = true
    guidePage.value = 1
  }
}

const closeGuide = () => {
  showGuide.value = false
  guidePage.value = 1
  localStorage.setItem('chat-guide-seen', 'true')
}

const initializeSettings = async () => {
  isRestoring.value = true

  // Load simple settings
  const savedMode = localStorage.getItem('nikke_mode')
  if (savedMode && (savedMode === 'roleplay' || savedMode === 'story' || savedMode === 'game')) mode.value = savedMode

  const savedPlayback = localStorage.getItem('nikke_playback_mode')
  if (savedPlayback && (savedPlayback === 'auto' || savedPlayback === 'manual')) playbackMode.value = savedPlayback

  const savedYap = localStorage.getItem('nikke_yap_enabled')
  if (savedYap !== null) market.live2d.yapEnabled = savedYap === 'true'

  const savedHQAssets = localStorage.getItem('nikke_hq_assets')
  if (savedHQAssets !== null) {
    market.live2d.HQassets = savedHQAssets === 'true'
  } else {
    market.live2d.HQassets = false
  }

  const savedTts = localStorage.getItem('nikke_tts_enabled')
  if (savedTts !== null) ttsEnabled.value = savedTts === 'true'

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

  const savedTokenUsage = localStorage.getItem('nikke_token_usage')
  if (savedTokenUsage && tokenUsageOptions.some((t) => t.value === savedTokenUsage)) tokenUsage.value = savedTokenUsage

  const savedContextCaching = localStorage.getItem('nikke_enable_context_caching')
  if (savedContextCaching !== null) enableContextCaching.value = savedContextCaching === 'true'

  const savedAnimationReplay = localStorage.getItem('nikke_enable_animation_replay')
  enableAnimationReplay.value = savedAnimationReplay !== 'false'

  // Load Provider and Model
  const savedProvider = localStorage.getItem('nikke_api_provider')
  const savedModel = localStorage.getItem('nikke_model')

  if (savedProvider && providerOptions.some((p) => p.value === savedProvider)) {
    apiProvider.value = savedProvider

    if (savedProvider === 'openrouter') {
      openRouterModels.value = await fetchOpenRouterModels()
    } else if (savedProvider === 'pollinations') {
      pollinationsModels.value = await fetchPollinationsModels(apiKey.value)
    }

    // Validate and set model
    let validModels: string[] = []

    if (savedProvider === 'gemini') {
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
      if (savedProvider === 'gemini') model.value = 'gemini-2.5-flash'
      else if (savedProvider === 'openrouter' && openRouterModels.value.length > 0) model.value = openRouterModels.value[0].value

      if (savedModel) {
        console.warn(`Saved model '${savedModel}' is invalid or unavailable. Using default.`)
      }
    }
  }

  // Ensure models are loaded for the current provider
  if (apiProvider.value === 'openrouter' && openRouterModels.value.length === 0) {
    openRouterModels.value = await fetchOpenRouterModels()
    if (openRouterModels.value.length > 0 && !model.value) {
      model.value = openRouterModels.value[0].value
    }
  } else if (apiProvider.value === 'pollinations' && pollinationsModels.value.length === 0) {
    pollinationsModels.value = await fetchPollinationsModels(apiKey.value)
    if (pollinationsModels.value.length > 0 && !model.value) {
      model.value = pollinationsModels.value[0].value
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

const initChatLayout = () => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (viewportWidth <= 768) {
    // Mobile default: Bottom sheet style
    const width = Math.min(viewportWidth - 20, 400)
    const height = viewportHeight * 0.5
    chatSize.value = { width, height }
    chatPosition.value = {
      x: (viewportWidth - width) / 2,
      y: viewportHeight - height - 20
    }
  } else {
    // Desktop default
    chatSize.value = { width: 400, height: 600 }
    chatPosition.value = { x: 300, y: viewportHeight - 620 }
  }
}

// Dragging Logic
const startDrag = (e: MouseEvent | TouchEvent) => {
  // Only allow dragging from the handle
  if ((e.target as HTMLElement).closest('.window-controls') || (e.target as HTMLElement).closest('.n-button')) return

  // Prevent default to avoid text selection which can interfere with mouseup events
  if (e instanceof MouseEvent) {
    e.preventDefault()
  }

  isDragging.value = true
  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

  dragOffset.value = {
    x: clientX - chatPosition.value.x,
    y: clientY - chatPosition.value.y
  }

  window.addEventListener('mousemove', onDrag)
  window.addEventListener('touchmove', onDrag, { passive: false })
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('touchend', stopDrag)
}

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return

  // Safety check: if mouse button is not pressed, stop dragging
  if (e instanceof MouseEvent && e.buttons === 0) {
    stopDrag()
    return
  }

  e.preventDefault()

  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

  let newX = clientX - dragOffset.value.x
  let newY = clientY - dragOffset.value.y

  // Boundaries
  const maxX = window.innerWidth - 50 // Keep at least 50px visible
  const maxY = window.innerHeight - 50

  newX = Math.max(-chatSize.value.width + 50, Math.min(newX, maxX))
  newY = Math.max(0, Math.min(newY, maxY))

  chatPosition.value = { x: newX, y: newY }
}

const stopDrag = () => {
  isDragging.value = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('touchend', stopDrag)
}

// Resizing Logic
const startResize = (e: MouseEvent | TouchEvent, direction: string) => {
  e.stopPropagation()
  e.preventDefault()
  isResizing.value = true
  resizeDirection.value = direction

  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

  resizeStart.value = {
    x: clientX,
    y: clientY,
    width: chatSize.value.width,
    height: chatSize.value.height,
    initialX: chatPosition.value.x,
    initialY: chatPosition.value.y
  }

  window.addEventListener('mousemove', onResize)
  window.addEventListener('touchmove', onResize, { passive: false })
  window.addEventListener('mouseup', stopResize)
  window.addEventListener('touchend', stopResize)
}

const onResize = (e: MouseEvent | TouchEvent) => {
  if (!isResizing.value) return

  if (e instanceof MouseEvent && e.buttons === 0) {
    stopResize()
    return
  }

  e.preventDefault()

  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY

  const deltaX = clientX - resizeStart.value.x
  const deltaY = clientY - resizeStart.value.y

  let newWidth = resizeStart.value.width
  let newHeight = resizeStart.value.height
  let newX = resizeStart.value.initialX
  let newY = resizeStart.value.initialY

  const dir = resizeDirection.value

  // Horizontal
  if (dir.includes('e')) {
    newWidth += deltaX
  } else if (dir.includes('w')) {
    newWidth -= deltaX
    newX += deltaX
  }

  // Vertical
  if (dir.includes('s')) {
    newHeight += deltaY
  } else if (dir.includes('n')) {
    newHeight -= deltaY
    newY += deltaY
  }

  // Min dimensions
  const minWidth = 300
  const minHeight = 200

  if (newWidth < minWidth) {
    if (dir.includes('w')) newX = resizeStart.value.initialX + (resizeStart.value.width - minWidth)
    newWidth = minWidth
  }

  if (newHeight < minHeight) {
    if (dir.includes('n')) newY = resizeStart.value.initialY + (resizeStart.value.height - minHeight)
    newHeight = minHeight
  }

  chatSize.value = { width: newWidth, height: newHeight }
  chatPosition.value = { x: newX, y: newY }
}

const stopResize = () => {
  isResizing.value = false
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('touchmove', onResize)
  window.removeEventListener('mouseup', stopResize)
  window.removeEventListener('touchend', stopResize)
}

let originalViewportMetaContent: string | null = null
let viewportMetaWasModified = false

let originalBodyStyle: Partial<CSSStyleDeclaration> | null = null
let originalHtmlOverflow: string | null = null
let scrollLockY = 0

const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches

const restoreViewportZoom = () => {
  if (typeof document === 'undefined') return
  if (!viewportMetaWasModified) return

  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) return

  if (originalViewportMetaContent !== null) {
    meta.setAttribute('content', originalViewportMetaContent)
  }

  viewportMetaWasModified = false
}

const preventMobileZoomOnThisView = () => {
  if (typeof document === 'undefined') return
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) return

  if (originalViewportMetaContent === null) {
    originalViewportMetaContent = meta.getAttribute('content') || ''
  }

  if (!isMobileViewport()) return

  // Prevent browser page zoom so Spine's custom pinch-zoom can work reliably.
  meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
  viewportMetaWasModified = true
}

const lockMobilePageScroll = () => {
  if (typeof document === 'undefined') return
  if (!isMobileViewport()) return

  const html = document.documentElement
  const body = document.body
  if (!body) return

  scrollLockY = window.scrollY || window.pageYOffset || 0

  if (originalBodyStyle === null) {
    originalBodyStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: (body.style as any).overscrollBehavior
    }
  }
  if (originalHtmlOverflow === null) {
    originalHtmlOverflow = html.style.overflow
  }

  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  ;(body.style as any).overscrollBehavior = 'none'
  body.style.position = 'fixed'
  body.style.top = `-${scrollLockY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
}

const unlockMobilePageScroll = () => {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const body = document.body
  if (!body) return

  if (originalHtmlOverflow !== null) {
    html.style.overflow = originalHtmlOverflow
    originalHtmlOverflow = null
  }

  if (originalBodyStyle) {
    body.style.position = originalBodyStyle.position || ''
    body.style.top = originalBodyStyle.top || ''
    body.style.left = originalBodyStyle.left || ''
    body.style.right = originalBodyStyle.right || ''
    body.style.width = originalBodyStyle.width || ''
    body.style.overflow = originalBodyStyle.overflow || ''
    ;(body.style as any).overscrollBehavior = (originalBodyStyle as any).overscrollBehavior || ''
    originalBodyStyle = null
  }

  if (scrollLockY) {
    window.scrollTo(0, scrollLockY)
  }
  scrollLockY = 0
}

onMounted(() => {
  originalHQAssets.value = market.live2d.HQassets
  checkGuide()
  initializeSettings()
  initChatLayout()
  window.addEventListener('beforeunload', handleBeforeUnload)

  preventMobileZoomOnThisView()
  lockMobilePageScroll()

  // Global "tap anywhere" for NIKKE overlay (but keep spine interactions intact)
  document.addEventListener('touchstart', onNikkeGlobalStart as any, { passive: true })
  document.addEventListener('touchmove', onNikkeGlobalMove as any, { passive: true })
  document.addEventListener('touchend', onNikkeGlobalEnd as any, { passive: true })
  document.addEventListener('mousedown', onNikkeGlobalStart as any)
  document.addEventListener('mousemove', onNikkeGlobalMove as any)
  document.addEventListener('mouseup', onNikkeGlobalEnd as any)

  window.addEventListener('resize', () => {
    // Ensure window stays in bounds on resize
    const { innerWidth, innerHeight } = window
    if (chatPosition.value.x + chatSize.value.width > innerWidth) {
      chatPosition.value.x = Math.max(0, innerWidth - chatSize.value.width)
    }
    if (chatPosition.value.y + chatSize.value.height > innerHeight) {
      chatPosition.value.y = Math.max(0, innerHeight - chatSize.value.height)
    }
  })
})

onUnmounted(() => {
  market.live2d.HQassets = originalHQAssets.value
  window.removeEventListener('beforeunload', handleBeforeUnload)
  unlockMobilePageScroll()
  restoreViewportZoom()

  document.removeEventListener('touchstart', onNikkeGlobalStart as any)
  document.removeEventListener('touchmove', onNikkeGlobalMove as any)
  document.removeEventListener('touchend', onNikkeGlobalEnd as any)
  document.removeEventListener('mousedown', onNikkeGlobalStart as any)
  document.removeEventListener('mousemove', onNikkeGlobalMove as any)
  document.removeEventListener('mouseup', onNikkeGlobalEnd as any)
})

onBeforeRouteLeave(() => {
  if (chatHistory.value.length > 0) {
    const confirmed = window.confirm('Are you sure you want to leave? All unsaved progress will be lost.')
    if (!confirmed) {
      return false
    }
  }
})

// Methods
const resetCharacterPlacement = () => {
  market.live2d.triggerResetPlacement()
}

const deleteLastMessage = () => {
  if (chatHistory.value.length > 0) {
    chatHistory.value.pop()
  }
}

const saveSession = () => {
  // Filter chat history based on animation replay setting
  const exportedChatHistory = chatHistory.value.map((msg) => {
    if (!enableAnimationReplay.value) {
      // Old format: just role and content
      return { role: msg.role, content: msg.content }
    } else {
      // New format: remove content if text is present to save space
      if (msg.role === 'assistant' && msg.text) {
        const rest = { ...msg }
        delete (rest as any).content
        return rest
      }
      return msg
    }
  })

  const sessionData = {
    chatHistory: exportedChatHistory,
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
      allowWebSearchFallback: allowWebSearchFallback.value,
      reasoningEffort: reasoningEffort.value
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
          chatHistory.value = data.chatHistory.map((msg: any) => {
            if (!msg.content && msg.text) {
              // Reconstruct content
              let reconstructedContent = msg.text
              if (msg.speaking && msg.character && msg.character !== 'none') {
                const name = getCharacterName(msg.character)
                if (name) {
                  // Check if the text already starts with the name to avoid duplication
                  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                  const namePattern = new RegExp(`^\\**${escapedName}\\**\\s*:`, 'i')
                  const anyNamePattern = /^\*\*\s*[^*]+\s*\*\*:/

                  if (!namePattern.test(reconstructedContent) && !anyNamePattern.test(reconstructedContent)) {
                    reconstructedContent = `**${name}:** ${reconstructedContent}`
                  }
                }
              }
              return { ...msg, content: reconstructedContent }
            }
            return msg
          })
          selectedMessageIndex.value = null
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
          if (data.settings.playbackMode && (data.settings.playbackMode === 'auto' || data.settings.playbackMode === 'manual')) {
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

          if (data.settings.reasoningEffort) {
            reasoningEffort.value = data.settings.reasoningEffort
          }

          // Restore Provider and Model
          const savedProvider = data.settings.apiProvider
          const savedModel = data.settings.model

          if (savedProvider && providerOptions.some((p) => p.value === savedProvider)) {
            apiProvider.value = savedProvider

            if (savedProvider === 'openrouter') {
              openRouterModels.value = await fetchOpenRouterModels()
            }

            // Validate and set model
            let validModels: string[] = []

            if (savedProvider === 'gemini') {
              validModels = ['gemini-2.5-flash', 'gemini-2.5-pro']
            } else if (savedProvider === 'openrouter') {
              validModels = openRouterModels.value.map((m) => m.value)
            }

            if (savedModel && validModels.includes(savedModel)) {
              model.value = savedModel
            } else {
              // Fallback to default if saved model is invalid
              if (savedProvider === 'gemini') model.value = 'gemini-2.5-flash'
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
            console.log(`[Restore] Adjusted lastSummarizedIndex to ${lastSummarizedIndex.value} to ensure context buffer`)
          }
        }

        isRestoring.value = false

        // Mark this as a loaded session so overflow detection can handle large unsummarized portions
        isLoadedSession.value = true

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

// If a Game Mode choice was selected during playback, queue and send it once the
// current request finishes. This must be called from any function that drives
// an AI turn (sendMessage/continueStory/retryLastMessage), otherwise the choice
// can appear to do nothing.
const flushPendingGameChoice = () => {
  if (!pendingGameChoiceText.value) return

  const attemptFlush = () => {
    const next = pendingGameChoiceText.value
    if (!next) return

    if (isLoading.value) {
      setTimeout(attemptFlush, 50)
      return
    }

    abortCurrentPlaybackForChoice.value = false
    userInput.value = next
    pendingGameChoiceText.value = null

    void sendMessage()
  }

  setTimeout(attemptFlush, 0)
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
    if (!invalidJsonPersist.value) {
      invalidJsonToggle.value = false
    }
    if (!incorrectAnimationsPersist.value) {
      incorrectAnimationsToggle.value = false
    }
    honorificsToggle.value = false
    narrationAndDialogueNotSplitToggle.value = false
    aiControllingUserToggle.value = false
    wrongSpeechStylesToggle.value = false
  }

  isLoading.value = false
  scrollToBottom()

  flushPendingGameChoice()
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
    if (!invalidJsonPersist.value) {
      invalidJsonToggle.value = false
    }
    if (!incorrectAnimationsPersist.value) {
      incorrectAnimationsToggle.value = false
    }
    honorificsToggle.value = false
    narrationAndDialogueNotSplitToggle.value = false
    aiControllingUserToggle.value = false
    wrongSpeechStylesToggle.value = false
  }

  isLoading.value = false
  scrollToBottom()

  flushPendingGameChoice()
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
  nikkeOverlayVisible.value = false
  selectedMessageIndex.value = null

  if (isTyping.value) {
    stopTypewriter()
  }

  // If we are waiting for user input (Manual mode), cancel that wait so the loop can exit
  if (nextActionResolver) {
    nextActionResolver()
    nextActionResolver = null
    waitingForNext.value = false
  }
}

const nextAction = () => {
  // Never allow advancing while game choices are pending/visible.
  if (gameChoices.value.length > 0 || choicesAwaitingReveal.value) {
    return
  }
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

  const text = mode.value === 'story' ? prompts.continue.story : prompts.continue.roleplay
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
    if (!invalidJsonPersist.value) {
      invalidJsonToggle.value = false
    }
    if (!incorrectAnimationsPersist.value) {
      incorrectAnimationsToggle.value = false
    }
    honorificsToggle.value = false
    narrationAndDialogueNotSplitToggle.value = false
    aiControllingUserToggle.value = false
    wrongSpeechStylesToggle.value = false
  }

  isLoading.value = false
  scrollToBottom()

  flushPendingGameChoice()
}

// Helper to get user-toggled reminders string
const getUserReminders = (): string => {
  let reminders = ''

  if (invalidJsonToggle.value) {
    reminders += '\n\n' + prompts.reminders.invalidJsonReminder
    if (!invalidJsonPersist.value) invalidJsonToggle.value = false
  }
  if (honorificsToggle.value) {
    reminders += '\n\n' + prompts.reminders.honorificsReminder
    honorificsToggle.value = false // No persist for honorifics
  }
  if (narrationAndDialogueNotSplitToggle.value) {
    reminders += '\n\n' + prompts.reminders.narrationAndDialogueNotSplit
    narrationAndDialogueNotSplitToggle.value = false // No persist
  }
  if (aiControllingUserToggle.value) {
    reminders += '\n\n' + prompts.reminders.aiControllingUserReminder
    aiControllingUserToggle.value = false // No persist
  }
  if (wrongSpeechStylesToggle.value) {
    reminders += '\n\n' + prompts.reminders.wrongSpeechStylesReminder
    wrongSpeechStylesToggle.value = false // No persist
  }
  if (incorrectAnimationsToggle.value) {
    reminders += '\n\n' + prompts.reminders.incorrectAnimationsReminder
    if (!incorrectAnimationsPersist.value) incorrectAnimationsToggle.value = false
  }

  return reminders
}

const getFormattedAnimationsForContext = () => {
  const placeholderAnimations = ['angry', 'angry_02', 'angry_03', 'cry', 'delight', 'idle', 'pain', 'sad', 'sad_02', 'shy', 'smile', 'surprise', 'void']

  const getCharacterInfo = (id: string) => {
    const charData = (l2d as any[]).find((c) => c.id === id)
    return {
      name: charData?.name || id,
      id: id
    }
  }

  const getCachedAnimations = (id: string): string[] | null => {
    let anims = animationCache.value[id]
    if (!anims && id === market.live2d.current_id) {
      anims = market.live2d.animations
    }
    if (anims && anims.length > 0) {
      return getFilteredAnimations(anims)
    }
    return null
  }

  const formatAnimationsForCharacter = (info: { name: string; id: string }, animations: string[]): string => {
    return `Animations for ${info.name} (${info.id}): ${JSON.stringify(animations)}`
  }

  const formatPlaceholderForCharacter = (info: { name: string; id: string }): string => {
    return `Animations for ${info.name} (${info.id}): ${JSON.stringify(placeholderAnimations)}`
  }

  const allCharacterIds = new Set<string>()

  for (const profileKey of Object.keys(characterProfiles.value)) {
    if (profileKey.toLowerCase() !== 'commander') {
      const profile = characterProfiles.value[profileKey]
      const id = profile.id || profileKey
      allCharacterIds.add(id)
    }
  }

  if (market.live2d.current_id) {
    allCharacterIds.add(market.live2d.current_id)
  }

  const animsList = Array.from(allCharacterIds).map((id) => {
    const cached = getCachedAnimations(id)
    const info = getCharacterInfo(id)
    if (cached) {
      logDebug(`[AnimationContext] Using cached animations for ${id} (${info.name}): ${cached.length} animations`)
      return formatAnimationsForCharacter(info, cached)
    }
    logDebug(`[AnimationContext] No cached animations for ${id} (${info.name}), using placeholder array`)
    return formatPlaceholderForCharacter(info)
  })

  if (animsList.length === 0) return 'No characters available yet.'
  return animsList.join('\n')
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
    const foundNames = localNames.filter((name) => isWholeWordPresent(firstPrompt, name))

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
  let contextMsg = `Current Character: ${market.live2d.current_id}.\n\nAvailable Animations:\n${getFormattedAnimationsForContext()}`

  // Optimization: Limit history to prevent token overflow
  // Tumbling window: Summarize every X turns

  let historyLimit = 30

  if (tokenUsage.value === 'low') historyLimit = 10
  else if (tokenUsage.value === 'medium') historyLimit = 30
  else if (tokenUsage.value === 'high') historyLimit = 60
  else if (tokenUsage.value === 'goddess') historyLimit = 99999 // Effectively infinite

  if (tokenUsage.value !== 'goddess') {
    const endIndex = chatHistory.value.length - 1
    const unsummarizedCount = endIndex - lastSummarizedIndex.value

    // Calculate the maximum messages we want in context (user + assistant)
    // historyLimit is the number of user turns, so double it for total messages
    const maxContextMessages = historyLimit * 2

    // Check if we need to summarize due to having too many unsummarized messages
    // This ONLY applies to loaded sessions to handle large unsummarized portions from restored files
    // For normal sessions, we rely solely on userMsgCount to trigger summarization
    const overflowThreshold = Math.floor(maxContextMessages * 1.5)
    const shouldSummarizeDueToOverflow = isLoadedSession.value && unsummarizedCount > overflowThreshold

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
    // Also trigger if we have overflow from a loaded session.
    if (shouldRetryFailedSummarization || shouldSummarizeByLimit || shouldSummarizeDueToOverflow) {
      // Calculate where to summarize up to
      // For overflow case (without hitting userMsgCount limit), we want to keep maxContextMessages at the end
      let summarizeUpTo = endIndex
      if (shouldSummarizeDueToOverflow && !shouldSummarizeByLimit && !shouldRetryFailedSummarization) {
        // Only summarize the overflow, keeping maxContextMessages in context
        summarizeUpTo = endIndex - maxContextMessages
      }

      const chunkToSummarize = chatHistory.value.slice(lastSummarizedIndex.value, summarizeUpTo)
      logDebug(`[callAI] Summarizing ${chunkToSummarize.length} messages (Tumbling Window, overflow: ${shouldSummarizeDueToOverflow})...`)
      const ok = await summarizeChunk(chunkToSummarize)
      setRandomLoadingMessage()

      if (ok) {
        lastSummarizedIndex.value = summarizeUpTo
        summarizationRetryPending.value = false
        summarizationAttemptCount.value = 0
        // Clear the loaded session flag after successful summarization
        if (shouldSummarizeDueToOverflow) {
          isLoadedSession.value = false
        }
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
      const honorific = getHonorific(name)

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

  // Get user toggled reminders
  const reminders = getUserReminders()

  if (apiProvider.value === 'gemini') {
    // Gemini: Merge context into system prompt to avoid confusion at the end of history
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}${reminders}`
    let messages = [{ role: 'system', content: fullSystemPrompt }, ...historyToSend.map((m) => ({ role: m.role, content: m.content }))]

    // Inject honorifics reminder for first turn (not saved to history)
    messages = injectHonorificsReminder(messages)

    logDebug('Sending to Gemini:', messages)
    response = await callGemini(messages, enableWebSearch)
  } else if (apiProvider.value === 'openrouter') {
    // OpenRouter: Use standard OpenAI format with context in system prompt
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}${reminders}`

    let messages = [{ role: 'system', content: fullSystemPrompt }, ...historyToSend.map((m) => ({ role: m.role, content: m.content }))]
    // Inject honorifics reminder for first turn (not saved to history)
    messages = injectHonorificsReminder(messages)

    logDebug('Sending to OpenRouter:', messages)
    response = await callOpenRouter(messages, undefined, enableWebSearch)
  } else if (apiProvider.value === 'pollinations') {
    // Pollinations: Use standard OpenAI format with context in system prompt
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}${reminders}`

    let messages = [{ role: 'system', content: fullSystemPrompt }, ...historyToSend.map((m) => ({ role: m.role, content: m.content }))]
    // Inject honorifics reminder for first turn (not saved to history)
    messages = injectHonorificsReminder(messages)

    logDebug('Sending to Pollinations:', messages)
    response = await callPollinations(messages, enableWebSearch)
  } else if (apiProvider.value === 'local') {
    // Local: Use standard OpenAI format with context in system prompt
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}${reminders}`

    let messages = [{ role: 'system', content: fullSystemPrompt }, ...historyToSend.map((m) => ({ role: m.role, content: m.content }))]
    // Inject honorifics reminder for first turn (not saved to history)
    messages = injectHonorificsReminder(messages)

    logDebug('Sending to Local:', messages)
    response = await callLocal(messages)
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

  let contextMsg = `Current Character: ${market.live2d.current_id}.\n\nAvailable Animations:\n${getFormattedAnimationsForContext()}`

  // Get user toggled reminders
  const reminders = getUserReminders()

  // Optimization: Limit history to prevent token overflow
  // Tumbling window: Summarize every X turns

  let historyLimit = 30

  if (tokenUsage.value === 'low') historyLimit = 10
  else if (tokenUsage.value === 'medium') historyLimit = 30
  else if (tokenUsage.value === 'high') historyLimit = 60
  else if (tokenUsage.value === 'goddess') historyLimit = 99999 // Effectively infinite

  if (tokenUsage.value !== 'goddess') {
    const endIndex = chatHistory.value.length - 1
    const unsummarizedCount = endIndex - lastSummarizedIndex.value

    // Calculate the maximum messages we want in context (user + assistant)
    // historyLimit is the number of user turns, so double it for total messages
    const maxContextMessages = historyLimit * 2

    // Check if we need to summarize due to having too many unsummarized messages
    // This ONLY applies to loaded sessions to handle large unsummarized portions from restored files
    // For normal sessions, we rely solely on userMsgCount to trigger summarization
    const overflowThreshold = Math.floor(maxContextMessages * 1.5)
    const shouldSummarizeDueToOverflow = isLoadedSession.value && unsummarizedCount > overflowThreshold

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
    // Also trigger if we have overflow from a loaded session.
    if (shouldRetryFailedSummarization || shouldSummarizeByLimit || shouldSummarizeDueToOverflow) {
      // Calculate where to summarize up to
      // For overflow case (without hitting userMsgCount limit), we want to keep maxContextMessages at the end
      let summarizeUpTo = endIndex
      if (shouldSummarizeDueToOverflow && !shouldSummarizeByLimit && !shouldRetryFailedSummarization) {
        // Only summarize the overflow, keeping maxContextMessages in context
        summarizeUpTo = endIndex - maxContextMessages
      }

      const chunkToSummarize = chatHistory.value.slice(lastSummarizedIndex.value, summarizeUpTo)
      logDebug(`[callAIWithoutSearch] Summarizing ${chunkToSummarize.length} messages (Tumbling Window, overflow: ${shouldSummarizeDueToOverflow})...`)
      const ok = await summarizeChunk(chunkToSummarize)
      setRandomLoadingMessage()

      if (ok) {
        lastSummarizedIndex.value = summarizeUpTo
        summarizationRetryPending.value = false
        summarizationAttemptCount.value = 0
        // Clear the loaded session flag after successful summarization
        if (shouldSummarizeDueToOverflow) {
          isLoadedSession.value = false
        }
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

  if (apiProvider.value === 'gemini') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}${reminders}`
    const messages = [{ role: 'system', content: fullSystemPrompt }, ...historyToSend.map((m) => ({ role: m.role, content: m.content }))]
    return await callGemini(messages, false)
  } else if (apiProvider.value === 'openrouter') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}${reminders}`
    const messages = [{ role: 'system', content: fullSystemPrompt }, ...historyToSend.map((m) => ({ role: m.role, content: m.content }))]
    return await callOpenRouter(messages, undefined, false)
  } else if (apiProvider.value === 'pollinations') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}${reminders}`
    const messages = [{ role: 'system', content: fullSystemPrompt }, ...historyToSend.map((m) => ({ role: m.role, content: m.content }))]
    return await callPollinations(messages, false)
  } else if (apiProvider.value === 'local') {
    const fullSystemPrompt = `${systemPrompt}\n\n${contextMsg}${retryInstruction}${reminders}`
    const messages = [{ role: 'system', content: fullSystemPrompt }, ...historyToSend.map((m) => ({ role: m.role, content: m.content }))]
    return await callLocal(messages)
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
      const names = Array.from(m[1].matchAll(/"([^"]+)"/g)).map((x) => x[1])
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
const wrappedSearchForCharactersWithNativeSearch = async (characterNames: string[]) => {
  return searchForCharactersWithNativeSearch(characterNames, characterProfiles.value, apiProvider.value, callGemini, callOpenRouter, callPollinations)
}

const wrappedSearchForCharactersViaWikiFetch = async (characterNames: string[]) => {
  return searchForCharactersViaWikiFetch(characterNames, characterProfiles.value, apiProvider.value, callGemini, callOpenRouter, callPollinations)
}

const wrappedSearchForCharacters = async (characterNames: string[]) => {
  return searchForCharacters(characterNames, characterProfiles.value, useLocalProfiles.value, allowWebSearchFallback.value, apiProvider.value, model.value, loadingStatus, setRandomLoadingMessage, wrappedSearchForCharactersWithNativeSearch, wrappedSearchForCharactersViaWikiFetch)
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
    relevantHonorifics[name] = getHonorific(name)
  }

  let modeInstructions = ''
  if (mode.value === 'game') {
    modeInstructions = prompts.systemPrompt.instructions.game
  } else if (mode.value === 'story') {
    modeInstructions = prompts.systemPrompt.instructions.story
  } else {
    modeInstructions = prompts.systemPrompt.instructions.roleplay
  }

  let prompt = `${prompts.systemPrompt.intro}

  ${mode.value === 'roleplay' ? prompts.systemPrompt.modes.roleplay : mode.value === 'game' ? prompts.systemPrompt.modes.game : prompts.systemPrompt.modes.story}

  ${prompts.systemPrompt.honorifics.header}
  ${Object.keys(relevantHonorifics).length > 0 ? JSON.stringify(relevantHonorifics, null, 2) : '(No characters loaded yet - honorifics will be provided once characters appear)'}

  ${prompts.systemPrompt.honorifics.rules}

  ${enableWebSearch ? prompts.systemPrompt.characterResearch.enabled : prompts.systemPrompt.characterResearch.disabled}

  ${prompts.systemPrompt.criticalErrors}

  ${mode.value === 'game' ? (prompts.systemPrompt as any).jsonStructureGame : (prompts.systemPrompt as any).jsonStructureBase}

  ${prompts.systemPrompt.knownProfiles}
  ${knownCharacterNames.length > 0 ? JSON.stringify(effectiveCharacterProfiles.value, null, 2) : prompts.systemPrompt.noProfilesMessage}

  ${prompts.systemPrompt.idReference}
  ${relevantCharacterIds.length > 0 ? relevantCharacterIds.join(', ') : prompts.systemPrompt.noIdsMessage}

  ${prompts.systemPrompt.instructions.base}
  ${modeInstructions}
  ${prompts.systemPrompt.instructions.closing}
  ${godModeEnabled.value ? prompts.systemPrompt.godMode : ''}
  `

  return prompt
}

const callOpenRouter = async (messages: any[], searchUrl?: string, enableWebSearch: boolean = false) => {
  return await callOpenRouterImpl(messages, {
    model: model.value,
    apiKey: apiKey.value,
    enableContextCaching: enableContextCaching.value,
    useLocalProfiles: useLocalProfiles.value,
    allowWebSearchFallback: allowWebSearchFallback.value,
    modeIsGame: mode.value === 'game',
    enableWebSearch,
    searchUrl,
    prompts,
    reasoningEffort: reasoningEffort.value
  })
}

const callGemini = async (messages: any[], enableWebSearch: boolean = false) => {
  return await callGeminiImpl(messages, {
    model: model.value,
    apiKey: apiKey.value,
    useLocalProfiles: useLocalProfiles.value,
    allowWebSearchFallback: allowWebSearchFallback.value,
    enableWebSearch,
    reasoningEffort: reasoningEffort.value
  })
}

const callPollinations = async (messages: any[], enableWebSearch: boolean = false) => {
  return await callPollinationsImpl(messages, {
    model: model.value,
    apiKey: apiKey.value,
    useLocalProfiles: useLocalProfiles.value,
    allowWebSearchFallback: allowWebSearchFallback.value,
    modeIsGame: mode.value === 'game',
    enableWebSearch,
    reasoningEffort: reasoningEffort.value,
    enableContextCaching: enableContextCaching.value
  })
}

const callLocal = async (messages: any[]) => {
  return await callLocalImpl(messages, {
    maxTokens: localMaxTokens.value,
    apiKey: apiKey.value,
    localUrl: localUrl.value,
    modeIsGame: mode.value === 'game'
  })
}

const handleGameChoice = (choice: any) => {
  // IMPORTANT: Do NOT call sendMessage() here.
  // sendMessage() is already running (it plays actions while isLoading is true).
  // Calling it again causes concurrent requests and breaks the existing loading spinner.
  const choiceTextToSend = formatChoiceAsUserTurn(choice)

  pendingGameChoiceText.value = choiceTextToSend
  abortCurrentPlaybackForChoice.value = true

  pendingGameChoices.value = []
  choicesAwaitingReveal.value = false

  // Hide overlay immediately so the existing chatbox loading UI can show.
  nikkeOverlayVisible.value = false

  // Resume execution
  if (nextActionResolver) {
    nextActionResolver()
    nextActionResolver = null
    waitingForNext.value = false
  }

  // Clear choices
  gameChoices.value = []
}

const replayMessage = async (msg: any, index: number) => {
  await replayMessageUtil(msg, index, {
    enableAnimationReplay: enableAnimationReplay.value,
    selectedMessageIndex,
    chatMode: chatMode.value,
    nikkeOverlayVisible,
    market,
    ttsEnabled: ttsEnabled.value,
    isTyping,
    nikkeCurrentText,
    nikkeCurrentSpeaker,
    nikkeSpeakerColor,
    effectiveCharacterProfiles: effectiveCharacterProfiles.value,
    getCharacterName,
    startTypewriter,
    stopTypewriter,
    manageYap: (duration: number) => {
      if (yapTimeoutId) clearTimeout(yapTimeoutId)
      market.live2d.isYapping = true
      yapTimeoutId = setTimeout(() => {
        if (market.live2d.isYapping) market.live2d.isYapping = false
        yapTimeoutId = null
      }, duration)
    }
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

      // Enrich fallback-parsed actions with animations (fallback parsing usually assigns idle).
      // Keep any existing non-idle animations if present.
      try {
        data = await enrichActionsWithAnimations(data, {
          apiProvider: apiProvider.value,
          apiKey: apiKey.value,
          model: apiProvider.value === 'local' ? undefined : model.value,
          maxTokens: localMaxTokens.value,
          currentCharacterId: market.live2d.current_id,
          filteredAnimations: getFilteredAnimations(market.live2d.animations),
          animationEnrichmentPrompt: prompts.animationEnrichment,
          preserveExistingAnimations: true,
          localUrl: localUrl.value,
          rawResponseText: responseStr,
          characterAnimations: animationCache.value
        })
      } catch (e) {
        console.warn('[processAIResponse] Animation enrichment (fallback) failed; using existing animations', e)
      }

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

  data = filterEchoedUserChoiceDialogueInGameMode(data, lastPrompt.value, mode.value === 'game')
  data = stripChoicesWhenNotGameMode(data, mode.value === 'game')

  // Truncate extremely long sequences that look like hallucinations
  if (data.length > 15 && mode.value !== 'story') {
    logDebug('[processAIResponse] Sequence too long, likely hallucination. Truncating.')
    data = data.slice(0, 15)
  } else if (data.length > 50 && mode.value === 'story') {
    logDebug('[processAIResponse] Sequence too long, likely hallucination. Truncating.')
    data = data.slice(0, 50)
  }

  // Fallback for Game Mode: If no choices were provided, add a default "Continue" choice
  // to prevent the user from getting stuck.
  if (mode.value === 'game') {
    const before = data
    data = ensureGameModeChoicesFallback(data, true)
    if (before !== data) {
      // no-op, helper mutated
    }
  }

  logDebug('Sanitized Action Sequence:', data)

  isGenerating.value = false
  loadingStatus.value = '...'

  if (chatMode.value === 'nikke') {
    nikkeOverlayVisible.value = true
  }

  for (const action of data) {
    if (isStopped.value) {
      logDebug('Execution stopped by user.')
      break
    }
    if (abortCurrentPlaybackForChoice.value) {
      logDebug('[processAIResponse] Aborting playback due to game choice selection.')
      break
    }
    await executeAction(action)
    if (abortCurrentPlaybackForChoice.value) {
      logDebug('[processAIResponse] Playback aborted after executing action (game choice selected).')
      break
    }
  }

  nikkeOverlayVisible.value = false
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
      const existingKey = Object.keys(characterProfiles.value).find((k) => k.toLowerCase() === charName.toLowerCase())

      if (existingKey) {
        logDebug(`[AI Memory] Skipping existing character '${charName}' (matched '${existingKey}') in memory block. Use characterProgression to update.`)
        continue
      }

      // 2. Check if in LOCAL profiles (if enabled) - ENFORCE READ-ONLY FROM DB
      if (useLocalProfiles.value) {
        const localKey = Object.keys(localCharacterProfiles).find((k) => k.toLowerCase() === charName.toLowerCase())
        if (localKey) {
          logDebug(`[AI Memory] Found local profile for '${charName}' (matched '${localKey}'). IGNORING AI memory and loading local profile instead.`)

          const localProfile = (localCharacterProfiles as any)[localKey]
          // Add the LOCAL profile to newProfiles, effectively overwriting the AI's suggestion with the correct data
          newProfiles[charName] = {
            ...localProfile,
            id: localProfile.id || l2d.find((c) => c.name.toLowerCase() === charName.toLowerCase())?.id
          }
          continue
        }
      }

      if (typeof profile === 'object' && profile !== null) {
        const cleanedProfile = { ...(profile as any) }
        delete (cleanedProfile as any).honorific_for_commander
        delete (cleanedProfile as any).honorific_to_commander
        delete (cleanedProfile as any).honorific

        // Filter Commander out of relationships if present
        if (cleanedProfile.relationships && typeof cleanedProfile.relationships === 'object') {
          const relationships = { ...cleanedProfile.relationships }
          delete (relationships as any).Commander
          delete (relationships as any).commander
          cleanedProfile.relationships = Object.keys(relationships).length > 0 ? relationships : undefined
        }

        newProfiles[charName] = cleanedProfile
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
      const targetKey = Object.keys(characterProfiles.value).find((k) => k.toLowerCase() === charName.toLowerCase())
      const resolvedKey = targetKey || charName

      if (typeof progression === 'object' && progression !== null) {
        const updates = progression as any
        const current = (updatedProgression as any)[resolvedKey] && typeof (updatedProgression as any)[resolvedKey] === 'object' ? (updatedProgression as any)[resolvedKey] : {}

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

  // Prepare character update promise
  const characterUpdatePromise = (async () => {
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
          const charObj = l2d.find((c) => c.id.toLowerCase() === data.character.toLowerCase() || c.name.toLowerCase() === data.character.toLowerCase())

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
              const previousPlacement = captureSpineCanvasPlacement()
              const previousLoadTime = market.live2d.finishedLoading
              market.live2d.change_current_spine(charObj)

              // Wait for load to complete
              logDebug('[Chat] Waiting for character load...')
              await new Promise<void>((r) => {
                const unwatch = watch(
                  () => market.live2d.finishedLoading,
                  (newVal) => {
                    if (newVal > previousLoadTime) {
                      logDebug('[Chat] Character loaded.')
                      unwatch()
                      // Add a small delay to ensure the spine player is fully ready to accept new tracks
                      setTimeout(r, 100)
                    }
                  }
                )
                // Safety timeout
                setTimeout(() => {
                  unwatch()
                  r()
                }, 10000)
              })

              // Restore the user's zoom/position after switching characters.
              await restoreSpineCanvasPlacement(previousPlacement)
            }
          } else {
            console.warn(`[Chat] Character not found: ${data.character}`)
          }
        }
      }
    }
  })()

  // Play Animation
  if (data.animation) {
    const requested = String(data.animation).trim()
    // Never let AI drive internal talk tracks; they are handled by yapping/TTS logic.
    // Also prevents Loader fuzzy-matching 'talk' -> 'talk_end'.
    const isForbidden = requested === 'talk' || requested === 'talk_start' || requested === 'talk_end'
    const normalized = isForbidden ? 'idle' : requested
    logDebug(`[Chat] Requesting animation: ${normalized} (Requested: ${requested})`)
    market.live2d.current_animation = normalized
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
      yapDuration = calculateYapDuration(data.text)
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

  // Add text to chat
  if (data.text) {
    let content = data.text

    if (chatMode.value === 'nikke') {
      nikkeCurrentText.value = data.text
      nikkeCurrentSpeaker.value = data.speaking ? getCharacterName(effectiveCharId) || '' : ''

      // Get color from profile
      const speakerName = nikkeCurrentSpeaker.value
      const profile = effectiveCharacterProfiles.value[speakerName]
      nikkeSpeakerColor.value = profile?.color || '#ffffff'

      startTypewriter(data.text)

      // Wait for BOTH typewriter AND character load
      await Promise.all([
        characterUpdatePromise,
        new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (!isTyping.value) {
              clearInterval(check)
              resolve()
            }
          }, 100)
        })
      ])
    } else {
      // In classic mode, we still want to wait for character load before proceeding
      await characterUpdatePromise
    }

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
        const anyNamePattern = /^\*\*\s*[^*]+\s*\*\*:/

        if (!namePattern.test(content) && !anyNamePattern.test(content)) {
          content = `**${name}:** ${content}`
        }
      }
    }

    chatHistory.value.push({
      role: 'assistant',
      content: content,
      animation: market.live2d.current_animation,
      character: effectiveCharId,
      speaking: data.speaking,
      text: data.text
    })
    scrollToBottom()
  } else if (chatMode.value === 'nikke') {
    // Clear text but keep overlay visible for animations/switches
    nikkeCurrentText.value = ''
    nikkeDisplayedText.value = ''
    nikkeCurrentSpeaker.value = ''
  }

  // Handle Game Mode Choices
  if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
    logDebug('[Chat] Game Mode Choices detected:', data.choices)
    pendingGameChoices.value = data.choices
    choicesAwaitingReveal.value = true
    loadingStatus.value = 'Click to show choices...'
    waitingForNext.value = true // Pause auto-advance

    // Wait for user selection
    await new Promise<void>((r) => {
      nextActionResolver = r
    })

    // Clear choices after selection (handled in handleGameChoice)
    gameChoices.value = []
    pendingGameChoices.value = []
    choicesAwaitingReveal.value = false

    // IMPORTANT: Do not continue into manual/auto playback waits after a choice.
    // The selected choice will be queued and sent as the next user turn.
    return
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
    isLoadedSession.value = false
    lastPrompt.value = ''
    market.live2d.isVisible = false
    selectedMessageIndex.value = null
    nikkeOverlayVisible.value = false
  }
}

const summarizeChunk = async (messages: { role: string; content: string }[]): Promise<boolean> => {
  if (messages.length === 0) return true

  loadingStatus.value = 'Summarizing story so far...'

  try {
    const summary = await summarizeChunkImpl(messages, {
      apiProvider: apiProvider.value,
      apiKey: apiKey.value,
      model: model.value,
      localMaxTokens: localMaxTokens.value,
      localUrl: localUrl.value,
      prompts,
      enableContextCaching: enableContextCaching.value
    })

    if (summary) {
      if (storySummary.value) {
        storySummary.value += '\n\n' + summary
      } else {
        storySummary.value = summary
      }
      summarizationLastError.value = null

      return true
    }
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

.reset-btn {
  position: absolute;
  top: 150px;
  right: 120px;
  pointer-events: auto;
  z-index: 1001;

  @media (max-width: 768px) {
    top: 150px;
    right: 110px;
  }
}

.chat-container {
  position: absolute;
  /* Initial values will be overridden by inline styles */
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 10px;
  padding: 0; /* Removed padding to handle drag bar */
  pointer-events: auto;
  transition: opacity 0.3s;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  z-index: 1000;
}

.chat-drag-handle {
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  cursor: move;
  user-select: none;
  flex-shrink: 0;

  .drag-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.7);

    .drag-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
  }
}

.resize-handle {
  position: absolute;
  width: 20px;
  height: 20px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;

  &.se {
    bottom: 0;
    right: 0;
    cursor: nwse-resize;
    color: rgba(255, 255, 255, 0.3);
    &:hover {
      color: rgba(255, 255, 255, 0.8);
    }
  }

  &.sw {
    bottom: 0;
    left: 0;
    cursor: nesw-resize;
  }

  &.ne {
    top: 0;
    right: 0;
    cursor: nesw-resize;
    z-index: 20; /* Above drag handle */
  }

  &.nw {
    top: 0;
    left: 0;
    cursor: nwse-resize;
    z-index: 20; /* Above drag handle */
  }
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  margin-bottom: 0;

  .message {
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 8px;
    position: relative;

    &.replay-enabled {
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }

    &.selected {
      background: rgba(184, 134, 11, 0.6) !important;
      border: 1px solid #ffd700;
    }

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
  padding: 0 10px 10px 10px;

  @media (max-width: 1024px) {
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
  margin-top: 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.2);
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

.nikke-chat-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: auto;
  user-select: none;
  box-sizing: border-box;
  /* Support iOS safe area insets */
  padding-bottom: env(safe-area-inset-bottom);
}

.nikke-chat-overlay.passthrough {
  pointer-events: none;
}

.nikke-overlay-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10003;
  display: flex;
  align-items: center;
  pointer-events: auto;

  @media (max-width: 1024px) {
    top: 10px;
    right: 10px;
  }
}

.nikke-vignette {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, transparent 30%, rgba(0, 0, 0, 0.5) 100%);
  pointer-events: none;
}

.nikke-dialogue-container {
  position: relative;
  width: 100%;
  pointer-events: auto;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 50%, transparent 100%);
  padding: 60px 10% 80px 10%;
  color: white;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  /* Allow interaction (scroll/touch) so mobile devices can scroll overflowing text */
  pointer-events: auto;
  box-sizing: border-box;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(80px + env(safe-area-inset-bottom));

  @media (max-width: 1024px) {
    padding: 40px 5% 60px 5%;
    min-height: 150px;
    max-height: calc(100vh - 60px);
  }

  @media (max-width: 834px) {
    padding: 30px 4% 50px 4%;
    min-height: 120px;
    max-height: calc(100vh - 50px);
  }
}

.nikke-speaker-name {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.6em;
  font-weight: 700;
  margin-bottom: 16px;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);

  @media (max-width: 1024px) {
    font-size: 1.2em;
    margin-bottom: 8px;
  }
}

.nikke-speaker-indicator {
  width: 6px;
  height: 1.2em;
  background-color: #ffeb3b;
  box-shadow: 0 0 10px rgba(255, 235, 59, 0.4);
}

.nikke-dialogue-text {
  font-size: 1.4em;
  line-height: 1.6;
  white-space: pre-wrap;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  max-width: 1400px;
  font-weight: 400;
  word-break: break-word;
  max-width: calc(100% - 40px);

  @media (max-width: 1024px) {
    font-size: 1.1em;
    line-height: 1.4;
  }

  @media (max-width: 834px) {
    font-size: 1em;
    line-height: 1.35;
  }
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
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0));
}

.accent-blue {
  --accent: #1565c0;
}
.accent-green {
  --accent: #2e7d32;
}
.accent-purple {
  --accent: #6a1b9a;
}
.accent-light-blue {
  --accent: #00eeff;
}
.accent-orange {
  --accent: #ef6c00;
}
.accent-red {
  --accent: #c62828;
}

.game-choices-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
  pointer-events: auto;
}
.choices-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 600px;
  padding: 20px;

  @media (max-width: 1024px) {
    gap: 10px;
    padding: 15px;
  }
}
.choice-btn {
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 20px 30px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;

  @media (max-width: 1024px) {
    padding: 15px 20px;
  }
}
.choice-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: #00eeff;
  transform: scale(1.02);
}
.choice-marker {
  width: 8px;
  height: 8px;
  background: #00eeff;
  margin-right: 16px;
  transform: rotate(45deg);
}
.choice-text {
  color: white;
  font-size: 1.2em;
  font-weight: 500;
  letter-spacing: 1px;

  @media (max-width: 1024px) {
    font-size: 1em;
  }
}
.guide-content {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  color: #e0e0e0;

  h3 {
    margin-top: 0;
    color: #00eeff;
    font-size: 1.4em;
    border-bottom: 1px solid rgba(0, 238, 255, 0.2);
    padding-bottom: 8px;
    margin-bottom: 16px;
  }

  h4 {
    color: #ffeb3b;
    margin: 12px 0 8px 0;
  }

  ul {
    padding-left: 20px;
    li {
      margin-bottom: 8px;
      line-height: 1.5;
    }
  }

  code {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    color: #ffeb3b;
  }
}

.guide-page {
  flex: 1;
  animation: fadeIn 0.3s ease;
}

.guide-section {
  background: rgba(255, 255, 255, 0.03);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.guide-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.guide-steps {
  display: flex;
  gap: 8px;
}

.guide-step {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.guide-step.active {
  background: #00eeff;
  transform: scale(1.2);
  box-shadow: 0 0 8px rgba(0, 238, 255, 0.5);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
