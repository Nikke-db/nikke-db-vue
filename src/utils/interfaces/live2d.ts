export interface live2d_interface {
  name: string
  id: string
  tl: string
}

export interface AttachmentItemColorInterface {
  r: number,
  b: number,
  g: number,
  a: number
}
export interface AttachmentItemInterface {
  bones: number[],
  color: AttachmentItemColorInterface,
  name: string
}

export interface AttachmentInterface {
  [key: string]: AttachmentItemInterface
}

export interface RailStyleInterface {
  focused: boolean,
  checked: boolean
}