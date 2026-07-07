import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import {
  registerCollabDecision,
  getCollabInterestState,
  markMatchesCelebrated,
} from "@/app/dashboard/boards/videoUpload/collabInterestService";

// Swipe de collab — POST registra "quero fazer"/"não agora" e responde se casou
// (interesse paralelo: match = os dois toparam). GET hidrata decisões + matches
// ao abrir a aba Collabs. Pro-only, mesma guarda do match per-pauta — no free a
// decisão nem chega aqui (o coração abre o paywall no cliente).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireProSession(routePath: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = (await getServerSession(await resolveAuthOptions())) as Session | null;
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
  if (!access.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: access.message, reason: access.reason },
        { status: access.status },
      ),
    };
  }
  const sessionUser = session.user as any;
  const isAdmin = typeof sessionUser?.role === "string" && sessionUser.role.toLowerCase() === "admin";
  if (!isAdmin && !access.normalizedStatus) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Plano ativo necessário.", reason: "inactive" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId: session.user.id };
}

export async function POST(request: Request) {
  const auth = await requireProSession(new URL(request.url).pathname);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const pautaId = typeof body?.pautaId === "string" ? body.pautaId : "";
    const pautaTitle = typeof body?.pautaTitle === "string" ? body.pautaTitle : "";
    const partnerId = typeof body?.partnerId === "string" ? body.partnerId : "";
    const decision = body?.decision === "interested" || body?.decision === "dismissed" ? body.decision : null;

    if (!pautaId || !pautaTitle || !partnerId || !decision) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const collabMode = body?.collabMode === "presencial" || body?.collabMode === "remoto" ? body.collabMode : null;
    const result = await registerCollabDecision({
      userId: auth.userId,
      partnerId,
      pautaId,
      pautaTitle,
      pautaTerritory: typeof body?.territory === "string" ? body.territory : null,
      fitReason: typeof body?.fitReason === "string" ? body.fitReason : null,
      sharedSignal: typeof body?.sharedSignal === "string" ? body.sharedSignal : null,
      recordingIdea: typeof body?.recordingIdea === "string" ? body.recordingIdea : null,
      collabMode,
      decision,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "Failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, matched: result.matched, match: result.match });
  } catch (err) {
    console.error("[mobile-strategic-profile/collabs/interest] POST error:", err);
    return NextResponse.json({ ok: false, error: "Failed to register decision" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await requireProSession(new URL(request.url).pathname);
  if (!auth.ok) return auth.response;

  try {
    const state = await getCollabInterestState(auth.userId);
    if (!state.ok) {
      return NextResponse.json({ ok: false, error: state.error ?? "Failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, decisions: state.decisions, matches: state.matches });
  } catch (err) {
    console.error("[mobile-strategic-profile/collabs/interest] GET error:", err);
    return NextResponse.json({ ok: false, error: "Failed to load state" }, { status: 500 });
  }
}

// PATCH — o shell marca "vi a comemoração" depois de disparar a festa na volta,
// pra ela não tocar de novo na próxima visita.
export async function PATCH(request: Request) {
  const auth = await requireProSession(new URL(request.url).pathname);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const pautaIds = Array.isArray(body?.celebratedPautaIds)
      ? body.celebratedPautaIds.filter((v: unknown): v is string => typeof v === "string")
      : [];
    if (pautaIds.length === 0) {
      return NextResponse.json({ ok: false, error: "No pautaIds" }, { status: 400 });
    }
    const res = await markMatchesCelebrated(auth.userId, pautaIds);
    return NextResponse.json(res);
  } catch (err) {
    console.error("[mobile-strategic-profile/collabs/interest] PATCH error:", err);
    return NextResponse.json({ ok: false, error: "Failed to mark celebrated" }, { status: 500 });
  }
}
