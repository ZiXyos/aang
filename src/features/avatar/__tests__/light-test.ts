import { defaultLight, lightDirection, type Light } from '@/features/avatar/light'

describe('light direction', () => {
  it('points toward the camera and slightly right/above for the default light', () => {
    const direction = lightDirection(defaultLight)
    expect(direction[2]).toBeGreaterThan(0)
    expect(direction[0]).toBeLessThan(0)
    expect(direction[1]).toBeLessThan(0)
  })

  it('returns a unit vector for any azimuth/elevation', () => {
    const light: Light = { azimuth: 130, elevation: -20, intensity: 1 }
    const [x, y, z] = lightDirection(light)
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
  })

  it('points straight down the camera axis when azimuth and elevation are zero', () => {
    const [x, y, z] = lightDirection({ azimuth: 0, elevation: 0, intensity: 1 })
    expect(x).toBeCloseTo(0, 5)
    expect(y).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(1, 5)
  })
})
