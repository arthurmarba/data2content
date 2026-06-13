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
  /**
   * Assets de vida confirmados/editados no card "Seu Mapa" (ex.: praia, metrô,
   * consultórios). Camada mais concreta da cadeia — é o que torna a pauta
   * insubstituível. Para o criador de Instagram (sem síntese de vídeo) esta é a
   * ÚNICA fonte de assets que chega ao gerador de pautas.
   */
  assets: string[];
  /**
   * Temas confirmados/editados — a camada-cena (território × narrativa, quase
   * filmável). Alimenta os pontos de partida do roteiro: o gerador usa o tema
   * que o criador já tem em vez de reconstruí-lo do zero.
   */
  temas: string[];
  /**
   * Momento do enriquecimento mais recente do mapa (max de instagramEnrichedAt e
   * videoEnrichedAt). Null quando o mapa ainda não foi enriquecido por nenhuma
   * fonte. Usado para detectar pautas desatualizadas: se o mapa foi enriquecido
   * depois da última pauta, ela reflete um mapa mais antigo.
   */
  lastEnrichedAt: Date | null;
}

const EMPTY: MapaSeedReadinessSource = {
  hasNarrative: false,
  narrativeLabel: null,
  hasTerritories: false,
  territories: [],
  tone: null,
  assets: [],
  temas: [],
  lastEnrichedAt: null,
};

/** Filtra um array de chips do MapaSeed para strings não-vazias. */
function cleanChips(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

export async function getMapaSeedReadinessSource(
  userId: string,
): Promise<MapaSeedReadinessSource> {
  try {
    const doc = await MapaSeedModel.findOne({ userId })
      .select("mapa.narrativa_central mapa.territorios mapa.temas mapa.assets mapa.tom instagramEnrichedAt videoEnrichedAt")
      .lean<{
        mapa?: {
          narrativa_central?: string | null;
          territorios?: string[] | null;
          temas?: string[] | null;
          assets?: string[] | null;
          tom?: string | null;
        } | null;
        instagramEnrichedAt?: Date | null;
        videoEnrichedAt?: Date | null;
      } | null>();

    const mapa = doc?.mapa;
    if (!mapa) return EMPTY;

    const narrativeLabel =
      typeof mapa.narrativa_central === "string" && mapa.narrativa_central.trim()
        ? mapa.narrativa_central.trim()
        : null;
    const territories = cleanChips(mapa.territorios);
    const assets = cleanChips(mapa.assets);
    const temas = cleanChips(mapa.temas);
    const tone =
      typeof mapa.tom === "string" && mapa.tom.trim() ? mapa.tom.trim() : null;

    const instagramEnrichedAt = doc?.instagramEnrichedAt instanceof Date ? doc.instagramEnrichedAt : null;
    const videoEnrichedAt = doc?.videoEnrichedAt instanceof Date ? doc.videoEnrichedAt : null;

    return {
      hasNarrative: !!narrativeLabel,
      narrativeLabel,
      hasTerritories: territories.length > 0,
      territories,
      tone,
      assets,
      temas,
      lastEnrichedAt: maxDate(instagramEnrichedAt, videoEnrichedAt),
    };
  } catch {
    return EMPTY;
  }
}
