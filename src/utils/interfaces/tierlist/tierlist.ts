import type { tier } from '@/utils/interfaces/tierlist/tier'

export interface tierlist {
    name: string
    author: string
    tiers: tier[],
    benchTier: tier //bench tier will be for characters not in the tier list yet
    print_NikkeDB: boolean
    printBenchTier: boolean
}
