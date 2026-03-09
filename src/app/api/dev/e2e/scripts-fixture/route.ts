import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from "@/app/lib/mongoTransient";
import { logger } from "@/app/lib/logger";
import Metric from "@/app/models/Metric";
import UserModel from "@/app/models/User";

const SERVICE_TAG = "[api/dev/e2e/scripts-fixture]";
const ALLOW_LOCAL_E2E_ROUTES = process.env.ALLOW_LOCAL_E2E_ROUTES === "1";

export async function POST() {
  if (process.env.NODE_ENV === "production" && !ALLOW_LOCAL_E2E_ROUTES) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = (await getServerSession(authOptions)) as any;
  const userId = session?.user?.id;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const now = new Date();
  const label = `E2E roteiro ${now.toISOString()}`;
  const instagramMediaId = `e2e-script-${userId}-${now.getTime()}`;

  try {
    await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        await UserModel.findOneAndUpdate(
          { _id: userId },
          {
            $set: {
              planStatus: "active",
              proTrialStatus: "active",
            },
            $setOnInsert: {
              _id: userId,
              email: `${userId}@data2content.test`,
              name:
                typeof session?.user?.name === "string" && session.user.name.trim()
                  ? session.user.name.trim()
                  : "E2E Test User",
              role: "user",
            },
          },
          { new: false, upsert: true, setDefaultsOnInsert: true }
        ).exec();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn(`${SERVICE_TAG} Falha transitória ao preparar usuário ${userId}. Retry #${retryCount}.`, {
            error: getErrorMessage(error),
          });
        },
      }
    );

    const metric = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return Metric.findOneAndUpdate(
          {
            user: new Types.ObjectId(userId),
            instagramMediaId,
          },
          {
            $setOnInsert: {
              user: new Types.ObjectId(userId),
              instagramMediaId,
              postLink: `https://instagram.com/p/${instagramMediaId}`,
              description: `${label} conteudo publicado para vinculo.`,
              postDate: now,
              type: "REEL",
              format: ["reel"],
              proposal: [],
              context: [],
              tone: [],
              references: [],
              source: "manual",
              classificationStatus: "completed",
              rawData: [],
              stats: {
                total_interactions: 321,
                engagement: 7.89,
              },
              isPubli: false,
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          }
        )
          .select("_id description postLink postDate stats.total_interactions stats.engagement")
          .lean()
          .exec();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn(`${SERVICE_TAG} Falha transitória ao preparar conteúdo para ${userId}. Retry #${retryCount}.`, {
            error: getErrorMessage(error),
          });
        },
      }
    );

    return NextResponse.json({
      ok: true,
      content: {
        id: String(metric?._id),
        caption: metric?.description || label,
        postLink: metric?.postLink || null,
        postDate: metric?.postDate ? new Date(metric.postDate).toISOString() : null,
      },
    });
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      logger.warn(`${SERVICE_TAG} Erro transitório ao preparar fixture para ${userId}. Usando fixture em memória.`, {
        error: getErrorMessage(error),
      });
    } else {
      logger.error(`${SERVICE_TAG} Erro ao preparar fixture para ${userId}. Usando fixture em memória.`, error);
    }

    return NextResponse.json({
      ok: true,
      fallback: true,
      content: {
        id: instagramMediaId,
        caption: `${label} conteudo publicado para vinculo.`,
        postLink: `https://instagram.com/p/${instagramMediaId}`,
        postDate: now.toISOString(),
      },
    });
  }
}
