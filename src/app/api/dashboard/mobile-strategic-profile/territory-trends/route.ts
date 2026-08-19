import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { findGlobalPostsByCriteria } from "@/app/lib/dataService/marketAnalysisService";
import { logger } from "@/app/lib/logger";
import { resolveTerritoryContextId } from "@/app/dashboard/boards/videoUpload/territoryContext";

export const dynamic = "force-dynamic";

const TAG = "[api/territory-trends]";
const WINDOW_DAYS = 30;
const MAX_ITEMS = 5;

/**
 * GET /api/dashboard/mobile-strategic-profile/territory-trends?territory=Maternidade
 *
 * O que mais rendeu no território do criador, entre os criadores da D2C, nos
 * últimos 30 dias. É a tendência que interessa: não o viral genérico do
 * Instagram, e sim o que funcionou em quem fala do mesmo assunto que ele.
 *
 * A janela é de 30 dias — sete dias devolveriam listas vazias em território
 * pequeno, e a leitura aqui é de repertório, não de urgência.
 */
export async function GET(request: Request) {
  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  if (!(session as any)?.user?.id) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const territory = new URL(request.url).searchParams.get("territory")?.trim() ?? "";
  const contextId = resolveTerritoryContextId(territory);

  // Sem contexto correspondente a seção não aparece: melhor não ter inspiração
  // do que oferecer o conteúdo mais visto de um assunto que não é o da pessoa.
  if (!contextId) {
    return NextResponse.json({ ok: true, territory, contextId: null, posts: [] });
  }

  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const result = await findGlobalPostsByCriteria({
      context: contextId,
      dateRange: { startDate: since, endDate: new Date() },
      sortBy: "stats.total_interactions",
      sortOrder: "desc",
      page: 1,
      limit: MAX_ITEMS,
      skipCount: true,
    });

    const posts = (result.posts ?? []).map((post) => ({
      id: String(post._id),
      description: (post.description || post.text_content || "").trim().slice(0, 140) || "Sem legenda",
      creatorName: post.creatorName ?? null,
      coverUrl: post.coverUrl ?? post.thumbnailUrl ?? post.thumbnail_url ?? null,
      postLink: post.postLink ?? null,
      views: post.stats?.views ?? null,
      interactions: post.stats?.total_interactions ?? null,
    }));

    return NextResponse.json({ ok: true, territory, contextId, posts });
  } catch (error) {
    logger.error(`${TAG} Falha ao buscar tendências do território:`, error);
    return NextResponse.json({ ok: false, posts: [] }, { status: 502 });
  }
}
