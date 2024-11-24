export interface galleryItemInterface {
  name: string,
  text: string
}

export interface galleryInterface {
  path: string,
  type: string,
  title: string,
  id: string,
  content: galleryItemInterface[],
  notice: string | null
}