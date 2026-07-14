import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import {
  matchCollabsForPautas,
  type PautaForMatch,
} from "@/app/dashboard/boards/videoUpload/perPautaCollabMatchingService";
import {
  computePerPautaCacheKey,
  getCachedPerPautaMatches,
  setCachedPerPautaMatches,
} from "@/app/dashboard/boards/videoUpload/perPautaCollabCache";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAUTAS = 30;

function parsePautas(value: unknown): PautaForMatch[] {
  if (!Array.isArray(value)) return [];
  const out: PautaForMatch[] = [];
  for (const raw of value.slice(0, MAX_PAUTAS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    const territory = typeof r.territory === "string" ? r.territory : "";
    if (!id) continue;
    out.push({ id, territory, title: typeof r.title === "string" ? r.title : undefined });
  }
  return out;
}

export async function POST(request: Request) {
  const session = (await getServerSession(await resolveAuthOptions())) as Session | null;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const routePath = new URL(request.url).pathname;
    const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.message, reason: access.reason },
        { status: access.status },
      );
    }

    // Collabs por-pauta são Pro (mesma regra das sugestões de collab).
    const sessionUser = session.user as any;
    const isAdmin = typeof sessionUser?.role === "string" && sessionUser.role.toLowerCase() === "admin";
    if (!isAdmin && !access.normalizedStatus) {
      return NextResponse.json(
        { ok: false, error: "Plano ativo necessário.", reason: "inactive" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const pautas = parsePautas(body?.pautas);
    const narrativeLabel = typeof body?.narrativeLabel === "string" ? body.narrativeLabel : "";

    if (pautas.length === 0 || !narrativeLabel.trim()) {
      return NextResponse.json({ ok: true, matches: {} });
    }

    // Cache por (criador + conjunto de pautas + narrativa): dá estabilidade
    // (mesmo parceiro entre reloads) e corta a chamada Gemini. Nova geração
    // muda o hash → cache novo; TTL cobre o resto.
    const cacheKey = computePerPautaCacheKey(pautas, narrativeLabel);
    const cached = await getCachedPerPautaMatches(session.user.id, cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true, matches: cached, cached: true });
    }

    const matchMap = await matchCollabsForPautas(session.user.id, pautas, narrativeLabel);

    // Serializa Map → Record para o JSON (só pautas com match real).
    const matches: Record<string, NarrativeCollabMatch> = {};
    for (const [pautaId, match] of matchMap.entries()) {
      if (match) matches[pautaId] = match;
    }

    await setCachedPerPautaMatches(session.user.id, cacheKey, matches);

    return NextResponse.json({ ok: true, matches });
  } catch (err) {
    console.error("[mobile-strategic-profile/collabs/per-pauta] Error:", err);
    return NextResponse.json({ ok: false, error: "Failed to match collabs" }, { status: 500 });
  }
}
