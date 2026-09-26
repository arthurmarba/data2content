/** @jest-environment node */
import { CREATOR_WEEKLY_REPORT_DEMO } from "./demoReport";
import { buildDiagnosisFacts } from "./diagnosisFacts";
import { buildDiagnosisPrompt, validateDiagnosis, writeDiagnosis, type DiagnosisGenerate } from "./diagnosisWriter";

const FACTS = buildDiagnosisFacts({
  report: CREATOR_WEEKLY_REPORT_DEMO,
  map: { narrative: null, narrativeIsFirm: false, territories: ["Maternidade"], assets: [], tone: null },
  previousHeadline: "Suas manhãs estão fazendo o trabalho pesado.",
  now: new Date("2026-08-11T15:00:00Z"),
});

const GOOD = {
  headline: "Suas manhãs viraram o seu melhor horário",
  paragraphs: [
    "A gente percebeu que, quando você posta entre 4h e 8h, seus posts têm o triplo do resultado de costume — isso já aconteceu em 7 posts.",
  ],
  nextTest: "Grave um vídeo em natureza e poste de manhã. Se ele for bem de novo, a natureza entra no seu jeito de gravar.",
  question: "A natureza funciona por ela ou pelo horário em que você posta?",
};

describe("validateDiagnosis", () => {
  it("aceita texto que só cita números dos fatos", () => {
    const result = validateDiagnosis(GOOD, FACTS);
    expect(result.ok).toBe(true);
  });

  it("recusa número que não está nos fatos, em algarismo ou por extenso", () => {
    const invented = validateDiagnosis(
      { ...GOOD, paragraphs: ["Seus salvamentos subiram 42% e você ganhou treze seguidores."] },
      FACTS,
    );
    expect(invented.ok).toBe(false);
    if (!invented.ok) {
      expect(invented.problems.join(" ")).toContain("42");
      expect(invented.problems.join(" ")).toContain("treze");
    }
  });

  it("recusa venda, algoritmo e 'poste mais'", () => {
    const result = validateDiagnosis(
      { ...GOOD, nextTest: "Poste mais cedo para agradar o algoritmo e assine o plano Pro." },
      FACTS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual(expect.arrayContaining(["fala de algoritmo", "fala de plano"]));
    }
    const more = validateDiagnosis({ ...GOOD, nextTest: "Poste mais nesta semana." }, FACTS);
    expect(more.ok).toBe(false);
  });

  it("exige pergunta, texto enxuto e manchete nova", () => {
    const result = validateDiagnosis(
      { ...GOOD, headline: FACTS.manchetePassada, paragraphs: ["Um.", "Dois.", "Três."], question: "Quer saber mais" },
      FACTS,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual(
        expect.arrayContaining([
          "repetiu a manchete da semana passada",
          "precisa de 1 a 2 parágrafos",
          "a pergunta precisa terminar com ?",
        ]),
      );
    }
  });

  it("recusa pergunta que é convite de sim ou não — o gancho precisa ser uma dúvida", () => {
    for (const question of [
      "Quer avaliar se vale testar um post no próximo sábado em plano médio?",
      "Você gostaria de testar a manhã de novo?",
      "Que tal gravar na natureza?",
    ]) {
      const result = validateDiagnosis({ ...GOOD, question }, FACTS);
      expect(result.ok).toBe(false);
    }
    expect(validateDiagnosis({ ...GOOD, question: "É o horário ou a natureza que faz o vídeo render?" }, FACTS).ok).toBe(true);
  });

  it("recusa manchete que enfeita sem dizer o quê", () => {
    const result = validateDiagnosis({ ...GOOD, headline: "Sem posts nesta semana, mas há pistas claras nos seus testes" }, FACTS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("a manchete usa palavra vaga; diga a coisa concreta");
  });

  it("recusa multiplicador na manchete: a amostra só vem no parágrafo", () => {
    const result = validateDiagnosis({ ...GOOD, headline: "Seu horário da manhã rendeu 3,2× em compartilhamentos" }, FACTS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toContain("a manchete tem multiplicador; ele vai no parágrafo, ao lado da amostra");
    // A manchete fala em palavras: nem contagem entra.
    const counted = validateDiagnosis({ ...GOOD, headline: "Com 7 posts de manhã, o horário virou seu forte" }, FACTS);
    expect(counted.ok).toBe(false);
    if (!counted.ok) expect(counted.problems).toContain("a manchete tem número; ela diz o achado em palavras");
  });

  it("recusa o jeito computador: ×, decimal, palavra de relatório e número demais", () => {
    const machine = [
      "A gente percebeu que posts entre 4h e 8h rendem 3,2× o normal, em 7 posts.",
      "A mediana dos seus posts entre 4h e 8h ficou alta em 7 posts.",
      "Entre 4h e 8h, em 7 posts de 90 dias, com 1 post na natureza, tudo subiu.",
    ];
    for (const paragraph of machine) {
      expect(validateDiagnosis({ ...GOOD, paragraphs: [paragraph] }, FACTS).ok).toBe(false);
    }
  });

  it("recusa resposta que nem é objeto", () => {
    expect(validateDiagnosis(null, FACTS).ok).toBe(false);
  });
});

describe("writeDiagnosis", () => {
  it("tenta de novo com o motivo da recusa e aceita a segunda", async () => {
    const prompts: string[] = [];
    const generate: DiagnosisGenerate = jest.fn(async ({ prompt }) => {
      prompts.push(prompt);
      const json = prompts.length === 1
        ? { ...GOOD, paragraphs: ["Você cresceu 42% na semana."] }
        : GOOD;
      return { json, provider: "gemini", model: "gemini-test" };
    });

    const result = await writeDiagnosis(FACTS, generate);

    expect(result.ok).toBe(true);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(prompts[1]).toContain("citou número que não está nos fatos: 42");
  });

  it("desiste depois de duas recusas", async () => {
    const generate: DiagnosisGenerate = jest.fn(async () => ({ json: { headline: "" }, provider: "gemini", model: "x" }));
    const result = await writeDiagnosis(FACTS, generate);
    expect(result).toEqual(expect.objectContaining({ ok: false, safeErrorCode: "diagnosis_rejected" }));
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("não insiste quando o modelo falha", async () => {
    const generate: DiagnosisGenerate = jest.fn(async () => {
      throw new Error("402 prepayment credits are depleted");
    });
    const result = await writeDiagnosis(FACTS, generate);
    expect(result).toEqual(expect.objectContaining({ ok: false, safeErrorCode: "diagnosis_llm_failed" }));
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("manda os fatos inteiros no pedido", () => {
    expect(buildDiagnosisPrompt(FACTS)).toContain('"efeito": "o triplo do resultado de costume"');
  });
});
