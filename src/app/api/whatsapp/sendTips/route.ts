import { NextRequest, NextResponse } from "next/server";
import { getServerSession }          from "next-auth/next";
import { authOptions }               from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase }         from "@/app/lib/mongoose";
import User                           from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import { callOpenAIForTips }         from "@/app/lib/aiService";   // agora EXISTE
import { sendWhatsAppMessage }       from "@/app/lib/whatsappService";
import { Model, Types }              from "mongoose";

/* ────────────────────────────────────────────────────────── *
 * Tipos auxiliares                                           *
 * ────────────────────────────────────────────────────────── */
interface ReportResult { userId: string; success: boolean }

interface DailyMetricDoc {
  stats?: { curtidas?: number };
}

interface TipsData {
  titulo?: string;           // “💡 Dicas da Semana”…
  dicas ?: string[];         // lista com os bullets
}

/* ------------------------------------------------------------------ */
export const runtime = "nodejs";

/* -------- envio WhatsApp, com +55 normalizado --------------------- */
async function safeSendWhatsAppMessage(phone: string, body: string) {
  if (!phone.startsWith("+")) phone = "+" + phone;
  try   { await sendWhatsAppMessage(phone, body) }
  catch (err) { console.error("[sendTips] Falha WhatsApp", { phone, err }); }
}

/* -------- agregação simplificada (7 dias) ------------------------- */
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
   Envia dicas semanais a todos os usuários com plano ativo
   ================================================================== */
export async function POST(request: NextRequest) {
  const tag = "[whatsapp/sendTips]";

  /* 1. Autenticação (caso use sessão) ------------------------------ */
  const session = await getServerSession({ req: request, ...authOptions });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  /* 2. DB ----------------------------------------------------------- */
  await connectToDatabase();

  const users = await User.find({
    planStatus   : "active",
    whatsappPhone: { $exists: true, $ne: null }
  }).lean();

  if (!users.length) {
    return NextResponse.json({ message: "Nenhum usuário ativo com WhatsApp." }, { status: 200 });
  }

  /* 3. Janela de 7 dias -------------------------------------------- */
  const to   = new Date();
  const from = new Date(); from.setDate(to.getDate() - 7);

  /* 4. Processa todos em paralelo ---------------------------------- */
  const results = await Promise.allSettled<ReportResult>(
    users.map(async u => {
      const userId = u._id?.toString() ?? "UNKNOWN";
      try {
        /* 4a. coleta curtidas simplificadas */
        const dailyModel = DailyMetric as Model<IDailyMetric>;
        const dms: DailyMetricDoc[] = await dailyModel.find({
          user    : new Types.ObjectId(userId),
          postDate: { $gte: from }
        }).select("stats.curtidas").lean();

        if (!dms.length) return { userId, success: false };

        /* 4b. agrega & chama IA                                         */
        const weekly = aggregateWeeklyMetrics(dms);

        const rawTips = await callOpenAIForTips(JSON.stringify(weekly));
        let tips: TipsData;

        try           { tips = typeof rawTips === "string" ? JSON.parse(rawTips) : rawTips as TipsData; }
        catch (e)     {
          console.warn(`${tag} IA retornou texto não‑JSON p/ ${userId}:`, rawTips);
          tips = { dicas: [String(rawTips)] };
        }

        /* 4c. monta e envia WhatsApp                                    */
        if (u.whatsappPhone) {
          await safeSendWhatsAppMessage(u.whatsappPhone, formatTipsMessage(tips));
          return { userId, success: true };
        }
        return { userId, success: false };

      } catch (err) {
        console.error(`${tag} erro p/ ${userId}`, err);
        return { userId, success: false };
      }
    })
  );

  const ok = results.filter(r => r.status === "fulfilled" && r.value.success).length;
  return NextResponse.json({ message: `Dicas enviadas a ${ok} usuários.` }, { status: 200 });
}
