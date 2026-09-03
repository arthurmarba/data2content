/** @jest-environment node */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createD2CMcpServer } from "./server";
import { generateMcpScriptDraft } from "./catalog";
import { findMcpCampaignOpportunities } from "./campaignRadar";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("./campaignRadar", () => ({
  extractCampaignRadarPrivateSignals: jest.fn(() => ["maternidade"]),
  findMcpCampaignOpportunities: jest.fn(async () => ({
    schemaVersion: "campaign_opportunities_v1",
    access: "weekly_selection",
    weekStartsOn: "2026-08-31",
    message: "Esta é a publicidade selecionada para você nesta semana.",
    accountNotice:
      "Sua conta permite consultar uma publicidade selecionada por semana no ChatGPT. " +
      "Outras publicidades não estão disponíveis para esta conta no momento. " +
      "Você pode conferir as informações da sua conta na plataforma Data2Content.",
    personalization: {
      basis: "declared_profile",
      instagramConnected: false,
      instagramSignalsUsed: false,
    },
    opportunities: [
      {
        title: "Campanha de maternidade",
        brand: "Marca",
        summary: "Campanha pública ativa.",
        opportunityType: "open_application",
        territories: ["Maternidade e família"],
        platforms: ["Instagram"],
        formats: ["Reel"],
        requirements: [],
        deliverables: ["1 Reel"],
        compensation: {
          label: "R$ 1.200",
          individualPayConfirmed: true,
          minimum: 1200,
          maximum: 1200,
          currency: "BRL",
        },
        applicationDeadline: "2026-09-30",
        sourcePlatform: "Influencer Brasil",
        sourceUrl: "https://example.test/source",
        application: {
          url: "https://example.test/apply",
          label: "Candidatar-se",
          requiresAccount: true,
        },
        fit: {
          type: "exact",
          label: "Atende aos critérios informados",
          reasons: ["Tem relação com maternidade."],
          unmetCriteria: [],
          acceptanceIsNotGuaranteed: true,
        },
        lastVerifiedAt: "2026-09-01T12:00:00.000Z",
      },
    ],
  })),
}));

jest.mock("./catalog", () => ({
  analyzeMcpCreatorPeriod: jest.fn(async () => ({
    schemaVersion: "period_analysis_v1",
    requestedPeriod: {
      startDate: "2026-08-01",
      endDate: "2026-08-07",
      timeZone: "America/Sao_Paulo",
      startInclusiveUtc: "2026-08-01T03:00:00.000Z",
      endExclusiveUtc: "2026-08-08T03:00:00.000Z",
    },
    filters: { format: "all" },
    inventory: {
      totalPosts: 2,
      byFormat: { reel: 1, carousel: 1, photo: 0, other: 0 },
      firstPostDate: "2026-08-02T12:00:00.000Z",
      lastPostDate: "2026-08-06T12:00:00.000Z",
      evidenceReturned: 2,
      evidenceTruncated: false,
    },
    coverage: {
      counting: { complete: true, method: "all_metric_documents_in_exact_utc_window" },
      captions: { available: 2, total: 2, ratio: 1 },
      classifications: { available: 2, total: 2, ratio: 1 },
      sceneAnalysis: { available: 1, total: 2, ratio: 0.5 },
      transcripts: { available: 1, total: 2, ratio: 0.5 },
      metrics: {
        reach: { available: 2, total: 2, ratio: 1 },
      },
      warnings: ["scene_analysis_coverage_partial", "transcript_coverage_partial"],
    },
    posts: [
      {
        id: "507f1f77bcf86cd799439013",
        instagramMediaId: "ig-1",
        postDate: "2026-08-06T12:00:00.000Z",
        format: "reel",
        type: "REEL",
        captionPreview: "Legenda",
        url: "https://instagram.com/p/example",
        metrics: { reach: 1200 },
        evidence: {
          hasCaption: true,
          hasClassification: true,
          hasSceneAnalysis: true,
          hasTranscript: true,
        },
      },
    ],
    receipt: {
      generatedAt: "2026-08-08T12:00:00.000Z",
      source: "data2content_metric_inventory",
      requestFingerprint: "2026-08-01:2026-08-07:America/Sao_Paulo:all",
      totalEvidencePosts: 2,
      returnedEvidencePostIds: ["507f1f77bcf86cd799439013"],
      lastDataUpdateAt: "2026-08-07T12:00:00.000Z",
      mustNotEstimate: true,
    },
  })),
  searchMcpKnowledge: jest.fn(async () => [
    { id: "script:507f1f77bcf86cd799439012", title: "Roteiro de teste", url: "https://example.test/script" },
  ]),
  fetchMcpKnowledgeItem: jest.fn(async () => null),
  generateMcpScriptDraft: jest.fn(async (params: { inspirationContentIds?: string[] }) => ({
    schemaVersion: "script_draft_v1",
    clientRequestId: "mcp-11111111-1111-4111-8111-111111111111",
    draft: { title: "Roteiro personalizado", content: "[ROTEIRO COPY-FIRST V1]\nCena de teste" },
    intelligence: { intelligenceVersion: "scripts_intelligence_v2" },
    inspirationReferences: {
      requestedIds: params.inspirationContentIds ?? [],
      usedIds: params.inspirationContentIds ?? [],
      copyBoundaryApplied: Boolean(params.inspirationContentIds?.length),
    },
    save: {
      requiresExplicitUserConfirmation: true,
      requiredScope: "scripts:write",
      nextTool: "save_script",
      instruction: "Peça confirmação.",
    },
    receipt: {
      usedCreatorIntelligence: true,
      usedCommunityInspiration: Boolean(params.inspirationContentIds?.length),
    },
  })),
  saveMcpScript: jest.fn(async () => ({
    schemaVersion: "script_save_v1",
    savedScript: {
      id: "script:507f1f77bcf86cd799439012",
      title: "Roteiro personalizado",
      content: "[ROTEIRO COPY-FIRST V1]\nCena de teste",
      url: "https://data2content.ai/dashboard/scripts?scriptId=507f1f77bcf86cd799439012",
      source: "ai",
      createdAt: "2026-08-08T12:00:00.000Z",
      updatedAt: "2026-08-08T12:00:00.000Z",
    },
    idempotency: {
      clientRequestId: "mcp-11111111-1111-4111-8111-111111111111",
      safeToRetry: true,
    },
    receipt: { savedAt: "2026-08-08T12:00:00.000Z", userConfirmed: true },
  })),
  getMcpCollabCreatorSuggestions: jest.fn(async () => ({
    schemaVersion: "collab_suggestions_v1",
    query: {
      themeKeyword: "IA para creators",
      context: null,
      contextLabel: null,
      periodDays: 180,
      limit: 3,
    },
    creators: [
      {
        id: "creator:507f1f77bcf86cd799439014",
        rank: 1,
        name: "Creator parceiro",
        username: "creatorparceiro",
        avatarUrl: null,
        followers: 12000,
        mediaKitUrl: "https://data2content.ai/mediakit/creator-parceiro",
        match: {
          score: 86.2,
          type: "THEME_MATCH",
          reason: "Produz conteúdo recente aderente ao tema informado.",
          matchedTheme: true,
          strongestSignals: [{ signal: "themeAffinity", score: 1 }],
        },
        evidence: {
          source: "avg_interactions",
          postCount: 6,
          avgInteractions: 420,
          avgReach: 8000,
          avgShares: 25,
          avgSaves: 40,
          latestPostDate: "2026-08-01T12:00:00.000Z",
        },
      },
    ],
    coverage: { returnedCreators: 1, onlyActiveConnectedCreators: true, warnings: [] },
    receipt: {
      generatedAt: "2026-08-08T12:00:00.000Z",
      source: "data2content_collab_scoring",
      recommendationIsNotContactConsent: true,
    },
  })),
  getMcpCreatorIntelligenceSnapshot: jest.fn(async () => ({
    schemaVersion: "creator_intelligence_v1",
    generatedAt: "2026-08-08T12:00:00.000Z",
    focus: null,
    lookbackDays: 180,
    strategy: null,
    creatorVoice: null,
    performanceLearning: null,
    visualPlaybook: {
      coverage: { totalPosts: 2, analyzedPosts: 1, ratio: 0.5, interactionsAvailable: 1 },
      baseline: { avgInteractions: 100 },
      patterns: { objects: [] },
      analysisProviderVersions: [{ providerVersion: "gemini:v1", postCount: 1 }],
    },
    coverage: {
      strategyAvailable: false,
      captionEvidenceCount: 0,
      dnaHasEnoughEvidence: false,
      styleSampleSize: 0,
      linkedOutcomeSampleSize: 0,
      linkedOutcomeConfidence: "low",
      visual: { totalPosts: 2, analyzedPosts: 1, ratio: 0.5, interactionsAvailable: 1 },
      warnings: ["strategy_context_unavailable"],
    },
    receipt: {
      source: "data2content_intelligence_profiles_and_content_evidence",
      captionEvidenceMetricIds: [],
      winningScriptIds: [],
      mustNotOverstateLowConfidenceSignals: true,
    },
  })),
  getMcpCreatorProfile: jest.fn(async () => ({ name: "Creator de teste" })),
  getMcpDeepContentAnalysis: jest.fn(async () => ({
    schemaVersion: "content_deep_analysis_v1",
    content: { id: "507f1f77bcf86cd799439013", caption: "Legenda" },
    classifications: { context: ["marketing"] },
    visualAndSpeech: { sceneElements: null, lifeAssets: [] },
    metrics: { reach: 1000 },
    coverage: {
      hasCaption: true,
      hasTranscript: false,
      transcriptIncluded: false,
      hasClassification: true,
      hasSceneAnalysis: false,
      hasMetrics: true,
    },
    receipt: {
      generatedAt: "2026-08-08T12:00:00.000Z",
      source: "data2content_content_record",
      evidenceContentId: "507f1f77bcf86cd799439013",
      mustNotInferMissingFields: true,
      transcriptRequiresExplicitOptIn: true,
    },
  })),
  researchMcpInspirationContent: jest.fn(async () => ({
    schemaVersion: "inspiration_research_v1",
    query: {
      mode: "winning_patterns",
      text: "IA",
      periodDays: 180,
      limit: 6,
      filters: {},
      trendDefinition: null,
      viralDefinition: null,
    },
    items: [
      {
        id: "inspiration:507f1f77bcf86cd799439020",
        rank: 1,
        creator: {
          name: "Creator referência",
          username: "creatorreferencia",
          instagramProfileUrl: "https://www.instagram.com/creatorreferencia/",
        },
        content: {
          url: "https://www.instagram.com/reel/example/",
          publishedAt: "2026-08-08T12:00:00.000Z",
          format: "reel",
          durationSeconds: 62,
          captionExcerpt: "Conteúdo sobre IA",
          openingExcerpt: "Você ainda faz isso manualmente?",
          openingSource: "spoken",
        },
        creativeSignals: {
          hookPattern: "question",
          hookPatternLabel: "Pergunta direta",
          tones: ["humor"],
          subjects: ["inteligência artificial"],
          narratives: ["tutorial"],
          scene: {
            placeId: "escritorio",
            objects: ["notebook"],
            framing: ["close"],
            aesthetics: ["luz_natural"],
          },
        },
        relevance: {
          score: 0.91,
          semanticScore: 0.8,
          matchedFilters: ["gancho:question"],
          reasons: ["desempenho fora da curva do próprio creator"],
        },
        performanceEvidence: {
          label: "outlier",
          relativeToCreatorBaseline: 2.1,
          acceleration72h: null,
          confidence: "medium",
          exactPrivateMetricsExposed: false,
        },
        adaptationGuidance: {
          borrow: ["A lógica de abertura em pergunta."],
          avoid: "Não copie frases.",
        },
      },
    ],
    coverage: {
      candidatePosts: 12,
      eligibleOptInCreators: 4,
      returnedPosts: 1,
      sceneAnalysisAvailable: 8,
      velocityAvailable: 0,
      warnings: [],
    },
    followUp: {
      detailTool: "analyze_inspiration_content",
      compareTool: "compare_inspiration_contents",
      scriptTool: "generate_script_draft",
      instruction: "Use os IDs.",
    },
    receipt: {
      generatedAt: "2026-08-08T12:00:00.000Z",
      source: "data2content_opt_in_community_content",
      onlyOptInCreators: true,
      exactPrivateMetricsExposed: false,
      fullThirdPartyTranscriptsExposed: false,
      mustNotPresentAsGuaranteedViral: true,
      trendScope: "data2content_community",
    },
  })),
  analyzeMcpInspirationContent: jest.fn(async () => ({
    schemaVersion: "inspiration_analysis_v1",
    inspiration: {
      id: "inspiration:507f1f77bcf86cd799439020",
      rank: 1,
      creator: { name: "Creator referência", username: "creatorreferencia", instagramProfileUrl: null },
      content: {
        url: "https://www.instagram.com/reel/example/",
        publishedAt: "2026-08-08T12:00:00.000Z",
        format: "reel",
        durationSeconds: 62,
        captionExcerpt: "Conteúdo sobre IA",
        openingExcerpt: "Você ainda faz isso manualmente?",
        openingSource: "spoken",
      },
      creativeSignals: {
        hookPattern: "question",
        hookPatternLabel: "Pergunta direta",
        tones: ["humor"],
        subjects: ["IA"],
        narratives: ["tutorial"],
        scene: { placeId: "escritorio", objects: ["notebook"], framing: ["close"], aesthetics: [] },
      },
      relevance: { score: 0.9, semanticScore: 0.8, matchedFilters: [], reasons: [] },
      performanceEvidence: {
        label: "outlier",
        relativeToCreatorBaseline: 2.1,
        acceleration72h: null,
        confidence: "medium",
        exactPrivateMetricsExposed: false,
      },
      adaptationGuidance: { borrow: ["Pergunta direta"], avoid: "Não copie frases." },
    },
    researchReading: { whatOpensAttention: "Pergunta direta" },
    coverage: {
      sceneAnalysisAvailable: true,
      performanceBaselineSampleSize: 6,
      velocityAvailable: false,
      warnings: [],
    },
    receipt: {
      generatedAt: "2026-08-08T12:00:00.000Z",
      source: "data2content_opt_in_community_content",
      onlyOptInCreators: true,
      fullTranscriptExcluded: true,
      rawPrivateMetricsExcluded: true,
      causalPerformanceClaimProhibited: true,
    },
  })),
  compareMcpInspirationContents: jest.fn(async () => ({
    schemaVersion: "inspiration_comparison_v1",
    comparedIds: [
      "inspiration:507f1f77bcf86cd799439020",
      "inspiration:507f1f77bcf86cd799439021",
    ],
    items: [{ id: "inspiration:507f1f77bcf86cd799439020" }],
    sharedPatterns: { hookPatterns: [{ value: "Pergunta direta", count: 2 }] },
    durationRange: { minimumSeconds: 45, maximumSeconds: 62, averageSeconds: 53.5 },
    synthesis: { strongestCommonPattern: "Pergunta direta" },
    coverage: { requested: 2, compared: 2, sceneAnalysisAvailable: 2, warnings: [] },
    receipt: {
      generatedAt: "2026-08-08T12:00:00.000Z",
      source: "data2content_opt_in_community_content",
      onlyOptInCreators: true,
      fullTranscriptsExcluded: true,
      rawPrivateMetricsExcluded: true,
    },
  })),
  getMcpPerformanceSummary: jest.fn(async () => null),
  listMcpTopContent: jest.fn(async () => []),
}));

jest.mock("./config", () => ({
  getInstagramConnectUrl: () => "https://data2content.ai/dashboard/instagram/connect?source=chatgpt&next=chatgpt-plugin",
  getMcpProfileUrl: () => "https://data2content.ai/dashboard/profile?source=chatgpt",
  getMcpCommunityJoinUrl: () => "https://data2content.ai/api/dashboard/community/pro-join?source=chatgpt",
  getMcpRequiredScope: () => "profile:read",
  isMcpCampaignRadarEnabled: () => process.env.MCP_CAMPAIGN_RADAR_ENABLED?.trim() === "1",
  getMcpConnectionScopes: () => [
    "profile:read",
    "profile:write",
    "metrics:read",
    "strategy:read",
    "content:read",
    "intelligence:read",
    "audience:read",
    "collabs:read",
    "scripts:generate",
    "scripts:write",
    "campaigns:read",
  ],
  getMcpResourceMetadataUrl: () =>
    "https://data2content.ai/.well-known/oauth-protected-resource",
}));

jest.mock("./creatorNorth", () => ({
  McpCreatorNorthValidationError: class McpCreatorNorthValidationError extends Error {},
  saveMcpCreatorNorth: jest.fn(async (_userId: string, creatorNorth: string) => ({
    schemaVersion: "creator_north_v1",
    creatorNorth,
    updatedAt: "2026-08-27T12:00:00.000Z",
    seedSignal: null,
    next: { tool: "build_creator_radar", instruction: "Pesquise padrões agregados." },
  })),
}));

jest.mock("./creatorRadar", () => ({
  buildMcpCreatorRadar: jest.fn(async ({ creatorNorth }: { creatorNorth: string }) => ({
    schemaVersion: "creator_radar_v1",
    creatorNorth,
    narrativePreview: { source: "creator_declared_north" },
    communityPanorama: {
      sampleSize: 4,
      formats: [{ value: "reel", count: 3, shareOfSample: 0.75 }],
      hooks: [{ value: "Pergunta direta", count: 2, shareOfSample: 0.5 }],
    },
    receipt: { onlyAggregateSignalsReturned: true, creatorIdentitiesExposed: false },
  })),
}));

function textPayload(result: Awaited<ReturnType<Client["callTool"]>>) {
  const textPart = result.content.find((part) => part.type === "text");
  if (!textPart || textPart.type !== "text") throw new Error("Expected an MCP text result");
  return JSON.parse(textPart.text) as Record<string, unknown>;
}

describe("Data2Content MCP server", () => {
  const originalCampaignRadarFlag = process.env.MCP_CAMPAIGN_RADAR_ENABLED;

  afterEach(() => {
    if (originalCampaignRadarFlag === undefined) delete process.env.MCP_CAMPAIGN_RADAR_ENABLED;
    else process.env.MCP_CAMPAIGN_RADAR_ENABLED = originalCampaignRadarFlag;
  });

  async function connect(
    instagramConnected: boolean,
    scopes = [
      "profile:read",
      "profile:write",
      "metrics:read",
      "content:read",
      "strategy:read",
      "intelligence:read",
      "collabs:read",
      "scripts:generate",
      "scripts:write",
      "campaigns:read",
    ],
    accessLevel: "free" | "pro" = "pro",
  ) {
    const server = createD2CMcpServer({
      identity: {
        userId: "507f1f77bcf86cd799439011",
        subject: "oauth-subject",
        scopes,
        issuer: "https://auth.example.test",
        token: "not-used-in-tools",
      },
      accountState: {
        accountAvailable: true,
        reason: accessLevel === "free"
          ? "ready_free"
          : instagramConnected
            ? "ready_pro_with_instagram"
            : "ready_pro_without_instagram",
        accessLevel,
        entitlement: {
          eligible: accessLevel === "pro",
          reason: accessLevel === "pro" ? "active" : "subscription_required",
          normalizedStatus: accessLevel === "pro" ? "active" : "inactive",
          validUntil: null,
          instagramConnected,
        },
        instagramConnected,
        creatorNorth: "Ajudo creators a transformar conhecimento em conteúdo claro.",
        northDeclared: true,
        communityInvitePending: accessLevel === "pro",
        capabilities: {
          aggregateCommunityContext: true,
          privateCreatorIntelligence: accessLevel === "pro" && instagramConnected,
          membershipBenefits: accessLevel === "pro",
        },
      },
    });
    const client = new Client({ name: "d2c-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return { client, server };
  }

  it("exposes read tools plus separated script draft and save actions", async () => {
    delete process.env.MCP_CAMPAIGN_RADAR_ENABLED;
    const { client, server } = await connect(true);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual([
        "get_account_state",
        "set_creator_north",
        "build_creator_radar",
        "search",
        "fetch",
        "get_creator_profile",
        "analyze_creator_period",
        "get_creator_intelligence_snapshot",
        "get_content_deep_analysis",
        "research_inspiration_content",
        "analyze_inspiration_content",
        "compare_inspiration_contents",
        "generate_script_draft",
        "save_script",
        "recommend_collab_creators",
        "get_performance_summary",
        "list_top_content",
        "compare_content_formats",
      ]);
      expect(tools.find((tool) => tool.name === "generate_script_draft")?.annotations).toMatchObject({
        readOnlyHint: true,
        idempotentHint: false,
      });
      expect(tools.find((tool) => tool.name === "set_creator_north")?.annotations).toMatchObject({
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: true,
        openWorldHint: false,
      });
      expect(tools.find((tool) => tool.name === "save_script")?.annotations).toMatchObject({
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
      });
      const accountStateTool = tools.find((tool) => tool.name === "get_account_state");
      expect(accountStateTool?._meta).toMatchObject({
        securitySchemes: [{ type: "oauth2", scopes: ["profile:read"] }],
      });
      expect(tools.find((tool) => tool.name === "set_creator_north")?._meta).toMatchObject({
        securitySchemes: [{ type: "oauth2", scopes: ["profile:read", "profile:write"] }],
      });
      expect(tools.find((tool) => tool.name === "generate_script_draft")?._meta).toMatchObject({
        securitySchemes: [{ type: "oauth2", scopes: ["profile:read", "scripts:generate"] }],
      });

      const protocol = server.server as unknown as {
        _requestHandlers: Map<
          string,
          (request: { method: string; params: Record<string, never> }, extra: unknown) => Promise<{
            tools: Array<Record<string, unknown>>;
          }>
        >;
      };
      const rawListTools = protocol._requestHandlers.get("tools/list");
      expect(rawListTools).toBeDefined();
      const rawResult = await rawListTools?.({ method: "tools/list", params: {} }, {});
      expect(rawResult?.tools.find((tool) => tool.name === "get_account_state")).toMatchObject({
        securitySchemes: [{ type: "oauth2", scopes: ["profile:read"] }],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("adds the read-only campaign tool only when the future rollout flag is enabled", async () => {
    process.env.MCP_CAMPAIGN_RADAR_ENABLED = "1";
    const { client, server } = await connect(false, undefined, "free");
    try {
      const { tools } = await client.listTools();
      expect(tools.find((tool) => tool.name === "find_campaign_opportunities")).toMatchObject({
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        _meta: {
          securitySchemes: [{ type: "oauth2", scopes: ["profile:read", "campaigns:read"] }],
        },
      });

      const result = await client.callTool({
        name: "find_campaign_opportunities",
        arguments: {
          query: "publicidade de maternidade",
          territories: ["Maternidade e família"],
          platforms: ["Instagram"],
          formats: ["Reel"],
          minimumConfirmedPay: 1000,
          includePrograms: false,
          limit: 5,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        access: "weekly_selection",
        opportunities: [{ application: { url: "https://example.test/apply" } }],
      });
      expect(JSON.stringify(result.structuredContent)).not.toContain("activePublicCatalog");
      expect(JSON.stringify(result.content)).not.toContain("free_closing_reminder_v1");
      expect(findMcpCampaignOpportunities).toHaveBeenCalledWith(expect.objectContaining({
        userId: "507f1f77bcf86cd799439011",
        search: expect.objectContaining({ minimumConfirmedPay: 1000 }),
      }));
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("adds analyzed Instagram signals to campaign matching only for an eligible connected account", async () => {
    process.env.MCP_CAMPAIGN_RADAR_ENABLED = "1";
    const { client, server } = await connect(true, undefined, "pro");
    try {
      await client.callTool({
        name: "find_campaign_opportunities",
        arguments: {
          query: "publicidade de maternidade",
          territories: [],
          platforms: [],
          formats: [],
          includePrograms: false,
          limit: 5,
        },
      });
      expect(findMcpCampaignOpportunities).toHaveBeenLastCalledWith(expect.objectContaining({
        privateContentSignals: ["maternidade"],
      }));
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns deep content evidence with explicit missing-field policy", async () => {
    const { client, server } = await connect(true);
    try {
      const result = await client.callTool({
        name: "get_content_deep_analysis",
        arguments: { contentId: "507f1f77bcf86cd799439013" },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        content: { id: "507f1f77bcf86cd799439013" },
        coverage: { hasTranscript: false },
        receipt: { mustNotInferMissingFields: true },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("researches opted-in community content with conversational creative filters", async () => {
    const { client, server } = await connect(true);
    try {
      const result = await client.callTool({
        name: "research_inspiration_content",
        arguments: {
          mode: "winning_patterns",
          query: "IA",
          filters: {
            formats: ["reel"],
            tones: ["humor"],
            hookPatterns: ["question"],
            minDurationSeconds: 45,
            sceneKeywords: ["escritório"],
            objects: ["notebook"],
            framing: ["close"],
            aesthetics: [],
          },
          periodDays: 180,
          limit: 6,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        schemaVersion: "inspiration_research_v1",
        items: [
          {
            id: "inspiration:507f1f77bcf86cd799439020",
            creativeSignals: { hookPattern: "question" },
            performanceEvidence: { exactPrivateMetricsExposed: false },
          },
        ],
        receipt: {
          onlyOptInCreators: true,
          fullThirdPartyTranscriptsExposed: false,
          mustNotPresentAsGuaranteedViral: true,
          trendScope: "data2content_community",
        },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("explains that a profile-only connection must be reauthorized for inspiration research", async () => {
    const { client, server } = await connect(true, ["profile:read"]);
    try {
      const result = await client.callTool({
        name: "research_inspiration_content",
        arguments: { mode: "winning_patterns", query: "", filters: {}, periodDays: 180, limit: 6 },
      });

      expect(result.isError).toBe(true);
      expect(textPayload(result)).toMatchObject({
        error: "insufficient_scope",
        requiredScope: "intelligence:read",
        action: "reauthorize_connector",
        reconnectRequired: true,
      });
      expect(result._meta).toMatchObject({
        "mcp/www_authenticate": [
          expect.stringContaining('error="insufficient_scope"'),
        ],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("requests only the baseline and write scopes when an older connection updates the North", async () => {
    const { client, server } = await connect(false, ["profile:read"], "free");
    try {
      const result = await client.callTool({
        name: "set_creator_north",
        arguments: { creatorNorth: "Ajudo pequenos negócios a criarem conteúdo com clareza." },
      });

      expect(result.isError).toBe(true);
      expect(textPayload(result)).toMatchObject({
        error: "insufficient_scope",
        requiredScope: "profile:write",
        action: "reauthorize_connector",
      });
      expect(result._meta).toMatchObject({
        "mcp/www_authenticate": [
          expect.stringContaining('scope="profile:read profile:write"'),
        ],
      });
      expect(JSON.stringify(result.content)).not.toContain("free_closing_reminder_v1");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("deepens a community inspiration without exposing transcript or raw private metrics", async () => {
    const { client, server } = await connect(true);
    try {
      const result = await client.callTool({
        name: "analyze_inspiration_content",
        arguments: { inspirationId: "inspiration:507f1f77bcf86cd799439020" },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        schemaVersion: "inspiration_analysis_v1",
        receipt: {
          fullTranscriptExcluded: true,
          rawPrivateMetricsExcluded: true,
          causalPerformanceClaimProhibited: true,
        },
      });
      expect(JSON.stringify(result.structuredContent)).not.toContain("transcript");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("requires Instagram only for personalized similar-to-me inspiration research", async () => {
    const { client, server } = await connect(false);
    try {
      const personalized = await client.callTool({
        name: "research_inspiration_content",
        arguments: { mode: "similar_to_me", query: "", filters: {}, periodDays: 180, limit: 6 },
      });
      expect(personalized.isError).toBe(true);
      expect(textPayload(personalized)).toMatchObject({ error: "instagram_connection_required" });

      const general = await client.callTool({
        name: "research_inspiration_content",
        arguments: { mode: "by_topic", query: "IA", filters: {}, periodDays: 180, limit: 6 },
      });
      expect(general.isError).not.toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns a structured, non-estimated receipt for exact periods", async () => {
    const { client, server } = await connect(true);
    try {
      const result = await client.callTool({
        name: "analyze_creator_period",
        arguments: {
          startDate: "2026-08-01",
          endDate: "2026-08-07",
          timeZone: "America/Sao_Paulo",
          format: "all",
          evidenceLimit: 50,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        inventory: { totalPosts: 2 },
        coverage: { counting: { complete: true } },
        receipt: { mustNotEstimate: true, totalEvidencePosts: 2 },
      });
      expect(textPayload(result)).toEqual(result.structuredContent);
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

  it("generates a script draft without saving and returns the confirmation contract", async () => {
    const { client, server } = await connect(true);
    try {
      const result = await client.callTool({
        name: "generate_script_draft",
        arguments: {
          prompt: "Crie um roteiro sobre inteligência artificial para creators",
          title: "IA para creators",
          lookbackDays: 180,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        schemaVersion: "script_draft_v1",
        draft: { title: "Roteiro personalizado" },
        save: {
          requiresExplicitUserConfirmation: true,
          nextTool: "save_script",
        },
        receipt: {
          usedCreatorIntelligence: true,
          usedCommunityInspiration: false,
        },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("passes selected community references into script generation with a copy boundary", async () => {
    const { client, server } = await connect(true);
    try {
      const inspirationId = "inspiration:507f1f77bcf86cd799439020";
      const result = await client.callTool({
        name: "generate_script_draft",
        arguments: {
          prompt: "Crie um roteiro sobre inteligência artificial",
          title: "IA prática",
          lookbackDays: 180,
          inspirationContentIds: [inspirationId],
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        inspirationReferences: {
          requestedIds: [inspirationId],
          usedIds: [inspirationId],
          copyBoundaryApplied: true,
        },
        receipt: { usedCommunityInspiration: true },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("saves a confirmed script with an idempotent request id", async () => {
    const { client, server } = await connect(true);
    try {
      const result = await client.callTool({
        name: "save_script",
        arguments: {
          clientRequestId: "mcp-11111111-1111-4111-8111-111111111111",
          title: "Roteiro personalizado",
          content: "[ROTEIRO COPY-FIRST V1]\nCena de teste",
          userConfirmed: true,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        schemaVersion: "script_save_v1",
        savedScript: { id: "script:507f1f77bcf86cd799439012" },
        idempotency: { safeToRetry: true },
        receipt: { userConfirmed: true },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns explainable collab matches with evidence and consent boundary", async () => {
    const { client, server } = await connect(true);
    try {
      const result = await client.callTool({
        name: "recommend_collab_creators",
        arguments: {
          themeKeyword: "IA para creators",
          context: "",
          periodDays: 180,
          limit: 3,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        schemaVersion: "collab_suggestions_v1",
        creators: [
          {
            name: "Creator parceiro",
            match: { type: "THEME_MATCH", matchedTheme: true },
            evidence: { postCount: 6, avgInteractions: 420 },
          },
        ],
        coverage: { onlyActiveConnectedCreators: true },
        receipt: { recommendationIsNotContactConsent: true },
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
        connectUrl: "https://data2content.ai/dashboard/instagram/connect?source=chatgpt&next=chatgpt-plugin",
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("gives free accounts a useful state with an informational profile reminder", async () => {
    const { client, server } = await connect(false, undefined, "free");
    try {
      const result = await client.callTool({ name: "get_account_state" });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        accessLevel: "free",
        northDeclared: true,
        contextDepth: "creator_north_and_aggregate_community",
        profileUrl: "https://data2content.ai/dashboard/profile?source=chatgpt",
        conversationPolicy: {
          accountState: "ready_free",
          availableContext: "north_and_aggregate",
          closingReminder: {
            frequency: "every_response",
            message: expect.stringContaining("perfil personalizado Data2Content"),
            url: "https://data2content.ai/dashboard/profile?source=chatgpt",
          },
          commercialBoundary: {
            mentionSubscription: false,
            directToCheckout: false,
            profileIsInformationalDestination: true,
          },
        },
        membership: {
          included: false,
          communityJoinPending: false,
          communityJoinUrl: null,
        },
      });
      expect(result.content).toHaveLength(1);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("keeps free context aggregate and blocks identifiable community references", async () => {
    const { client, server } = await connect(false, undefined, "free");
    try {
      const research = await client.callTool({
        name: "research_inspiration_content",
        arguments: { mode: "by_topic", query: "IA", filters: {}, periodDays: 180, limit: 6 },
      });
      expect(research.isError).toBe(true);
      expect(textPayload(research)).toMatchObject({
        error: "community_inspiration_unavailable",
        nextTool: "build_creator_radar",
        profileUrl: "https://data2content.ai/dashboard/profile?source=chatgpt",
      });

      const analysis = await client.callTool({
        name: "analyze_inspiration_content",
        arguments: { inspirationId: "inspiration:507f1f77bcf86cd799439020" },
      });
      expect(analysis.isError).toBe(true);
      expect(textPayload(analysis)).toMatchObject({ error: "community_inspiration_unavailable" });

      const comparison = await client.callTool({
        name: "compare_inspiration_contents",
        arguments: {
          inspirationIds: [
            "inspiration:507f1f77bcf86cd799439020",
            "inspiration:507f1f77bcf86cd799439021",
          ],
        },
      });
      expect(comparison.isError).toBe(true);
      expect(textPayload(comparison)).toMatchObject({ error: "community_inspiration_unavailable" });

      const privateResult = await client.callTool({ name: "get_performance_summary" });
      expect(privateResult.isError).toBe(true);
      expect(textPayload(privateResult)).toMatchObject({
        error: "private_creator_intelligence_unavailable",
        profileUrl: "https://data2content.ai/dashboard/profile?source=chatgpt",
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("guides PRO users without Instagram only when private context would help", async () => {
    const { client, server } = await connect(false, undefined, "pro");
    try {
      const result = await client.callTool({ name: "get_account_state" });

      expect(result.structuredContent).toMatchObject({
        accessLevel: "pro",
        instagramConnected: false,
        conversationPolicy: {
          accountState: "ready_pro_without_instagram",
          closingReminder: {
            frequency: "when_private_context_would_help",
            message: expect.stringContaining("cenário, gancho, roteiro, tom de voz"),
            url:
              "https://data2content.ai/dashboard/instagram/connect?source=chatgpt&next=chatgpt-plugin",
          },
          instagram: {
            requiredForPrivateCreatorAnalysis: true,
            optionalForOtherMembershipBenefits: true,
          },
        },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("offers the community footer only to PRO users and at most once per conversation", async () => {
    const { client, server } = await connect(true, undefined, "pro");
    try {
      const result = await client.callTool({ name: "get_account_state" });

      expect(result.structuredContent).toMatchObject({
        conversationPolicy: {
          closingReminder: { frequency: "none" },
          community: {
            included: true,
            inviteFrequency: "once_per_conversation",
            inviteMessage: expect.stringContaining("comunidade Data2Content"),
            joinUrl:
              "https://data2content.ai/api/dashboard/community/pro-join?source=chatgpt",
          },
        },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("allows a free creator to update their North inside ChatGPT", async () => {
    const { client, server } = await connect(false, undefined, "free");
    try {
      const result = await client.callTool({
        name: "set_creator_north",
        arguments: { creatorNorth: "Ajudo pequenos negócios a criarem conteúdo com clareza." },
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        schemaVersion: "creator_north_v1",
        creatorNorth: "Ajudo pequenos negócios a criarem conteúdo com clareza.",
        next: { tool: "build_creator_radar" },
      });
      expect(JSON.stringify(result.content)).toContain("free_closing_reminder_v1");
      expect(JSON.stringify(result.content)).toContain(
        "https://data2content.ai/dashboard/profile?source=chatgpt",
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("does not append the free profile reminder to successful PRO responses", async () => {
    const { client, server } = await connect(true, undefined, "pro");
    try {
      const result = await client.callTool({
        name: "generate_script_draft",
        arguments: {
          prompt: "Crie um roteiro sobre organização de conteúdo",
          title: "Organização",
          lookbackDays: 180,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(JSON.stringify(result.content)).not.toContain("free_closing_reminder_v1");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("builds the free radar without exposing creator identities", async () => {
    const { client, server } = await connect(false, undefined, "free");
    try {
      const result = await client.callTool({
        name: "build_creator_radar",
        arguments: { periodDays: 180 },
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        schemaVersion: "creator_radar_v1",
        communityPanorama: { sampleSize: 4 },
        receipt: { onlyAggregateSignalsReturned: true, creatorIdentitiesExposed: false },
      });
      expect(JSON.stringify(result.structuredContent)).not.toContain("creatorName");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("generates unlimited free-depth scripts from the North without private intelligence", async () => {
    const { client, server } = await connect(false, undefined, "free");
    try {
      const result = await client.callTool({
        name: "generate_script_draft",
        arguments: {
          prompt: "Crie um roteiro sobre organização de conteúdo",
          title: "Organização",
          lookbackDays: 180,
        },
      });
      expect(result.isError).not.toBe(true);
      expect(generateMcpScriptDraft).toHaveBeenLastCalledWith(expect.objectContaining({
        includePrivateIntelligence: false,
        prompt: expect.stringContaining("Norte declarado pelo creator"),
      }));
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("does not let free accounts bypass nominal research with inspiration IDs", async () => {
    const { client, server } = await connect(false, undefined, "free");
    try {
      const result = await client.callTool({
        name: "generate_script_draft",
        arguments: {
          prompt: "Crie um roteiro inspirado nesta referência",
          title: "Referência",
          lookbackDays: 180,
          inspirationContentIds: ["inspiration:507f1f77bcf86cd799439020"],
        },
      });

      expect(result.isError).toBe(true);
      expect(textPayload(result)).toMatchObject({
        error: "community_inspiration_unavailable",
        nextTool: "build_creator_radar",
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
