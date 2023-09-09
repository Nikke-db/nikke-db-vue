import { defineStore } from 'pinia'
import { useLoaderStore } from './loaderStore'
import { useGlobalParamsStore } from './globalParamsStore'
import { useRoute } from 'vue-router'

export const useMarket = defineStore('market', () => {

    const load = useLoaderStore()
    const globalParams = useGlobalParamsStore()
    const route = useRoute()

    return { load, globalParams, route }
})
