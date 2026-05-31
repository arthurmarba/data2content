"use client";

import { useState, useCallback } from "react";

export interface ReadingDetailSpeech {
  summary: string;
  openingRead: string;
  clarityRead: string;
  pacingRead: string;
  suggestedLine: string;
  suggestedOpening: string;
  suggestedClosing: string;
}

export interface ReadingDetailProduction {
  summary: string;
  framing: string;
  lighting: string;
  audio: string;
  editingRhythm: string;
  firstFrame: string;
  visualClarity: string;
}

export interface ReadingDetailCommercial {
  summary: string;
  brandTerritories: string[];
  whyItCouldFitBrands: string;
  adAdaptationIdea: string;
  limitations: string;
}

export interface ReadingDetailRecommendation {
  mainAdjustment: string;
  nextExperiment: string;
  whatToRepeat: string;
  whatToAvoid: string;
  successSignal: string;
}

export interface ReadingDetailContribution {
  type: string;
  confidence: string;
  reason: string;
  profileImpactPreview: string;
}

export type NarrativeCoherenceVerdict =
  | "confirms_top_pattern"
  | "experiment"
  | "deviation"
  | "first_reading"
  | "unknown";

export interface NarrativeCoherence {
  verdict: NarrativeCoherenceVerdict;
  /** The creator's top pattern used as reference — e.g. "praia + família + humor" */
  topPattern: string | null;
  /** Brief explanation of the verdict */
  reasoning: string | null;
  /** Life assets from prior readings that this video confirms */
  alignedAssets: string[];
  /** Potential new assets detected in this video */
  newAssets: string[];
}

export interface EvidenceAnchorsSpeechQuote {
  quote: string;
  source: "creator_spoken" | "ai_suggested";
  quoteRole: "hook" | "promise" | "turning_point" | "closing" | "example" | "context" | "other";
  whyItMatters: string;
  chapterHint: string;
}

export interface EvidenceAnchorsSceneAnchor {
  description: string;
  source: string;
  momentRole: "opening" | "conflict" | "turning_point" | "visual_signal" | "pacing_signal" | "production_signal" | "other";
  whyItMatters: string;
  chapterHint: string;
}

export interface EvidenceAnchors {
  speechQuotes: EvidenceAnchorsSpeechQuote[];
  sceneAnchors: EvidenceAnchorsSceneAnchor[];
  creatorIntentAnchor?: {
    statedGoal: string;
    interpretedGoal: string;
    whyItMatters: string;
  } | null;
  instagramAnchors?: Array<{
    signalLabel: string;
    whyItMatters: string;
    evidenceSummary: string;
  }>;
}

export interface ReadingDetail {
  diagnosisId: string;
  rememberedAs: string;
  createdAt: string | null;
  videoReading: {
    title: string;
    summary: string;
    whatVideoReveals: string;
    mainNarrative: string;
    creatorIntent: string;
    dominantInsight: string;
  };
  speechReading: ReadingDetailSpeech;
  productionReading: ReadingDetailProduction;
  commercialReading: ReadingDetailCommercial;
  strategicRecommendation: ReadingDetailRecommendation;
  profileContribution: ReadingDetailContribution;
  evidenceAnchors: EvidenceAnchors | null;
  narrativeCoherence: NarrativeCoherence | null;
}

export type ReadingDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; data: ReadingDetail };

export function useReadingDetail() {
  const [state, setState] = useState<ReadingDetailState>({ status: "idle" });

  const fetch = useCallback(async (diagnosisId: string) => {
    setState({ status: "loading" });
    try {
      const res = await window.fetch(
        `/api/dashboard/mobile-strategic-profile/reading/${encodeURIComponent(diagnosisId)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({ status: "error", message: body?.error ?? "Erro ao carregar leitura." });
        return;
      }
      const data: ReadingDetail = await res.json();
      setState({ status: "loaded", data });
    } catch {
      setState({ status: "error", message: "Erro de conexão." });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, fetch, reset };
}
