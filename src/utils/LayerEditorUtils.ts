import type { AttachmentItemColorInterface, AttachmentInterface } from '@/utils/interfaces/live2d'

export interface layerEditorImportableInterface {
  author: string,
  description: string,
  date: number,
  cid: string,
  pose: 'fb' | 'cover' | 'aim' | 'temp',
  exportVersion: number
  layers: {
      [key: string]: AttachmentItemColorInterface | string
    }[]


}

// TODO : export this and replace the one in AttachmentEditor.vue
const grabKey = (item: AttachmentInterface) => {
  const keys = Object.keys(item)
  return keys[0]
}


export const getExportableContent = (cid: string, pose: 'fb' | 'cover' | 'aim' | 'temp', layers: AttachmentInterface[]) => {
  const content: layerEditorImportableInterface = {
    author: 'Default',
    description: 'Layer edition of a character on Nikke-DB. Do not modify a single field besides author and description.',
    date: new Date().getTime(),
    cid: cid,
    pose: pose,
    exportVersion: 1,
    layers: []
  }

  layers.forEach((l: AttachmentInterface) => {
    if (l === undefined) content.layers.push({ 'undefined' : 'undefined' })
    else {
      content.layers.push({
        [grabKey(l)]: { ...l[grabKey(l)].color }
      })
    }
  })

  return content
}

export const getImportedContentV1 = (file: File) => {
  return new Promise<layerEditorImportableInterface>((resolve) => {
    const fr = new FileReader()
    fr.readAsText(file)
    fr.onload = () => {
      resolve(JSON.parse(fr.result as string))
    }
  })
}

export const getKeyOfContentByString = (content: layerEditorImportableInterface, key: string) => {

  const foundLayer = content.layers.find((l) => {
    return Object.keys(l)[0] === key
  })

  if (foundLayer !== undefined) {
    return foundLayer[key] as AttachmentItemColorInterface
  }
}