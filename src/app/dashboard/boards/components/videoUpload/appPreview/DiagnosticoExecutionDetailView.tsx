"use client";

import { useState } from "react";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { DiagnosticoDetailEmptyState } from "./DiagnosticoDetailEmptyState";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { CATEGORY_META } from "./DiagnosticoCategoryMeta";
import { HC, CARD_P, CARD_BODY } from "./diagnosticoTokens";

const ALLOWED_FORMATS = ["Reels", "Carrossel", "Story", "Foto", "Vídeo longo"] as const;
type AllowedFormat = (typeof ALLOWED_FORMATS)[number];

interface Props {
  synthesis: CreatorStrategicProfileSynthesis;
  /** Formats the creator has already confirmed (pre-loaded from mapConfirmations). */
  confirmedFormats?: string[];
  onClose: () => void;
}

const AREA_SUBTITLE: Record<"speech" | "production", string> = {
  speech: "Abertura, ritmo de fala e estrutura verbal",
  production: "Ritmo visual, referências e escolhas de enquadramento",
};

export function DiagnosticoExecutionDetailView({ synthesis: s, confirmedFormats = [], onClose }: Props) {
  const meta = CATEGORY_META.execution;
  const speechPatterns = s.executionPatterns.filter((p) => p.area === "speech");
  const productionPatterns = s.executionPatterns.filter((p) => p.area === "production");
  const hasAnything = s.executionPatterns.length > 0;

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
    >
      {!hasAnything ? (
        <DiagnosticoDetailEmptyState
          iconBg="bg-fuchsia-50"
          iconSlot={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 12h3l3-9 4 18 3-12 2 6h3" stroke="#d946ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          title="Padrões de execução surgem com mais vídeos"
          description="A D2C detecta como você fala e produz depois de comparar pelo menos 2 análises. Envie mais vídeos para revelar seus padrões de criação."
        />
      ) : (
        <>
          {speechPatterns.length > 0 && (
            <ExecutionGroup
              area="speech"
              title="Como você fala"
              patterns={speechPatterns}
            />
          )}
          {productionPatterns.length > 0 && (
            <ExecutionGroup
              area="production"
              title="Como você produz"
              patterns={productionPatterns}
            />
          )}
        </>
      )}

      {/* ── Formats card — only after execution patterns exist.
           Asking the creator to confirm formats before showing any detected
           patterns means asking them to choose in a vacuum. ── */}
      {hasAnything && <FormatsConfirmationCard initialConfirmedFormats={confirmedFormats} />}
    </DiagnosticoCategoryDetailView>
  );
}

function ExecutionGroup({
  area,
  title,
  patterns,
}: {
  area: "speech" | "production";
  title: string;
  patterns: CreatorStrategicProfileSynthesis["executionPatterns"];
}) {
  const count = patterns.length;
  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.execution.bg}
          iconSlot={area === "speech" ? <SpeechIcon /> : <ProductionIcon />}
          category={title.toUpperCase()}
          catColor={HC.execution.text}
          timestamp={`${count} ${count === 1 ? "padrão" : "padrões"}`}
        />
        <ul className="flex flex-col">
          {patterns.map((p, i) => (
            <li key={i} className={i > 0 ? "border-t border-zinc-100 pt-4 mt-4" : ""}>
              <p className="text-[15px] font-semibold text-zinc-900 leading-snug">{p.label}</p>
              <p className="mt-2 text-[11px] font-semibold text-zinc-400">
                detectado em {p.evidenceCount} {p.evidenceCount === 1 ? "vídeo" : "vídeos"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </DiagnosticoCardShell>
  );
}

// ─── Formats confirmation card ────────────────────────────────────────────────

function FormatsConfirmationCard({ initialConfirmedFormats }: { initialConfirmedFormats: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialConfirmedFormats));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasChanged =
    selected.size !== initialConfirmedFormats.length ||
    [...selected].some((f) => !initialConfirmedFormats.includes(f));

  function toggle(format: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/dashboard/mobile-strategic-profile/map/confirm-formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formats: [...selected] }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // non-fatal
    } finally {
      setSaving(false);
    }
  }

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.execution.bg}
          iconSlot={<FormatsIcon />}
          category="SEUS FORMATOS"
          catColor={HC.execution.text}
        />
        <p className="mb-3 -mt-2 text-[12px] font-medium text-zinc-400">
          Quais formatos fazem mais sentido para sua narrativa?
        </p>
        <div className="flex flex-wrap gap-2">
          {ALLOWED_FORMATS.map((format) => {
            const isSelected = selected.has(format);
            return (
              <button
                key={format}
                type="button"
                onClick={() => toggle(format)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  isSelected
                    ? "bg-fuchsia-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {format}
              </button>
            );
          })}
        </div>
        {hasChanged && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full rounded-full bg-zinc-950 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Confirmar formatos"}
          </button>
        )}
        {saved && (
          <p className="mt-2 text-center text-[12px] font-semibold text-emerald-600">
            Formatos confirmados ✓
          </p>
        )}
        {selected.size > 0 && !hasChanged && (
          <p className="mt-3 text-[11px] text-zinc-400">
            Estes formatos serão usados como referência nas suas próximas pautas.
          </p>
        )}
      </div>
    </DiagnosticoCardShell>
  );
}

function FormatsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" stroke="white" strokeWidth="2" />
      <path d="M8 21h8M12 17v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SpeechIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ProductionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M23 7l-7 5 7 5V7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

