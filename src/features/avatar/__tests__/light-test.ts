import {
  defaultLight,
  lightDirection,
  lightFromHandlePosition,
  lightHandlePosition,
  type Light,
} from '@/features/avatar/light'

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

describe('light handle position', () => {
  it('places the handle at the center when elevation is at zenith', () => {
    const [x, y] = lightHandlePosition({ azimuth: 0, elevation: 90, intensity: 1 })
    expect(x).toBeCloseTo(0, 5)
    expect(y).toBeCloseTo(0, 5)
  })

  it('places the handle on the ring edge when elevation is at the horizon', () => {
    const [x, y] = lightHandlePosition({ azimuth: 0, elevation: 0, intensity: 1 }, 30)
    expect(Math.hypot(x, y)).toBeCloseTo(30, 5)
  })

  it('round-trips azimuth and elevation through the handle position', () => {
    const light: Light = { azimuth: 40, elevation: 25, intensity: 0.6 }
    const handle = lightHandlePosition(light, 30)
    const recovered = lightFromHandlePosition(handle, light.intensity, 30)
    expect(recovered.azimuth).toBeCloseTo(light.azimuth, 4)
    expect(recovered.elevation).toBeCloseTo(light.elevation, 4)
  })

  it('clamps a handle dragged outside the ring back onto its edge', () => {
    const light = lightFromHandlePosition([1000, 1000], 1, 30)
    expect(light.elevation).toBeGreaterThanOrEqual(0)
    expect(Math.hypot(...lightHandlePosition(light, 30))).toBeCloseTo(30, 5)
  })
})
