# ADR-0027: Render vector output on the GPU

## Status

Proposed

## Context

ADR-0026 keeps shading in the vector pipeline and ADR-0028 expresses it as projected contours. Both
raise path count: a shaded primitive costs a terminator curve, a rim band and as many iso-intensity
contours as the chosen fidelity requires, where an unshaded one costs a single silhouette.

The current presentation path cannot absorb that. Each contour would become a DOM element whose `d`
attribute is rewritten every frame, and the rendered scene allocates a fixed number of path slots
bound one-to-one to elements in the React tree. Raster output is worse still: Photo Mode serializes
the scene, decodes it through an image element and blits it to a canvas at its intrinsic size, so
the browser makes every sampling decision and results differ by engine and platform.

Previewing the same Avatar at several scales is a stated goal. Vector output scales without
resampling, so the cost of previewing at a larger scale is rasterization speed rather than
regeneration — provided rasterization is fast enough to stay interactive.

Avatar Lab has no backend and intends to keep none.

## Decision

Vector output is rasterized by a GPU compute vector renderer written in Rust against `wgpu`,
compiled to WebAssembly for the browser and natively for offline rendering. The same implementation
serves interactive preview and file output, so what the Studio shows is what a rendered file
contains.

In the browser it runs in the page, preserving the no-backend property. Preview at arbitrary scale
is a rasterization parameter rather than a regeneration of geometry.

A fallback is required where WebGPU is unavailable, and the renderer degrades to a slower path
rather than becoming unavailable.

Layers requiring document layout are rendered by an HTML and CSS engine that paints through the same
vector backend, so every layer reaches one surface through one queue.

## Consequences

Path counts far above today's become affordable, which is what makes tunable shading fidelity
practical rather than theoretical. Preview and export share a rasterizer, removing the current
divergence between the on-screen scene and the separately constructed snapshot markup.

Offline rendering escapes the browser's canvas limits and its engine-dependent sampling, which makes
golden-image regression tests possible for the first time, since the test runner executes outside a
browser.

The build gains a Rust toolchain, a WebAssembly step and a CI check alongside the existing engine
freshness check. Exported packages cannot carry a WebAssembly payload today, because the stored ZIP
writer accepts text entries only; shipping this renderer to consumers requires binary entries,
base64 inlining, or continuing to serve exports with the existing DOM runtime. The fallback path
will not match the GPU path exactly, and which of the two is authoritative for export must be
decided rather than left implicit.
