// mapaSeedSynthesisMerge.ts
//
// Funde o MapaSeed (semeado no onboarding, enriquecido por Instagram) na síntese
// de perfil que o card "Seu Mapa" renderiza. Antes, o card lia SÓ a síntese de
// vídeo — então um criador que conectou o Instagram (mas não subiu vídeo) via o
// mapa vazio, mesmo com narrativa/territórios já mapeados pelo Instagram. As
// pautas apareciam (o gate já lia o MapaSeed), mas o mapa não.
//
// Princípio: SEM prioridade de fonte. Vídeo e MapaSeed alimentam o mapa
// igualmente. Territórios, tom, assets e narrativas adjacentes são UNIÃO
// (dedupe por rótulo, evidência somada). A narrativa central é um slot singular:
// fica com o sinal de maior evidência; em empate, mantém o que já veio do vídeo e
// rebaixa a outra a hipótese adjacente — nenhuma fonte é descartada.
//
// Best-effort: MapaSeed ausente/vazio → síntese inalterada (sem regressão para
// criadores só-vídeo).

import MapaSeedModel from "@/app/models/MapaSeed";
import type {
  CreatorStrategicProfileSynthesis,
  CreatorStrategicProfileSynthesisConfidence,
  CreatorStrategicProfileSynthesisSignal,
} from "./creatorStrategicProfileSynthesis";

/** ID sintético de "diagnóstico" para o sinal vindo do MapaSeed contar evidência. */
const MAPASEED_DIAGNOSIS_ID = "mapaseed";

export interface MapaSeedSynthesisInput {
  narrativeLabel: string | null;
  territories: string[];
  adjacentNarratives: string[];
  assets: string[];
  tone: string | null;
  /**
   * Peso de evidência do MapaSeed: Instagram com amostra suficiente carrega mais
   * sinal (2 = "medium") do que a declaração de onboarding ou amostra baixa
   * (1 = "low"). Mantém o card honesto sobre o quanto de dado embasa o mapa.
   */
  evidenceWeight: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function confidenceForEvidence(evidenceCount: number): CreatorStrategicProfileSynthesisConfidence {
  if (evidenceCount >= 4) return "high";
  if (evidenceCount >= 2) return "medium";
  return "low";
}

function normalizeKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toSignal(label: string, evidenceWeight: number): CreatorStrategicProfileSynthesisSignal {
  const clean = label.trim();
  return {
    label: clean,
    summary: clean,
    evidenceCount: evidenceWeight,
    diagnosisIds: [MAPASEED_DIAGNOSIS_ID],
  };
}

/**
 * União dedupada por rótulo normalizado. Em colisão, soma a evidência e agrega os
 * diagnosisIds, mantendo o rótulo/summary já existentes (o do vídeo, mais rico).
 * Adições novas entram no fim (o vídeo, com mais evidência, tende a liderar).
 */
function mergeSignals(
  existing: CreatorStrategicProfileSynthesisSignal[],
  additions: CreatorStrategicProfileSynthesisSignal[],
): CreatorStrategicProfileSynthesisSignal[] {
  const byKey = new Map<string, CreatorStrategicProfileSynthesisSignal>();
  const order: string[] = [];
  for (const sig of existing) {
    const key = normalizeKey(sig.label);
    if (!key) continue;
    byKey.set(key, sig);
    order.push(key);
  }
  for (const add of additions) {
    const key = normalizeKey(add.label);
    if (!key) continue;
    const current = byKey.get(key);
    if (current) {
      byKey.set(key, {
        ...current,
        evidenceCount: current.evidenceCount + add.evidenceCount,
        diagnosisIds: Array.from(new Set([...current.diagnosisIds, ...add.diagnosisIds])),
      });
    } else {
      byKey.set(key, add);
      order.push(key);
    }
  }
  return order.map((k) => byKey.get(k)!).filter(Boolean);
}

// ─── Função principal (pura) ──────────────────────────────────────────────────

export function mergeMapaSeedIntoSynthesis(
  synthesis: CreatorStrategicProfileSynthesis,
  mapa: MapaSeedSynthesisInput | null,
): CreatorStrategicProfileSynthesis {
  if (!mapa) return synthesis;

  const w = mapa.evidenceWeight > 0 ? mapa.evidenceWeight : 1;

  // ── Narrativa central (slot singular, sem prioridade de fonte) ──────────────
  let mainNarrative = synthesis.mainNarrative;
  let testedNarratives = [...synthesis.testedNarratives];
  if (mapa.narrativeLabel) {
    const seedNarrative = toSignal(mapa.narrativeLabel, w);
    if (!mainNarrative) {
      mainNarrative = { ...seedNarrative, confidence: confidenceForEvidence(seedNarrative.evidenceCount) };
    } else if (normalizeKey(mainNarrative.label) === normalizeKey(seedNarrative.label)) {
      // Mesma narrativa nas duas fontes → soma evidência (reforça confiança).
      const ev = mainNarrative.evidenceCount + seedNarrative.evidenceCount;
      mainNarrative = {
        ...mainNarrative,
        evidenceCount: ev,
        confidence: confidenceForEvidence(ev),
        diagnosisIds: Array.from(new Set([...mainNarrative.diagnosisIds, MAPASEED_DIAGNOSIS_ID])),
      };
    } else if (seedNarrative.evidenceCount > mainNarrative.evidenceCount) {
      // MapaSeed tem mais evidência → assume a central; a do vídeo vira adjacente.
      const demoted: CreatorStrategicProfileSynthesisSignal = {
        label: mainNarrative.label,
        summary: mainNarrative.summary,
        evidenceCount: mainNarrative.evidenceCount,
        diagnosisIds: mainNarrative.diagnosisIds,
      };
      testedNarratives = mergeSignals([demoted], testedNarratives);
      mainNarrative = { ...seedNarrative, confidence: confidenceForEvidence(seedNarrative.evidenceCount) };
    } else {
      // Empate ou vídeo mais forte → mantém a do vídeo; a do MapaSeed vira adjacente.
      testedNarratives = mergeSignals(testedNarratives, [seedNarrative]);
    }
  }

  // ── Narrativas adjacentes → hipóteses testadas (união) ──────────────────────
  if (mapa.adjacentNarratives.length > 0) {
    testedNarratives = mergeSignals(
      testedNarratives,
      mapa.adjacentNarratives.map((label) => toSignal(label, w)),
    );
  }

  // ── Territórios, tom, assets → união simétrica ──────────────────────────────
  const narrativeTerritories = mapa.territories.length > 0
    ? mergeSignals(synthesis.narrativeTerritories, mapa.territories.map((t) => toSignal(t, w)))
    : synthesis.narrativeTerritories;

  const toneSignals = mapa.tone
    ? mergeSignals(synthesis.toneSignals, [toSignal(mapa.tone, w)])
    : synthesis.toneSignals;
  const dominantTone = synthesis.dominantTone ?? (mapa.tone ? mapa.tone.trim() : null);

  const confirmedLifeAssets = mapa.assets.length > 0
    ? mergeSignals(synthesis.confirmedLifeAssets, mapa.assets.map((a) => toSignal(a, w)))
    : synthesis.confirmedLifeAssets;

  // ── Status: se a síntese estava vazia mas o MapaSeed trouxe conteúdo, sinaliza
  // que há sinais (evita rotular "mapa vazio" um mapa já alimentado pelo IG). ──
  const addedContent =
    !!mapa.narrativeLabel ||
    mapa.territories.length > 0 ||
    mapa.assets.length > 0 ||
    !!mapa.tone ||
    mapa.adjacentNarratives.length > 0;
  const status =
    synthesis.status === "empty" && addedContent ? "signals_emerging" : synthesis.status;

  return {
    ...synthesis,
    status,
    mainNarrative,
    testedNarratives,
    narrativeTerritories,
    toneSignals,
    dominantTone,
    confirmedLifeAssets,
  };
}

// ─── Loader (best-effort) ─────────────────────────────────────────────────────

function cleanStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanArr(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim())
    : [];
}

/**
 * Lê o MapaSeed do usuário no shape de merge. Retorna null quando não há MapaSeed
 * ou quando ele está totalmente vazio (no-op no merge → síntese intacta).
 */
export async function loadMapaSeedForSynthesisMerge(
  userId: string,
): Promise<MapaSeedSynthesisInput | null> {
  try {
    const doc = await MapaSeedModel.findOne({ userId })
      .select(
        "mapa.narrativa_central mapa.territorios mapa.narrativas_adjacentes mapa.assets mapa.tom mapa.maturidade mapa.amostragem_instagram",
      )
      .lean<{
        mapa?: {
          narrativa_central?: string | null;
          territorios?: string[] | null;
          narrativas_adjacentes?: string[] | null;
          assets?: string[] | null;
          tom?: string | null;
          maturidade?: string | null;
          amostragem_instagram?: string | null;
        } | null;
      } | null>();

    const mapa = doc?.mapa;
    if (!mapa) return null;

    const narrativeLabel = cleanStr(mapa.narrativa_central);
    const territories = cleanArr(mapa.territorios);
    const adjacentNarratives = cleanArr(mapa.narrativas_adjacentes);
    const assets = cleanArr(mapa.assets);
    const tone = cleanStr(mapa.tom);

    if (!narrativeLabel && territories.length === 0 && adjacentNarratives.length === 0 && assets.length === 0 && !tone) {
      return null;
    }

    const evidenceWeight =
      mapa.maturidade === "instagram_enriched" && mapa.amostragem_instagram === "suficiente" ? 2 : 1;

    return { narrativeLabel, territories, adjacentNarratives, assets, tone, evidenceWeight };
  } catch {
    return null;
  }
}
