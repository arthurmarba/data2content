/** @jest-environment node */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createD2CAdminMcpServer } from "./adminServer";
import { beginMcpAdminAuditEvent, completeMcpAdminAuditEvent } from "./adminAudit";
import { getMcpAdminCreatorOverview, searchMcpAdminCreators } from "./adminCatalog";
import { getMcpDeepContentAnalysis } from "./catalog";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("./adminAudit", () => ({
  beginMcpAdminAuditEvent: jest.fn(async () => "invocation-test"),
  completeMcpAdminAuditEvent: jest.fn(async () => undefined),
}));

const mockBeginAdminAudit = beginMcpAdminAuditEvent as jest.MockedFunction<
  typeof beginMcpAdminAuditEvent
>;
const mockCompleteAdminAudit = completeMcpAdminAuditEvent as jest.MockedFunction<
  typeof completeMcpAdminAuditEvent
>;
const mockAdminCreatorOverview = getMcpAdminCreatorOverview as jest.MockedFunction<
  typeof getMcpAdminCreatorOverview
>;
const mockSearchAdminCreators = searchMcpAdminCreators as jest.MockedFunction<
  typeof searchMcpAdminCreators
>;
const mockDeepContentAnalysis = getMcpDeepContentAnalysis as jest.MockedFunction<
  typeof getMcpDeepContentAnalysis
>;

const creatorId = "507f1f77bcf86cd799439021";
const creatorRef = `creator:${creatorId}`;

const mockOverview = {
  schemaVersion: "admin_creator_overview_v1",
  creator: {
    id: creatorRef,
    name: "Creator Teste",
    username: "creator.teste",
    biography: null,
    avatarUrl: null,
    followersCount: 12000,
    followsCount: 500,
    instagramMediaCount: 90,
    url: `https://data2content.ai/admin/creators-management?creatorId=${creatorId}`,
  },
  account: { instagramConnected: true },
  coverage: {
    dataState: "connected",
    totalContentRecords: 8,
    firstContentDate: "2026-07-01T12:00:00.000Z",
    lastContentDate: "2026-08-07T12:00:00.000Z",
    lastDataUpdateAt: "2026-08-08T12:00:00.000Z",
    latestAudienceSnapshotAt: null,
    warnings: [],
  },
  receipt: {
    generatedAt: "2026-08-08T12:00:00.000Z",
    source: "data2content_admin_creator_inventory",
    targetCreatorId: creatorId,
    mustNotInferUnavailableData: true,
  },
};

jest.mock("./adminCatalog", () => ({
  parseAdminCreatorRef: (value: string) =>
    value === "creator:507f1f77bcf86cd799439021" ? "507f1f77bcf86cd799439021" : null,
  searchMcpAdminCreators: jest.fn(async () => [
    {
      id: "creator:507f1f77bcf86cd799439021",
      title: "Creator Teste (@creator.teste)",
      url: "https://data2content.ai/admin/creators-management?creatorId=507f1f77bcf86cd799439021",
      metadata: { instagramConnected: true },
    },
  ]),
  getMcpAdminCreatorOverview: jest.fn(async () => mockOverview),
  getMcpAdminCreatorAudience: jest.fn(async () => ({
    schemaVersion: "admin_creator_audience_v1",
    creatorRef: "creator:507f1f77bcf86cd799439021",
    coverage: { available: false, warnings: ["audience_demographics_unavailable"] },
    receipt: { aggregatedOnly: true, mustNotInferMissingBreakdowns: true },
  })),
  compareMcpAdminCreators: jest.fn(async () => ({
    schemaVersion: "admin_creator_comparison_v1",
    creators: [{ creator: { id: "creator:507f1f77bcf86cd799439021" } }],
    coverage: { requestedCreators: 2, comparedCreators: 1, warnings: ["one_or_more_creators_unavailable"] },
    receipt: { mustNotRankWithoutComparableCoverage: true },
  })),
  researchMcpAdminCreatorInspirations: jest.fn(async () => ({
    schemaVersion: "inspiration_research_v1",
    items: [],
    coverage: { warnings: ["no_matching_inspirations"] },
    receipt: { onlyOptInCreators: true, mustNotPresentAsGuaranteedViral: true },
  })),
}));

jest.mock("./catalog", () => ({
  analyzeMcpCreatorPeriod: jest.fn(async () => ({
    schemaVersion: "period_analysis_v1",
    inventory: { totalPosts: 2 },
    coverage: { counting: { complete: true }, warnings: [] },
    posts: [],
    receipt: { mustNotEstimate: true, totalEvidencePosts: 2 },
  })),
  getMcpCreatorIntelligenceSnapshot: jest.fn(async () => ({
    schemaVersion: "creator_intelligence_v1",
    coverage: { linkedOutcomeConfidence: "low", warnings: ["creator_voice_sample_low"] },
    receipt: { mustNotOverstateLowConfidenceSignals: true },
  })),
  getMcpDeepContentAnalysis: jest.fn(async () => ({
    schemaVersion: "content_deep_analysis_v1",
    content: { id: "507f1f77bcf86cd799439031", transcript: null },
    coverage: { hasTranscript: false, transcriptIncluded: false },
    receipt: { mustNotInferMissingFields: true, transcriptRequiresExplicitOptIn: true },
  })),
  listMcpTopContent: jest.fn(async () => []),
}));

function textPayload(result: Awaited<ReturnType<Client["callTool"]>>) {
  const part = result.content.find((item) => item.type === "text");
  if (!part || part.type !== "text") throw new Error("Expected text result");
  return JSON.parse(part.text) as Record<string, any>;
}

describe("Data2Content admin MCP server", () => {
  async function connect(scopes = [
    "admin:creators:search",
    "admin:creator:read",
    "admin:content:read",
    "admin:metrics:read",
    "admin:intelligence:read",
    "admin:audience:read",
    "admin:creators:compare",
  ]) {
    const server = createD2CAdminMcpServer({
      requestId: "request-test",
      identity: {
        userId: "507f1f77bcf86cd799439011",
        subject: "507f1f77bcf86cd799439011",
        scopes,
        issuer: "https://data2content.ai",
        token: "unused",
        clientId: "client-test",
      },
      authorization: {
        authorized: true,
        reason: "active_admin",
        actorUserId: "507f1f77bcf86cd799439011",
        role: "admin",
      },
    });
    const client = new Client({ name: "admin-mcp-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return { client, server };
  }

  it("exposes only read-only administrative tools", async () => {
    const { client, server } = await connect();
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual([
        "search",
        "fetch",
        "analyze_creator_period",
        "get_creator_contents",
        "get_creator_intelligence",
        "get_creator_content_details",
        "get_creator_audience",
        "list_creator_top_content",
        "research_creator_inspirations",
        "compare_creators",
      ]);
      expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
      expect(tools.every((tool) => tool.annotations?.destructiveHint === false)).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("implements standard search and fetch with a stable creator reference", async () => {
    const { client, server } = await connect();
    try {
      const search = await client.callTool({ name: "search", arguments: { query: "creator teste" } });
      expect(textPayload(search)).toEqual({
        results: [
          {
            id: creatorRef,
            title: "Creator Teste (@creator.teste)",
            url: `https://data2content.ai/admin/creators-management?creatorId=${creatorId}`,
          },
        ],
      });
      const fetch = await client.callTool({ name: "fetch", arguments: { id: creatorRef } });
      const fetched = textPayload(fetch);
      expect(fetched).toMatchObject({
        id: creatorRef,
        metadata: { receipt: { mustNotInferUnavailableData: true } },
      });
      expect(JSON.parse(fetched.text)).toMatchObject({ coverage: { totalContentRecords: 8 } });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("does not execute a data read when the initial audit write fails", async () => {
    mockSearchAdminCreators.mockClear();
    mockBeginAdminAudit.mockRejectedValueOnce(new Error("audit unavailable"));
    const { client, server } = await connect();
    try {
      const result = await client.callTool({
        name: "search",
        arguments: { query: "creator teste" },
      });
      expect(result.isError).toBe(true);
      expect(mockSearchAdminCreators).not.toHaveBeenCalled();
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("labels disconnected creators as historical without exposing secrets", async () => {
    mockAdminCreatorOverview.mockResolvedValueOnce({
      ...mockOverview,
      account: { instagramConnected: false },
      coverage: {
        ...mockOverview.coverage,
        dataState: "historical_only",
        warnings: ["instagram_disconnected"],
      },
    } as never);
    const { client, server } = await connect();
    try {
      const result = await client.callTool({ name: "fetch", arguments: { id: creatorRef } });
      const fetched = textPayload(result);
      const overview = JSON.parse(fetched.text);
      expect(overview).toMatchObject({
        account: { instagramConnected: false },
        coverage: { dataState: "historical_only", warnings: ["instagram_disconnected"] },
      });
      expect(JSON.stringify(fetched)).not.toMatch(/access.?token|refresh.?token|client.?secret/i);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns an exact period receipt tied to the selected creator", async () => {
    mockBeginAdminAudit.mockClear();
    mockCompleteAdminAudit.mockClear();
    const { client, server } = await connect();
    try {
      const result = await client.callTool({
        name: "analyze_creator_period",
        arguments: {
          creatorRef,
          startDate: "2026-08-01",
          endDate: "2026-08-07",
          timeZone: "America/Sao_Paulo",
          format: "all",
          evidenceLimit: 50,
        },
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        targetCreatorRef: creatorRef,
        inventory: { totalPosts: 2 },
        receipt: { mustNotEstimate: true },
      });
      expect(mockBeginAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
        tool: "analyze_creator_period",
        targetCreatorIds: [creatorId],
        period: {
          startDate: "2026-08-01",
          endDate: "2026-08-07",
          timeZone: "America/Sao_Paulo",
        },
      }));
      expect(mockCompleteAdminAudit).toHaveBeenCalledWith(
        "invocation-test",
        expect.objectContaining({ status: "success", resultCount: 0 }),
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("lists the exact content evidence for the selected creator", async () => {
    const { client, server } = await connect();
    try {
      const result = await client.callTool({
        name: "get_creator_contents",
        arguments: {
          creatorRef,
          startDate: "2026-08-01",
          endDate: "2026-08-07",
          timeZone: "America/Sao_Paulo",
          format: "all",
          limit: 50,
        },
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        targetCreatorRef: creatorRef,
        inventory: { totalPosts: 2 },
        posts: [],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("binds deep content lookup to the selected creator", async () => {
    mockDeepContentAnalysis.mockClear();
    const { client, server } = await connect();
    try {
      await client.callTool({
        name: "get_creator_content_details",
        arguments: { creatorRef, contentId: "507f1f77bcf86cd799439031" },
      });
      expect(mockDeepContentAnalysis).toHaveBeenCalledWith({
        userId: creatorId,
        contentId: "507f1f77bcf86cd799439031",
        includeTranscript: false,
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("only includes a full transcript after explicit opt-in", async () => {
    mockDeepContentAnalysis.mockClear();
    const { client, server } = await connect();
    try {
      await client.callTool({
        name: "get_creator_content_details",
        arguments: {
          creatorRef,
          contentId: "507f1f77bcf86cd799439031",
          includeTranscript: true,
        },
      });
      expect(mockDeepContentAnalysis).toHaveBeenCalledWith({
        userId: creatorId,
        contentId: "507f1f77bcf86cd799439031",
        includeTranscript: true,
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects a nonexistent creator reference", async () => {
    mockAdminCreatorOverview.mockResolvedValueOnce(null);
    const { client, server } = await connect();
    try {
      const result = await client.callTool({ name: "fetch", arguments: { id: creatorRef } });
      expect(result.isError).toBe(true);
      expect(textPayload(result)).toMatchObject({ error: "creator_not_found" });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("blocks a tool when the administrative scope is absent", async () => {
    const { client, server } = await connect(["admin:creators:search"]);
    try {
      const result = await client.callTool({ name: "fetch", arguments: { id: creatorRef } });
      expect(result.isError).toBe(true);
      expect(textPayload(result)).toMatchObject({
        error: "insufficient_scope",
        requiredScope: "admin:creator:read",
        action: "reauthorize_admin_connector",
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
