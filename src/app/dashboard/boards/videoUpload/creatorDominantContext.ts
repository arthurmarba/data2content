// src/app/dashboard/boards/videoUpload/creatorDominantContext.ts
//
// O assunto em que o criador realmente publica, para buscar tendências no
// território dele.
//
// O caminho óbvio — traduzir o território escrito no mapa ("Autonomia criativa")
// para uma gaveta da classificação — falha em quem escreve o mapa com as palavras
// da própria estratégia, que é justamente quem tem mapa bom. Nenhuma das gavetas
// canônicas se chama "autonomia criativa".
//
// O sinal confiável já existe e é do próprio criador: cada post dele foi
// classificado num `context` pela mesma régua usada para todos. A gaveta mais
// frequente entre os posts recentes É o assunto dele, medido, sem tradução.

import { logger } from "@/app/lib/logger";

const TAG = "[creatorDominantContext]";
const WINDOW_DAYS = 90;
const MIN_POSTS = 3;

/**
 * A gaveta mais frequente entre os posts recentes do criador.
 *
 * @returns id do contexto canônico, ou null quando ele ainda não tem posts
 *          classificados o bastante para a resposta significar alguma coisa.
 */
export async function resolveCreatorDominantContext(userId: string): Promise<string | null> {
  try {
    const { connectToDatabase } = await import("@/app/lib/mongoose");
    await connectToDatabase();
    const { default: MetricModel } = await import("@/app/models/Metric");
    const { Types } = await import("mongoose");

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await MetricModel.aggregate([
      { $match: { user: new Types.ObjectId(userId), postDate: { $gte: since }, context: { $exists: true, $ne: [] } } },
      { $unwind: "$context" },
      { $group: { _id: "$context", posts: { $sum: 1 } } },
      { $sort: { posts: -1 } },
      { $limit: 1 },
    ]).exec();

    const top = rows?.[0];
    if (!top?._id || (top.posts ?? 0) < MIN_POSTS) return null;
    return String(top._id);
  } catch (error) {
    logger.warn(`${TAG} Não foi possível medir o contexto dominante:`, error);
    return null;
  }
}
