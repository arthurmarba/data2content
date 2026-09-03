import {
  mcpResultAuditForPayload,
  mcpToolAuditForPayload,
  mcpToolNamesForPayload,
  missingMcpScopes,
  requiredScopesForMcpPayload,
} from "./toolAuthorization";

describe("MCP tool authorization", () => {
  it("discovers the scopes required by a tool call", () => {
    expect(requiredScopesForMcpPayload({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "analyze_content_period", arguments: { periodDays: 30 } },
    })).toEqual(["metrics:read", "strategy:read"]);
  });

  it("extrai nomes de tools para observabilidade sem registrar argumentos", () => {
    expect(mcpToolNamesForPayload([
      { method: "tools/call", params: { name: "analyze_content_period", arguments: { secret: "não-logar" } } },
      { method: "tools/call", params: { name: "get_data_coverage" } },
    ])).toEqual(["analyze_content_period", "get_data_coverage"]);
  });

  it("logs only allowlisted period dimensions and drops arbitrary arguments", () => {
    expect(mcpToolAuditForPayload({
      method: "tools/call",
      params: {
        name: "analyze_content_period",
        arguments: {
          periodPreset: "last_closed_week",
          format: "all",
          secret: "não-logar",
          query: "legenda privada",
        },
      },
    })).toEqual([{ name: "analyze_content_period", periodPreset: "last_closed_week", format: "all" }]);
  });

  it("extracts only the sanitized analysis receipt from MCP results", () => {
    expect(mcpResultAuditForPayload({
      result: {
        structuredContent: {
          analysisReceipt: {
            id: "receipt-1",
            status: "complete",
            periodPreset: "last_closed_week",
            publishedCount: 3,
            consistencyIssues: [],
            privateCaption: "não-logar",
          },
          topContent: [{ description: "não-logar" }],
        },
      },
    })).toEqual([{
      id: "receipt-1",
      status: "complete",
      periodPreset: "last_closed_week",
      publishedCount: 3,
      consistencyIssues: [],
    }]);
  });

  it("merges scope requirements for JSON-RPC batches", () => {
    expect(requiredScopesForMcpPayload([
      { method: "tools/call", params: { name: "search" } },
      { method: "tools/call", params: { name: "get_content_detail" } },
    ])).toEqual(["content:read", "metrics:read"]);
  });

  it("keeps audience, intelligence and collab permissions separate", () => {
    expect(requiredScopesForMcpPayload([
      { method: "tools/call", params: { name: "get_video_diagnosis" } },
      { method: "tools/call", params: { name: "get_audience_intelligence" } },
      { method: "tools/call", params: { name: "suggest_collab_creators" } },
    ])).toEqual(["intelligence:read", "audience:read", "collabs:read"]);
  });

  it("requires explicit generation and write scopes for script tools", () => {
    expect(requiredScopesForMcpPayload([
      { method: "tools/call", params: { name: "generate_creator_script" } },
      { method: "tools/call", params: { name: "save_generated_script" } },
    ])).toEqual([
      "scripts:generate",
      "content:read",
      "metrics:read",
      "intelligence:read",
      "audience:read",
      "scripts:write",
    ]);
  });

  it("audits only script sizes and safe controls, never prompt or content", () => {
    expect(mcpToolAuditForPayload({
      method: "tools/call",
      params: {
        name: "generate_creator_script",
        arguments: { prompt: "assunto privado", goal: "attention", targetDurationSeconds: 30 },
      },
    })).toEqual([{
      name: "generate_creator_script",
      goal: "attention",
      targetDurationSeconds: 30,
      promptCharacters: 15,
    }]);
  });

  it("does not challenge tool discovery or unknown payloads", () => {
    expect(requiredScopesForMcpPayload({ method: "tools/list" })).toEqual([]);
    expect(requiredScopesForMcpPayload(null)).toEqual([]);
  });

  it("returns only scopes not already granted", () => {
    expect(missingMcpScopes(["profile:read", "metrics:read"], ["metrics:read", "strategy:read"]))
      .toEqual(["strategy:read"]);
  });
});
