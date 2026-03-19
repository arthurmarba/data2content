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
  const fixtureContents = [
    {
      key: "primary",
      instagramMediaId: `e2e-script-${userId}-${now.getTime()}-a`,
      description: `${label} conteudo publicado principal para vinculo.`,
      postDate: now,
      engagement: 7.89,
      totalInteractions: 321,
    },
    {
      key: "alternate",
      instagramMediaId: `e2e-script-${userId}-${now.getTime()}-b`,
      description: `${label} conteudo publicado alternativo para troca de vinculo.`,
      postDate: new Date(now.getTime() - 60 * 60 * 1000),
      engagement: 6.54,
      totalInteractions: 287,
    },
  ] as const;

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

    const metrics = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return Promise.all(
          fixtureContents.map((content) =>
            Metric.findOneAndUpdate(
              {
                user: new Types.ObjectId(userId),
                instagramMediaId: content.instagramMediaId,
              },
              {
                $setOnInsert: {
                  user: new Types.ObjectId(userId),
                  instagramMediaId: content.instagramMediaId,
                  postLink: `https://instagram.com/p/${content.instagramMediaId}`,
                  description: content.description,
                  postDate: content.postDate,
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
                    total_interactions: content.totalInteractions,
                    engagement: content.engagement,
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
              .exec()
          )
        );
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

    const items = metrics.map((metric) => ({
      id: String(metric?._id),
      caption: metric?.description || label,
      postLink: metric?.postLink || null,
      postDate: metric?.postDate ? new Date(metric.postDate).toISOString() : null,
    }));

    return NextResponse.json({
      ok: true,
      content: items[0],
      alternateContent: items[1] ?? null,
      contents: items,
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
        id: fixtureContents[0].instagramMediaId,
        caption: fixtureContents[0].description,
        postLink: `https://instagram.com/p/${fixtureContents[0].instagramMediaId}`,
        postDate: fixtureContents[0].postDate.toISOString(),
      },
      alternateContent: {
        id: fixtureContents[1].instagramMediaId,
        caption: fixtureContents[1].description,
        postLink: `https://instagram.com/p/${fixtureContents[1].instagramMediaId}`,
        postDate: fixtureContents[1].postDate.toISOString(),
      },
      contents: fixtureContents.map((content) => ({
        id: content.instagramMediaId,
        caption: content.description,
        postLink: `https://instagram.com/p/${content.instagramMediaId}`,
        postDate: content.postDate.toISOString(),
      })),
    });
  }
}
