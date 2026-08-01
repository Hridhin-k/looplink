/**
 * Shared motion tokens for the dashboard.
 * Keep distances and durations small — premium, not flashy.
 */

export const MACHINE_EASE = [0.4, 0, 0.2, 1] as const;
export const SOFT_OUT_EASE = [0.16, 1, 0.3, 1] as const;

export const duration = {
  fast: 0.15,
  base: 0.2,
  slow: 0.28,
} as const;

/** Page / section enter — opacity + tiny lift */
export const pageEnter = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: duration.base, ease: MACHINE_EASE },
} as const;

/** Empty-state enter — slightly slower, still subtle */
export const emptyEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: duration.slow, ease: MACHINE_EASE },
} as const;

/** Feed / list item enter — prefer soft slide over dramatic pop */
export const listItemEnter = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: { duration: duration.base, ease: MACHINE_EASE },
} as const;

/** Success panel reveal after replay / copy */
export const successReveal = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: duration.slow, ease: MACHINE_EASE },
} as const;

/** Instant variants when prefers-reduced-motion is on */
export const reducedEnter = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 1, y: 0 },
  transition: { duration: 0 },
} as const;
