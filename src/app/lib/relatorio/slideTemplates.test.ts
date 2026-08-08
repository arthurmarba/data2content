import type {
  ElementKind,
  Highlight,
  RankingRow,
  RankingTable,
  WeeklyReportData,
} from "./types";
import {
  buildCoverageManifest,
  buildSlides,
  expectedCoverageKeys,
} from "../../../../scripts/relatorio-semanal/lib/slideTemplates";
import { renderStoryCardHtml } from "../../../../scripts/relatorio-semanal/lib/storyCard";

function rows(kind: ElementKind, count: number, prefix: string): RankingRow[] {
  return Array.from({ length: count }, (_, index) => ({
    kind,
    key: `${prefix}-${index}`,
    label:
      index === count - 1
        ? `${prefix} — frase muito extensa que precisa continuar aparecendo integralmente no relatório mesmo quando ocupa várias linhas`
        : `${prefix} ${index + 1}`,
    occurrences: index % 3 === 0 ? 1 : 2,
    creators: index % 3 === 0 ? 1 : 2,
    occurrencesInWindow: index + 3,
    metrics: [
      { metric: "comentarios", index: index % 4 === 0 ? 0.8 : 1.4 },
      { metric: "engajamento", index: index % 5 === 0 ? 1.8 : 1.1 },
    ],
    medianViews: (index + 1) * 1_000,
    movement: null,
    fitsCount: 2,
    fitsOutOf: 12,
    pullsDown: index % 4 === 0,
    evidence: index > 20 ? "tendencia" : index > 4 ? "sinal" : "indicio",
    sampleCreatorId: `creator-${index}`,
    sampleCreatorName: `Criador ${index + 1}`,
  }));
}

function table(kind: ElementKind, count: number, prefix: string): RankingTable {
  return {
    kind,
    title: prefix,
    sortedBy: "comentarios",
    columns: ["comentarios"],
    rows: rows(kind, count, prefix),
    reading: `Leitura completa de ${prefix}.`,
    cutoffNote: "Nada foi cortado.",
  };
}

const highlightKinds: Highlight["kind"][] = [
  "destaque_do_territorio",
  "video_da_comunidade",
  "frase_da_semana",
  "coragem",
  "consistencia",
  "virada",
];

function denseReport(): WeeklyReportData {
  const count = 120;
  return {
    meta: {
      weekKey: "2026-W29",
      startsAt: "2026-07-13T00:00:00.000Z",
      endsAt: "2026-07-20T00:00:00.000Z",
      timezone: "America/Sao_Paulo",
      generatedAt: "2026-07-20T00:00:00.000Z",
      windowDays: 90,
      schemaVersion: "weekly_report_v1",
    },
    cover: {
      isoWeek: 29,
      isoYear: 2026,
      rangeLabel: "13 a 19 de julho",
      creators: 12,
      territories: 1,
      videos: 18,
      engagementDeltaPct: 4,
    },
    overview: [{
      territoryId: "dense",
      label: "Território denso",
      posts: 18,
      creators: 12,
      movement: null,
      metrics: [{ metric: "comentarios", index: 1.4 }],
    }],
    previousPrediction: null,
    territories: [{
      header: {
        territoryId: "dense",
        label: "Território denso",
        creators: 12,
        creatorsWhoPosted: 12,
        narratives: 30,
        engagementDeltaPct: 4,
        scene: { read: 18, videos: 18 },
      },
      narratives: Array.from({ length: 30 }, (_, index) => ({ label: `Narrativa extensa ${index + 1}`, creators: 1 })),
      temas: table("tema", count, "Tema"),
      falas: table("fala", count, "Fala"),
      assuntos: table("assunto", count, "Assunto"),
      tons: table("tom", count, "Tom"),
      assets: table("asset", count, "Asset"),
      objetos: table("objeto", count, "Objeto"),
      locais: table("local", count, "Local"),
      enquadramentos: table("enquadramento", count, "Enquadramento"),
      esteticas: table("estetica", count, "Estética"),
      horarios: table("horario", count, "Horário"),
      duracoes: table("duracao", count, "Duração"),
      timeGrid: {
        slotLabels: ["0–4h", "4–8h", "8–12h", "12–16h", "16–20h", "20–24h"],
        cells: Array.from({ length: 42 }, (_, index) => ({
          dayOfWeek: index % 7,
          slot: Math.floor(index / 7),
          index: 1 + (index % 3) / 10,
          posts: 1,
        })),
        emptySlots: [],
      },
      durations: Array.from({ length: 15 }, (_, index) => ({
        label: `${index * 10}–${index * 10 + 9}s`,
        minSeconds: index * 10,
        maxSeconds: index * 10 + 9,
        posts: 2,
        retentionIndex: 1.1,
        engagementIndex: 1.2,
        rawRetention: 0.6,
      })),
      topVideos: Array.from({ length: 18 }, (_, index) => ({
        creatorName: `Criador ${index + 1}`,
        creatorHandle: null,
        postLink: null,
        thumbnailUrl: null,
        durationSeconds: 30,
        retention: 0.6,
        metrics: [{ metric: "comentarios", index: 1.4 }],
        standout: [{ metric: "comentarios", index: 1.4 }],
        elements: [`Elemento ${index + 1}`],
        screenTitle: `Título ${index + 1}`,
        openingLine: `Abertura ${index + 1}`,
      })),
      gaps: Array.from({ length: 4 }, (_, index) => ({ title: `Lacuna ${index + 1}`, detail: "Oportunidade ainda vazia." })),
      matrix: Array.from({ length: 45 }, (_, index) => ({
        kind: "assunto" as const,
        label: `Matriz ${index + 1}`,
        cells: [{ metric: "comentarios" as const, index: 1.3, intensity: 3 as const }],
      })),
      strongCombination: {
        elements: ["Casa", "Humor", "Família"],
        occurrences: 4,
        creators: 3,
        windowLabel: "90 dias",
        metrics: [{ metric: "comentarios", index: 1.8 }],
      },
      pautas: Array.from({ length: 25 }, (_, index) => ({
        narrative: `Narrativa ${index + 1}`,
        headline: `Pauta acionável ${index + 1}`,
        source: {
          kind: "tema" as const,
          label: `Tema ${index + 1}`,
          metric: "comentarios" as const,
          index: 1.4,
          evidence: "sinal" as const,
        },
      })),
    }],
    crossTerritory: Array.from({ length: 20 }, (_, index) => ({
      label: `Padrão ${index + 1}`,
      kind: "assunto" as const,
      metric: "comentarios" as const,
      byTerritory: [{ territoryId: "dense", index: 1.2 }],
      reading: `Leitura cruzada ${index + 1}`,
    })),
    highlights: highlightKinds.map((kind, index) => ({
      kind,
      label: `Prêmio ${index + 1}`,
      creatorName: `Premiado ${index + 1}`,
      creatorHandle: null,
      creatorAvatarUrl: null,
      territoryId: "dense",
      territoryLabel: "Território denso",
      result: "Resultado completo",
      isFreePlan: false,
      post: null,
      plain: "Explicação do resultado.",
    })),
    silentCreators: [],
    prediction: null,
    meeting: { weekdayLabel: "Segunda", timeLabel: "19h", blocks: [{ label: "Hall", minutes: 20, audience: "todos" }] },
  };
}

describe("slideTemplates — completude e paginação", () => {
  it("gera mais de 100 slides sem perder nenhuma chave, mesmo sem imagens", () => {
    const report = denseReport();
    const slides = buildSlides(report);
    const manifest = buildCoverageManifest(report, slides);

    expect(slides.length).toBeGreaterThan(100);
    expect(manifest.expected).toHaveLength(expectedCoverageKeys(report).length);
    expect(manifest.missing).toEqual([]);
    expect(manifest.duplicatePrimary).toEqual([]);
    expect(slides.some((slide) => slide.html.includes("frase muito extensa"))).toBe(true);
    expect(slides.filter((slide) => slide.id.includes("matriz")).length).toBeGreaterThan(1);
    expect(slides.filter((slide) => slide.id.includes("pautas")).length).toBeGreaterThan(1);
  });

  it("exibe o texto completo de cada narrativa nas sugestões de pauta", () => {
    const report = denseReport();
    const completeNarrative =
      "Uma criadora que transforma experiências reais de maternidade e relacionamento em conversas honestas para a comunidade";
    report.territories[0]!.pautas[0]!.narrative = completeNarrative;

    const pautaSlides = buildSlides(report).filter((slide) => slide.family === "opportunities");
    const html = pautaSlides.map((slide) => slide.html).join("\n");

    expect(html).toContain(completeNarrative);
    expect(html).not.toContain("Uma criadora que transforma experiências reais de…");
  });

  it("dedica um slide editorial a cada premiado, sem pôster esticado ou card em dupla", () => {
    const report = denseReport();
    const slides = buildSlides(report);
    const features = slides.filter((slide) => slide.family === "award-feature");

    expect(features).toHaveLength(report.highlights.length);
    expect(features.map((slide) => slide.coverageKeys)).toEqual(
      report.highlights.map((_, index) => [`highlight:${index}`]),
    );
    expect(features.every((slide) => slide.html.includes("awardmedia"))).toBe(true);
    expect(features.every((slide) => slide.html.includes("awardfeature"))).toBe(true);
    expect(slides.some((slide) => slide.family === "award-podium")).toBe(false);
    expect(slides.some((slide) => slide.family === "award-poster")).toBe(false);
    expect(slides.some((slide) => slide.id === "destaques-vaila")).toBe(false);
    expect(slides.find((slide) => slide.family === "award-roster")?.html).toContain("rosteravatar");
  });

  it("transforma a capa em um retrato coletivo dos premiados, sem painel de métricas", () => {
    const report = denseReport();
    report.highlights[0] = {
      ...report.highlights[0]!,
      creatorAvatarUrl: "data:image/png;base64,AVATAR",
      post: {
        link: null,
        thumbnailUrl: "data:image/png;base64,THUMB",
        screenTitle: null,
        openingLine: null,
        elements: [],
      },
    };
    report.highlights[1] = {
      ...report.highlights[1]!,
      creatorAvatarUrl: "data:image/png;base64,AVATAR2",
      post: null,
    };
    const cover = buildSlides(report).find((slide) => slide.family === "cover");
    const html = cover?.html ?? "";

    expect(cover).toBeDefined();
    expect(html).toContain("coverlayout");
    expect(html).toContain("coverpeople cols-3 rows-2");
    expect(html).toContain('<h1 class="covertitle"><span>Report</span><b>D2C</b></h1>');
    expect(html).toContain('<p class="coverweek">Semana 29</p>');
    expect(html).not.toContain("<b>29</b>");
    expect(html).toContain("13—19 julho 2026");
    expect(html).toContain("As pessoas e ideias que marcaram esta edição.");
    expect(html).not.toContain("coverstats");
    expect(html).not.toContain("coverportrait");
    expect(html).not.toContain(">criadores<");
    expect(html).not.toContain(">territórios<");
    expect(html).not.toContain(">vídeos<");
    expect((html.match(/class="coverperson"/g) ?? []).length).toBe(report.highlights.length);
    expect(html).toContain("coverperson-image");
    expect(html).toContain("coverperson-image fallback");
    expect(html).toContain("data:image/png;base64,AVATAR");
    expect(html).not.toContain("data:image/png;base64,THUMB");
    for (const highlight of report.highlights) expect(html).toContain(highlight.creatorName);
    expect(cover?.coverageKeys).toEqual(["cover"]);
    expect(cover?.repeatedCoverageKeys).toEqual(
      report.highlights.map((_, index) => `highlight:${index}`),
    );
  });

  it("não abre mais telas dedicadas de matriz/leitura entre territórios — só o resumo de padrões", () => {
    // A matriz "Comparação entre territórios" + a leitura "O que muda entre os
    // territórios" viravam 2 telas por página (5 páginas com 13 territórios = 10
    // telas), a maioria com poucos valores reais. O resumo de padrões (top 5, uma
    // tela só) continua existindo — o que saiu foi só o estudo paginado.
    const slides = buildSlides(denseReport());
    const html = slides.map((slide) => slide.html).join("\n");

    expect(slides.some((slide) => slide.family === "cross-territory")).toBe(false);
    expect(slides.some((slide) => slide.family === "cross-territory-readings")).toBe(false);
    expect(html).not.toContain("Comparação entre territórios");
    expect(html).not.toContain("O que muda entre os territórios");
    expect(html).not.toContain("Nada se repetiu nesta semana");
    expect(html).not.toContain("sem repetição, sem ranking");
  });

  it("separa padrões coletivos das cautelas e oportunidades", () => {
    const report = denseReport();
    report.prediction = {
      statement: "Testar uma pauta nova na próxima semana.",
      caveat: null,
      elements: [{ kind: "tema", key: "teste" }],
      territoryId: "dense",
      metric: "comentarios",
    };
    const slides = buildSlides(report);
    const patterns = slides.filter((slide) => slide.family === "intelligence-patterns");
    const cautions = slides.filter((slide) => slide.family === "intelligence-cautions");

    expect(patterns).toHaveLength(1);
    expect(cautions).toHaveLength(1);
    expect(patterns[0]?.html).not.toContain("O que rendeu menos");
    expect(cautions[0]?.html).not.toContain("Padrões coletivos");
    expect(cautions[0]?.html).not.toContain("Horário 1");
    expect(cautions[0]?.html).not.toContain("Duração 1");
    expect(cautions[0]?.html).toContain("Não são sugestões de pauta");
    expect(cautions[0]?.html).toContain("PAUTA PARA TESTAR NA PRÓXIMA SEMANA");
    expect(cautions[0]?.html).toContain("ainda não um resultado comprovado");
    expect(cautions[0]?.html).toContain("Resultado");
    expect(cautions[0]?.html).not.toContain("Sinais editoriais abaixo do típico");
  });

  it("remove explicações repetidas sem retirar os dados de estudo", () => {
    const report = denseReport();
    const slides = buildSlides(report);
    const html = slides.map((slide) => slide.html).join("\n");
    const manifest = buildCoverageManifest(report, slides);

    expect(manifest.missing).toEqual([]);
    expect(html).not.toContain("Todos os demais vídeos do ranking, sem corte.");
    expect(html).not.toContain("Frases ditas nos vídeos, copiadas do vídeo.");
    expect(html).not.toContain("Isto é o hábito do território, não o seu.");
    expect(html).not.toContain("rr-compare");
    expect(html).not.toContain("summary-signal-context");
    expect(html).toContain("Sinal mais forte");
    expect(html).toContain("Barras: multiplicador versus o post típico do território.");
  });

  it("pagina rankings curtos de forma equilibrada, sem inventário alfabético", () => {
    const report = denseReport();
    const territory = report.territories[0]!;
    territory.assuntos.rows = territory.assuntos.rows.slice(0, 8).map((row, index) => ({
      ...row,
      occurrences: index < 6 ? 2 : 1,
      creators: index < 6 ? 2 : 1,
    }));
    territory.tons.rows = territory.tons.rows.slice(0, 6).map((row, index) => ({
      ...row,
      occurrences: index < 5 ? 2 : 1,
      creators: index < 5 ? 2 : 1,
    }));

    const slides = buildSlides(report);
    const assuntos = slides.filter((slide) => slide.id.startsWith("dense-assuntos"));
    const tons = slides.filter((slide) => slide.id.startsWith("dense-tons"));

    expect(assuntos).toHaveLength(2);
    expect(tons).toHaveLength(1);
    expect(assuntos[1]!.html).toContain("Assunto 8");
    expect(tons[0]!.html).toContain("Tom 6");
    expect(assuntos.every((slide) => !slide.html.includes("invlist"))).toBe(true);
    expect(tons[0]!.html).not.toContain("invlist");
    expect(assuntos.map((slide) => (slide.html.match(/class="pos"/g) ?? []).length)).toEqual([4, 4]);
  });

  it("mostra o engajamento de todos os assuntos específicos em páginas de ressonância", () => {
    const report = denseReport();
    const slides = buildSlides(report);
    const resonance = slides.filter((slide) => slide.family === "topic-resonance");
    const html = resonance.map((slide) => slide.html).join("\n");
    const coveredTopics = resonance.flatMap((slide) => slide.coverageKeys ?? []);

    expect(resonance.length).toBeGreaterThan(1);
    expect(html).toContain("Quais assuntos ressoaram mais");
    expect(html).toContain("Ordenado por força em engajamento");
    expect(html).toContain("Engaj.");
    expect(html).toContain("Compart.");
    expect(html).not.toContain("Criadores em 90 dias");
    expect(html).not.toContain("Assuntos específicos observados");
    expect(html).toContain('<td class="pos">120</td>');
    expect(resonance.every((slide) => slide.html.includes('class="rk d-normal"'))).toBe(true);
    expect(html).not.toContain('class="rk d-ampla"');
    expect(new Set(coveredTopics).size).toBe(report.territories[0]!.temas.rows.length);
  });

  it("mantém todos os tipos de lista em ranking, inclusive itens vistos uma vez", () => {
    const report = denseReport();
    const slides = buildSlides(report);
    const analyticFamilies = new Set([
      "ranking-table",
      "topic-resonance",
      "quote-resonance",
      "asset-resonance",
      "object-resonance",
      "location-resonance",
      "timing-ranking",
      "duration-ranking",
    ]);
    const analyticSlides = slides.filter(
      (slide) => slide.family !== undefined && analyticFamilies.has(slide.family),
    );

    expect(analyticSlides.length).toBeGreaterThan(0);
    expect(analyticSlides.every((slide) => !slide.html.includes('class="inv'))).toBe(true);
    expect(analyticSlides.some((slide) => slide.html.includes("visto 1×"))).toBe(true);
  });

  it("não usa ordem alfabética quando o engajamento empata", () => {
    const report = denseReport();
    const territory = report.territories[0]!;
    territory.temas.rows = [
      {
        ...territory.temas.rows[0]!,
        key: "alimentacao",
        label: "Alimentação saudável",
        occurrences: 1,
        creators: 1,
        metrics: [
          { metric: "engajamento", index: 1.7 },
          { metric: "comentarios", index: 0 },
          { metric: "compartilhamentos", index: 0 },
        ],
      },
      {
        ...territory.temas.rows[1]!,
        key: "cultura",
        label: "Cultura japonesa em festivais",
        occurrences: 1,
        creators: 1,
        metrics: [
          { metric: "engajamento", index: 1.7 },
          { metric: "comentarios", index: 2.9 },
          { metric: "compartilhamentos", index: 5 },
        ],
      },
    ];

    const html = buildSlides(report)
      .filter((slide) => slide.family === "topic-resonance")
      .map((slide) => slide.html)
      .join("\n");

    expect(html.indexOf("Cultura japonesa em festivais")).toBeLessThan(
      html.indexOf("Alimentação saudável"),
    );
  });

  it("aplica a análise integral de engajamento às falas e aos objetos em cena", () => {
    const report = denseReport();
    const slides = buildSlides(report);
    const quotes = slides.filter((slide) => slide.family === "quote-resonance");
    const objects = slides.filter((slide) => slide.family === "object-resonance");
    const quoteHtml = quotes.map((slide) => slide.html).join("\n");
    const objectHtml = objects.map((slide) => slide.html).join("\n");

    expect(quotes.length).toBeGreaterThan(1);
    expect(objects.length).toBeGreaterThan(1);
    expect(quoteHtml).toContain("O que foi dito");
    expect(objectHtml).toContain("Objetos em cena");
    expect(quoteHtml).toContain("Ordenado por força em engajamento");
    expect(objectHtml).toContain("Ordenado por força em engajamento");
    expect(quoteHtml).toContain("Engaj.");
    expect(objectHtml).toContain("Engaj.");
    expect(quoteHtml).toContain("Compart.");
    expect(objectHtml).toContain("Compart.");
    expect(quoteHtml).not.toContain("Criadores em 90 dias");
    expect(objectHtml).not.toContain("Criadores em 90 dias");
    expect(quoteHtml).not.toContain('class="fit fit-creators"');
    expect(quoteHtml).toContain(" de 12 criadores em 90 dias");
    expect(quoteHtml).not.toContain("Quem fez");
    expect(objectHtml).not.toContain("Quem fez");
    expect(slides.some((slide) => slide.family === "quote-wall")).toBe(false);
    expect(slides.some((slide) => slide.family === "quote-inventory")).toBe(false);
    expect(new Set(quotes.flatMap((slide) => slide.coverageKeys ?? [])).size).toBe(
      report.territories[0]!.falas.rows.length,
    );
    expect(new Set(objects.flatMap((slide) => slide.coverageKeys ?? [])).size).toBe(
      report.territories[0]!.objetos.rows.length,
    );
  });

  it("mostra engajamento em todos os assets de vida e explica sua presença no mapa", () => {
    const report = denseReport();
    const slides = buildSlides(report);
    const assets = slides.filter((slide) => slide.family === "asset-resonance");
    const html = assets.map((slide) => slide.html).join("\n");

    expect(assets.length).toBeGreaterThan(1);
    expect(html).toContain("Assets de vida");
    expect(html).toContain("Ordenado por força em engajamento");
    expect(html).toContain("Engaj.");
    expect(html).toContain("Coment.");
    expect(html).toContain("Compart.");
    expect(html).not.toContain("Está no mapa de");
    expect(html).toContain("no mapa de 2/12");
    expect(new Set(assets.flatMap((slide) => slide.coverageKeys ?? [])).size).toBe(
      report.territories[0]!.assets.rows.length,
    );
  });

  it("mostra engajamento, comentários e compartilhamentos para todos os locais", () => {
    const report = denseReport();
    const slides = buildSlides(report);
    const locations = slides.filter((slide) => slide.family === "location-resonance");
    const html = locations.map((slide) => slide.html).join("\n");

    expect(locations.length).toBeGreaterThan(1);
    expect(html).toContain("Locais");
    expect(html).toContain("Ordenado por força em engajamento");
    expect(html).toContain("Engaj.");
    expect(html).toContain("Coment.");
    expect(html).toContain("Compart.");
    expect(html).not.toContain("Elementos observados");
    expect(new Set(locations.flatMap((slide) => slide.coverageKeys ?? [])).size).toBe(
      report.territories[0]!.locais.rows.length,
    );
  });

  it("troca 'cabe em' por visualizações por post em todos os horários", () => {
    const report = denseReport();
    const slides = buildSlides(report).filter((slide) => slide.family === "timing-ranking");
    const html = slides.map((slide) => slide.html).join("\n");

    expect(slides.length).toBeGreaterThan(0);
    expect(html).toContain("Visualizações/post");
    expect(html).toContain("viewbar");
    expect(html).toContain("1,0 mil");
    expect(html).not.toContain("Cabe em");
    expect(slides.flatMap((slide) => slide.coverageKeys ?? [])).toHaveLength(
      report.territories[0]!.horarios.rows.length,
    );
  });

  it("troca 'cabe em' por visualizações por post em todas as durações", () => {
    const report = denseReport();
    const slides = buildSlides(report).filter((slide) => slide.family === "duration-ranking");
    const html = slides.map((slide) => slide.html).join("\n");

    expect(slides.length).toBeGreaterThan(0);
    expect(html).toContain("Visualizações/post");
    expect(html).toContain("viewbar");
    expect(html).toContain("1,0 mil");
    expect(html).not.toContain("Cabe em");
    expect(slides.flatMap((slide) => slide.coverageKeys ?? [])).toHaveLength(
      report.territories[0]!.duracoes.rows.length,
    );
  });

  it("mantém cada grupo da matriz junto quando ele cabe em uma página", () => {
    const report = denseReport();
    const cell = { metric: "comentarios" as const, index: 1.3, intensity: 3 as const };
    report.territories[0]!.matrix = [
      ...Array.from({ length: 6 }, (_, index) => ({ kind: "asset" as const, label: `Aparece ${index + 1}`, cells: [cell] })),
      ...Array.from({ length: 2 }, (_, index) => ({ kind: "assunto" as const, label: `Assunto ${index + 1}`, cells: [cell] })),
      ...Array.from({ length: 3 }, (_, index) => ({ kind: "horario" as const, label: `Horário ${index + 1}`, cells: [cell] })),
      { kind: "duracao" as const, label: "30–60s", cells: [cell] },
    ];

    const slides = buildSlides(report).filter((slide) => slide.family === "matrix");
    expect(slides).toHaveLength(2);
    expect(slides[0]!.html).toContain("O que aparece");
    expect(slides[0]!.html).toContain("Aparece 6");
    expect(slides[0]!.html).not.toContain("Sobre o que fala");
    expect(slides[1]!.html).not.toContain("O que aparece");
    expect(slides[1]!.html).toContain("Sobre o que fala");
    expect(slides[1]!.html).toContain("Quando posta");
    expect(slides[1]!.html).toContain("Que tamanho");
    expect(slides.flatMap((slide) => slide.coverageKeys ?? [])).toHaveLength(12);
  });

  it("elimina a orientação de uso pessoal e explica cada linha de forma objetiva", () => {
    const slides = buildSlides(denseReport());
    const use = slides.find((slide) => slide.family === "how-to-use");
    const methodSlide = slides.find((slide) => slide.family === "method");
    const method = methodSlide?.html ?? "";

    expect(use).toBeUndefined();
    expect(methodSlide?.n).toBe(3);
    expect(method).toContain("Como ler uma linha");
    expect(method).toContain("Elemento");
    expect(method).toContain("Resultado");
    expect(method).toContain("Lastro");
    expect(method).toContain("Sinal</b> · 4 aparições · 3 criadores");
    expect(method).toContain("Mapa = repertório · semana = desempenho observado");
    expect(method).not.toContain("Em português:");
    expect(method).not.toContain("130% acima do padrão");
    expect(method).not.toContain("Dá para confiar?");
    expect(method).not.toContain("Use o relatório em dois momentos");
  });

  it("reserva a capa do vídeo principal para o slide do vídeo, sem repeti-la no resumo", () => {
    const report = denseReport();
    report.territories[0]!.header.label = "Maternidade/Paternidade";
    const slides = buildSlides(report);
    const summary = slides.find((slide) => slide.family === "territory-summary");
    const video = slides.find((slide) => slide.family === "video-hero");

    expect(summary?.html).toContain("O que mais chamou atenção");
    expect(summary?.html).not.toContain("terrsummary-photo");
    expect(summary?.html).toContain("Maternidade/<wbr>Paternidade");
    expect(summary?.html).toContain('class="tt xl long"');
    expect(summary?.repeatedCoverageKeys?.some((key) => key.includes(":video:"))).toBe(false);
    expect(video).toBeDefined();
    expect(video?.html).toContain("Leitura do resultado");
    expect(video?.html).toContain("Outros dados");
    expect(video?.html).toContain("30s");
    expect(video?.html).toContain("60%");
    expect(video?.html).toContain("O que aparece");
  });

  it("mantém o Reel em moldura vertical e usa linguagem clara nos stories", () => {
    const highlight = {
      ...denseReport().highlights[0]!,
      creatorAvatarUrl: "data:image/png;base64,AA==",
      post: {
        link: "https://instagram.com/reel/teste",
        thumbnailUrl: "data:image/png;base64,AA==",
        screenTitle: "Título",
        openingLine: "Abertura",
        elements: ["Casa"],
      },
    };
    const html = renderStoryCardHtml(highlight, 29, 2026);

    expect(html).toContain("width:650px;height:1156px");
    expect(html).toContain("border-radius:44px");
    expect(html).not.toContain("class=\"shade\"");
  });
});
