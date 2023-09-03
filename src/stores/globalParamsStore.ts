import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useGlobalParamsStore = defineStore('globalParams', () => {
  const isMobile = ref(true)
  function setMobile() {
    isMobile.value = true
  }
  function setComputer() {
    isMobile.value = false
  }

  return { isMobile, setMobile, setComputer }
})
