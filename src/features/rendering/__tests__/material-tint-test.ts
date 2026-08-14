import { hexToOklab, oklabToHex, tintColor } from '@/features/rendering/materialTint'

describe('material tint', () => {
  it('round-trips a colour through OKLab within rounding error', () => {
    const roundTripped = oklabToHex(hexToOklab('#5b7fe5'))
    expect(roundTripped.toLowerCase()).toBe('#5b7fe5')
  })

  it('darkens a colour facing away from the light and brightens one facing it', () => {
    const base = '#5b7fe5'
    const dark = tintColor(base, 0)
    const bright = tintColor(base, 1)
    expect(hexToOklab(dark)[0]).toBeLessThan(hexToOklab(base)[0])
    expect(hexToOklab(bright)[0]).toBeGreaterThan(hexToOklab(dark)[0])
  })

  it('holds hue and chroma while only lightness changes', () => {
    const base = '#5b7fe5'
    const [, baseA, baseB] = hexToOklab(base)
    const [, tintedA, tintedB] = hexToOklab(tintColor(base, 0.2))
    expect(tintedA).toBeCloseTo(baseA, 2)
    expect(tintedB).toBeCloseTo(baseB, 2)
  })

  it('clamps out-of-range scalars instead of producing invalid colour', () => {
    expect(() => tintColor('#5b7fe5', -5)).not.toThrow()
    expect(() => tintColor('#5b7fe5', 5)).not.toThrow()
  })
})
