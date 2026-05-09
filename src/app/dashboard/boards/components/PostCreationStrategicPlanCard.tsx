"use client";

import type { PostCreationStrategicPlan } from "../postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "../postCreationFunnel";

export type PostCreationStrategicPlanCardProps = {
  plan: PostCreationStrategicPlan | null;
  legacyHandoff?: {
    decision: PostCreationDecisionState;
    idea: PostCreationIdeaVariant;
    blueprint: PostCreationBlueprint;
  } | null;
  onUsePlan?: () => void;
  onReset?: () => void;
  loading?: boolean;
};

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function DetailPill({ label, value }: { label: string; value: string | null | undefined }) {
  if (!hasText(value)) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function FiveW2HRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!hasText(value)) return null;

  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[120px_1fr]">
      <dt className="text-sm font-semibold text-slate-700">{label}</dt>
      <dd className="text-sm leading-6 text-slate-700">{value}</dd>
    </div>
  );
}

export default function PostCreationStrategicPlanCard({
  plan,
  legacyHandoff,
  onUsePlan,
  onReset,
  loading = false,
}: PostCreationStrategicPlanCardProps) {
  if (!plan) return null;

  const canUsePlan = Boolean(onUsePlan && legacyHandoff);
  const scenes = plan.scenes.filter((scene) => hasText(scene.title) || hasText(scene.message));

  return (
    <section className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Plano final 5W2H</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">{plan.pauta}</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {onReset ? (
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={onReset}
            >
              Criar outra estratégia
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!canUsePlan || loading}
            onClick={onUsePlan}
          >
            Usar este plano
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <DetailPill label="Objetivo" value={plan.objective} />
        <DetailPill label="Narrativa" value={plan.narrative} />
        <DetailPill label="Formato" value={plan.format} />
        <DetailPill label="Gancho" value={plan.hook} />
        <DetailPill label="CTA" value={plan.cta} />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Plano 5W2H</h4>
        <dl className="mt-2">
          <FiveW2HRow label="Quem" value={plan.fiveW2H.who} />
          <FiveW2HRow label="O quê" value={plan.fiveW2H.what} />
          <FiveW2HRow label="Onde" value={plan.fiveW2H.where} />
          <FiveW2HRow label="Quando" value={plan.fiveW2H.when} />
          <FiveW2HRow label="Por quê" value={plan.fiveW2H.why} />
          <FiveW2HRow label="Como" value={plan.fiveW2H.how} />
          <FiveW2HRow label="Esforço" value={plan.fiveW2H.howMuch} />
        </dl>
      </div>

      {scenes.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cenas ou pilares</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {scenes.map((scene) => (
              <article key={scene.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                {hasText(scene.title) ? <h5 className="text-sm font-semibold text-slate-950">{scene.title}</h5> : null}
                {hasText(scene.visual) ? <p className="mt-2 text-sm text-slate-700">{scene.visual}</p> : null}
                {hasText(scene.message) ? <p className="mt-2 text-sm font-medium text-slate-900">{scene.message}</p> : null}
                {hasText(scene.direction) ? <p className="mt-2 text-xs text-slate-500">{scene.direction}</p> : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {plan.brandMatch?.enabled ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-sm font-semibold text-amber-900">Marca</h4>
          <p className="mt-1 text-sm text-amber-900">
            {plan.brandMatch.category || "Categoria comercial"}: {plan.brandMatch.angle || "encaixe orgânico com a narrativa"}
          </p>
        </div>
      ) : null}

      {plan.collabMatch?.enabled ? (
        <div className="mt-6 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <h4 className="text-sm font-semibold text-sky-900">Collab</h4>
          <p className="mt-1 text-sm text-sky-900">
            {plan.collabMatch.creatorProfile || "Creator parceiro"}:{" "}
            {plan.collabMatch.collaborationAngle || "dinâmica colaborativa alinhada ao conteúdo"}
          </p>
        </div>
      ) : null}

      {plan.nextActions.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Próximas ações</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.nextActions.map((action) => (
              <span key={action} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {action}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
