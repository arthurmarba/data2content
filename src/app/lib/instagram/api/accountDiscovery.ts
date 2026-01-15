// src/app/lib/instagram/api/accountDiscovery.ts
import fetch, { Response as FetchResponse } from 'node-fetch';
import mongoose from 'mongoose';
import retry from 'async-retry';
import { logger } from '@/app/lib/logger';
import {
  API_VERSION,
  BASE_URL,
  RETRY_OPTIONS,
  MAX_ACCOUNT_FETCH_PAGES, // Este limite será aplicado por Portfólio na nova lógica
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
import { clearInstagramConnection } from '@/app/lib/instagram';

// Tipo local para dados de página (reutilizado)
type PageAccountData = {
  id: string; // Page ID
  name: string; // Page Name
  access_token?: string;
  instagram_business_account?: {
    id: string; // Instagram Business Account ID
    username?: string;
    profile_picture_url?: string;
  };
};

// Tipo local para dados de Portfólio Empresarial
type BusinessData = {
  id: string; // Business ID
  name: string; // Business Name
  // Adicione outros campos se necessário, ex: permitted_tasks
};

/**
 * Busca as contas Instagram profissionais (Business/Creator) disponíveis para um usuário.
 * Primeiro tenta via /me/accounts. Se nenhuma conta for encontrada, e o token do usuário
 * tiver permissão (implicitamente, `business_management` é necessária), tenta buscar
 * através dos Portfólios Empresariais (/me/businesses e /{business_id}/owned_pages).
 *
 * @param shortLivedUserAccessToken - O token de acesso de curta duração do Facebook do usuário.
 * @param userId - O ID do usuário no sistema Data2Content.
 * @returns Uma promessa que resolve para FetchInstagramAccountsResult ou FetchInstagramAccountsError.
 */
export async function fetchAvailableInstagramAccounts(
  shortLivedUserAccessToken: string,
  userId: string
): Promise<FetchInstagramAccountsResult | FetchInstagramAccountsError> {
  // NOTA PARA O DESENVOLVEDOR: Certifique-se de que seu app solicita a permissão 'business_management'
  // durante o fluxo de OAuth para que a busca via Business Manager funcione.
  const TAG = '[fetchAvailableInstagramAccounts v3.0_user_token_and_biz_api]';
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
  let llatResponseData: ({ access_token?: string; token_type?: string; expires_in?: number; } & FacebookApiError) | null = null;

  // Etapa 1: Obter o Token de Longa Duração (LLAT) do usuário
  try {
    logger.debug(`${TAG} Tentando obter LLAT do usuário ${userId}...`);
    const llatUrl = `${BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${shortLivedUserAccessToken}`;

    llatResponseData = await retry(async (bail, attemptNum) => {
      if (attemptNum > 1) logger.warn(`${TAG} Tentativa ${attemptNum} para obter LLAT do usuário.`);
      const response: FetchResponse = await fetch(llatUrl);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text().catch(() => 'Falha ao ler corpo da resposta não-JSON.');
        logger.error(`${TAG} Resposta não-JSON (Status: ${response.status}) ao obter LLAT. Conteúdo: ${responseText.substring(0, 200)}`);
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
      const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      await clearInstagramConnection(userObjectId, 'Token de usuário inválido ao obter LLAT.', 'TOKEN_INVALID');
    }
    return { success: false, error: `Falha ao obter token de acesso de longa duração necessário: ${llatError.message}` };
  }

  // Etapa 2: Listar Páginas e Contas IG
  try {
    let allPagesData: PageAccountData[] = [];
    let fetchError: Error | null = null;

    // Etapa 2a: Tentar listar Páginas via /me/accounts (fluxo padrão)
    const fetchLogContextMeAccounts = `${TAG} (User LLAT Flow - /me/accounts)`;
    logger.info(`${fetchLogContextMeAccounts} Utilizando User LLAT e /me/accounts para listar contas para o usuário ${userId}.`);
    if (!userLongLivedAccessToken) {
      logger.error(`${fetchLogContextMeAccounts} LLAT do usuário não disponível.`);
      return { success: false, error: "Token de longa duração do usuário indisponível para listar contas." };
    }

    let currentPageUrlMe: string | null = `${BASE_URL}/${API_VERSION}/me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url}&limit=50&access_token=${userLongLivedAccessToken}`;
    let pageCountMe = 0;

    while (currentPageUrlMe && pageCountMe < MAX_ACCOUNT_FETCH_PAGES) {
      pageCountMe++;
      logger.debug(`${fetchLogContextMeAccounts} Buscando página ${pageCountMe}/${MAX_ACCOUNT_FETCH_PAGES}...`);
      try {
        const pageResponse = await retry(async (bail, attemptNum) => {
          if (attemptNum > 1) logger.warn(`${fetchLogContextMeAccounts} Tentativa ${attemptNum} pág ${pageCountMe}.`);
          const response: FetchResponse = await fetch(currentPageUrlMe!);
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) { bail(new Error(`Resposta não-JSON (Status: ${response.status})`)); return null; }
          const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json();
          if (!response.ok || data.error) {
            const errorDetail: FacebookApiErrorStructure = data.error || { message: `Erro ${response.status} pág ${pageCountMe}`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
            logger.error(`${fetchLogContextMeAccounts} Erro API (Tentativa ${attemptNum}) pág ${pageCountMe}:`, JSON.stringify(errorDetail));
            if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) { bail(new Error('Token de longa duração (LLAT) do usuário inválido/expirado.')); return null; }
            if (errorDetail.code === 10 || (errorDetail.message && errorDetail.message.includes("permission"))) { // Permissao 10: pages_show_list
              bail(new Error('Permissão `pages_show_list` (ou outra) ausente para o usuário para /me/accounts.')); return null;
            }
            if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCountMe} /me/accounts: ${errorDetail.message}`)); return null; }
            throw new Error(errorDetail.message || `Erro temp ${response.status} pág ${pageCountMe}.`);
          }
          return data;
        }, { ...RETRY_OPTIONS, retries: 2 });

        if (pageResponse?.data) { allPagesData.push(...pageResponse.data); }
        currentPageUrlMe = pageResponse?.paging?.next ?? null;
        if (currentPageUrlMe) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
      } catch (error) {
        fetchError = error instanceof Error ? error : new Error(String(error));
        logger.error(`${fetchLogContextMeAccounts} Erro durante paginação /me/accounts (pág ${pageCountMe}):`, fetchError);
        currentPageUrlMe = null; // Interrompe a paginação para este fluxo em caso de erro irrecuperável
      }
    }
    if (pageCountMe >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrlMe) logger.warn(`${fetchLogContextMeAccounts} Limite ${MAX_ACCOUNT_FETCH_PAGES} págs /me/accounts atingido.`);

    if (fetchError) {
      // Se o erro for de token ou permissão, não necessariamente impede a tentativa via Business Manager,
      // mas registramos e continuamos para ver se o outro fluxo funciona.
      logger.warn(`${fetchLogContextMeAccounts} Erro ao buscar páginas via /me/accounts: ${fetchError.message}. Tentando via Business Manager se aplicável.`);
      // Resetar fetchError para não contaminar o resultado final se o fluxo BM for bem-sucedido
      // fetchError = null; // Comentado pois o erro original pode ser relevante se o fluxo BM também falhar.
    }

    logger.info(`${fetchLogContextMeAccounts} Busca via /me/accounts concluída para User ${userId}. ${allPagesData.length} Páginas FB encontradas por este método.`);

    // Etapa 2b: Se nenhuma página foi encontrada via /me/accounts, tentar via Business Manager
    // É crucial que o token do usuário (userLongLivedAccessToken) tenha a permissão 'business_management'.
    if (allPagesData.length === 0 && userLongLivedAccessToken) {
      const fetchLogContextBiz = `${TAG} (User LLAT Flow - Business API)`;
      logger.info(`${fetchLogContextBiz} Nenhuma página encontrada via /me/accounts. Tentando buscar via Business Manager para User ${userId}.`);

      try {
        // 1. Listar Portfólios (Businesses) do usuário
        const businessesUrl = `${BASE_URL}/${API_VERSION}/me/businesses?access_token=${userLongLivedAccessToken}`;
        logger.debug(`${fetchLogContextBiz} Buscando Portfólios em ${businessesUrl}`);

        const businessesResponse = await retry(async (bail, attemptNum) => {
          if (attemptNum > 1) logger.warn(`${fetchLogContextBiz} Tentativa ${attemptNum} para /me/businesses.`);
          const response: FetchResponse = await fetch(businessesUrl);
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) { bail(new Error(`Resposta não-JSON (Status: ${response.status}) de /me/businesses`)); return null; }
          const data: InstagramApiResponse<BusinessData> & FacebookApiError = await response.json();
          if (!response.ok || data.error) {
            const errorDetail: FacebookApiErrorStructure = data.error || { message: `Erro ${response.status} em /me/businesses`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
            logger.error(`${fetchLogContextBiz} Erro API (Tentativa ${attemptNum}) em /me/businesses:`, JSON.stringify(errorDetail));
            // Erro de permissão (código 100, 200, ou mensagem específica) é crítico aqui.
            if (errorDetail.code === 100 || errorDetail.code === 200 || (errorDetail.message && errorDetail.message.toLowerCase().includes("permission")) || (errorDetail.message && errorDetail.message.toLowerCase().includes("does not have permission"))) {
              bail(new Error('Permissão `business_management` (ou outra necessária) ausente para /me/businesses.')); return null;
            }
            if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) { bail(new Error('Token LLAT do usuário inválido/expirado ao acessar /me/businesses.')); return null; }
            if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha em /me/businesses: ${errorDetail.message}`)); return null; }
            throw new Error(errorDetail.message || `Erro temp ${response.status} em /me/businesses.`);
          }
          return data;
        }, { ...RETRY_OPTIONS, retries: 2 });

        const businesses = businessesResponse?.data;
        if (!businesses || businesses.length === 0) {
          logger.info(`${fetchLogContextBiz} Nenhum Portfólio Empresarial encontrado para User ${userId} ou falha ao buscá-los.`);
          // Não definir fetchError aqui, pois a ausência de Portfólios não é um erro se /me/accounts também não retornou nada.
        } else {
          logger.info(`${fetchLogContextBiz} Encontrados ${businesses.length} Portfólio(s) Empresarial(is) para User ${userId}. Buscando páginas dentro de cada um...`);

          for (const business of businesses) {
            logger.debug(`${fetchLogContextBiz} Processando Portfólio ID: ${business.id}, Nome: ${business.name}`);
            let currentPageUrlBizPages: string | null = `${BASE_URL}/${API_VERSION}/${business.id}/owned_pages?fields=id,name,instagram_business_account{id,username,profile_picture_url}&limit=25&access_token=${userLongLivedAccessToken}`;
            let pageCountBiz = 0;

            while (currentPageUrlBizPages && pageCountBiz < MAX_ACCOUNT_FETCH_PAGES) { // Reutilizando MAX_ACCOUNT_FETCH_PAGES por portfólio
              pageCountBiz++;
              logger.debug(`${fetchLogContextBiz} Buscando página ${pageCountBiz}/${MAX_ACCOUNT_FETCH_PAGES} de owned_pages para Portfólio ${business.id}...`);
              try {
                const bizPageResponse = await retry(async (bail, attemptNum) => {
                  if (attemptNum > 1) logger.warn(`${fetchLogContextBiz} Tentativa ${attemptNum} pág ${pageCountBiz} owned_pages (Portfólio ${business.id}).`);
                  const response: FetchResponse = await fetch(currentPageUrlBizPages!);
                  const contentType = response.headers.get('content-type');
                  if (!contentType || !contentType.includes('application/json')) { bail(new Error(`Resposta não-JSON (Status: ${response.status}) de owned_pages`)); return null; }
                  const data: InstagramApiResponse<PageAccountData> & FacebookApiError = await response.json();
                  if (!response.ok || data.error) {
                    const errorDetail: FacebookApiErrorStructure = data.error || { message: `Erro ${response.status} pág ${pageCountBiz} owned_pages`, code: response.status, fbtrace_id: 'N/A', type: 'HttpError' };
                    logger.error(`${fetchLogContextBiz} Erro API (Tentativa ${attemptNum}) pág ${pageCountBiz} owned_pages (Portfólio ${business.id}):`, JSON.stringify(errorDetail));
                    if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) { bail(new Error('Token LLAT do usuário inválido/expirado ao acessar owned_pages.')); return null; }
                    // Permissões como pages_show_list podem ser verificadas aqui também se aplicável no contexto do BM
                    if (errorDetail.code === 10 || (errorDetail.message && errorDetail.message.toLowerCase().includes("permission"))) {
                      bail(new Error(`Permissão ausente para acessar owned_pages do Portfólio ${business.id}.`)); return null;
                    }
                    if (response.status >= 400 && response.status < 500 && response.status !== 429) { bail(new Error(`Falha pág ${pageCountBiz} owned_pages (Portfólio ${business.id}): ${errorDetail.message}`)); return null; }
                    throw new Error(errorDetail.message || `Erro temp ${response.status} pág ${pageCountBiz} owned_pages.`);
                  }
                  return data;
                }, { ...RETRY_OPTIONS, retries: 2 });

                if (bizPageResponse?.data) {
                  // Adicionar apenas se a página ainda não foi adicionada (evitar duplicatas se um dia houver sobreposição)
                  bizPageResponse.data.forEach(page => {
                    if (!allPagesData.some(existingPage => existingPage.id === page.id)) {
                      allPagesData.push(page);
                    }
                  });
                }
                currentPageUrlBizPages = bizPageResponse?.paging?.next ?? null;
                if (currentPageUrlBizPages) await new Promise(r => setTimeout(r, ACCOUNT_FETCH_DELAY_MS));
              } catch (error) {
                // Se um erro específico de um portfólio ocorrer, registramos e continuamos para o próximo portfólio.
                // O fetchError principal só será setado se for um erro mais global ou o último erro encontrado.
                const bizPageError = error instanceof Error ? error : new Error(String(error));
                logger.error(`${fetchLogContextBiz} Erro durante paginação owned_pages (Portfólio ${business.id}, pág ${pageCountBiz}):`, bizPageError);
                fetchError = bizPageError; // Atualiza fetchError com o erro mais recente do fluxo BM
                currentPageUrlBizPages = null; // Interrompe paginação para este portfólio
              }
            }
            if (pageCountBiz >= MAX_ACCOUNT_FETCH_PAGES && currentPageUrlBizPages) logger.warn(`${fetchLogContextBiz} Limite ${MAX_ACCOUNT_FETCH_PAGES} págs owned_pages (Portfólio ${business.id}) atingido.`);
          }
          logger.info(`${fetchLogContextBiz} Busca via Business Manager concluída. Total de ${allPagesData.length} Páginas FB encontradas (contando ambos os métodos).`);
        }
      } catch (bizError: any) {
        // Erro ao buscar Portfólios ou um erro não tratado dentro do loop de Portfólios
        logger.error(`${fetchLogContextBiz} Erro CRÍTICO durante o fluxo do Business Manager para User ${userId}:`, bizError);
        fetchError = bizError; // Define o erro principal se o fluxo do BM falhar catastroficamente
        if (bizError.message && (bizError.message.toLowerCase().includes('token') || isTokenInvalidError(undefined, undefined, bizError.message))) {
          logger.warn(`${fetchLogContextBiz} Erro de token durante o fluxo do Business Manager. Limpando conexão IG para User ${userId}.`);
          const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
          await clearInstagramConnection(userObjectId, 'Falha ao obter contas via Business Manager.', 'TOKEN_INVALID');
        }
      }
    } // Fim do if (allPagesData.length === 0 && userLongLivedAccessToken)

    // Processamento final e retorno
    if (fetchError && allPagesData.length === 0) { // Se houve erro e NENHUMA página foi encontrada por nenhum método
      // Se o erro for de token, a limpeza da conexão já foi tratada no bloco catch do LLAT ou nos fluxos de fetch
      // Aqui, apenas retornamos o erro.
      return { success: false, error: `Erro ao buscar páginas: ${fetchError.message}` };
    }

    // Caso sem erro explícito, mas nenhum resultado de páginas encontrado em nenhum fluxo
    if (allPagesData.length === 0) {
      const errorMsgNoPages =
        'Nenhuma Página do Facebook foi encontrada para esta conta. Crie uma Página e torne-se administrador, depois vincule seu Instagram profissional a ela.';
      logger.warn(`${TAG} ${errorMsgNoPages} User: ${userId}.`);
      return { success: false, error: errorMsgNoPages, errorCode: 404 };
    }

    logger.info(`${TAG} Processamento final de contas para User ${userId}. Total de ${allPagesData.length} Páginas FB encontradas globalmente.`);
    const availableIgAccounts: AvailableInstagramAccount[] = [];
    const uniqueIgAccountIds = new Set<string>();

    for (const page of allPagesData) {
      if (page.instagram_business_account?.id && !uniqueIgAccountIds.has(page.instagram_business_account.id)) {
        availableIgAccounts.push({
          igAccountId: page.instagram_business_account.id,
          pageId: page.id,
          pageName: page.name,
          username: page.instagram_business_account.username,
          profile_picture_url: page.instagram_business_account.profile_picture_url,
        });
        uniqueIgAccountIds.add(page.instagram_business_account.id);
      }
    }

    if (availableIgAccounts.length === 0) {
      // Páginas foram encontradas, mas nenhuma possui IG Profissional vinculado
      const errorMsg =
        'Encontramos Páginas do Facebook, porém nenhuma possui uma conta profissional do Instagram vinculada. Vincule seu IG à Página e tente novamente.';
      logger.warn(
        `${TAG} ${errorMsg} User: ${userId}. Total de Páginas FB processadas: ${allPagesData.length}`
      );
      return { success: false, error: errorMsg, errorCode: 404 };
    }

    logger.info(`${TAG} Encontradas ${availableIgAccounts.length} contas IG ÚNICAS vinculadas para User ${userId}.`);
    logger.debug(`${TAG} Contas IG: ${JSON.stringify(availableIgAccounts.map(acc => acc.igAccountId))}`);

    // Calcula a data de expiração se disponível
    let longLivedAccessTokenExpiresAt: Date | undefined;
    if (llatResponseData?.expires_in) {
      // expires_in é em segundos
      longLivedAccessTokenExpiresAt = new Date(Date.now() + (llatResponseData.expires_in * 1000));
    }

    return {
      success: true,
      accounts: availableIgAccounts,
      longLivedAccessToken: userLongLivedAccessToken!, // userLongLivedAccessToken é garantido aqui
      longLivedAccessTokenExpiresAt
    };

  } catch (generalError: unknown) {
    const errorMsg = generalError instanceof Error ? generalError.message : String(generalError);
    logger.error(`${TAG} Erro GERAL CRÍTICO durante busca de contas IG para User ${userId}:`, generalError);
    // Tenta ser um pouco mais específico se o erro for conhecido
    if (errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('falha')) {
      return { success: false, error: errorMsg };
    }
    return { success: false, error: `Erro interno inesperado ao buscar contas: ${errorMsg}` };
  }
}
