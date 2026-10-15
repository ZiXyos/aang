import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const stylesheet = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../app/styles.css'),
  'utf8'
)

// AvatarCanvas paints these parts every frame from per-part light intensity. Motion
// writes the tinted colour as an SVG presentation attribute, which any author CSS
// declaration overrides, and a CSS transition makes the shading trail the geometry.
// Colour changes between expressions and avatars are already interpolated in JS.
const framePaintedParts = [
  { selector: '.avatar-head', channel: 'fill' },
  { selector: '.avatar-eye', channel: 'fill' },
  { selector: '.wire', channel: 'stroke' },
] as const

// Pixel rendering hides the vector paths and draws the avatar on a canvas instead.
const pixelRenderedScope = '.is-pixel-rendered'

const vectorRulesTargeting = (selector: string) => {
  const pattern = new RegExp(`${selector.replace('.', '\\.')}(?![\\w-])`)
  return [...stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selectors, body]) => ({
      selectors: selectors
        .split(',')
        .map(item => item.trim())
        .filter(item => pattern.test(item) && !item.includes(pixelRenderedScope)),
      body,
    }))
    .filter(rule => rule.selectors.length > 0)
}

describe('frame-painted avatar styles', () => {
  test.each(framePaintedParts)('$selector does not override its painted $channel', part => {
    const declaration = new RegExp(`(^|[;\\s])${part.channel}\\s*:`)
    const overriding = vectorRulesTargeting(part.selector).filter(rule =>
      declaration.test(rule.body)
    )
    expect(overriding).toEqual([])
  })

  test.each(framePaintedParts)('$selector has no CSS transition', part => {
    const transitioned = vectorRulesTargeting(part.selector).filter(rule =>
      /transition/.test(rule.body)
    )
    expect(transitioned).toEqual([])
  })
})
