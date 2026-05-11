"use client";

import type { ReactNode } from "react";
import {
  buildPostCreationAdaptivePlanPresentation,
} from "../postCreationAdaptivePlanPresentation";
import type {
  PostCreationAdaptiveMode,
  PostCreationStrategicPlan,
} from "../postCreationAdaptiveTypes";
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
  mode?: PostCreationAdaptiveMode | null;
  originalPrompt?: string | null;
};

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function DetailPill({ label, value }: { label: string; value: string | null | undefined }) {
  if (!hasText(value)) return null;

  return (
    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 sm:rounded-full">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!hasText(value)) return null;

  return (
    <div className="grid min-w-0 gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[96px_1fr]">
      <dt className="text-sm font-semibold text-slate-800">{label}</dt>
      <dd className="min-w-0 break-words text-sm leading-6 text-slate-600">{value}</dd>
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
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
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
  mode = null,
  originalPrompt = null,
}: PostCreationAdaptiveNativePlanStageProps) {
  if (!plan) return null;

  const presentation = buildPostCreationAdaptivePlanPresentation({
    plan,
    mode,
    originalPrompt,
  });
  const canUsePlan = Boolean(onUsePlan && legacyHandoff) && !loading && !disabled;
  const canInteract = !loading && !disabled;
  const showPautaContext =
    hasText(plan.pauta) &&
    (!hasText(presentation.primaryValue) || plan.pauta.trim() !== presentation.primaryValue.trim());
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
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-sm sm:p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{presentation.eyebrow}</p>
        <div>
          <h2 className="break-words text-2xl font-semibold leading-tight text-slate-950">
            {presentation.title}
          </h2>
          <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-slate-600">
            {presentation.subtitle}
          </p>
          {hasText(presentation.promptContext) ? (
            <p className="mt-2 max-w-2xl break-words text-xs font-medium leading-5 text-slate-500">
              {presentation.promptContext}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        {hasText(presentation.primaryValue) ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{presentation.primaryLabel}</p>
            <h3 className="mt-1 break-words text-xl font-semibold leading-tight text-slate-950">{presentation.primaryValue}</h3>
          </div>
        ) : null}
        {showPautaContext ? (
          <p className="mt-3 max-w-3xl break-words text-sm font-semibold leading-6 text-slate-800">Pauta: {plan.pauta}</p>
        ) : null}
        {hasText(presentation.summary) ? (
          <p className="mt-3 max-w-3xl break-words text-sm leading-6 text-slate-600">{presentation.summary}</p>
        ) : null}
        <div className="mt-4 flex min-w-0 flex-wrap gap-2">
          <DetailPill label="Objetivo" value={plan.objective} />
          <DetailPill label="Narrativa" value={plan.narrative} />
          <DetailPill label="Formato" value={plan.format} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {hasWhy ? (
          <Section title={presentation.sectionTitles.why}>
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
          <Section title={presentation.sectionTitles.execution}>
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
          <Section title={presentation.sectionTitles.hookCta}>
            <dl className="grid gap-3 md:grid-cols-2">
              <DetailRow label="Gancho" value={plan.hook} />
              <DetailRow label="CTA" value={plan.cta} />
            </dl>
          </Section>
        </div>
      ) : null}

      {scenes.length > 0 ? (
        <div className="mt-4">
          <Section title={presentation.sectionTitles.scenes}>
            <div className="grid gap-3 md:grid-cols-2">
              {scenes.map((scene) => (
                <article key={scene.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {hasText(scene.title) ? <h4 className="break-words text-sm font-semibold text-slate-950">{scene.title}</h4> : null}
                  {hasText(scene.visual) ? <p className="mt-2 break-words text-sm leading-6 text-slate-600">{scene.visual}</p> : null}
                  {hasText(scene.message) ? <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-900">{scene.message}</p> : null}
                  {hasText(scene.direction) ? <p className="mt-2 break-words text-xs leading-5 text-slate-500">{scene.direction}</p> : null}
                </article>
              ))}
            </div>
          </Section>
        </div>
      ) : null}

      {showBrandMatch || showCollabMatch ? (
        <div className="mt-4">
          <Section title={presentation.sectionTitles.opportunities}>
            <div className="grid gap-3 md:grid-cols-2">
              {showBrandMatch ? (
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">Marca</h4>
                  {hasText(plan.brandMatch?.category) ? (
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">{plan.brandMatch.category}</p>
                  ) : null}
                  {hasText(plan.brandMatch?.angle) ? (
                    <p className="mt-2 break-words text-sm font-medium leading-6 text-slate-900">{plan.brandMatch.angle}</p>
                  ) : null}
                </article>
              ) : null}

              {showCollabMatch ? (
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">Collab</h4>
                  {hasText(plan.collabMatch?.creatorProfile) ? (
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">{plan.collabMatch.creatorProfile}</p>
                  ) : null}
                  {hasText(plan.collabMatch?.collaborationAngle) ? (
                    <p className="mt-2 break-words text-sm font-medium leading-6 text-slate-900">
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
          <Section title={presentation.sectionTitles.nextActions}>
            <div className="flex min-w-0 flex-wrap gap-2">
              {nextActions.map((action) => (
                <span key={action} className="max-w-full break-words rounded-2xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 sm:rounded-full">
                  {action}
                </span>
              ))}
            </div>
          </Section>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:pb-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {onBack ? (
            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={!canInteract}
              onClick={onBack}
            >
              Voltar e ajustar
            </button>
          ) : null}

          {onReset ? (
            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={!canInteract}
              onClick={onReset}
            >
              Criar outra estratégia
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white sm:w-auto"
          disabled={!canUsePlan}
          onClick={handleUsePlan}
        >
          {loading ? "Aplicando plano..." : "Usar este plano"}
        </button>
      </div>
    </section>
  );
}
