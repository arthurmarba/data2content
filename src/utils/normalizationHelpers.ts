// src/utils/normalizationHelpers.ts
import { logger } from "@/app/lib/logger"; // Added

/**
 * Normalizes a given value to a scale of 0-100 using Min-Max normalization.
 *
 * @param value The raw value to normalize. Can be null.
 * @param min The minimum reference value for the scale. Can be null.
 * @param max The maximum reference value for the scale. Can be null.
 * @returns A number between 0 and 100, or 0 if value is null or range is invalid for robust normalization.
 *          Returns 50 if min === max and value is not null (and not zero, to avoid 0 being 50).
 *          Returns 0 if value is 0 and min === max.
 */
export function normalizeValue(
  value: number | null,
  min: number | null,
  max: number | null
): number {
  if (value === null || value === undefined) {
    return 0; // Default for missing values
  }

  // Ensure min and max are numbers for calculation
  const numMin = (typeof min === 'number' && !isNaN(min)) ? min : null;
  const numMax = (typeof max === 'number' && !isNaN(max)) ? max : null;

  if (numMin === null || numMax === null) {
    // If min or max is not a valid number, cannot perform robust normalization.
    // Return 0, or consider other fallback strategies (e.g., a fixed scale if appropriate).
    logger.warn(`Normalization skipped: min (${min}) or max (${max}) is not a valid number. Value: ${value}`); // Replaced console.warn
    return 0; // Or perhaps 50 if we want to indicate 'average' for unknown scale
  }

  if (numMin === numMax) {
    // If min and max are the same, the scale is a single point.
    // Any value at this point that isn't zero is treated as 'average' (50) on the 0-100 scale.
    // If the value is zero (and min/max are also zero), it's 0.
    return value !== 0 ? 50 : 0;
  }

  // Standard Min-Max normalization formula
  let normalized = ((value - numMin) / (numMax - numMin)) * 100;

  // Clip the result to the range [0, 100]
  normalized = Math.max(0, Math.min(normalized, 100));

  // Optional: Arredondar para uma casa decimal ou inteiro
  // return parseFloat(normalized.toFixed(1));
  return Math.round(normalized); // Arredondar para inteiro
}
```
