export interface route2DisplayInterface {
  path: string
  text: string
  mobile: boolean
}

export const ROUTES: route2DisplayInterface[] = [
  {
    path: 'tools',
    text: 'Tools',
    mobile: true
  },
  {
    path: 'visualiser',
    text: 'Live2D Visualiser',
    mobile: true
  },
  {
    path: 'chibi',
    text: 'Chibi',
    mobile: true
  },
  {
    path: 'gallery',
    text: 'Gallery',
    mobile: true
  },
  {
    path: 'story-gen',
    text: 'Story/Roleplaying Generator',
    mobile: true
  }
  // {
  //   path: 'tierlistmaker',
  //   text: 'Tier List Maker',
  //   mobile: false
  // }
]
