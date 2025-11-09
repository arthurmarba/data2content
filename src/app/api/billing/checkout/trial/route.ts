// src/app/api/billing/checkout/trial/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import type { ProTrialState } from "@/types/billing";

const TRIAL_DURATION_MS = 48 * 60 * 60 * 1000;

const PRO_TRIAL_STATE_SET: ReadonlySet<ProTrialState> = new Set<ProTrialState>([
  "eligible",
  "active",
  "expired",
  "converted",
  "unavailable",
]);

function ensureProTrialState(value: unknown): ProTrialState {
  if (typeof value !== "string") return "eligible";
  const normalized = value.toLowerCase() as ProTrialState;
  return PRO_TRIAL_STATE_SET.has(normalized) ? normalized : "eligible";
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const asDate = new Date(value as any);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
}

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id ?? null;
    if (!session || !userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(userId)
      .select(
        "proTrialStatus proTrialActivatedAt proTrialExpiresAt proTrialDisabledAt proTrialConvertedAt isInstagramConnected instagramAccountId"
      )
      .lean();

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const instagramConnected = Boolean(user.isInstagramConnected && user.instagramAccountId);
    if (!instagramConnected) {
      return NextResponse.json(
        {
          ok: false,
          code: "INSTAGRAM_REQUIRED",
          message: "Conecte seu Instagram antes de ativar o modo Agência de testes.",
        },
        { status: 409 }
      );
    }

    if (user.proTrialDisabledAt) {
      return NextResponse.json(
        {
          ok: false,
          code: "TRIAL_UNAVAILABLE",
          message: "O período de testes está indisponível para sua conta.",
        },
        { status: 409 }
      );
    }

    const now = new Date();
    const state = ensureProTrialState((user as any).proTrialStatus);
    const currentExpiresAt = toDate((user as any).proTrialExpiresAt);

    if (state === "active" && currentExpiresAt && currentExpiresAt.getTime() > now.getTime()) {
      return NextResponse.json(
        {
          ok: false,
          code: "TRIAL_ALREADY_ACTIVE",
          message: "Você já possui um modo Agência ativo neste momento.",
          trial: {
            state: "active",
            activatedAt: toDate((user as any).proTrialActivatedAt)?.toISOString() ?? null,
            expiresAt: currentExpiresAt.toISOString(),
            remainingMs: Math.max(currentExpiresAt.getTime() - now.getTime(), 0),
          },
        },
        { status: 409 }
      );
    }

    if (state === "active") {
      await User.updateOne(
        { _id: userId },
        { $set: { proTrialStatus: "expired" } }
      );

      return NextResponse.json(
        {
          ok: false,
          code: "TRIAL_NOT_AVAILABLE",
          message: "O período de testes gratuito já foi utilizado nesta conta.",
          trial: {
            state: "expired" as const,
            activatedAt: toDate((user as any).proTrialActivatedAt)?.toISOString() ?? null,
            expiresAt: currentExpiresAt?.toISOString() ?? null,
            remainingMs: 0,
          },
        },
        { status: 409 }
      );
    }

    if (state === "converted" || state === "expired" || state === "unavailable") {
      return NextResponse.json(
        {
          ok: false,
          code: "TRIAL_NOT_AVAILABLE",
          message: "O período de testes gratuito já foi utilizado nesta conta.",
          trial: {
            state,
            activatedAt: toDate((user as any).proTrialActivatedAt)?.toISOString() ?? null,
            expiresAt: currentExpiresAt?.toISOString() ?? null,
            remainingMs: 0,
          },
        },
        { status: 409 }
      );
    }

    const activatedAt = now;
    const expiresAt = new Date(activatedAt.getTime() + TRIAL_DURATION_MS);

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          proTrialStatus: "active",
          proTrialActivatedAt: activatedAt,
          proTrialExpiresAt: expiresAt,
          proTrialDisabledAt: null,
        },
      }
    );

    return NextResponse.json({
      ok: true,
      trial: {
        state: "active" as const,
        activatedAt: activatedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        remainingMs: TRIAL_DURATION_MS,
      },
    });
  } catch (err: any) {
    console.error("[billing/checkout/trial] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Internal error",
      },
      { status: 500 }
    );
  }
}
