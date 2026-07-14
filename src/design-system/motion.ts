export const motionDuration = {
  fast: 0.15,
  base: 0.24,
  slow: 0.36,
} as const;

export const motionEase = {
  standard: [0.2, 0, 0, 1] as const,
  emphasized: [0.2, 0.8, 0.2, 1] as const,
} as const;

export const fadeTransition = {
  duration: motionDuration.base,
  ease: motionEase.standard,
} as const;

export const sheetTransition = {
  type: "spring" as const,
  stiffness: 360,
  damping: 34,
  mass: 0.8,
} as const;

export const celebrationTransition = {
  type: "spring" as const,
  stiffness: 260,
  damping: 20,
} as const;
