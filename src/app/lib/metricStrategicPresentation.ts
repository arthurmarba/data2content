import { idsToLabels } from '@/app/lib/classification';
import { buildMetricClassificationSnapshot, type MetricClassificationSource } from '@/app/lib/classificationV2Bridge';
import { v2IdsToLabels } from '@/app/lib/classificationV2';
import { v25IdsToLabels } from '@/app/lib/classificationV2_5';

export type MetricStrategicPresentation = {
  formatLabels: string[];
  intentLabels: string[];
  narrativeLabels: string[];
  contextLabels: string[];
  signalLabels: string[];
  stanceLabels: string[];
  proofLabels: string[];
  commercialLabels: string[];
  toneLabels: string[];
  referenceLabels: string[];
  primaryGroupingLabel: string;
};

function firstLabel(labels: string[]): string | null {
  return labels.find(Boolean) || null;
}

export function getMetricStrategicPresentation(
  metric: MetricClassificationSource
): MetricStrategicPresentation {
  const snapshot = buildMetricClassificationSnapshot(metric);

  const formatLabels = idsToLabels(snapshot.format, 'format');
  const intentLabels = v2IdsToLabels(snapshot.contentIntent, 'contentIntent');
  const narrativeLabels = v2IdsToLabels(snapshot.narrativeForm, 'narrativeForm');
  const contextLabels = idsToLabels(snapshot.context, 'context');
  const signalLabels = v2IdsToLabels(snapshot.contentSignals, 'contentSignal');
  const stanceLabels = v25IdsToLabels(snapshot.stance, 'stance');
  const proofLabels = v25IdsToLabels(snapshot.proofStyle, 'proofStyle');
  const commercialLabels = v25IdsToLabels(snapshot.commercialMode, 'commercialMode');
  const toneLabels = idsToLabels(snapshot.tone, 'tone');
  const referenceLabels = idsToLabels(snapshot.references, 'reference');

  return {
    formatLabels,
    intentLabels,
    narrativeLabels,
    contextLabels,
    signalLabels,
    stanceLabels,
    proofLabels,
    commercialLabels,
    toneLabels,
    referenceLabels,
    primaryGroupingLabel:
      firstLabel(intentLabels) ||
      firstLabel(contextLabels) ||
      firstLabel(narrativeLabels) ||
      firstLabel(proofLabels) ||
      'Sem categoria',
  };
}
