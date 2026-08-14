# ADR-0030: Own the light in the view

## Status

Proposed

## Context

ADR-0026 gives the geometry layer a light as an input. Where that light is stored decides how far
the change propagates.

An Expression could own it. Light would then interpolate between Animation steps like any other
numeric field, and an Animation could darken or swing the key light as part of its performance. It
would also enlarge the Expression schema, add fields to the interpolated set, and make every
Expression carry lighting state that is meaningless when no light is configured.

An Avatar could own it. Lighting would then travel with the character and with exported packages,
but it would also become part of the Avatar's durable identity, which conflicts with Expressions
remaining compatible across Avatars and with the Neutral appearance describing the character rather
than its presentation.

Neither matches what a light is here. Light is not a property of who the character is, nor of what
face it is pulling. It describes the situation the character is being looked at in — the same
category as the camera, which the Studio already treats as view state rather than document state.

## Decision

The light is owned by the view. It is a reference point for rendering, held alongside other view
state, and it is not part of an Avatar, an Expression or the behavior libraries.

Photo Mode captures the current light as part of its options, so a snapshot reproduces what the
Studio showed.

Exported packages receive a light as configuration with a sensible default, rather than inheriting
one from the Avatar data.

Compositions, when they exist, own their own light, because a composition is a view. That is the
place where an animated or scripted light belongs if it is ever wanted.

## Consequences

The Expression schema is unchanged and the interpolated field set does not grow, so Animations,
the behavior library copy-on-write rules and project JSON compatibility are all untouched. This is
the cheapest of the three options by a wide margin.

Light does not animate as part of an Animation. An Animation cannot dim or swing the key light, and
if that is wanted later it arrives through compositions rather than by moving the light into
Expressions. Light also does not travel with an Avatar: duplicating or transferring a character does
not carry its lighting, and two Studio sessions may show the same Avatar differently. Both are
accepted as consistent with treating light as a viewing condition.
