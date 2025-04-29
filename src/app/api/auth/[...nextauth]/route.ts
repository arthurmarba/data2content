// src/app/api/auth/[...nextauth]/route.ts (Corrigido Retorno de ID na Vinculação)
import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Importa o modelo atualizado com facebookProviderAccountId
import { Types } from "mongoose";
import type { JWT } from "next-auth/jwt";
import { logger } from "@/app/lib/logger";

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

interface SignInCallback { user: User & { id?: string }; account: Account | null; }
// Adicionado trigger e profile ao JwtCallback se ainda não estiverem lá
interface JwtCallback { token: JWT; user?: User | AdapterUser; account?: Account | null; profile?: any; trigger?: "signIn" | "signUp" | "update" | undefined; }
interface RedirectCallback { baseUrl: string; }

// --- FUNÇÃO HELPER: Obter LLAT e ID do Instagram (mantida como antes) ---
async function getFacebookLongLivedTokenAndIgId(
    shortLivedToken: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[getFacebookLongLivedTokenAndIgId]';
    const FB_APP_ID = process.env.FACEBOOK_CLIENT_ID;
    const FB_APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET;

    if (!FB_APP_ID || !FB_APP_SECRET) { /* ... */ return { success: false, error: '...' }; }

    try {
        // 1. Trocar SLAT por LLAT
        // ... (código mantido)
        const llatResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortLivedToken}`);
        const llatData = await llatResponse.json();
        if (!llatResponse.ok || !llatData.access_token) { /* ... */ return { success: false, error: '...' }; }
        const longLivedToken = llatData.access_token;
        // ... (logs mantidos)

        // 2. Buscar Páginas do Facebook
        // ... (código mantido)
        const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`);
        const pagesData = await pagesResponse.json();
         if (!pagesResponse.ok || !pagesData.data) { /* ... */ return { success: false, error: '...' }; }
        // ... (logs mantidos)

        // 3. Encontrar a Conta do Instagram vinculada
        let instagramAccountId: string | null = null;
        // ... (loop e fetch mantidos) ...
        for (const page of pagesData.data) { /* ... */ }
        // ... (logs mantidos)

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

        if (!updateResult) { /* ... */ return { success: false, error: '...' }; }

        logger.info(`${TAG} Usuário ${userId} atualizado com sucesso com dados do Instagram.`);
        return { success: true };

    } catch (error: unknown) { /* ... */ return { success: false, error: '...' }; }
}
// --- FIM FUNÇÃO HELPER ---

export const authOptions: NextAuthOptions = {
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: { /* ... configurações de cookies mantidas ... */ },
  providers: [ /* ... GoogleProvider, FacebookProvider, CredentialsProvider mantidos ... */ ],
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  callbacks: {
    // <<< CALLBACK SIGNIN (Revertido para lógica mais simples) >>>
    // Foca em encontrar ou criar o utilizador e passar o ID correto para JWT
    async signIn({ user, account, profile }: { user: User & { id?: string }, account: Account | null, profile?: any }): Promise<boolean> {
        const TAG_SIGNIN = '[NextAuth signIn Callback]';
        logger.debug(`${TAG_SIGNIN} Iniciado`, { userId: user.id, provider: account?.provider, email: user.email });

        if (!account || !user.email) {
            logger.error(`${TAG_SIGNIN} Account ou User Email ausente.`);
            return false;
        }

        if (account.provider === "credentials") { /* ... credentials logic ... */ return true; }

        // Lógica para Google e Facebook
        if (account.provider === "google" || account.provider === "facebook") {
            try {
                await connectToDatabase();
                let existingUser: IUser | null = null;

                // 1. Tentar encontrar por Provider ID específico, se disponível
                let query: any = {};
                if (account.provider === 'facebook' && account.providerAccountId) {
                    query = { facebookProviderAccountId: account.providerAccountId };
                    existingUser = await DbUser.findOne(query).exec();
                } else if (account.provider === 'google' && account.providerAccountId) {
                    // Assumindo que providerAccountId principal é o Google ID para contas Google
                    query = { providerAccountId: account.providerAccountId, provider: 'google' };
                    existingUser = await DbUser.findOne(query).exec();
                }

                // 2. Se não encontrou por Provider ID, tentar por Email
                if (!existingUser) {
                    logger.debug(`${TAG_SIGNIN} Não encontrado por Provider ID, tentando por email: ${user.email}`);
                    query = { email: user.email };
                    existingUser = await DbUser.findOne(query).exec();
                }

                // 3. Processar resultado
                if (existingUser) {
                    logger.debug(`${TAG_SIGNIN} Usuário existente encontrado (query: ${JSON.stringify(query)}) para ${account.provider}. ID: ${existingUser._id}`);
                    user.id = existingUser._id.toString(); // *** ESSENCIAL: Passa o ID correto para o JWT ***

                    // Atualiza dados que podem mudar ou precisam ser vinculados
                    let needsSave = false;
                    if (user.name && user.name !== existingUser.name) { existingUser.name = user.name; needsSave = true; }
                    if (user.image && user.image !== existingUser.image) { existingUser.image = user.image; needsSave = true; }

                    // Vincula/Atualiza Facebook ID se for login FB e diferente/ausente
                    if (account.provider === 'facebook' && existingUser.facebookProviderAccountId !== account.providerAccountId) {
                        logger.info(`${TAG_SIGNIN} Vinculando/Atualizando facebookProviderAccountId para ${account.providerAccountId} no User ${existingUser._id}`);
                        existingUser.facebookProviderAccountId = account.providerAccountId;
                        needsSave = true;
                    }
                    // Vincula/Atualiza Google ID (providerAccountId principal) se for login Google e diferente/ausente
                    else if (account.provider === 'google' && existingUser.providerAccountId !== account.providerAccountId) {
                         logger.info(`${TAG_SIGNIN} Vinculando/Atualizando providerAccountId (Google) para ${account.providerAccountId} no User ${existingUser._id}`);
                         existingUser.providerAccountId = account.providerAccountId;
                         if (!existingUser.provider) existingUser.provider = 'google'; // Garante provider principal
                         needsSave = true;
                    }
                     // Garante que isInstagramConnected exista
                     if (existingUser.isInstagramConnected === undefined) { existingUser.isInstagramConnected = !!existingUser.instagramAccountId; needsSave = true; }


                    if (needsSave) {
                        await existingUser.save();
                        logger.debug(`${TAG_SIGNIN} Dados do usuário existente atualizados/vinculados.`);
                    }
                    return true; // Permite o login

                } else {
                    // Usuário realmente novo
                    logger.debug(`${TAG_SIGNIN} Criando novo usuário (${account.provider}) para email:`, user.email);
                    const newUser = new DbUser({
                        name: user.name, email: user.email, image: user.image,
                        provider: account.provider, // Provider do primeiro login
                        providerAccountId: account.provider === 'google' ? account.providerAccountId : null, // ID principal (Google)
                        facebookProviderAccountId: account.provider === 'facebook' ? account.providerAccountId : null, // ID Facebook
                        role: "user", planStatus: "inactive", // ... outros defaults
                        isInstagramConnected: false,
                    });
                    const savedUser = await newUser.save();
                    user.id = savedUser._id.toString(); // *** ESSENCIAL: Passa o ID correto para o JWT ***
                    logger.debug(`${TAG_SIGNIN} Novo usuário (${account.provider}) criado: ${user.id}`);
                    return true; // Permite o login
                }
            } catch (error) {
                logger.error(`${TAG_SIGNIN} Erro (${account.provider}) ao interagir com o banco:`, error);
                return false;
            }
        }

        logger.warn(`${TAG_SIGNIN} Provider não suportado ou fluxo inesperado.`);
        return false;
    },

    // <<< CALLBACK JWT (Lógica de Vinculação Refinada) >>>
    async jwt({ token, user, account, profile, trigger }: JwtCallback): Promise<JWT> {
        const TAG_JWT = '[NextAuth JWT Callback]';
        logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Account Provider: ${account?.provider}. Token recebido:`, JSON.stringify(token));
        logger.debug(`${TAG_JWT} User ID (entrada): ${user?.id}`);

        const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';

        // Guarda o ID do token existente (se houver) antes de modificá-lo
        const existingTokenId = token.id;

        // 1. Evento de Login/Conexão Inicial (account existe)
        if (isSignInOrSignUp && account && user?.id) { // Garante que user.id veio do signIn
            // Se for login/conexão via Facebook
            if (account.provider === 'facebook') {
                // Cenário de Vinculação: Usuário já estava logado com outro provider
                if (existingTokenId && token.provider !== 'facebook') {
                    logger.info(`${TAG_JWT} Vinculando Facebook (${account.providerAccountId}) à conta existente ${existingTokenId} (provider original: ${token.provider})`);
                    const userIdToUse = existingTokenId as string; // *** USA O ID EXISTENTE ***

                    try {
                        await connectToDatabase();
                        // Verifica se a conta FB já está vinculada a OUTRO utilizador
                        const userWithThisFbId = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId });
                        if (userWithThisFbId && userWithThisFbId._id.toString() !== userIdToUse) {
                            logger.error(`${TAG_JWT} Esta conta do Facebook (${account.providerAccountId}) já está vinculada a outro usuário (${userWithThisFbId._id}). Vinculação cancelada.`);
                            token.error = "fb_already_linked"; // Sinaliza erro
                            // Retorna o token original sem modificações de ID/Provider
                            token.id = userIdToUse; // Garante ID original
                            // Não altera token.provider
                            return token;
                        }

                        // Atualiza o utilizador existente para vincular o FB ID
                        const updatedUser = await DbUser.findByIdAndUpdate(userIdToUse, {
                            $set: { facebookProviderAccountId: account.providerAccountId }
                        }, { new: true });

                        if (updatedUser) {
                            logger.info(`${TAG_JWT} Conta Facebook vinculada com sucesso ao User ${userIdToUse}.`);
                            // Busca token/ID do Instagram para a conta principal
                            if (account.access_token) {
                                getFacebookLongLivedTokenAndIgId(account.access_token, userIdToUse) // Usa o ID da conta existente
                                    .then(result => { /* ... logs ... */ })
                                    .catch(error => { /* ... log ... */ });
                            }
                            // *** PREPARA O TOKEN DE RETORNO COM DADOS DA SESSÃO EXISTENTE ***
                            token.id = userIdToUse; // Garante ID correto
                            // token.provider permanece o original (ex: 'google')
                            // token.role será buscado abaixo baseado em userIdToUse
                        } else {
                             logger.error(`${TAG_JWT} Falha ao vincular Facebook: Usuário existente ${userIdToUse} não encontrado no DB.`);
                             token.error = "link_user_not_found";
                             token.id = userIdToUse; // Garante ID original
                             return token;
                        }
                    } catch (error) {
                         logger.error(`${TAG_JWT} Erro ao vincular conta Facebook no DB para User ${userIdToUse}:`, error);
                         token.error = "link_db_error";
                         token.id = userIdToUse; // Garante ID original
                         return token;
                    }
                }
                // Cenário de Login Novo com Facebook (sem sessão prévia ou já era Facebook)
                else {
                    logger.debug(`${TAG_JWT} Processando login/conexão inicial com Facebook.`);
                    token.id = user.id; // Usa o ID passado pelo signIn (novo ou existente)
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
            // Se for login/conexão via Google ou Credentials
            else {
                logger.debug(`${TAG_JWT} Processando login inicial com ${account.provider}.`);
                token.id = user.id; // ID do usuário do DB (findOrCreate no signIn)
                token.provider = account.provider;
                logger.debug(`${TAG_JWT} Definindo token.id=${token.id}, token.provider=${token.provider}`);
            }
        }

        // 2. Garante que ID persista em eventos subsequentes
        if (!token.id && user?.id) {
             token.id = user.id;
             logger.warn(`${TAG_JWT} ID recuperado para token em evento subsequente.`);
        } else if (!token.id && !user?.id && existingTokenId) {
            // Fallback para ID do token anterior se user.id não estiver disponível
            token.id = existingTokenId;
             logger.warn(`${TAG_JWT} ID recuperado do token anterior em evento subsequente.`);
        }


        // 3. Adiciona/Atualiza Role (sempre que possível, baseado no ID final do token)
        const finalUserId = token.id;
        if (finalUserId && (!token.role || isSignInOrSignUp)) { // Atualiza role no login/signup
             try {
                await connectToDatabase();
                const dbUser = await DbUser.findById(finalUserId).select('role').lean();
                if (dbUser) { token.role = dbUser.role; logger.debug(`${TAG_JWT} Role '${token.role}' definida/confirmada no token para User ${finalUserId}`); }
                else { logger.warn(`${TAG_JWT} Usuário ${finalUserId} não encontrado no DB ao buscar role.`); delete token.role; }
             } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar role para User ${finalUserId} no callback JWT:`, error); }
        }

        // Cria um novo objeto de token para retornar, excluindo o erro temporário
        const returnToken: JWT = {
            ...token,
        };
        delete returnToken.error; // Não persiste o erro no token final

        logger.debug(`${TAG_JWT} Finalizado. Retornando token:`, JSON.stringify(returnToken));
        return returnToken;
    },

    // <<< CALLBACK SESSION (Mantido como antes, depende do token.id correto) >>>
    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      const TAG_SESSION = '[NextAuth Session Callback]';
      logger.debug(`${TAG_SESSION} Iniciado. Token recebido:`, JSON.stringify(token));

      // Popula a sessão APENAS se o token contiver o ID do nosso DB
      if (token.id) {
          // Inicializa session.user com dados básicos do token
          session.user = {
              id: token.id as string,
              provider: token.provider as string, // Provider do login ATUAL
              role: token.role as string ?? 'user', // Pega role do token
          };
          logger.debug(`${TAG_SESSION} Session.user inicializado com id='${session.user.id}', provider='${session.user.provider}', role='${session.user.role}'`);

          // Busca no DB para dados atualizados
          try {
            await connectToDatabase();
            const dbUser = await DbUser.findById(token.id)
                                       .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected')
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
               delete session.user?.planStatus;
               delete session.user?.instagramConnected;
               // ... outros
            }
          } catch (error) {
            logger.error(`${TAG_SESSION} Erro ao buscar/processar dados do usuário na sessão:`, error);
            if(session.user) {
                delete session.user.planStatus;
                delete session.user.instagramConnected;
                // ... etc
            }
          }
      } else {
          logger.error(`${TAG_SESSION} Erro: token.id ausente no token recebido. Retornando sessão vazia.`);
          return { ...session, user: undefined, expires: session.expires }; // Limpa o usuário
      }

      logger.debug(`${TAG_SESSION} Finalizado. Retornando session.user:`, JSON.stringify(session.user));
      return session;
    },

    // <<< CALLBACK REDIRECT MANTIDO >>>
    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      return `${baseUrl}/dashboard`;
    },
  },
  pages: { signIn: "/login", error: "/auth/error", }, // Garante que a página de erro está definida
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
