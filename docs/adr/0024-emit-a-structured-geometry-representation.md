# ADR-0024: Emit a structured geometry representation

## Status

Proposed

## Context

`renderAvatar` returns `AvatarGeometry`, whose every field except two booleans is an SVG path `d`
string. Colors, transforms, depth and bounds do not cross the boundary, and coordinates are
quantized with `toFixed(2)` as they are serialized.

The representation discards information the geometry layer already computed. `surfaces.ts` derives
exact analytic normals for every surface type; `geometry.ts` spends them on three boolean
comparisons — one wireframe cull and two summed-normal eye visibility tests — and drops them,
because a path string cannot carry a normal. Any renderer that shades a surface needs those normals,
and any consumer that is not an SVG serializer must parse the strings back into the points that
produced them.

The string form also has two independent producers. `serializeAvatarSnapshot` builds snapshot markup
from the rendered scene while `SnapshotPreview` rebuilds equivalent markup in JSX, so studio and
export can drift apart silently.

## Decision

`renderAvatar` produces a structured representation as its primary output: contours as typed arrays
of coordinates, the surface normal retained per sample, and per-contour metadata covering draw
order, closure and fill reference. Path strings become a derived projection of that representation
rather than an independently constructed artifact.

Full precision is preserved in the structured form. Quantization, where it remains, belongs to the
SVG projection alone and not to the geometry layer.

The structured form is the single upstream artifact for every consumer: the SVG projection, any
external renderer, and any tree that describes a scene declaratively.

## Consequences

Shading becomes possible, because normals survive the boundary. External renderers receive vertex
data rather than strings to re-parse. Studio and export agree by construction, and the duplicate
snapshot markup collapses into one derivation.

`AvatarGeometry` is consumed by the studio canvas, the snapshot serializer, the exported procedural
runtime and the geometry tests, so the change is wide even though each call site is small. The
generated standalone engine must be regenerated. Memory per frame rises, since typed arrays and
normals are retained where only strings were held before, and the fixed path slot count in the
rendered scene stops being the natural shape for the data.
