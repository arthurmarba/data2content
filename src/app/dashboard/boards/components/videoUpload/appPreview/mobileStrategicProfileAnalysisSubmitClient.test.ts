import { postMobileStrategicProfileAnalysisJson } from "./mobileStrategicProfileAnalysisSubmitClient";

describe("mobileStrategicProfileAnalysisSubmitClient", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it("repete falha transitória e retorna sucesso sem expor payload bruto", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: jest.fn().mockResolvedValue({ ok: false, code: "provider_timeout" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, videoReadingPersistence: { saved: true, diagnosisId: "diag_1" } }),
      });

    const result = await postMobileStrategicProfileAnalysisJson({
      endpoint: "/api/dashboard/mobile-strategic-profile/analyze-real",
      body: { uploadSessionId: "video-temp-upload-session-abc_123" },
    });

    expect(result.response.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("não repete quando a leitura já foi salva para evitar duplicidade", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 502,
      json: jest.fn().mockResolvedValue({
        ok: false,
        code: "profile_synthesis_not_written",
        videoReadingPersistence: { saved: true, diagnosisId: "diag_saved" },
      }),
    });

    const result = await postMobileStrategicProfileAnalysisJson({
      endpoint: "/api/dashboard/mobile-strategic-profile/analyze-real",
      body: { uploadSessionId: "video-temp-upload-session-abc_123" },
    });

    expect(result.response.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
