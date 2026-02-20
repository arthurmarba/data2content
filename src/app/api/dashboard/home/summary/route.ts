import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import { Types } from "mongoose";
import PlannerPlanModel from "@/app/models/PlannerPlan";
import MetricModel from "@/app/models/Metric";
import UserModel, { type IUser } from "@/app/models/User";
import AudienceDemographicSnapshotModel from "@/app/models/demographics/AudienceDemographicSnapshot";
import BrandProposalModel, { type BrandProposalStatus } from "@/app/models/BrandProposal";
import MediaKitAccessLogModel from "@/app/models/MediaKitAccessLog";
import type {
  DashboardFlowChecklist,
  DashboardProposalsSummary,
  DashboardChecklistStep,
  HomeJourneyProgress,
  JourneyStepId,
  JourneyStepState,
} from "@/app/dashboard/home/types";
import { recommendWeeklySlots } from "@/app/lib/planner/recommender";
import { PLANNER_TIMEZONE } from "@/app/lib/planner/constants";
import getBlockSampleCaptions from "@/utils/getBlockSampleCaptions";
import { getCategoryById } from "@/app/lib/classification";
import { formatCompactNumber } from "@/app/landing/utils/format";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getUpcomingMentorshipEvent } from "@/app/lib/community/events";
import { getPlanAccessMeta, isPlanActiveLike } from "@/utils/planStatus";
import { isWhatsappTrialEnabled } from "@/app/lib/whatsappTrial";
import {
  buildDashboardHomeSummaryCacheKey,
  dashboardCache,
  SHORT_DASHBOARD_TTL_MS,
} from "@/app/lib/cache/dashboardCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PeriodKey = "7d" | "30d" | "90d";
const PERIOD_TO_DAYS: Record<PeriodKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};
const COMMUNITY_CACHE_TTL_MS = Math.max(
  30_000,
  Number(process.env.DASHBOARD_HOME_COMMUNITY_TTL_MS ?? 120_000)
);
const communityTotalsCache = new Map<
  PeriodKey,
  { expires: number; data: { current: any; previous: any } }
>();

const PENDING_PROPOSAL_STATUSES: BrandProposalStatus[] = ["novo", "visto"];
const RESPONDED_PROPOSAL_STATUSES: BrandProposalStatus[] = ["respondido", "aceito"];

type DashboardProposalsComputation = DashboardProposalsSummary & {
  proposalsViaMediaKit: number;
};

interface BuildFlowChecklistParams {
  instagramConnected: boolean;
  hasMediaKit: boolean;
  proposals: DashboardProposalsComputation | null;
  hasProAccess: boolean;
  surveyCompleted: boolean;
}

function buildFlowChecklist({
  instagramConnected,
  hasMediaKit,
  proposals,
  hasProAccess,
  surveyCompleted,
}: BuildFlowChecklistParams): DashboardFlowChecklist {
  const totalProposals = proposals?.totalCount ?? 0;
  const newProposals = proposals?.newCount ?? 0;
  const pendingProposals = proposals?.pendingCount ?? 0;
  const respondedProposals = proposals?.respondedCount ?? 0;

  const steps: DashboardChecklistStep[] = [];

  const connectStatus = instagramConnected ? "done" : "todo";
  steps.push({
    id: "connect_ig",
    title: "Conectar Instagram",
    status: connectStatus,
    actionLabel: "Conectar Instagram",
    actionHref: "/dashboard/instagram/connect",
    completedLabel: instagramConnected ? "Ver automações" : undefined,
    completedHref: instagramConnected ? "/dashboard/chat" : undefined,
    helper: instagramConnected
      ? null
      : "Conecte o Instagram para atualizar métricas e liberar automações.",
    trackEvent: "connect_ig",
  });

  const mediaKitStatus = hasMediaKit ? "done" : connectStatus === "done" ? "in_progress" : "todo";
  steps.push({
    id: "create_media_kit",
    title: "Criar Mídia Kit",
    status: mediaKitStatus,
    actionLabel: "Criar Mídia Kit",
    actionHref: "/dashboard/media-kit",
    completedLabel: hasMediaKit ? "Ver Mídia Kit" : undefined,
    completedHref: hasMediaKit ? "/dashboard/media-kit" : undefined,
    helper: hasMediaKit
      ? null
      : "Crie o seu kit para marcas conhecerem seu trabalho em 2 minutos.",
    trackEvent: "create_media_kit",
  });

  const receiveStatus =
    totalProposals === 0 ? "todo" : newProposals > 0 ? "in_progress" : "done";
  steps.push({
    id: "receive_proposals",
    title: "Receber Propostas",
    status: receiveStatus,
    actionLabel: "Abrir Propostas",
    actionHref: "/dashboard/proposals",
    completedLabel: totalProposals > 0 ? "Ir para Campanhas" : undefined,
    completedHref: totalProposals > 0 ? "/dashboard/proposals" : undefined,
    helper:
      totalProposals > 0
        ? null
        : "Coloque o link do Mídia Kit na bio para começar a receber propostas.",
    badgeCount: newProposals > 0 ? newProposals : null,
    trackEvent: "open_proposals",
  });

  const surveyStatus = surveyCompleted ? "done" : "todo";
  steps.push({
    id: "personalize_support",
    title: "Personalizar IA e suporte",
    status: surveyStatus,
    actionLabel: surveyCompleted ? "Revisar respostas" : "Responder pesquisa",
    actionHref: "/#etapa-5-pesquisa",
    completedLabel: surveyCompleted ? "Atualizar preferências" : undefined,
    completedHref: "/#etapa-5-pesquisa",
    helper: surveyCompleted
      ? "Preferências salvas. Atualize quando algo mudar."
      : "Pesquisa de 2 minutos para ajustar IA, UX e notificações ao seu momento.",
    trackEvent: "open_creator_survey",
  });

  const respondStatus =
    pendingProposals > 0
      ? "in_progress"
      : respondedProposals > 0
      ? "done"
      : totalProposals > 0
      ? "todo"
      : "todo";

  const respondActionLabel = hasProAccess ? "Analisar com IA" : "Responder agora";

  steps.push({
    id: "respond_with_ai",
    title: "Responder com IA",
    status: respondStatus,
    actionLabel: respondActionLabel,
    actionHref: "/dashboard/proposals?status=novo",
    completedLabel:
      respondedProposals > 0 && pendingProposals === 0 ? "Ir para Campanhas" : undefined,
    completedHref:
      respondedProposals > 0 && pendingProposals === 0 ? "/dashboard/proposals" : undefined,
    helper:
      pendingProposals > 0
        ? "Você tem respostas pendentes. Resolva em minutos com a IA."
        : respondedProposals > 0
        ? "Todas as propostas foram respondidas. Continue revisando sua caixa de entrada."
        : totalProposals === 0
        ? "Assim que chegar uma proposta, responda com IA para ganhar tempo."
        : "Dispare respostas inteligentes e negocie sem sair da plataforma.",
    badgeCount: pendingProposals > 0 ? pendingProposals : null,
    trackEvent: "analyze_with_ai",
  });

  const firstPendingStep = steps.find((step) => step.status !== "done")?.id ?? null;

  return {
    steps,
    firstPendingStepId: firstPendingStep,
    summary: {
      instagramConnected,
      hasMediaKit,
      totalProposals,
      newProposals,
      pendingProposals,
      respondedProposals,
      hasProPlan: hasProAccess,
    },
  };
}

const JOURNEY_STEPS_ORDER: JourneyStepId[] = [
  "connect_instagram",
  "create_media_kit",
  "publish_media_kit_link",
  "personalize_support",
  "activate_pro",
];

const JOURNEY_STEP_COPY: Record<JourneyStepId, { title: string; description: string; helper?: string }> = {
  connect_instagram: {
    title: "Conecte IG",
    description: "Libere diagnósticos automáticos.",
  },
  create_media_kit: {
    title: "Gere o kit",
    description: "Transforme seu perfil na vitrine oficial.",
  },
  publish_media_kit_link: {
    title: "Publique o link",
    description: "Coloque o kit na bio para receber propostas.",
    helper: "Contamos acessos reais ao kit para marcar como concluído.",
  },
  personalize_support: {
    title: "Personalize IA e suporte",
    description: "Responda a pesquisa de 2 minutos para ajustar IA, UX e alertas.",
    helper: "Grátis. Salva suas preferências para IA e equipe humana.",
  },
  activate_pro: {
    title: "Ative o Plano Pro",
    description: "Posicione seus conteúdos para atrair marcas: IA 24/7 e mentorias semanais para fechar campanhas sem exclusividade.",
  },
};

interface BuildJourneyProgressParams {
  instagramConnected: boolean;
  hasMediaKit: boolean;
  mediaKitSignals?: {
    viewsLast7Days?: number;
    proposalsViaMediaKit?: number;
  } | null;
  hasProAccess: boolean;
  surveyCompleted: boolean;
}

function buildJourneyProgress({
  instagramConnected,
  hasMediaKit,
  mediaKitSignals,
  hasProAccess,
  surveyCompleted,
}: BuildJourneyProgressParams): HomeJourneyProgress {
  const linkSignal = hasMediaKit && Boolean((mediaKitSignals?.viewsLast7Days ?? 0) > 0 || (mediaKitSignals?.proposalsViaMediaKit ?? 0) > 0);

  const completionMap: Record<JourneyStepId, boolean> = {
    connect_instagram: instagramConnected,
    create_media_kit: hasMediaKit,
    publish_media_kit_link: linkSignal,
    personalize_support: surveyCompleted,
    activate_pro: hasProAccess,
  };

  let pendingAssigned = false;
  const steps: JourneyStepState[] = JOURNEY_STEPS_ORDER.map((id) => {
    const base = JOURNEY_STEP_COPY[id];
    const completed = completionMap[id];
    let status: JourneyStepState["status"];
    if (completed) {
      status = "done";
    } else if (!pendingAssigned) {
      status = "in_progress";
      pendingAssigned = true;
    } else {
      status = "todo";
    }
    return {
      id,
      title: base.title,
      description: base.description,
      helper: base.helper,
      status,
    };
  });

  const completedCount = steps.filter((step) => step.status === "done").length;
  const totalSteps = steps.length;
  const firstPendingIndex = steps.findIndex((step) => step.status !== "done");
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const currentStepIndex = firstPendingIndex === -1 ? totalSteps : Math.max(1, firstPendingIndex + 1);
  const progressLabel = `${completedCount}/${totalSteps} etapas concluídas`;
  const nextStepId = firstPendingIndex === -1 ? null : steps[firstPendingIndex]?.id ?? null;

  let highlightMessage: string | null;
  const pendingSteps = totalSteps - completedCount;
  if (pendingSteps === 0) {
    highlightMessage = "✨ Plano Pro ativo — negocie campanhas com IA";
  } else if (pendingSteps === 1) {
    highlightMessage = "🚀 Falta 1 passo para liberar propostas com IA";
  } else {
    highlightMessage = "Você está a poucos passos de liberar propostas";
  }

  const subcopy = pendingSteps === 0 ? "Tudo pronto. Mantenha o kit atualizado e responda rápido." : "Complete os passos abaixo para liberar todo o potencial da IA.";

  const headline = pendingSteps === 0 ? "Jornada concluída" : "Sua jornada na D2C";

  return {
    headline,
    subcopy,
    progressLabel,
    progressPercent,
    completedCount,
    totalSteps,
    highlightMessage,
    steps,
    nextStepId,
  };
}
async function computeDashboardProposalsSummary(
  userId: string,
  mediaKitSlug: string | null
): Promise<DashboardProposalsComputation> {
  const userObjectId = new Types.ObjectId(userId);

  const statusBreakdownPromise = BrandProposalModel.aggregate<{
    _id: BrandProposalStatus;
    count: number;
  }>([
    { $match: { userId: userObjectId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]).exec();

  const acceptedByCurrencyPromise = BrandProposalModel.aggregate<{
    _id: string | null;
    totalBudget: number;
    latestUpdatedAt: Date | null;
  }>([
    {
      $match: {
        userId: userObjectId,
        status: "aceito" as BrandProposalStatus,
        budget: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: "$currency",
        totalBudget: { $sum: "$budget" },
        latestUpdatedAt: { $max: "$updatedAt" },
      },
    },
    { $sort: { totalBudget: -1 } },
  ]).exec();

  const latestPendingPromise = BrandProposalModel.findOne({
    userId: userObjectId,
    status: { $in: PENDING_PROPOSAL_STATUSES },
  })
    .sort({ createdAt: -1 })
    .select({ _id: 1, status: 1 })
    .lean()
    .exec();

  const proposalsViaMediaKitPromise = mediaKitSlug
    ? BrandProposalModel.countDocuments({
        userId: userObjectId,
        mediaKitSlug,
      }).exec()
    : Promise.resolve(0);

  const [statusBreakdown, acceptedByCurrency, latestPending, proposalsViaMediaKit] = await Promise.all([
    statusBreakdownPromise,
    acceptedByCurrencyPromise,
    latestPendingPromise,
    proposalsViaMediaKitPromise,
  ]);

  const counts: Partial<Record<BrandProposalStatus, number>> = {};
  for (const entry of statusBreakdown) {
    counts[entry._id] = entry.count ?? 0;
  }

  const totalCount = statusBreakdown.reduce((acc, entry) => acc + (entry.count ?? 0), 0);
  const newCount = counts.novo ?? 0;
  const pendingCount = PENDING_PROPOSAL_STATUSES.reduce(
    (acc, status) => acc + (counts[status] ?? 0),
    0
  );
  const respondedCount = RESPONDED_PROPOSAL_STATUSES.reduce(
    (acc, status) => acc + (counts[status] ?? 0),
    0
  );
  const acceptedCount = counts.aceito ?? 0;

  const topAccepted = acceptedByCurrency?.[0];
  const acceptedEstimate = topAccepted
    ? {
        currency: topAccepted._id ?? null,
        totalBudget: topAccepted.totalBudget ?? 0,
        lastClosedAt: topAccepted.latestUpdatedAt
          ? topAccepted.latestUpdatedAt.toISOString()
          : null,
      }
    : null;

  return {
    totalCount,
    newCount,
    pendingCount,
    respondedCount,
    acceptedCount,
    acceptedEstimate,
    latestPendingProposalId: latestPending?._id ? latestPending._id.toString() : null,
    latestPendingStatus: (latestPending?.status as BrandProposalStatus | null) ?? null,
    proposalsViaMediaKit,
  };
}

const FREE_COMMUNITY_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_FREE_URL || "/planning/discover";
const VIP_COMMUNITY_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL || "/planning/whatsapp";
const WHATSAPP_TRIAL_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_TRIAL_URL || "/planning/whatsapp";
const WHATSAPP_TRIAL_ENABLED = isWhatsappTrialEnabled();
const PAID_PRO_STATUSES = new Set(["active", "non_renewing"] as const);

type UserSnapshot = Pick<
  IUser,
  | "communityInspirationOptIn"
  | "communityInspirationOptInDate"
  | "whatsappVerified"
  | "whatsappPhone"
  | "whatsappLinkedAt"
  | "whatsappTrialEligible"
  | "whatsappTrialActive"
  | "whatsappTrialStartedAt"
  | "whatsappTrialExpiresAt"
  | "whatsappTrialLastReminderAt"
  | "whatsappTrialLastNotificationAt"
  | "instagramAccountId"
  | "mediaKitSlug"
  | "mediaKitToken"
  | "planStatus"
  | "planExpiresAt"
  | "planInterval"
  | "cancelAtPeriodEnd"
  | "stripePriceId"
  | "role"
  | "creatorProfileExtended"
>;

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_NAMES_FULL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const WEEKDAY_SENTENCE_LABELS = [
  "aos Domingos",
  "às Segundas",
  "às Terças",
  "às Quartas",
  "às Quintas",
  "às Sextas",
  "aos Sábados",
];

function respondError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function buildPlanAndCommunityState(userSnapshot: UserSnapshot | null) {
  const planStatus = userSnapshot?.planStatus ?? null;
  const cancelAtPeriodEnd = Boolean(userSnapshot?.cancelAtPeriodEnd);
  const accessMeta = getPlanAccessMeta(planStatus, cancelAtPeriodEnd);
  const normalizedStatus = accessMeta.normalizedStatus;
  const planIntervalRaw = userSnapshot?.planInterval ?? null;
  const planInterval =
    planIntervalRaw === "month" || planIntervalRaw === "year" ? planIntervalRaw : null;
  const planExpiresAtRaw = userSnapshot?.planExpiresAt ?? null;
  const planExpiresAt =
    planExpiresAtRaw instanceof Date
      ? planExpiresAtRaw
      : planExpiresAtRaw
      ? new Date(planExpiresAtRaw)
      : null;
  const validPlanExpiresAt =
    planExpiresAt && !Number.isNaN(planExpiresAt.getTime()) ? planExpiresAt : null;
  const nowMs = Date.now();
  const trialExpiresFromRecordRaw = userSnapshot?.whatsappTrialExpiresAt ?? null;
  const trialExpiresFromRecord =
    trialExpiresFromRecordRaw instanceof Date
      ? trialExpiresFromRecordRaw
      : trialExpiresFromRecordRaw
      ? new Date(trialExpiresFromRecordRaw)
      : null;
  const validTrialExpires =
    trialExpiresFromRecord && !Number.isNaN(trialExpiresFromRecord.getTime())
      ? trialExpiresFromRecord
      : null;

  const trialActiveFromPlan = normalizedStatus === "trial" || normalizedStatus === "trialing";
  const trialActiveFromWhatsapp =
    WHATSAPP_TRIAL_ENABLED &&
    Boolean(userSnapshot?.whatsappTrialActive) &&
    (!validTrialExpires || validTrialExpires.getTime() > nowMs);
  const trialActive = trialActiveFromPlan || trialActiveFromWhatsapp;

  const hasPaidProPlan = PAID_PRO_STATUSES.has(normalizedStatus as "active" | "non_renewing");
  const hasPremiumAccess = hasPaidProPlan || trialActive;

  const trialEligibleRecord = userSnapshot?.whatsappTrialEligible;
  const trialStartedRecord = Boolean(userSnapshot?.whatsappTrialStartedAt);
  const hasEverHadPlan = Boolean(validPlanExpiresAt) || trialStartedRecord;

  let trialEligible =
    WHATSAPP_TRIAL_ENABLED &&
    (typeof trialEligibleRecord === "boolean"
      ? trialEligibleRecord
      : !trialActive && !hasPaidProPlan && !hasEverHadPlan);

  if (trialActiveFromWhatsapp || trialStartedRecord) {
    trialEligible = false;
  }

  trialEligible = Boolean(trialEligible);

  const trialStarted = trialStartedRecord || trialActive;
  const trialExpiresIso = trialActiveFromWhatsapp
    ? validTrialExpires
      ? validTrialExpires.toISOString()
      : null
    : trialActiveFromPlan && validPlanExpiresAt
    ? validPlanExpiresAt.toISOString()
    : null;

  const whatsappLinked = Boolean(userSnapshot?.whatsappVerified || userSnapshot?.whatsappPhone);
  const vipHasAccess = hasPaidProPlan;
  const vipMember = vipHasAccess && whatsappLinked;

  return {
    hasPaidProPlan,
    whatsappLinked,
    plan: {
      status: planStatus ?? null,
      normalizedStatus,
      interval: planInterval,
      cancelAtPeriodEnd,
      expiresAt: validPlanExpiresAt ? validPlanExpiresAt.toISOString() : null,
      priceId: userSnapshot?.stripePriceId ?? null,
      hasPremiumAccess,
      isPro: hasPaidProPlan,
      trial: {
        active: trialActive,
        eligible: trialEligible,
        started: trialStarted,
        expiresAt: trialExpiresIso,
      },
    },
    whatsapp: {
      linked: whatsappLinked,
      phone: userSnapshot?.whatsappPhone ?? null,
      trial: {
        active: trialActive,
        eligible: trialEligible,
        started: trialStarted,
        expiresAt: trialExpiresIso,
      },
      startUrl: WHATSAPP_TRIAL_URL,
    },
    community: {
      free: {
        isMember: Boolean(userSnapshot?.communityInspirationOptIn),
        inviteUrl: FREE_COMMUNITY_URL,
      },
      vip: {
        hasAccess: vipHasAccess,
        isMember: vipMember,
        inviteUrl: vipHasAccess ? VIP_COMMUNITY_URL : null,
      },
    },
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour || "0"),
    Number(map.minute || "0"),
    Number(map.second || "0")
  );
  return asUTC - date.getTime();
}

function normalizeToMondayInTZ(d: Date, timeZone: string): Date {
  const zoned = new Date(d.getTime() + getTimeZoneOffsetMs(d, timeZone));
  const dow = zoned.getUTCDay(); // 0..6
  const shift = dow === 0 ? -6 : 1 - dow;
  const mondayLocal = new Date(
    Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate() + shift, 0, 0, 0, 0)
  );
  return new Date(mondayLocal.getTime() - getTimeZoneOffsetMs(mondayLocal, timeZone));
}

function formatSlotLabel(dateUtc: Date) {
  const weekday = WEEKDAY_LABELS[dateUtc.getDay()];
  const options: Intl.DateTimeFormatOptions = {
    timeZone: PLANNER_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const formatted = new Intl.DateTimeFormat("pt-BR", options).format(dateUtc).replace(":00", "h");
  return `${weekday} • ${formatted} (BRT)`;
}

function toPercentDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(delta)) return null;
  return Math.round(delta);
}

function firstSentence(text: string | undefined | null, maxLength = 140): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const sentence = trimmed.split(/[\r\n]+/)[0]?.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
  if (sentence.length > maxLength) {
    return `${sentence.slice(0, maxLength - 1).trim()}…`;
  }
  return sentence;
}

async function computeNextPostCard(userId: string, periodDays = 90) {
  const uid = new Types.ObjectId(userId);
  const now = new Date();
  const currentWeekStart = normalizeToMondayInTZ(now, PLANNER_TIMEZONE);
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);

  const plans = await PlannerPlanModel.find({
    userId: uid,
    weekStart: { $in: [currentWeekStart, nextWeekStart] },
  })
    .lean()
    .exec();

  const enrichedSlots = plans.flatMap((plan) =>
    (plan.slots || []).map((slot) => {
      const date = new Date(plan.weekStart);
      date.setUTCDate(date.getUTCDate() + (slot.dayOfWeek - 1));
      date.setUTCHours(slot.blockStartHour, 0, 0, 0);
      return { slot, slotDate: date };
    })
  );

  const futureSlots = enrichedSlots
    .filter((item) => item.slotDate.getTime() >= now.getTime())
    .sort((a, b) => a.slotDate.getTime() - b.slotDate.getTime());

  const selected = futureSlots[0] ?? null;

  const recommendations = await recommendWeeklySlots({
    userId,
    periodDays,
  }).catch(() => []);

  const matchedRecommendation = selected
    ? recommendations.find(
        (rec) =>
          rec.dayOfWeek === selected.slot.dayOfWeek &&
          rec.blockStartHour === selected.slot.blockStartHour &&
          rec.format === selected.slot.format
      )
    : recommendations[0];

  const slot = selected?.slot ?? null;
  const slotDate = selected?.slotDate ?? null;

  let hooks: string[] = [];
  if (slot) {
    const proposalId = slot.categories?.proposal?.[0];
    const contextId = slot.categories?.context?.[0];
    const referenceId = slot.categories?.reference?.[0];
    const formatId = slot.format;

    const samples = await getBlockSampleCaptions(
      userId,
      periodDays,
      slot.dayOfWeek,
      slot.blockStartHour,
      {
        formatId,
        proposalId,
        contextId,
        referenceId,
      },
      4
    ).catch(() => []);

    hooks = samples.map((caption) => firstSentence(caption, 140)).filter(Boolean) as string[];
  } else if (matchedRecommendation) {
    const proposalId = matchedRecommendation.categories.proposal?.[0];
    const contextId = matchedRecommendation.categories.context?.[0];

    const proposalLabel = proposalId ? getCategoryById(proposalId, "proposal")?.label : null;
    const contextLabel = contextId ? getCategoryById(contextId, "context")?.label : null;

    hooks = [proposalLabel, contextLabel].filter(Boolean) as string[];
  }

  const primaryHook =
    firstSentence(slot?.title, 120) ??
    firstSentence(slot?.scriptShort, 140) ??
    hooks.shift() ??
    null;

  const liftPercent = matchedRecommendation
    ? Math.round((matchedRecommendation.score - 1) * 100)
    : null;

  const slotLabel = slotDate ? formatSlotLabel(slotDate) : null;

  return {
    slotLabel: slotLabel ?? "Próximo slot em breve",
    slotDateIso: slotDate?.toISOString() ?? null,
    primaryHook,
    secondaryHooks: hooks.slice(0, 3),
    expectedLiftPercent: liftPercent,
    plannerUrl: "/planning/planner",
    plannerSlotId: slot?.slotId ?? null,
    isInstagramConnected: true,
  };
}

function createDayFormatter() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PLANNER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function computeConsistencyCard(userId: string) {
  const uid = new Types.ObjectId(userId);
  const now = new Date();
  const startWindow = new Date(now);
  startWindow.setUTCDate(startWindow.getUTCDate() - 30);

  const metrics = await MetricModel.find({
    user: uid,
    postDate: { $gte: startWindow, $lte: now },
  })
    .select({ postDate: 1, "stats.total_interactions": 1 })
    .lean()
    .exec();

  if (!metrics.length) {
    return null;
  }

  const formatDay = createDayFormatter();
  const postsByDay = new Map<string, number>();

  for (const metric of metrics) {
    const dayKey = formatDay.format(metric.postDate as Date);
    postsByDay.set(dayKey, (postsByDay.get(dayKey) ?? 0) + 1);
  }

  const countPosts = (days: number) => {
    let total = 0;
    for (let offset = 0; offset < days; offset++) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - offset);
      const key = formatDay.format(d);
      total += postsByDay.get(key) ?? 0;
    }
    return total;
  };

  const postsLast7 = countPosts(7);
  const postsLast14 = countPosts(14);
  const postsLast28 = countPosts(28);

  let streak = 0;
  for (let offset = 0; offset < 30; offset++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - offset);
    const key = formatDay.format(d);
    if ((postsByDay.get(key) ?? 0) > 0) streak += 1;
    else break;
  }

  const weeklyGoal = 4;
  const projected = Math.round((postsLast28 / 28) * 7);
  const overpostingWarning = postsLast7 >= weeklyGoal + 2 || [...postsByDay.values()].some((count) => count >= 3);

  return {
    streakDays: streak,
    weeklyGoal,
    postsSoFar: postsLast7,
    projectedPosts: projected,
    overpostingWarning,
    plannerUrl: "/planning/planner",
    hotSlotsUrl: "/planning/planner?view=heatmap",
  };
}

function getTimezoneName(date: Date, timeZone: string) {
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

function formatMentorshipLabel(date: Date, timeZone: string) {
  const offset = getTimeZoneOffsetMs(date, timeZone);
  const local = new Date(date.getTime() + offset);
  const weekday = WEEKDAY_LABELS[local.getUTCDay()] ?? "Seg";

  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const formattedTime = timeFormatter.format(date);
  const [hours, minutes] = formattedTime.split(":");
  const timeLabel = minutes === "00" ? `${hours}h` : `${hours}h${minutes}`;
  const tzName = getTimezoneName(date, timeZone);

  return tzName ? `${weekday} • ${timeLabel} (${tzName})` : `${weekday} • ${timeLabel}`;
}

function escapeICSText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildMentorshipCalendarLink(event: {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt?: Date | null;
  timezone: string;
  location?: string | null;
  joinUrl?: string | null;
}) {
  try {
    const start = new Date(event.startAt);
    const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
    const dtStamp = formatDate(new Date());
    const dtStart = formatDate(start);
    const dtEnd = formatDate(end);
    const summary = escapeICSText(event.title || "Mentoria Data2Content");
    const descriptionParts: string[] = [];
    if (event.description) descriptionParts.push(event.description);
    if (event.joinUrl) descriptionParts.push(`Link: ${event.joinUrl}`);
    const description =
      descriptionParts.length > 0
        ? escapeICSText(descriptionParts.join("\n"))
        : "Traga dúvidas recentes e receba orientações ao vivo com o time Data2Content.";
    const location = event.location ? escapeICSText(event.location) : "Online";

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Data2Content//Mentoria//PT",
      "BEGIN:VEVENT",
      `UID:mentoria-${dtStart}@data2content.ai`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const payload = lines.join("\r\n");
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(payload)}`;
  } catch (error) {
    logger.warn("[home.summary] Failed to build mentorship ICS link", error);
    return null;
  }
}

function getTotalInteractions(stats: any): number | null {
  if (!stats || typeof stats !== "object") return null;
  const primary = Number((stats as any).total_interactions ?? (stats as any).engagement);
  if (Number.isFinite(primary) && primary > 0) return primary;

  const fields = ["likes", "comments", "shares", "saved", "replies"];
  let sum = 0;
  let hasValue = false;
  for (const field of fields) {
    const value = Number((stats as any)?.[field]);
    if (Number.isFinite(value) && value > 0) {
      sum += value;
      hasValue = true;
    }
  }
  if (hasValue && sum > 0) return sum;
  return null;
}

function formatHourRange(startHour: number, windowSize = 3) {
  const endHour = startHour + windowSize;
  const format = (hour: number) => `${hour.toString().padStart(2, "0")}h`;
  return `${format(startHour)} às ${endHour >= 24 ? "24h" : format(endHour)}`;
}

async function computeMicroInsight(userId: string) {
  const uid = new Types.ObjectId(userId);
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 30);

  const metrics = await MetricModel.find({
    user: uid,
    postDate: { $gte: start, $lte: now },
  })
    .select({ postDate: 1, stats: 1 })
    .sort({ postDate: -1 })
    .limit(200)
    .lean()
    .exec();

  if (!metrics.length) return null;

  const dayAggregates = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  const hourAggregates = new Map<number, { sum: number; count: number }>();

  let totalSum = 0;
  let totalCount = 0;

  for (const metric of metrics) {
    const interactions = getTotalInteractions((metric as any).stats);
    if (!interactions || interactions <= 0) continue;

    const postDate = metric.postDate instanceof Date ? metric.postDate : new Date(metric.postDate);
    if (Number.isNaN(postDate.getTime())) continue;

    const localDate = new Date(postDate.getTime() + getTimeZoneOffsetMs(postDate, PLANNER_TIMEZONE));
    const day = localDate.getUTCDay();
    const hour = localDate.getUTCHours();
    const dayAggregate = dayAggregates[day];
    if (!dayAggregate) continue;
    dayAggregate.sum += interactions;
    dayAggregate.count += 1;

    const bucket = Math.floor(hour / 3) * 3;
    const aggregate = hourAggregates.get(bucket) ?? { sum: 0, count: 0 };
    aggregate.sum += interactions;
    aggregate.count += 1;
    hourAggregates.set(bucket, aggregate);

    totalSum += interactions;
    totalCount += 1;
  }

  if (totalCount < 5 || totalSum <= 0) return null;

  const overallAverage = totalSum / totalCount;
  if (!Number.isFinite(overallAverage) || overallAverage <= 0) return null;

  const MIN_COUNT = 3;
  const MIN_IMPROVEMENT = 0.1; // 10%

  let bestDay: { index: number; improvement: number } | null = null;
  dayAggregates.forEach((agg, index) => {
    if (agg.count < MIN_COUNT) return;
    const avg = agg.sum / agg.count;
    if (!Number.isFinite(avg) || avg <= 0) return;
    const improvement = (avg - overallAverage) / overallAverage;
    if (improvement < MIN_IMPROVEMENT) return;
    if (!bestDay || improvement > bestDay.improvement) {
      bestDay = { index, improvement };
    }
  });

  let bestHour: { bucket: number; improvement: number } | null = null;
  for (const [bucket, agg] of hourAggregates.entries()) {
    if (agg.count < MIN_COUNT) continue;
    const avg = agg.sum / agg.count;
    if (!Number.isFinite(avg) || avg <= 0) continue;
    const improvement = (avg - overallAverage) / overallAverage;
    if (improvement < MIN_IMPROVEMENT) continue;
    if (!bestHour || improvement > bestHour.improvement) {
      bestHour = { bucket, improvement };
    }
  }

  if (!bestDay && !bestHour) return null;

  const candidates: Array<{ type: "day" | "hour"; key: number; improvement: number }> = [];
  if (bestDay !== null) {
    const { index, improvement } = bestDay;
    candidates.push({ type: "day", key: index, improvement });
  }
  if (bestHour !== null) {
    const { bucket, improvement } = bestHour;
    candidates.push({ type: "hour", key: bucket, improvement });
  }
  if (!candidates.length) return null;

  const firstCandidate = candidates[0];
  if (!firstCandidate) return null;

  let selected = firstCandidate;
  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (!candidate) continue;
    if (candidate.improvement > selected.improvement) {
      selected = candidate;
    }
  }

  const impactPercent = Math.round(selected.improvement * 100);
  if (!Number.isFinite(impactPercent)) return null;

  if (selected.type === "day") {
    const dayIndex = selected.key;
    const dayPhrase = WEEKDAY_SENTENCE_LABELS[dayIndex] ?? "nos melhores dias";
    const dayName = WEEKDAY_NAMES_FULL[dayIndex] ?? "Dia";
    return {
      id: `day-${dayIndex}`,
      message: `Postar ${dayPhrase} gerou +${impactPercent}% de interações nas últimas 4 semanas.`,
      contextLabel: `Dia com melhor desempenho recente: ${dayName}.`,
      impactLabel: `+${impactPercent}% interações`,
      ctaLabel: "Ver slots no Planner",
      ctaUrl: "/planning/planner?view=heatmap",
    };
  }

  const bucketStart = selected.key;
  const rangeLabel = formatHourRange(bucketStart, 3);
  return {
    id: `hour-${bucketStart}`,
    message: `Entre ${rangeLabel}, suas publicações geraram +${impactPercent}% de interações nas últimas 4 semanas.`,
    contextLabel: `Faixa horária com melhor média recente.`,
    impactLabel: `+${impactPercent}% interações`,
    ctaLabel: "Abrir Planner IA",
    ctaUrl: "/planning/planner",
  };
}

function computeNextMentorshipSlot(baseDate: Date) {
  const targetWeekday = 1; // Monday
  const reference = new Date(baseDate.getTime());
  const currentDay = reference.getDay();
  let delta = (targetWeekday - currentDay + 7) % 7;
  if (delta === 0 && reference.getHours() >= 19) {
    delta = 7;
  }

  const next = new Date(reference.getTime());
  next.setDate(reference.getDate() + delta);
  next.setHours(19, 0, 0, 0);
  const label = formatMentorshipLabel(next, "America/Sao_Paulo");

  return {
    isoDate: next.toISOString(),
    display: label,
  };
}

async function computeMediaKitCard(
  userId: string,
  appBaseUrl: string | null,
  userSnapshot?: Pick<IUser, "mediaKitToken" | "mediaKitSlug"> | null,
  options?: { proposalsViaMediaKit?: number }
) {
  let token = userSnapshot?.mediaKitToken ?? null;
  let slug = userSnapshot?.mediaKitSlug ?? null;

  if (!token && !slug) {
    const user = await UserModel.findById(userId)
      .select({
        mediaKitToken: 1,
        mediaKitSlug: 1,
      })
      .lean()
      .exec();
    token = user?.mediaKitToken ?? null;
    slug = user?.mediaKitSlug ?? null;
  }

  const hasMediaKit = Boolean(token || slug);

  const sharePath = token ? `/mediakit/${token}` : slug ? `/mediakit/${slug}` : null;
  const shareUrl = sharePath && appBaseUrl ? `${appBaseUrl}${sharePath}` : null;

  const now = new Date();
  const start30 = new Date(now);
  start30.setUTCDate(start30.getUTCDate() - 30);

  const metrics = await MetricModel.find({
    user: new Types.ObjectId(userId),
    postDate: { $gte: start30, $lte: now },
  })
    .select({ postDate: 1, description: 1, "stats.views": 1, "stats.reach": 1, "stats.total_interactions": 1, "stats.engagement_rate_on_reach": 1 })
    .sort({ "stats.views": -1 })
    .limit(50)
    .lean()
    .exec();

  const topPost = metrics[0];
  const avgEngagementRates = metrics
    .map((m) => Number((m as any)?.stats?.engagement_rate_on_reach ?? (m as any)?.stats?.engagement_rate))
    .filter((v) => Number.isFinite(v) && v > 0);

  const erAverage = avgEngagementRates.length
    ? (avgEngagementRates.reduce((sum, value) => sum + value, 0) / avgEngagementRates.length) * 100
    : null;

  const engagementLabel = erAverage !== null ? `${erAverage.toFixed(1)}%` : null;

  const demographics = await AudienceDemographicSnapshotModel.findOne({
    user: new Types.ObjectId(userId),
  })
    .sort({ recordedAt: -1 })
    .lean()
    .exec();

  let topCities: string[] = [];
  if (demographics?.demographics?.follower_demographics?.city) {
    const entries = Object.entries(demographics.demographics.follower_demographics.city)
      .map(([value, count]) => ({ value, count: Number(count) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    topCities = entries.map((entry) => entry.value);
  }

  const highlights: Array<{ label: string; value: string }> = [];
  if (topPost?.stats?.views) {
    highlights.push({
      label: "Top post",
      value: `${formatCompactNumber(topPost.stats.views)} views`,
    });
  }
  if (engagementLabel) {
    highlights.push({
      label: "ER 30 dias",
      value: engagementLabel,
    });
  }
  if (topCities.length) {
    highlights.push({
      label: "Cidades top",
      value: topCities.join(", "),
    });
  }

  const lastUpdated = metrics[0]?.postDate ?? null;
  const lastUpdatedLabel = lastUpdated
    ? formatDistanceToNow(lastUpdated, { addSuffix: true, locale: ptBR })
    : null;

  let viewsLast7Days = 0;
  if (hasMediaKit) {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    viewsLast7Days = await MediaKitAccessLogModel.countDocuments({
      user: new Types.ObjectId(userId),
      timestamp: { $gte: sevenDaysAgo },
    }).exec();
  }

  let proposalsViaMediaKit = options?.proposalsViaMediaKit ?? null;
  if (proposalsViaMediaKit === null && slug) {
    proposalsViaMediaKit = await BrandProposalModel.countDocuments({
      userId: new Types.ObjectId(userId),
      mediaKitSlug: slug,
    }).exec();
  }

  return {
    shareUrl,
    highlights,
    lastUpdatedLabel,
    hasMediaKit,
    viewsLast7Days,
    proposalsViaMediaKit: proposalsViaMediaKit ?? 0,
  };
}

async function aggregateCommunity(periodKey: PeriodKey) {
  const cached = communityTotalsCache.get(periodKey);
  const nowTs = Date.now();
  if (cached && cached.expires > nowTs) {
    return cached.data;
  }

  const periodDays = PERIOD_TO_DAYS[periodKey];
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setUTCDate(currentStart.getUTCDate() - periodDays + 1);
  currentStart.setUTCHours(0, 0, 0, 0);

  const previousStart = new Date(currentStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - periodDays);

  const currentRange = await MetricModel.aggregate([
    {
      $match: {
        postDate: { $gte: currentStart, $lte: now },
      },
    },
    {
      $group: {
        _id: null,
        postCount: { $sum: 1 },
        totalViews: { $sum: { $ifNull: ["$stats.views", 0] } },
        totalReach: { $sum: { $ifNull: ["$stats.reach", 0] } },
        totalInteractions: { $sum: { $ifNull: ["$stats.total_interactions", 0] } },
        creatorIds: { $addToSet: "$user" },
      },
    },
    {
      $project: {
        _id: 0,
        postCount: 1,
        totalViews: 1,
        totalReach: 1,
        totalInteractions: 1,
        creators: { $size: "$creatorIds" },
      },
    },
  ]).exec();

  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousRange = await MetricModel.aggregate([
    {
      $match: {
        postDate: { $gte: previousStart, $lte: previousEnd },
      },
    },
    {
      $group: {
        _id: null,
        postCount: { $sum: 1 },
        totalViews: { $sum: { $ifNull: ["$stats.views", 0] } },
        totalReach: { $sum: { $ifNull: ["$stats.reach", 0] } },
        totalInteractions: { $sum: { $ifNull: ["$stats.total_interactions", 0] } },
        creatorIds: { $addToSet: "$user" },
      },
    },
    {
      $project: {
        _id: 0,
        postCount: 1,
        totalViews: 1,
        totalReach: 1,
        totalInteractions: 1,
        creators: { $size: "$creatorIds" },
      },
    },
  ]).exec();

  const currentTotals = currentRange[0] ?? {
    postCount: 0,
    totalViews: 0,
    totalReach: 0,
    totalInteractions: 0,
    creators: 0,
  };

  const previousTotals = previousRange[0] ?? {
    postCount: 0,
    totalViews: 0,
    totalReach: 0,
    totalInteractions: 0,
    creators: 0,
  };

  const data = {
    current: currentTotals,
    previous: previousTotals,
  };
  communityTotalsCache.set(periodKey, {
    expires: nowTs + COMMUNITY_CACHE_TTL_MS,
    data,
  });
  return data;
}

function buildCommunityMetrics(period: PeriodKey, current: any, previous: any) {
  const metrics = [
    {
      id: "creators",
      label: "Criadores ativos",
      value: formatCompactNumber(current.creators),
      deltaPercent: toPercentDelta(current.creators, previous.creators),
    },
    {
      id: "posts",
      label: "Posts verificados",
      value: formatCompactNumber(current.postCount),
      deltaPercent: toPercentDelta(current.postCount, previous.postCount),
    },
    {
      id: "views",
      label: "Visualizações",
      value: formatCompactNumber(current.totalViews),
      deltaPercent: toPercentDelta(current.totalViews, previous.totalViews),
    },
    {
      id: "interactions",
      label: "Interações",
      value: formatCompactNumber(current.totalInteractions),
      deltaPercent: toPercentDelta(current.totalInteractions, previous.totalInteractions),
    },
    {
      id: "reach",
      label: "Alcance total",
      value: formatCompactNumber(current.totalReach),
      deltaPercent: toPercentDelta(current.totalReach, previous.totalReach),
    },
  ];

  return {
    period,
    metrics: metrics.map((metric) => ({
      ...metric,
      periodLabel: `últimos ${PERIOD_TO_DAYS[period]} dias`,
    })),
  };
}

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions)) as Session | null;
  if (!session?.user?.id) {
    return respondError("Unauthorized", 401);
  }

  const userId = session.user.id as string;
  const searchParams = new URL(request.url).searchParams;
  const scopeParam = searchParams.get("scope") ?? "all";
  const allowedScopes = new Set(["all", "core", "performance", "proposals", "community"]);
  const scope = allowedScopes.has(scopeParam) ? scopeParam : "all";
  const periodParam = (searchParams.get("period") as PeriodKey | null) ?? "30d";
  const period = PERIOD_TO_DAYS[periodParam] ? periodParam : "30d";
  const cacheKey = buildDashboardHomeSummaryCacheKey({ userId, scope, period });
  const cached = dashboardCache.get<{ ok: true; data: Record<string, unknown> }>(cacheKey);
  if (cached?.hit) {
    return NextResponse.json(cached.value);
  }

  try {
    await connectToDatabase();
  } catch (error) {
    logger.error("[home.summary] Failed to connect to database", error);
    return respondError("Erro ao conectar no banco de dados.");
  }

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_BASE_URL ||
    null;

  const responsePayload: Record<string, unknown> = {};
  let userSnapshot: UserSnapshot | null = null;

  if (scope !== "community") {
    try {
      userSnapshot = (await UserModel.findById(userId)
        .select({
          communityInspirationOptIn: 1,
          communityInspirationOptInDate: 1,
          whatsappVerified: 1,
          whatsappPhone: 1,
          whatsappLinkedAt: 1,
          whatsappTrialEligible: 1,
          whatsappTrialActive: 1,
          whatsappTrialStartedAt: 1,
          whatsappTrialExpiresAt: 1,
          whatsappTrialLastReminderAt: 1,
          whatsappTrialLastNotificationAt: 1,
          instagramAccountId: 1,
          mediaKitSlug: 1,
          mediaKitToken: 1,
          planStatus: 1,
          planExpiresAt: 1,
          planInterval: 1,
          cancelAtPeriodEnd: 1,
          stripePriceId: 1,
          role: 1,
          creatorProfileExtended: 1,
        })
        .lean()
        .exec()) as UserSnapshot | null;
    } catch (error) {
      logger.error("[home.summary] Failed to load user snapshot", error);
    }
  }

  if (scope === "core") {
    const coreState = buildPlanAndCommunityState(userSnapshot);
    responsePayload.plan = coreState.plan;
    responsePayload.whatsapp = coreState.whatsapp;
    responsePayload.community = coreState.community;

    const payload = {
      ok: true,
      data: responsePayload,
    } as const;
    dashboardCache.set(cacheKey, payload, SHORT_DASHBOARD_TTL_MS);
    return NextResponse.json(payload);
  }

  if (scope === "performance") {
    const instagramConnected = Boolean(
      (session.user as any)?.instagramConnected ?? userSnapshot?.instagramAccountId
    );
    try {
      responsePayload.nextPost = instagramConnected ? await computeNextPostCard(userId) : { isInstagramConnected: false };
    } catch (error) {
      logger.error("[home.summary] Failed to compute next post card (scope=performance)", error);
      responsePayload.nextPost = { isInstagramConnected: instagramConnected };
    }

    try {
      const consistency = await computeConsistencyCard(userId);
      responsePayload.consistency = consistency;
      responsePayload.goals = consistency
        ? {
            weeklyPostsTarget:
              typeof consistency.weeklyGoal === "number" ? consistency.weeklyGoal : null,
            currentStreak: typeof consistency.streakDays === "number" ? consistency.streakDays : null,
          }
        : {
            weeklyPostsTarget: null,
            currentStreak: null,
          };
    } catch (error) {
      logger.error("[home.summary] Failed to compute consistency card (scope=performance)", error);
      responsePayload.consistency = null;
      responsePayload.goals = {
        weeklyPostsTarget: null,
        currentStreak: null,
      };
    }

    if (instagramConnected) {
      try {
        responsePayload.microInsight = await computeMicroInsight(userId);
      } catch (error) {
        logger.error("[home.summary] Failed to compute micro insight (scope=performance)", error);
        responsePayload.microInsight = null;
      }
    } else {
      responsePayload.microInsight = null;
    }

    const coreState = buildPlanAndCommunityState(userSnapshot);
    try {
      const mentorshipEvent = await getUpcomingMentorshipEvent().catch(() => null);
      const fallbackSlot = computeNextMentorshipSlot(new Date());

      const selectedStart =
        mentorshipEvent && !mentorshipEvent.isFallback
          ? mentorshipEvent.startAt
          : new Date(fallbackSlot.isoDate);
      const selectedTimezone =
        mentorshipEvent?.timezone && mentorshipEvent.timezone.length
          ? mentorshipEvent.timezone
          : "America/Sao_Paulo";
      const label = formatMentorshipLabel(selectedStart, selectedTimezone);

      const calendarUrl = buildMentorshipCalendarLink({
        title: mentorshipEvent?.title ?? "Mentoria semanal Data2Content",
        description:
          mentorshipEvent?.description ??
          "Traga dúvidas recentes e receba orientações ao vivo com o time Data2Content.",
        startAt: selectedStart,
        endAt: mentorshipEvent?.endAt ?? null,
        timezone: selectedTimezone,
        location: mentorshipEvent?.location ?? null,
        joinUrl: mentorshipEvent?.joinUrl ?? null,
      });

      const joinCommunityUrl = coreState.hasPaidProPlan
        ? mentorshipEvent?.joinUrl ?? VIP_COMMUNITY_URL
        : FREE_COMMUNITY_URL;
      const reminderUrl = coreState.hasPaidProPlan
        ? mentorshipEvent?.reminderUrl ?? VIP_COMMUNITY_URL
        : null;

      responsePayload.mentorship = {
        nextSessionLabel: label,
        topic: mentorshipEvent?.title ?? "Mentoria semanal Data2Content",
        description: mentorshipEvent?.description ?? undefined,
        joinCommunityUrl,
        calendarUrl,
        whatsappReminderUrl: reminderUrl,
        isMember: coreState.hasPaidProPlan && coreState.whatsappLinked,
      };
    } catch (error) {
      logger.error("[home.summary] Failed to compute mentorship card (scope=performance)", error);
      responsePayload.mentorship = null;
    }

    const payload = {
      ok: true,
      data: responsePayload,
    } as const;
    dashboardCache.set(cacheKey, payload, SHORT_DASHBOARD_TTL_MS);
    return NextResponse.json(payload);
  }

  if (scope === "all") {
    const instagramConnected = Boolean(
      (session.user as any)?.instagramConnected ?? userSnapshot?.instagramAccountId
    );
    try {
      responsePayload.nextPost = instagramConnected ? await computeNextPostCard(userId) : { isInstagramConnected: false };
    } catch (error) {
      logger.error("[home.summary] Failed to compute next post card", error);
      responsePayload.nextPost = { isInstagramConnected: instagramConnected };
    }

    try {
      const consistency = await computeConsistencyCard(userId);
      responsePayload.consistency = consistency;
      responsePayload.goals = consistency
        ? {
            weeklyPostsTarget:
              typeof consistency.weeklyGoal === "number" ? consistency.weeklyGoal : null,
            currentStreak: typeof consistency.streakDays === "number" ? consistency.streakDays : null,
          }
        : {
            weeklyPostsTarget: null,
            currentStreak: null,
          };
    } catch (error) {
      logger.error("[home.summary] Failed to compute consistency card", error);
      responsePayload.consistency = null;
      responsePayload.goals = {
        weeklyPostsTarget: null,
        currentStreak: null,
      };
    }

    const planStatus = userSnapshot?.planStatus ?? null;
    const cancelAtPeriodEnd = Boolean(userSnapshot?.cancelAtPeriodEnd);
    const accessMeta = getPlanAccessMeta(planStatus, cancelAtPeriodEnd);
    const normalizedStatus = accessMeta.normalizedStatus;
    const planIntervalRaw = userSnapshot?.planInterval ?? null;
    const planInterval =
      planIntervalRaw === "month" || planIntervalRaw === "year" ? planIntervalRaw : null;
    const planExpiresAtRaw = userSnapshot?.planExpiresAt ?? null;
    const planExpiresAt =
      planExpiresAtRaw instanceof Date
        ? planExpiresAtRaw
        : planExpiresAtRaw
        ? new Date(planExpiresAtRaw)
        : null;
    const validPlanExpiresAt =
      planExpiresAt && !Number.isNaN(planExpiresAt.getTime()) ? planExpiresAt : null;
    const nowMs = Date.now();
    const trialExpiresFromRecordRaw = userSnapshot?.whatsappTrialExpiresAt ?? null;
    const trialExpiresFromRecord =
      trialExpiresFromRecordRaw instanceof Date
        ? trialExpiresFromRecordRaw
        : trialExpiresFromRecordRaw
        ? new Date(trialExpiresFromRecordRaw)
        : null;
    const validTrialExpires =
      trialExpiresFromRecord && !Number.isNaN(trialExpiresFromRecord.getTime())
        ? trialExpiresFromRecord
        : null;

    const trialActiveFromPlan = normalizedStatus === "trial" || normalizedStatus === "trialing";
    const trialActiveFromWhatsapp =
      WHATSAPP_TRIAL_ENABLED &&
      Boolean(userSnapshot?.whatsappTrialActive) &&
      (!validTrialExpires || validTrialExpires.getTime() > nowMs);
    const trialActive = trialActiveFromPlan || trialActiveFromWhatsapp;

    const hasPaidProPlan = PAID_PRO_STATUSES.has(normalizedStatus as "active" | "non_renewing");
    const hasPremiumAccess = hasPaidProPlan || trialActive;

    const trialEligibleRecord = userSnapshot?.whatsappTrialEligible;
    const trialStartedRecord = Boolean(userSnapshot?.whatsappTrialStartedAt);
    const hasEverHadPlan = Boolean(validPlanExpiresAt) || trialStartedRecord;

    let trialEligible =
      WHATSAPP_TRIAL_ENABLED &&
      (typeof trialEligibleRecord === "boolean"
        ? trialEligibleRecord
        : !trialActive && !hasPaidProPlan && !hasEverHadPlan);

    if (trialActiveFromWhatsapp || trialStartedRecord) {
      trialEligible = false;
    }

    trialEligible = Boolean(trialEligible);

    const trialStarted = trialStartedRecord || trialActive;
    const trialExpiresIso = trialActiveFromWhatsapp
      ? validTrialExpires
        ? validTrialExpires.toISOString()
        : null
      : trialActiveFromPlan && validPlanExpiresAt
      ? validPlanExpiresAt.toISOString()
      : null;

    responsePayload.plan = {
      status: planStatus ?? null,
      normalizedStatus,
      interval: planInterval,
      cancelAtPeriodEnd,
      expiresAt: validPlanExpiresAt ? validPlanExpiresAt.toISOString() : null,
      priceId: userSnapshot?.stripePriceId ?? null,
      hasPremiumAccess,
      isPro: hasPaidProPlan,
      trial: {
        active: trialActive,
        eligible: trialEligible,
        started: trialStarted,
        expiresAt: trialExpiresIso,
      },
    };

    const whatsappLinked = Boolean(userSnapshot?.whatsappVerified || userSnapshot?.whatsappPhone);

    responsePayload.whatsapp = {
      linked: whatsappLinked,
      phone: userSnapshot?.whatsappPhone ?? null,
      trial: {
        active: trialActive,
        eligible: trialEligible,
        started: trialStarted,
        expiresAt: trialExpiresIso,
      },
      startUrl: WHATSAPP_TRIAL_URL,
    };

    let proposalsSummary: DashboardProposalsComputation | null = null;
    try {
      proposalsSummary = await computeDashboardProposalsSummary(userId, userSnapshot?.mediaKitSlug ?? null);
      responsePayload.proposalsSummary = proposalsSummary;
    } catch (error) {
      logger.error("[home.summary] Failed to compute proposals summary", error);
      responsePayload.proposalsSummary = null;
    }

    let mediaKitCard: Awaited<ReturnType<typeof computeMediaKitCard>> | null = null;
    try {
      mediaKitCard = await computeMediaKitCard(userId, appBaseUrl, userSnapshot, {
        proposalsViaMediaKit: proposalsSummary?.proposalsViaMediaKit,
      });
      responsePayload.mediaKit = mediaKitCard;
    } catch (error) {
      logger.error("[home.summary] Failed to compute media kit card", error);
      responsePayload.mediaKit = {
        hasMediaKit: false,
        highlights: [],
        viewsLast7Days: 0,
        proposalsViaMediaKit: 0,
      };
    }

    const surveyCompleted = Boolean(
      userSnapshot?.creatorProfileExtended?.updatedAt ||
        userSnapshot?.creatorProfileExtended?.stage ||
        userSnapshot?.creatorProfileExtended?.mainGoal3m,
    );

    try {
      responsePayload.flowChecklist = buildFlowChecklist({
        instagramConnected,
        hasMediaKit: Boolean(mediaKitCard?.hasMediaKit),
        proposals: proposalsSummary,
        hasProAccess: hasPremiumAccess,
        surveyCompleted,
      });
    } catch (error) {
      logger.error("[home.summary] Failed to compose flow checklist", error);
      responsePayload.flowChecklist = null;
    }

    try {
      responsePayload.journeyProgress = buildJourneyProgress({
        instagramConnected,
        hasMediaKit: Boolean(mediaKitCard?.hasMediaKit),
        mediaKitSignals: {
          viewsLast7Days: mediaKitCard?.viewsLast7Days ?? 0,
          proposalsViaMediaKit: mediaKitCard?.proposalsViaMediaKit ?? 0,
        },
        hasProAccess: hasPaidProPlan,
        surveyCompleted: Boolean(
          userSnapshot?.creatorProfileExtended?.updatedAt ||
            userSnapshot?.creatorProfileExtended?.stage ||
            userSnapshot?.creatorProfileExtended?.mainGoal3m,
        ),
      });
    } catch (error) {
      logger.error("[home.summary] Failed to compose journey progress", error);
      responsePayload.journeyProgress = null;
    }

    if (instagramConnected) {
      try {
        responsePayload.microInsight = await computeMicroInsight(userId);
      } catch (error) {
        logger.error("[home.summary] Failed to compute micro insight", error);
        responsePayload.microInsight = null;
      }
    } else {
      responsePayload.microInsight = null;
    }

    const freeCommunityMember = Boolean(userSnapshot?.communityInspirationOptIn);
    const vipHasAccess = hasPaidProPlan;
    const vipMember = vipHasAccess && whatsappLinked;
    const mentorshipIsMember = vipMember;

    responsePayload.community = {
      free: {
        isMember: freeCommunityMember,
        inviteUrl: FREE_COMMUNITY_URL,
      },
      vip: {
        hasAccess: vipHasAccess,
        isMember: vipMember,
        inviteUrl: vipHasAccess ? VIP_COMMUNITY_URL : null,
      },
    };

    try {
      const mentorshipEvent = await getUpcomingMentorshipEvent().catch(() => null);
      const fallbackSlot = computeNextMentorshipSlot(new Date());

      const selectedStart =
        mentorshipEvent && !mentorshipEvent.isFallback
          ? mentorshipEvent.startAt
          : new Date(fallbackSlot.isoDate);
      const selectedTimezone =
        mentorshipEvent?.timezone && mentorshipEvent.timezone.length
          ? mentorshipEvent.timezone
          : "America/Sao_Paulo";
      const label = formatMentorshipLabel(selectedStart, selectedTimezone);

      const calendarUrl = buildMentorshipCalendarLink({
        title: mentorshipEvent?.title ?? "Mentoria semanal Data2Content",
        description:
          mentorshipEvent?.description ??
          "Traga dúvidas recentes e receba orientações ao vivo com o time Data2Content.",
        startAt: selectedStart,
        endAt: mentorshipEvent?.endAt ?? null,
        timezone: selectedTimezone,
        location: mentorshipEvent?.location ?? null,
        joinUrl: mentorshipEvent?.joinUrl ?? null,
      });

      const joinCommunityUrl = vipHasAccess
        ? mentorshipEvent?.joinUrl ?? VIP_COMMUNITY_URL
        : FREE_COMMUNITY_URL;
      const reminderUrl = vipHasAccess ? mentorshipEvent?.reminderUrl ?? VIP_COMMUNITY_URL : null;

      responsePayload.mentorship = {
        nextSessionLabel: label,
        topic: mentorshipEvent?.title ?? "Mentoria semanal Data2Content",
        description: mentorshipEvent?.description ?? undefined,
        joinCommunityUrl,
        calendarUrl,
        whatsappReminderUrl: reminderUrl,
        isMember: mentorshipIsMember,
      };
    } catch (error) {
      logger.error("[home.summary] Failed to compute mentorship card", error);
      responsePayload.mentorship = null;
    }

  }

  if (scope === "proposals") {
    const instagramConnected = Boolean(
      (session.user as any)?.instagramConnected ?? userSnapshot?.instagramAccountId
    );

    let proposalsSummary: DashboardProposalsComputation | null = null;
    try {
      proposalsSummary = await computeDashboardProposalsSummary(
        userId,
        userSnapshot?.mediaKitSlug ?? null
      );
      responsePayload.proposalsSummary = proposalsSummary;
    } catch (error) {
      logger.error("[home.summary] Failed to compute proposals summary (scope=proposals)", error);
      responsePayload.proposalsSummary = null;
    }

    let mediaKitCard: Awaited<ReturnType<typeof computeMediaKitCard>> | null = null;
    try {
      mediaKitCard = await computeMediaKitCard(userId, appBaseUrl, userSnapshot, {
        proposalsViaMediaKit: proposalsSummary?.proposalsViaMediaKit,
      });
      responsePayload.mediaKit = mediaKitCard;
    } catch (error) {
      logger.error("[home.summary] Failed to compute media kit card (scope=proposals)", error);
      responsePayload.mediaKit = {
        hasMediaKit: false,
        highlights: [],
        viewsLast7Days: 0,
        proposalsViaMediaKit: 0,
      };
    }

    const planStatus = userSnapshot?.planStatus ?? null;
    const cancelAtPeriodEnd = Boolean(userSnapshot?.cancelAtPeriodEnd);
    const accessMeta = getPlanAccessMeta(planStatus, cancelAtPeriodEnd);
    const hasPremiumAccess = accessMeta.hasPremiumAccess;
    const hasPaidProPlan = PAID_PRO_STATUSES.has(accessMeta.normalizedStatus as "active" | "non_renewing");
    const surveyCompleted = Boolean(
      userSnapshot?.creatorProfileExtended?.updatedAt ||
        userSnapshot?.creatorProfileExtended?.stage ||
        userSnapshot?.creatorProfileExtended?.mainGoal3m,
    );

    try {
      responsePayload.flowChecklist = buildFlowChecklist({
        instagramConnected,
        hasMediaKit: Boolean(mediaKitCard?.hasMediaKit),
        proposals: proposalsSummary,
        hasProAccess: hasPremiumAccess,
        surveyCompleted,
      });
    } catch (error) {
      logger.error("[home.summary] Failed to compose flow checklist (scope=proposals)", error);
      responsePayload.flowChecklist = null;
    }

    try {
      responsePayload.journeyProgress = buildJourneyProgress({
        instagramConnected,
        hasMediaKit: Boolean(mediaKitCard?.hasMediaKit),
        mediaKitSignals: {
          viewsLast7Days: mediaKitCard?.viewsLast7Days ?? 0,
          proposalsViaMediaKit: mediaKitCard?.proposalsViaMediaKit ?? 0,
        },
        hasProAccess: hasPaidProPlan,
        surveyCompleted,
      });
    } catch (error) {
      logger.error("[home.summary] Failed to compose journey progress (scope=proposals)", error);
      responsePayload.journeyProgress = null;
    }

    const payload = {
      ok: true,
      data: responsePayload,
    } as const;
    dashboardCache.set(cacheKey, payload, SHORT_DASHBOARD_TTL_MS);
    return NextResponse.json(payload);
  }

  if (scope === "all" || scope === "community") {
    try {
      const communityTotals = await aggregateCommunity(period);
      responsePayload.communityMetrics = buildCommunityMetrics(
        period,
        communityTotals.current,
        communityTotals.previous
      );
    } catch (error) {
      logger.error("[home.summary] Failed to compute community metrics", error);
      responsePayload.communityMetrics = {
        period,
        metrics: [],
      };
    }
  }

  const payload = {
    ok: true,
    data: responsePayload,
  } as const;
  dashboardCache.set(cacheKey, payload, SHORT_DASHBOARD_TTL_MS);
  return NextResponse.json(payload);
}
