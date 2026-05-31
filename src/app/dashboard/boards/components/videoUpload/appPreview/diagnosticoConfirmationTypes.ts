/**
 * Confirmation state for a narrative map dimension (narrative, tone, territories).
 *
 * - pending   → creator has not yet responded; show the confirmation row
 * - confirmed → creator confirmed this signal fits their map
 * - dismissed → creator said it doesn't fit; hide or fade the signal
 */
export type ConfirmationState = "pending" | "confirmed" | "dismissed";

/**
 * The three possible creator responses when confirming a narrative dimension.
 */
export type ConfirmationResponse = "yes" | "almost" | "no";

/**
 * Per-asset confirmation for life-asset chips (used in ToneCard's "De onde você cria" block).
 */
export type AssetConfirmationResponse = "yes" | "occasional" | "no";
