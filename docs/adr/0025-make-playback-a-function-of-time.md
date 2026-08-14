# ADR-0025: Make Playback a function of time

## Status

Proposed

## Context

`playback.ts` models Playback as a deadline-driven state machine. Its operations advance the
timeline by one step, schedule a deadline against `performance.now()`, or convert a pending deadline
into remaining time. There is no operation that answers what the Pose is at a given moment; the only
way to reach a position is to advance into it from the start.

Blink compounds this. The interval between blinks is chosen with `Math.random()` in both the Studio
controller and the exported procedural runtime, so replaying one Animation does not reproduce the
same frames.

Three uncoordinated frame sources drive the current pipeline — the transition loop, the ambient
motion loop and the blink value's change subscription — and each repaints independently, so a blink
during a transition computes geometry twice in one frame.

The arithmetic needed to evaluate a moment already exists and is already pure: the three transition
curves, the componentwise interpolation across the numeric Expression fields, and the loop,
play-once and ping-pong cursor rules.

## Decision

Playback gains an evaluation function that maps an Animation and a time to a Pose and a blink
amount, given a seed. Step durations are accumulated into absolute boundaries so a moment can be
located directly; loop wraps by modulo, play-once clamps, and ping-pong resolves against a full
period.

Blink jitter is produced by a seeded generator derived from the Animation and the elapsed time,
replacing `Math.random()` in the Studio and in the exported runtime. The same seed and time always
yield the same frame.

Live Playback keeps a scheduler, but the scheduler becomes a caller of the evaluation function
rather than the owner of the animated state. Frame ownership collapses to a single loop.

## Consequences

Scrubbing, thumbnail strips, frame-exact export and parallel frame rendering all become expressible,
because any moment can be evaluated in any order without replaying the ones before it. Playback
becomes testable by assertion on values rather than by simulating elapsed time.

Blink timing changes for existing Animations, since a seeded sequence will not match the unseeded
one that users have seen. Exported packages change behavior in the same way and must be regenerated.
Pause and resume stop being deadline arithmetic and become a stored offset, which is simpler but
touches the persisted Playback shape.
