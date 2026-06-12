<template>
  <transition name="fade">
    <div v-if="chatMode === 'nikke' && nikkeOverlayVisible" class="nikke-chat-overlay" :class="{ passthrough: nikkeOverlayPassthrough }">
      <div class="nikke-vignette"></div>

      <div class="nikke-overlay-controls">
        <n-button type="error" circle @mousedown.stop="emit('stop')" @touchstart.stop="emit('stop')" title="Stop Generation">
          <template #icon><n-icon><Close /></n-icon></template>
        </n-button>
      </div>

      <div v-if="nikkeCurrentSpeaker" class="nikke-dialogue-container">
        <div class="nikke-speaker-name">
          <div class="nikke-speaker-indicator" :style="{ backgroundColor: nikkeSpeakerColor }"></div>
          <span>{{ nikkeCurrentSpeaker }}</span>
        </div>
        <div class="nikke-dialogue-text">{{ nikkeDisplayedText }}</div>
      </div>

      <div v-else class="nikke-narration-container">
        <div class="nikke-narration-text">{{ nikkeDisplayedText }}</div>
        <div class="nikke-narration-indicator">▼</div>
      </div>

      <transition name="fade">
        <div v-if="gameChoices.length > 0" class="game-choices-overlay">
          <div class="choices-container">
            <div v-for="(choice, index) in gameChoices" :key="index" class="choice-btn" @click="emit('game-choice', choice)">
              <div class="choice-marker"></div>
              <span class="choice-text">{{ (choice.text || (choice as any).label || '').replace(/^["']|["']$/g, '') }}</span>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { NIcon, NButton } from 'naive-ui'
import { Close } from '@vicons/carbon'

defineProps<{
  chatMode: string
  nikkeOverlayVisible: boolean
  nikkeOverlayPassthrough: boolean
  nikkeCurrentSpeaker: string
  nikkeDisplayedText: string
  nikkeSpeakerColor: string
  gameChoices: { text: string; type?: 'dialogue' | 'action'; label?: string }[]
}>()

const emit = defineEmits<{
  'stop': []
  'game-choice': [choice: any]
}>()
</script>

<style scoped lang="less">
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
  align-items: center;
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
  font-size: 1.3em;
  font-weight: 700;
  margin-bottom: 16px;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  width: 100%;
  max-width: 800px;

  @media (max-width: 1024px) {
    font-size: 1.1em;
    margin-bottom: 8px;
    max-width: 700px;
  }

  @media (max-width: 834px) {
    max-width: none;
  }
}

.nikke-speaker-indicator {
  width: 5px;
  height: 1.1em;
  background-color: #ffeb3b;
  box-shadow: 0 0 10px rgba(255, 235, 59, 0.4);
}

.nikke-dialogue-text {
  font-size: 1.4em;
  line-height: 1.6;
  white-space: pre-wrap;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  font-weight: 400;
  word-break: break-word;
  width: 100%;
  max-width: 800px;
  text-align: left;

  @media (max-width: 1024px) {
    font-size: 1.1em;
    line-height: 1.4;
    max-width: 700px;
  }

  @media (max-width: 834px) {
    font-size: 1em;
    line-height: 1.35;
    max-width: none;
  }
}

.nikke-narration-container {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  max-width: 80%;
  min-height: 120px;
  background: rgba(0, 0, 0, 0.75);
  padding: 24px 32px;
  border-radius: 4px;
  z-index: 9002;
  pointer-events: auto;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 1024px) {
    width: 700px;
    max-width: 90%;
    padding: 20px 24px;
    bottom: 100px;
    min-height: 100px;
  }

  @media (max-width: 834px) {
    width: 100%;
    max-width: 95%;
    padding: 16px 20px;
    bottom: 80px;
    min-height: 80px;
  }
}

.nikke-narration-text {
  color: white;
  font-size: 1.4em;
  line-height: 1.6;
  text-align: left;
  white-space: pre-wrap;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  font-weight: 400;
  word-break: break-word;
  width: 100%;

  @media (max-width: 1024px) {
    font-size: 1.1em;
    line-height: 1.4;
  }

  @media (max-width: 834px) {
    font-size: 1em;
    line-height: 1.35;
  }
}

.nikke-narration-indicator {
  position: absolute;
  bottom: 8px;
  right: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8em;
  line-height: 1;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
</style>