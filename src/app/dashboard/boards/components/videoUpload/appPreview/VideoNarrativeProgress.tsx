import { clampStep } from "./VideoNarrativeAppPreviewPrimitives";

type VideoNarrativeProgressProps = {
  currentStep: number;
  totalSteps: number;
  label: string;
};

export function VideoNarrativeProgress({ currentStep, totalSteps, label }: VideoNarrativeProgressProps) {
  const safeTotal = Number.isFinite(totalSteps) && totalSteps > 0 ? Math.floor(totalSteps) : 1;
  const safeStep = clampStep(currentStep, safeTotal);
  const percent = Math.round((safeStep / safeTotal) * 100);

  return (
    <div aria-label={`Etapa ${safeStep} de ${safeTotal}: ${label}`} className="w-full">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-zinc-500">
          Etapa {safeStep} de {safeTotal}
        </p>
        <p className="text-xs font-semibold text-zinc-600">{label}</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-zinc-100">
        <div className="h-2 rounded-full bg-zinc-950" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
