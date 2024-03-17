import type { tierlist } from '@/utils/interfaces/tierlist/tierlist'
import l2d from '@/utils/json/l2d.json'
import type { live2d_interface } from '@/utils/interfaces/live2d'
import type { tier } from '@/utils/interfaces/tierlist/tier'
import { returnRandomHex } from '@/utils/utils'
import { globalParams } from '@/utils/enum/globalParams'
import CryptoJS from 'crypto-js'

const initDefaultTierList = (): tierlist => {
  const tierList: tierlist = {
    name: 'Sample Tier List',
    author: 'Koshirei',
    print_NikkeDB: true,
    printBenchTier: true,
    benchTier: initBenchTier(),
    tiers: initDefaultTiers()
  }
  return tierList
}

const initBenchTier = (): tier => {
  const benchTier: tier = initEmptyTier()
  benchTier.name = 'Bench'
  benchTier.subtext = 'Cuties waiting to be tier listed'
  benchTier.color_bg = '#8d96a6'
  benchTier.color_name = '#000000'

  const base_array: live2d_interface[] = l2d
  base_array.forEach((item) => {
    if (item.tl === 'nikke' || item.tl === 'NPC') {
      benchTier.items.push({
        id: item.id,
        name: item.name,
        subtext: ''
      })
    }
  })

  return benchTier
}

const initEmptyTier = (): tier => {
  return {
    name: '',
    subtext: '',
    color_bg: '',
    color_name: '',
    items: []
  }
}

const initTierFromConstructor = (name: string, subtext: string, color_bg: string, color_name: string): tier => {
  return {
    name: name,
    items: [],
    subtext: subtext,
    color_bg: color_bg,
    color_name: color_name
  }
}

const initDefaultTiers = (): tier[] => {
  return [
    initTierFromConstructor('SSS', 'SSS rank', '#32a852', '#050a07'),
    initTierFromConstructor('SS', 'SS rank', '#356296', '#050a07'),
    initTierFromConstructor('S', 'S rank', '#e622d8', '#050a07'),
    initTierFromConstructor('A', 'A rank', '#ecff17', '#050a07')
  ]
}

const randomNewTier = (): tier => {
  return initTierFromConstructor('New Tier', 'New Tier Subtext', returnRandomHex(), returnRandomHex())
}

const saveTierListToLocalStorage = (tierlist: tierlist, slot: number = 0) => {
  const strTier = JSON.stringify(tierlist)
  const aes_encrypt = CryptoJS.AES.encrypt(strTier, globalParams.CRYPTOJS_AES_KEY).toString()
  localStorage.setItem('tierlist_slot' + slot, aes_encrypt)
}

const saveTierListToLocalStorageFromImportText = (importedText: string, slot: number = 0) => {
  localStorage.setItem('tierlist_slot' + slot, importedText)
}

const retrieveTierListFromLocalStorage = (slot: number = 0): tierlist => {
  const localStorageContent = localStorage.getItem('tierlist_slot' + slot)

  try {
    if (localStorageContent === undefined || localStorageContent === null || localStorageContent === '') {
      return initDefaultTierList()
    } else {
      const aes_decrypt = CryptoJS.AES.decrypt(localStorageContent, globalParams.CRYPTOJS_AES_KEY)
      const tierList = JSON.parse(aes_decrypt.toString(CryptoJS.enc.Utf8)) as tierlist

      return tierList
    }
  } catch (e) {
    const defaultTierList = initDefaultTierList()
    saveTierListToLocalStorage(defaultTierList)
    return defaultTierList
  }
}

const checkForMissingCharactersAndAddToBench = (tierlist: tierlist): tierlist => {
  const base_array: live2d_interface[] = l2d

  base_array.forEach((item) => {
    if (item.tl === 'nikke' || item.tl === 'NPC') {
      let shouldAddCharacter = true

      tierlist.tiers.forEach((tier) => {
        if (shouldAddCharacter && tier.items.some((character) => character.id === item.id)) {
          shouldAddCharacter = false
        }
      })

      if (shouldAddCharacter && tierlist.benchTier.items.some((character) => character.id === item.id)) {
        shouldAddCharacter = false
      }

      if (shouldAddCharacter) {
        tierlist.benchTier.items.push({
          id: item.id,
          name: item.name,
          subtext: ''
        })
      }
    }
  })

  tierlist.benchTier.items.sort((a, b) => {
    if (a.id.localeCompare(b.id) > 0) {
      return 1
    } else {
      return -1
    }
  })
  return tierlist
}

export {
  initDefaultTierList,
  randomNewTier,
  saveTierListToLocalStorage,
  retrieveTierListFromLocalStorage,
  checkForMissingCharactersAndAddToBench,
  saveTierListToLocalStorageFromImportText
}