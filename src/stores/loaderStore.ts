import { ref, computed, type Ref } from 'vue'
import { defineStore } from 'pinia'

export const useLoaderStore = defineStore('loader', () => {
  const load = ref("done") as Ref<"done"> | Ref<"loading"> | Ref<"error">

  function beginLoad() {
    load.value = "loading"
  }
  
  function endLoad() {
    load.value = "done"
  }

  function errorLoad() {
    load.value = "error"
  }


  return { load, beginLoad, endLoad, errorLoad }
})
