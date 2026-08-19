import { createBodyNode } from '@/features/avatar/body'
import { materialsFromColors } from '@/features/avatar/avatars'
import { renderAvatar, poseFromExpression } from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import {
  createRenderedColors,
  createRenderedScene,
  findBodyNodePath,
  paintRenderedColors,
  paintRenderedScene,
} from '@/features/rendering/renderedScene'
import { surfacePresets } from '@/features/avatar/surfaces'
import defaultStudioDocument from '@/features/studio/defaultStudioDocument.json'
import type { BodyNode } from '@/features/avatar/body'
import type { Expression } from '@/features/avatar/geometry'
import type { SurfaceConfig } from '@/features/avatar/surfaces'

describe('rendered avatar scene', () => {
  it('keeps layer identity and hit mapping behind the scene seam', () => {
    const node = createBodyNode('sphere', 0)
    const first = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      bodyNodes: [node],
    })
    const scene = createRenderedScene(first)
    const rotated = renderAvatar(
      poseFromExpression({ ...defaultExpression, headY: 35 }),
      surfacePresets.sphere,
      1,
      { bodyNodes: [node] }
    )

    paintRenderedScene(scene, rotated)

    expect(findBodyNodePath(scene, 'primary')).toBe(scene.headPath)
    expect(findBodyNodePath(scene, node.id)).not.toBeNull()
    expect(scene.headPath.get()).toBe(rotated.headPath)
  })

  it('updates animated colors without replacing their motion values', () => {
    const node = createBodyNode('sphere', 0)
    const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      bodyNodes: [node],
    })
    const materials = materialsFromColors({ body: '#5b7fe5', eyes: '#111316' })
    const colors = createRenderedColors(materials, geometry)
    const headFill = colors.headFill
    const eyeFill = colors.eyeFill
    const headFillValueBefore = headFill.get()

    const brighterMaterials = materialsFromColors({ body: '#c53b47', eyes: '#ffffff' })
    paintRenderedColors(colors, brighterMaterials, geometry)

    expect(colors.headFill).toBe(headFill)
    expect(colors.eyeFill).toBe(eyeFill)
    expect(colors.headFill.get()).not.toBe(headFillValueBefore)
  })

  it('tints each accessory fill independently based on its own light value', () => {
    const facingNode = { ...createBodyNode('sphere', 0), position: [0, 0, 90] as const }
    const awayNode = { ...createBodyNode('sphere', 1), position: [0, 0, -90] as const }
    const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      bodyNodes: [facingNode, awayNode],
      light: { azimuth: 0, elevation: 0, intensity: 1 },
    })
    const materials = materialsFromColors({ body: '#5b7fe5', eyes: '#111316' })
    const colors = createRenderedColors(materials, geometry)
    const allFills = [...colors.backFills, ...colors.frontFills].map(fill => fill.get())
    expect(new Set(allFills.filter(Boolean)).size).toBeGreaterThan(1)
  })

  it('gives the wireframe a tinted stroke instead of a hardcoded colour', () => {
    const geometry = renderAvatar(
      poseFromExpression(defaultExpression),
      surfacePresets.sphere,
      1,
      {}
    )
    const materials = materialsFromColors({ body: '#5b7fe5', eyes: '#111316' })
    const colors = createRenderedColors(materials, geometry)
    expect(colors.wireStrokes.length).toBe(geometry.wirePaths.length)
    colors.wireStrokes.forEach(stroke => expect(stroke.get()).toMatch(/^#[0-9a-f]{6}$/i))
  })

  it('keeps Cloudee accessories behind the eyes at expression position 05', () => {
    const avatar = defaultStudioDocument.library.avatars.find(item => item.name === 'Cloudee')!
    const expression = defaultStudioDocument.expressions[5] as Expression

    const geometry = renderAvatar(
      poseFromExpression(expression),
      avatar.body.primary as SurfaceConfig,
      1,
      { bodyNodes: avatar.body.nodes as BodyNode[] }
    )

    expect(geometry.frontNodeIds).toEqual([])

    const clearlyTurned = renderAvatar(
      poseFromExpression({ ...expression, headY: -35 }),
      avatar.body.primary as SurfaceConfig,
      1,
      { bodyNodes: avatar.body.nodes as BodyNode[] }
    )
    expect(clearlyTurned.frontNodeIds).toContain('shape-d4b4e8ad-8625-488d-920c-c497da226f9f')
  })
})
