// src/app/api/whatsapp/sendTips/route.ts
import { NextRequest, NextResponse } from "next/server";
import { guardPremiumRequest }        from "@/app/lib/planGuard";
import { getServerSession }           from "next-auth/next";
import { connectToDatabase }          from "@/app/lib/mongoose";
import User, { type IUser }          from "@/app/models/User";
import { DailyMetric, IDailyMetric }  from "@/app/models/DailyMetric";
import { callOpenAIForTips }          from "@/app/lib/aiService";
import { sendWhatsAppMessage }        from "@/app/lib/whatsappService";
import { Model, Types, type FilterQuery } from "mongoose";
import { isActiveLike, type ActiveLikeStatus } from "@/app/lib/isActiveLike";
import Alert from "@/app/models/Alert";

/* ────────────────────────────────────────────────────────── *
 * Tipos auxiliares                                           *
 * ────────────────────────────────────────────────────────── */
interface ReportResult { userId: string; success: boolean; delivered: boolean }

interface DailyMetricDoc {
  stats?: { curtidas?: number };
}

interface TipsData {
  titulo?: string;           // “💡 Dicas da Semana”…
  dicas ?: string[];         // lista com os bullets
}

async function recordAlertForUser(userId: string, tips: TipsData, messageText: string) {
  try {
    await Alert.create({
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
async function safeSendWhatsAppMessage(phone: string, body: string) {
  if (!phone.startsWith("+")) phone = "+" + phone;
  try   { await sendWhatsAppMessage(phone, body) }
  catch (err) { console.error("[sendTips] Falha WhatsApp", { phone, err }); }
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
    msg += "Nenhuma dica específica para esta semana. Continue postando! 🚀\n";
  }
  return msg + "\nBons posts e até a próxima! ✨";
}

/* ==================================================================
   POST /api/whatsapp/sendTips
   Envia dicas semanais a todos os usuários com plano ativo-like
   (active | non_renewing | trial | trialing) e WhatsApp verificado
   ================================================================== */
export async function POST(request: NextRequest) {
  const guardResponse = await guardPremiumRequest(request);
  if (guardResponse) return guardResponse;

  const tag = "[whatsapp/sendTips]";

  /* 1) Autenticação da chamada (ex.: proteger para staff/admin) */
  const authOptions = await resolveAuthOptions();
  const session = (await getServerSession({ req: request, ...authOptions })) as { user?: { id?: string } } | null;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  /* 2) DB */
  await connectToDatabase();

  // ✅ Considera active-like; envia pelo WhatsApp quando possível, mas registra alerta mesmo sem telefone
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

  /* 3) Janela de 7 dias */
  const to   = new Date();
  const from = new Date(); from.setDate(to.getDate() - 7);

  /* 4) Processa todos em paralelo */
  const results = await Promise.allSettled<ReportResult>(
    users.map<Promise<ReportResult>>(async u => {
      const userId = u._id?.toString() ?? "UNKNOWN";
      try {
        // 4a) coleta curtidas simplificadas
        const dailyModel = DailyMetric as Model<IDailyMetric>;
        const dms: DailyMetricDoc[] = await dailyModel
          .find({
            user: new Types.ObjectId(userId),
            postDate: { $gte: from } // últimos 7 dias
          })
          .select("stats.curtidas")
          .lean();

        if (!dms.length) return { userId, success: false, delivered: false };

        // 4b) agrega & chama IA
        const weekly = aggregateWeeklyMetrics(dms);

        const rawTips = await callOpenAIForTips(JSON.stringify(weekly));
        let tips: TipsData;
        try {
          tips = typeof rawTips === "string" ? JSON.parse(rawTips) : (rawTips as TipsData);
        } catch (e) {
          console.warn(`${tag} IA retornou texto não-JSON p/ ${userId}:`, rawTips);
          tips = { dicas: [String(rawTips)] };
        }

        // 4c) monta mensagem e registra alerta na plataforma
        const messageText = formatTipsMessage(tips);
        await recordAlertForUser(userId, tips, messageText);

        // 4d) envia WhatsApp se houver número; caso contrário, apenas registra
        let delivered = false;
        if (u.whatsappPhone && u.whatsappVerified) {
          await safeSendWhatsAppMessage(u.whatsappPhone, messageText);
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
