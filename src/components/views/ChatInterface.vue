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
        maxHeight: 'none',
        '--chat-width': chatSize.width + 'px',
        '--chat-height': chatSize.height + 'px'
      }"
    >
      <!-- Drag Handle -->
      <div class="chat-drag-handle" @mousedown="startDrag" @touchstart="startDrag">
        <div class="drag-indicator">
          <n-icon size="16"><Draggable /></n-icon>
          <span class="drag-title">Chat</span>
        </div>
        <div class="window-controls">
          <n-button size="tiny" circle quaternary @click="resetChatLayout" title="Reset Position">
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

      <div class="session-controls" :style="{ '--chat-width': chatSize.width + 'px' }">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button type="error" size="small" @click="saveSession" :disabled="chatHistory.length === 0 || isLoading" :style="{ opacity: chatHistory.length === 0 || isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
              <template #icon
                ><n-icon><Save /></n-icon
              ></template>
            </n-button>
          </template>
          Save
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button type="warning" size="small" @click="triggerRestore" :disabled="isLoading" :style="{ opacity: isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
              <template #icon
                ><n-icon><Upload /></n-icon
              ></template>
            </n-button>
          </template>
          Load
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button type="error" size="small" @click="resetSession" :disabled="isLoading || chatHistory.length === 0" :style="{ opacity: chatHistory.length === 0 || isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
              <template #icon
                ><n-icon><Reset /></n-icon
              ></template>
            </n-button>
          </template>
          Reset
        </n-tooltip>
        <n-button type="info" size="small" @click="handleCompactSummary" :disabled="isCompactSummaryDisabled" :style="{ opacity: isCompactSummaryDisabled ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
          <template #icon
            ><n-icon><TextScale /></n-icon
          ></template>
          Compaction
        </n-button>
        <div class="story-character-inline">
          <div class="story-character-inline-header">
            <n-button size="small" type="primary" @click="showRosterList = !showRosterList">Characters</n-button>
            <n-button v-if="showRosterList" size="small" type="success" @click="addRosterRow">+</n-button>
          </div>
          <div v-if="showRosterList" class="story-character-list">
            <div v-for="entry in rosterRows" :key="entry.key" class="story-character-row compact">
              <n-select class="story-character-select" :value="entry.selection" :options="availableRosterOptions" filterable placeholder="Character" @update:value="(val) => updateRosterSelection(entry, val as string)" />
              <n-select v-if="parseSelectionValue(entry.selection)?.type === 'base'" class="story-character-select" :value="entry.skinId || getSkinOptionsForEntry(entry)[0]?.value" :options="getSkinOptionsForEntry(entry)" filterable placeholder="Skin" @update:value="(val) => updateRosterSkin(entry, val as string)" />
              <n-tag v-if="entry.source === 'ai'" size="small" type="warning">AI</n-tag>
              <n-button size="tiny" type="error" @click="removeRosterRow(entry)">Remove</n-button>
            </div>
          </div>
        </div>
        <n-popover trigger="click" v-model:show="showRemindersDropdown" placement="top">
          <template #trigger>
            <n-button type="info" size="small" :style="{ opacity: isLoading ? 0.4 : 0.8, transition: 'opacity 0.15s' }">
              <template #icon>
                <n-icon><Help /></n-icon>
              </template>
              Problems?
            </n-button>
          </template>
          <div class="problems-popover-content">
            <div class="problems-popover-header">Inject one or more reminders to the model for the next turn:</div>
            <div class="problems-popover-row">
              <n-checkbox v-model:checked="invalidJsonToggle">Invalid JSON Schema</n-checkbox>
              <n-checkbox v-model:checked="invalidJsonAuto" size="small">Auto</n-checkbox>
              <n-checkbox v-model:checked="invalidJsonPersist" size="small">Persist</n-checkbox>
            </div>
            <div class="problems-popover-row">
              <n-checkbox v-model:checked="incorrectAnimationsToggle">Incorrect or Lazy Animations</n-checkbox>
              <n-checkbox v-model:checked="incorrectAnimationsPersist" size="small">Persist</n-checkbox>
            </div>
            <n-checkbox v-model:checked="honorificsToggle">Incorrect Honorifics</n-checkbox>
            <n-checkbox v-model:checked="narrationAndDialogueNotSplitToggle">Narration and Dialogue Not Split</n-checkbox>
            <n-checkbox v-model:checked="wrongSpeechStylesToggle">Using Wrong Speech Styles</n-checkbox>
            <n-checkbox v-if="mode !== 'story'" v-model:checked="aiControllingUserToggle">AI Is Controlling Me</n-checkbox>
            <n-checkbox v-model:checked="incorrectSpeakerLabelingToggle">Incorrect Speaker Labeling</n-checkbox>
            <n-checkbox v-model:checked="narrationAsDialogueToggle">Narration presented as dialogue</n-checkbox>
            <n-checkbox v-model:checked="wrongCharacterOnScreenToggle">Wrong character on screen</n-checkbox>
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

          <n-form-item label="API Key" v-if="apiProvider !== 'local'">
            <n-input v-model:value="apiKey" type="password" show-password-on="click" placeholder="Enter API Key" />
          </n-form-item>
          <n-alert type="info" style="margin-bottom: 12px" title=""> Your API key is stored locally in your browser's local storage, and it is never sent to Nikke-DB. </n-alert>
          <n-alert v-if="apiProvider === 'pollinations'" type="info" style="margin-bottom: 12px" title=""> For Pollinations, register at <a href="https://enter.pollinations.ai" target="_blank">enter.pollinations.ai</a> for a Secret key. </n-alert>
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

          <n-form-item v-if="tokenUsage !== 'goddess'">
            <template #label>
              Automatically Compact Summaries
              <n-popover trigger="hover" placement="bottom" style="max-width: 300px">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  When enabled, the story summary is automatically compacted after a set number of summarizations to prevent it from growing too large and consuming tokens.<br /><br />
                  You can also compact manually using the button in the chat area.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="autoCompactSummaries" />
          </n-form-item>

          <n-form-item v-if="autoCompactSummaries && tokenUsage !== 'goddess'" label="Compact every N summarizations">
            <n-select v-model:value="autoCompactFrequency" :options="compactFrequencyOptions" />
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

          <n-form-item v-if="mode !== 'story'">
            <template #label>
              Realistic Mode <span style="font-size: smaller">(Experimental)</span>
              <n-popover trigger="hover" placement="bottom">
                <template #trigger>
                  <n-icon size="16" style="vertical-align: text-bottom; margin-left: 4px; cursor: help; color: #888">
                    <Help />
                  </n-icon>
                </template>
                <div>
                  Prevents the user from forcing unrealistic actions or outcomes in the story, such as dictating NPC behaviour, specifying guaranteed outcomes, or performing physically impossible gestures.<br /><br />
                  Note that the user can still delete individual messages from the chatbox, and this mode can be disabled at any time.<br /><br />
                  Unavailable in Story Mode.
                </div>
              </n-popover>
            </template>
            <n-switch v-model:value="realisticModeEnabled" />
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
                <div v-if="realisticModeEnabled">
                  In Realistic Mode, God Mode prevents the Commander from dying but does <strong>NOT</strong> prevent bad outcomes. The Commander can still lose fights, get injured, get captured, or fail — death is simply replaced with the nearest non-lethal outcome (e.g., captured, knocked unconscious, rescued).<br /><br />
                  Note that it is possible the model may still override this instruction. If this happens, simply delete the last messages of the story and try again.
                </div>
                <div v-else>
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
                  <strong>Low:</strong> Slightly worse quality and detail, but much better performance on low-end systems. Recommended for most devices.<br /><br />
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
                  Enables TTS using a local server.<br />
                  Supports AllTalk (XTTSv2), GPT-SoVits or Chatterbox.<br /><br />
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
          <h4 class="settings-section-header accent-orange">Support this feature!</h4>
          <n-divider />
          <div style="display: flex; justify-content: center; padding-bottom: 10px">
            <a href="https://ko-fi.com/rhystic1" target="_blank"><img height="36" style="border: 0px; height: 36px" src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com" /></a>
          </div>
        </n-form>
      </n-drawer-content>
    </n-drawer>

    <input type="file" ref="fileInput" style="display: none" accept=".json" @change="handleFileUpload" />

    <n-modal v-model:show="showGuide" :mask-closable="false" preset="card" title="Story/Roleplaying Generator Guide" style="width: 700px; max-width: 95vw">
      <div class="guide-content">
        <div v-if="guidePage === 1" class="guide-page">
          <h3>🆕 What's New?</h3>
          <div class="guide-section">
            <ul>
              <li>Added Realistic Mode for Roleplay and Game modes</li>
              <li>Added Commander relationships with characters in the database, plus new characters</li>
              <li>Improvements on almost all APIs, including Local</li>
              <li>Significant under-the-hood fixes and improvements</li>
            </ul>
          </div>
        </div>

        <div v-if="guidePage === 2" class="guide-page">
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

        <div v-if="guidePage === 3" class="guide-page">
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

        <div v-if="guidePage === 4" class="guide-page">
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

        <div v-if="guidePage === 5" class="guide-page">
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

        <div v-if="guidePage === 6" class="guide-page">
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
            <div v-for="p in 6" :key="p" class="guide-step" :class="{ active: guidePage === p }"></div>
          </div>
          <div class="guide-actions">
            <n-button v-if="guidePage > 1" @click="guidePage--" style="margin-right: 10px">
              <template #icon
                ><n-icon><ChevronLeft /></n-icon
              ></template>
              Back
            </n-button>
            <n-button v-if="guidePage < 6" type="primary" @click="guidePage++">
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
import { Settings, Help, Save, Upload, TrashCan, Reset, Renew, Draggable, Maximize, Close, ChevronLeft, ChevronRight, TextScale } from '@vicons/carbon'
import { NIcon, NButton, NInput, NDrawer, NDrawerContent, NForm, NFormItem, NSelect, NSwitch, NPopover, NAlert, NModal, NSpin, NCheckbox, NTag } from 'naive-ui'
import l2d from '@/utils/json/l2d.json'
import localCharacterProfiles from '@/utils/json/characterProfiles.json'
import variantCharacterProfiles from '@/utils/json/characterProfilesVariants.json'
import loadingMessages from '@/utils/json/loadingMessages.json'
import prompts from '@/utils/json/prompts.json'
import { marked } from 'marked'
import { sanitizeActions, parseFallback, parseAIResponse, isWholeWordPresent, formatChoiceAsUserTurn, filterEchoedUserChoiceDialogueInGameMode, stripChoicesWhenNotGameMode, ensureGameModeChoicesFallback, calculateYapDuration, replayMessage as replayMessageUtil, getHonorific, createTypewriterController, getEffectiveCharacterProfiles, logDebug, getAIErrorMessage, buildUserReminders, generateSystemPrompt as generateSystemPromptUtil, type ReminderToggleState } from '@/utils/chatUtils'
import { normalizeAiActionCharacterData } from '@/utils/aiActionNormalization'
import { ttsEnabled, ttsEndpoint, ttsProvider, gptSovitsEndpoint, gptSovitsBasePath, chatterboxEndpoint, ttsProviderOptions, playTTS } from '@/utils/ttsUtils'
import { allowWebSearchFallback, usesWikiFetch, usesPollinationsAutoFallback, webSearchFallbackHelpText, searchForCharacters, searchForCharactersWithNativeSearch, searchForCharactersViaWikiFetch, checkForSearchRequest as checkForSearchRequestUtil } from '@/utils/aiWebSearchUtils'
import { callOpenRouter as callOpenRouterImpl, callGemini as callGeminiImpl, callPollinations as callPollinationsImpl, enrichActionsWithAnimations, callLocal as callLocalImpl, summarizeChunk as summarizeChunkImpl, compactSummary as compactSummaryImpl, getFilteredAnimations, providerOptions, tokenUsageOptions, fetchOpenRouterModels, fetchPollinationsModels, formatAnimationsForContext, getReasoningEffortOptions, handleTumblingWindowSummarization } from '@/utils/llmUtils'
import { captureSpineCanvasPlacement, restoreSpineCanvasPlacement } from '@/utils/spineUtils'
import { isInteractiveOverlayTarget, isSpineCanvasAtPoint, getEventPoint } from '@/utils/overlayUtils'
import { initChatLayout, createDragHandlers, createResizeHandlers, createViewportHandlers } from '@/utils/windowUtils'
import { buildCharacterCatalog, getCharacterSelectOptions, getSkinOptionsForBase, getSelectionForName, getSelectionValueForBase, parseSelectionValue, resolveCharacterIdFromInput, resolveRosterIdsFromPrompt, getCharacterDisplayName, getBaseCharacterDisplayName, type StoryCharacterEntry } from '@/utils/storyCharacterUtils'
import { buildSessionExportData, downloadSessionFile, reconstructChatHistory, validateSessionSettings, adjustLastSummarizedIndex } from '@/utils/sessionUtils'
import { loadSettingsFromStorage, validateSavedModel } from '@/utils/settingsUtils'

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
const model = ref('')
const mode = ref('game')
const tokenUsage = ref('medium')
const reasoningEffort = ref(localStorage.getItem('nikke_reasoning_effort') || 'default')

watch(reasoningEffort, (val) => {
  localStorage.setItem('nikke_reasoning_effort', val)
})

const reasoningEffortOptions = computed(() => getReasoningEffortOptions(apiProvider.value))
const enableContextCaching = ref(true)
const playbackMode = ref('manual')
const godModeEnabled = ref(localStorage.getItem('nikke_god_mode_enabled') === 'true')
const realisticModeEnabled = ref(localStorage.getItem('nikke_realistic_mode_enabled') === 'true')
const userInput = ref('')
const isLoading = ref(false)
const isGenerating = ref(false)
const loadingStatus = ref('')
const isStopped = ref(false)
let activeAbortController: AbortController | null = null
const waitingForNext = ref(false)
const showRetry = ref(false)
const lastPrompt = ref('')
const storySummary = ref('')
const lastSummarizedIndex = ref(0)
const summarizationRetryPending = ref(false)
const summarizationAttemptCount = ref(0)
const summarizationLastError = ref<string | null>(null)
const summarizationSuccessCount = ref(0)
const summaryJustCompacted = ref(false)
const autoCompactSummaries = ref(true)
const autoCompactFrequency = ref(4)
const COMPACT_MIN_LENGTH = 1500
const compactFrequencyOptions = [
  { label: '3', value: 3 },
  { label: '4 (Default)', value: 4 },
  { label: '5', value: 5 },
  { label: '10', value: 10 }
]
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

// Number of conversational turns (user msg + following assistant/system msgs) to keep as
// overlap after summarization so the model retains immediate context.
const OVERLAP_TURNS = 3

// Story/Roleplay character roster
const characterCatalog = buildCharacterCatalog()
const rosterRows = ref<StoryCharacterEntry[]>([])
const showRosterList = ref(false)
const rosterOptions = computed(() => getCharacterSelectOptions(characterCatalog))

const availableRosterOptions = computed(() => {
  return rosterOptions.value.map((option) => {
    const isSelected = isCharacterInRoster(option.value)
    return {
      ...option,
      disabled: isSelected,
      class: isSelected ? 'character-option-disabled' : ''
    }
  })
})

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

// Wrapper so the template doesn't need to pass Refs directly (auto-unwrap in templates
// would pass plain objects instead of Ref<WindowSize> / Ref<WindowPosition>).
const resetChatLayout = () => initChatLayout(chatSize, chatPosition)

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
      { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite-preview' },
      { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' },
      { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro-preview' }
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

const isCompactSummaryDisabled = computed(() => {
  return isLoading.value || tokenUsage.value === 'goddess' || summaryJustCompacted.value || storySummary.value.length < COMPACT_MIN_LENGTH || (summarizationSuccessCount.value === 0 && !storySummary.value)
})

const assetQuality = computed({
  get: () => (market.live2d.HQassets ? 'high' : 'low'),
  set: (val: string) => {
    market.live2d.HQassets = val === 'high'
  }
})

const getCharacterBaseFromSelection = (selection: string): string | null => {
  const parsed = parseSelectionValue(selection)
  if (!parsed) return null
  if (parsed.type === 'base') return parsed.baseName
  if (parsed.type === 'variant') {
    // For variants, get the base name from the variant name
    const variantName = characterCatalog.idToName[parsed.variantId]
    if (variantName && variantName.includes(':')) {
      return variantName.split(':')[0].trim()
    }
    return variantName
  }
  return null
}

const isCharacterInRoster = (selection: string): boolean => {
  const baseName = getCharacterBaseFromSelection(selection)
  if (!baseName) return false

  return rosterRows.value.some((row) => {
    const rowBase = getCharacterBaseFromSelection(row.selection)
    return rowBase && rowBase.toLowerCase() === baseName.toLowerCase()
  })
}

const ensureRosterEntry = (selection: string, skinId: string | undefined, source: 'user' | 'ai') => {
  // Check if character is already in roster (any skin)
  if (isCharacterInRoster(selection)) {
    return null
  }
  const entry: StoryCharacterEntry = {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    selection,
    skinId,
    source
  }
  rosterRows.value.push(entry)
  return entry
}

const addRosterRow = () => {
  if (characterCatalog.baseNames.length === 0) return

  // Find first base character not already in roster
  for (const baseName of characterCatalog.baseNames) {
    const selection = getSelectionValueForBase(baseName)
    if (!isCharacterInRoster(selection)) {
      ensureRosterEntry(selection, undefined, 'user')
      return
    }
  }
  // All characters already in roster
}

const removeRosterRow = (entry: StoryCharacterEntry) => {
  rosterRows.value = rosterRows.value.filter((row) => row.key !== entry.key)
}

const updateRosterSelection = (entry: StoryCharacterEntry, selection: string) => {
  // Prevent selecting a character that's already in the roster
  if (isCharacterInRoster(selection)) {
    return
  }
  entry.selection = selection
  entry.skinId = undefined
}

const updateRosterSkin = (entry: StoryCharacterEntry, skinId: string) => {
  entry.skinId = skinId
}

const getSkinOptionsForEntry = (entry: StoryCharacterEntry) => {
  const parsed = parseSelectionValue(entry.selection)
  if (!parsed || parsed.type !== 'base') return []
  return getSkinOptionsForBase(characterCatalog, parsed.baseName)
}

const syncRosterFromProfiles = (names: string[], source: 'ai' | 'user') => {
  for (const name of names) {
    const selectionInfo = getSelectionForName(name, characterCatalog)
    if (!selectionInfo) continue
    const parsed = parseSelectionValue(selectionInfo.selection)
    const skinId = selectionInfo.skinId || (parsed?.type === 'base' ? getSkinOptionsForBase(characterCatalog, parsed.baseName)[0]?.value : undefined)
    ensureRosterEntry(selectionInfo.selection, skinId, source)
  }
}

const syncRosterFromPrompt = (prompt: string) => {
  const foundIds = resolveRosterIdsFromPrompt(prompt, characterCatalog)
  if (!foundIds || foundIds.length === 0) return
  for (const id of foundIds) {
    const selectionInfo = getSelectionForName(characterCatalog.idToName[id] || id, characterCatalog)
    if (!selectionInfo) continue
    const parsed = parseSelectionValue(selectionInfo.selection)
    const skinId = selectionInfo.skinId || (parsed?.type === 'base' ? getSkinOptionsForBase(characterCatalog, parsed.baseName)[0]?.value : undefined)
    ensureRosterEntry(selectionInfo.selection, skinId, 'user')
  }
}

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
  // If switching to Story mode, disable Realistic Mode
  if (newVal === 'story') {
    realisticModeEnabled.value = false
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

watch(realisticModeEnabled, (newVal) => {
  localStorage.setItem('nikke_realistic_mode_enabled', String(newVal))
})

watch(autoCompactSummaries, (newVal) => {
  localStorage.setItem('nikke_auto_compact_summaries', String(newVal))
})

watch(autoCompactFrequency, (newVal) => {
  localStorage.setItem('nikke_auto_compact_frequency', String(newVal))
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

  // Load all simple settings from localStorage
  const stored = loadSettingsFromStorage()

  if (stored.mode !== undefined) mode.value = stored.mode
  if (stored.playbackMode !== undefined) playbackMode.value = stored.playbackMode
  if (stored.yapEnabled !== undefined) market.live2d.yapEnabled = stored.yapEnabled
  if (stored.hqAssets !== undefined) market.live2d.HQassets = stored.hqAssets
  if (stored.ttsEnabled !== undefined) ttsEnabled.value = stored.ttsEnabled
  if (stored.ttsEndpoint !== undefined) ttsEndpoint.value = stored.ttsEndpoint
  if (stored.ttsProvider !== undefined) ttsProvider.value = stored.ttsProvider
  if (stored.gptSovitsEndpoint !== undefined) gptSovitsEndpoint.value = stored.gptSovitsEndpoint
  if (stored.gptSovitsBasePath !== undefined) gptSovitsBasePath.value = stored.gptSovitsBasePath
  if (stored.chatterboxEndpoint !== undefined) chatterboxEndpoint.value = stored.chatterboxEndpoint
  if (stored.tokenUsage !== undefined) tokenUsage.value = stored.tokenUsage
  if (stored.enableContextCaching !== undefined) enableContextCaching.value = stored.enableContextCaching
  if (stored.autoCompactSummaries !== undefined) autoCompactSummaries.value = stored.autoCompactSummaries
  if (stored.autoCompactFrequency !== undefined) autoCompactFrequency.value = stored.autoCompactFrequency
  if (stored.enableAnimationReplay !== undefined) enableAnimationReplay.value = stored.enableAnimationReplay

  // Provider + model (needs async model fetching)
  if (stored.apiProvider) {
    apiProvider.value = stored.apiProvider

    if (stored.apiProvider === 'openrouter') {
      openRouterModels.value = await fetchOpenRouterModels()
    } else if (stored.apiProvider === 'pollinations') {
      pollinationsModels.value = await fetchPollinationsModels(apiKey.value)
    }

    let validModels: string[] = []
    if (stored.apiProvider === 'gemini') {
      validModels = ['gemini-2.5-flash', 'gemini-2.5-pro']
    } else if (stored.apiProvider === 'openrouter') {
      validModels = openRouterModels.value.map((m) => m.value)
    } else if (stored.apiProvider === 'pollinations') {
      validModels = pollinationsModels.value.map((m) => m.value)
    }

    const { model: validModel, warning } = validateSavedModel(stored.apiProvider, stored.model, validModels, openRouterModels.value.length > 0 ? openRouterModels.value[0].value : undefined)
    if (validModel) model.value = validModel
    if (warning) console.warn(warning)
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

const { startDrag } = createDragHandlers({ chatPosition, chatSize, isDragging, dragOffset })
const { startResize } = createResizeHandlers({ chatPosition, chatSize, isResizing, resizeDirection, resizeStart })
const { restoreViewportZoom, preventMobileZoomOnThisView, lockMobilePageScroll, unlockMobilePageScroll } = createViewportHandlers()

onMounted(() => {
  originalHQAssets.value = market.live2d.HQassets
  checkGuide()
  initializeSettings()
  initChatLayout(chatSize, chatPosition)
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
  const sessionData = buildSessionExportData({
    chatHistory: chatHistory.value,
    characterProfiles: characterProfiles.value,
    characterProgression: characterProgression.value,
    storySummary: storySummary.value,
    lastSummarizedIndex: lastSummarizedIndex.value,
    summarizationSuccessCount: summarizationSuccessCount.value,
    summaryJustCompacted: summaryJustCompacted.value,
    mode: mode.value,
    rosterRows: rosterRows.value,
    enableAnimationReplay: enableAnimationReplay.value,
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
    reasoningEffort: reasoningEffort.value,
    autoCompactSummaries: autoCompactSummaries.value,
    autoCompactFrequency: autoCompactFrequency.value
  })

  downloadSessionFile(sessionData)
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
          chatHistory.value = reconstructChatHistory(data.chatHistory, getCharacterName)
          selectedMessageIndex.value = null
        }
        if (data.characterProfiles) {
          characterProfiles.value = data.characterProfiles
        }
        if (data.characterProgression) {
          characterProgression.value = data.characterProgression
        }
        if (Array.isArray(data.rosterRows)) {
          rosterRows.value = data.rosterRows
        }
        if (data.storySummary) {
          storySummary.value = data.storySummary
        }
        if (data.lastSummarizedIndex !== undefined) {
          lastSummarizedIndex.value = data.lastSummarizedIndex
        }
        if (typeof data.summarizationSuccessCount === 'number') {
          summarizationSuccessCount.value = data.summarizationSuccessCount
        }
        if (typeof data.summaryJustCompacted === 'boolean') {
          summaryJustCompacted.value = data.summaryJustCompacted
        }
        if (data.mode) {
          mode.value = data.mode
        }

        // Restore Settings — build valid model list, then validate
        if (data.settings) {
          // If the saved provider is openrouter, fetch models first
          const savedProvider = data.settings.apiProvider
          if (savedProvider === 'openrouter') {
            openRouterModels.value = await fetchOpenRouterModels()
          }

          let validModels: string[] = []
          if (savedProvider === 'gemini') {
            validModels = ['gemini-2.5-flash', 'gemini-2.5-pro']
          } else if (savedProvider === 'openrouter') {
            validModels = openRouterModels.value.map((m) => m.value)
          }

          const validated = validateSessionSettings(data.settings, validModels)

          // Apply validated settings to refs
          if (validated.playbackMode !== undefined) playbackMode.value = validated.playbackMode
          if (validated.yapEnabled !== undefined) market.live2d.yapEnabled = validated.yapEnabled
          if (validated.ttsEnabled !== undefined) ttsEnabled.value = validated.ttsEnabled
          if (validated.ttsEndpoint !== undefined) ttsEndpoint.value = validated.ttsEndpoint
          if (validated.ttsProvider !== undefined) ttsProvider.value = validated.ttsProvider
          if (validated.gptSovitsEndpoint !== undefined) gptSovitsEndpoint.value = validated.gptSovitsEndpoint
          if (validated.gptSovitsBasePath !== undefined) gptSovitsBasePath.value = validated.gptSovitsBasePath
          if (validated.tokenUsage !== undefined) tokenUsage.value = validated.tokenUsage
          if (validated.enableContextCaching !== undefined) enableContextCaching.value = validated.enableContextCaching
          if (validated.useLocalProfiles !== undefined) useLocalProfiles.value = validated.useLocalProfiles
          if (validated.allowWebSearchFallback !== undefined) allowWebSearchFallback.value = validated.allowWebSearchFallback
          if (validated.reasoningEffort !== undefined) reasoningEffort.value = validated.reasoningEffort
          if (validated.autoCompactSummaries !== undefined) autoCompactSummaries.value = validated.autoCompactSummaries
          if (validated.autoCompactFrequency !== undefined) autoCompactFrequency.value = validated.autoCompactFrequency
          if (validated.apiProvider !== undefined) apiProvider.value = validated.apiProvider
          if (validated.model !== undefined) model.value = validated.model
          if (validated.modelWarning) {
            chatHistory.value.push({ role: 'system', content: validated.modelWarning })
          }
        }

        // Ensure a minimum context window upon restore
        lastSummarizedIndex.value = adjustLastSummarizedIndex(chatHistory.value.length, lastSummarizedIndex.value, tokenUsage.value)

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

  syncRosterFromPrompt(text)

  userInput.value = ''
  chatHistory.value.push({ role: 'user', content: text })
  scrollToBottom()
  isLoading.value = true
  isGenerating.value = true
  setRandomLoadingMessage()
  isStopped.value = false
  activeAbortController = new AbortController()
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
      // Silently swallow AbortError — the user pressed Stop
      if (error.name === 'AbortError') {
        logDebug('[sendMessage] Fetch aborted by user.')

        break
      }

      if (error.message === 'JSON_PARSE_ERROR' && attempts < maxAttempts) {
        console.warn(`JSON parse error, retrying (${attempts}/${maxAttempts})...`)

        continue
      }

      console.error('AI Error:', error)
      showRetry.value = true
      chatHistory.value.push({ role: 'system', content: getAIErrorMessage(error) })

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
  activeAbortController = new AbortController()
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
      // Silently swallow AbortError — the user pressed Stop
      if (error.name === 'AbortError') {
        logDebug('[retryLastMessage] Fetch aborted by user.')
        break
      }

      if (error.message === 'JSON_PARSE_ERROR' && attempts < maxAttempts) {
        console.warn(`JSON parse error, retrying (${attempts}/${maxAttempts})...`)

        continue
      }

      console.error('AI Error:', error)
      showRetry.value = true
      chatHistory.value.push({ role: 'system', content: getAIErrorMessage(error) })

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

  // Abort any in-flight HTTP requests
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }

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
  activeAbortController = new AbortController()
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
      // Silently swallow AbortError — the user pressed Stop
      if (error.name === 'AbortError') {
        logDebug('[continueStory] Fetch aborted by user.')
        break
      }

      if (error.message === 'JSON_PARSE_ERROR' && attempts < maxAttempts) {
        console.warn(`JSON parse error, retrying (${attempts}/${maxAttempts})...`)

        continue
      }

      console.error('AI Error:', error)
      showRetry.value = true
      chatHistory.value.push({ role: 'system', content: getAIErrorMessage(error) })

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
  const toggleMap: Record<string, { ref: any; persist?: any }> = {
    invalidJson: { ref: invalidJsonToggle, persist: invalidJsonPersist },
    invalidJsonPersist: { ref: invalidJsonPersist },
    emptyActionsRetry: { ref: emptyActionsRetry },
    honorifics: { ref: honorificsToggle },
    narrationAndDialogueNotSplit: { ref: narrationAndDialogueNotSplitToggle },
    aiControllingUser: { ref: aiControllingUserToggle },
    wrongSpeechStyles: { ref: wrongSpeechStylesToggle },
    incorrectAnimations: { ref: incorrectAnimationsToggle, persist: incorrectAnimationsPersist },
    incorrectAnimationsPersist: { ref: incorrectAnimationsPersist },
    incorrectSpeakerLabeling: { ref: incorrectSpeakerLabelingToggle },
    narrationAsDialogue: { ref: narrationAsDialogueToggle },
    wrongCharacterOnScreen: { ref: wrongCharacterOnScreenToggle }
  }

  const snapshot: ReminderToggleState = {
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
    wrongCharacterOnScreen: wrongCharacterOnScreenToggle.value
  }

  const { text, togglesToClear } = buildUserReminders(snapshot, mode.value, prompts.reminders as Record<string, string>)

  for (const key of togglesToClear) {
    const entry = toggleMap[key]
    if (entry?.ref) entry.ref.value = false
  }

  return text
}

const getFormattedAnimationsForContext = () => {
  return formatAnimationsForContext({
    characterProfiles: characterProfiles.value,
    rosterRows: rosterRows.value,
    characterCatalog,
    currentLive2dId: market.live2d.current_id,
    currentLive2dAnimations: market.live2d.animations,
    animationCache: animationCache.value
  })
}

/**
 * Runs the shared tumbling-window summarization logic and applies the
 * returned state mutations to the component refs.  Returns the context
 * suffix (story summary text) and the sliced history to send to the provider.
 */
const runTumblingWindowSummarization = async (contextMsg: string, logTag: string): Promise<{ contextMsg: string; historyToSend: { role: string; content: string }[] }> => {
  const twResult = await handleTumblingWindowSummarization(
    {
      tokenUsage: tokenUsage.value,
      chatHistory: chatHistory.value,
      lastSummarizedIndex: lastSummarizedIndex.value,
      isLoadedSession: isLoadedSession.value,
      summarizationRetryPending: summarizationRetryPending.value,
      summarizationAttemptCount: summarizationAttemptCount.value,
      summarizationSuccessCount: summarizationSuccessCount.value,
      summaryJustCompacted: summaryJustCompacted.value,
      autoCompactSummaries: autoCompactSummaries.value,
      autoCompactFrequency: autoCompactFrequency.value,
      storySummary: storySummary.value,
      isStopped: isStopped.value,
      compactMinLength: COMPACT_MIN_LENGTH
    },
    {
      summarizeChunk,
      performCompaction,
      getOverlapMessageCount,
      setRandomLoadingMessage
    },
    logTag
  )

  // Apply ref mutations from the result
  if (twResult.lastSummarizedIndex !== undefined) lastSummarizedIndex.value = twResult.lastSummarizedIndex
  if (twResult.isLoadedSession !== undefined) isLoadedSession.value = twResult.isLoadedSession
  if (twResult.summarizationRetryPending !== undefined) summarizationRetryPending.value = twResult.summarizationRetryPending
  if (twResult.summarizationAttemptCount !== undefined) summarizationAttemptCount.value = twResult.summarizationAttemptCount
  if (twResult.summarizationSuccessCount !== undefined) summarizationSuccessCount.value = twResult.summarizationSuccessCount
  if (twResult.summaryJustCompacted !== undefined) summaryJustCompacted.value = twResult.summaryJustCompacted

  return {
    contextMsg: contextMsg + twResult.contextSuffix,
    historyToSend: twResult.historyToSend
  }
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
    syncRosterFromPrompt(firstPrompt)
    // Use whole word matching to avoid substring matches (e.g. "Crow" from "Crown")
    const localNames = Object.keys(localCharacterProfiles)
    const variantNames = Object.keys(variantCharacterProfiles)
    const knownNames = [...localNames, ...variantNames]
    const foundNames = knownNames.filter((name) => isWholeWordPresent(firstPrompt, name))

    // Also load profiles for characters in the roster (both base and variants)
    for (const entry of rosterRows.value) {
      const selection = parseSelectionValue(entry.selection)
      if (!selection) continue

      if (selection.type === 'variant') {
        // For variants, use the full variant name
        const variantName = characterCatalog.idToName[selection.variantId]
        if (variantName && !foundNames.includes(variantName)) {
          foundNames.push(variantName)
        }
      } else if (selection.type === 'base') {
        // For base characters, use the base name
        const baseName = selection.baseName
        if (baseName && !foundNames.includes(baseName)) {
          foundNames.push(baseName)
        }
      }
    }

    // Colon variants (e.g., "Anis: Sparkling Summer") are mutually exclusive with their
    // base characters. If a variant is matched, drop the base name to avoid injecting both
    // profiles into the system prompt and confusing the AI about which character to use.
    const matchedVariantBases = new Set(foundNames.filter((n) => n.includes(':')).map((n) => n.split(':')[0].trim()))
    const deduplicatedNames = foundNames.filter((name) => !(name.includes(':') === false && matchedVariantBases.has(name)))

    if (deduplicatedNames.length > 0 && !isStopped.value) {
      logDebug('[callAI] Pre-loading local profiles for:', deduplicatedNames)
      await wrappedSearchForCharacters(deduplicatedNames)
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

  // Tumbling window summarization + context/history preparation
  const { contextMsg: updatedContextMsg, historyToSend } = await runTumblingWindowSummarization(contextMsg, '[callAI]')
  contextMsg = updatedContextMsg

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
  if (isStopped.value) return response

  const searchRequest = await checkForSearchRequest(response, lastPrompt.value)

  if (searchRequest && searchRequest.length > 0 && !isStopped.value) {
    logDebug('[callAI] Model requested search for characters:', searchRequest)
    // Perform search for unknown characters
    const webSearchPerformed = await wrappedSearchForCharacters(searchRequest)
    setRandomLoadingMessage()

    // Only regenerate if web search was actually performed
    // If all characters were found locally, the original response is still valid
    if (webSearchPerformed && !isStopped.value) {
      logDebug('[callAI] Web search was performed, regenerating response...')
      return await callAIWithoutSearch(isRetry)
    } else {
      logDebug('[callAI] All characters found locally, using original response.')
    }
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

  // Tumbling window summarization + context/history preparation
  const { contextMsg: updatedContextMsg, historyToSend } = await runTumblingWindowSummarization(contextMsg, '[callAIWithoutSearch]')
  contextMsg = updatedContextMsg

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
  return checkForSearchRequestUtil(response, userPrompt, {
    characterProfiles: characterProfiles.value,
    characterCatalog,
    apiProvider: apiProvider.value,
    allowWebSearchFallback: allowWebSearchFallback.value
  })
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
  return generateSystemPromptUtil({
    enableWebSearch,
    effectiveCharacterProfiles: effectiveCharacterProfiles.value,
    rosterRows: rosterRows.value,
    currentLive2dId: market.live2d.current_id,
    mode: mode.value,
    godModeEnabled: godModeEnabled.value,
    realisticModeEnabled: realisticModeEnabled.value,
    characterCatalog
  })
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
    reasoningEffort: reasoningEffort.value,
    signal: activeAbortController?.signal
  })
}

const callGemini = async (messages: any[], enableWebSearch: boolean = false) => {
  return await callGeminiImpl(messages, {
    model: model.value,
    apiKey: apiKey.value,
    useLocalProfiles: useLocalProfiles.value,
    allowWebSearchFallback: allowWebSearchFallback.value,
    enableWebSearch,
    reasoningEffort: reasoningEffort.value,
    signal: activeAbortController?.signal
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
    enableContextCaching: enableContextCaching.value,
    signal: activeAbortController?.signal
  })
}

const callLocal = async (messages: any[]) => {
  return await callLocalImpl(messages, {
    apiKey: apiKey.value,
    localUrl: localUrl.value,
    modeIsGame: mode.value === 'game',
    reasoningEffort: reasoningEffort.value,
    signal: activeAbortController?.signal
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

const processAIResponse = async (responseStr: string, depth: number = 0, autoRetryAttempted: boolean = false) => {
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

    // If Auto mode is enabled and we haven't tried auto-retry yet, retry with the invalidJsonReminder
    if (invalidJsonAuto.value && !autoRetryAttempted && !isStopped.value) {
      console.log('[processAIResponse] Auto mode enabled, retrying with invalidJsonReminder...')

      // Temporarily enable the invalidJsonToggle to inject the reminder
      const previousToggleValue = invalidJsonToggle.value
      invalidJsonToggle.value = true

      try {
        setRandomLoadingMessage()
        const retryResponse = await callAI(true)

        // Restore the toggle to its previous state
        invalidJsonToggle.value = previousToggleValue

        // Process the retry response, marking that we've attempted auto-retry
        await processAIResponse(retryResponse, depth, true)
        return
      } catch (retryError) {
        // Restore the toggle even if retry failed
        invalidJsonToggle.value = previousToggleValue
        console.warn('[processAIResponse] Auto-retry failed, falling back to text parsing...', retryError)
        // Continue to fallback parsing below
      }
    }

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
          currentCharacterId: market.live2d.current_id,
          filteredAnimations: getFilteredAnimations(market.live2d.animations),
          animationEnrichmentPrompt: prompts.animationEnrichment,
          preserveExistingAnimations: true,
          localUrl: localUrl.value,
          rawResponseText: responseStr,
          characterAnimations: animationCache.value,
          signal: activeAbortController?.signal
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

  // Structural auto-retry: the JSON parsed successfully but the result is semantically
  // empty or broken (empty actions array, choices-only response in Game mode, or both empty).
  // Trigger the same auto-retry mechanism used for invalid JSON parse failures.
  if (invalidJsonAuto.value && !autoRetryAttempted && !isStopped.value) {
    const isEmpty = data.length === 0

    // Game mode: response was choices-only (no actual narrative actions)
    const isChoicesOnlyInGameMode = mode.value === 'game' && data.length > 0 &&
     data.every((a: any) => !a || typeof a !== 'object' || (typeof a.text !== 'string' && typeof a.character !== 'string'))
      && data.some((a: any) => a && typeof a === 'object' && Array.isArray(a.choices) && a.choices.length > 0)

    if (isEmpty || isChoicesOnlyInGameMode) {
      console.warn('[processAIResponse] Auto mode: structural issue detected (empty actions / choices-only), retrying with targeted reminder...')

      const previousToggleValue = invalidJsonToggle.value
      invalidJsonToggle.value = true
      // Use the targeted empty-actions reminder in Game mode instead of the generic one
      if (mode.value === 'game') {
        emptyActionsRetry.value = true
      }

      try {
        setRandomLoadingMessage()
        const retryResponse = await callAI(true)
        invalidJsonToggle.value = previousToggleValue
        emptyActionsRetry.value = false
        await processAIResponse(retryResponse, depth, true)
        return
      } catch (retryError) {
        invalidJsonToggle.value = previousToggleValue
        emptyActionsRetry.value = false
        console.warn('[processAIResponse] Auto-retry (structural) failed, escalating to outer retry loop...', retryError)
        throw new Error('JSON_PARSE_ERROR')
      }
    }
  }

  // If we got through all retry logic but still have no actions, escalate to the outer
  // retry loop. This prevents silently showing a blank result when the model returns
  // empty arrays.
  if (data.length === 0) {
    console.warn('[processAIResponse] No actions after all processing/retries, escalating to outer retry loop...')
    throw new Error('JSON_PARSE_ERROR')
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
  if (needsSearch.length > 0 && !isStopped.value) {
    if (depth >= 2) {
      logDebug('[processAIResponse] needs_search detected but recursion limit reached:', needsSearch)
    } else {
      logDebug('[processAIResponse] Detected needs_search directive(s):', needsSearch)
      const webSearchPerformed = await wrappedSearchForCharacters(needsSearch)
      setRandomLoadingMessage()
      // Only regenerate if web search was actually performed
      if (webSearchPerformed && !isStopped.value) {
        logDebug('[processAIResponse] Web search performed, regenerating...')
        const followUp = await callAIWithoutSearch(false)
        await processAIResponse(followUp, depth + 1)
        return
      } else {
        logDebug('[processAIResponse] All characters found locally, continuing with original response.')
      }
    }
  }

  // Ensure narration/dialogue separation even when the model returns a single mixed text step.
  data = sanitizeActions(data)

  data = filterEchoedUserChoiceDialogueInGameMode(data, lastPrompt.value, mode.value === 'game')
  data = stripChoicesWhenNotGameMode(data, mode.value === 'game')

  // Truncate extremely long sequences that look like hallucinations
  if (data.length > 25 && mode.value !== 'story') {
    logDebug('[processAIResponse] Sequence too long, likely hallucination. Truncating.')
    data = data.slice(0, 25)
  } else if (data.length > 75 && mode.value === 'story') {
    logDebug('[processAIResponse] Sequence too long, likely hallucination. Truncating.')
    data = data.slice(0, 75)
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
  return getCharacterDisplayName(id, market.live2d.current_id, rosterRows.value, characterCatalog)
}

// Get the base character name (e.g., "Neon" from "Neon Bling Bullet")
const getBaseCharacterName = (id: string): string | null => {
  return getBaseCharacterDisplayName(id, market.live2d.current_id, rosterRows.value, characterCatalog)
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
        const variantKey = Object.keys(variantCharacterProfiles).find((k) => k.toLowerCase() === charName.toLowerCase())
        const resolvedKey = variantKey || localKey
        if (resolvedKey) {
          logDebug(`[AI Memory] Found local profile for '${charName}' (matched '${resolvedKey}'). IGNORING AI memory and loading local profile instead.`)

          const localProfile = variantKey ? (variantCharacterProfiles as any)[resolvedKey] : (localCharacterProfiles as any)[resolvedKey]
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

        // Add id from l2d.json if available
        const char = l2d.find((c) => c.name.toLowerCase() === charName.toLowerCase())
        if (char) {
          cleanedProfile.id = char.id
        }

        // Lookup color from local profiles even if full profile isn't used.
        // Variant color takes priority over base character color.
        const localColorKey = Object.keys(localCharacterProfiles).find((k) => k.toLowerCase() === charName.toLowerCase())
        const variantColorKey = Object.keys(variantCharacterProfiles).find((k) => k.toLowerCase() === charName.toLowerCase())
        const localProfile = localColorKey ? (localCharacterProfiles as any)[localColorKey] : null
        const variantProfile = variantColorKey ? (variantCharacterProfiles as any)[variantColorKey] : null
        const colorSource = variantProfile || localProfile
        if (colorSource?.color) {
          cleanedProfile.color = colorSource.color
        }

        newProfiles[charName] = cleanedProfile
      } else {
        newProfiles[charName] = profile
      }
    }

    if (Object.keys(newProfiles).length > 0) {
      characterProfiles.value = { ...characterProfiles.value, ...newProfiles }
      syncRosterFromProfiles(Object.keys(newProfiles), 'ai')
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
        const resolvedRosterId = resolveCharacterIdFromInput(data.character, rosterRows.value, characterCatalog)
        if (resolvedRosterId) {
          data.character = resolvedRosterId
          effectiveCharId = resolvedRosterId
        }
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
      // Use base character name (not skin variant) for NIKKE overlay
      const baseName = data.speaking ? getBaseCharacterName(effectiveCharId) || '' : ''
      nikkeCurrentSpeaker.value = baseName

      // Get color from character profile (try full name first for variants, then fall back to base name)
      const fullName = getCharacterName(effectiveCharId) || baseName
      const profile = effectiveCharacterProfiles.value[fullName] || effectiveCharacterProfiles.value[baseName]
      const localProfile = (localCharacterProfiles as Record<string, any>)[fullName] || (localCharacterProfiles as Record<string, any>)[baseName]
      const variantProfile = (variantCharacterProfiles as Record<string, any>)[fullName] || (variantCharacterProfiles as Record<string, any>)[baseName]
      nikkeSpeakerColor.value = variantProfile?.color || localProfile?.color || profile?.color || '#ffffff'

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

      if (effectiveCharId === 'commander') {
        // Commander speaking - use properly capitalized name
        name = 'Commander'
      } else if (effectiveCharId === 'none') {
        // In Story Mode, 'none' with speaking means a non-roster NPC is speaking.
        // Try to extract the speaker name from the text itself (e.g. "Guard: Halt!" or "**Guard:** Halt!").
        if (mode.value === 'story') {
          const speakerLabelMatch = content.match(/^\s*(?:\*\*\s*)?([^*:]+?)(?:\s*\*\*)?\s*:\s*/)
          if (speakerLabelMatch) {
            // The text already has a speaker label — use it as the name and don't prepend another
            name = speakerLabelMatch[1].trim()
          }
          // If no speaker label found, name stays null — no label will be prepended
        }
      } else {
        // Use base character name (not skin variant) for display
        name = getBaseCharacterName(effectiveCharId)
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
    summarizationSuccessCount.value = 0
    summaryJustCompacted.value = false
    isLoadedSession.value = false
    lastPrompt.value = ''
    market.live2d.isVisible = false
    selectedMessageIndex.value = null
    nikkeOverlayVisible.value = false
    rosterRows.value = []
  }
}

/**
 * Count how many messages to keep as overlap after summarization,
 * based on OVERLAP_TURNS full conversational turns (a turn = one user
 * message plus all following non-user messages).
 */
const getOverlapMessageCount = (summarizeUpTo: number): number => {
  let count = 0
  let turns = 0
  for (let i = summarizeUpTo - 1; i >= lastSummarizedIndex.value && turns < OVERLAP_TURNS; i--) {
    count++
    if (chatHistory.value[i].role === 'user') {
      turns++
    }
  }
  return count
}

const summarizeChunk = async (messages: { role: string; content: string }[]): Promise<boolean> => {
  if (messages.length === 0) return true

  loadingStatus.value = 'Summarizing story so far...'

  try {
    const summary = await summarizeChunkImpl(messages, {
      apiProvider: apiProvider.value,
      apiKey: apiKey.value,
      model: model.value,
      localUrl: localUrl.value,
      prompts,
      enableContextCaching: enableContextCaching.value,
      reasoningEffort: reasoningEffort.value,
      signal: activeAbortController?.signal,
      existingSummary: storySummary.value
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

const performCompaction = async (): Promise<boolean> => {
  if (!storySummary.value || storySummary.value.length < COMPACT_MIN_LENGTH) return false

  loadingStatus.value = 'Compacting story summary...'

  try {
    const compacted = await compactSummaryImpl(storySummary.value, {
      apiProvider: apiProvider.value,
      apiKey: apiKey.value,
      model: model.value,
      localUrl: localUrl.value,
      prompts,
      enableContextCaching: enableContextCaching.value,
      reasoningEffort: reasoningEffort.value,
      signal: activeAbortController?.signal
    })

    if (compacted && compacted.trim().length > 0) {
      storySummary.value = compacted
      summaryJustCompacted.value = true
      return true
    }
    return false
  } catch (e) {
    console.error('Failed to compact summary:', e)
    return false
  }
}

const handleCompactSummary = async () => {
  if (isCompactSummaryDisabled.value) return

  isLoading.value = true
  activeAbortController = new AbortController()

  try {
    const ok = await performCompaction()
    if (ok) {
      loadingStatus.value = 'Summary compacted successfully.'
    } else {
      loadingStatus.value = 'Failed to compact summary.'
    }
  } finally {
    isLoading.value = false
    activeAbortController = null
    setTimeout(() => {
      loadingStatus.value = ''
    }, 2000)
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: clamp(4px, calc(var(--chat-width, 400px) * 0.015), 8px);
  row-gap: 8px;
  margin-top: 0;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.story-character-inline {
  order: 1;
  flex: 1 1 0;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.session-controls > .n-popover {
  order: 0;
  margin-left: 0;
  flex-shrink: 0;
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

.story-character-roster {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.story-character-inline {
  display: flex;
  flex-direction: column;
  gap: clamp(4px, calc(var(--chat-height, 600px) * 0.012), 8px);
  min-width: min(260px, calc(var(--chat-width, 400px) * 0.7));
  flex: 1 1 min(520px, calc(var(--chat-width, 400px) * 1.3));
  padding-top: 4px;
  max-width: 100%;
}

.character-option-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: rgba(0, 0, 0, 0.3);
}

.character-option-disabled:hover {
  background-color: rgba(0, 0, 0, 0.3);
}

.story-character-inline-header {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  padding-bottom: 4px;
}

.story-character-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  container-type: inline-size;
  max-width: 100%;
  overflow-x: hidden;
}

.story-character-select {
  min-width: 0;
  width: 100%;
}

.story-character-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  align-items: center;
  max-width: 100%;
}

.story-character-row.compact {
  grid-template-columns: 1fr;
  gap: 6px;
  max-width: 100%;
}

/* Two-column layout when chat is wide enough */
@container (min-width: 480px) {
  .story-character-row.compact {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto minmax(60px, auto);
    gap: 6px;
    max-width: 100%;
  }

  .story-character-row.compact > * {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }
}

.problems-popover-content {
  display: flex;
  flex-direction: column;
  gap: clamp(4px, calc(var(--chat-height, 600px) * 0.015), 10px);
  padding: clamp(4px, calc(var(--chat-width, 400px) * 0.015), 8px);
  min-width: min(150px, calc(var(--chat-width, 400px) * 0.4));
  max-width: min(350px, calc(var(--chat-width, 400px) * 0.9));
}

.problems-popover-header {
  font-weight: 600;
  font-size: clamp(10px, calc(var(--chat-width, 400px) * 0.03), 12px);
  opacity: 0.7;
  border-bottom: 1px solid var(--n-border-color);
  padding-bottom: 4px;
  margin-bottom: 2px;
}

.problems-popover-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(4px, calc(var(--chat-width, 400px) * 0.02), 8px);
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .story-character-row {
    grid-template-columns: 1fr;
  }

  .story-character-row.compact {
    grid-template-columns: 1fr;
  }

  .story-character-select {
    min-width: 100%;
  }

  .story-character-inline {
    min-width: 100%;
    flex: 1 1 auto;
  }

  .problems-popover-content {
    min-width: min(200px, 80vw);
    max-width: 90vw;
    gap: 6px;
  }

  .problems-popover-row {
    gap: 4px;
  }
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
