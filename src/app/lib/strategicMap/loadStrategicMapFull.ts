/**
 * loadStrategicMapFull.ts
 *
 * "Cozinha completa" do board "Seu Mapa" no desktop — devolve exatamente os dados
 * que o componente MapaCard do mobile consome, reusando o MESMO pipeline da página
 * mobile (síntese de leituras + merge do MapaSeed + confirmações). Fonte única: o
 * board desktop renderiza o card idêntico ao mobile, sem reimplementar nada.
 *
 * Read-only e tolerante a falha: erro → null (o board cai no estado vazio).
 */
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { buildNarrativeMapMobileViewModelFromReadings } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModelServerSelector";
import { loadMapaSeedForSynthesisMerge, mergeMapaSeedIntoSynthesis } from "@/app/dashboard/boards/videoUpload/mapaSeedSynthesisMerge";
import { getMapConfirmationsSnapshot } from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";
import { resolveMapEvolutionStatus } from "@/app/dashboard/boards/videoUpload/mapEvolutionStatusResolver";
import {
  getNarrativeMapAccessLevelForUser,
  hasNarrativeMapInstagramConnection,
} from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import type { IMapaData } from "@/app/models/MapaSeed";

export interface StrategicMapFull {
  synthesis: CreatorStrategicProfileSynthesis;
  mapaSeed: IMapaData | null;
  endorsedHypotheses: string[];
  dismissedHypotheses: string[];
  adjacentNarratives: NonNullable<Awaited<ReturnType<typeof getMapConfirmationsSnapshot>>>["adjacentNarratives"] | [];
  mapEvolutionStatus: string | null;
  hasReadings: boolean;
  hasPurpose: boolean;
  lastReadingAt: string | null;
}

export async function loadStrategicMapFull(userId: string): Promise<StrategicMapFull | null> {
  if (!userId || !Types.ObjectId.isValid(userId)) return null;

  try {
    await connectToDatabase();

    const { default: User } = await import("@/app/models/User");
    const userDoc = (await User.findById(userId)
      .select("name instagramUsername isInstagramConnected instagramAccountId planStatus role onboardingAnswers")
      .lean()) as Record<string, any> | null;

    const accessLevel = getNarrativeMapAccessLevelForUser(userDoc as any);
    const instagramConnected = hasNarrativeMapInstagramConnection(userDoc as any);

    const selectorResult = await buildNarrativeMapMobileViewModelFromReadings({
      userId,
      displayName: userDoc?.name ?? "Creator",
      displayHandle: userDoc?.instagramUsername ? `@${userDoc.instagramUsername}` : null,
      accessLevel,
      instagramConnected,
      mediaKitAvailable: false,
    });

    const mapaSeedForMerge = await loadMapaSeedForSynthesisMerge(userId).catch(() => null);
    const mergedSynthesis = mergeMapaSeedIntoSynthesis(selectorResult.profileSynthesis, mapaSeedForMerge);

    const mapConfirmations = await getMapConfirmationsSnapshot(userId);
    const mapEvolutionStatus = resolveMapEvolutionStatus(mergedSynthesis.status, mapConfirmations);

    const { default: MapaSeed } = await import("@/app/models/MapaSeed");
    const seedDoc = (await MapaSeed.findOne({ userId })
      .select("mapa")
      .lean()) as { mapa?: IMapaData } | null;

    const readings = selectorResult.viewModel.readings.items as Array<{ createdAt?: string | null }>;
    const hasReadings = readings.length > 0;
    const lastReadingAt = readings[0]?.createdAt ?? null;
    const hasPurpose = Boolean(userDoc?.onboardingAnswers?.creatorPurpose);

    return {
      synthesis: mergedSynthesis,
      mapaSeed: seedDoc?.mapa ?? null,
      endorsedHypotheses: mapConfirmations?.endorsedHypotheses ?? [],
      dismissedHypotheses: mapConfirmations?.dismissedHypotheses ?? [],
      adjacentNarratives: mapConfirmations?.adjacentNarratives ?? [],
      mapEvolutionStatus,
      hasReadings,
      hasPurpose,
      lastReadingAt,
    };
  } catch (err) {
    console.error("[strategicMap:loadFull] Erro silencioso:", err);
    return null;
  }
}
