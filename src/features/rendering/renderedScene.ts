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
import { SHADING_STOP_COUNT, flatShading, type PartShading } from '../avatar/shading'
import { createTint, tintColor } from './materialTint'

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

/** A per-part light gradient, bound to an SVG radialGradient in user space. */
export type RenderedGradient = {
  cx: MotionValue<number>
  cy: MotionValue<number>
  r: MotionValue<number>
  fx: MotionValue<number>
  fy: MotionValue<number>
  stops: { offset: MotionValue<number>; color: MotionValue<string> }[]
}

export type RenderedColors = {
  headFill: MotionValue<string>
  backFills: MotionValue<string>[]
  frontFills: MotionValue<string>[]
  headShade: RenderedGradient
  backShades: RenderedGradient[]
  frontShades: RenderedGradient[]
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

const bodyColour = (materials: Material[]) => materialColour(materials, BODY_MATERIAL_ID, '#5b7fe5')

const tintedBodyColour = (materials: Material[], light: number) =>
  tintColor(bodyColour(materials), light)

// Geometry rendered without shading still paints a uniform gradient from its flat light.
const shadingOf = (geometry: AvatarGeometry) => ({
  head: geometry.shading?.head ?? flatShading([0, 0], 1, geometry.headLight),
  back: geometry.backLight.map(
    (light, index) => geometry.shading?.back[index] ?? flatShading([0, 0], 1, light)
  ),
  front: geometry.frontLight.map(
    (light, index) => geometry.shading?.front[index] ?? flatShading([0, 0], 1, light)
  ),
})

const createRenderedGradient = (
  shading: PartShading | undefined,
  tint: (scalar: number) => string
): RenderedGradient => ({
  cx: motionValue(shading?.center[0] ?? 0),
  cy: motionValue(shading?.center[1] ?? 0),
  r: motionValue(shading?.radius ?? 1),
  fx: motionValue(shading?.focal[0] ?? 0),
  fy: motionValue(shading?.focal[1] ?? 0),
  stops: Array.from({ length: SHADING_STOP_COUNT }, (_, index) => ({
    offset: motionValue(shading?.stops[index].offset ?? index / (SHADING_STOP_COUNT - 1)),
    color: motionValue(shading ? tint(shading.stops[index].value) : ''),
  })),
})

const paintRenderedGradient = (
  rendered: RenderedGradient,
  shading: PartShading,
  tint: (scalar: number) => string
) => {
  rendered.cx.set(shading.center[0])
  rendered.cy.set(shading.center[1])
  rendered.r.set(shading.radius)
  rendered.fx.set(shading.focal[0])
  rendered.fy.set(shading.focal[1])
  rendered.stops.forEach((stop, index) => {
    stop.offset.set(shading.stops[index].offset)
    stop.color.set(tint(shading.stops[index].value))
  })
}

export const createRenderedColors = (
  materials: Material[],
  geometry: AvatarGeometry
): RenderedColors => {
  const tint = createTint(bodyColour(materials))
  const shading = shadingOf(geometry)
  return {
    headShade: createRenderedGradient(shading.head, tint),
    backShades: Array.from({ length: bodyPathSlots }, (_, index) =>
      createRenderedGradient(shading.back[index], tint)
    ),
    frontShades: Array.from({ length: bodyPathSlots }, (_, index) =>
      createRenderedGradient(shading.front[index], tint)
    ),
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
  }
}

export const paintRenderedColors = (
  rendered: RenderedColors,
  materials: Material[],
  geometry: AvatarGeometry
) => {
  const tint = createTint(bodyColour(materials))
  const shading = shadingOf(geometry)
  paintRenderedGradient(rendered.headShade, shading.head, tint)
  shading.back.forEach((part, index) => {
    const gradient = rendered.backShades[index]
    if (gradient) paintRenderedGradient(gradient, part, tint)
  })
  shading.front.forEach((part, index) => {
    const gradient = rendered.frontShades[index]
    if (gradient) paintRenderedGradient(gradient, part, tint)
  })
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
