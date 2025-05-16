// src/app/api/dev/test-permissions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; 
import {
    fetchBasicAccountData,
    fetchInstagramMedia,
    fetchMediaInsights,
    // getInstagramConnectionDetails, // Certifique-se de que está corretamente exportado
} from '@/app/lib/instagram'; 
// Importação mais específica para getInstagramConnectionDetails, ajuste se necessário
import { getInstagramConnectionDetails } from '@/app/lib/instagram/db/userActions'; 
import { logger } from '@/app/lib/logger';
import mongoose from 'mongoose';
import UserModel from '@/app/models/User'; 
import { connectToDatabase } from '@/app/lib/mongoose';
import { BASE_URL, API_VERSION, FEED_MEDIA_INSIGHTS_METRICS } from '@/app/lib/instagram/config/instagramApiConfig';
import { FetchInsightsResult } from '@/app/lib/instagram/types'; // Importar para tipagem explícita
import { IMetricStats } from '@/app/models/Metric'; // Importar para tipagem explícita

const TAG = '[API TestPermissions]';

/**
 * Verifica se o usuário é um administrador.
 * @param userId - O ID do usuário a ser verificado.
 * @returns True se o usuário for administrador, false caso contrário.
 */
async function isAdmin(userId: string | undefined): Promise<boolean> {
    if (!userId || !mongoose.isValidObjectId(userId)) {
        logger.warn(`${TAG} isAdmin: ID de usuário inválido ou ausente: ${userId}`);
        return false;
    }
    try {
        await connectToDatabase(); 
        const user = await UserModel.findById(userId).select('role').lean();
        if (user && user.role === 'admin') {
            logger.info(`${TAG} isAdmin: Usuário ${userId} é administrador.`);
            return true;
        }
        logger.warn(`${TAG} isAdmin: Usuário ${userId} não é administrador (Role: ${user?.role}).`);
        return false;
    } catch (error) {
        logger.error(`${TAG} isAdmin: Erro ao verificar role do usuário ${userId}:`, error);
        return false;
    }
}

export async function GET(request: NextRequest) {
    logger.info(`${TAG} Recebida requisição GET para testar permissões.`);

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        logger.warn(`${TAG} Acesso não autenticado.`);
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    if (!await isAdmin(session.user.id)) {
        logger.warn(`${TAG} Usuário ${session.user.id} tentou acessar endpoint de teste de admin sem permissão.`);
        return NextResponse.json({ error: 'Não autorizado. Apenas administradores.' }, { status: 403 });
    }

    const userIdForTest = session.user.id;
    logger.info(`${TAG} Iniciando testes de permissões para o usuário administrador: ${userIdForTest}`);

    // Definindo o tipo para cada entrada em results
    type TestResultEntry = { 
        success: boolean; 
        data?: any; 
        error?: string; // string | undefined
        message?: string; // string | undefined
    };
    const results: Record<string, TestResultEntry> = {};

    try {
        if (!mongoose.isValidObjectId(userIdForTest)) {
            throw new Error("ID do usuário de teste (admin) inválido.");
        }
        await connectToDatabase();

        logger.debug(`${TAG} Buscando detalhes de conexão para ${userIdForTest}...`);
        const connectionDetails = await getInstagramConnectionDetails(new mongoose.Types.ObjectId(userIdForTest));

        if (!connectionDetails?.accountId || !connectionDetails?.accessToken) {
            const errorMsg = `Detalhes de conexão (accountId ou accessToken) não encontrados para o usuário ${userIdForTest}. Verifique se esta conta admin conectou o Instagram.`;
            logger.error(`${TAG} ${errorMsg}`);
            results['connectionDetails'] = { success: false, error: errorMsg };
            return NextResponse.json({ message: 'Testes concluídos com erros. Verifique a conexão do Instagram para o usuário admin.', results }, { status: 200 });
        }
        const { accountId, accessToken } = connectionDetails;
        logger.info(`${TAG} Usando Account ID: ${accountId} e Access Token (do usuário admin) para testes.`);
        results['connectionDetails'] = { success: true, data: { accountId, tokenSource: 'user_llat' } };

        logger.debug(`${TAG} Testando permissão: instagram_basic (via fetchBasicAccountData)...`);
        try {
            const basicDataResult = await fetchBasicAccountData(accountId, accessToken);
            results['instagram_basic'] = {
                success: basicDataResult.success,
                data: basicDataResult.data,
                error: basicDataResult.error ?? undefined, // Converte null/undefined para undefined
            };
            if (basicDataResult.success) logger.info(`${TAG} instagram_basic: SUCESSO`);
            else logger.warn(`${TAG} instagram_basic: FALHA - ${basicDataResult.error}`);
        } catch (e: any) {
            logger.error(`${TAG} instagram_basic: ERRO EXCEÇÃO - ${e.message}`);
            results['instagram_basic'] = { success: false, error: e.message };
        }

        logger.debug(`${TAG} Testando permissão: pages_show_list (via /me/accounts)...`);
        try {
            const meAccountsUrl = `${BASE_URL}/${API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${accessToken}`;
            const fbResponse = await fetch(meAccountsUrl);
            const fbData = await fbResponse.json() as any; 
            if (!fbResponse.ok || fbData.error) {
                const error = fbData.error || { message: `Erro ${fbResponse.status}`};
                logger.warn(`${TAG} pages_show_list (/me/accounts): FALHA - ${error.message}`);
                results['pages_show_list'] = { success: false, error: error.message, data: fbData };
            } else {
                logger.info(`${TAG} pages_show_list (/me/accounts): SUCESSO`);
                results['pages_show_list'] = { success: true, data: fbData.data };
            }
        } catch (e: any) {
            logger.error(`${TAG} pages_show_list (/me/accounts): ERRO EXCEÇÃO - ${e.message}`);
            results['pages_show_list'] = { success: false, error: e.message };
        }

        logger.debug(`${TAG} Testando permissões: pages_read_engagement & instagram_manage_insights...`);
        let mediaIdForInsightTest: string | null = null;
        try {
            logger.debug(`${TAG} Chamando fetchInstagramMedia para ${accountId}...`);
            const mediaResult = await fetchInstagramMedia(accountId, accessToken);
            results['fetchInstagramMedia (pages_read_engagement)'] = {
                success: mediaResult.success,
                data: mediaResult.data,
                error: mediaResult.error ?? undefined, // Converte null/undefined para undefined
                message: mediaResult.nextPageUrl === null && mediaResult.data?.length === 0 ? "Nenhuma mídia encontrada" : undefined,
            };
            if (mediaResult.success && mediaResult.data && mediaResult.data.length > 0) {
                logger.info(`${TAG} fetchInstagramMedia: SUCESSO, ${mediaResult.data.length} mídias encontradas.`);
                mediaIdForInsightTest = mediaResult.data[0]?.id ?? null;
            } else if (mediaResult.success) {
                logger.warn(`${TAG} fetchInstagramMedia: SUCESSO, mas nenhuma mídia encontrada na conta ${accountId}.`);
                if (results['fetchInstagramMedia (pages_read_engagement)']) { // Verifica se a chave existe
                    results['fetchInstagramMedia (pages_read_engagement)'].message = "Sucesso, mas nenhuma mídia encontrada.";
                }
            } else {
                logger.warn(`${TAG} fetchInstagramMedia: FALHA - ${mediaResult.error}`);
            }
        } catch (e: any) {
            logger.error(`${TAG} fetchInstagramMedia: ERRO EXCEÇÃO - ${e.message}`);
            results['fetchInstagramMedia (pages_read_engagement)'] = { success: false, error: e.message };
        }

        if (mediaIdForInsightTest) {
            logger.debug(`${TAG} Chamando fetchMediaInsights para Media ID: ${mediaIdForInsightTest} usando FEED_MEDIA_INSIGHTS_METRICS...`);
            try {
                const insightsResult: FetchInsightsResult<IMetricStats> = await fetchMediaInsights(mediaIdForInsightTest, accessToken, FEED_MEDIA_INSIGHTS_METRICS);
                // ATUALIZADO: Mapeamento explícito para corresponder ao tipo TestResultEntry
                results['fetchMediaInsights (instagram_manage_insights)'] = {
                    success: insightsResult.success,
                    data: insightsResult.data,
                    error: insightsResult.error ?? undefined, // Converte null para undefined
                    message: insightsResult.errorMessage ?? undefined, // Mapeia errorMessage para message
                };
                if (insightsResult.success) logger.info(`${TAG} fetchMediaInsights: SUCESSO`);
                else logger.warn(`${TAG} fetchMediaInsights: FALHA - ${insightsResult.error} (Msg: ${insightsResult.errorMessage})`);
            } catch (e: any) {
                logger.error(`${TAG} fetchMediaInsights: ERRO EXCEÇÃO - ${e.message}`);
                results['fetchMediaInsights (instagram_manage_insights)'] = { success: false, error: e.message };
            }
        } else {
            const msg = "Nenhuma mídia encontrada para testar insights.";
            results['fetchMediaInsights (instagram_manage_insights)'] = { success: true, message: msg }; 
            logger.warn(`${TAG} fetchMediaInsights: PULADO - ${msg}`);
        }

        logger.info(`${TAG} Testes de permissões concluídos para o usuário: ${userIdForTest}`);
        return NextResponse.json({ message: 'Testes de API para permissões concluídos.', results }, { status: 200 });

    } catch (error: any) {
        logger.error(`${TAG} Erro geral ao executar testes de permissões:`, error);
        results['general_error'] = { success: false, error: error.message };
        return NextResponse.json({
            message: 'Erro crítico ao executar testes de permissões.',
            error: error.message,
            results
        }, { status: 500 });
    }
}
