"use client";

import { useState } from "react";
import type { DiagnosticoPageData, DiagnosticoOnboardingAnswers } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import { resolveDiagnosticoLeadingNarrativeSignal } from "@/app/dashboard/boards/videoUpload/diagnosticoNarrativeSignals";
import {
  DIAG_STATUS_EVOLUTION,
  DIAG_STATUS_LABELS,
  DIAG_STATUS_STEP,
} from "./diagnosticoTokens";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { DiagnosticoCardShell } from "./DiagnosticoCardShell";
import {
  refineDiagnosticoNextMove,
  refineDiagnosticoSignal,
} from "./diagnosticoDisplayText";

interface Props {
  data: DiagnosticoPageData;
  onNewReading: () => void;
  onOpenReadings: () => void;
  onOpenIdeas?: () => void;
  onClose: () => void;
}

const RING_BASE = 5;
const RING_R = 34;
const RING_CX = 46;
const RING_CY = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

/** Next milestone: always a multiple of 5 strictly above the current count. */
function ringTarget(count: number): number {
  return Math.max(RING_BASE, Math.ceil((count + 1) / RING_BASE) * RING_BASE);
}

const STATUS_CONTEXT_COPY: Record<string, string> = {
  empty: "Envie o primeiro vídeo para começar.",
  first_reading: "Primeira leitura feita. Mais vídeos revelam padrões.",
  signals_emerging: "Primeiros sinais detectados. O mapa está tomando forma.",
  pattern_in_formation: "Padrão confirmado. Narrativa emergindo.",
  profile_consistent: "Perfil narrativo sólido.",
};

export function DiagnosticoOverviewDetailView({
  data,
  onNewReading,
  onOpenReadings,
  onOpenIdeas,
  onClose,
}: Props) {
  const { synthesis: s, profileSynthesisStatus, readingQuota } = data;
  const statusLabel = profileSynthesisStatus
    ? DIAG_STATUS_EVOLUTION[profileSynthesisStatus] ?? "Diagnóstico em andamento"
    : "Diagnóstico em andamento";
  const step = Math.max(-1, Math.min(DIAG_STATUS_STEP[profileSynthesisStatus || "empty"] ?? -1, 5));
  const ringTargetValue = ringTarget(s.analyzedReadingsCount);
  const ringPct = Math.min((s.analyzedReadingsCount / ringTargetValue) * 100, 100);
  const dashFill = (ringPct / 100) * RING_CIRCUMFERENCE;
  const dashGap = RING_CIRCUMFERENCE - dashFill;
  const leadingNarrative = resolveDiagnosticoLeadingNarrativeSignal(s);
  const leadingNarrativeCopy = leadingNarrative
    ? refineDiagnosticoSignal(leadingNarrative, "narrative")
    : null;
  const nextMoveCopy = s.nextStrategicMove
    ? refineDiagnosticoNextMove(s.nextStrategicMove)
    : null;
  const leadingNarrativeLabel =
    leadingNarrative?.source === "main_narrative" || (leadingNarrative?.evidenceCount ?? 0) >= 2
      ? "Narrativa principal"
      : "Sinal narrativo";
  const remainingThisMonth =
    readingQuota?.proMonthlyLimit != null
      ? Math.max(readingQuota.proMonthlyLimit - readingQuota.usedThisMonth, 0)
      : null;
  const hasSavedIdeas = (data.contentIdeas ?? []).some((i) => i.status === "saved");

  return (
    <DiagnosticoCategoryDetailView
      title="Diagnóstico"
      iconBg="bg-orange-500"
      iconSlot={<DiagnosisIcon />}
      onClose={onClose}
    >
      <DiagnosticoCardShell>
        <div className="p-6">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-[28px] font-bold leading-[1.08] text-zinc-950">
                {statusLabel}
              </h2>
              <p className="mt-2 text-[16px] font-medium leading-snug text-zinc-500">
                {s.analyzedReadingsCount} {s.analyzedReadingsCount === 1 ? "vídeo analisado" : "vídeos analisados"}
              </p>
            </div>
            <DiagnosisRing
              value={s.analyzedReadingsCount}
              target={ringTargetValue}
              dashFill={dashFill}
              dashGap={dashGap}
            />
          </div>
        </div>
      </DiagnosticoCardShell>

      {data.weeklyMapSummary && (
        <WeeklyMapSummaryCard summary={data.weeklyMapSummary} />
      )}

      <DiagnosticoCardShell>
        <div className="p-5">
          <p className="text-[14px] font-bold leading-none text-zinc-500">Evolução</p>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {DIAG_STATUS_LABELS.map((label, index) => {
              const active = index < step;
              return (
                <div key={label} className="min-w-0">
                  <div
                    className={`h-2 rounded-full ${
                      active ? "bg-orange-500" : "bg-zinc-200"
                    }`}
                  />
                  <p
                    className={`mt-2 truncate text-center text-[10px] font-semibold ${
                      active ? "text-orange-600" : "text-zinc-400"
                    }`}
                  >
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-[15px] font-medium leading-relaxed text-zinc-500">
            {STATUS_CONTEXT_COPY[profileSynthesisStatus ?? "empty"] ?? STATUS_CONTEXT_COPY.empty}
          </p>
        </div>
      </DiagnosticoCardShell>

      {leadingNarrativeCopy && (
        <DiagnosticoCardShell>
          <div className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-orange-500">{leadingNarrativeLabel}</p>
            <p className="mt-2.5 text-[20px] font-bold leading-snug text-zinc-950">
              {leadingNarrativeCopy.label}
            </p>
            <p className="mt-3 text-[11px] font-semibold text-zinc-400">
              {leadingNarrative?.evidenceCount ?? 0} {(leadingNarrative?.evidenceCount ?? 0) === 1 ? "sinal em observação" : "sinais sustentando esta narrativa"}
            </p>
          </div>
        </DiagnosticoCardShell>
      )}

      {data.onboardingAnswers && (
        <OnboardingAnswersCard answers={data.onboardingAnswers} />
      )}

      <DiagnosticoCardShell>
        <div className="p-5">
          <p className="text-[14px] font-bold leading-none text-zinc-500">Próximo passo</p>
          <h3 className="mt-4 text-[22px] font-bold leading-tight text-zinc-950">
            {nextMoveCopy?.label ?? "Analisar mais um vídeo"}
          </h3>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-zinc-500">
            {nextMoveCopy?.description ??
              "Envie outro vídeo para a D2C comparar padrões."}
          </p>
          <div className="mt-5 flex gap-2.5">
            {hasSavedIdeas && onOpenIdeas ? (
              <button
                type="button"
                onClick={onOpenIdeas}
                className="flex-1 rounded-full bg-zinc-950 px-4 py-3 text-[14px] font-bold text-white active:scale-[0.985]"
              >
                Ver pautas
              </button>
            ) : (
              <button
                type="button"
                onClick={onNewReading}
                className="flex-1 rounded-full bg-zinc-950 px-4 py-3 text-[14px] font-bold text-white active:scale-[0.985]"
              >
                Analisar vídeo
              </button>
            )}
            <button
              type="button"
              onClick={onOpenReadings}
              className="flex-1 rounded-full bg-zinc-100 px-4 py-3 text-[14px] font-bold text-zinc-900 active:scale-[0.985]"
            >
              Ver leituras
            </button>
          </div>
          {remainingThisMonth != null ? (
            <p className="mt-3 text-center text-[12px] font-medium text-zinc-400">
              {remainingThisMonth} {remainingThisMonth === 1 ? "análise restante" : "análises restantes"} neste mês
            </p>
          ) : null}
        </div>
      </DiagnosticoCardShell>
    </DiagnosticoCategoryDetailView>
  );
}

// ─── Onboarding answers card ──────────────────────────────────────────────────

const ONBOARDING_LABELS: Record<keyof DiagnosticoOnboardingAnswers, string> = {
  whyYouCreate: "Por que você cria conteúdo?",
  desiredFeeling: "Que sensação quer gerar no seu público?",
  contentLimit: "O que você não quer que seu conteúdo seja?",
  creatorPurpose: "Seu propósito como criador",
};

function OnboardingAnswersCard({ answers }: { answers: DiagnosticoOnboardingAnswers }) {
  const [editing, setEditing] = useState(false);
  const [currentAnswers, setCurrentAnswers] = useState<DiagnosticoOnboardingAnswers>({ ...answers });
  const [draft, setDraft] = useState<DiagnosticoOnboardingAnswers>({ ...answers });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasAnyAnswer = Object.values(currentAnswers).some(Boolean);
  if (!hasAnyAnswer) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/mobile-strategic-profile/onboarding-answers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error("onboarding_answers_save_failed");
      setCurrentAnswers({ ...draft });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // non-fatal
    } finally {
      setSaving(false);
    }
  }

  return (
    <DiagnosticoCardShell>
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-bold leading-none text-zinc-500">O que você nos contou</p>
          {!editing && (
            <button
              type="button"
              onClick={() => { setDraft({ ...currentAnswers }); setEditing(true); }}
              className="text-[12px] font-semibold text-purple-600"
            >
              Editar
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-4">
          {(Object.keys(ONBOARDING_LABELS) as (keyof DiagnosticoOnboardingAnswers)[]).map((field) => {
            const answer = editing ? draft[field] : currentAnswers[field];
            if (!editing && !answer) return null;
            return (
              <div key={field}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  {ONBOARDING_LABELS[field]}
                </p>
                {editing ? (
                  <textarea
                    className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed text-zinc-800 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-200"
                    rows={2}
                    value={draft[field] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                    placeholder="(vazio)"
                  />
                ) : (
                  <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-700">
                    {answer ?? <span className="text-zinc-400 italic">Não respondida</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {editing && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-full bg-zinc-950 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 rounded-full bg-zinc-100 py-2.5 text-[13px] font-bold text-zinc-700"
            >
              Cancelar
            </button>
          </div>
        )}
        {saved && (
          <p className="mt-3 text-center text-[12px] font-semibold text-emerald-600">
            Respostas salvas ✓
          </p>
        )}
      </div>
    </DiagnosticoCardShell>
  );
}

// ─── Weekly map summary card ──────────────────────────────────────────────────

function WeeklyMapSummaryCard({ summary }: { summary: string }) {
  return (
    <DiagnosticoCardShell>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-500 text-[11px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-orange-500">
            Seu mapa esta semana
          </p>
        </div>
        <p className="text-[15px] leading-[1.65] text-zinc-700">
          {summary}
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function DiagnosisRing({
  value,
  target,
  dashFill,
  dashGap,
}: {
  value: number;
  target: number;
  dashFill: number;
  dashGap: number;
}) {
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true" className="shrink-0">
      <circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none" stroke="var(--ds-color-neutral)" strokeWidth="9" />
      {value > 0 ? (
        <circle
          cx={RING_CX}
          cy={RING_CY}
          r={RING_R}
          fill="none"
          stroke="#f97316"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dashFill} ${dashGap}`}
          transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
        />
      ) : null}
      <text x={RING_CX} y="43" textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="700" fill="var(--ds-color-ink)">
        {value}
      </text>
      <text x={RING_CX} y="62" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="600" fill="var(--ds-color-text-muted)">
        de {target}
      </text>
    </svg>
  );
}

function DiagnosisIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 13h4l3-7 4 12 2-5h3" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
