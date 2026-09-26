// Primeiras pautas de quem chega por um plugin.
//
// Arthur decidiu (26/09/2026) que vale gerar pautas de amostra: ver uma pauta
// pronta convence mais do que ler o que o plano faz. Usa a mesma fila e a mesma
// cota mensal do app; a chave fixa impede gerar a amostra duas vezes para a
// mesma conta, venha o pedido do chat ou do site.

import { Types } from "mongoose";
import { logger } from "@/app/lib/logger";

export const FIRST_IDEAS_REQUEST_KEY = "plugin-first-ideas";

export type FirstIdeasState =
  | { state: "queued" }
  | { state: "already_available" }
  | { state: "unavailable"; reason: string };

export async function requestFirstContentIdeas(userId: string): Promise<FirstIdeasState> {
  if (!Types.ObjectId.isValid(userId)) return { state: "unavailable", reason: "invalid_user" };
  try {
    const { default: CreatorContentIdeaModel } = await import("@/app/models/CreatorContentIdea");
    if (await CreatorContentIdeaModel.exists({ userId: new Types.ObjectId(userId) })) {
      return { state: "already_available" };
    }
    const { requestIdeas } = await import("@/app/lib/collabs/apiService");
    const result = await requestIdeas(userId, { count: 3 }, FIRST_IDEAS_REQUEST_KEY);
    if (result.status < 400) return { state: "queued" };
    return { state: "unavailable", reason: String(result.data?.reason ?? "request_failed") };
  } catch (error) {
    logger.warn("[plugin][first_ideas_request_failed]", {
      error: error instanceof Error ? error.name : "unknown_error",
    });
    return { state: "unavailable", reason: "request_failed" };
  }
}
