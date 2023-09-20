import { defineStore } from 'pinia'
import { useLoaderStore } from './loaderStore'
import { useGlobalParamsStore } from './globalParamsStore'
import { useRoute } from 'vue-router'
import { useLive2dStore } from './live2dStore'
import { useMessageStore } from './messageStore'

export const useMarket = defineStore('market', () => {
  const load = useLoaderStore()
  const globalParams = useGlobalParamsStore()
  const live2d = useLive2dStore()
  const route = useRoute()
  const message = useMessageStore()

  return { load, globalParams, live2d, route, message }
})
