import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useGlobalParamsStore = defineStore('globalParams', () => {
  const isMobile = ref(true)
  const isMobileHeaderVisibile = ref(true)

  const setMobile = () => {
    isMobile.value = true
  }

  const setComputer = () => {
    isMobile.value = false
  }

  const hideMobileHeader = () => {
    isMobileHeaderVisibile.value = false
  }

  const showMobileHeader = () => {
    isMobileHeaderVisibile.value = true
  }

  return { isMobile, setMobile, setComputer, isMobileHeaderVisibile, hideMobileHeader, showMobileHeader }
})
