/** @jest-environment node */
import { adminPopulationQuery, buildAdminPortfolioPipeline, normalizeFollowerGrowth, summarizeAdminMetricWindow } from "./adminAnalytics";

describe("contratos de análise da base administrativa", () => {
  it("distingue criadores de todas as contas e escapa busca textual", () => {
    expect(adminPopulationQuery({})).toEqual({ $and: [{ role: { $nin: ["admin", "agency"] } }] });
    expect(adminPopulationQuery({ population: "all_accounts" })).toEqual({});
    const query = adminPopulationQuery({ query: ".*", connection: "disconnected" }) as any;
    expect(query.$and[2].$or[0].name.source).toBe("\\.\\*");
  });
  it("não soma métricas ausentes como zero observado", () => {
    const result = summarizeAdminMetricWindow({ posts: 3, current_total_interactions_available: 1, current_total_interactions: 0 }, "current");
    expect(result.metrics.total_interactions).toMatchObject({ sum: 0, availablePosts: 1, totalPosts: 3 });
    expect(result.metrics.reach.sum).toBeNull();
    expect(result.engagement.value).toBeNull();
  });
  it("calcula engajamento somente com os mesmos posts no numerador/denominador", () => {
    expect(summarizeAdminMetricWindow({ posts: 3, current_pairedPosts: 2, current_pairedReach: 200, current_pairedInteractions: 20 }, "current").engagement)
      .toMatchObject({ value: 0.1, eligiblePosts: 2 });
  });
  it("agrega a população antes de paginar e não carrega transcrições ou contatos", () => {
    const pipeline = buildAdminPortfolioPipeline({ startDate: "2026-08-01", endDate: "2026-08-31", timeZone: "America/Sao_Paulo", page: 2, limit: 10 });
    const facet = pipeline.at(-1) as any;
    expect(facet.$facet.summary[0]).toHaveProperty("$group");
    expect(facet.$facet.creators).toContainEqual({ $skip: 10 });
    expect(JSON.stringify(pipeline)).not.toMatch(/fullText|accessToken|email|\$out|\$merge/);
    expect(JSON.stringify(pipeline)).toContain("2026-08-01T03:00:00.000Z");
  });
  it("mede saldo de seguidores contra uma referência anterior à janela", () => {
    const pipeline = buildAdminPortfolioPipeline({ startDate: "2026-08-01", endDate: "2026-08-31", timeZone: "UTC" });
    const lookup = pipeline.find((stage: any) => stage.$lookup?.as === "followerReadings") as any;
    expect(lookup.$lookup.pipeline[0].$match.recordedAt.$gte.toISOString()).toBe("2026-07-02T00:00:00.000Z");
    // O $group separa o que é anterior à janela do que está dentro dela.
    expect(lookup.$lookup.pipeline[2].$group._id).toEqual({ $lt: ["$recordedAt", new Date("2026-08-01T00:00:00.000Z")] });
    expect(JSON.stringify(pipeline)).not.toMatch(/audienceDemographics|accountDetails/);
  });

  it("não confunde saldo ausente com saldo zero", () => {
    expect(normalizeFollowerGrowth(undefined)).toMatchObject({ netGain: null, followersAtStart: null, hasBaselineBeforePeriod: false });
    expect(normalizeFollowerGrowth({ netGain: 0, followersAtStart: 10, followersAtEnd: 10, readingsInPeriod: 3, hasBaselineBeforePeriod: true }))
      .toMatchObject({ netGain: 0, hasBaselineBeforePeriod: true, readingsInPeriod: 3 });
    expect(normalizeFollowerGrowth({ netGain: -4 }).netGain).toBe(-4);
  });

  it("separa fala de vídeo da leitura visual de foto e carrossel", () => {
    const pipeline = buildAdminPortfolioPipeline({ startDate: "2026-08-01", endDate: "2026-08-31", timeZone: "UTC" });
    const metricLookup = pipeline.find((stage: any) => stage.$lookup?.as === "stats") as any;
    const group = metricLookup.$lookup.pipeline.at(-1).$group;

    // Fala só conta em vídeo; leitura visual conta em foto e carrossel.
    expect(JSON.stringify(group.observed)).toContain('"$readingEvidence.speech"');
    expect(JSON.stringify(group.observed)).toContain('["REEL","VIDEO"]');
    expect(JSON.stringify(group.stillsVisuallyRead)).toContain('"$readingEvidence.visual"');
    expect(JSON.stringify(group.stills)).toContain('["IMAGE","CAROUSEL_ALBUM","CAROUSEL"]');
    // A leitura de evidência não pode arrastar transcrição para a agregação.
    const evidenceLookup = metricLookup.$lookup.pipeline.find((stage: any) => stage.$lookup?.as === "readingEvidence");
    expect(JSON.stringify(evidenceLookup)).not.toMatch(/fullText|segments/);
  });

  it("trata o carrossel antigo como carrossel no recorte de formato", () => {
    const pipeline = buildAdminPortfolioPipeline({ startDate: "2026-08-01", endDate: "2026-08-31", timeZone: "UTC", format: "carousel" });
    expect(JSON.stringify(pipeline)).toContain('["CAROUSEL_ALBUM","CAROUSEL"]');
  });

  it("recusa datas inválidas e alvos fora do contrato antes do banco", () => {
    expect(() => buildAdminPortfolioPipeline({ startDate: "2026-02-30", endDate: "2026-08-31", timeZone: "UTC" })).toThrow();
    expect(() => buildAdminPortfolioPipeline({ startDate: "2026-08-01", endDate: "2026-08-31", timeZone: "UTC", creatorIds: ["outro"] })).toThrow("invalid_admin_creator_ids");
  });
});
