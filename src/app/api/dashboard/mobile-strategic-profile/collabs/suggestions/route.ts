import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import {
  buildCollabCreatorSuggestions,
  type CollabCreatorSuggestion,
} from "@/app/lib/planner/collabCreatorSuggestionsService";
import UserModel from "@/app/models/User";
import { getMapConfirmationsSnapshot } from "@/app/dashboard/boards/videoUpload/mapConfirmationsService";
import { findNarrativeCollabMatches } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignalLike = {
  label?: unknown;
  summary?: unknown;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text.length >= 3 ? text : null;
}

function firstSignalText(value: unknown): string | null {
  const direct = cleanText(value);
  if (direct) return direct;
  if (!Array.isArray(value)) return null;

  for (const entry of value) {
    const entryText = cleanText(entry);
    if (entryText) return entryText;
    if (entry && typeof entry === "object") {
      const signal = entry as SignalLike;
      const label = cleanText(signal.label);
      if (label) return label;
      const summary = cleanText(signal.summary);
      if (summary) return summary;
    }
  }

  return null;
}

export function resolveMobileCollabThemeKeyword(body: any): string | null {
  return (
    firstSignalText(body?.narrativeLabel) ||
    firstSignalText(body?.collabTerritories) ||
    firstSignalText(body?.commercialTerritories) ||
    null
  );
}

/**
 * Generates a human-readable explanation of why a creator fits the viewer's confirmed map.
 * References confirmed narrative/territory labels when available so the creator
 * understands the connection to their own declared map — not generic match scores.
 */
function buildNarrativeFitReason(
  creator: CollabCreatorSuggestion,
  opts: {
    narrativeConfirmed: boolean;
    territoriesConfirmed: boolean;
    narrativeLabel: string | null;
    primaryTerritoryLabel: string | null;
  },
): string {
  const { narrativeConfirmed, territoriesConfirmed, narrativeLabel, primaryTerritoryLabel } = opts;
  // Sem aspas de delimitação — num card calmo elas leem como aspas irônicas.
  const shortNarrative = narrativeLabel ? narrativeLabel : null;
  const shortTerritory = primaryTerritoryLabel ? primaryTerritoryLabel : null;

  if (creator.matchedTheme) {
    if (territoriesConfirmed && shortTerritory) {
      return `Cria em ${shortTerritory} — território confirmado no seu mapa.`;
    }
    if (shortTerritory) {
      return `Tema próximo ao território ${shortTerritory} identificado nas suas leituras.`;
    }
    return "Tema parecido com o território narrativo das suas leituras.";
  }

  // Fallback (path Instagram) — NUNCA expor vocabulário de performance/alcance/audiência
  // ao criador. Mesmo quando o match veio de sinais de Instagram, a razão exibida é
  // sempre narrativa (decisão consolidada: fit narrativo, não performance).
  switch (creator.matchType) {
    case "HIGH_REACH":
    case "AUDIENCE_SCALE":
      return shortNarrative && narrativeConfirmed
        ? `Narrativa que conversa com ${shortNarrative}.`
        : "Narrativa próxima da sua — espaço para uma collab que soma.";
    case "CONSISTENT":
      return shortTerritory && territoriesConfirmed
        ? `Cria de forma constante em temas próximos ao território ${shortTerritory}.`
        : "Cria de forma constante em temas próximos aos seus.";
    case "HIGH_ENGAGEMENT":
      return territoriesConfirmed
        ? `O jeito de comunicar conversa com o tom do seu mapa.`
        : "O jeito de comunicar tem afinidade com o seu.";
    default:
      return shortNarrative && narrativeConfirmed
        ? `Alinhado com a narrativa confirmada: ${shortNarrative}.`
        : "Sinal de afinidade com a sua narrativa atual.";
  }
}

function isLikelyObjectId(value: unknown) {
  return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
}

async function resolveInstagramConnected(session: Session) {
  const sessionUser = session.user as any;
  const sessionConnected = Boolean(sessionUser?.instagramConnected || sessionUser?.isInstagramConnected);
  const userId = sessionUser?.id;

  if (!isLikelyObjectId(userId)) return sessionConnected;

  try {
    await connectToDatabase();
    const user = await UserModel.findById(userId)
      .select("isInstagramConnected instagramConnected")
      .lean();
    if (!user) return sessionConnected;
    return Boolean((user as any).isInstagramConnected || (user as any).instagramConnected);
  } catch (error) {
    console.error("[mobile-strategic-profile/collabs/suggestions] Instagram status lookup failed:", error);
    return sessionConnected;
  }
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

    const sessionUser = session.user as any;
    const isAdmin = typeof sessionUser?.role === "string" && sessionUser.role.toLowerCase() === "admin";
    if (!isAdmin && !access.normalizedStatus) {
      return NextResponse.json(
        { ok: false, error: "Plano ativo necessário.", reason: "inactive" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(3, Number(body?.limit) || 3));

    // Load confirmed map to decide which path to use
    const mapConfirmations = await getMapConfirmationsSnapshot(session.user.id).catch(() => null);
    const narrativeConfirmed = mapConfirmations?.narrative === "confirmed";
    const territoriesConfirmed = mapConfirmations?.territories === "confirmed";
    const narrativeLabel = cleanText(body?.narrativeLabel);

    // Territórios confirmados do viewer — usados no ranking, na razão de fit e no
    // "ponto de encontro" (terreno comum). Parseados uma vez para os dois paths.
    const viewerTerritoryLabels: string[] = Array.isArray(body?.collabTerritories)
      ? (body.collabTerritories as unknown[])
          .map((t) => (typeof t === "string" ? t : (t as { label?: unknown } | null)?.label))
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];

    // ── Fase C: Narrative-map path (preferred, no Instagram required) ──────────
    //
    // When both narrative + territories are confirmed, try matching other creators
    // by their narrative maps. Returns `narrativeExample` + `narrativeFitReason`
    // generated from both maps. No audience metrics surfaced.
    if (narrativeConfirmed && territoriesConfirmed && narrativeLabel) {
      const narrativeResult = await findNarrativeCollabMatches(
        session.user.id,
        narrativeLabel,
        limit,
        viewerTerritoryLabels,
      );

      if (narrativeResult.ok && narrativeResult.matches.length > 0) {
        return NextResponse.json({
          ok: true,
          items: narrativeResult.matches,
          contextLabel: "Match narrativo",
          themeKeyword: narrativeLabel,
          source: "narrative_map",
        });
      }
      // Fall through to Instagram path if no narrative matches found
    }

    // ── Existing Instagram path (fallback) ────────────────────────────────────
    const instagramConnected = await resolveInstagramConnected(session);
    if (!instagramConnected) {
      return NextResponse.json(
        {
          ok: false,
          error: "Conecte o Instagram para liberar collabs personalizadas.",
          reason: "instagram_required",
        },
        { status: 403 },
      );
    }

    const periodDays = Math.max(30, Math.min(365, Number(body?.periodDays) || 180));
    const themeKeyword = resolveMobileCollabThemeKeyword(body);

    const result = await buildCollabCreatorSuggestions({
      viewerId: session.user.id,
      themeKeyword,
      periodDays,
      limit,
    });

    // Enrich each suggestion with a narrative fit reason derived from the confirmed map
    const primaryTerritoryLabel =
      firstSignalText(body?.collabTerritories) ?? firstSignalText(body?.commercialTerritories);

    const enrichedItems = result.items.map((creator) => ({
      ...creator,
      narrativeFitReason: buildNarrativeFitReason(creator, {
        narrativeConfirmed,
        territoriesConfirmed,
        narrativeLabel,
        primaryTerritoryLabel,
      }),
      // Ponto de encontro (path Instagram): quando o criador casou pelo TEMA do
      // viewer (matchedTheme), o terreno comum é o próprio território primário dele.
      sharedSignal: creator.matchedTheme && primaryTerritoryLabel ? primaryTerritoryLabel : null,
    }));

    return NextResponse.json({
      ok: true,
      items: enrichedItems,
      contextLabel: result.contextLabel,
      themeKeyword,
      source: "instagram",
    });
  } catch (err) {
    console.error("[mobile-strategic-profile/collabs/suggestions] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load collab suggestions" },
      { status: 500 },
    );
  }
}
