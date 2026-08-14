# ADR-0028: Shade parts by colour before shading them by contour

## Status

Proposed

## Context

ADR-0026 keeps shading inside the vector pipeline. This decision records how a shaded surface is
computed, and in what order the available techniques should be reached for.

Shading a primitive with its own gradient, terminator and rim produces an artifact wherever
primitives interpenetrate, which is the normal case: a new body node is placed about 109 units from
centre inside a head of radius 120, so it is embedded by default. Depth is one scalar per primitive
and silhouettes are painted whole, so the visible boundary of an embedded primitive is its own
silhouette rather than the true intersection curve. Interior shading detail implies a form that is
then cut along a curve with no physical meaning, and the primitive reads as pasted on rather than
emerging.

The cause is the interior detail, not the overlap. A uniformly tinted primitive has nothing to
contradict, so the same wrong geometry stops being legible.

A representative direction per primitive is already available at no cost. `accessoryLayers` rotates
each node's position into camera space and keeps only the depth component; the discarded components
complete the vector that a light would be dotted with.

The primary surface is different in kind. It is an ellipsoid whose terminator is exactly an ellipse,
and it is the base form, so primitives drawn over it genuinely are in front of it. Covering part of
its shading is correct rather than artefactual.

## Decision

Shading is applied per part as colour first, and as contour only where contour is safe.

Secondary primitives are tinted uniformly. The tint comes from the primitive's orientation relative
to the light, using the vector already computed for depth sorting, and is modulated by depth so
distant parts recede and by embedding depth so contact regions darken.

The primary surface may carry full contour shading: terminator, rim inset from the silhouette, and
iso-intensity bands. Its terminator uses the existing tangent-cone solver with the light substituted
for the camera, which is exact under both projections.

Contour shading on secondary primitives is not adopted. It is available if interpenetration is ever
solved, and is the reason to revisit this decision.

Colour is modulated in a perceptually uniform space by lightness, holding hue and chroma, rather
than by interpolating sRGB channels.

## Consequences

The cheapest rung is genuinely cheap: one dot product per primitive and a per-part fill, requiring
no change to the geometry layer, no intermediate representation and no new rendering backend. It can
ship well ahead of every other decision in this set.

Depth reads as depth without the sticker artefact, because the only primitive carrying interior
detail is the one nothing clips incorrectly. Path count grows only for the primary surface, so the
rendering backend is not immediately the constraint.

Large secondary primitives will read flatter than small ones, since a uniform tint carries no form.
The default node scale makes this acceptable, and it becomes wrong if primitives grow toward the
size of the head. Perceptual colour handling has to be introduced, because the existing hex channel
interpolation muddies darkened tints.
