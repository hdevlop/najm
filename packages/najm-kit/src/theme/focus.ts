// ============================================================================
// najm-kit/theme — the focus indicator
// ============================================================================
//
// One definition of "this element has keyboard focus", so a primitive cannot
// quietly ship without one and consumers do not each invent their own ring.
//
// `outline-none` is part of the treatment rather than a separate concern: the
// ring replaces the user-agent outline, and a primitive that suppresses the
// outline without drawing something in its place is the WCAG 2.4.7 failure this
// token exists to prevent. Applying both together makes that pairing atomic.
//
// The colour is `--ring` through Tailwind's `ring-ring`, which is a najm-kit
// theme token written at runtime by the design provider. An application never
// needs its own focus CSS, and one that writes a new palette gets a focus ring
// in that palette for free.
// ============================================================================

/**
 * The kit's keyboard focus indicator.
 *
 * `:focus-visible` rather than `:focus`, so a mouse click on a button does not
 * leave a ring behind — the indicator appears for the users who navigate by
 * keyboard and need to know where they are.
 */
export const focusRingClasses =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The same indicator, for a wrapper that owns the field a child is focused in.
 *
 * Composite inputs put the border, padding and background on a wrapper and
 * strip the inner control bare, so focus lands on an element that is invisible
 * by design while the thing the user sees as "the field" is its parent. Ringing
 * the inner control would draw inside the border; the wrapper has to light up.
 *
 * Both selectors, because both happen: the multi-select trigger is itself the
 * focusable element, and the number field holds a real `<input>` inside. `:has`
 * rather than `:focus-within` so this stays a keyboard indicator either way.
 */
export const focusRingWithinClasses =
  "focus-visible:ring-[3px] focus-visible:ring-ring/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50";
