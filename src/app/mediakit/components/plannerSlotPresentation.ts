import { idsToLabels } from '@/app/lib/classification';
import { buildMetricClassificationSnapshot } from '@/app/lib/classificationV2Bridge';
import { v2IdsToLabels } from '@/app/lib/classificationV2';
import { v25IdsToLabels } from '@/app/lib/classificationV2_5';

type PlannerSlotPresentationInput = {
  format?: string;
  title?: string;
  scriptShort?: string;
  themeKeyword?: string;
  themes?: string[];
  categories?: {
    context?: string[];
    tone?: string;
    proposal?: string[];
    reference?: string[];
  };
  contentIntent?: string[];
  narrativeForm?: string[];
  contentSignals?: string[];
  stance?: string[];
  proofStyle?: string[];
  commercialMode?: string[];
};

export type PlannerSlotMetaChip = {
  key: string;
  label: string;
  value: string;
};

export type PlannerSlotPresentation = {
  formatLabel: string;
  intentLabel: string;
  narrativeLabel: string;
  contextLabel: string;
  focusDetailLabel: string;
  focusDetailValue: string;
  metaChips: PlannerSlotMetaChip[];
};

const EMPTY_VALUE = '—';

function joinLabels(labels: string[], limit = 2): string {
  const values = labels.filter(Boolean).slice(0, limit);
  return values.length ? values.join(' • ') : EMPTY_VALUE;
}

function dedupeChips(chips: PlannerSlotMetaChip[]): PlannerSlotMetaChip[] {
  const seen = new Set<string>();
  return chips.filter((chip) => {
    const key = `${chip.label}:${chip.value}`.toLowerCase();
    if (!chip.value || chip.value === EMPTY_VALUE || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getPlannerSlotPresentation(
  slot: PlannerSlotPresentationInput
): PlannerSlotPresentation {
  const description = [slot.title, slot.scriptShort, slot.themeKeyword, ...(slot.themes ?? [])]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join('\n');

  const snapshot = buildMetricClassificationSnapshot({
    source: null,
    type: null,
    description,
    format: slot.format ? [slot.format] : [],
    proposal: slot.categories?.proposal,
    context: slot.categories?.context,
    tone: slot.categories?.tone ? [slot.categories.tone] : [],
    references: slot.categories?.reference,
    contentIntent: slot.contentIntent,
    narrativeForm: slot.narrativeForm,
    contentSignals: slot.contentSignals,
    stance: slot.stance,
    proofStyle: slot.proofStyle,
    commercialMode: slot.commercialMode,
  });

  const formatLabel = joinLabels(idsToLabels(snapshot.format, 'format'), 1);
  const intentLabel = joinLabels(v2IdsToLabels(snapshot.contentIntent, 'contentIntent'));
  const narrativeLabel = joinLabels(v2IdsToLabels(snapshot.narrativeForm, 'narrativeForm'));
  const contextLabel = joinLabels(idsToLabels(snapshot.context, 'context'));
  const proofLabel = joinLabels(v25IdsToLabels(snapshot.proofStyle, 'proofStyle'));
  const commercialLabel = joinLabels(v25IdsToLabels(snapshot.commercialMode, 'commercialMode'));
  const stanceLabel = joinLabels(v25IdsToLabels(snapshot.stance, 'stance'));
  const signalLabel = joinLabels(v2IdsToLabels(snapshot.contentSignals, 'contentSignal'));
  const toneLabel = joinLabels(idsToLabels(snapshot.tone, 'tone'), 1);
  const referenceLabel = joinLabels(idsToLabels(snapshot.references, 'reference'));

  const priorityDetails: PlannerSlotMetaChip[] = [
    { key: 'proof', label: 'Prova', value: proofLabel },
    { key: 'commercial', label: 'Comercial', value: commercialLabel },
    { key: 'stance', label: 'Postura', value: stanceLabel },
    { key: 'signal', label: 'Sinal', value: signalLabel },
    { key: 'reference', label: 'Referência', value: referenceLabel },
    { key: 'tone', label: 'Tom', value: toneLabel },
  ];

  const focusDetail =
    priorityDetails.find((detail) => detail.value !== EMPTY_VALUE) ??
    ({ key: 'signal', label: 'Camada extra', value: EMPTY_VALUE } as PlannerSlotMetaChip);

  const metaChips = dedupeChips(
    priorityDetails
      .filter((detail) => detail.key !== focusDetail.key)
      .map((detail) => ({
        ...detail,
        value: detail.value,
      }))
  );

  return {
    formatLabel,
    intentLabel,
    narrativeLabel,
    contextLabel,
    focusDetailLabel: focusDetail.label,
    focusDetailValue: focusDetail.value,
    metaChips,
  };
}
