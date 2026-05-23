import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useGlobalParamsStore = defineStore('globalParams', () => {
  const isMobile = ref(true)
  const isMobileHeaderVisible = ref(true)

  // Compact mode: small screens (phones) where the UI needs a dedicated mobile layout
  const isMobileCompact = ref(false)

  const setMobile = () => {
    isMobile.value = true
  }

  const setComputer = () => {
    isMobile.value = false
  }

  const setMobileCompact = (value: boolean) => {
    isMobileCompact.value = value
  }

  const hideMobileHeader = () => {
    isMobileHeaderVisible.value = false
  }

  const showMobileHeader = () => {
    isMobileHeaderVisible.value = true
  }

  return {
    isMobile,
    setMobile,
    setComputer,
    isMobileCompact,
    setMobileCompact,
    isMobileHeaderVisible,
    hideMobileHeader,
    showMobileHeader
  }
})
