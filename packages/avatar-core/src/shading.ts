import type { Point3 } from './geometry'
import { lightDirection, lightScalar, type Light } from './light'

export type ShadingStop = {
  /** 0..1 position between the focal point and the end circle. */
  offset: number
  /** 0..1 light scalar, as consumed by the colour tint. */
  value: number
}

/**
 * A radial gradient approximating diffuse light across one projected part.
 * Coordinates are in the avatar's view space, matching an SVG radialGradient
 * with gradientUnits="userSpaceOnUse": offset 0 sits on the focal point and
 * offset 1 on the end circle.
 */
export type PartShading = {
  focal: readonly [number, number]
  center: readonly [number, number]
  radius: number
  stops: ShadingStop[]
  highlight: PartHighlight
}

/**
 * A soft, wide highlight centred on the part's brightest point, as a fraction of
 * the part's projected size. Renderers fade it out radially.
 */
export type PartHighlight = {
  center: readonly [number, number]
  radius: number
  /** 0..1, already scaled by light intensity and part attenuation. */
  strength: number
}

/** A visible point on a part, already rotated and projected to view space. */
export type ShadingSample = {
  screen: readonly [number, number]
  normal: Point3
  /** Relative screen area the sample covers. */
  weight: number
}

export const SHADING_STOP_COUNT = 6

// Highlight radius as a fraction of the part's projected radius.
const HIGHLIGHT_RADIUS = 0.28
// Samples within this score of the best one share the peak; weighting them
// keeps the peak moving continuously instead of snapping between samples.
const PEAK_WINDOW = 0.06

// Two families of candidate gradients, scaled by the part's projected radius and
// by how sideways the light is:
// - focal on the brightest visible point with the end circle shifted away from
//   the light, which fits frontal and oblique light (curved isophotes);
// - concentric circles centred beyond the lit limb, whose arcs across the part
//   are near-straight, which fits side light where diffuse shading varies
//   almost linearly across the silhouette.
const END_CIRCLE_SHIFTS = [0, 0.5, 1, 2]
const OUTER_CENTRE_DISTANCES = [1, 2, 4, 8]

const gradientOffset = (
  x: number,
  y: number,
  focal: readonly [number, number],
  center: readonly [number, number],
  radius: number
) => {
  // Solve |point - (focal + t (center - focal))| = t radius for the non-negative t.
  const qx = x - focal[0]
  const qy = y - focal[1]
  const dx = center[0] - focal[0]
  const dy = center[1] - focal[1]
  const a = dx * dx + dy * dy - radius * radius
  const b = -2 * (qx * dx + qy * dy)
  const c = qx * qx + qy * qy
  if (Math.abs(a) < 1e-9) return Math.abs(b) < 1e-9 ? 0 : Math.max(-c / b, 0)
  const discriminant = Math.sqrt(Math.max(0, b * b - 4 * a * c))
  return Math.max((-b + discriminant) / (2 * a), (-b - discriminant) / (2 * a), 0)
}

const valueAt = (stops: ShadingStop[], offset: number) => {
  if (offset <= stops[0].offset) return stops[0].value
  for (let index = 1; index < stops.length; index += 1) {
    const stop = stops[index]
    if (offset <= stop.offset) {
      const previous = stops[index - 1]
      const span = stop.offset - previous.offset
      const share = span > 1e-9 ? (offset - previous.offset) / span : 1
      return previous.value + (stop.value - previous.value) * share
    }
  }
  return stops[stops.length - 1].value
}

const SEGMENTS = SHADING_STOP_COUNT - 1

// Weighted fit of piecewise-linear stops spread evenly over the offsets the
// samples actually cover, so no stop is wasted outside the part. Writes the stop
// values into `stops` and returns the covered range plus the weighted squared
// error of the fit. Typed arrays and a uniform grid keep this allocation-free,
// since it runs for every candidate of every part on every frame.
const fitStops = (
  offsets: Float64Array,
  values: Float64Array,
  weights: Float64Array,
  stops: Float64Array,
  totals: Float64Array
) => {
  let start = 1
  let end = 0
  for (let index = 0; index < offsets.length; index += 1) {
    start = Math.min(start, offsets[index])
    end = Math.max(end, offsets[index])
  }
  start = Math.max(start, 0)
  end = Math.min(Math.max(end, start + 1e-3), 1)
  const scale = SEGMENTS / (end - start)
  stops.fill(0)
  totals.fill(0)
  for (let index = 0; index < offsets.length; index += 1) {
    const position = (Math.min(Math.max(offsets[index], start), end) - start) * scale
    const lower = Math.min(Math.floor(position), SEGMENTS - 1)
    const upperShare = position - lower
    const weight = weights[index]
    stops[lower] += values[index] * weight * (1 - upperShare)
    totals[lower] += weight * (1 - upperShare)
    stops[lower + 1] += values[index] * weight * upperShare
    totals[lower + 1] += weight * upperShare
  }
  for (let index = 0; index < SHADING_STOP_COUNT; index += 1) {
    stops[index] = totals[index] > 1e-9 ? stops[index] / totals[index] : NaN
  }
  // Stops no sample landed near take their closest populated neighbour.
  for (let index = 0; index < SHADING_STOP_COUNT; index += 1) {
    if (!Number.isNaN(stops[index])) continue
    let filled = 0.5
    for (let distance = 1; distance < SHADING_STOP_COUNT; distance += 1) {
      const before = index - distance >= 0 ? stops[index - distance] : NaN
      const after = index + distance < SHADING_STOP_COUNT ? totals[index + distance] : 0
      if (!Number.isNaN(before)) {
        filled = before
        break
      }
      if (after > 1e-9) {
        filled = stops[index + distance]
        break
      }
    }
    stops[index] = filled
  }
  let error = 0
  for (let index = 0; index < offsets.length; index += 1) {
    const position = (Math.min(Math.max(offsets[index], start), end) - start) * scale
    const lower = Math.min(Math.floor(position), SEGMENTS - 1)
    const share = position - lower
    const difference = stops[lower] + (stops[lower + 1] - stops[lower]) * share - values[index]
    error += weights[index] * difference * difference
  }
  return { start, end, error }
}

export const flatShading = (
  center: readonly [number, number],
  radius: number,
  value: number
): PartShading => ({
  focal: center,
  center,
  radius: Math.max(radius, 1),
  stops: Array.from({ length: SHADING_STOP_COUNT }, (_, index) => ({
    offset: index / (SHADING_STOP_COUNT - 1),
    value,
  })),
  highlight: { center, radius: 0, strength: 0 },
})

// Weighted average position of the samples scoring near the maximum.
const peakOf = (samples: ShadingSample[], scores: Float64Array): readonly [number, number] => {
  let best = -Infinity
  for (const score of scores) best = Math.max(best, score)
  const floor = best - PEAK_WINDOW
  let total = 0
  let x = 0
  let y = 0
  samples.forEach((sample, index) => {
    if (scores[index] <= floor) return
    const share = (scores[index] - floor) / PEAK_WINDOW
    const weight = sample.weight * share * share
    total += weight
    x += sample.screen[0] * weight
    y += sample.screen[1] * weight
  })
  if (total <= 1e-12) return samples[scores.indexOf(best)].screen
  return [x / total, y / total]
}

/**
 * Fits a radial gradient to the per-sample diffuse light of one convex part.
 * The focal point is the visible sample facing the light most directly; the end
 * circle encloses the outline and sits at whichever candidate distance away from
 * the light minimises the weighted error between the gradient and the samples.
 */
export const fitPartShading = (
  samples: ShadingSample[],
  outline: readonly (readonly [number, number])[],
  light: Light,
  attenuation: number,
  fallback: number
): PartShading => {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of outline) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const centroid: readonly [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2]
  const enclosingRadius = (center: readonly [number, number]) => {
    let squared = 1
    for (const [x, y] of outline) {
      const dx = x - center[0]
      const dy = y - center[1]
      squared = Math.max(squared, dx * dx + dy * dy)
    }
    return Math.sqrt(squared)
  }
  const baseRadius = enclosingRadius(centroid)
  if (samples.length === 0) return flatShading(centroid, baseRadius, fallback)

  const direction = lightDirection(light)
  const values = new Float64Array(samples.length)
  const weights = new Float64Array(samples.length)
  const facing = new Float64Array(samples.length)
  samples.forEach((sample, index) => {
    facing[index] =
      sample.normal[0] * direction[0] +
      sample.normal[1] * direction[1] +
      sample.normal[2] * direction[2]
    values[index] = lightScalar(facing[index], light, attenuation)
    weights[index] = sample.weight
  })
  const focal = peakOf(samples, facing)
  const highlight: PartHighlight = {
    center: focal,
    radius: baseRadius * HIGHLIGHT_RADIUS,
    strength: light.intensity * attenuation,
  }
  const sideways = Math.hypot(direction[0], direction[1])
  const away: readonly [number, number] =
    sideways > 1e-6 ? [-direction[0] / sideways, -direction[1] / sideways] : [0, 0]

  // Every candidate encloses the outline: it lies within baseRadius of the
  // centroid, so the centre's distance from the centroid plus baseRadius suffices.
  // Light straight along the view axis has no sideways direction to shift along.
  const shifts = sideways > 1e-6 ? END_CIRCLE_SHIFTS : [0]
  const candidates: Omit<PartShading, 'stops' | 'highlight'>[] = shifts.map(shift => {
    const distance = shift * sideways * baseRadius
    const center: readonly [number, number] = [
      centroid[0] + away[0] * distance,
      centroid[1] + away[1] * distance,
    ]
    return {
      focal,
      center,
      radius: Math.max(
        baseRadius + distance,
        Math.hypot(focal[0] - center[0], focal[1] - center[1]) + 1e-3
      ),
    }
  })
  if (sideways > 1e-6) {
    for (const multiple of OUTER_CENTRE_DISTANCES) {
      const distance = multiple * sideways * baseRadius
      const center: readonly [number, number] = [
        centroid[0] - away[0] * distance,
        centroid[1] - away[1] * distance,
      ]
      candidates.push({ focal: center, center, radius: baseRadius + distance })
    }
  }

  const offsets = new Float64Array(samples.length)
  const stops = new Float64Array(SHADING_STOP_COUNT)
  const totals = new Float64Array(SHADING_STOP_COUNT)
  const bestStops = new Float64Array(SHADING_STOP_COUNT)
  let best = { candidate: candidates[0], start: 0, end: 1, error: Infinity }
  for (const candidate of candidates) {
    for (let index = 0; index < samples.length; index += 1) {
      const screen = samples[index].screen
      offsets[index] = gradientOffset(
        screen[0],
        screen[1],
        candidate.focal,
        candidate.center,
        candidate.radius
      )
    }
    const fit = fitStops(offsets, values, weights, stops, totals)
    if (fit.error < best.error) {
      best = { candidate, ...fit }
      bestStops.set(stops)
    }
  }
  return {
    ...best.candidate,
    highlight,
    stops: Array.from(bestStops, (value, index) => ({
      offset: best.start + ((best.end - best.start) * index) / SEGMENTS,
      value,
    })),
  }
}

/** Evaluates a fitted gradient at a view-space point, for tests and diagnostics. */
export const shadingValueAt = (shading: PartShading, point: readonly [number, number]) =>
  valueAt(
    shading.stops,
    gradientOffset(point[0], point[1], shading.focal, shading.center, shading.radius)
  )
