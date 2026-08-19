export type Oklab = readonly [number, number, number]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

const hexToLinearRgb = (hex: string): [number, number, number] => [
  srgbToLinear(parseInt(hex.slice(1, 3), 16) / 255),
  srgbToLinear(parseInt(hex.slice(3, 5), 16) / 255),
  srgbToLinear(parseInt(hex.slice(5, 7), 16) / 255),
]

const linearRgbToHex = ([r, g, b]: [number, number, number]): string => {
  const channel = (value: number) =>
    Math.round(clamp(linearToSrgb(value), 0, 1) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

// Björn Ottosson's OKLab matrices: https://bottosson.github.io/posts/oklab/
const linearRgbToOklab = ([r, g, b]: [number, number, number]): Oklab => {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}

const oklabToLinearRgb = ([L, a, b]: Oklab): [number, number, number] => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export const hexToOklab = (hex: string): Oklab => linearRgbToOklab(hexToLinearRgb(hex))
export const oklabToHex = (lab: Oklab): string => linearRgbToHex(oklabToLinearRgb(lab))

/**
 * Modulates a colour's lightness by a light-facing scalar, holding hue and chroma
 * (ADR-0028: "Colour is modulated in a perceptually uniform space by lightness,
 * holding hue and chroma"). scalar=0 is fully unlit, scalar=1 is fully lit;
 * scalar=0.5 (grazing light) reads close to the authored colour.
 */
export const tintColor = (hex: string, scalar: number): string => {
  const [lightness, a, b] = hexToOklab(hex)
  const factor = 0.55 + clamp(scalar, 0, 1) * 0.65
  return oklabToHex([clamp(lightness * factor, 0, 1), a, b])
}
