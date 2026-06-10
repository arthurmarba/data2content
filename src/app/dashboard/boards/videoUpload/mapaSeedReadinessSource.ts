// mapaSeedReadinessSource.ts
//
// Lê o MapaSeed (semeado no onboarding, enriquecido por Instagram/vídeo) como
// fonte de narrativa/territórios/tom para o gate e a geração de pautas — ao lado
// da síntese de vídeo. É a ponte da Fase 2C: permite destravar pautas a partir do
// mapa que o criador já tem (onboarding + Instagram), sem forçar uma 2ª leitura
// de vídeo.
//
// Best-effort: qualquer erro (ou ausência de MapaSeed) retorna a fonte vazia, e o
// comportamento volta a depender só da síntese de vídeo — sem regressão.

import MapaSeedModel from "@/app/models/MapaSeed";

export interface MapaSeedReadinessSource {
  hasNarrative: boolean;
  narrativeLabel: string | null;
  hasTerritories: boolean;
  territories: string[];
  tone: string | null;
}

const EMPTY: MapaSeedReadinessSource = {
  hasNarrative: false,
  narrativeLabel: null,
  hasTerritories: false,
  territories: [],
  tone: null,
};

export async function getMapaSeedReadinessSource(
  userId: string,
): Promise<MapaSeedReadinessSource> {
  try {
    const doc = await MapaSeedModel.findOne({ userId })
      .select("mapa.narrativa_central mapa.territorios mapa.tom")
      .lean<{
        mapa?: {
          narrativa_central?: string | null;
          territorios?: string[] | null;
          tom?: string | null;
        } | null;
      } | null>();

    const mapa = doc?.mapa;
    if (!mapa) return EMPTY;

    const narrativeLabel =
      typeof mapa.narrativa_central === "string" && mapa.narrativa_central.trim()
        ? mapa.narrativa_central.trim()
        : null;
    const territories = Array.isArray(mapa.territorios)
      ? mapa.territorios.filter(
          (t): t is string => typeof t === "string" && t.trim().length > 0,
        )
      : [];
    const tone =
      typeof mapa.tom === "string" && mapa.tom.trim() ? mapa.tom.trim() : null;

    return {
      hasNarrative: !!narrativeLabel,
      narrativeLabel,
      hasTerritories: territories.length > 0,
      territories,
      tone,
    };
  } catch {
    return EMPTY;
  }
}
