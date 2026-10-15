---
'@bible-strong/avatar-core': minor
---

Add opt-in per-part light gradients. `renderAvatar(..., { shading: true })` now returns `geometry.shading`, a radial gradient per head, back and front path that is fitted to the part's diffuse light, and `lightScalar` exposes the light-to-tint mapping. Without the option, output is unchanged.
