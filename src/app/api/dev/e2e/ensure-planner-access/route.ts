import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from "@/app/lib/mongoTransient";
import { logger } from "@/app/lib/logger";
import UserModel from "@/app/models/User";

const SERVICE_TAG = "[api/dev/e2e/ensure-planner-access]";
const DEV_E2E_USER_ID = "00000000000000000000e2e1";
const ALLOW_LOCAL_E2E_ROUTES = process.env.ALLOW_LOCAL_E2E_ROUTES === "1";

function buildSessionFallbackUser(session: any, userId: string) {
  return {
    id: String(userId),
    email:
      typeof session?.user?.email === "string" && session.user.email.trim()
        ? session.user.email.trim()
        : `${userId}@data2content.test`,
    role:
      typeof session?.user?.role === "string" && session.user.role.trim()
        ? session.user.role.trim()
        : "user",
    planStatus: "active",
    proTrialStatus: "active",
  };
}

export async function POST() {
  if (process.env.NODE_ENV === "production" && !ALLOW_LOCAL_E2E_ROUTES) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = (await getServerSession(authOptions)) as any;
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const isSyntheticE2EUser =
    String(userId) === DEV_E2E_USER_ID ||
    (typeof session?.user?.email === "string" && session.user.email.endsWith("@data2content.test"));

  if (isSyntheticE2EUser) {
    return NextResponse.json({
      ok: true,
      fallback: true,
      user: buildSessionFallbackUser(session, userId),
    });
  }

  try {
    const updated = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return UserModel.findOneAndUpdate(
          { _id: userId },
          {
            $set: {
              planStatus: "active",
              proTrialStatus: "active",
            },
            $setOnInsert: {
              _id: userId,
              // Dev/E2E user uses a synthetic email to avoid collisions with any real seeded account.
              email: `${userId}@data2content.test`,
              name:
                typeof session?.user?.name === "string" && session.user.name.trim()
                  ? session.user.name.trim()
                  : "E2E Test User",
              role: "user",
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        )
          .select("_id email planStatus proTrialStatus role")
          .lean();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn(`${SERVICE_TAG} Falha transitória ao garantir acesso do planner para ${userId}. Retry #${retryCount}.`, {
            error: getErrorMessage(error),
          });
        },
      }
    );

    if (!updated) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: String(updated._id),
        email: updated.email ?? null,
        role: updated.role ?? null,
        planStatus: updated.planStatus ?? null,
        proTrialStatus: updated.proTrialStatus ?? null,
      },
    });
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      logger.warn(`${SERVICE_TAG} Erro transitório ao garantir acesso do planner para ${userId}. Seguindo com fallback de sessão.`, {
        error: getErrorMessage(error),
      });
      return NextResponse.json({
        ok: true,
        fallback: true,
        user: buildSessionFallbackUser(session, userId),
      });
    }

    logger.error(`${SERVICE_TAG} Erro ao garantir acesso do planner para ${userId}. Usando fallback de sessão.`, error);
    return NextResponse.json({
      ok: true,
      fallback: true,
      user: buildSessionFallbackUser(session, userId),
    });
  }
}
