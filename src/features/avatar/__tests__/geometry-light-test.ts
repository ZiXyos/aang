import { createBodyNode } from '@/features/avatar/body'
import { renderAvatar, poseFromExpression, partLightIntensity } from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import { surfacePresets } from '@/features/avatar/surfaces'
import type { Light } from '@/features/avatar/light'

describe('per-part light intensity', () => {
  it('scores a part facing the light higher than one facing away', () => {
    const light: Light = { azimuth: 0, elevation: 0, intensity: 1 }
    const facing = partLightIntensity([0, 0, 1], light, 1, 0)
    const away = partLightIntensity([0, 0, -1], light, -1, 0)
    expect(facing).toBeGreaterThan(away)
  })

  it('stays within 0..1 for extreme inputs', () => {
    const light: Light = { azimuth: 45, elevation: 45, intensity: 1 }
    expect(partLightIntensity([0, 0, 0], light, 9999, 9999)).toBeGreaterThanOrEqual(0)
    expect(partLightIntensity([0, 0, 0], light, 9999, 9999)).toBeLessThanOrEqual(1)
  })

  it('includes a light value per part, aligned with the path arrays', () => {
    const node = createBodyNode('sphere', 0)
    const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      bodyNodes: [node],
    })
    expect(typeof geometry.headLight).toBe('number')
    expect(typeof geometry.wireLight).toBe('number')
    expect(geometry.backLight.length + geometry.frontLight.length).toBe(
      geometry.backPaths.length + geometry.frontPaths.length
    )
  })

  it('gives two accessories at different orientations different light values', () => {
    const facingNode = { ...createBodyNode('sphere', 0), position: [0, 0, 90] as const }
    const awayNode = { ...createBodyNode('sphere', 1), position: [0, 0, -90] as const }
    const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      bodyNodes: [facingNode, awayNode],
      light: { azimuth: 0, elevation: 0, intensity: 1 },
    })
    const allLight = [...geometry.backLight, ...geometry.frontLight]
    expect(new Set(allLight).size).toBeGreaterThan(1)
  })
})
