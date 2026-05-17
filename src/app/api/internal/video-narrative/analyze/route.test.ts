jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}));

const {
  createBlockedVideoNarrativeGuardResult,
} = require("@/app/dashboard/boards/videoUpload/videoNarrativeGuardContracts");
const { GET, POST } = require("./route");
const getServerSession = require("next-auth/next").getServerSession as jest.Mock;

const FORBIDDEN_RESPONSE_FIELDS = [
  '"rawText"',
  "inlineVideoBase64",
  '"base64"',
  "apiKey",
  "GEMINI_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "signedUrl",
  "videoUrl",
];

const FORBIDDEN_LANGUAGE = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar garantido",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
  "venceu",
  "perdeu",
  "treinado permanentemente",
];

function enableEndpointFlag(): void {
  process.env.VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED = "true";
}

function disableEndpointFlag(): void {
  delete process.env.VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED;
}

function setProviderMode(mode: "disabled" | "mock" | "real"): void {
  if (mode === "disabled") {
    delete process.env.VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE;
    return;
  }

  process.env.VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE = mode;
}

function makeRequest(payload: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/internal/video-narrative/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

function validPayload(): Record<string, unknown> {
  return {
    id: "manual-video-narrative-run",
    creatorQuestion: "Qual é a leitura narrativa deste vídeo?",
    videoUri: "gemini://files/video-narrative-test",
    source: "gemini_file_api",
    expiresAt: "1970-01-01T01:00:00.000Z",
    creatorContext: {
      handle: "@d2c",
      niche: "educação",
      knownNarratives: ["bastidor", "prova social"],
    },
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function expectSafeResponse(body: unknown): void {
  const serialized = JSON.stringify(body);

  FORBIDDEN_RESPONSE_FIELDS.forEach((term) => {
    expect(serialized).not.toContain(term);
  });
}

describe("POST /api/internal/video-narrative/analyze skeleton", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    disableEndpointFlag();
    setProviderMode("disabled");
  });

  it("GET returns 405 and a safe response", async () => {
    const response = await GET();
    const body = await readJson(response);

    expect(response.status).toBe(405);
    expect(body.status).toBe("blocked");
    expectSafeResponse(body);
  });

  it("POST with flag off returns disabled before provider validation", async () => {
    getServerSession.mockResolvedValue(null);

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(body.status).toBe("disabled");
    expect(JSON.stringify(body)).toContain("Endpoint interno de vídeo desativado.");
    expectSafeResponse(body);
  });

  it("POST without session returns 401", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue(null);

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);

    expect(response.status).toBe(401);
    expect(body.status).toBe("blocked");
    expect(JSON.stringify(body)).toContain("Sessão não informada.");
  });

  it("POST with non admin/dev session returns 403", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { role: "member" } });

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(body.status).toBe("blocked");
    expect(JSON.stringify(body)).toContain("Acesso interno não permitido.");
  });

  it("POST admin/dev with invalid payload returns 400 and a safe issue", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(null));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.status).toBe("blocked");
    expect(JSON.stringify(body)).toContain("Payload não validado.");
    expectSafeResponse(body);
  });

  it("POST admin/dev with missing video returns 400", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { role: "dev" } });

    const response = await POST(makeRequest({ source: "gemini_file_api" }));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).toContain("Vídeo");
  });

  it("POST admin/dev with invalid source returns 400", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { isAdmin: true } });

    const response = await POST(makeRequest({ ...validPayload(), source: "unknown_source" }));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).toContain("Origem do vídeo");
  });

  it("POST admin/dev with invalid retention returns 400", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { isDev: true } });

    const response = await POST(makeRequest({ ...validPayload(), expiresAt: "invalid-date" }));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).toContain("Data de expiração");
  });

  it("POST admin/dev with mocked usage quota block returns 429", async () => {
    enableEndpointFlag();
    await jest.isolateModulesAsync(async () => {
      jest.doMock("next-auth/next", () => ({
        getServerSession: jest.fn().mockResolvedValue({ user: { role: "admin" } }),
      }));
      jest.doMock("@/app/api/auth/resolveAuthOptions", () => ({
        resolveAuthOptions: jest.fn().mockResolvedValue({}),
      }));
      jest.doMock("@/app/dashboard/boards/videoUpload/videoNarrativeUsageQuotaGuards", () => ({
        ...jest.requireActual("@/app/dashboard/boards/videoUpload/videoNarrativeUsageQuotaGuards"),
        validateVideoNarrativeUsageQuotaForPhase: jest.fn(() => ({
          ok: false,
          phase: "internal_endpoint",
          issues: [{ code: "daily_limit_exceeded", message: "Limite diário atingido." }],
          canAttemptAnalysis: false,
          guardResult: createBlockedVideoNarrativeGuardResult({
            name: "usage_quota",
            code: "usage_limited",
            message: "Limite diário atingido.",
          }),
        })),
      }));

      const { POST: isolatedPOST } = await import("./route");
      const response = await isolatedPOST(makeRequest(validPayload()));
      const body = await readJson(response);

      expect(response.status).toBe(429);
      expect(body.status).toBe("usage_limited");
      expect(JSON.stringify(body)).toContain("Limite diário atingido.");
    });
  });

  it("POST admin/dev with valid payload and provider mode disabled returns disabled without analysis or seed", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.status).toBe("disabled");
    expect(body.analysis).toBeNull();
    expect(body.seed).toBeNull();
    expect(JSON.stringify(body)).toContain("Provider interno desativado.");
    expectSafeResponse(body);
  });

  it("POST admin/dev with provider mode real returns disabled and does not call real provider", async () => {
    enableEndpointFlag();
    setProviderMode("real");
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.status).toBe("disabled");
    expect(JSON.stringify(body)).toContain("real_provider_disabled_in_mock_phase");
    expect(JSON.stringify(body)).toContain("Provider real continua desativado nesta fase.");
    expectSafeResponse(body);
  });

  it("POST admin/dev with provider mode mock returns ready with analysis, seed, and primaryAction", async () => {
    enableEndpointFlag();
    setProviderMode("mock");
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("ready");
    expect(body.analysis).toBeTruthy();
    expect(body.seed).toBeTruthy();
    expect(typeof body.primaryAction).toBe("string");
    expectSafeResponse(body);
  });

  it("POST mock mode brand question returns coherent brand potential hints", async () => {
    enableEndpointFlag();
    setProviderMode("mock");
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest({
      ...validPayload(),
      creatorQuestion: "Como adaptar esse vídeo para marca ou publi?",
      creatorContext: { knownNarratives: [] },
    }));
    const body = await readJson(response);
    const analysis = body.analysis as { brandMatch?: { enabled?: boolean; territories?: string[] } };
    const seed = body.seed as { brandMatchHints?: string[] };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(analysis.brandMatch?.enabled).toBe(true);
    expect(seed.brandMatchHints?.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).toContain("publi orgânica");
  });

  it("POST mock mode weak hook returns hook diagnosis and primaryAction", async () => {
    enableEndpointFlag();
    setProviderMode("mock");
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest({
      ...validPayload(),
      creatorQuestion: "Como melhorar o gancho?",
      creatorContext: { knownNarratives: [] },
    }));
    const body = await readJson(response);
    const analysis = body.analysis as { hook?: { strength?: string } };
    const seed = body.seed as { strategicDiagnosis?: string | null };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(analysis.hook?.strength).toBe("weak");
    expect(seed.strategicDiagnosis).toContain("gancho");
    expect(body.primaryAction).toBe("Transformar a sugestão de blueprint em roteiro.");
  });

  it("POST mock mode unclear returns follow-up questions without breaking", async () => {
    enableEndpointFlag();
    setProviderMode("mock");
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest({
      ...validPayload(),
      creatorQuestion: "Não sei, está confuso",
      creatorContext: { knownNarratives: [] },
    }));
    const body = await readJson(response);
    const seed = body.seed as { followUpQuestions?: unknown[] };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(seed.followUpQuestions?.length).toBeGreaterThan(0);
    expectSafeResponse(body);
  });

  it("response mock includes guard, usage, and observability summaries", async () => {
    enableEndpointFlag();
    setProviderMode("mock");
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);

    expect(body.guardSummary).toBeTruthy();
    expect(body.usageSummary).toBeTruthy();
    expect(body.observabilitySummary).toBeTruthy();
  });

  it("response mock includes local events without external analytics delivery", async () => {
    enableEndpointFlag();
    setProviderMode("mock");
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);
    const observabilitySummary = body.observabilitySummary as { events: Array<{ eventName: string }> };
    const eventNames = observabilitySummary.events.map((event) => event.eventName);

    expect(eventNames).toEqual(expect.arrayContaining([
      "video_narrative_analysis_requested",
      "video_narrative_analysis_started",
      "video_narrative_analysis_completed",
      "video_narrative_seed_created",
      "video_narrative_usage_not_consumed",
    ]));
    expect(JSON.stringify(body)).not.toContain("analytics.track");
  });

  it("rejects non JSON content-type", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(validPayload(), { "content-type": "text/plain" }));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).toContain("Content-type não validado.");
  });

  it("creates local observability summary without external delivery", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);
    const observabilitySummary = body.observabilitySummary as { events: unknown[] } | null;

    expect(observabilitySummary?.events.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(body)).toContain("video_narrative_analysis_requested");
  });

  it("reduces guard summary to safe fields", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(validPayload()));
    const body = await readJson(response);
    const guardSummary = body.guardSummary as { blockedBy: string | null; results: unknown[] };

    expect(guardSummary.blockedBy).toBe("provider");
    expect(guardSummary.results.length).toBeGreaterThan(0);
  });

  it("validates safe response before returning", async () => {
    const routeSource = require("fs").readFileSync(
      "src/app/api/internal/video-narrative/analyze/route.ts",
      "utf8",
    ) as string;

    expect(routeSource).toContain("validateVideoNarrativeSafeResponse");
  });

  it("does not import or call provider, SDK, network, storage, billing, analytics, UI, or database code", () => {
    const routeSource = require("fs").readFileSync(
      "src/app/api/internal/video-narrative/analyze/route.ts",
      "utf8",
    ) as string;
    const forbiddenFragments = [
      "runGeminiVideoNarrativeProviderFromEnv",
      "createGeminiVideoNarrativeClient",
      "GoogleGenAI",
      "fetch(",
      "prisma",
      "stripe",
      "upload",
      "storage",
      "analytics.track",
      "BoardShell",
      "React",
      "from \"@/components",
    ];

    forbiddenFragments.forEach((fragment) => {
      expect(routeSource).not.toContain(fragment);
    });
  });

  it("response strings do not use unsafe language", async () => {
    enableEndpointFlag();
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await POST(makeRequest(validPayload()));
    const serialized = JSON.stringify(await readJson(response)).toLowerCase();

    FORBIDDEN_LANGUAGE.forEach((term) => {
      expect(serialized).not.toContain(term.toLowerCase());
    });
  });
});
