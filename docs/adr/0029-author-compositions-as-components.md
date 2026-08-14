# ADR-0029: Author compositions as components

## Status

Proposed

## Context

The Studio edits one Avatar at a time through an inspector. Assembling several Avatars, timed
layers and overlays into a finished piece has no representation: there is no composition object, no
timeline beyond a single Animation, and no raster sequence export of any kind.

Building that as more inspector surface would repeat the problem the inspector already has. The
alternative is to describe a composition declaratively and let a renderer paint it, which is the
model React already provides — with the important qualification that the host tree must be scene
nodes rather than DOM elements, since ADR-0027 moves rasterization out of the DOM.

Two prerequisites carry this. ADR-0024 gives a structured representation that something can write
into, and ADR-0025 makes any moment evaluable, which is what lets a preview scrub and an export
render frames independently.

## Decision

Compositions are described as component trees. A custom reconciler treats the structured geometry
representation as its host tree, so components create and update scene nodes instead of elements.
Rendering is owned by the renderer, not by the tree.

Structure and animation stay separate. The tree describes what exists and is reconciled when it
changes, which is rarely. Animated values come from the time evaluation function and are recomputed
per frame without reconciliation. Time is available to components as an input rather than something
they advance.

A composition is a persisted object in the Studio document alongside Avatars and Animations, and it
is what export renders.

## Consequences

Compositions become reusable and composable in the way components are, and previews come from the
same description that export renders, so they cannot disagree. Frame-exact and parallel rendering
follow from ADR-0025 rather than needing separate machinery.

A custom reconciler is a real and ongoing cost, and it constrains what may appear in a composition
tree to node types the renderer understands. The Studio document gains a composition schema, which
is a larger addition than any change since the versioned document itself. Two authoring models will
coexist for some time — the existing inspector for a single Avatar, and composition trees for
assembled work — and the boundary between them needs to stay explicit so it does not become two ways
to do the same thing.
