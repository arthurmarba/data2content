import { NextRequest, NextResponse } from "next/server";
import { Client as QStashClient, Receiver } from "@upstash/qstash";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import { logger } from "@/app/lib/logger";
import { SCENE_EVALUATION_VERSION } from "@/app/lib/relatorio/sceneEvaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TAG = "[Cron RecoverContentIntelligence]";
const receiver = process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
  ? new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    })
  : null;
const qstash = process.env.QSTASH_TOKEN
  ? new QStashClient({ token: process.env.QSTASH_TOKEN })
  : null;

const appBaseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const classificationWorkerUrl = process.env.CLASSIFICATION_WORKER_URL
  || `${appBaseUrl}/api/worker/classify-content`;
const sceneWorkerUrl = `${appBaseUrl}/api/worker/classify-published-scene`;
const MAX_CLASSIFICATIONS = Number(process.env.INTELLIGENCE_RECOVERY_CLASSIFICATION_LIMIT || 100);
const MAX_SCENES = Number(process.env.INTELLIGENCE_RECOVERY_SCENE_LIMIT || 40);
const REQUEUE_AFTER_MS = Number(process.env.INTELLIGENCE_RECOVERY_REQUEUE_HOURS || 6) * 60 * 60 * 1000;

async function authorized(request: NextRequest, body: string): Promise<boolean> {
  const bearer = request.headers.get("authorization");
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (!receiver) return false;
  const signature = request.headers.get("upstash-signature") || "";
  return receiver.verify({ signature, body }).catch(() => false);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!(await authorized(request, body))) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }
  if (!qstash || !classificationWorkerUrl.startsWith("http") || !sceneWorkerUrl.startsWith("http")) {
    return NextResponse.json({ message: "QStash ou URLs dos workers não configurados." }, { status: 500 });
  }

  try {
    await connectToDatabase();
    const now = new Date();
    const requeueBefore = new Date(now.getTime() - REQUEUE_AFTER_MS);
    const contentSince = new Date(now.getTime() - 365 * 86_400_000);
    const sceneSince = new Date(now.getTime() - 90 * 86_400_000);

    const subscribers = (await UserModel.find(
      {
        isInstagramConnected: true,
        instagramAccountId: { $nin: [null, ""] },
        instagramAccessToken: { $nin: [null, ""] },
        $or: [
          {
            planStatus: "active",
            $or: [
              { cancelAtPeriodEnd: { $ne: true } },
              { currentPeriodEnd: { $gt: now } },
            ],
          },
          { planStatus: "non_renewing", currentPeriodEnd: { $gt: now } },
        ],
      },
      { _id: 1 },
    ).lean().exec()) as unknown as Array<{ _id: Types.ObjectId }>;
    const subscriberIds = subscribers.map((user) => user._id);

    const { reconcilePendingContentPotentialOutcomes } = await import(
      "@/app/dashboard/boards/videoUpload/contentPotentialHistoryService"
    );
    let outcomesLinked = 0;
    let outcomeUsersFailed = 0;
    for (const subscriberId of subscriberIds.slice(0, 100)) {
      try {
        outcomesLinked += await reconcilePendingContentPotentialOutcomes(String(subscriberId));
      } catch (error) {
        outcomeUsersFailed += 1;
        logger.warn(`${TAG} falha ao reconciliar outcome do usuário ${String(subscriberId)}.`, error);
      }
    }

    const retryableError = /(classifica.{0,8}adiada|rate.?limit|quota|saldo|resource_exhausted|too many requests)/i;
    const pending = (await MetricModel.find(
      {
        user: { $in: subscriberIds },
        postDate: { $gte: contentSince },
        classificationStatus: { $in: ["pending", "failed"] },
        description: { $exists: true, $nin: [null, ""] },
        classificationError: retryableError,
        $or: [
          { classificationLastQueuedAt: null },
          { classificationLastQueuedAt: { $exists: false } },
          { classificationLastQueuedAt: { $lte: requeueBefore } },
        ],
      },
      { _id: 1 },
    ).sort({ postDate: -1 }).limit(MAX_CLASSIFICATIONS).lean().exec()) as unknown as Array<{ _id: Types.ObjectId }>;

    let classificationsQueued = 0;
    let classificationFailures = 0;
    for (const metric of pending) {
      try {
        await qstash.publishJSON({
          url: classificationWorkerUrl,
          body: { metricId: String(metric._id) },
          retries: 3,
          deduplicationId: `classification-recovery-${String(metric._id)}-${now.toISOString().slice(0, 13)}`,
        });
        await MetricModel.updateOne(
          { _id: metric._id },
          { $set: { classificationStatus: "pending", classificationLastQueuedAt: now } },
        );
        classificationsQueued += 1;
      } catch (error) {
        classificationFailures += 1;
        logger.warn(`${TAG} falha ao reenfileirar classificação ${String(metric._id)}.`, error);
      }
    }

    const scenes = (await MetricModel.find(
      {
        user: { $in: subscriberIds },
        postDate: { $gte: sceneSince },
        classificationStatus: "completed",
        instagramMediaId: { $nin: [null, ""] },
        type: { $in: ["REEL", "VIDEO", "IMAGE", "CAROUSEL_ALBUM"] },
        $or: [
          { sceneElements: { $exists: false } },
          { "sceneElements.version": { $ne: SCENE_EVALUATION_VERSION } },
        ],
      },
      { _id: 1 },
    ).sort({ postDate: -1 }).limit(MAX_SCENES).lean().exec()) as unknown as Array<{ _id: Types.ObjectId }>;

    let scenesQueued = 0;
    let sceneFailures = 0;
    for (const metric of scenes) {
      try {
        await qstash.publishJSON({
          url: sceneWorkerUrl,
          body: { metricId: String(metric._id) },
          retries: 2,
          deduplicationId: `scene-recovery-${String(metric._id)}-${now.toISOString().slice(0, 13)}`,
        });
        scenesQueued += 1;
      } catch (error) {
        sceneFailures += 1;
        logger.warn(`${TAG} falha ao reenfileirar cena ${String(metric._id)}.`, error);
      }
    }

    const result = {
      subscribers: subscriberIds.length,
      classifications: { found: pending.length, queued: classificationsQueued, failed: classificationFailures },
      scenes: { found: scenes.length, queued: scenesQueued, failed: sceneFailures },
      outcomes: { linked: outcomesLinked, usersFailed: outcomeUsersFailed },
      providerPreference: process.env.LLM_PROVIDER_CLASSIFICATION || "gemini",
    };
    logger.info(`${TAG} ${JSON.stringify(result)}`);
    return NextResponse.json(result);
  } catch (error) {
    logger.error(`${TAG} falhou.`, error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Recuperação automática da inteligência de conteúdo ativa.",
    providerPreference: process.env.LLM_PROVIDER_CLASSIFICATION || "gemini",
    maxClassifications: MAX_CLASSIFICATIONS,
    maxScenes: MAX_SCENES,
  });
}
