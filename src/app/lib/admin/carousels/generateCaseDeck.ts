import type { CarouselCaseDeck, CarouselCaseSlide, CarouselCaseSource } from "@/types/admin/carouselCase";

function trimSentence(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function firstSentence(value?: string | null) {
  const normalized = trimSentence(value);
  if (!normalized) return "";
  const match = normalized.match(/^[^.?!]+[.?!]?/);
  return match?.[0]?.trim() || normalized;
}

function uniqueTruthy(values: Array<string | null | undefined>) {
  const normalized = values
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return normalized.filter((value, index) => normalized.indexOf(value) === index);
}

function formatIdeaLine(value: { title: string; timingLabel: string; formatLabel?: string | null }) {
  const parts = [value.title, value.timingLabel, value.formatLabel].filter(Boolean);
  return `• ${parts.join(" • ")}`;
}

function buildCoverSlide(source: CarouselCaseSource): CarouselCaseSlide {
  const objectiveHeadline =
    source.objective.value === "reach"
      ? "O que mais gera\n*alcance*\nneste perfil"
      : source.objective.value === "leads"
        ? "O que mais gera\n*intenção*\nneste perfil"
        : "O que mais gera\n*resposta*\nneste perfil";

  const supportLine = "Padrão a repetir agora.";

  return {
    id: "cover",
    type: "cover",
    eyebrow: "Análise de perfil",
    headline: objectiveHeadline,
    body: supportLine,
  };
}

function buildResonanceSlide(source: CarouselCaseSource): CarouselCaseSlide {
  const categories = source.topNarratives.slice(0, 3).map((item) => item.title);

  return {
    id: "resonance",
    type: "narrative",
    eyebrow: "O que mais ressoa",
    headline: "O que mais gera conexão",
    chips: categories,
  };
}

function buildExecutionSlide(source: CarouselCaseSource): CarouselCaseSlide {
  const topFormatInsight = source.topFormats[0];
  const topFormat = topFormatInsight?.label || source.featuredPosts[0]?.formatLabel || "Reel";
  const durationInsight = source.topDuration;
  const durationLabel = durationInsight?.label || null;
  const bodyParts = uniqueTruthy([
    durationLabel
      ? `${topFormat} com ${durationLabel} aparece como a embalagem mais estável para repetir essa resposta.`
      : `${topFormat} aparece como a embalagem mais estável para repetir essa resposta.`,
    topFormatInsight?.evidence || topFormatInsight?.whyItWorks,
    durationInsight?.reason,
  ]);

  return {
    id: "execution",
    type: "format",
    eyebrow: "Formato e duração",
    headline: "A embalagem que mais gera resposta",
    body: bodyParts.join(" ") || `${topFormat} aparece como a execução mais segura deste momento.`,
    chips: uniqueTruthy([topFormat, durationLabel]).slice(0, 2),
  };
}

function buildTimingSlide(source: CarouselCaseSource): CarouselCaseSlide {
  const winningWindows = source.winningWindows.slice(0, 3);
  const firstWindow = winningWindows[0];
  const body =
    winningWindows.length > 1
      ? `${winningWindows.map((item) => item.label).join(", ")} concentram as melhores janelas recentes.`
      : firstWindow
        ? `${firstWindow.label} aparece como a melhor janela recente para repetir esse conteúdo.`
        : "As janelas mais fortes ajudam a repetir o conteúdo com menos ruído.";

  return {
    id: "timing",
    type: "timing",
    eyebrow: "Quando postar",
    headline: "As janelas que mais geram resposta",
    body,
    chips: winningWindows.map((item) => item.label),
  };
}

function buildIdeasSlide(source: CarouselCaseSource): CarouselCaseSlide {
  const ideaLines = source.contentIdeas.slice(0, 3).map((idea) => formatIdeaLine(idea));

  return {
    id: "ideas",
    type: "recommendation",
    eyebrow: "Pautas campeãs",
    headline: "O que postar agora",
    body:
      ideaLines.join(" ") ||
      "• Repetir a tese principal no melhor horário • Variar o hook mantendo a mesma promessa • Escalar a linha vencedora com consistência",
  };
}

export function generateCaseDeck(source: CarouselCaseSource): CarouselCaseDeck {
  const creatorName = source.creator.name;
  const slides: CarouselCaseSlide[] = [
    buildCoverSlide(source),
    buildResonanceSlide(source),
    buildExecutionSlide(source),
    buildTimingSlide(source),
    buildIdeasSlide(source),
    {
      id: "cta",
      type: "cta",
      eyebrow: "Entre na D2C",
      headline: "Descubra isso no seu perfil",
      body: "Entenda o que postar, quando postar e receba consultorias da D2C por apenas R$49,90/mês.",
    },
  ];

  return {
    deckTitle: `Carrossel-case • ${creatorName}`,
    creatorId: source.creator.id,
    aspectRatio: "3:4",
    slides,
  };
}
