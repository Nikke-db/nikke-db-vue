import type { character } from '@/utils/interfaces/tierlist/character'

export interface tier {
    name: string
    color_bg: string
    color_name: string
    subtext: string
    items: character[]
}
