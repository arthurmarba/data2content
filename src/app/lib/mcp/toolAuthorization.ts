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
} as const;

type JsonRpcLike = {
  method?: unknown;
  params?: { name?: unknown } | null;
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

export function missingMcpScopes(granted: string[], required: string[]): string[] {
  const grantedSet = new Set(granted);
  return required.filter((scope) => !grantedSet.has(scope));
}
