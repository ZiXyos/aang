import { motionValue, type MotionValue } from 'motion'

import {
  BODY_MATERIAL_ID,
  EYES_MATERIAL_ID,
  WIRE_MATERIAL_ID,
  materialColour,
  type Material,
} from '../avatar/avatars'
import { MAX_BODY_NODES } from '../avatar/body'
import type { AvatarGeometry } from '../avatar/geometry'
import { tintColor } from './materialTint'

export type RenderedScene = {
  headPath: MotionValue<string>
  backPaths: MotionValue<string>[]
  frontPaths: MotionValue<string>[]
  backNodeIds: { current: (string | null)[] }
  frontNodeIds: { current: (string | null)[] }
  leftPath: MotionValue<string>
  rightPath: MotionValue<string>
  leftOpacity: MotionValue<number>
  rightOpacity: MotionValue<number>
  offsetX: MotionValue<number>
  offsetY: MotionValue<number>
  wirePaths: MotionValue<string>[]
}

/**
 * The avatar's two untinted palette colours. The pixel renderer quantizes every
 * pixel to exactly one of these, so it needs the flat palette rather than the
 * per-part tinted fills in RenderedColors.
 */
export type RenderedPalette = {
  body: MotionValue<string>
  eyes: MotionValue<string>
}

export type RenderedColors = {
  headFill: MotionValue<string>
  backFills: MotionValue<string>[]
  frontFills: MotionValue<string>[]
  eyeFill: MotionValue<string>
  wireStrokes: MotionValue<string>[]
}

const bodyPathSlots = MAX_BODY_NODES + 2

export const createRenderedScene = (geometry: AvatarGeometry): RenderedScene => ({
  headPath: motionValue(geometry.headPath),
  backPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.backPaths[index] ?? '')
  ),
  frontPaths: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(geometry.frontPaths[index] ?? '')
  ),
  backNodeIds: { current: geometry.backNodeIds },
  frontNodeIds: { current: geometry.frontNodeIds },
  leftPath: motionValue(geometry.leftPath),
  rightPath: motionValue(geometry.rightPath),
  leftOpacity: motionValue(geometry.leftVisible ? 1 : 0),
  rightOpacity: motionValue(geometry.rightVisible ? 1 : 0),
  offsetX: motionValue(0),
  offsetY: motionValue(0),
  wirePaths: geometry.wirePaths.map(path => motionValue(path)),
})

const tintedBodyColour = (materials: Material[], light: number) =>
  tintColor(materialColour(materials, BODY_MATERIAL_ID, '#5b7fe5'), light)

export const createRenderedColors = (
  materials: Material[],
  geometry: AvatarGeometry
): RenderedColors => ({
  headFill: motionValue(tintedBodyColour(materials, geometry.headLight)),
  backFills: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(
      geometry.backLight[index] !== undefined
        ? tintedBodyColour(materials, geometry.backLight[index])
        : ''
    )
  ),
  frontFills: Array.from({ length: bodyPathSlots }, (_, index) =>
    motionValue(
      geometry.frontLight[index] !== undefined
        ? tintedBodyColour(materials, geometry.frontLight[index])
        : ''
    )
  ),
  eyeFill: motionValue(
    tintColor(materialColour(materials, EYES_MATERIAL_ID, '#111316'), geometry.headLight)
  ),
  wireStrokes: geometry.wirePaths.map(() =>
    motionValue(
      tintColor(materialColour(materials, WIRE_MATERIAL_ID, '#c9d5ff'), geometry.wireLight)
    )
  ),
})

export const paintRenderedColors = (
  rendered: RenderedColors,
  materials: Material[],
  geometry: AvatarGeometry
) => {
  rendered.headFill.set(tintedBodyColour(materials, geometry.headLight))
  rendered.backFills.forEach((fill, index) =>
    fill.set(
      geometry.backLight[index] !== undefined
        ? tintedBodyColour(materials, geometry.backLight[index])
        : ''
    )
  )
  rendered.frontFills.forEach((fill, index) =>
    fill.set(
      geometry.frontLight[index] !== undefined
        ? tintedBodyColour(materials, geometry.frontLight[index])
        : ''
    )
  )
  rendered.eyeFill.set(
    tintColor(materialColour(materials, EYES_MATERIAL_ID, '#111316'), geometry.headLight)
  )
  rendered.wireStrokes.forEach((stroke, index) => {
    if (index >= geometry.wirePaths.length) return
    stroke.set(
      tintColor(materialColour(materials, WIRE_MATERIAL_ID, '#c9d5ff'), geometry.wireLight)
    )
  })
}

export const paintRenderedOffset = (scene: RenderedScene, offset: { x: number; y: number }) => {
  scene.offsetX.set(offset.x)
  scene.offsetY.set(offset.y)
}

export const paintRenderedScene = (scene: RenderedScene, geometry: AvatarGeometry) => {
  scene.headPath.set(geometry.headPath)
  scene.backNodeIds.current = geometry.backNodeIds
  scene.frontNodeIds.current = geometry.frontNodeIds
  scene.backPaths.forEach((path, index) => path.set(geometry.backPaths[index] ?? ''))
  scene.frontPaths.forEach((path, index) => path.set(geometry.frontPaths[index] ?? ''))
  scene.leftPath.set(geometry.leftPath)
  scene.rightPath.set(geometry.rightPath)
  scene.leftOpacity.set(geometry.leftVisible ? 1 : 0)
  scene.rightOpacity.set(geometry.rightVisible ? 1 : 0)
  scene.wirePaths.forEach((path, index) => path.set(geometry.wirePaths[index] ?? ''))
}

export const findBodyNodePath = (scene: RenderedScene, selectedBodyNodeId: 'primary' | string) => {
  if (selectedBodyNodeId === 'primary') return scene.headPath
  const backIndex = scene.backNodeIds.current.indexOf(selectedBodyNodeId)
  if (backIndex >= 0) return scene.backPaths[backIndex]
  const frontIndex = scene.frontNodeIds.current.indexOf(selectedBodyNodeId)
  return frontIndex >= 0 ? scene.frontPaths[frontIndex] : null
}
