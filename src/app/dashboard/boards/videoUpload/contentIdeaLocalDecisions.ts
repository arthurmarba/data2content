export type ContentIdeaLocalDecisionKind = "unsave" | "dismiss";

type StoredDecision = {
  kind: ContentIdeaLocalDecisionKind;
  at: string;
};

const STORAGE_PREFIX = "d2c:content-idea-local-decisions:v1";

export function contentIdeaLocalDecisionStorageKey(scope: string | null | undefined): string {
  const safeScope = scope?.trim() || "anonymous";
  return `${STORAGE_PREFIX}:${safeScope}`;
}

function readStore(key: string): Record<string, StoredDecision> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const result: Record<string, StoredDecision> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!id || !value || typeof value !== "object") continue;
      const kind = (value as { kind?: unknown }).kind;
      const at = (value as { at?: unknown }).at;
      if (kind !== "unsave" && kind !== "dismiss") continue;
      result[id] = {
        kind,
        at: typeof at === "string" ? at : new Date().toISOString(),
      };
    }
    return result;
  } catch {
    return {};
  }
}

function writeStore(key: string, store: Record<string, StoredDecision>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(store));
  } catch {
    // non-fatal: the server state remains authoritative when storage is unavailable.
  }
}

export function readContentIdeaLocalDecisions(key: string): Map<string, ContentIdeaLocalDecisionKind> {
  return new Map(
    Object.entries(readStore(key)).map(([id, decision]) => [id, decision.kind]),
  );
}

export function rememberContentIdeaLocalDecision(
  key: string,
  id: string,
  kind: ContentIdeaLocalDecisionKind,
) {
  const store = readStore(key);
  store[id] = { kind, at: new Date().toISOString() };
  writeStore(key, store);
}

export function forgetContentIdeaLocalDecision(key: string, id: string) {
  const store = readStore(key);
  if (!(id in store)) return;
  delete store[id];
  writeStore(key, store);
}
