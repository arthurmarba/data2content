import { CREATOR_WEEKLY_REPORT_DEMO } from "./demoReport";
import {
  allowedNumbers,
  buildDiagnosisFacts,
  diagnosisSampleLine,
  formatDiagnosisIndex,
  humanEffect,
  isDiagnosisEligible,
} from "./diagnosisFacts";

const MAP = {
  narrative: "Sustento a casa e não quero perder a infância dela",
  narrativeIsFirm: true,
  territories: ["Maternidade", "Rotina de casa"],
  assets: ["A filha", "A cozinha"],
  tone: "Conversa franca",
};

const NOW = new Date("2026-08-11T15:00:00Z");

describe("diagnosisFacts", () => {
  it("separa regra de aposta pela mesma régua dos cartões", () => {
    const facts = buildDiagnosisFacts({ report: CREATOR_WEEKLY_REPORT_DEMO, map: MAP, now: NOW });

    expect(facts.padroes.regras.length).toBeGreaterThan(0);
    expect(facts.padroes.regras.every((fact) => fact.posts >= 6)).toBe(true);
    expect(facts.padroes.testes.some((fact) => fact.posts === 1)).toBe(true);
    expect(facts.padroes.regras[0]).toEqual(
      expect.objectContaining({
        dimensao: "Horário",
        acao: "Poste entre 4h e 8h",
        efeito: "o triplo do resultado de costume",
        posts: 7,
        firmeza: "já se repetiu o bastante: dá pra confiar",
      }),
    );
  });

  it("leva as palavras do mapa e só elas", () => {
    const facts = buildDiagnosisFacts({ report: CREATOR_WEEKLY_REPORT_DEMO, map: MAP, now: NOW });
    expect(facts.mapa).toEqual({
      narrativa: MAP.narrative,
      narrativaFirme: true,
      territorios: MAP.territories,
      assets: MAP.assets,
      tom: MAP.tone,
    });

    const semMapa = buildDiagnosisFacts({ report: CREATOR_WEEKLY_REPORT_DEMO, map: null, now: NOW });
    expect(semMapa.mapa).toBeNull();
  });

  it("leva os assuntos que a leitura reconheceu, para ligar padrão a território", () => {
    const facts = buildDiagnosisFacts({ report: CREATOR_WEEKLY_REPORT_DEMO, map: MAP, now: NOW });
    expect(facts.assuntosObservados).toEqual(CREATOR_WEEKLY_REPORT_DEMO.overview.observedSubjects.slice(0, 8));
  });

  it("conta os dias desde a publicação do melhor post, para não chamar post novo de queda", () => {
    const facts = buildDiagnosisFacts({ report: CREATOR_WEEKLY_REPORT_DEMO, map: MAP, now: NOW });
    expect(facts.melhorPostDaSemana?.diasDesdeAPublicacao).toBeGreaterThanOrEqual(0);
    expect(facts.maturidadeDias).toBe(7);
  });

  it("aceita como número citável tudo o que está nos fatos, inclusive dentro dos rótulos", () => {
    const facts = buildDiagnosisFacts({ report: CREATOR_WEEKLY_REPORT_DEMO, map: MAP, now: NOW });
    const allowed = allowedNumbers(facts);
    // O modelo não recebe o multiplicador cru: só o efeito já em palavras.
    expect(allowed.has("3.2")).toBe(false);
    expect(allowed.has("14")).toBe(true);
    expect(allowed.has("90")).toBe(true);
    expect(allowed.has("8")).toBe(true);
    expect(allowed.has("9.9")).toBe(false);
  });

  it("formata o índice com vírgula e devolve nulo sem número", () => {
    expect(formatDiagnosisIndex(2.345)).toBe("2,3×");
    expect(formatDiagnosisIndex(null)).toBeNull();
    expect(formatDiagnosisIndex(Number.NaN)).toBeNull();
  });

  it("diz o efeito como gente, arredondando para a ordem de grandeza", () => {
    expect(humanEffect(1.04, "compartilhamentos")).toBe("um pouco mais de compartilhamentos");
    expect(humanEffect(1.53, "salvamentos")).toBe("50% mais salvamentos");
    expect(humanEffect(2.34, "compartilhamentos")).toBe("o dobro de compartilhamentos");
    expect(humanEffect(3.2, "visualizações")).toBe("o triplo de visualizações");
    expect(humanEffect(13.04, "compartilhamentos")).toBe("13 vezes mais compartilhamentos");
    expect(humanEffect(2.1, null)).toBe("o dobro do resultado de costume");
    expect(humanEffect(0.8, "salvamentos")).toBeNull();
  });

  it("calcula a linha de amostra", () => {
    expect(diagnosisSampleLine({ posts90d: 18, postsWeek: 2, postsWithScene: 12, scenePercent: 67 })).toBe(
      "Lemos 12 dos seus 18 posts dos últimos 3 meses",
    );
  });

  it("só escreve com relatório pronto e posts suficientes", () => {
    expect(isDiagnosisEligible(CREATOR_WEEKLY_REPORT_DEMO)).toBe(true);
    expect(isDiagnosisEligible({ ...CREATOR_WEEKLY_REPORT_DEMO, status: "failed" })).toBe(false);
    expect(
      isDiagnosisEligible({
        ...CREATOR_WEEKLY_REPORT_DEMO,
        coverage: { ...CREATOR_WEEKLY_REPORT_DEMO.coverage, posts90d: 2 },
      }),
    ).toBe(false);
    expect(isDiagnosisEligible(null)).toBe(false);
  });
});
