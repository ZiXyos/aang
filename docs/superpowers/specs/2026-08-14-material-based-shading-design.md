# Design: material-based shading (closing the non-filled-item gap)

## Status

Draft — written against the `docs/adr-drafting` branch, before any of ADR-0024, 0026, 0027, 0028 or
0030 has moved out of `Proposed`.

## Context

None of the shading/light pipeline described by ADR-0024, 0026, 0027, 0028 or 0030 is implemented
yet. The rendering pipeline that exists today (`src/features/avatar/geometry.ts`,
`src/features/rendering/renderedScene.ts`) paints the whole avatar with exactly two flat colours —
`AvatarColors.body` and `AvatarColors.eyes` — and carries no per-part colour, fill/stroke
distinction, or light data at all.

ADR-0028 already anticipates the mechanism for lighting individual parts: a per-part orientation
scalar (the light dot product, computed from the same rotation `accessoryLayers` already performs
for depth sorting) drives either full contour shading (primary surface) or a flat uniform tint
(secondary primitives). But ADR-0028 writes this mechanism entirely in terms of **fill** colour —
"a per-part fill," tinted uniformly. Stroke is never mentioned.

Taken literally, that design has a gap: a part whose only paint is a stroke (no fill) has nothing
for the tint step to multiply against. It would render flat and unlit while every filled neighbour
around it shades correctly under the same light. This was confirmed by reading the ADRs directly —
ADR-0028 admits the related, adjacent limitation ("contour shading on secondary primitives is not
adopted... is the reason to revisit this decision") but does not address fill-vs-stroke at all.

This spec designs the fix. It was explored as a hypothetical/lab exercise, so it favours the more
general of two viable approaches (see Alternatives) rather than the smallest diff.

## Decision

Decouple *colour + shading treatment* from the SVG paint mechanics of fill and stroke, by
introducing a **material** as the unit that carries colour and how that colour reacts to light. A
part references materials by paint slot; a part with no fill is simply a part with an empty fill
slot, not a part shading can't see.

### 1. Material

```
Material {
  colour: <base colour, perceptually-uniform space — same space ADR-0028 already requires>
  treatment: 'contour' | 'tint' | 'none'
}
```

- **`contour`** — the existing ADR-0026/0028 vector-shading mechanism: terminator, rim inset from
  the silhouette, iso-intensity bands. Only meaningful where the geometry layer can compute a
  terminator, which today means the primary surface's interior. In practice, at most one material
  in an avatar uses this treatment.
- **`tint`** — the existing ADR-0028 mechanism for secondary primitives: the part's orientation
  scalar (light dot product) modulates the material's colour by lightness only, holding hue and
  chroma, further modulated by depth and embedding depth exactly as ADR-0028 already specifies.
  Unlike today's draft, `tint` is a property of the *material*, so it applies equally to a fill or a
  stroke, on a primary or a secondary part.
- **`none`** — colour is painted exactly as authored; no light interaction. Covers wireframe/debug
  paths and any part that should stay flat by design.

### 2. Parts hold independent fill/stroke slots, each an optional material reference

A part keeps two optional slots: `fillMaterial` and `strokeMaterial`, each an id into the materials
registry (or absent). The slot still decides whether the renderer paints an SVG `fill` or `stroke`
attribute — that remains a mechanical decision, not a shading one. What changes is that colour and
treatment now live on the referenced material, not on an implicit "this part has a fill" assumption.

A stroke-only part (e.g. a wireframe path) simply has `strokeMaterial: 'outline'` and no
`fillMaterial`. It is fully shaded because `outline` carries its own treatment — not because
anything special-cases "parts without fill." This is the fix: shading is defined in terms of
material, not in terms of fill.

A part is not restricted to one slot; the primary surface may set both `fillMaterial` (typically
`contour`-treated) and `strokeMaterial` (typically `tint`-treated, since an outline stroke has no
interior for a terminator/rim/iso-band computation to act on) at once.

### 3. Registry ownership

The materials registry lives on the **Avatar**, replacing today's flat `AvatarColors { body, eyes }`
— colour is part of what an avatar *is* (ADR-0022's versioned-document territory), the same place
those two colours live today. The **light** stays view-owned per ADR-0030 and is never part of the
registry. At render time the view's light produces one orientation scalar per part (unchanged from
ADR-0028's existing plan); that scalar is what any `tint`-treatment material is evaluated against,
regardless of which avatar it belongs to.

### 4. Render-time rule

For each part, for each of its non-empty slots (`fillMaterial`, `strokeMaterial`):

1. Look up the referenced material.
2. If `treatment === 'contour'`: run the existing terminator/rim/iso-band computation seeded with
   the material's colour.
3. If `treatment === 'tint'`: modulate the material's colour by the part's orientation scalar in
   perceptually-uniform lightness, holding hue and chroma, per ADR-0028's existing formula.
4. If `treatment === 'none'`: paint the colour unmodified.
5. Paint the result into that slot's SVG `fill` or `stroke` attribute.

## Alternatives considered

**Keep colour hanging directly off fill/stroke** (extend ADR-0024's structured geometry with a
`fill` reference and a new `stroke` reference, each just a colour; contour shading stays hardwired
to "the primary surface's fill," tint applies to every other fill/stroke present). This is the
smaller diff — it doesn't introduce a registry or a `treatment` enum, and maps more directly onto
today's `d`-string geometry output. It was set aside in favour of the materials design because this
work is exploratory/lab-scoped and the more general shape (reusable, re-themeable materials;
shading treatment as explicit per-material data rather than inferred from "is this the primary
surface's fill") was preferred over minimizing the diff.

## Consequences

- Closes the original gap generally: "non-filled item" stops being a special case that shading
  silently skips. A part with an empty fill slot is shaded correctly through its stroke slot's
  material, using the same mechanism as everything else.
- Requires a real data-model change beyond what ADR-0024 currently proposes: `AvatarColors { body,
  eyes }` is replaced by a materials registry, and geometry parts carry slot → material-id
  references instead of (or alongside) their current `d`-string-only shape. This is more surface
  area than the minimal alternative, consistent with choosing generality for a lab context.
  ADR-0024 and ADR-0028 would need to be amended (or superseded) to describe materials rather than a
  bare per-part fill colour before either moves out of `Proposed`.
- `contour` treatment remains meaningful for only one material in practice (the primary surface's
  interior) until interpenetration is solved — this constraint is inherited unchanged from
  ADR-0028's own reasoning, not something this design changes.
- No runtime code exists yet for any of this — there's nothing to migrate; the materials shape can
  be the first shape ADR-0024/0028's structured geometry is ever implemented with.

## Open questions / next steps

- Whether to fold this into ADR-0024/0028 directly, or record it as a new ADR that supersedes/amends
  them, is left open per your earlier answer ("just design the fix, decide doc shape later"). Worth
  resurfacing once this spec is implemented far enough to know it holds up.
- Whether `contour` treatment should ever be reachable from a stroke slot (e.g. a terminator-aware
  outline that darkens where it crosses the twilight band) is left out of scope — nothing in the
  current ADRs asks for it, and it would need a curve-following colour-along-a-stroke technique that
  doesn't exist today.
