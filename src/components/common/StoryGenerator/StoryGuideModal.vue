<template>
  <n-modal :show="showGuide" :mask-closable="false" preset="card" title="Story/Roleplaying Generator Guide" style="width: 700px; max-width: 95vw" @update:show="(v) => emit('update:showGuide', v)">
    <div class="guide-content">
      <div v-if="guidePage === 1" class="guide-page">
        <h3>🆕 What's New?</h3>
        <div class="guide-section">
          <ul>
            <li>Added the ability to play as different characters (Beta)</li>
            <li>Added OpenCode Go as a new AI provider</li>
            <li>Improved lore awareness with location profiles</li>
            <li>Added a Low-Context Mode for very small models</li>
            <li>Added a Low Power Mode for mobile devices, low-end hardware or to save battery life</li>
            <li>Improved Settings UI and many other significant under-the-hood enhancements</li>
          </ul>
        </div>
      </div>

      <div v-if="guidePage === 2" class="guide-page">
        <h3>🚀 Welcome to the Story Generator</h3>
        <p>Create interactive stories or roleplay scenarios with Nikke characters using your preferred AI LLM.</p>

        <div class="guide-section">
          <h4>🔑 API Setup</h4>
          <ul>
            <li><strong>Providers:</strong> Supports <strong>Gemini</strong>, <strong>OpenCode Go</strong>, <strong>OpenRouter</strong>, <strong>Pollinations</strong>, and <strong>Local</strong> (OpenAI-compatible).</li>
            <li><strong>Privacy:</strong> Your API keys are stored <strong>locally</strong> in your browser and never sent to Nikke-DB.</li>
            <li><strong>Cost:</strong> Be mindful of your provider's usage. You are solely responsible for all costs.</li>
          </ul>
        </div>
      </div>

      <div v-if="guidePage === 3" class="guide-page">
        <h3>🎭 Interaction Modes</h3>
        <div class="guide-section">
          <ul>
            <li>
              <strong>Roleplay Mode:</strong> You play as the Commander by default, or another supported character if selected in Settings. The AI controls the narrative.
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
                <li>The AI narrates, and you choose from generated options for the active player character.</li>
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
            <li><strong>Text-to-Speech (TTS):</strong> Experimental support for various providers, enabling voiced dialogue.</li>
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
            <li><strong>Web Search Fallback:</strong> If the AI doesn't know a character or event, it can search the web (supported by some models) or fetch from the Nikke Wiki directly.</li>
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
            <li><strong>Currently Recommended Models:</strong> GLM-5.1, Claude Sonnet 4.6, Kimi K2.6, Grok 4.3/Grok 4.1 Fast. This is not a complete list.</li>
            <li><strong>Save/Load:</strong> Use the <strong>Save</strong> icon to download your session. You can resume it later by loading the file.</li>
            <li><strong>Context Usage:</strong> Adjust "Tokens Usage" in settings to balance between speed and cost. Default values recommended.</li>
          </ul>
        </div>
      </div>

      <div class="guide-footer">
        <div class="guide-steps">
          <div v-for="p in 6" :key="p" class="guide-step" :class="{ active: guidePage === p }"></div>
        </div>
        <div class="guide-actions">
          <n-button v-if="guidePage > 1" @click="emit('update:guidePage', guidePage - 1)" style="margin-right: 10px">
            <template #icon><n-icon><ChevronLeft /></n-icon></template>
            Back
          </n-button>
          <n-button v-if="guidePage < 6" type="primary" @click="emit('update:guidePage', guidePage + 1)">
            Next
            <template #icon><n-icon><ChevronRight /></n-icon></template>
          </n-button>
          <n-button v-else type="primary" @click="emit('close')">Got it!</n-button>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { NModal, NButton, NIcon } from 'naive-ui'
import { ChevronLeft, ChevronRight } from '@vicons/carbon'

defineProps<{
  showGuide: boolean
  guidePage: number
}>()

const emit = defineEmits<{
  'update:showGuide': [value: boolean]
  'update:guidePage': [value: number]
  'close': []
}>()
</script>

<style scoped>
.guide-content {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  color: #e0e0e0;
}
.guide-content h3 {
  margin-top: 0;
  color: #00eeff;
  font-size: 1.4em;
  border-bottom: 1px solid rgba(0, 238, 255, 0.2);
  padding-bottom: 8px;
  margin-bottom: 16px;
}
.guide-content ul {
  padding-left: 20px;
}
.guide-content ul li {
  margin-bottom: 8px;
  line-height: 1.5;
}
.guide-content code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: #ffeb3b;
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
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>