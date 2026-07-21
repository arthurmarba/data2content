import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import { invalidateDashboardHomeSummaryCache } from "@/app/lib/cache/dashboardCache";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";
import { COMMUNITY_INSPIRATION_VERSION } from "@/lib/auth/legalConsent";
import { COMMUNITY_FREE_WHATSAPP_URL } from "@/app/lib/communityLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Destino do visitante depois de registrar o opt-in.
 *
 * `NextResponse.redirect` só aceita URL absoluta, então um valor relativo
 * configurado por engano é resolvido contra a origem da aplicação em vez de
 * derrubar o único caminho gratuito de aviso da reunião.
 */
function resolveFreeCommunityUrl(): string {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    return new URL(COMMUNITY_FREE_WHATSAPP_URL, base).toString();
  } catch {
    return new URL("/reuniao", base).toString();
  }
}

// Mesmo padrão já usado no saque e no resumo de afiliados: carrega as opções de
// auth sob demanda para o teste conseguir exercitar a rota sem inicializar o
// NextAuth inteiro.
async function loadAuthOptions() {
  if (process.env.NODE_ENV === "test") return {} as never;
  const mod = await import("@/app/api/auth/[...nextauth]/route");
  return mod.authOptions;
}

export async function GET() {
  const authOptions = await loadAuthOptions();
  const session = (await getServerSession(authOptions)) as Session | null;
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.redirect(
      new URL(
        `/login?callbackUrl=${encodeURIComponent("/api/dashboard/community/free-join")}`,
        process.env.NEXTAUTH_URL || "http://localhost:3000"
      )
    );
  }

  try {
    await connectToDatabase();
    const joinedAt = new Date();
    const result = await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          communityInspirationOptIn: true,
          communityInspirationOptInDate: joinedAt,
          communityInspirationTermsVersion: COMMUNITY_INSPIRATION_VERSION,
        },
      }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    invalidateDashboardHomeSummaryCache(String(userId));
    return NextResponse.redirect(resolveFreeCommunityUrl());
  } catch (error) {
    logger.error("[dashboard.community.free-join] Failed to confirm free community join", error);
    return NextResponse.json(
      { ok: false, error: "Failed to confirm free community join" },
      { status: 500 }
    );
  }
}
