import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import { type AttachmentInterface, type live2d_interface } from '@/utils/interfaces/live2d'
import l2d from '@/utils/json/l2d.json'

// that shit long as hell
export const useLive2dStore = defineStore('live2d', () => {
  const filtered_l2d_Array: Ref<live2d_interface[]> = ref([])
  const current_id = ref('c010') as Ref<string>
  const current_pose = ref('fb') as Ref<'fb' | 'aim' | 'cover' | 'temp'>
  const resetPlacement = ref(0)
  const isExportingAnimation = ref(false)
  const exportAnimationTimestamp = ref(0)
  const exportAnimationColoredBackground = ref(true)
  const screenshot = ref(0)
  const hideUI = ref(false)
  const HQassets = ref(true)
  const canAssetTalk = ref(false)
  const canYap = ref(true)
  const yapEnabled = ref(true)
  const isYapping = ref(false)
  const attachments = ref<AttachmentInterface[]>([])
  const animations = ref<string[]>([])
  const current_animation = ref<string>('idle')
  const isVisible = ref(true)
  const updateAttachments = ref(0)
  const applyAttachments = ref(0)
  const selectionAttachments = ref<'select' | 'unselect'>('select')
  const selectAttachments = ref(0)
  const canLoadSpine = ref(true)
  const finishedLoading = ref(0)
  const layerPreviewMode = ref(0)
  const layerEditorPreviewObj = ref({
    index: 0,
    key: '',
    preview : false // false = stop preview, true = previewing
  })

  const fr = new FileReader()

  const customSkel = ref({
    title: '' as string,
    URI: '' as string | ArrayBuffer | null,
    file: null as File | null
  })

  const customPng = ref([{
    title: '' as string,
    URI: '' as string | ArrayBuffer | null,
    file: null as File | null
  }])

  const customAtlas = ref({
    title: '' as string,
    URI: '' as string | ArrayBuffer | null,
    file: null as File | null
  })

  const customSpineVersion = ref(4.1)
  const customPremultipliedAlpha = ref(true)
  const customLoad = ref(0)
  const customDefaultAnimationIdle = ref(true)
  const customLoader = ref<'skel' | 'json'>('skel') // whether the load a skel or json

  const filter = () => {
    const base_array: live2d_interface[] = l2d
    filtered_l2d_Array.value = base_array.sort(
      (a: live2d_interface, b: live2d_interface) => {
        return a.name.localeCompare(b.name)
      }
    )
  }

  const change_current_spine = (newSpine: live2d_interface) => {
    current_id.value = newSpine.id
  }

  const triggerResetPlacement = () => {
    resetPlacement.value = new Date().getTime()
  }

  const triggerScreenshot = () => {
    screenshot.value = new Date().getTime()
  }

  const exportAnimation = () => {
    exportAnimationTimestamp.value = new Date().getTime()
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
      case 'c233_01':
        return 'part_1'
      default:
        return 'default'
    }
  }

  const getSkinCover = () => {
    switch (current_id.value) {
      case 'c220':
      case 'c220_01':
        return 'weapon_2'
      case 'c233':
      case 'c233_01':
      case 'c223':
      case 'c223_01':
        return 'part_1'
      default:
        return 'default'
    }
  }

  const getSkinFb = () => {
    switch (current_id.value) {
      case 'c220':
      case 'c220_01':
      case 'c102':
      case 'c102_01':
      case 'c940':
      case 'c101_01':
      case 'c350':
      case 'c810':
      case 'c810_01':
      case 'c810_03':
      case 'c321':
      case 'c382':
      case 'c382_01':
      case 'c400_01':
      case 'c403':
      case 'c182':
      case 'c354':
      case 'c355':
      case 'c532':
      case 'c043_02':
      case 'c017':
      case 'c074':
        return 'acc'
      case 'c015':
      case 'c351':
      case 'c070_02':
      case 'c810_02':
      case 'c224':
      case 'c430_02':
      case 'c411':
      case 'c481':
      case 'c283':
      case 'c284':
      case 'c321_01':
      case 'c350_02':
      case 'c351_01':
      case 'c470_01':
      case 'c830_02':
      case 'c830_03':
      case 'c831_02':
      case 'c832_02':
      case 'c132':
      case 'c095':
      case 'c095_01':
      case 'c450_02':
      case 'c352_02':
      case 'c832_04':
      case 'c835_02':
      case 'c162_01':
      case 'c222_01':
      case 'c850_03':
      case 'c016_01':
      case 'c272_01':
      case 'c223':
        return 'bg'
      case 'c441':
        return 'acc+bg' // merged acc & bg skins of Avista, by Bingle
      default:
        return 'default'
    }
  }

  const initCustomSkel = (skel: File) => {
    fr.readAsDataURL(skel)
    fr.onload = () => {
      customSkel.value.title = skel.name
      customSkel.value.URI = fr.result
      customSkel.value.file = skel
    }
  }

  const initCustomPng = (png: File) => {
    customPng.value = customPng.value.filter((f) => {
      return f.title !== ''
    })
    const dedicatedPngFr = new FileReader()
    dedicatedPngFr.readAsDataURL(png)
    dedicatedPngFr.onload = () => {
      customPng.value.push({
        title: png.name,
        URI: dedicatedPngFr.result,
        file: png
      })
    }
  }

  const initCustomAtlas = (atlas: File) => {
    fr.readAsDataURL(atlas)
    fr.onload = () => {
      customAtlas.value.title = atlas.name
      customAtlas.value.URI = fr.result
      customAtlas.value.file = atlas
    }
  }

  const setCustomSpineVersion = (newVersion: number) => {
    customSpineVersion.value = newVersion
  }

  const setPremultipliedAlpha = (newBool: boolean) => {
    customPremultipliedAlpha.value = newBool
  }

  const setCustomDefaultAnimationIdle = (newBoolean: boolean) => {
    customDefaultAnimationIdle.value = newBoolean
  }

  const setCustomLoader = (newBoolean: 'skel' | 'json') => {
    customLoader.value = newBoolean
  }

  const triggerCustomLoad = () => {
    customLoad.value = new Date().getTime()
  }

  const triggerHideUI = () => {
    hideUI.value = true
  }

  const triggerShowUI = () => {
    hideUI.value = false
  }

  const triggerUpdateAttachments = () => {
    updateAttachments.value = new Date().getTime()
  }

  const triggerApplyAttachments = () => {
    applyAttachments.value = new Date().getTime()
  }

  const triggerSelectAttachments = () => {
    selectAttachments.value = new Date().getTime()
  }

  const triggerFinishedLoading = () => {
    finishedLoading.value = new Date().getTime()
  }

  const triggerLayerPreviewMode = () => {
    layerPreviewMode.value = new Date().getTime()
  }

  return {
    filtered_l2d_Array,
    current_id,
    filter,
    change_current_spine,
    current_pose,
    resetPlacement,
    triggerResetPlacement,
    screenshot,
    triggerScreenshot,
    isExportingAnimation,
    exportAnimationTimestamp,
    exportAnimationColoredBackground,
    exportAnimation,
    getSkin,
    customSkel,
    initCustomSkel,
    customPng,
    initCustomPng,
    customAtlas,
    initCustomAtlas,
    customSpineVersion,
    setCustomSpineVersion,
    customPremultipliedAlpha,
    setPremultipliedAlpha,
    customDefaultAnimationIdle,
    setCustomDefaultAnimationIdle,
    customLoader,
    setCustomLoader,
    customLoad,
    triggerCustomLoad,
    triggerHideUI,
    triggerShowUI,
    hideUI,
    HQassets,
    canAssetTalk,
    canYap,
    yapEnabled,
    isYapping,
    attachments,
    animations,
    current_animation,
    isVisible,
    updateAttachments,
    applyAttachments,
    triggerUpdateAttachments,
    triggerApplyAttachments,
    triggerSelectAttachments,
    selectAttachments,
    selectionAttachments,
    canLoadSpine,
    finishedLoading,
    triggerFinishedLoading,
    layerEditorPreviewObj,
    layerPreviewMode,
    triggerLayerPreviewMode
  }
})
