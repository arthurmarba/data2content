import crypto from "crypto";

export const INSTAGRAM_RECONNECT_FLOW_COOKIE_NAME = "ig-reconnect-flow-id";

const FLOW_ID_MAX_LENGTH = 80;
const FLOW_ID_ALLOWED = /^[a-zA-Z0-9_-]+$/;

export function generateInstagramReconnectFlowId(): string {
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(6).toString("hex");
  return `igrc_${ts}_${rnd}`;
}

export function normalizeInstagramReconnectFlowId(value?: string | null): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > FLOW_ID_MAX_LENGTH) return null;
  if (!FLOW_ID_ALLOWED.test(trimmed)) return null;
  return trimmed;
}
