import {
  buildMobileNarrativeTelemetryContext,
  getSafeMobileNarrativeErrorCode,
  noopMobileNarrativeTelemetryProvider,
  sanitizeMobileNarrativeTelemetryPayload,
  trackMobileNarrativeEvent,
} from "./mobileNarrativeTelemetry";

describe("mobileNarrativeTelemetry", () => {
  it("mantem apenas payload seguro para profile_viewed", () => {
    expect(
      sanitizeMobileNarrativeTelemetryPayload({
        eventName: "mobile_profile_viewed",
        route: "/dashboard/boards/mobile-strategic-profile",
        accessState: "pro_instagram_connected",
        isPro: true,
        instagramConnected: true,
        quotaUsedThisMonth: 3,
        quotaLimit: 10,
        email: "creator@example.com",
        objectKey: "temporary/video.mp4",
      }),
    ).toMatchObject({
      eventName: "mobile_profile_viewed",
      route: "/dashboard/boards/mobile-strategic-profile",
      accessState: "pro_instagram_connected",
      isPro: true,
      instagramConnected: true,
      quotaUsedThisMonth: 3,
      quotaLimit: 10,
    });
  });

  it("remove texto livre, respostas e metadados proibidos", () => {
    const payload = sanitizeMobileNarrativeTelemetryPayload({
      creatorGoal: "por que esse vídeo prendeu atenção?",
      quickAnswers: [{ id: "content_intent", value: "Atrair marcas" }],
      signedUrl: "https://signed.example.test/upload?token=secret",
      uploadUrl: "https://signed.example.test/upload",
      objectKey: "temporary/video.mp4",
      localPath: "/tmp/video.mp4",
      storageProviderPath: "r2://bucket/key",
      rawGeminiResponse: "{ secret: true }",
      rawTranscript: "fala longa",
      fullDiagnosis: { summary: "diagnóstico completo" },
      selectedGoalOption: "retention",
      gateResult: "blocked",
      safeErrorCode: "gemini_timeout",
    } as any);

    expect(payload).toMatchObject({
      selectedGoalOption: "retention",
      gateResult: "blocked",
      safeErrorCode: "provider_timeout",
    });
    expect(JSON.stringify(payload)).not.toContain("creatorGoal");
    expect(JSON.stringify(payload)).not.toContain("quickAnswers");
    expect(JSON.stringify(payload)).not.toContain("signed");
    expect(JSON.stringify(payload)).not.toContain("temporary/video");
    expect(JSON.stringify(payload)).not.toContain("diagnóstico completo");
  });

  it("rejeita return route externo no contexto seguro", () => {
    expect(buildMobileNarrativeTelemetryContext({
      route: "//evil.example",
      accessState: "free_unused",
      quotaUsedThisMonth: 1,
      quotaLimit: 10,
    })).toMatchObject({
      accessState: "free_unused",
      quotaRemaining: 9,
    });
    expect(buildMobileNarrativeTelemetryContext({
      route: "//evil.example",
      quotaUsedThisMonth: 1,
      quotaLimit: 10,
    }).route).toBeUndefined();
  });

  it("provider noop nao quebra UI", () => {
    expect(() => {
      trackMobileNarrativeEvent(
        "mobile_analysis_submitted",
        {
          selectedGoalOption: "authority",
          creatorGoal: "texto livre proibido",
        } as any,
        noopMobileNarrativeTelemetryProvider,
      );
    }).not.toThrow();
  });

  it("emite evento sanitizado para provider injetado", () => {
    const provider = jest.fn();
    trackMobileNarrativeEvent(
      "mobile_analysis_failed",
      {
        safeErrorCode: "gemini_failed",
        rawModelResponse: "{ leak: true }",
      } as any,
      provider,
    );

    expect(provider).toHaveBeenCalledWith(
      "mobile_analysis_failed",
      expect.objectContaining({
        eventName: "mobile_analysis_failed",
        safeErrorCode: "provider_failed",
      }),
    );
    expect(JSON.stringify(provider.mock.calls[0][1])).not.toContain("rawModelResponse");
  });

  it("normaliza codigo de erro sem mensagens brutas", () => {
    expect(getSafeMobileNarrativeErrorCode({ code: "gemini_blocked" })).toBe("provider_blocked");
    expect(getSafeMobileNarrativeErrorCode(new Error("texto livre"))).toBe("unknown_error");
  });
});
