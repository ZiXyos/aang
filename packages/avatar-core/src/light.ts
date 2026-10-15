export type Light = {
  /** degrees; 0 = directly in front, positive = light from the viewer's right */
  azimuth: number
  /** degrees; 0 = level with the avatar, positive = light from above */
  elevation: number
  /** 0..1, overall strength of the light/dark spread the tint produces */
  intensity: number
}

export const defaultLight: Light = { azimuth: -35, elevation: 45, intensity: 0.8 }

const radians = (degrees: number) => (degrees * Math.PI) / 180

export const lightDirection = (light: Light): readonly [number, number, number] => {
  const azimuth = radians(light.azimuth)
  const elevation = radians(light.elevation)
  return [
    Math.cos(elevation) * Math.sin(azimuth),
    -Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  ]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Maps how directly a surface faces the light (the cosine between its normal
 * and the light direction, -1..1) to the 0..1 scalar the tint consumes.
 * attenuation (0..1) darkens receded or embedded parts; intensity pulls every
 * value toward 0.5 (grazing light), so intensity=0 renders the authored colour.
 */
export const lightScalar = (facing: number, light: Light, attenuation = 1): number => {
  const lit = ((clamp(facing, -1, 1) + 1) / 2) * attenuation
  return clamp(lit * light.intensity + 0.5 * (1 - light.intensity), 0, 1)
}

/**
 * Maps a light's azimuth/elevation onto a 2D point on a disc of the given
 * radius, for a draggable gizmo: centre = zenith (elevation 90, light from
 * directly above), edge = horizon (elevation 0). Elevation outside [0, 90]
 * is clamped onto the disc — this gizmo only reaches the "light from above"
 * hemisphere, a deliberate simplification (Light itself still allows any
 * elevation for other callers).
 */
export const lightHandlePosition = (light: Light, radius = 30): readonly [number, number] => {
  const elevation = clamp(light.elevation, 0, 90)
  const distance = radius * (1 - elevation / 90)
  const azimuthRadians = radians(light.azimuth)
  return [distance * Math.sin(azimuthRadians), -distance * Math.cos(azimuthRadians)]
}

/** Inverse of lightHandlePosition: a dragged point on the disc back to azimuth/elevation. intensity passes through unchanged (the gizmo only edits direction). */
export const lightFromHandlePosition = (
  point: readonly [number, number],
  intensity: number,
  radius = 30
): Light => {
  const distance = Math.min(radius, Math.hypot(point[0], point[1]))
  const elevation = 90 * (1 - distance / radius)
  const azimuth = distance < 1e-6 ? 0 : (Math.atan2(point[0], -point[1]) * 180) / Math.PI
  return { azimuth, elevation, intensity: clamp(intensity, 0, 1) }
}
