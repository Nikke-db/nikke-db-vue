import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { type live2d_interface } from '@/utils/interfaces/live2d'
import l2d from '@/utils/json/l2d.json'
// @ts-ignore
import { RELEASED_UNITS } from '@/utils/json/released_units.js'

export const useLive2dStore = defineStore('live2d', () => {
  const filtered_l2d_Array: Ref<live2d_interface[]> = ref([])
  const current_id = ref('c010') as Ref<string>
  const current_spine_version = ref(4.0) as Ref<number>
  const current_pose = ref('fb') as Ref<'fb' | 'aim' | 'cover'>
  const resetPlacement = ref(0)
  const screenshot = ref(0)

  const fr = new FileReader()

  const customSkel = ref({
    title: '' as string,
    URI: '' as string | ArrayBuffer | null
  })

  const customPng = ref({
    title: '' as string,
    URI: '' as string | ArrayBuffer | null
  })

  const customAtlas = ref({
    title: '' as string,
    URI: '' as string | ArrayBuffer | null
  })

  const customSpineVersion = ref(4.1)
  const customLoad = ref(0)

  const filter = () => {
    const base_array: live2d_interface[] = l2d
    filtered_l2d_Array.value = base_array.sort(
      (a: live2d_interface, b: live2d_interface) => {
        return a.name.localeCompare(b.name)
      }
    )
    filtered_l2d_Array.value = filtered_l2d_Array.value.filter(
      (item: live2d_interface) => {
        return RELEASED_UNITS.includes(item.name)
      }
    )
  }

  const change_current_spine = (newSpine: live2d_interface) => {
    current_spine_version.value = getNewSpineVersion(newSpine)
    current_id.value = newSpine.id
  }

  // exception lists for spine version is handled in loader.vue at spineExceptionList()
  const getNewSpineVersion = (newSpine: live2d_interface) => {
    if (newSpine.version) {
      return newSpine.version
    } else {
      return 4.0
    }
  }

  const triggerResetPlacement = () => {
    resetPlacement.value = new Date().getTime()
  }

  const triggerScreenshot = () => {
    screenshot.value = new Date().getTime()
  }

  const getSkin = () => {
    let skin = ''
    switch (current_pose.value) {
      case 'aim':
        skin = getSkinAim()
        break
      case 'cover':
        skin = getSkinCover()
        break
      default:
        skin = getSkinFb()
        break
    }

    if (current_id.value === 'c010_01' || current_id.value === 'c907_01' ) {
      skin = '00'
    }

    return skin
  }

  const getSkinAim = () => {
    switch (current_id.value) {
      case 'c233':
        return 'part_1'
      default:
        return 'default'
    }
  }

  const getSkinCover = () => {
    switch (current_id.value) {
      case 'c220':
        return 'weapon_2'
      case 'c233':
        return 'part_1'
      default:
        return 'default'
    }
  }

  const getSkinFb = () => {
    switch (current_id.value) {
      case 'c220':
      case 'c102':
      case 'c102_01':
      case 'c940':
      case 'c101_01':
      case 'c350':
      case 'c810':
      case 'c810_01':
      case 'c321':
        return 'acc'
      case 'c015':
      case 'c351':
      case 'c070_02':
      case 'c810_02':
        return 'bg'
      default:
        return 'default'
    }
  }

  const initCustomSkel = (skel: File) => {
    fr.readAsDataURL(skel)
    fr.onload = () => {
      customSkel.value.title = skel.name
      customSkel.value.URI = fr.result
    }
  }

  const initCustomPng = (png: File) => {
    fr.readAsDataURL(png)
    fr.onload = () => {
      customPng.value.title = png.name
      customPng.value.URI = fr.result
    }
  }

  const initCustomAtlas = (atlas: File) => {
    fr.readAsDataURL(atlas)
    fr.onload = () => {
      customAtlas.value.title = atlas.name
      customAtlas.value.URI = fr.result
    }
  }

  const setCustomSpineVersion = (newVersion: number) => {
    customSpineVersion.value = newVersion
  }

  const triggerCustomLoad = () => {
    customLoad.value = new Date().getTime()
  }

  return {
    filtered_l2d_Array,
    current_id,
    filter,
    change_current_spine,
    current_spine_version,
    current_pose,
    resetPlacement,
    triggerResetPlacement,
    screenshot,
    triggerScreenshot,
    getSkin,
    customSkel,
    initCustomSkel,
    customPng,
    initCustomPng,
    customAtlas,
    initCustomAtlas,
    customSpineVersion,
    setCustomSpineVersion,
    customLoad,
    triggerCustomLoad
  }
})
