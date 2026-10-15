---
'@bible-strong/avatar-core': minor
---

Add opt-in per-part light shading. `renderAvatar(..., { shading: true })` now returns `geometry.shading`: per head, back and front path, a radial gradient fitted to the part's diffuse light and a soft highlight on its brightest point, scaled by light intensity. `lightScalar` exposes the light-to-tint mapping. Without the option, output is unchanged.
