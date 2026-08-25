/** @jest-environment node */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createD2CMcpServer } from "./server";

jest.mock("./catalog", () => ({
  searchMcpKnowledge: jest.fn(async () => [
    { id: "script:507f1f77bcf86cd799439012", title: "Roteiro de teste", url: "https://example.test/script" },
  ]),
  fetchMcpKnowledgeItem: jest.fn(async () => null),
  getMcpCreatorProfile: jest.fn(async () => ({ name: "Creator de teste" })),
  getMcpPerformanceSummary: jest.fn(async () => null),
  listMcpTopContent: jest.fn(async () => []),
}));

jest.mock("./config", () => ({
  getInstagramConnectUrl: () => "https://data2content.ai/dashboard/instagram/connect?source=mcp",
}));

function textPayload(result: Awaited<ReturnType<Client["callTool"]>>) {
  const textPart = result.content.find((part) => part.type === "text");
  if (!textPart || textPart.type !== "text") throw new Error("Expected an MCP text result");
  return JSON.parse(textPart.text) as Record<string, unknown>;
}

describe("Data2Content MCP server", () => {
  async function connect(instagramConnected: boolean) {
    const server = createD2CMcpServer({
      identity: {
        userId: "507f1f77bcf86cd799439011",
        subject: "oauth-subject",
        scopes: ["profile:read", "metrics:read", "content:read", "strategy:read"],
        issuer: "https://auth.example.test",
        token: "not-used-in-tools",
      },
      entitlement: {
        eligible: true,
        reason: "active",
        normalizedStatus: "active",
        validUntil: null,
        instagramConnected,
      },
    });
    const client = new Client({ name: "d2c-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return { client, server };
  }

  it("exposes the read-only Data2Content tools", async () => {
    const { client, server } = await connect(true);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual([
        "search",
        "fetch",
        "get_creator_profile",
        "get_performance_summary",
        "list_top_content",
        "compare_content_formats",
        "analyze_content_period",
        "get_content_detail",
        "get_data_coverage",
      ]);
      expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
      expect(
        tools
          .filter((tool) => ["analyze_content_period", "get_content_detail", "get_data_coverage"].includes(tool.name))
          .every((tool) => tool.outputSchema != null),
      ).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns standard search JSON", async () => {
    const { client, server } = await connect(true);
    try {
      const result = await client.callTool({ name: "search", arguments: { query: "roteiro" } });
      expect(textPayload(result)).toEqual({
        results: [
          {
            id: "script:507f1f77bcf86cd799439012",
            title: "Roteiro de teste",
            url: "https://example.test/script",
          },
        ],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("keeps MCP available but gates Instagram-dependent tools", async () => {
    const { client, server } = await connect(false);
    try {
      const result = await client.callTool({ name: "get_performance_summary" });
      expect(result.isError).toBe(true);
      expect(textPayload(result)).toMatchObject({
        error: "instagram_connection_required",
        connectUrl: "https://data2content.ai/dashboard/instagram/connect?source=mcp",
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
