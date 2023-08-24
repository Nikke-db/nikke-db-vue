import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useLoaderStore = defineStore('loader', () => {
  const load = ref(false)
  function beginLoad() {
    load.value = true
  }
  function endLoad() {
    load.value = false
  }

  return { load, beginLoad, endLoad }
})
