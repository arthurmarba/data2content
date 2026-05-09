"use client";

import type { ReactNode } from "react";
import type { PostCreationStrategicPlan } from "../postCreationAdaptiveTypes";
import type {
  PostCreationBlueprint,
  PostCreationDecisionState,
  PostCreationIdeaVariant,
} from "../postCreationFunnel";

export type PostCreationAdaptiveNativePlanStageProps = {
  plan: PostCreationStrategicPlan | null;
  legacyHandoff?: {
    decision: PostCreationDecisionState;
    idea: PostCreationIdeaVariant;
    blueprint: PostCreationBlueprint;
  } | null;
  onUsePlan?: () => void;
  onBack?: () => void;
  onReset?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function DetailPill({ label, value }: { label: string; value: string | null | undefined }) {
  if (!hasText(value)) return null;

  return (
    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="ml-2 text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!hasText(value)) return null;

  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[96px_1fr]">
      <dt className="text-sm font-semibold text-slate-800">{label}</dt>
      <dd className="text-sm leading-6 text-slate-600">{value}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function PostCreationAdaptiveNativePlanStage({
  plan,
  legacyHandoff = null,
  onUsePlan,
  onBack,
  onReset,
  loading = false,
  disabled = false,
}: PostCreationAdaptiveNativePlanStageProps) {
  if (!plan) return null;

  const canUsePlan = Boolean(onUsePlan && legacyHandoff) && !loading && !disabled;
  const canInteract = !loading && !disabled;
  const scenes = plan.scenes.filter(
    (scene) => hasText(scene.title) || hasText(scene.visual) || hasText(scene.message) || hasText(scene.direction),
  );
  const hasWhy = hasText(plan.fiveW2H.why) || hasText(plan.objective) || hasText(plan.narrative);
  const hasExecution =
    hasText(plan.fiveW2H.where) ||
    hasText(plan.fiveW2H.who) ||
    hasText(plan.fiveW2H.how) ||
    hasText(plan.fiveW2H.howMuch);
  const hasHookOrCta = hasText(plan.hook) || hasText(plan.cta);
  const showBrandMatch =
    plan.brandMatch?.enabled === true && (hasText(plan.brandMatch.category) || hasText(plan.brandMatch.angle));
  const showCollabMatch =
    plan.collabMatch?.enabled === true &&
    (hasText(plan.collabMatch.creatorProfile) || hasText(plan.collabMatch.collaborationAngle));
  const nextActions = plan.nextActions.filter(hasText);

  function handleUsePlan() {
    if (!canUsePlan) return;
    onUsePlan?.();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plano estratégico</p>
        <div>
          <h2 className="text-2xl font-semibold leading-tight text-slate-950">
            Sua pauta está pronta para virar conteúdo
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Refinei a ideia em uma direção prática para gravar, testar e evoluir.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
        {hasText(plan.pauta) ? <h3 className="text-xl font-semibold leading-tight text-slate-950">{plan.pauta}</h3> : null}
        {hasText(plan.objective) || hasText(plan.narrative) ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            {hasText(plan.objective) ? `Objetivo: ${plan.objective}.` : null}
            {hasText(plan.objective) && hasText(plan.narrative) ? " " : null}
            {hasText(plan.narrative) ? `Narrativa: ${plan.narrative}.` : null}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <DetailPill label="Objetivo" value={plan.objective} />
          <DetailPill label="Narrativa" value={plan.narrative} />
          <DetailPill label="Formato" value={plan.format} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {hasWhy ? (
          <Section title="Por que essa narrativa funciona">
            {hasText(plan.fiveW2H.why) ? <p className="text-sm leading-6 text-slate-700">{plan.fiveW2H.why}</p> : null}
            {hasText(plan.objective) || hasText(plan.narrative) ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {hasText(plan.objective) ? `Ela sustenta ${plan.objective.toLowerCase()}` : null}
                {hasText(plan.objective) && hasText(plan.narrative) ? " com " : null}
                {hasText(plan.narrative) ? plan.narrative.toLowerCase() : null}.
              </p>
            ) : null}
          </Section>
        ) : null}

        {hasExecution ? (
          <Section title="Como gravar">
            <dl>
              <DetailRow label="Onde" value={plan.fiveW2H.where} />
              <DetailRow label="Quem" value={plan.fiveW2H.who} />
              <DetailRow label="Como" value={plan.fiveW2H.how} />
              <DetailRow label="Esforço" value={plan.fiveW2H.howMuch} />
            </dl>
          </Section>
        ) : null}
      </div>

      {hasHookOrCta ? (
        <div className="mt-4">
          <Section title="Gancho e CTA">
            <dl className="grid gap-3 md:grid-cols-2">
              <DetailRow label="Gancho" value={plan.hook} />
              <DetailRow label="CTA" value={plan.cta} />
            </dl>
          </Section>
        </div>
      ) : null}

      {scenes.length > 0 ? (
        <div className="mt-4">
          <Section title="Cenas ou pilares">
            <div className="grid gap-3 md:grid-cols-2">
              {scenes.map((scene) => (
                <article key={scene.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {hasText(scene.title) ? <h4 className="text-sm font-semibold text-slate-950">{scene.title}</h4> : null}
                  {hasText(scene.visual) ? <p className="mt-2 text-sm leading-6 text-slate-600">{scene.visual}</p> : null}
                  {hasText(scene.message) ? <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{scene.message}</p> : null}
                  {hasText(scene.direction) ? <p className="mt-2 text-xs leading-5 text-slate-500">{scene.direction}</p> : null}
                </article>
              ))}
            </div>
          </Section>
        </div>
      ) : null}

      {showBrandMatch || showCollabMatch ? (
        <div className="mt-4">
          <Section title="Oportunidades">
            <div className="grid gap-3 md:grid-cols-2">
              {showBrandMatch ? (
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">Marca</h4>
                  {hasText(plan.brandMatch?.category) ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{plan.brandMatch.category}</p>
                  ) : null}
                  {hasText(plan.brandMatch?.angle) ? (
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-900">{plan.brandMatch.angle}</p>
                  ) : null}
                </article>
              ) : null}

              {showCollabMatch ? (
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">Collab</h4>
                  {hasText(plan.collabMatch?.creatorProfile) ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{plan.collabMatch.creatorProfile}</p>
                  ) : null}
                  {hasText(plan.collabMatch?.collaborationAngle) ? (
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-900">
                      {plan.collabMatch.collaborationAngle}
                    </p>
                  ) : null}
                </article>
              ) : null}
            </div>
          </Section>
        </div>
      ) : null}

      {nextActions.length > 0 ? (
        <div className="mt-4">
          <Section title="Próximas ações">
            <div className="flex flex-wrap gap-2">
              {nextActions.map((action) => (
                <span key={action} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {action}
                </span>
              ))}
            </div>
          </Section>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {onBack ? (
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canInteract}
              onClick={onBack}
            >
              Voltar e ajustar
            </button>
          ) : null}

          {onReset ? (
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canInteract}
              onClick={onReset}
            >
              Criar outra estratégia
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
          disabled={!canUsePlan}
          onClick={handleUsePlan}
        >
          {loading ? "Aplicando plano..." : "Usar este plano"}
        </button>
      </div>
    </section>
  );
}
