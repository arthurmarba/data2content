// src/app/lib/mapaSeed/seedMapaSeedFromPurpose.ts
//
// Gera a hipótese de narrativa a partir do propósito declarado pelo criador e
// cria o MapaSeed se ainda não existir. É o mesmo seeding que o onboarding vivo
// faz (Fase 2A), extraído para ser reutilizado também quando o criador declara o
// propósito FORA do onboarding — via "Meu Norte" ou pelo propósito inline do card.
//
// Best-effort: nunca lança. Idempotente: não sobrescreve um mapa já existente
// (um mapa enriquecido por Instagram/vídeo é mais rico que a hipótese-semente).

import { logger } from "@/app/lib/logger";
import type { OnboardingSeedSignal } from "./generateOnboardingSeedSignal";

const TAG = "[seedMapaSeedFromPurpose]";

/**
 * @returns o seedSignal gerado (ou null se não houve propósito / IA falhou).
 *          O MapaSeed só é criado quando ainda não existe um para o usuário.
 */
export async function seedMapaSeedFromPurpose(
  userId: string,
  creatorPurpose: string | null | undefined,
): Promise<OnboardingSeedSignal | null> {
  const purpose = creatorPurpose?.trim();
  if (!purpose) return null;

  try {
    const { generateOnboardingSeedSignal } = await import("./generateOnboardingSeedSignal");
    const seedSignal = await generateOnboardingSeedSignal({ creatorPurpose: purpose });
    if (!seedSignal?.label) return seedSignal ?? null;

    const { default: MapaSeedModel } = await import("@/app/models/MapaSeed");
    const exists = await MapaSeedModel.exists({ userId });
    if (!exists) {
      await MapaSeedModel.create({
        userId,
        mapa: {
          narrativa_central: seedSignal.label,
          territorios: seedSignal.territorios ?? [],
          temas: seedSignal.temas ?? [],
          assets: seedSignal.assets ?? [],
          maturidade: "seed",
          fonte: ["onboarding_declarativo"],
        },
      });
      logger.info(`${TAG} MapaSeed semeado a partir do propósito. userId=${userId}`);
    }

    return seedSignal;
  } catch (err) {
    logger.warn(`${TAG} Falha ao semear MapaSeed (não-fatal):`, err);
    return null;
  }
}
