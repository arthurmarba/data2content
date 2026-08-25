import { mcpToolNamesForPayload, missingMcpScopes, requiredScopesForMcpPayload } from "./toolAuthorization";

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

  it("does not challenge tool discovery or unknown payloads", () => {
    expect(requiredScopesForMcpPayload({ method: "tools/list" })).toEqual([]);
    expect(requiredScopesForMcpPayload(null)).toEqual([]);
  });

  it("returns only scopes not already granted", () => {
    expect(missingMcpScopes(["profile:read", "metrics:read"], ["metrics:read", "strategy:read"]))
      .toEqual(["strategy:read"]);
  });
});
