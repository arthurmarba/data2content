import type { ScriptLinkType, ScriptOrigin } from "@/app/models/ScriptEntry";

type ScriptEntryMetadataShape = {
  source?: unknown;
  linkType?: unknown;
  plannerRef?: {
    weekStart?: unknown;
    slotId?: unknown;
  } | null;
  aiVersionId?: unknown;
};

const VALID_SCRIPT_ORIGINS = new Set<ScriptOrigin>(["manual", "ai", "planner"]);
const VALID_SCRIPT_LINK_TYPES = new Set<ScriptLinkType>(["standalone", "planner_slot"]);

function hasPlannerSlotLink(plannerRef: ScriptEntryMetadataShape["plannerRef"]) {
  return Boolean(
    plannerRef &&
      plannerRef.weekStart &&
      typeof plannerRef.slotId === "string" &&
      plannerRef.slotId.trim()
  );
}

function hasAiVersionId(aiVersionId: unknown) {
  return typeof aiVersionId === "string" && aiVersionId.trim().length > 0;
}

export function getNormalizedScriptEntryMetadata(entry: ScriptEntryMetadataShape): {
  source: ScriptOrigin;
  linkType: ScriptLinkType;
} {
  const source = VALID_SCRIPT_ORIGINS.has(entry.source as ScriptOrigin)
    ? (entry.source as ScriptOrigin)
    : hasPlannerSlotLink(entry.plannerRef)
      ? "planner"
      : hasAiVersionId(entry.aiVersionId)
        ? "ai"
        : "manual";

  const linkType = VALID_SCRIPT_LINK_TYPES.has(entry.linkType as ScriptLinkType)
    ? (entry.linkType as ScriptLinkType)
    : hasPlannerSlotLink(entry.plannerRef)
      ? "planner_slot"
      : "standalone";

  return { source, linkType };
}
