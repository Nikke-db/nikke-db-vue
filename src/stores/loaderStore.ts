import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'

export const useLoaderStore = defineStore('loader', () => {
  const load = ref("done") as Ref<"done" | "loading" | "error">

  const beginLoad = () => {
    load.value = "loading"
  }
  
  const endLoad = () => {
    load.value = "done"
  }

  const errorLoad = () => {
    load.value = "error"
  }

  return { load, beginLoad, endLoad, errorLoad }
})
