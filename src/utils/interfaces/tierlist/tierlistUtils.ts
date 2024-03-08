import type { tierlist } from '@/utils/interfaces/tierlist/tierlist'
import l2d from '@/utils/json/l2d.json'
import type { live2d_interface } from '@/utils/interfaces/live2d'
import type { tier } from '@/utils/interfaces/tierlist/tier'

const initDefaultTierList = (): tierlist => {
  const tierList: tierlist = {
    name: 'Sample Tier List',
    playerName: 'Koshirei',
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
    benchTier.items.push({
      id: item.id,
      name: item.name,
      subtext: ''
    })
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
    initTierFromConstructor('A', 'A rank', '#ecff17', '#050a07'),
  ]
}

export { initDefaultTierList }