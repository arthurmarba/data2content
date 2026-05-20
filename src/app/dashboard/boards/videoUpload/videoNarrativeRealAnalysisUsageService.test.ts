import CreatorVideoNarrativeRealAnalysisUsage from "@/app/models/CreatorVideoNarrativeRealAnalysisUsage";
import {
  assertCanRunVideoNarrativeRealAnalysis,
  getVideoNarrativeRealAnalysisUsageForUser,
  recordVideoNarrativeRealAnalysisAttempt,
  recordVideoNarrativeRealAnalysisFailure,
  recordVideoNarrativeRealAnalysisSuccess,
} from "./videoNarrativeRealAnalysisUsageService";

const userId = "507f1f77bcf86cd799439011";
const now = new Date("2026-05-20T12:00:00.000Z");
const env = {
  VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
  VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
  VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS: "creator@example.com",
};

function createMockModel(overrides: Partial<any> = {}) {
  return {
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    aggregate: jest.fn().mockResolvedValue([]),
    findOneAndUpdate: jest.fn().mockResolvedValue({
      _id: "usage_doc",
      dailyCount: 1,
      lastAttemptAt: now,
      lastSuccessAt: null,
      lastFailureAt: null,
    }),
    updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    ...overrides,
  } as any;
}

describe("videoNarrativeRealAnalysisUsageService", () => {
  it("retorna usage vazio para usuário novo", async () => {
    const model = createMockModel();
    const usage = await getVideoNarrativeRealAnalysisUsageForUser({ userId, now, model });

    expect(usage).toEqual(
      expect.objectContaining({
        userId,
        dateKey: "2026-05-20",
        monthKey: "2026-05",
        dailyCount: 0,
        monthlyCount: 0,
      }),
    );
  });

  it("recordAttempt incrementa contador sem salvar prompt/raw/video/objectKey/signedUrl", async () => {
    const model = createMockModel();
    const usage = await recordVideoNarrativeRealAnalysisAttempt({ userId, now, model });

    expect(usage.dailyCount).toBe(1);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.anything(), dateKey: "2026-05-20" }),
      expect.objectContaining({
        $inc: { dailyCount: 1 },
        $set: expect.objectContaining({ lastAttemptAt: now }),
      }),
      expect.objectContaining({ upsert: true }),
    );
    const writePayload = JSON.stringify(model.findOneAndUpdate.mock.calls[0][1]);
    expect(writePayload).not.toMatch(/prompt|raw|video|objectKey|signedUrl|uploadUrl/i);
  });

  it("recordSuccess registra sucesso", async () => {
    const model = createMockModel();
    await recordVideoNarrativeRealAnalysisSuccess({ userId, now, model });

    expect(model.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ dateKey: "2026-05-20" }),
      expect.objectContaining({ $set: expect.objectContaining({ lastSuccessAt: now }) }),
      { upsert: false },
    );
  });

  it("recordFailure registra falha segura", async () => {
    const model = createMockModel();
    await recordVideoNarrativeRealAnalysisFailure({
      userId,
      now,
      model,
      reason: "gemini_invalid_response_with_extra_context",
    });

    const payload = JSON.stringify(model.updateOne.mock.calls[0][1]);
    expect(payload).toContain("lastFailureReasonCode");
    expect(payload).not.toMatch(/prompt|raw|objectKey|signedUrl|uploadUrl/i);
  });

  it("limite diário bloqueia antes do Gemini", async () => {
    const model = createMockModel({
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ dailyCount: 5, lastAttemptAt: null }),
      }),
      aggregate: jest.fn().mockResolvedValue([{ total: 5 }]),
    });

    const decision = await assertCanRunVideoNarrativeRealAnalysis({
      user: { id: userId, email: "creator@example.com", role: "user" },
      env,
      now,
      model,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("daily_limit_reached");
  });

  it("limite mensal bloqueia", async () => {
    const model = createMockModel({
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ dailyCount: 1, lastAttemptAt: null }),
      }),
      aggregate: jest.fn().mockResolvedValue([{ total: 20 }]),
    });

    const decision = await assertCanRunVideoNarrativeRealAnalysis({
      user: { id: userId, email: "creator@example.com", role: "user" },
      env,
      now,
      model,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("monthly_limit_reached");
  });

  it("modelo não possui campos de prompt/raw response/object storage", () => {
    const paths = Object.keys(CreatorVideoNarrativeRealAnalysisUsage.schema.paths).join(",");
    expect(paths).not.toMatch(/prompt|raw|video|objectKey|signedUrl|uploadUrl/i);
  });
});
