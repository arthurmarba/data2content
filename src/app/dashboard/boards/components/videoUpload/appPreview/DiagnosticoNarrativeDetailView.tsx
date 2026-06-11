"use client";

import React, { useState, useEffect } from "react";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { resolveDiagnosticoLeadingNarrativeSignal } from "@/app/dashboard/boards/videoUpload/diagnosticoNarrativeSignals";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { DiagnosticoDetailEmptyState } from "./DiagnosticoDetailEmptyState";
import { DiagnosticoNarrativeCard } from "./DiagnosticoNarrativeCard";
import { DiagnosticoHypothesesCard } from "./DiagnosticoHypothesesCard";
import { DiagnosticoTerritoriesCard } from "./DiagnosticoTerritoriesCard";
import { DiagnosticoToneCard } from "./DiagnosticoToneCard";
import { CATEGORY_META } from "./DiagnosticoCategoryMeta";
import type {
  ConfirmationState,
  ConfirmationResponse,
  AssetConfirmationResponse,
} from "./diagnosticoConfirmationTypes";

interface Props {
  synthesis: CreatorStrategicProfileSynthesis;
  instagramConnected: boolean;
  instagramEnriched: boolean;
  onClose: () => void;
  // ── Confirmation props ──────────────────────────────────────────────────────
  /** Narrative signal confirmation state. */
  narrativeConfirmationState?: ConfirmationState;
  onConfirmNarrative?: (response: ConfirmationResponse) => void;
  /** Territories block confirmation state. */
  territoriesConfirmationState?: ConfirmationState;
  onConfirmTerritories?: (response: ConfirmationResponse) => void;
  /** Dominant tone confirmation state. */
  toneConfirmationState?: ConfirmationState;
  onConfirmTone?: (response: ConfirmationResponse) => void;
  /** Per-asset inline confirmation for emerging life-asset chips. */
  onConfirmAsset?: (assetLabel: string, response: AssetConfirmationResponse) => void;
  /** Current per-asset confirmation states — keys are asset labels. */
  assetConfirmations?: Map<string, "confirmed" | "dismissed">;
  /** Labels of hypotheses already endorsed by the creator. */
  endorsedHypotheses?: string[];
  /** Labels of hypotheses the creator rejected ("Não faz sentido") — filtered out. */
  dismissedHypotheses?: string[];
  // ── Etapa 4: adjacent narratives ────────────────────────────────────────────
  /** All adjacent narratives from mapConfirmations (pending / confirmed / dismissed). */
  adjacentNarrativesFromMap?: Array<{
    label: string;
    state: "pending" | "confirmed" | "dismissed";
    source: "detected" | "manual";
  }>;
  /**
   * Triggers AI detection of adjacent narrative candidates.
   * Returns detected labels on success, null on failure.
   */
  onDetectAdjacents?: () => Promise<Array<{ label: string }> | null>;
  /** Persists a creator's response to a detected adjacent narrative candidate. */
  onConfirmAdjacent?: (label: string, response: "yes" | "almost" | "no") => void;
  /** Adds a free-text (manual) adjacent narrative confirmed by the creator. */
  onAddAdjacentNarrative?: (label: string) => void;
}

export function DiagnosticoNarrativeDetailView({
  synthesis: s,
  instagramEnriched,
  onClose,
  narrativeConfirmationState,
  onConfirmNarrative,
  territoriesConfirmationState,
  onConfirmTerritories,
  toneConfirmationState,
  onConfirmTone,
  onConfirmAsset,
  assetConfirmations,
  endorsedHypotheses,
  dismissedHypotheses,
  adjacentNarrativesFromMap,
  onDetectAdjacents,
  onConfirmAdjacent,
  onAddAdjacentNarrative,
}: Props) {
  // ── Etapa 4: adjacent narratives local state ───────────────────────────────
  const [localAdjacentNarratives, setLocalAdjacentNarratives] = useState(
    adjacentNarrativesFromMap ?? [],
  );
  const [adjacentPendingSet, setAdjacentPendingSet] = useState<Set<string>>(new Set());
  const [adjacentDismissedLocal, setAdjacentDismissedLocal] = useState<Set<string>>(new Set());
  const [isDetectingAdjacents, setIsDetectingAdjacents] = useState(false);
  const [adjacentDetectError, setAdjacentDetectError] = useState(false);
  const [adjacentAddInput, setAdjacentAddInput] = useState("");
  const [adjacentAddPending, setAdjacentAddPending] = useState(false);

  useEffect(() => {
    setLocalAdjacentNarratives(adjacentNarrativesFromMap ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjacentNarrativesFromMap?.length]);

  const confirmedAdjacents = localAdjacentNarratives
    .filter((a) => a.state === "confirmed" && !adjacentDismissedLocal.has(a.label))
    .map((a) => a.label);
  const pendingAdjacents = localAdjacentNarratives
    .filter((a) => a.state === "pending" && !adjacentDismissedLocal.has(a.label))
    .map((a) => a.label);

  const prereqsMet =
    narrativeConfirmationState === "confirmed" &&
    territoriesConfirmationState === "confirmed" &&
    s.analyzedReadingsCount >= 3;

  const showDetectTrigger =
    prereqsMet &&
    pendingAdjacents.length === 0 &&
    !isDetectingAdjacents &&
    onDetectAdjacents != null;

  async function handleDetectAdjacents() {
    if (isDetectingAdjacents || !onDetectAdjacents) return;
    setIsDetectingAdjacents(true);
    setAdjacentDetectError(false);
    try {
      const candidates = await onDetectAdjacents();
      if (candidates && candidates.length > 0) {
        setLocalAdjacentNarratives((prev) => {
          const existingLabels = new Set(prev.map((a) => a.label.toLowerCase().trim()));
          const newItems = candidates.filter(
            (c) => !existingLabels.has(c.label.toLowerCase().trim()),
          );
          return [
            ...prev,
            ...newItems.map((c) => ({
              label: c.label,
              state: "pending" as const,
              source: "detected" as const,
            })),
          ];
        });
      } else if (candidates === null) {
        setAdjacentDetectError(true);
      }
    } finally {
      setIsDetectingAdjacents(false);
    }
  }

  async function handleConfirmAdjacent(label: string, response: "yes" | "almost" | "no") {
    if (adjacentPendingSet.has(label) || !onConfirmAdjacent) return;
    setAdjacentPendingSet((p) => new Set(p).add(label));
    if (response === "no") {
      setAdjacentDismissedLocal((d) => new Set(d).add(label));
    } else {
      setLocalAdjacentNarratives((prev) =>
        prev.map((a) => (a.label === label ? { ...a, state: "confirmed" as const } : a)),
      );
    }
    try {
      await onConfirmAdjacent(label, response);
    } catch {
      // non-fatal — server will reconcile on reload
    } finally {
      setAdjacentPendingSet((p) => { const n = new Set(p); n.delete(label); return n; });
    }
  }

  async function handleAddAdjacentNarrative() {
    const label = adjacentAddInput.trim();
    if (!label || adjacentAddPending || !onAddAdjacentNarrative) return;
    setAdjacentAddPending(true);
    setLocalAdjacentNarratives((prev) => [
      ...prev,
      { label, state: "confirmed" as const, source: "manual" as const },
    ]);
    setAdjacentAddInput("");
    try {
      await onAddAdjacentNarrative(label);
    } catch {
      // non-fatal
    } finally {
      setAdjacentAddPending(false);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────
  const meta = CATEGORY_META.narrative;
  const leadingNarrative = resolveDiagnosticoLeadingNarrativeSignal(s);
  const hasAnything =
    leadingNarrative != null ||
    s.testedNarratives.length > 0 ||
    s.narrativeTerritories.length > 0 ||
    s.dominantTone != null;

  // ── Threshold guards: only offer confirmation when there's enough signal ────
  // Avoids asking "Faz parte do seu mapa?" after a single reading with no pattern.
  const shouldAskNarrative =
    narrativeConfirmationState === "pending" &&
    onConfirmNarrative != null &&
    (leadingNarrative?.evidenceCount ?? 0) >= 2;

  const shouldAskTerritories =
    territoriesConfirmationState === "pending" &&
    onConfirmTerritories != null &&
    s.narrativeTerritories.length >= 2;

  const shouldAskTone =
    toneConfirmationState === "pending" &&
    onConfirmTone != null &&
    s.toneSignals.length >= 1;

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
    >
      {!hasAnything ? (
        <DiagnosticoDetailEmptyState
          iconBg="bg-orange-50"
          iconSlot={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4" fill="#f97316" />
            </svg>
          }
          title="Sua narrativa começa após 2+ análises com tema similar"
          description="A D2C precisa de pelo menos 2 vídeos com narrativa parecida para identificar um padrão dominante."
        />
      ) : (
        <>
          {/* Hero: confirmed narrative or first narrative signal under observation */}
          {leadingNarrative && (
            <DiagnosticoNarrativeCard
              label={leadingNarrative.label}
              summary={leadingNarrative.summary}
              confidence={leadingNarrative.confidence}
              evidenceCount={leadingNarrative.evidenceCount}
              igEnriched={instagramEnriched}
              narrativeConfirmationState={
                shouldAskNarrative ? "pending" : narrativeConfirmationState
              }
              onConfirmNarrative={shouldAskNarrative ? onConfirmNarrative : undefined}
            />
          )}

          {/* Narrative territories — etapa 3: subjects the creator occupies with legitimacy.
               De-duplicate: exclude any territory whose label matches the leading narrative exactly,
               so the same concept doesn't appear in two consecutive cards. */}
          <DiagnosticoTerritoriesCard
            territories={
              leadingNarrative
                ? s.narrativeTerritories.filter(
                    (t) => t.label.trim().toLowerCase() !== leadingNarrative.label.trim().toLowerCase()
                  )
                : s.narrativeTerritories
            }
            territoriesConfirmationState={
              shouldAskTerritories ? "pending" : territoriesConfirmationState
            }
            onConfirmTerritories={shouldAskTerritories ? onConfirmTerritories : undefined}
          />

          {/* Hypotheses in test — etapa 4: adjacent narratives under observation.
               De-duplicate: exclude hypotheses whose label matches the main narrative,
               so the creator doesn't see the same concept labelled differently twice. */}
          <DiagnosticoHypothesesCard
            hypotheses={
              leadingNarrative
                ? s.testedNarratives.filter(
                    (h) => h.label.trim().toLowerCase() !== leadingNarrative.label.trim().toLowerCase()
                  )
                : s.testedNarratives
            }
            endorsedHypotheses={endorsedHypotheses}
            dismissedHypotheses={dismissedHypotheses}
          />

          {/* Tone and life context fingerprint — etapa 5+6: how the creator communicates */}
          <DiagnosticoToneCard
            dominantTone={s.dominantTone}
            toneSignals={s.toneSignals}
            confirmedLifeAssets={s.confirmedLifeAssets}
            topPerformingPattern={s.topPerformingPattern}
            toneConfirmationState={shouldAskTone ? "pending" : toneConfirmationState}
            onConfirmTone={shouldAskTone ? onConfirmTone : undefined}
            onConfirmAsset={onConfirmAsset}
            assetConfirmations={assetConfirmations}
          />

          {/* ── Etapa 4: Você também fala sobre — full detection/confirm/add flow ── */}
          {(onDetectAdjacents != null || confirmedAdjacents.length > 0 || pendingAdjacents.length > 0) && (
            <AdjacentNarrativesSection
              confirmedAdjacents={confirmedAdjacents}
              pendingAdjacents={pendingAdjacents}
              adjacentPendingSet={adjacentPendingSet}
              showDetectTrigger={showDetectTrigger}
              isDetectingAdjacents={isDetectingAdjacents}
              adjacentDetectError={adjacentDetectError}
              adjacentAddInput={adjacentAddInput}
              adjacentAddPending={adjacentAddPending}
              prereqsMet={prereqsMet}
              onDetect={handleDetectAdjacents}
              onConfirm={handleConfirmAdjacent}
              onAddInputChange={setAdjacentAddInput}
              onAdd={handleAddAdjacentNarrative}
            />
          )}
        </>
      )}
    </DiagnosticoCategoryDetailView>
  );
}

// ─── AdjacentNarrativesSection ────────────────────────────────────────────────

function AdjacentNarrativesSection({
  confirmedAdjacents,
  pendingAdjacents,
  adjacentPendingSet,
  showDetectTrigger,
  isDetectingAdjacents,
  adjacentDetectError,
  adjacentAddInput,
  adjacentAddPending,
  prereqsMet,
  onDetect,
  onConfirm,
  onAddInputChange,
  onAdd,
}: {
  confirmedAdjacents: string[];
  pendingAdjacents: string[];
  adjacentPendingSet: Set<string>;
  showDetectTrigger: boolean;
  isDetectingAdjacents: boolean;
  adjacentDetectError: boolean;
  adjacentAddInput: string;
  adjacentAddPending: boolean;
  prereqsMet: boolean;
  onDetect: () => void;
  onConfirm: (label: string, response: "yes" | "almost" | "no") => void;
  onAddInputChange: (v: string) => void;
  onAdd: () => void;
}) {
  const PURPLE = "#7c3aed";
  const PURPLE_LIGHT = "#f3f0ff";
  const PURPLE_BORDER = "#e9d5ff";

  const cardStyle: React.CSSProperties = {
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 1px 4px rgba(28,28,30,0.08), 0 0 0 0.5px rgba(28,28,30,0.04)",
    padding: "18px 20px 18px",
    marginTop: 12,
  };

  return (
    <div style={cardStyle}>
      {/* Section header */}
      <p style={{ fontSize: 11, fontWeight: 700, color: PURPLE, margin: "0 0 12px", letterSpacing: 0.6, textTransform: "uppercase" }}>
        Você também fala sobre
      </p>

      {/* Estado 4: confirmed chips */}
      {confirmedAdjacents.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: pendingAdjacents.length > 0 ? 14 : 0 }}>
          {confirmedAdjacents.map((label) => (
            <span
              key={label}
              style={{
                borderRadius: 999, padding: "4px 12px",
                background: PURPLE_LIGHT, color: PURPLE,
                fontSize: 12, fontWeight: 600,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Estado 3: pending candidate — inline confirm, one at a time */}
      {pendingAdjacents.slice(0, 1).map((label) => (
        <div key={label} style={{ marginTop: confirmedAdjacents.length > 0 ? 4 : 0 }}>
          <p style={{ fontSize: 11, color: PURPLE, margin: "0 0 4px", letterSpacing: 0.1 }}>
            Isso é um outro lado do que você cria?
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#18181b", margin: "0 0 10px", lineHeight: 1.35 }}>
            {label}
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={adjacentPendingSet.has(label)}
              onClick={() => onConfirm(label, "yes")}
              style={{
                borderRadius: 999, padding: "6px 16px",
                background: PURPLE, color: "#fff",
                fontSize: 12, fontWeight: 700, border: "none",
                cursor: adjacentPendingSet.has(label) ? "default" : "pointer",
                fontFamily: "inherit",
                opacity: adjacentPendingSet.has(label) ? 0.5 : 1,
              }}
            >
              Sim
            </button>
            <button
              type="button"
              disabled={adjacentPendingSet.has(label)}
              onClick={() => onConfirm(label, "almost")}
              style={{
                borderRadius: 999, padding: "6px 16px",
                background: PURPLE_LIGHT, color: PURPLE,
                fontSize: 12, fontWeight: 600, border: "none",
                cursor: adjacentPendingSet.has(label) ? "default" : "pointer",
                fontFamily: "inherit",
                opacity: adjacentPendingSet.has(label) ? 0.5 : 1,
              }}
            >
              Quase
            </button>
            <button
              type="button"
              disabled={adjacentPendingSet.has(label)}
              onClick={() => onConfirm(label, "no")}
              style={{
                borderRadius: 999, padding: "6px 16px",
                background: "#f4f4f5", color: "#71717a",
                fontSize: 12, fontWeight: 600, border: "none",
                cursor: adjacentPendingSet.has(label) ? "default" : "pointer",
                fontFamily: "inherit",
                opacity: adjacentPendingSet.has(label) ? 0.5 : 1,
              }}
            >
              Não é isso
            </button>
          </div>
          {pendingAdjacents.length > 1 && (
            <p style={{ fontSize: 11, color: "#a1a1aa", margin: "6px 0 0" }}>
              +{pendingAdjacents.length - 1} para responder depois
            </p>
          )}
        </div>
      ))}

      {/* Estado 2: no adjacents yet — discovery invite */}
      {confirmedAdjacents.length === 0 && pendingAdjacents.length === 0 && (
        <div>
          {prereqsMet ? (
            <>
              <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 12px", lineHeight: 1.5 }}>
                Sua narrativa tem outros ângulos além dos assuntos que você ocupa. Quer descobrir?
              </p>
              {showDetectTrigger && (
                <button
                  type="button"
                  onClick={onDetect}
                  disabled={isDetectingAdjacents}
                  style={{
                    borderRadius: 999, padding: "7px 18px",
                    background: PURPLE_LIGHT, color: PURPLE,
                    fontSize: 13, fontWeight: 600, border: "none",
                    cursor: isDetectingAdjacents ? "default" : "pointer",
                    fontFamily: "inherit",
                    opacity: isDetectingAdjacents ? 0.5 : 1,
                  }}
                >
                  {isDetectingAdjacents ? "Detectando…" : "Descobrir ângulos"}
                </button>
              )}
              {adjacentDetectError && (
                <p style={{ fontSize: 12, color: "#f59e0b", margin: "10px 0 0", lineHeight: 1.4 }}>
                  Não conseguimos detectar agora. Tente em alguns instantes.
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: "#a1a1aa", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>
              Confirme sua narrativa e territórios para descobrir ângulos adjacentes.
            </p>
          )}
        </div>
      )}

      {/* Estado 4b: "descobrir mais" — after confirmed, when trigger available */}
      {showDetectTrigger && confirmedAdjacents.length > 0 && pendingAdjacents.length === 0 && (
        <button
          type="button"
          onClick={onDetect}
          disabled={isDetectingAdjacents}
          style={{
            marginTop: 12, borderRadius: 999, padding: "5px 14px",
            background: "transparent", color: PURPLE,
            fontSize: 12, fontWeight: 600,
            border: `1px solid ${PURPLE_BORDER}`,
            cursor: isDetectingAdjacents ? "default" : "pointer",
            fontFamily: "inherit",
            opacity: isDetectingAdjacents ? 0.5 : 1,
          }}
        >
          {isDetectingAdjacents ? "Detectando…" : "+ Descobrir mais"}
        </button>
      )}

      {/* Free-text add — only after at least one confirmed adjacent */}
      {confirmedAdjacents.length > 0 && prereqsMet && (
        <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
          <input
            type="text"
            value={adjacentAddInput}
            onChange={(e) => onAddInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
            placeholder="Outro ângulo que você reconhece…"
            maxLength={80}
            style={{
              flex: 1, borderRadius: 999, padding: "6px 14px",
              border: "1px solid #e4e4e7", background: "#fafafa",
              fontSize: 13, color: "#3f3f46", fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={!adjacentAddInput.trim() || adjacentAddPending}
            style={{
              borderRadius: 999, padding: "6px 14px",
              background: adjacentAddInput.trim() ? PURPLE : "#e4e4e7",
              color: adjacentAddInput.trim() ? "#fff" : "#a1a1aa",
              fontSize: 13, fontWeight: 600, border: "none",
              cursor: adjacentAddInput.trim() && !adjacentAddPending ? "pointer" : "default",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
