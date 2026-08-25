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

jest.mock("./creatorIntelligence", () => ({
  getMcpCreatorIntelligenceProfile: jest.fn(async () => ({ schemaVersion: "profile_v1" })),
  getMcpVideoDiagnosis: jest.fn(async () => ({ schemaVersion: "diagnosis_v1", diagnosisId: "diag-1" })),
  getMcpAudienceIntelligence: jest.fn(async () => ({ schemaVersion: "audience_v1" })),
  getMcpCreatorPlaybook: jest.fn(async () => ({ schemaVersion: "playbook_v1" })),
  getMcpIntelligenceLayerCoverage: jest.fn(async () => []),
}));

jest.mock("./collabIntelligence", () => ({
  suggestMcpCollabCreators: jest.fn(async () => ({ schemaVersion: "collabs_v1", items: [] })),
}));

jest.mock("./scriptIntelligence", () => ({
  getMcpCreatorContentDna: jest.fn(async () => ({
    schemaVersion: "creator_script_dna_v3",
    confidence: "high",
  })),
  generateMcpCreatorScript: jest.fn(async () => ({
    schemaVersion: "creator_script_generation_v3",
    title: "Roteiro gerado",
    content: "Cena 1\nFala: Este é um roteiro integral gerado para o teste.",
    estimatedDurationSeconds: 30,
    targetDurationSeconds: 30,
    evidenceReceipt: { status: "complete" },
    validation: { passed: true },
  })),
  critiqueMcpCreatorScript: jest.fn(async () => ({
    schemaVersion: "creator_script_critique_v1",
    passed: true,
  })),
  saveMcpGeneratedScript: jest.fn(async () => ({
    schemaVersion: "saved_script_v1",
    id: "507f1f77bcf86cd799439099",
    title: "Roteiro gerado",
    created: true,
    idempotentReplay: false,
  })),
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
        scopes: [
          "profile:read",
          "metrics:read",
          "content:read",
          "strategy:read",
          "intelligence:read",
          "audience:read",
          "collabs:read",
          "scripts:generate",
          "scripts:write",
        ],
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

  it("exposes read tools plus explicit generation and save tools", async () => {
    const { client, server } = await connect(true);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual([
        "search",
        "fetch",
        "get_creator_profile",
        "get_performance_summary",
        "list_top_content",
        "get_creator_intelligence_profile",
        "get_video_diagnosis",
        "get_audience_intelligence",
        "get_creator_playbook",
        "get_creator_content_dna",
        "generate_creator_script",
        "critique_script_against_creator_dna",
        "save_generated_script",
        "suggest_collab_creators",
        "compare_content_formats",
        "analyze_content_period",
        "get_content_detail",
        "get_data_coverage",
      ]);
      expect(tools.find((tool) => tool.name === "get_creator_content_dna")?.annotations?.readOnlyHint).toBe(true);
      expect(tools.find((tool) => tool.name === "generate_creator_script")?.annotations?.readOnlyHint).toBe(false);
      expect(tools.find((tool) => tool.name === "save_generated_script")?.annotations?.idempotentHint).toBe(true);
      const periodTool = tools.find((tool) => tool.name === "analyze_content_period");
      expect(JSON.stringify(periodTool?.inputSchema)).toContain("last_closed_week");
      expect(JSON.stringify(periodTool?.outputSchema)).toContain("publishedCount");
      expect(periodTool?.description).toContain("authoritative cadence field");
      expect(
        tools
          .filter((tool) => [
            "get_creator_intelligence_profile",
            "get_video_diagnosis",
            "get_audience_intelligence",
            "get_creator_playbook",
            "get_creator_content_dna",
            "generate_creator_script",
            "critique_script_against_creator_dna",
            "save_generated_script",
            "suggest_collab_creators",
            "analyze_content_period",
            "get_content_detail",
            "get_data_coverage",
          ].includes(tool.name))
          .every((tool) => tool.outputSchema != null),
      ).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns a generated script with a verifiable evidence receipt", async () => {
    const { client, server } = await connect(true);
    try {
      const result = await client.callTool({
        name: "generate_creator_script",
        arguments: { prompt: "Crie um Reel sobre criatividade", goal: "attention", targetDurationSeconds: 30 },
      });
      expect(textPayload(result)).toMatchObject({
        schemaVersion: "creator_script_generation_v3",
        title: "Roteiro gerado",
        evidenceReceipt: { status: "complete" },
      });
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
