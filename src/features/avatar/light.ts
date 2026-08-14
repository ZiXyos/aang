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
