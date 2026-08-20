import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { loadPatternContext } from "@/app/lib/creatorWeeklyReport/patternContextService";
import { EMPTY_PATTERN_CONTEXT } from "@/app/lib/creatorWeeklyReport/patternContextTypes";
import { isCreatorWeeklyProfileExperienceEnabled } from "@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TAG = "[api/pattern-context]";

/**
 * GET /api/dashboard/mobile-strategic-profile/pattern-context
 *
 * O contexto dos padrões do Perfil: a série das últimas semanas de cada resposta
 * promovida, e o mesmo ranking medido no território do criador.
 *
 * Rota separada da do relatório de propósito. O relatório é o que abre a tela e
 * não pode esperar; isto aqui enriquece cards que já estão desenhados — se
 * demorar ou falhar, a tela continua correta, só sem a barrinha e sem a coluna
 * de comparação. Por isso o erro devolve 200 com contexto vazio.
 */
export async function GET() {
  if (!isCreatorWeeklyProfileExperienceEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const session = (await getServerSession(await resolveAuthOptions())) as {
    user?: { id?: string };
  } | null;
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  try {
    const context = await loadPatternContext(userId);
    return NextResponse.json({ ok: true, context });
  } catch (error) {
    logger.warn(`${TAG} contexto indisponível — o Perfil segue sem série e sem território`, error);
    return NextResponse.json({ ok: true, context: EMPTY_PATTERN_CONTEXT });
  }
}
