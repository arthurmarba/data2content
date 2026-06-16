/**
 * loadStrategicMapSummary.ts
 *
 * "Cozinha" compartilhada do board "Seu Mapa" no desktop. Lê o MapaSeed do
 * criador e devolve um resumo enxuto (narrativa + territórios + assets + tom) —
 * a mesma fonte que a página mobile já lê (MapaSeed.mapa). Fonte única: o board
 * desktop e o mobile se apoiam no mesmo documento, sem lógica duplicada.
 *
 * Read-only e tolerante a falha: qualquer erro devolve um resumo vazio (hasMap
 * false), nunca lança — um board não deve derrubar a central de controle.
 */
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { cleanIdeaText } from "@/app/dashboard/boards/videoUpload/contentIdeasTextHygiene";

export interface StrategicMapSummary {
  /** Há mapa montado o suficiente para exibir (narrativa OU territórios OU assets). */
  hasMap: boolean;
  /** Narrativa central — o "quem você é" do criador. */
  narrative: string | null;
  /** Territórios que o criador ocupa com legitimidade. */
  territories: string[];
  /** Elementos de vida que viram conteúdo. */
  assets: string[];
  /** Como o criador fala (tom). */
  tone: string | null;
}

const EMPTY_SUMMARY: StrategicMapSummary = {
  hasMap: false,
  narrative: null,
  territories: [],
  assets: [],
  tone: null,
};

/**
 * Lê o MapaSeed do usuário e devolve o resumo do mapa. O MapaSeed é gerado por
 * LLM, então os campos passam por `cleanIdeaText` (conserta acentos mutilados e
 * remove aspas irônicas) — mesma higiene aplicada às pautas na leitura.
 */
export async function loadStrategicMapSummary(userId: string): Promise<StrategicMapSummary> {
  if (!userId || !Types.ObjectId.isValid(userId)) return EMPTY_SUMMARY;

  try {
    await connectToDatabase();
    const { default: MapaSeed } = await import("@/app/models/MapaSeed");
    const doc = await MapaSeed.findOne({ userId })
      .select("mapa")
      .lean<{ mapa?: import("@/app/models/MapaSeed").IMapaData } | null>();

    const mapa = doc?.mapa;
    if (!mapa) return EMPTY_SUMMARY;

    const narrative = mapa.narrativa_central?.trim() ? cleanIdeaText(mapa.narrativa_central) : null;
    const territories = (mapa.territorios ?? []).filter(Boolean).map(cleanIdeaText);
    const assets = (mapa.assets ?? []).filter(Boolean).map(cleanIdeaText);
    const tone = mapa.tom?.trim() ? cleanIdeaText(mapa.tom) : null;
    const hasMap = !!narrative || territories.length > 0 || assets.length > 0;

    return { hasMap, narrative, territories, assets, tone };
  } catch (err) {
    console.error("[strategicMap:loadSummary] Erro silencioso:", err);
    return EMPTY_SUMMARY;
  }
}
