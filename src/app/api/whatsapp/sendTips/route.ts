import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import { callOpenAIForTips } from "@/app/lib/aiService";
// import { generateReport, AggregatedMetrics } from "@/app/lib/reportService"; // <<< REMOVIDO
import { sendWhatsAppMessage } from "@/app/lib/whatsappService";
import { Model, Types } from "mongoose";

// Tipos específicos para este arquivo (ou podem vir de um arquivo de tipos comum)
interface ReportResult {
    userId: string;
    success: boolean;
}

interface DailyMetricDoc {
    stats?: {
        curtidas?: number;
        // Adicionar outros campos se aggregateWeeklyMetrics precisar deles
    };
    // Adicionar outros campos de IDailyMetric se aggregateWeeklyMetrics precisar
}

interface TipsData {
    titulo?: string;
    dicas?: string[];
}


export const runtime = "nodejs";

/**
 * Função auxiliar para enviar mensagem via WhatsApp com tratamento de erros.
 */
async function safeSendWhatsAppMessage(phone: string, body: string) {
    // Garante que o "+" está presente para a API do WhatsApp
    if (!phone.startsWith("+")) {
        phone = "+" + phone;
    }
    try {
        await sendWhatsAppMessage(phone, body);
    } catch (error: unknown) {
        // Loga o erro mas não interrompe o processo para outros usuários
        console.error(`Falha ao enviar WhatsApp para ${phone}:`, error);
    }
}


/**
 * Agrega as métricas dos últimos 7 dias, calculando o total de curtidas e a média por post.
 * ATENÇÃO: Esta é uma agregação MUITO SIMPLES, usada apenas para gerar DICAS.
 * Ela difere da agregação completa feita em reportHelpers.ts.
 */
function aggregateWeeklyMetrics(dailyMetrics: DailyMetricDoc[]): { totalPosts: number, avgCurtidas: number } {
    let totalCurtidas = 0;
    const totalPosts = dailyMetrics.length;

    dailyMetrics.forEach((dm) => {
        // Acessa stats.curtidas com segurança
        totalCurtidas += dm.stats?.curtidas ?? 0; // Usa nullish coalescing
    });

    // Calcula a média, tratando divisão por zero
    const avgCurtidas = totalPosts > 0 ? totalCurtidas / totalPosts : 0;

    // Retorna um objeto simples compatível com Record<string, unknown>
    return { totalPosts, avgCurtidas };
}


/**
 * Formata a mensagem final para enviar no WhatsApp a partir do objeto de dicas.
 */
function formatTipsMessage(tipsData: TipsData): string {
    const titulo = tipsData.titulo || "💡 Dicas da Semana"; // Título padrão
    const dicas = tipsData.dicas || [];
    let msg = `*${titulo}*\n\n`; // Usa markdown do WhatsApp para negrito

    if (dicas.length > 0) {
        dicas.forEach((d, i) => {
            // Formata como lista numerada
            msg += `${i + 1}. ${d}\n`;
        });
    } else {
        msg += "Nenhuma dica específica para esta semana, continue postando!\n"; // Mensagem caso não haja dicas
    }

    // Adiciona uma finalização padrão
    msg += "\nBons posts e até a próxima! ✨";
    return msg;
}


/**
 * POST /api/whatsapp/sendTips (ou o caminho correto do seu arquivo)
 * Envia DICAS semanais via WhatsApp para todos os usuários com plano ativo e número de WhatsApp cadastrado.
 * Esta rota usa uma agregação SIMPLES e a função callOpenAIForTips.
 */
export async function POST(request: NextRequest) {
    // Usar um identificador de log mais específico para esta rota
    const logPrefix = "[whatsapp/sendTips]";

    try {
        // Verifica autenticação
        const session = await getServerSession({ req: request, ...authOptions });
        console.debug(`${logPrefix} Sessão:`, session); // Adicionado prefixo
        if (!session?.user?.id) {
            // Idealmente, esta rota deveria ser protegida de outra forma se for chamada por CRON
            // Mas mantendo a lógica original por enquanto.
            console.warn(`${logPrefix} Tentativa de acesso não autenticada.`);
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        // Conecta ao banco de dados
        await connectToDatabase();
        console.debug(`${logPrefix} Conectado ao DB.`);

        // Busca usuários ativos com WhatsApp cadastrado
        const users = await User.find({
            planStatus: "active",
            whatsappPhone: { $ne: null, $exists: true } // Garante que o campo existe e não é nulo
        }).lean(); // Usar lean para performance
        console.debug(`${logPrefix} Usuários encontrados: ${users.length}`);

        if (!users.length) {
            return NextResponse.json(
                { message: "Nenhum usuário ativo com WhatsApp cadastrado para receber dicas." },
                { status: 200 }
            );
        }

        // Define o período para os dados: últimos 7 dias
        const now = new Date();
        const fromDate = new Date();
        fromDate.setDate(now.getDate() - 7);
        console.debug(`${logPrefix} Período de análise para dicas:`, fromDate, "até", now);

        // Processa os usuários de forma concorrente
        const results = await Promise.allSettled<ReportResult>(
            users.map(async (user) => {
                 // Assegura que user._id existe e é do tipo correto antes de converter
                 if (!user?._id) {
                    console.error(`${logPrefix} Usuário inválido encontrado (sem _id):`, user);
                    return { userId: 'INVALID_USER', success: false };
                }
                const userId = user._id.toString();

                try {
                    console.debug(`${logPrefix} Iniciando processamento de dicas para usuário ${userId}`);
                    const dailyMetricModel = DailyMetric as Model<IDailyMetric>;

                    // Busca apenas os campos necessários para aggregateWeeklyMetrics
                    const dailyMetrics: DailyMetricDoc[] = await dailyMetricModel.find({
                        user: new Types.ObjectId(userId), // Converte para ObjectId se necessário
                        postDate: { $gte: fromDate },
                    })
                    .select('stats.curtidas') // Seleciona apenas o necessário
                    .lean();

                    console.debug(`${logPrefix} ${dailyMetrics.length} métricas (curtidas) carregadas para usuário ${userId}`);

                    // Se não houver métricas, pula o envio das dicas
                    if (!dailyMetrics.length) {
                        console.warn(`${logPrefix} Nenhuma métrica encontrada para o usuário ${userId}. Dicas não geradas.`);
                        // Considera sucesso=false pois nenhuma dica foi enviada
                        return { userId, success: false };
                    }

                    // Agrega as métricas (agregação simples de curtidas)
                    const aggregated = aggregateWeeklyMetrics(dailyMetrics);
                    console.debug(`${logPrefix} Dados agregados (simples) para usuário ${userId}:`, aggregated);

                    // Chama a IA específica para gerar DICAS (espera JSON)
                    // Passa o objeto agregado simples (compatível com Record<string, unknown>)
                    const tipsData: TipsData = await callOpenAIForTips(aggregated);
                    console.debug(`${logPrefix} Dicas (JSON) recebidas da IA para usuário ${userId}:`, tipsData);


                    // Formata e envia a mensagem via WhatsApp
                    const msg = formatTipsMessage(tipsData);

                    if (user.whatsappPhone) {
                        await safeSendWhatsAppMessage(user.whatsappPhone, msg);
                        console.log(`${logPrefix} Dicas enviadas para userId=${userId}, phone=${user.whatsappPhone}`);
                        return { userId, success: true };
                    } else {
                        // Este caso não deveria ocorrer devido ao filtro inicial, mas é uma segurança extra
                        console.warn(`${logPrefix} Usuário ${userId} passou pelo filtro mas não possui número de WhatsApp no objeto.`);
                        return { userId, success: false };
                    }
                } catch (error: unknown) {
                    console.error(`${logPrefix} Erro ao processar dicas para userId=${userId}:`, error);
                    return { userId, success: false };
                }
            })
        );

        // Conta os envios bem-sucedidos
        const countSends = results.filter(
            (r) => r.status === "fulfilled" && r.value.success
        ).length;
        console.debug(`${logPrefix} Total de DICAS enviadas com sucesso: ${countSends}`);

        return NextResponse.json(
            { message: `Dicas enviadas para ${countSends} usuários.` },
            { status: 200 }
        );
    } catch (error: unknown) {
        console.error(`Erro em ${logPrefix}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}