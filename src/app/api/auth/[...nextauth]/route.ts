// src/app/api/auth/[...nextauth]/route.ts (Com Lógica de Vinculação)
import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Importa o modelo atualizado
import { Types } from "mongoose";
import type { JWT } from "next-auth/jwt";
import { logger } from "@/app/lib/logger";

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

interface SignInCallback { user: User & { id?: string }; account: Account | null; }
interface JwtCallback { token: JWT; user?: User | AdapterUser; account?: Account | null; profile?: any; trigger?: "signIn" | "signUp" | "update" | undefined; } // Adicionado trigger
interface RedirectCallback { baseUrl: string; }

// --- FUNÇÃO HELPER: Obter LLAT e ID do Instagram (mantida como antes) ---
async function getFacebookLongLivedTokenAndIgId(
    shortLivedToken: string,
    userId: string // ID do usuário no SEU banco de dados
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[getFacebookLongLivedTokenAndIgId]';
    const FB_APP_ID = process.env.FACEBOOK_CLIENT_ID;
    const FB_APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET;

    if (!FB_APP_ID || !FB_APP_SECRET) {
        logger.error(`${TAG} Variáveis de ambiente FACEBOOK_CLIENT_ID ou FACEBOOK_CLIENT_SECRET não definidas.`);
        return { success: false, error: 'Configuração do servidor incompleta.' };
    }

    try {
        // 1. Trocar SLAT por LLAT
        logger.debug(`${TAG} Trocando SLAT por LLAT para User ${userId}...`);
        const llatResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortLivedToken}`);
        const llatData = await llatResponse.json();

        if (!llatResponse.ok || !llatData.access_token) {
            logger.error(`${TAG} Erro ao obter LLAT:`, llatData);
            return { success: false, error: llatData.error?.message || 'Falha ao obter token de longa duração.' };
        }
        const longLivedToken = llatData.access_token;
        logger.debug(`${TAG} LLAT obtido com sucesso para User ${userId}.`);

        // 2. Buscar Páginas do Facebook conectadas
        logger.debug(`${TAG} Buscando páginas do Facebook para User ${userId}...`);
        const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`);
        const pagesData = await pagesResponse.json();

        if (!pagesResponse.ok || !pagesData.data) {
            logger.error(`${TAG} Erro ao buscar páginas do Facebook:`, pagesData);
            return { success: false, error: pagesData.error?.message || 'Falha ao buscar páginas do Facebook.' };
        }

        // 3. Encontrar a Conta do Instagram vinculada
        let instagramAccountId: string | null = null;
        logger.debug(`${TAG} Procurando conta Instagram vinculada entre ${pagesData.data.length} páginas...`);
        for (const page of pagesData.data) {
            const pageId = page.id;
            try {
                const igResponse = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${longLivedToken}`);
                const igData = await igResponse.json();

                if (igResponse.ok && igData.instagram_business_account) {
                    instagramAccountId = igData.instagram_business_account.id;
                    logger.info(`${TAG} Conta Instagram encontrada para User ${userId}: ${instagramAccountId} (vinculada à Página FB ${pageId})`);
                    break;
                } else if (!igResponse.ok) {
                     logger.warn(`${TAG} Erro ao buscar conta IG para a página ${pageId}:`, igData);
                }
            } catch (pageError) {
                 logger.error(`${TAG} Erro de rede ou inesperado ao buscar conta IG para página ${pageId}:`, pageError);
            }
        }

        if (!instagramAccountId) {
            logger.warn(`${TAG} Nenhuma conta profissional do Instagram encontrada vinculada às páginas do Facebook para User ${userId}.`);
        }

        // 4. Salvar LLAT e ID do Instagram no Banco de Dados
        logger.debug(`${TAG} Atualizando usuário ${userId} no DB com LLAT e ID IG...`);
        await connectToDatabase();
        const updateResult = await DbUser.findByIdAndUpdate(userId, {
            $set: {
               instagramAccessToken: longLivedToken,
               instagramAccountId: instagramAccountId,
               isInstagramConnected: !!instagramAccountId // Atualiza flag
            }
        }, { new: true });

        if (!updateResult) {
             logger.error(`${TAG} Usuário ${userId} não encontrado no DB para atualização.`);
             return { success: false, error: 'Usuário não encontrado no banco de dados.' };
        }

        logger.info(`${TAG} Usuário ${userId} atualizado com sucesso com dados do Instagram.`);
        return { success: true };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro inesperado no processo:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Erro interno: ${message}` };
    }
}
// --- FIM FUNÇÃO HELPER ---

export const authOptions: NextAuthOptions = {
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: { /* ... configurações de cookies mantidas ... */ },
  providers: [ /* ... GoogleProvider, FacebookProvider, CredentialsProvider mantidos ... */ ],
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    // encode e decode customizados removidos
  },
  callbacks: {
    // <<< CALLBACK SIGNIN MODIFICADO >>>
    async signIn({ user, account, profile }: { user: User & { id?: string }, account: Account | null, profile?: any }): Promise<boolean> {
        const TAG_SIGNIN = '[NextAuth signIn Callback]';
        logger.debug(`${TAG_SIGNIN} Iniciado`, { userId: user.id, provider: account?.provider, email: user.email });

        if (!account || !user.email) {
            logger.error(`${TAG_SIGNIN} Account ou User Email ausente.`);
            return false; // Não pode prosseguir sem conta ou email
        }

        // Permitir login com Credentials diretamente
        if (account.provider === "credentials") {
            if (!user?.id) { logger.error(`${TAG_SIGNIN} Usuário de Credentials sem ID.`); return false; }
            logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials para User ${user.id}`);
            return true;
        }

        // Lógica para Google e Facebook
        if (account.provider === "google" || account.provider === "facebook") {
            try {
                await connectToDatabase();
                let existingUser = await DbUser.findOne({ email: user.email }).exec();

                if (existingUser) {
                    logger.debug(`${TAG_SIGNIN} Usuário encontrado por email (${user.email}) para provider ${account.provider}. ID: ${existingUser._id}`);
                    user.id = existingUser._id.toString(); // Garante que o ID do DB seja usado

                    // Atualiza informações que podem mudar (nome, imagem) e vincula conta se necessário
                    let needsSave = false;
                    if (user.name && user.name !== existingUser.name) { existingUser.name = user.name; needsSave = true; }
                    if (user.image && user.image !== existingUser.image) { existingUser.image = user.image; needsSave = true; }

                    // Vincula conta do Facebook se ainda não estiver vinculada
                    if (account.provider === 'facebook' && !existingUser.facebookProviderAccountId) {
                        logger.info(`${TAG_SIGNIN} Vinculando conta Facebook (${account.providerAccountId}) ao usuário existente ${existingUser._id} com email ${user.email}`);
                        existingUser.facebookProviderAccountId = account.providerAccountId;
                        needsSave = true;
                    }
                    // Atualiza providerAccountId principal se for o mesmo provider (ex: Google ID mudou?)
                    else if (account.provider === existingUser.provider && account.providerAccountId !== existingUser.providerAccountId) {
                         logger.warn(`${TAG_SIGNIN} Atualizando providerAccountId principal para usuário ${existingUser._id}`);
                         existingUser.providerAccountId = account.providerAccountId;
                         needsSave = true;
                    }

                    if (needsSave) {
                        await existingUser.save();
                        logger.debug(`${TAG_SIGNIN} Dados do usuário existente atualizados/vinculados.`);
                    }
                    return true; // Permite o login/vinculação

                } else {
                    // Usuário NÃO encontrado por email.
                    // Se for Facebook, NÃO criamos aqui. Deixamos o JWT tratar (caso seja vinculação a user logado)
                    if (account.provider === 'facebook') {
                        logger.debug(`${TAG_SIGNIN} Usuário com email ${user.email} não encontrado. Permitindo que JWT trate (possível vinculação ou novo usuário).`);
                        // Retornamos true para permitir que o callback JWT seja chamado.
                        // O JWT decidirá se vincula a uma sessão existente ou se permite a criação (se for um login novo sem sessão).
                        // Precisamos garantir que o `user.id` seja passado de alguma forma se for um novo usuário.
                        // NextAuth pode lidar com isso se o profile tiver um ID único.
                        // O ID do Facebook (profile.id ou user.id vindo do profile) será usado no JWT.
                        user.id = profile?.id ?? user.id; // Garante que temos um ID para o JWT
                        return true;
                    }

                    // Se for Google e não encontrou por email, cria novo usuário
                    if (account.provider === 'google') {
                        logger.debug(`${TAG_SIGNIN} Criando novo usuário (Google) para email:`, user.email);
                        const newUser = new DbUser({
                            name: user.name, email: user.email, image: user.image,
                            provider: account.provider, providerAccountId: account.providerAccountId,
                            role: "user", planStatus: "inactive", planExpiresAt: null,
                            affiliateBalance: 0, affiliateRank: 1, affiliateInvites: 0,
                            isInstagramConnected: false,
                        });
                        const savedUser = await newUser.save();
                        user.id = savedUser._id.toString(); // Atualiza o ID do user para o callback JWT
                        logger.debug(`${TAG_SIGNIN} Novo usuário (Google) criado: ${user.id}`);
                        return true; // Permite o login
                    }
                }
            } catch (error) {
                logger.error(`${TAG_SIGNIN} Erro (${account.provider}) ao interagir com o banco:`, error);
                return false; // Impede login em caso de erro no DB
            }
        }

        logger.warn(`${TAG_SIGNIN} Provider não suportado ou fluxo inesperado.`);
        return false; // Bloqueia por padrão
    },

    // <<< CALLBACK JWT MODIFICADO >>>
    async jwt({ token, user, account, profile, trigger }: JwtCallback): Promise<JWT> {
        const TAG_JWT = '[NextAuth JWT Callback]';
        logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Account Provider: ${account?.provider}. Token recebido:`, JSON.stringify(token));
        logger.debug(`${TAG_JWT} User ID (entrada): ${user?.id}, Profile ID (entrada): ${profile?.id}`);

        const isSignIn = trigger === 'signIn' || trigger === 'signUp'; // Evento de login/conexão inicial
        const isUpdate = trigger === 'update'; // Evento de update via useSession().update()

        // 1. Evento de Login/Conexão Inicial (account existe)
        if (account && user) {
            // Se for login/conexão via Facebook
            if (account.provider === 'facebook') {
                // Cenário de Vinculação: Usuário já está logado (token.id existe)
                if (token.id && token.provider !== 'facebook') { // Verifica se já logado com outro provider
                    logger.info(`${TAG_JWT} Vinculando Facebook à conta existente ${token.id} (provider original: ${token.provider})`);
                    const userId = token.id as string;
                    try {
                        await connectToDatabase();
                        const updatedUser = await DbUser.findByIdAndUpdate(userId, {
                            $set: { facebookProviderAccountId: account.providerAccountId }
                        }, { new: true });

                        if (updatedUser) {
                            logger.info(`${TAG_JWT} Conta Facebook (${account.providerAccountId}) vinculada com sucesso ao User ${userId}.`);
                            // Busca token/ID do Instagram para a conta principal
                            if (account.access_token) {
                                getFacebookLongLivedTokenAndIgId(account.access_token, userId) // Usa o ID da conta existente
                                    .then(result => { /* ... logs de sucesso/erro ... */ })
                                    .catch(error => { /* ... log de erro ... */ });
                            }
                        } else {
                             logger.error(`${TAG_JWT} Falha ao vincular Facebook: Usuário ${userId} não encontrado no DB.`);
                        }
                        // Mantém o token original (provider, id, role) da sessão ativa
                        return token;

                    } catch (error) {
                         logger.error(`${TAG_JWT} Erro ao vincular conta Facebook no DB para User ${userId}:`, error);
                         return token; // Retorna token original em caso de erro
                    }
                }
                // Cenário de Login Novo com Facebook (sem sessão prévia ou já era Facebook)
                else {
                    logger.debug(`${TAG_JWT} Processando login/conexão inicial com Facebook.`);
                    token.id = user.id; // Usa o ID passado pelo signIn (do DB ou profile)
                    token.provider = 'facebook';
                    logger.debug(`${TAG_JWT} Definindo token.id=${token.id}, token.provider=${token.provider}`);
                    // Busca token/ID do Instagram
                    if (account.access_token) {
                        getFacebookLongLivedTokenAndIgId(account.access_token, token.id as string)
                            .then(result => { /* ... logs ... */ })
                            .catch(error => { /* ... log ... */ });
                    }
                }
            }
            // Se for login/conexão via Google
            else if (account.provider === 'google') {
                logger.debug(`${TAG_JWT} Processando login inicial com Google.`);
                token.id = user.id; // ID do usuário do DB (findOrCreate no signIn)
                token.provider = 'google';
                logger.debug(`${TAG_JWT} Definindo token.id=${token.id}, token.provider=${token.provider}`);
            }
             // Se for login via Credentials
             else if (account.provider === 'credentials') {
                 logger.debug(`${TAG_JWT} Processando login inicial com Credentials.`);
                 token.id = user.id;
                 token.provider = 'credentials'; // Ou como definir
                 logger.debug(`${TAG_JWT} Definindo token.id=${token.id}, token.provider=${token.provider}`);
             }
        }

        // 2. Eventos Subsequentes ou Update (account não existe ou trigger é update)
        // Garante que o ID e Provider persistam se já existirem no token
        // (O NextAuth v5+ geralmente faz isso automaticamente se não houver encode/decode customizado)
        if (!token.id && user?.id) {
             token.id = user.id; // Tenta recuperar ID se ausente
             logger.warn(`${TAG_JWT} ID recuperado para token em evento subsequente.`);
        }
        // Não precisamos redefinir o provider aqui, ele deve persistir do JWT anterior

        // 3. Adiciona/Atualiza Role (sempre que possível, baseado no ID do token)
        if (token.id && (!token.role || isSignIn || isUpdate)) { // Atualiza role no login ou update
             try {
                await connectToDatabase();
                const dbUser = await DbUser.findById(token.id).select('role').lean();
                if (dbUser) {
                    if (token.role !== dbUser.role) {
                        logger.debug(`${TAG_JWT} Atualizando role no token para '${dbUser.role}' para User ${token.id}`);
                        token.role = dbUser.role;
                    } else {
                         logger.debug(`${TAG_JWT} Role '${token.role}' confirmada no token para User ${token.id}`);
                    }
                } else {
                     logger.warn(`${TAG_JWT} Usuário ${token.id} não encontrado no DB ao buscar role.`);
                     delete token.role; // Remove role se usuário não existe mais
                }
             } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar role para User ${token.id} no callback JWT:`, error); }
        }

        logger.debug(`${TAG_JWT} Finalizado. Retornando token:`, JSON.stringify(token));
        return token;
    },

    // <<< CALLBACK SESSION MODIFICADO >>>
    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      const TAG_SESSION = '[NextAuth Session Callback]';
      logger.debug(`${TAG_SESSION} Iniciado. Token recebido:`, JSON.stringify(token));

      // Popula a sessão APENAS se o token contiver o ID do nosso DB
      if (token.id) {
          session.user = {
              id: token.id as string,
              provider: token.provider as string, // Provider do login ATUAL
              // Inicializa outros campos que virão do DB
              role: token.role as string ?? 'user', // Pega role do token se disponível
          };
          logger.debug(`${TAG_SESSION} Session.user inicializado com id='${session.user.id}', provider='${session.user.provider}', role='${session.user.role}'`);

          // Busca no DB para dados atualizados
          try {
            await connectToDatabase();
            const dbUser = await DbUser.findById(token.id)
                                       .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected') // Busca campos necessários
                                       .lean();

            if (dbUser && session.user) {
              logger.debug(`${TAG_SESSION} Usuário encontrado no DB para sessão:`, dbUser._id);
              // Atualiza/adiciona dados do DB à sessão
              session.user.name = dbUser.name ?? session.user.name;
              session.user.email = dbUser.email ?? session.user.email; // Email principal do DB
              session.user.image = dbUser.image ?? session.user.image;
              session.user.role = dbUser.role ?? session.user.role; // Atualiza role com valor do DB
              session.user.planStatus = dbUser.planStatus ?? 'inactive';
              session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date ? dbUser.planExpiresAt.toISOString() : null;
              session.user.affiliateCode = dbUser.affiliateCode ?? undefined;
              session.user.affiliateBalance = dbUser.affiliateBalance ?? 0;
              session.user.affiliateRank = dbUser.affiliateRank ?? 1;
              session.user.affiliateInvites = dbUser.affiliateInvites ?? 0;
              session.user.instagramConnected = dbUser.isInstagramConnected ?? false;
              logger.debug(`${TAG_SESSION} Status conexão Instagram (do DB) para User ${token.id}: ${session.user.instagramConnected}`);

            } else {
               logger.error(`${TAG_SESSION} Usuário ${token.id} não encontrado no DB. Sessão pode estar incompleta.`);
               // Mantém os dados básicos do token (id, provider, role) mas remove os outros
               delete session.user?.planStatus;
               delete session.user?.instagramConnected;
               // ... outros
            }
          } catch (error) {
            logger.error(`${TAG_SESSION} Erro ao buscar/processar dados do usuário na sessão:`, error);
            // Limpa dados do DB em caso de erro, mantendo id/provider/role do token
            if(session.user) {
                delete session.user.planStatus;
                delete session.user.instagramConnected;
                // ... etc
            }
          }
      } else {
          logger.error(`${TAG_SESSION} Erro: token.id ausente no token recebido. Retornando sessão vazia.`);
          // Retorna uma sessão vazia ou lança erro, dependendo do comportamento desejado
          return { ...session, user: undefined, expires: session.expires }; // Limpa o usuário
      }

      logger.debug(`${TAG_SESSION} Finalizado. Retornando session.user:`, JSON.stringify(session.user));
      return session;
    },

    // <<< CALLBACK REDIRECT MANTIDO >>>
    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      // Redireciona sempre para o dashboard após login/conexão
      return `${baseUrl}/dashboard`;
    },
  },
  pages: { /* ... mantido ... */ },
  session: { /* ... mantido ... */ },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
