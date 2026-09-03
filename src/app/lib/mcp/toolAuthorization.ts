export const MCP_TOOL_REQUIRED_SCOPES: Readonly<Record<string, readonly string[]>> = {
  search: ["content:read"],
  fetch: ["content:read"],
  get_creator_profile: ["profile:read"],
  get_performance_summary: ["metrics:read"],
  list_top_content: ["metrics:read"],
  compare_content_formats: ["metrics:read"],
  analyze_content_period: ["metrics:read", "strategy:read"],
  get_content_detail: ["metrics:read", "content:read"],
  get_data_coverage: ["metrics:read"],
  get_creator_intelligence_profile: ["intelligence:read"],
  get_video_diagnosis: ["intelligence:read"],
  get_audience_intelligence: ["audience:read"],
  get_creator_playbook: ["intelligence:read", "metrics:read"],
  suggest_collab_creators: ["collabs:read"],
  get_creator_content_dna: ["intelligence:read", "metrics:read", "audience:read"],
  generate_creator_script: ["scripts:generate", "content:read", "metrics:read", "intelligence:read", "audience:read"],
  critique_script_against_creator_dna: ["scripts:generate", "metrics:read", "intelligence:read", "audience:read"],
  save_generated_script: ["scripts:write"],
} as const;

type JsonRpcLike = {
  method?: unknown;
  params?: { name?: unknown; arguments?: unknown } | null;
  result?: unknown;
};

function messages(payload: unknown): JsonRpcLike[] {
  const values = Array.isArray(payload) ? payload : [payload];
  return values.filter((value): value is JsonRpcLike => Boolean(value && typeof value === "object"));
}

export function requiredScopesForMcpPayload(payload: unknown): string[] {
  const scopes = new Set<string>();
  for (const message of messages(payload)) {
    if (message.method !== "tools/call") continue;
    const toolName = typeof message.params?.name === "string" ? message.params.name : "";
    for (const scope of MCP_TOOL_REQUIRED_SCOPES[toolName] ?? []) scopes.add(scope);
  }
  return [...scopes];
}

export function mcpToolNamesForPayload(payload: unknown): string[] {
  const names = new Set<string>();
  for (const message of messages(payload)) {
    if (message.method !== "tools/call") continue;
    if (typeof message.params?.name === "string" && message.params.name) {
      names.add(message.params.name);
    }
  }
  return [...names];
}

function safePeriodDate(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 35) return undefined;
  return /^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(value) ? value : undefined;
}

export function mcpToolAuditForPayload(payload: unknown): Array<Record<string, unknown>> {
  return messages(payload).flatMap((message) => {
    if (message.method !== "tools/call" || typeof message.params?.name !== "string") return [];
    const name = message.params.name;
    const audit: Record<string, unknown> = { name };
    if (!["analyze_content_period", "get_data_coverage", "generate_creator_script", "critique_script_against_creator_dna", "save_generated_script"].includes(name)) return [audit];
    const args = message.params.arguments && typeof message.params.arguments === "object"
      ? message.params.arguments as Record<string, unknown>
      : {};
    if (typeof args.periodPreset === "string" && /^[a-z0-9_]{1,40}$/.test(args.periodPreset)) {
      audit.periodPreset = args.periodPreset;
    }
    if (typeof args.periodDays === "number" && Number.isInteger(args.periodDays)) audit.periodDays = args.periodDays;
    if (typeof args.format === "string" && ["all", "reel", "carousel", "photo"].includes(args.format)) {
      audit.format = args.format;
    }
    const startsAt = safePeriodDate(args.startsAt);
    const endsAt = safePeriodDate(args.endsAt);
    if (startsAt) audit.startsAt = startsAt;
    if (endsAt) audit.endsAt = endsAt;
    if (typeof args.goal === "string" && /^[a-z_]{1,30}$/.test(args.goal)) audit.goal = args.goal;
    if (typeof args.targetDurationSeconds === "number" && Number.isFinite(args.targetDurationSeconds)) {
      audit.targetDurationSeconds = args.targetDurationSeconds;
    }
    if (typeof args.prompt === "string") audit.promptCharacters = args.prompt.length;
    if (typeof args.content === "string") audit.contentCharacters = args.content.length;
    return [audit];
  });
}

export function mcpResultAuditForPayload(payload: unknown): Array<Record<string, unknown>> {
  return messages(payload).flatMap((message) => {
    const result = message.result && typeof message.result === "object"
      ? message.result as Record<string, unknown>
      : null;
    const structured = result?.structuredContent && typeof result.structuredContent === "object"
      ? result.structuredContent as Record<string, unknown>
      : null;
    const receipt = structured?.analysisReceipt && typeof structured.analysisReceipt === "object"
      ? structured.analysisReceipt as Record<string, unknown>
      : null;
    if (!receipt) return [];
    const allowedKeys = [
      "id",
      "status",
      "generatedAt",
      "periodPreset",
      "startsAt",
      "endsAt",
      "publishedCount",
      "collectedCount",
      "metricsEligibleCount",
      "fullyAnalyzedCount",
      "returnedSampleCount",
      "consistencyIssues",
    ];
    return [Object.fromEntries(allowedKeys
      .filter((key) => receipt[key] !== undefined)
      .map((key) => [key, receipt[key]]))];
  });
}

export function missingMcpScopes(granted: string[], required: string[]): string[] {
  const grantedSet = new Set(granted);
  return required.filter((scope) => !grantedSet.has(scope));
}
