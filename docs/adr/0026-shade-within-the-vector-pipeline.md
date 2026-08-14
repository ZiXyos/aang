# ADR-0026: Shade within the vector pipeline

## Status

Proposed

## Context

Adding light to Avatar Lab appeared at first to require a second class of renderer. The reasoning was
that the current pipeline computes silhouettes and fills them flat, that the convex hull exists to
discard the interior, and that shading therefore needs a per-pixel surface the vector model cannot
describe.

That reasoning is wrong. The hull discards the interior *outline*, not the ability to compute one.
Shading is expressible as more projected curves: the boundary between lit and unlit surface is a
curve, and so is every iso-intensity contour between them.

For a directional light the terminator on an ellipsoid is exactly an ellipse. The condition
`n · l = 0` reduces to a plane through the ellipsoid's centre, and a plane section of an ellipsoid
projects to a conic under both orthographic and perspective projection. For a point light the
condition is `n · (p − light) = 0`, which is the same form as the silhouette condition
`n · (p − eye) = 0`. The existing tangent-cone solver computes the terminator when it is given the
light position instead of the camera, and the existing exact-ellipse path builder emits it.

Leaving the vector model would also cost properties the project depends on. Photo Mode exports true
SVG, exported packages carry a runtime with no dependencies, and output scales without resampling.

## Decision

Shading is computed inside the existing geometry layer and expressed as ordinary vector output:
projected terminator curves, iso-intensity contours, gradient fills and rim bands derived from the
silhouette. There is no second renderer class and no raster-only path.

The geometry layer gains a light description as an input alongside the Pose and surface. Its output
grows additional shaded contours; it does not change kind.

Photo Mode continues to export SVG that reproduces the shaded result. The flat, unshaded appearance
remains available as the absence of light rather than as a separate renderer.

## Consequences

The project keeps one renderer, one export format and one visual result, so nothing has to be kept
in parity between competing implementations. Shaded output scales like the rest of the project's
output, because it is the same kind of output.

Contour count per primitive grows with shading fidelity, and per-frame path count grows with it.
Cast shadows between primitives are not expressible without boolean path operations and are out of
scope here. Interpenetration is unaffected, since it is a silhouette-ordering problem rather than a
shading one.
