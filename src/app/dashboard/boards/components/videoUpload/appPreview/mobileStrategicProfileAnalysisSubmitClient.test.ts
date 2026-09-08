import { postMobileStrategicProfileAnalysisJson } from "./mobileStrategicProfileAnalysisSubmitClient";

describe("mobileStrategicProfileAnalysisSubmitClient", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it("não repete a geração após uma falha do servidor", async () => {
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

    expect(result.response.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
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

it('recupera resposta perdida consultando o trabalho, sem outro POST', async () => {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ job: { state: 'completed', httpStatus: 200, result: { ok: true, videoReadingPersistence: { saved: true, diagnosisId: 'saved' } } } }) });
  const result = await postMobileStrategicProfileAnalysisJson({ endpoint: '/api/dashboard/mobile-strategic-profile/analyze-real', body: { uploadSessionId: 'session' } });
  expect(result.response.ok).toBe(true);
  const calls = (global.fetch as jest.Mock).mock.calls;
  expect(calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  expect(calls[1][0]).toContain('?jobId=session');
});
it('retoma uma análise persistida sem reenviar o vídeo', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ job: { state: 'completed', httpStatus: 200, result: { ok: true } } }) });
  await postMobileStrategicProfileAnalysisJson({ endpoint: '/api/dashboard/mobile-strategic-profile/analyze-real', body: { recoveryJobId: 'saved-session' } });
  expect((global.fetch as jest.Mock).mock.calls.every(([, init]) => init.method !== 'POST')).toBe(true);
});
