// src/app/lib/instagram/api/accountDiscovery.ts
import fetch, { Response as FetchResponse } from 'node-fetch';
import mongoose from 'mongoose';
import retry from 'async-retry';
import { logger } from '@/app/lib/logger';
import {
  API_VERSION,
  BASE_URL,
  RETRY_OPTIONS,
  MAX_ACCOUNT_FETCH_PAGES,
  ACCOUNT_FETCH_DELAY_MS
} from '../config/instagramApiConfig';
import {
  AvailableInstagramAccount,
  FetchInstagramAccountsResult,
  FetchInstagramAccountsError,
  InstagramApiResponse,
  FacebookApiError,
  FacebookApiErrorStructure,
} from '../types';
import { isTokenInvalidError } from '../utils/tokenUtils';
// ATUALIZAÇÃO DA IMPORTAÇÃO para usar o alias do módulo principal
import { clearInstagramConnection } from '@/app/lib/instagram'; 

// Tipo local para dados de página, como no original
type PageAccountData = {
  id: string; // Page ID
  name: string; // Page Name
  access_token?: string; // Page Access Token (geralmente não usado diretamente para IG)
  instagram_business_account?: {
    id: string; // Instagram Business Account ID
    username?: string;
    profile_picture_url?: string; 
  };
};


/**
 * Busca as contas Instagram profissionais (Business/Creator) disponíveis para um usuário
 * associadas às suas Páginas do Facebook e obtém um Token de Acesso de Longa Duração (LLAT) do usuário.
 *
 * Prioriza o uso de um System User Token e Business ID para listar páginas, se configurado.
 * Caso contrário, usa o LLAT do usuário para listar páginas via /me/accounts.
 *
 * @param shortLivedUserAccessToken - O token de acesso de curta duração do Facebook do usuário.
 * @param userId - O ID do usuário no sistema Data2Content.
 * @returns Uma promessa que resolve para FetchInstagramAccountsResult ou FetchInstagramAccountsError.
 */
export async function fetchAvailableInstagramAccounts(
  shortLivedUserAccessToken: string, 
  userId: string 
): Promise<FetchInstagramAccountsResult | FetchInstagramAccountsError> {
  const TAG = '[fetchAvailableInstagramAccounts v2.0]'; 
  logger.info(`${TAG} Iniciando busca de contas IG e LLAT para User ID: ${userId}.`);

  if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
    const errorMsg = "FACEBOOK_CLIENT_ID ou FACEBOOK_CLIENT_SECRET não definidos nas variáveis de ambiente.";
    logger.error(`${TAG} ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  if (!mongoose.isValidObjectId(userId)) {
    const errorMsg = `ID de usuário inválido fornecido: ${userId}`;
    logger.error(`${TAG} ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  if (!shortLivedUserAccessToken) {
    const errorMsg = `Token de curta duração do usuário (shortLivedUserAccessToken) não fornecido.`;
    logger.error(`${TAG} ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  let userLongLivedAccessToken: string | null = null;

  try {
    logger.debug(`${TAG} Tentando obter LLAT do usuário ${userId}...`);
    const llatUrl = `${BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${shortLivedUserAccessToken}`;

    const llatResponseData = await retry(async (bail, attemptNum) => {
      if (attemptNum > 1) logger.warn(`${TAG} Tentativa ${attemptNum} para obter LLAT do usuário.`);
      const response: FetchResponse = await fetch(llatUrl);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
          const responseText = await response.text().catch(() => 'Falha ao ler corpo da resposta não-JSON.');
          logger.error(`${TAG} Resposta não-JSON (Status: ${response.status}) ao obter LLAT. Conteúdo: ${responseText.substring(0,200)}`);
          bail(new Error(`API retornou resposta não-JSON (Status: ${response.status}) ao obter LLAT.`));
          return null; 
      }
      const data: { access_token?: string; token_type?: string; expires_in?: number; } & FacebookApiError = await response.json();

      if (!response.ok || data.error || !data.access_token) {
        const errorDetail = data.error || { message: `Erro ${response.status} ao obter LLAT (access_token ausente)`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
        logger.error(`${TAG} Erro API (Tentativa ${attemptNum}) ao obter LLAT do usuário:`, JSON.stringify(errorDetail));
        if (response.status === 400 || isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
          bail(new Error(errorDetail.message || 'Falha ao obter token de longa duração (SLT inválido/expirado?).'));
          return null; 
        }
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          bail(new Error(errorDetail.message || `Falha não recuperável (${response.status}) ao obter LLAT.`));
          return null; 
        }
        throw new Error(errorDetail.message || `Erro temporário ${response.status} ao obter LLAT.`);
      }
      return data;
    }, RETRY_OPTIONS);

    if (!llatResponseData || !llatResponseData.access_token) {
        throw new Error('Falha ao obter access_token do LLAT após retentativas.');
    }

    userLongLivedAccessToken = llatResponseData.access_token;
    logger.info(`${TAG} LLAT do usuário ${userId} obtido com sucesso.`);
  } catch (llatError: any) {
    logger.error(`${TAG} Falha CRÍTICA ao obter LLAT do usuário ${userId}:`, llatError);
    if (llatError.message && (llatError.message.toLowerCase().includes('token') || isTokenInvalidError(undefined, undefined, llatError.message))) {
      logger.warn(`${TAG} Erro de token ao obter LLAT. Limpando conexão IG existente (se houver) para User ${userId}.`);
      await clearInstagramConnection(userId); 
    }
    return { success: false, error: `Falha ao obter token de acesso de longa duração necessário: ${llatError.message}` };
  }

  const businessId = process.env.FACEBOOK_BUSINESS_ID;
  const systemUserToken = process.env.FB_SYSTEM_USER_TOKEN;

  try {
    let allPagesData: PageAccountData[] = [];
    let fetchError: Error | null = null;
    let fetchLogContext: string;

    if (businessId && systemUserToken) {
      fetchLogContext = `${TAG} (System User Flow)`;
      logger.info(`${fetchLogContext} Utilizando System User Token e Business ID (${businessId}) para listar páginas.`);
      let currentPageUrl: string | null = `${BASE_URL}/${API_VERSION}/${businessId}/owned_pages?fields=id,name,instagram_business_account{id,username,profile_picture_url}&limit=50&access_token=${systemUserToken}`;
      let pageCount = 0;

      while (currentPageUrl && pageCount < MAX_ACCOUNT_FETCH_PAGES) {
        pageCount++;
        logger.debug(`${fetchLogContext} Buscando página ${pageCount}/${MAX_ACCOUNT_FETCH_PAGES} de /owned_pages...`);
        try {
          const pageResponse = await retry(async (bail, attemptNum) => {
            if (attemptNum > 1) logger.warn(`${fetchLogContext} Tentativa ${attemptNum} pág ${pageCount} /owned_pages.`);
            const response: FetchResponse = await fetch(currentPageUrl!);
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) { bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; }
            const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json();
            if (!response.ok || data.error) {
              const errorDetail: FacebookApiErrorStructure = data.error || { message: `Erro ${response.status} pág ${pageCount}`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
              logger.error(`${fetchLogContext} Erro API (Tentativa ${attemptNum}) pág ${pageCount}:`, JSON.stringify(errorDetail));
              if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) { bail(new Error('System User Token inválido/expirado.')); return null; }
              if (errorDetail.code === 10 || errorDetail.code === 200) { bail(new Error('Permissão insuficiente para System User (business_management, pages_show_list, etc.).')); return null; }
              if (errorDetail.code === 100 && errorDetail.message.includes("Unsupported get request")) { bail(new Error(`Business ID (${businessId}) inválido ou não acessível pelo System User Token.`)); return null; }
              if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount} /owned_pages: ${errorDetail.message}`)); return null; }
              throw new Error(errorDetail.message || `Erro temp ${response.status} pág ${pageCount}.`);
            }
            return data;
          }, { ...RETRY_OPTIONS, retries: 2 }); 

          if (pageResponse?.data) { allPagesData.push(...pageResponse.data); }
          currentPageUrl = pageResponse?.paging?.next ?? null;
          if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
        } catch (error) {
          fetchError = error instanceof Error ? error : new Error(String(error));
          logger.error(`${fetchLogContext} Erro irrecuperável durante paginação /owned_pages (pág ${pageCount}):`, fetchError);
          currentPageUrl = null; 
        }
      }
      if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${fetchLogContext} Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /owned_pages atingido.`);
      if (fetchError) return { success: false, error: `Erro ao buscar páginas via System User: ${fetchError.message}` };

    } else {
      fetchLogContext = `${TAG} (User LLAT Flow)`;
      logger.info(`${fetchLogContext} Utilizando User LLAT e /me/accounts para listar contas.`);
      if (!userLongLivedAccessToken) {
        logger.error(`${fetchLogContext} LLAT do usuário não disponível para o fluxo de /me/accounts.`);
        return { success: false, error: "Token de longa duração do usuário indisponível para listar contas." };
      }
      let currentPageUrl: string | null = `${BASE_URL}/${API_VERSION}/me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url}&limit=50&access_token=${userLongLivedAccessToken}`;
      let pageCount = 0;

      while (currentPageUrl && pageCount < MAX_ACCOUNT_FETCH_PAGES) {
        pageCount++;
        logger.debug(`${fetchLogContext} Buscando página ${pageCount}/${MAX_ACCOUNT_FETCH_PAGES} de /me/accounts...`);
        try {
          const pageResponse = await retry(async (bail, attemptNum) => {
            if (attemptNum > 1) logger.warn(`${fetchLogContext} Tentativa ${attemptNum} pág ${pageCount} /me/accounts.`);
            const response: FetchResponse = await fetch(currentPageUrl!);
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) { bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; }
            const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json();
            if (!response.ok || data.error) {
              const errorDetail: FacebookApiErrorStructure = data.error || { message: `Erro ${response.status} pág ${pageCount}`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
              logger.error(`${fetchLogContext} Erro API (Tentativa ${attemptNum}) pág ${pageCount}:`, JSON.stringify(errorDetail));
              if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) { bail(new Error('Token de longa duração (LLAT) do usuário inválido/expirado.')); return null; }
              if (errorDetail.code === 10) { bail(new Error('Permissão `pages_show_list` ausente para o usuário.')); return null; }
              if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCount} /me/accounts: ${errorDetail.message}`)); return null; }
              throw new Error(errorDetail.message || `Erro temp ${response.status} pág ${pageCount}.`);
            }
            return data;
          }, { ...RETRY_OPTIONS, retries: 2 });

          if (pageResponse?.data) { allPagesData.push(...pageResponse.data); }
          currentPageUrl = pageResponse?.paging?.next ?? null;
          if (currentPageUrl) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
        } catch (error) {
          fetchError = error instanceof Error ? error : new Error(String(error));
          logger.error(`${fetchLogContext} Erro irrecuperável durante paginação /me/accounts (pág ${pageCount}):`, fetchError);
          currentPageUrl = null; 
        }
      }
      if (pageCount >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrl) logger.warn(`${fetchLogContext} Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /me/accounts atingido.`);
      if (fetchError) {
        if (fetchError.message && (fetchError.message.toLowerCase().includes('token') || isTokenInvalidError(undefined, undefined, fetchError.message))) {
          logger.warn(`${fetchLogContext} Erro de token ao listar contas com User LLAT. Limpando conexão IG para User ${userId}.`);
          await clearInstagramConnection(userId);
        }
        return { success: false, error: `Erro ao buscar páginas via User LLAT: ${fetchError.message}` };
      }
    }

    logger.info(`${fetchLogContext} Busca paginada de contas FB concluída. ${allPagesData.length} Páginas FB encontradas.`);
    const availableIgAccounts: AvailableInstagramAccount[] = [];
    for (const page of allPagesData) {
      if (page.instagram_business_account?.id) {
        availableIgAccounts.push({
          igAccountId: page.instagram_business_account.id,
          pageId: page.id,
          pageName: page.name,
          username: page.instagram_business_account.username,
          profile_picture_url: page.instagram_business_account.profile_picture_url,
        });
      }
    }

    if (availableIgAccounts.length === 0) {
      const errorMsg = "Nenhuma conta profissional do Instagram (Comercial ou Criador de Conteúdo) foi encontrada vinculada às Páginas do Facebook acessíveis.";
      logger.warn(`${fetchLogContext} ${errorMsg} User: ${userId}. Páginas FB processadas: ${allPagesData.length}`);
      return { success: false, error: errorMsg, errorCode: 404 };
    }

    logger.info(`${fetchLogContext} Encontradas ${availableIgAccounts.length} contas IG vinculadas para User ${userId}.`);
    logger.debug(`${fetchLogContext} Contas IG: ${JSON.stringify(availableIgAccounts.map(acc => acc.igAccountId))}`);
    return { success: true, accounts: availableIgAccounts, longLivedAccessToken: userLongLivedAccessToken };

  } catch (generalError: unknown) {
    const errorMsg = generalError instanceof Error ? generalError.message : String(generalError);
    logger.error(`${TAG} Erro GERAL CRÍTICO durante busca de contas IG para User ${userId}:`, generalError);
    return { success: false, error: (errorMsg.includes('Token') || errorMsg.includes('Permissão') || errorMsg.includes('Falha')) ? errorMsg : `Erro interno inesperado: ${errorMsg}` };
  }
}
