import {
  createBodyNode,
  defaultLight,
  fitPartShading,
  lightDirection,
  lightScalar,
  poseFromExpression,
  renderAvatar,
  rotateWithQuaternion,
  shadingValueAt,
  surfacePresets,
  surfaceSampleAt,
  type Expression,
  type Light,
  type SurfaceConfig,
} from '../index'

const neutral: Expression = {
  id: 'neutral',
  headX: 0,
  headY: 0,
  headZ: 0,
  widthLeft: 20,
  widthRight: 20,
  heightLeft: 50,
  heightRight: 50,
  spacing: 35,
  positionXLeft: 0,
  positionXRight: 0,
  positionYLeft: -7,
  positionYRight: -7,
  leftAngle: 0,
  rightAngle: 0,
  perspective: 0,
  eyeMotion: 'none',
  bodyMotion: 'none',
}

// Weighted RMS between a fitted head gradient and per-point diffuse light,
// sampled far more densely than the fit itself.
const headShadingError = (surface: SurfaceConfig, headY: number, light: Light) => {
  const pose = poseFromExpression({ ...neutral, headY })
  const geometry = renderAvatar(pose, surface, 1, { light, shading: true })
  const direction = lightDirection(light)
  let gradientError = 0
  let flatError = 0
  let total = 0
  for (let latitudeIndex = 0; latitudeIndex < 48; latitudeIndex += 1) {
    for (let longitudeIndex = 0; longitudeIndex < 96; longitudeIndex += 1) {
      const latitude = -Math.PI / 2 + ((latitudeIndex + 0.5) / 48) * Math.PI
      const longitude = -Math.PI + ((longitudeIndex + 0.5) / 96) * Math.PI * 2
      const sample = surfaceSampleAt(surface, longitude, latitude)
      const normal = rotateWithQuaternion(pose.orientation, sample.normal)
      if (normal[2] <= 0) continue
      const point = rotateWithQuaternion(pose.orientation, sample.point)
      const truth = lightScalar(
        normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2],
        light
      )
      const weight = Math.cos(latitude) * normal[2]
      gradientError +=
        weight * (shadingValueAt(geometry.shading!.head, [point[0], point[1]]) - truth) ** 2
      flatError += weight * (geometry.headLight - truth) ** 2
      total += weight
    }
  }
  return { gradient: Math.sqrt(gradientError / total), flat: Math.sqrt(flatError / total) }
}

describe('per-part light shading', () => {
  it('is only computed when requested', () => {
    const pose = poseFromExpression(neutral)
    expect(renderAvatar(pose, surfacePresets.sphere).shading).toBeUndefined()
    expect(renderAvatar(pose, surfacePresets.sphere, 1, { shading: true }).shading).toBeDefined()
  })

  it('aligns gradients with the head, back and front paths', () => {
    const nodes = [
      { ...createBodyNode('sphere', 0), position: [0, 0, 90] as const },
      { ...createBodyNode('capsule', 1), position: [90, 0, -90] as const },
    ]
    const geometry = renderAvatar(poseFromExpression(neutral), surfacePresets.mickey, 1, {
      bodyNodes: nodes,
      shading: true,
    })
    expect(geometry.shading!.back).toHaveLength(geometry.backPaths.length)
    expect(geometry.shading!.front).toHaveLength(geometry.frontPaths.length)
    // Mickey ears belong to the primary surface and continue its gradient.
    expect(geometry.shading!.back[0]).toBe(geometry.shading!.head)
  })

  it('places the brightest point toward the light and darkens away from it', () => {
    const light: Light = { azimuth: 90, elevation: 0, intensity: 1 }
    const shading = renderAvatar(poseFromExpression(neutral), surfacePresets.sphere, 1, {
      light,
      shading: true,
    }).shading!.head
    const radius = surfacePresets.sphere.width / 2
    expect(shadingValueAt(shading, [radius * 0.8, 0])).toBeGreaterThan(
      shadingValueAt(shading, [0, 0])
    )
    expect(shadingValueAt(shading, [0, 0])).toBeGreaterThan(
      shadingValueAt(shading, [-radius * 0.8, 0])
    )
  })

  it('keeps stops within the 0..1 light range and in offset order', () => {
    const geometry = renderAvatar(poseFromExpression(neutral), surfacePresets.cube, 1, {
      light: defaultLight,
      shading: true,
    })
    const stops = geometry.shading!.head.stops
    stops.forEach(stop => {
      expect(stop.value).toBeGreaterThanOrEqual(0)
      expect(stop.value).toBeLessThanOrEqual(1)
      expect(stop.offset).toBeGreaterThanOrEqual(0)
      expect(stop.offset).toBeLessThanOrEqual(1)
    })
    stops
      .slice(1)
      .forEach((stop, index) => expect(stop.offset).toBeGreaterThan(stops[index].offset))
  })

  it.each([
    [{ azimuth: -35, elevation: 45, intensity: 0.8 }],
    [{ azimuth: 90, elevation: 0, intensity: 1 }],
    [{ azimuth: 0, elevation: 0, intensity: 1 }],
    [{ azimuth: -60, elevation: 70, intensity: 1 }],
  ])('matches diffuse light on a sphere closely for %o', light => {
    for (const headY of [0, 40]) {
      const error = headShadingError(surfacePresets.sphere, headY, light)
      expect(error.gradient).toBeLessThan(0.05)
      expect(error.gradient).toBeLessThan(error.flat / 3)
    }
  })

  it.each(['capsule', 'cube', 'cylinder', 'cone'] as const)(
    'fits %s light better than a single flat tint',
    type => {
      const light: Light = { azimuth: 90, elevation: 0, intensity: 1 }
      const error = headShadingError(surfacePresets[type], 40, light)
      expect(error.gradient).toBeLessThan(error.flat)
    }
  )

  it('falls back to a flat gradient when no sample faces the camera', () => {
    const shading = fitPartShading(
      [],
      [
        [-10, 0],
        [10, 0],
      ],
      defaultLight,
      1,
      0.4
    )
    expect(shading.stops.every(stop => stop.value === 0.4)).toBe(true)
  })
})
