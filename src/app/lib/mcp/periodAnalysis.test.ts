/** @jest-environment node */

import {
  buildMcpPeriodAnalysis,
  McpPeriodValidationError,
  resolveMcpPeriodWindow,
} from "./periodAnalysis";

describe("MCP exact period analysis", () => {
  it("converts inclusive Sao Paulo civil dates to an exclusive UTC boundary", () => {
    const period = resolveMcpPeriodWindow({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      timeZone: "America/Sao_Paulo",
    });

    expect(period.inclusiveDays).toBe(31);
    expect(period.startInclusive.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("respects daylight-saving changes instead of assuming 24-hour days", () => {
    const period = resolveMcpPeriodWindow({
      startDate: "2026-11-01",
      endDate: "2026-11-01",
      timeZone: "America/New_York",
    });

    expect(period.startInclusive.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("rejects inverted and oversized date ranges", () => {
    expect(() =>
      resolveMcpPeriodWindow({
        startDate: "2026-08-10",
        endDate: "2026-08-01",
        timeZone: "America/Sao_Paulo",
      }),
    ).toThrow(McpPeriodValidationError);

    expect(() =>
      resolveMcpPeriodWindow({
        startDate: "2025-01-01",
        endDate: "2026-08-01",
        timeZone: "America/Sao_Paulo",
      }),
    ).toThrow("O período pode ter no máximo 366 dias.");
  });

  it("counts the complete inventory while bounding only the evidence list", () => {
    const result = buildMcpPeriodAnalysis({
      startDate: "2026-08-01",
      endDate: "2026-08-07",
      timeZone: "America/Sao_Paulo",
      startInclusive: new Date("2026-08-01T03:00:00.000Z"),
      endExclusive: new Date("2026-08-08T03:00:00.000Z"),
      format: "all",
      evidenceLimit: 1,
      generatedAt: new Date("2026-08-08T12:00:00.000Z"),
      documents: [
        {
          _id: "reel-1",
          instagramMediaId: "ig-reel-1",
          postDate: new Date("2026-08-06T12:00:00.000Z"),
          updatedAt: new Date("2026-08-07T10:00:00.000Z"),
          type: "REEL",
          description: "Legenda completa",
          classificationStatus: "completed",
          sceneElements: {
            provider: "gemini",
            objects: ["celular"],
          },
          stats: {
            reach: 1000,
            views: 1500,
            total_interactions: 100,
          },
        },
        {
          _id: "carousel-1",
          postDate: new Date("2026-08-02T12:00:00.000Z"),
          updatedAt: new Date("2026-08-03T10:00:00.000Z"),
          type: "CAROUSEL_ALBUM",
          description: "Carrossel",
          context: ["marketing"],
          stats: {
            reach: 800,
            total_interactions: 80,
          },
        },
      ],
      publishedEvidence: [
        {
          metricId: "reel-1",
          evidenceVersion: "published_content_evidence_v1",
          transcript: {
            fullText: "Transcrição integral",
            source: "gemini_video",
          },
          scenes: [{ role: "gancho", description: "Close no rosto" }],
          completeness: { transcript: true, scenes: true },
          analyzedAt: new Date("2026-08-07T11:00:00.000Z"),
        },
      ],
    });

    expect(result.inventory).toMatchObject({
      totalPosts: 2,
      byFormat: { reel: 1, carousel: 1, photo: 0, other: 0 },
      evidenceReturned: 1,
      evidenceTruncated: true,
    });
    expect(result.coverage).toMatchObject({
      counting: { complete: true },
      captions: { available: 2, total: 2, ratio: 1 },
      classifications: { available: 2, total: 2, ratio: 1 },
      sceneAnalysis: { available: 1, total: 2, ratio: 0.5 },
      // O carrossel não tem áudio: ele sai do total de transcrição em vez de
      // aparecer como transcrição faltando.
      transcripts: { available: 1, total: 1, ratio: 1, notApplicable: 1 },
    });
    expect(result.coverage.warnings).not.toContain("transcript_coverage_partial");
    expect(result.coverage.metrics.views).toEqual({ available: 1, total: 2, ratio: 0.5 });
    expect(result.receipt).toMatchObject({
      mustNotEstimate: true,
      totalEvidencePosts: 2,
      publishedEvidenceRecords: 1,
      returnedEvidencePostIds: ["reel-1"],
    });
    expect(result.posts[0]?.evidence).toMatchObject({
      hasTranscript: true,
      transcriptSource: "gemini_video",
      publishedEvidenceVersion: "published_content_evidence_v1",
    });
    expect(result.coverage.warnings).toContain("evidence_list_truncated");
  });

  it("não cobra transcrição de quem só publica foto", () => {
    const result = buildMcpPeriodAnalysis({
      startDate: "2026-08-01",
      endDate: "2026-08-07",
      timeZone: "America/Sao_Paulo",
      startInclusive: new Date("2026-08-01T03:00:00.000Z"),
      endExclusive: new Date("2026-08-08T03:00:00.000Z"),
      format: "all",
      evidenceLimit: 10,
      generatedAt: new Date("2026-08-08T12:00:00.000Z"),
      documents: [
        { _id: "foto-1", postDate: new Date("2026-08-02T12:00:00.000Z"), type: "IMAGE", description: "Foto", stats: {} },
        { _id: "foto-2", postDate: new Date("2026-08-03T12:00:00.000Z"), type: "CAROUSEL_ALBUM", description: "Carrossel", stats: {} },
      ] as never,
    });

    // Zero de zero, e não zero de dois: não há fala a coletar.
    expect(result.coverage.transcripts).toEqual({ available: 0, total: 0, ratio: 0, notApplicable: 2 });
    expect(result.coverage.warnings).not.toContain("transcript_coverage_partial");
    expect(result.receipt).toMatchObject({ transcriptCoverageCountsOnlyVideos: true });
  });

  it("não confunde o campo legado text_content com transcrição do vídeo", () => {
    const result = buildMcpPeriodAnalysis({
      startDate: "2026-08-01",
      endDate: "2026-08-01",
      timeZone: "America/Sao_Paulo",
      startInclusive: new Date("2026-08-01T03:00:00.000Z"),
      endExclusive: new Date("2026-08-02T03:00:00.000Z"),
      format: "all",
      evidenceLimit: 10,
      documents: [{
        _id: "legacy-1",
        description: "Legenda",
        postDate: new Date("2026-08-01T12:00:00.000Z"),
        // Documento legado deliberadamente fora do tipo atual.
        ...({ text_content: "Texto antigo que não veio do Gemini" } as Record<string, unknown>),
      }],
    });

    expect(result.coverage.transcripts).toEqual({ available: 0, total: 1, ratio: 0 });
    expect(result.posts[0]?.evidence.hasTranscript).toBe(false);
  });
});
