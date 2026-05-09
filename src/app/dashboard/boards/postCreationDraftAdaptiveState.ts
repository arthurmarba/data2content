import type { PostCreationFunnelState } from "./postCreationFunnel";
import {
  isMeaningfulPostCreationAdaptiveSnapshot,
  normalizePostCreationAdaptiveSnapshot,
  type PostCreationAdaptiveSnapshot,
} from "./postCreationAdaptiveSnapshot";

export type PostCreationDraftStateWithAdaptive = PostCreationFunnelState & {
  adaptive?: PostCreationAdaptiveSnapshot;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function extractPostCreationAdaptiveSnapshotFromDraftState(
  value: unknown,
): PostCreationAdaptiveSnapshot | null {
  if (!isRecord(value)) return null;
  const snapshot = normalizePostCreationAdaptiveSnapshot(value.adaptive);
  return isMeaningfulPostCreationAdaptiveSnapshot(snapshot) ? snapshot : null;
}

export function mergePostCreationAdaptiveSnapshotIntoDraftState(
  legacyState: PostCreationFunnelState,
  adaptiveSnapshot: PostCreationAdaptiveSnapshot | null | undefined,
): PostCreationFunnelState | PostCreationDraftStateWithAdaptive {
  if (!isMeaningfulPostCreationAdaptiveSnapshot(adaptiveSnapshot ?? null)) {
    return legacyState;
  }

  return {
    ...legacyState,
    adaptive: adaptiveSnapshot as PostCreationAdaptiveSnapshot,
  };
}

export function buildStablePostCreationAdaptiveSnapshotSignature(
  snapshot: PostCreationAdaptiveSnapshot | null | undefined,
): string {
  if (!isMeaningfulPostCreationAdaptiveSnapshot(snapshot ?? null)) return "";
  const { updatedAt: _updatedAt, ...stableSnapshot } = snapshot as PostCreationAdaptiveSnapshot;
  return JSON.stringify(stableSnapshot);
}

export function buildStablePostCreationDraftStateForSignature(
  state: PostCreationFunnelState | PostCreationDraftStateWithAdaptive,
): PostCreationFunnelState | PostCreationDraftStateWithAdaptive {
  const adaptiveSnapshot = extractPostCreationAdaptiveSnapshotFromDraftState(state);
  const legacyState = { ...(state as Record<string, unknown>) };
  delete legacyState.adaptive;

  if (!adaptiveSnapshot) {
    return legacyState as PostCreationFunnelState;
  }

  const { updatedAt: _updatedAt, ...stableAdaptiveSnapshot } = adaptiveSnapshot;
  return {
    ...(legacyState as PostCreationFunnelState),
    adaptive: stableAdaptiveSnapshot as PostCreationAdaptiveSnapshot,
  };
}
