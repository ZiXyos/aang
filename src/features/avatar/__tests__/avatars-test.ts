import { defaultExpression } from '@/features/avatar/presets'
import { createInitialSequences } from '@/features/animation/sequences'
import {
  applyAvatarEyeDefaults,
  cloneAvatarBehavior,
  createAvatar,
  defaultAvatarEyes,
  parseAvatarEyeDefaults,
  parseAvatarRenderStyle,
  resolveAvatarBehavior,
} from '@/features/avatar/avatars'
import { initialExpressions } from '@/features/avatar/presets'

describe('avatar eye defaults', () => {
  it('keeps the historical rendering when using default values', () => {
    expect(applyAvatarEyeDefaults(defaultExpression, defaultAvatarEyes)).toEqual(defaultExpression)
  })

  it('composes avatar defaults as variations around the neutral expression', () => {
    const expression = { ...defaultExpression, widthLeft: 28, positionYLeft: 5 }
    const eyes = { ...defaultAvatarEyes, widthLeft: 30, positionYLeft: -12 }

    const result = applyAvatarEyeDefaults(expression, eyes)

    expect(result.widthLeft).toBe(38)
    expect(result.positionYLeft).toBe(0)
    expect(expression.widthLeft).toBe(28)
  })

  it('sanitizes partial persisted values', () => {
    const result = parseAvatarEyeDefaults({ widthLeft: 42, heightRight: Number.NaN })

    expect(result.widthLeft).toBe(42)
    expect(result.heightRight).toBe(defaultAvatarEyes.heightRight)
    expect(result.spacing).toBe(defaultAvatarEyes.spacing)
  })
})

describe('avatar render style', () => {
  it('keeps vector rendering as the compatible default', () => {
    expect(parseAvatarRenderStyle(undefined)).toEqual({ type: 'vector' })
  })

  it('sanitizes pixel settings', () => {
    expect(
      parseAvatarRenderStyle({
        type: 'pixel',
        resolution: 500,
      })
    ).toEqual({
      type: 'pixel',
      resolution: 192,
    })
    expect(parseAvatarRenderStyle({ type: 'pixel', resolution: 1 })).toEqual({
      type: 'pixel',
      resolution: 8,
    })
  })
})

describe('avatar behavior library', () => {
  const base = {
    expressions: initialExpressions,
    sequences: createInitialSequences(),
  }

  it('inherits the base library until the avatar owns a customization', () => {
    const avatar = createAvatar('Strobi')

    expect(resolveAvatarBehavior(avatar, base)).toBe(base)
  })

  it('clones expressions, animations and nested steps as one independent library', () => {
    const behavior = cloneAvatarBehavior(base)

    expect(behavior).not.toBe(base)
    expect(behavior.expressions).not.toBe(base.expressions)
    expect(behavior.sequences).not.toBe(base.sequences)
    expect(behavior.sequences[0].steps).not.toBe(base.sequences[0].steps)
    expect(behavior.sequences[0].blink).not.toBe(base.sequences[0].blink)
  })
})

import {
  materialsFromColors,
  materialColour,
  BODY_MATERIAL_ID,
  EYES_MATERIAL_ID,
  WIRE_MATERIAL_ID,
} from '@/features/avatar/avatars'

describe('materials derived from avatar colours', () => {
  it('derives a body, eyes and wire material from AvatarColors', () => {
    const materials = materialsFromColors({ body: '#c53b47', eyes: '#ffffff' })
    expect(materials.find(material => material.id === BODY_MATERIAL_ID)?.colour).toBe('#c53b47')
    expect(materials.find(material => material.id === EYES_MATERIAL_ID)?.colour).toBe('#ffffff')
    expect(materials.find(material => material.id === WIRE_MATERIAL_ID)).toBeDefined()
  })

  it('gives every derived material the tint treatment', () => {
    const materials = materialsFromColors({ body: '#c53b47', eyes: '#ffffff' })
    materials.forEach(material => expect(material.treatment).toBe('tint'))
  })

  it('looks up a material colour by id, falling back when missing', () => {
    const materials = materialsFromColors({ body: '#c53b47', eyes: '#ffffff' })
    expect(materialColour(materials, BODY_MATERIAL_ID, '#000000')).toBe('#c53b47')
    expect(materialColour(materials, 'unknown', '#000000')).toBe('#000000')
  })
})
