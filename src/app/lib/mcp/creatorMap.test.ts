import {
  applyMcpMapConfirmations,
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
    narrativeConfirmedByCreator: false,
    confirmations: { narrative: "pending", territories: "pending", tone: "pending" },
    confirmedAssets: [],
    rejectedByCreator: { narrative: null, territories: [], tone: null, assets: [], adjacentNarratives: [] },
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

  describe("respostas do creator no card", () => {
    const declarada = () => buildMap({ evidenceLevel: "declared", narrativeIsFirm: false, maturity: "seed", sources: [] });

    it("confirmação da narrativa a torna firme mesmo sem duas leituras", () => {
      const mapa = applyMcpMapConfirmations(declarada(), {
        narrative: { state: "confirmed", confirmedValue: "Sustento a casa e não quero perder a infância dela" },
      });
      expect(mapa.narrativeConfirmedByCreator).toBe(true);
      expect(mapa.narrativeIsFirm).toBe(true);
      expect(mapa.warnings).not.toContain("narrative_not_firm_yet");
    });

    it("confirmação de uma frase antiga não vale para a narrativa atual", () => {
      const mapa = applyMcpMapConfirmations(declarada(), {
        narrative: { state: "confirmed", confirmedValue: "Outra frase que o mapa já trocou" },
      });
      expect(mapa.confirmations.narrative).toBe("pending");
      expect(mapa.narrativeIsFirm).toBe(false);
    });

    it("asset recusado sai do dicionário e vai para rejectedByCreator", () => {
      const mapa = applyMcpMapConfirmations(buildMap(), {
        assets: [
          { label: "A Filha", state: "dismissed" },
          { label: "a cozinha do apartamento", state: "confirmed" },
        ],
      });
      expect(mapa.assets).toEqual(["a cozinha do apartamento"]);
      expect(mapa.confirmedAssets).toEqual(["a cozinha do apartamento"]);
      expect(mapa.rejectedByCreator.assets).toEqual(["a filha"]);
    });

    it("narrativa recusada deixa de ser usada e é avisada", () => {
      const mapa = applyMcpMapConfirmations(buildMap(), {
        narrative: { state: "dismissed", confirmedValue: null },
      });
      expect(mapa.narrative).toBeNull();
      expect(mapa.narrativeIsFirm).toBe(false);
      expect(mapa.rejectedByCreator.narrative).toContain("infância dela");
      expect(mapa.warnings).toContain("narrative_rejected_by_creator");
    });

    it("sem respostas, o mapa fica como estava", () => {
      const original = buildMap();
      expect(applyMcpMapConfirmations(original, null)).toBe(original);
    });
  });
});
