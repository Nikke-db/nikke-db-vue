const rand = (max: number) => {
  return Math.floor(Math.random() * max)
}

const rgb2hex = (r: number, g: number, b: number) => {
  let rr = r.toString(16)
  let gg = g.toString(16)
  let bb = b.toString(16)

  if (rr.length === 1) rr = '0' + rr
  if (gg.length === 1) gg = '0' + gg
  if (bb.length === 1) bb = '0' + bb

  return '#' + rr + gg + bb
}

const returnRandomHex = () => {
  const r = rand(255)
  const g = rand(255)
  const b = rand(255)
  return rgb2hex(r, g, b)
}

export { rand, rgb2hex, returnRandomHex }