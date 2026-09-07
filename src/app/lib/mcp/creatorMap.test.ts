import {
  MCP_CREATOR_MAP_SCHEMA_VERSION,
  resolveEvidenceLevel,
  summarizeMcpCreatorMap,
  type McpCreatorMap,
} from "./creatorMap";

function buildMap(overrides: Partial<McpCreatorMap> = {}): McpCreatorMap {
  return {
    schemaVersion: MCP_CREATOR_MAP_SCHEMA_VERSION,
    hasMap: true,
    narrative: "Sustento a casa e não quero perder a infância dela",
    territories: ["maternidade", "humor de casal"],
    themes: [],
    adjacentNarratives: [],
    assets: ["a filha", "a cozinha do apartamento"],
    tone: "afetuoso e direto",
    formats: ["reel"],
    maturity: "video_enriched",
    sources: ["instagram", "video"],
    evidenceLevel: "two_readings",
    narrativeIsFirm: true,
    updatedAt: null,
    vocabulary: {},
    usage: [],
    warnings: [],
    ...overrides,
  };
}

describe("mapa narrativo no MCP", () => {
  describe("nível de evidência", () => {
    it("trata o mapa só declarado como ponto de partida, não diagnóstico", () => {
      expect(resolveEvidenceLevel("seed", [])).toBe("declared");
    });

    it("reconhece uma leitura quando só o Instagram enriqueceu", () => {
      expect(resolveEvidenceLevel("instagram_enriched", [])).toBe("one_reading");
    });

    it("reconhece uma leitura quando só o vídeo enriqueceu", () => {
      expect(resolveEvidenceLevel("video_enriched", [])).toBe("one_reading");
    });

    it("só considera duas leituras quando Instagram e vídeo concordam", () => {
      expect(resolveEvidenceLevel("video_enriched", ["instagram", "video"])).toBe("two_readings");
    });

    it("não conta a mesma fonte duas vezes", () => {
      expect(resolveEvidenceLevel("instagram_enriched", ["instagram", "instagram"])).toBe(
        "one_reading",
      );
    });
  });

  describe("resumo embutido em respostas maiores", () => {
    it("leva narrativa, territórios e o nível de evidência", () => {
      const resumo = summarizeMcpCreatorMap(buildMap());
      expect(resumo.narrative).toContain("infância dela");
      expect(resumo.territories).toEqual(["maternidade", "humor de casal"]);
      expect(resumo.evidenceLevel).toBe("two_readings");
      expect(resumo.narrativeIsFirm).toBe(true);
    });

    it("não afirma narrativa firme quando há uma leitura só", () => {
      const resumo = summarizeMcpCreatorMap(
        buildMap({ evidenceLevel: "one_reading", narrativeIsFirm: false }),
      );
      expect(resumo.narrativeIsFirm).toBe(false);
    });

    it("limita os assets para não inflar a resposta", () => {
      const resumo = summarizeMcpCreatorMap(
        buildMap({ assets: Array.from({ length: 20 }, (_, i) => `asset ${i}`) }),
      );
      expect(resumo.assets).toHaveLength(8);
    });
  });
});
