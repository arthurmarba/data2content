// src/app/api/whatsapp/sendTips/route.ts

import { NextRequest, NextResponse } from "next/server";
import { guardPremiumRequest } from "@/app/lib/planGuard";
import { getServerSession } from "next-auth/next";
import { connectToDatabase } from "@/app/lib/mongoose";
import User, { type IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import { callOpenAIForTips } from "@/app/lib/aiService";
import { sendTemplateMessage } from "@/app/lib/whatsappService";
import { Model, Types, type FilterQuery } from "mongoose";
import { isActiveLike, type ActiveLikeStatus } from "@/app/lib/isActiveLike";
import Alert from "@/app/models/Alert";
import ruleEngineInstance from '@/app/lib/ruleEngine';
import { getFallbackInsight } from '@/app/lib/fallbackInsightService';
import { getDialogueState } from '@/app/lib/stateService';
import { fetchAndPrepareReportData, getLatestAccountInsights, lookupUserById } from '@/app/lib/dataService';
import { IUserModel } from "@/app/lib/fallbackInsightService/fallbackInsight.types";

/* ────────────────────────────────────────────────────────── *
 * Tipos auxiliares                                           *
 * ────────────────────────────────────────────────────────── */
interface ReportResult { userId: string; success: boolean; delivered: boolean }

interface DailyMetricDoc {
  stats?: { curtidas?: number };
}

interface TipsData {
  titulo?: string;           // “💡 Dicas da Semana”…
  dicas?: string[];         // lista com os bullets
}

async function recordAlertForUser(userId: string, tips: TipsData, messageText: string, alertId: Types.ObjectId) {
  try {
    await Alert.create({
      _id: alertId,
      user: userId,
      title: tips.titulo || "Dicas da Semana",
      body: messageText,
      channel: "system",
      severity: "info",
      metadata: {
        source: "whatsapp_sendTips",
      },
    });
  } catch (error) {
    console.warn("[sendTips] Falha ao registrar alerta em Alert collection", error);
  }
}

/* ------------------------------------------------------------------ */
export const runtime = "nodejs";

async function resolveAuthOptions() {
  if (process.env.NODE_ENV === 'test') return {};
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  return (mod as any)?.authOptions ?? {};
}

/* -------- envio WhatsApp, com +55 normalizado --------------------- */
async function sendTipsTemplate(phone: string, tips: TipsData) {
  const templateName = process.env.WHATSAPP_TIPS_TEMPLATE || "d2c_daily_tip";
  const bodyText = formatTipsMessage(tips);
  await sendTemplateMessage(phone, templateName, [
    {
      type: "body",
      parameters: [{ type: "text", text: bodyText }],
    },
  ]);
}

/* -------- agregação simplificada (7 dias) ------------------------- */
function aggregateWeeklyMetrics(dms: DailyMetricDoc[]) {
  const totalCurts = dms.reduce((sum, dm) => sum + (dm.stats?.curtidas ?? 0), 0);
  const totalPosts = dms.length;
  return { totalPosts, avgCurtidas: totalPosts ? totalCurts / totalPosts : 0 };
}

/* -------- formata o texto final ---------------------------------- */
function formatTipsMessage({ titulo = "💡 Dicas da Semana", dicas = [] }: TipsData) {
  let msg = `*${titulo}*\n\n`;
  if (dicas.length) {
    dicas.forEach((d, i) => { msg += `${i + 1}. ${d}\n`; });
  } else {
    // Caso de fallback genérico se vier vazio, mas o código deve evitar isso.
    msg += "Nenhuma dica específica para esta semana. Continue postando! 🚀\n";
  }
  return msg + "\nBons posts e até a próxima! ✨";
}

/* ==================================================================
   POST /api/whatsapp/sendTips
   Envia dicas semanais a todos os usuários com plano ativo-like
   (active | non_renewing | trial | trialing) e WhatsApp verificado
   PRIORIDADE:
   1. Rule Engine (Alertas específicos ex: Pico de Shares)
   2. Fallback Service (Insights de métricas ex: Crescimento de seguidores)
   3. Genérico OpenAI (Dicas gerais baseadas em média semanal)
   ================================================================== */
export async function POST(request: NextRequest) {
  const guardResponse = await guardPremiumRequest(request);
  if (guardResponse) return guardResponse;

  const tag = "[whatsapp/sendTips]";

  /* 1) Autenticação da chamada */
  const authOptions = await resolveAuthOptions();
  const session = (await getServerSession({ req: request, ...authOptions })) as { user?: { id?: string } } | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  /* 2) DB */
  await connectToDatabase();

  const now = new Date();
  const trialWindowFilter: FilterQuery<IUser> = {
    $or: [
      { whatsappTrialActive: { $ne: true } },
      {
        whatsappTrialActive: true,
        whatsappTrialExpiresAt: { $gt: now },
      },
    ],
  };
  const ACTIVE_LIKE: ActiveLikeStatus[] = [
    "active",
    "non_renewing",
    "trial",
    "trialing",
  ].filter(isActiveLike);

  const users = await User.find({
    planStatus: { $in: ACTIVE_LIKE },
    ...trialWindowFilter,
  }).lean();

  if (!users.length) {
    return NextResponse.json({ message: "Nenhum usuário elegível para receber dicas." }, { status: 200 });
  }

  /* 3) Janela de 7 dias para o cálculo genérico (se necessário) */
  const to = new Date();
  const from = new Date(); from.setDate(to.getDate() - 7);

  /* 4) Processa todos em paralelo */
  const results = await Promise.allSettled<ReportResult>(
    users.map<Promise<ReportResult>>(async (uLean) => {
      const userId = uLean._id?.toString() ?? "UNKNOWN";
      try {
        const dialogueState = await getDialogueState(userId);
        let tips: TipsData | null = null;
        let source: string = 'generic_openai';

        // --- TIER 1: RULE ENGINE ---
        const ruleEvent = await ruleEngineInstance.runAllRules(userId, dialogueState);

        if (ruleEvent) {
          // Detectamos evento específico!
          tips = {
            titulo: `🔔 ${(ruleEvent.detailsForLog as any).title || 'Alerta Importante'}`,
            dicas: [ruleEvent.messageForAI] // Usamos a mensagem gerada como o "corpo" da dica
          };
          source = `rule_engine:${ruleEvent.type}`;
        }

        // --- TIER 2: FALLBACK INSIGHT SERVICE ---
        if (!tips) {
          // Converter lean user p/ IUserModel type se necessário ou buscar full via dataService se faltar campos
          // Para segurança, vamos buscar via dataService que já retorna tipado corretamente
          let fullUser: IUserModel | null = null;
          try {
            fullUser = await lookupUserById(userId);
          } catch (e) { console.warn(`${tag} user lookup failed`, e); }

          if (fullUser) {
            const [reportData, accountInsights] = await Promise.all([
              fetchAndPrepareReportData({ user: fullUser as any }), // defaults
              getLatestAccountInsights(userId)
            ]);

            const fallback = await getFallbackInsight(fullUser, reportData.enrichedReport, accountInsights, dialogueState);
            if (fallback.text && fallback.type) {
              tips = {
                titulo: "💡 Insight da Semana",
                dicas: [fallback.text]
              };
              source = `fallback_insight:${fallback.type}`;
            }
          }
        }

        // --- TIER 3: GENERIC OPENAI (Existing Logic) ---
        if (!tips) {
          const dailyModel = DailyMetric as Model<IDailyMetric>;
          const dms: DailyMetricDoc[] = await dailyModel
            .find({
              user: new Types.ObjectId(userId),
              postDate: { $gte: from }
            })
            .select("stats.curtidas")
            .lean();

          if (!dms.length) return { userId, success: false, delivered: false };

          const weekly = aggregateWeeklyMetrics(dms);
          const rawTips = await callOpenAIForTips(JSON.stringify(weekly));
          try {
            tips = typeof rawTips === "string" ? JSON.parse(rawTips) : (rawTips as TipsData);
          } catch (e) {
            console.warn(`${tag} IA retornou texto não-JSON p/ ${userId}:`, rawTips);
            tips = { dicas: [String(rawTips)] };
          }
          source = 'generic_openai_weekly';
        }

        if (!tips) {
          // Se falhar tudo (ex: sem posts recentes para generic), ignora
          return { userId, success: false, delivered: false };
        }

        // 4c) monta mensagem com link deep e registra alerta na plataforma
        const alertId = new Types.ObjectId();
        const baseMessage = formatTipsMessage(tips);
        const link = `\n\n💬 Continuar conversa: https://data2content.ai/dashboard/chat?alertId=${alertId.toString()}`;
        const messageText = baseMessage + link;

        // Log source for debugging
        console.log(`${tag} sending to ${userId} via ${source}`);
        await recordAlertForUser(userId, tips, messageText, alertId);

        // 4d) envia WhatsApp se houver número; caso contrário, apenas registra
        let delivered = false;
        if (uLean.whatsappOptOut) {
          console.warn(`${tag} Usuário em opt-out; não enviando WhatsApp`, { userId });
        } else if (uLean.whatsappPhone && uLean.whatsappVerified) {
          await sendTipsTemplate(uLean.whatsappPhone, tips);
          delivered = true;
        }

        return { userId, success: true, delivered };

      } catch (err) {
        console.error(`${tag} erro p/ ${userId}`, err);
        return { userId, success: false, delivered: false };
      }
    })
  );

  const ok = results.filter(r => r.status === "fulfilled" && r.value.success).length;
  const delivered = results.filter(r => r.status === "fulfilled" && r.value.delivered).length;
  return NextResponse.json({ message: `Alertas gerados para ${ok} usuários. WhatsApp enviado para ${delivered}.` }, { status: 200 });
}
