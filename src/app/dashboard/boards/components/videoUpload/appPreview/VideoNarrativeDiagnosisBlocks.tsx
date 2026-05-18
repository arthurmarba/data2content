import type { VideoNarrativeCreatorProfile } from "../../../videoUpload/videoNarrativeCreatorProfileContract";
import type { VideoNarrativeStrategicDiagnosis } from "../../../videoUpload/videoNarrativeDiagnosisLearningModel";
import { formatSignalLabel } from "./VideoNarrativeAppPreviewPrimitives";
import type { ReactNode } from "react";

type VideoNarrativeDiagnosisBlocksProps = {
  diagnosis: VideoNarrativeStrategicDiagnosis;
  creatorProfile?: VideoNarrativeCreatorProfile | null;
};

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-zinc-900">{value}</dd>
    </div>
  );
}

function List({ items, empty = "Sem dados para este bloco." }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm leading-6 text-zinc-600">{empty}</p>;

  return (
    <ul className="space-y-2 text-sm leading-6 text-zinc-700">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-lg bg-zinc-50 px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function VideoNarrativeDiagnosisBlocks({ diagnosis, creatorProfile }: VideoNarrativeDiagnosisBlocksProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title="Diagnóstico">
        <dl className="grid gap-3">
          <Field label="Narrativa principal" value={diagnosis.mainNarrative} />
          <Field label="O que o vídeo comunica" value={diagnosis.whatVideoCommunicates} />
          <Field label="Intenção do criador" value={diagnosis.creatorIntent} />
          <Field label="Diagnóstico estratégico" value={diagnosis.strategicReading} />
          <Field label="Ponto forte" value={diagnosis.strength} />
          <Field label="Ponto de atenção" value={diagnosis.weakness} />
          <Field label="Ajuste recomendado" value={diagnosis.recommendedAdjustment} />
          <Field label="Gancho sugerido" value={diagnosis.suggestedHook} />
        </dl>
      </Block>

      <Block title="Potencial de marcas">
        <List items={diagnosis.brandPotential.territories} />
        {diagnosis.brandPotential.whyItFits ? (
          <p className="mt-3 text-sm leading-6 text-zinc-700">{diagnosis.brandPotential.whyItFits}</p>
        ) : null}
      </Block>

      <Block title="Blueprint">
        <dl className="grid gap-3">
          <Field label="O que postar" value={diagnosis.blueprint.whatToPost} />
          <Field label="Por que seguir" value={diagnosis.blueprint.whyThisPath} />
          <Field label="Como funcionar" value={diagnosis.blueprint.howItShouldWork} />
        </dl>
        <div className="mt-3">
          <List items={diagnosis.blueprint.scenes} />
        </div>
      </Block>

      <Block title="Direção de roteiro">
        {diagnosis.scriptDirection.locked ? (
          <p className="text-sm leading-6 text-zinc-600">Direção completa bloqueada neste nível de acesso.</p>
        ) : (
          <dl className="grid gap-3">
            <Field label="Abertura" value={diagnosis.scriptDirection.opening} />
            <Field label="Fechamento" value={diagnosis.scriptDirection.closing} />
            <Field label="Tom" value={diagnosis.scriptDirection.tone} />
            <div>
              <dt className="mb-2 text-xs font-semibold uppercase text-zinc-500">Desenvolvimento</dt>
              <List items={diagnosis.scriptDirection.development} />
            </div>
          </dl>
        )}
      </Block>

      <Block title="Seções bloqueadas">
        <List items={diagnosis.lockedSections.map((section) => `${section.title}: ${section.message}`)} />
      </Block>

      <Block title="Próximas ações">
        <List items={diagnosis.nextActions.map((action) => `${action.label}: ${action.description ?? "Ação disponível."}`)} />
      </Block>

      <Block title="Sinais do criador">
        <List items={diagnosis.creatorSignals.map((signal) => `${formatSignalLabel(signal.type)}: ${signal.value}`)} />
      </Block>

      <Block title="Resumo do perfil narrativo">
        {creatorProfile ? (
          <dl className="grid gap-3">
            <Field label="Objetivos" value={creatorProfile.summary.strongestContentGoals.join(", ") || null} />
            <Field label="Formatos" value={creatorProfile.summary.preferredFormats.join(", ") || null} />
            <Field label="Ganchos" value={creatorProfile.summary.preferredHookDirections.join(", ") || null} />
            <Field label="Territórios" value={creatorProfile.summary.preferredBrandTerritories.join(", ") || null} />
            <Field label="Comercial" value={creatorProfile.summary.commercialPreferences.join(", ") || null} />
            <Field label="Posicionamento" value={creatorProfile.summary.positioningSignals.join(", ") || null} />
          </dl>
        ) : (
          <p className="text-sm leading-6 text-zinc-600">Sem perfil narrativo para este cenário.</p>
        )}
      </Block>

      <Block title="Comparação com Instagram">
        <dl className="grid gap-3">
          <Field label="Resumo" value={diagnosis.instagramComparison.summary} />
          <Field label="Narrativas próximas" value={diagnosis.instagramComparison.matchingNarratives.join(", ") || null} />
          <Field label="Formatos próximos" value={diagnosis.instagramComparison.matchingFormats.join(", ") || null} />
        </dl>
        {diagnosis.instagramComparison.locked ? (
          <p className="mt-3 text-sm leading-6 text-zinc-600">Comparação depende de conexão Instagram futura.</p>
        ) : null}
      </Block>
    </div>
  );
}
