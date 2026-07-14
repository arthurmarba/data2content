import type {
  VideoNarrativeContentPotentialScan,
  VideoNarrativePotentialDimension,
  VideoNarrativePotentialDimensionStatus,
} from "./videoNarrativeContentPotentialScan";

export type ContentPotentialPresentationItem = {
  key: keyof VideoNarrativeContentPotentialScan["dimensions"];
  label: string;
  evidence: string;
  adjustment: string | null;
  status: VideoNarrativePotentialDimensionStatus;
};

export type ContentPotentialDecision = {
  eyebrow: string;
  title: string;
  reason: string;
};

const DIMENSION_COPY: Record<
  keyof VideoNarrativeContentPotentialScan["dimensions"],
  { label: string; strengthReason: string; riskReason: string }
> = {
  openingClarity: {
    label: "Abertura",
    strengthReason: "A entrada deixa o assunto ou a promessa reconhecível.",
    riskReason: "A entrada ainda exige esforço para entender a promessa.",
  },
  attentionArchitecture: {
    label: "Progressão",
    strengthReason: "O desenvolvimento sinaliza que a ideia está avançando.",
    riskReason: "A progressão perde força antes da ideia se completar.",
  },
  shareImpulse: {
    label: "Vontade de compartilhar",
    strengthReason: "Existe um motivo claro para levar o conteúdo a outra pessoa.",
    riskReason: "O motivo para compartilhar ainda fica implícito.",
  },
  promiseDelivery: {
    label: "Entrega",
    strengthReason: "O final cumpre a expectativa criada na abertura.",
    riskReason: "A conclusão ainda não materializa toda a promessa inicial.",
  },
  narrativeFit: {
    label: "Seu mapa",
    strengthReason: "O conteúdo reforça um território reconhecível do perfil.",
    riskReason: "A relação com o território do perfil ainda fica difusa.",
  },
};

const OBJECTIVE_PRIORITY: Record<
  VideoNarrativeContentPotentialScan["objective"],
  Array<keyof VideoNarrativeContentPotentialScan["dimensions"]>
> = {
  attention: ["openingClarity", "attentionArchitecture", "promiseDelivery", "shareImpulse", "narrativeFit"],
  sharing: ["shareImpulse", "promiseDelivery", "openingClarity", "attentionArchitecture", "narrativeFit"],
  positioning: ["narrativeFit", "promiseDelivery", "openingClarity", "shareImpulse", "attentionArchitecture"],
  complete_reading: ["openingClarity", "promiseDelivery", "attentionArchitecture", "shareImpulse", "narrativeFit"],
};

const STATUS_SCORE: Record<VideoNarrativePotentialDimensionStatus, number> = {
  unknown: 0,
  weak: 1,
  mixed: 2,
  strong: 3,
};

function toItem(
  key: keyof VideoNarrativeContentPotentialScan["dimensions"],
  dimension: VideoNarrativePotentialDimension,
): ContentPotentialPresentationItem {
  return {
    key,
    label: DIMENSION_COPY[key].label,
    evidence: dimension.evidence || (dimension.status === "strong" ? DIMENSION_COPY[key].strengthReason : DIMENSION_COPY[key].riskReason),
    adjustment: dimension.adjustment,
    status: dimension.status,
  };
}

export function buildContentPotentialDecision(
  scan: VideoNarrativeContentPotentialScan,
  directAnswer?: string | null,
): ContentPotentialDecision {
  if (scan.band === "strong") {
    return {
      eyebrow: "Pronto para decidir",
      title: "Vale postar: a estrutura já se sustenta.",
      reason: directAnswer?.trim() || "Os sinais principais estão claros neste vídeo.",
    };
  }
  if (scan.band === "promising_with_adjustment") {
    return {
      eyebrow: "Um ajuste antes de postar",
      title: "Vale postar depois de um ajuste.",
      reason: directAnswer?.trim() || "A ideia funciona, mas um ponto ainda limita a leitura.",
    };
  }
  if (scan.band === "weak_signals") {
    return {
      eyebrow: "Revise antes de postar",
      title: "Melhor ajustar antes de publicar.",
      reason: directAnswer?.trim() || "A ideia ainda não deixa claros todos os sinais necessários.",
    };
  }
  return {
    eyebrow: "Leitura ainda em aberto",
    title: "Revise o vídeo antes de decidir.",
    reason: directAnswer?.trim() || "Ainda faltam sinais suficientes para uma direção segura.",
  };
}

export function buildContentPotentialStrengthsAndRisks(
  scan: VideoNarrativeContentPotentialScan,
): { strengths: ContentPotentialPresentationItem[]; risks: ContentPotentialPresentationItem[] } {
  const priority = OBJECTIVE_PRIORITY[scan.objective];
  const items = priority.map((key) => toItem(key, scan.dimensions[key]));
  const strengths = items.filter((item) => item.status === "strong").slice(0, 2);
  const risks = items
    .filter((item) => item.status === "weak" || item.status === "mixed")
    .sort((a, b) => {
      const statusDelta = STATUS_SCORE[a.status] - STATUS_SCORE[b.status];
      return statusDelta || priority.indexOf(a.key) - priority.indexOf(b.key);
    })
    .slice(0, 2);
  return { strengths, risks };
}

export type ContentPotentialScanComparison = {
  improvements: ContentPotentialPresentationItem[];
  regressions: ContentPotentialPresentationItem[];
  unchangedStrong: ContentPotentialPresentationItem[];
};

export function compareContentPotentialScans(
  previous: VideoNarrativeContentPotentialScan,
  current: VideoNarrativeContentPotentialScan,
): ContentPotentialScanComparison {
  const keys = Object.keys(current.dimensions) as Array<keyof VideoNarrativeContentPotentialScan["dimensions"]>;
  const improvements: ContentPotentialPresentationItem[] = [];
  const regressions: ContentPotentialPresentationItem[] = [];
  const unchangedStrong: ContentPotentialPresentationItem[] = [];
  for (const key of keys) {
    const before = STATUS_SCORE[previous.dimensions[key].status];
    const after = STATUS_SCORE[current.dimensions[key].status];
    const item = toItem(key, current.dimensions[key]);
    if (after > before) improvements.push(item);
    else if (after < before) regressions.push(item);
    else if (current.dimensions[key].status === "strong") unchangedStrong.push(item);
  }
  return { improvements, regressions, unchangedStrong };
}
