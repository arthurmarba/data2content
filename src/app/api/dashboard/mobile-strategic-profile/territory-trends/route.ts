import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { findGlobalPostsByCriteria } from "@/app/lib/dataService/marketAnalysisService";
import { getCategoryById } from "@/app/lib/classification";
import { logger } from "@/app/lib/logger";
import { resolveCreatorDominantContext } from "@/app/dashboard/boards/videoUpload/creatorDominantContext";
import { resolveTerritoryContextId } from "@/app/dashboard/boards/videoUpload/territoryContext";

export const dynamic = "force-dynamic";

const TAG = "[api/territory-trends]";
const WINDOW_DAYS = 30;
const MAX_ITEMS = 5;

/**
 * GET /api/dashboard/mobile-strategic-profile/territory-trends?territory=A&territory=B
 *
 * O que mais rendeu no assunto do criador, entre os criadores da D2C, nos
 * últimos 30 dias. É a tendência que interessa: não o viral genérico do
 * Instagram, e sim o que funcionou em quem publica sobre a mesma coisa.
 *
 * De onde sai "o assunto dele", nesta ordem:
 *   1. a gaveta em que os POSTS DELE já foram classificados — medida, sem
 *      tradução, e a única que funciona para quem escreve o mapa com as palavras
 *      da própria estratégia ("autonomia criativa" não é uma gaveta);
 *   2. os territórios do mapa, quando algum deles casa com uma gaveta.
 *
 * Sem os dois, devolve lista vazia e a seção não aparece — melhor não ter
 * inspiração do que mandar quem fala de negócio criativo olhar maternidade.
 */
export async function GET(request: Request) {
  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const territories = new URL(request.url).searchParams.getAll("territory").filter(Boolean);

  let contextId = await resolveCreatorDominantContext(userId);
  let source: "posts" | "map" | null = contextId ? "posts" : null;

  if (!contextId) {
    for (const territory of territories) {
      const fromMap = resolveTerritoryContextId(territory);
      if (fromMap) {
        contextId = fromMap;
        source = "map";
        break;
      }
    }
  }

  if (!contextId) {
    return NextResponse.json({ ok: true, contextId: null, label: null, source: null, posts: [] });
  }

  const label = getCategoryById(contextId, "context")?.label ?? null;

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

    return NextResponse.json({ ok: true, contextId, label, source, posts });
  } catch (error) {
    logger.error(`${TAG} Falha ao buscar tendências do assunto:`, error);
    return NextResponse.json({ ok: false, posts: [] }, { status: 502 });
  }
}
