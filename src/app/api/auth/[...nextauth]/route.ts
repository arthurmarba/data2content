// src/app/api/auth/[...nextauth]/route.ts (vConnectAccount)
// - Modifica callback JWT para chamar connectInstagramAccount após fetch bem-sucedido.
// - Importa connectInstagramAccount de instagramService.
// - Remove uso de storeTemporaryLlat, cookie ig-connect-status e flag pendingInstagramConnection.

import NextAuth from "next-auth";
import type { DefaultSession, DefaultUser, NextAuthOptions, Session, User, Account } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Certifique-se que IUser inclui os campos de sync
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import { cookies } from 'next/headers';
import {
    fetchAvailableInstagramAccounts,
    connectInstagramAccount, // <<< IMPORTAÇÃO VERIFICADA E MANTIDA >>>
    AvailableInstagramAccount,
} from "@/app/lib/instagramService";
// import { storeTemporaryLlat } from "@/app/lib/tempTokenStorage"; // <<< REMOVIDO CONFORME PLANO (JÁ ESTAVA COMENTADO)

// --- AUGMENT NEXT-AUTH TYPES ---
// (Mantido como estava - pendingInstagramConnection já removido dos tipos conforme plano)
declare module "next-auth" {
    interface User extends DefaultUser {
        id: string;
        role?: string | null;
        provider?: string | null;
        planStatus?: string | null;
        planExpiresAt?: string | null;
        affiliateCode?: string | null;
        affiliateBalance?: number | null;
        affiliateRank?: number | null;
        affiliateInvites?: number | null;
        instagramConnected?: boolean | null;
        instagramAccountId?: string | null;
        instagramUsername?: string | null;
        availableIgAccounts?: AvailableInstagramAccount[] | null;
        igConnectionError?: string | null;
        image?: string | null;
        // pendingInstagramConnection?: boolean | null; // <<< REMOVIDO CONFORME PLANO (JÁ AUSENTE)
    }
    interface Session extends DefaultSession { user?: User; }
}
declare module "next-auth/jwt" {
     interface JWT {
         id: string;
         role?: string | null;
         provider?: string | null;
         availableIgAccounts?: AvailableInstagramAccount[] | null;
         igConnectionError?: string | null;
         name?: string | null;
         email?: string | null;
         picture?: string | null;
         image?: string | null;
         sub?: string;
         // pendingInstagramConnection?: boolean | null; // <<< REMOVIDO CONFORME PLANO (JÁ AUSENTE)
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

// --- Funções customEncode e customDecode ---
// (Mantidas como estavam)
async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
    const cleanToken = Object.entries(token ?? {}).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
    }, {} as Record<string, any>);
    if (!cleanToken.id) cleanToken.id = '';
    if (cleanToken.image && !cleanToken.picture) cleanToken.picture = cleanToken.image;
    return new SignJWT(cleanToken)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expirationTime)
        .sign(new TextEncoder().encode(secretString));
}

async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
    if (!token || !secret) {
        logger.error("customDecode: Token ou secret não fornecidos.");
        return null;
    }
    const secretString = typeof secret === "string" ? secret : String(secret);
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString), { algorithms: ["HS256"] });
        if (payload && typeof payload.id !== 'string') payload.id = '';
        if (payload && payload.picture && !payload.image) payload.image = payload.picture;
        return payload as JWT;
    } catch (err) {
        logger.error(`customDecode: Erro ao decodificar token HS256: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
// --- Fim Funções customEncode e customDecode ---


export const authOptions: NextAuthOptions = {
    // --- Configurações de Cookies e Providers ---
    // (Mantidas como estavam)
    useSecureCookies: process.env.NODE_ENV === "production",
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.session-token" : "next-auth.session-token",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" }
        },
        callbackUrl: {
            name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
            options: { sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" }
        },
        csrfToken: {
            name: process.env.NODE_ENV === 'production' ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" }
        },
    },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { scope: "openid email profile" } },
            profile(profile) {
                logger.debug("NextAuth: Google profile returned:", profile);
                return { id: profile.sub, name: profile.name, email: profile.email, image: profile.picture };
            }
        }),
        FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID!,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: [
                        'email', 'public_profile', 'pages_show_list',
                        'pages_read_engagement', 'instagram_basic',
                        'instagram_manage_insights', 'instagram_manage_comments'
                    ].join(','),
                    auth_type: 'rerequest',
                    display: 'popup',
                    config_id: process.env.FACEBOOK_LOGIN_CONFIG_ID!
                }
            },
            profile(profile) {
                logger.debug("NextAuth: Facebook profile returned:", profile);
                return {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture?.data?.url
                };
            }
        }),
        CredentialsProvider({
            name: "Demo",
            credentials: {
                username: { label: "Usuário", type: "text", placeholder: "demo" },
                password: { label: "Senha", type: "password", placeholder: "demo" }
            },
            async authorize(credentials) {
                if (credentials?.username === "demo" && credentials?.password === "demo") {
                    return { id: "demo-123", name: "Demo User", email: "demo@example.com" };
                }
                return null;
            }
        }),
    ],
    // --- Fim Configurações de Cookies e Providers ---

    jwt: {
        secret: process.env.NEXTAUTH_SECRET,
        encode: customEncode,
        decode: customDecode
    },
    callbacks: {
        // --- Callback signIn ---
        // (Mantido como estava)
        async signIn({ user, account, profile }) {
            const TAG_SIGNIN = '[NextAuth signIn Callback]';
            logger.debug(`${TAG_SIGNIN} Iniciado`, { userId: user.id, provider: account?.provider });

            if (account?.provider === 'credentials') {
                logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials.`);
                return true;
            }

            if (!account?.providerAccountId) {
                logger.error(`${TAG_SIGNIN} providerAccountId ausente para ${account?.provider}.`);
                return false;
            }

            const currentEmail = user.email;
            if (!currentEmail && account.provider !== 'facebook') {
                logger.error(`${TAG_SIGNIN} Email ausente para ${account.provider}.`);
                return false;
            }

            try {
                await connectToDatabase();
                let existing: IUser | null = null;

                if (account.provider === 'facebook') {
                    existing = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).exec();
                } else if (account.provider === 'google') {
                    existing = await DbUser.findOne({ providerAccountId: account.providerAccountId, provider: 'google' }).exec();
                }

                if (!existing && currentEmail) {
                    existing = await DbUser.findOne({ email: currentEmail }).exec();
                }

                if (existing) {
                    logger.info(`${TAG_SIGNIN} Usuário existente encontrado: ${existing._id} para provider ${account.provider}.`);
                    user.id = existing._id.toString();

                    let needsSave = false;
                    if (user.name && user.name !== existing.name) {
                        existing.name = user.name;
                        needsSave = true;
                    }
                    if (account.provider === 'facebook' && existing.facebookProviderAccountId !== account.providerAccountId) {
                        existing.facebookProviderAccountId = account.providerAccountId;
                        needsSave = true;
                    } else if (account.provider === 'google' && existing.providerAccountId !== account.providerAccountId) {
                        existing.providerAccountId = account.providerAccountId;
                        if (!existing.provider) existing.provider = 'google';
                        needsSave = true;
                    }
                    const providerImage = user.image;
                    if (providerImage && (!existing.image || account.provider !== 'facebook')) {
                       if (providerImage !== existing.image) {
                           existing.image = providerImage;
                           needsSave = true;
                       }
                    }

                    if (needsSave) {
                        await existing.save();
                        logger.info(`${TAG_SIGNIN} Usuário existente ${existing._id} atualizado.`);
                    }
                    return true;
                }

                if (account.provider === 'google') {
                    if (!currentEmail) {
                         logger.error(`${TAG_SIGNIN} Email ausente ao tentar criar usuário Google.`);
                         return false;
                    }
                    logger.info(`${TAG_SIGNIN} Criando novo usuário Google para ${currentEmail}...`);
                    const newUser = new DbUser({
                        name: user.name, email: currentEmail, image: user.image,
                        provider: 'google', providerAccountId: account.providerAccountId,
                        role: 'user', isInstagramConnected: false
                    });
                    const saved = await newUser.save();
                    user.id = saved._id.toString();
                    logger.info(`${TAG_SIGNIN} Novo usuário Google criado: ${user.id}`);
                    return true;
                }

                if (account.provider === 'facebook') {
                     logger.warn(`${TAG_SIGNIN} Usuário não encontrado para Facebook no signIn. Permitindo fluxo para JWT (vinculação ou falha).`);
                     return true; // Permite que o callback JWT trate a criação/vinculação
                }

                logger.error(`${TAG_SIGNIN} Provedor ${account.provider} não resultou em criação ou login.`);
                return false;

            } catch (error) {
                 logger.error(`${TAG_SIGNIN} Erro no DB durante signIn (${account?.provider}):`, error);
                 return false;
            }
        },
        // --- Fim Callback signIn ---

        // --- Callback jwt ---
        async jwt({ token, user, account, trigger }) {
            const TAG_JWT = '[NextAuth JWT Callback]';
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Provider: ${account?.provider}. UserID: ${user?.id}. TokenInID: ${token?.id}`);

            let currentToken: Partial<JWT> = {
                id: token.id, name: token.name, email: token.email, image: token.image,
                role: token.role, provider: token.provider, sub: token.sub
            };
            delete currentToken.igConnectionError;
            delete currentToken.availableIgAccounts;

            const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';

            if (isSignInOrSignUp && account) {
                if (account.provider === 'facebook') {
                    logger.debug(`${TAG_JWT} Processando login/vinculação Facebook...`);
                    let userId = ''; 

                    try {
                        const authLink = cookies().get('auth-link-token')?.value;
                        if (authLink) {
                            logger.info(`${TAG_JWT} Cookie 'auth-link-token' encontrado.`);
                            cookies().delete('auth-link-token'); 
                            await connectToDatabase();
                            const linkDoc = await DbUser.findOne({ linkToken: authLink, linkTokenExpiresAt: { $gt: new Date() } }).lean();
                            if (linkDoc) {
                                userId = linkDoc._id.toString();
                                logger.info(`${TAG_JWT} Usuário ${userId} identificado via linkToken.`);
                                await DbUser.updateOne({ _id: linkDoc._id }, { $unset: { linkToken: '', linkTokenExpiresAt: '' } });
                            } else {
                                logger.warn(`${TAG_JWT} Link token do cookie inválido ou expirado.`);
                            }
                        } else {
                             logger.debug(`${TAG_JWT} Cookie 'auth-link-token' não encontrado.`);
                        }
                    } catch (e) { logger.error(`${TAG_JWT} Erro ao processar link token:`, e); }

                    if (!userId && account.providerAccountId) {
                        logger.debug(`${TAG_JWT} Tentando encontrar usuário pelo facebookProviderAccountId: ${account.providerAccountId}`);
                        await connectToDatabase();
                        const doc = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).lean().exec();
                        if (doc) {
                            userId = doc._id.toString();
                            logger.info(`${TAG_JWT} Usuário ${userId} identificado via facebookProviderAccountId.`);
                        } else {
                             logger.warn(`${TAG_JWT} Nenhum usuário encontrado para facebookProviderAccountId ${account.providerAccountId}.`);
                             if (user?.id && Types.ObjectId.isValid(user.id)){
                                logger.info(`${TAG_JWT} Utilizando user.id (${user.id}) fornecido pelo fluxo NextAuth para novo usuário Facebook.`);
                                userId = user.id;
                                const userForFbId = await DbUser.findById(userId);
                                if(userForFbId && !userForFbId.facebookProviderAccountId){
                                    userForFbId.facebookProviderAccountId = account.providerAccountId;
                                    if (user.name && userForFbId.name !== user.name) userForFbId.name = user.name;
                                    if (user.email && userForFbId.email !== user.email) userForFbId.email = user.email;
                                    if (user.image && userForFbId.image !== user.image) userForFbId.image = user.image;
                                    await userForFbId.save();
                                    logger.info(`${TAG_JWT} Novo usuário ${userId} atualizado com facebookProviderAccountId.`);
                                }
                             } else {
                                logger.error(`${TAG_JWT} Usuário não identificado e não há user.id válido para criar/vincular conta Facebook.`);
                             }
                        }
                    }

                    if (userId && account.access_token) {
                        logger.info(`${TAG_JWT} Chamando fetchAvailableInstagramAccounts para User ${userId}...`);
                        try {
                            const result = await fetchAvailableInstagramAccounts(account.access_token, userId);

                            // ============================================================
                            // == INÍCIO DO BLOCO MODIFICADO CONFORME PLANO DE ATUALIZAÇÃO ==
                            // ============================================================
                            if (result.success) {
                                logger.info(`${TAG_JWT} fetchAvailableInstagramAccounts retornou sucesso. Contas: ${result.accounts?.length ?? 0}. LLAT Obtido: ${!!result.longLivedAccessToken}`);
                                currentToken.availableIgAccounts = result.accounts; // <<< Manter: Popula currentToken.availableIgAccounts
                                const userLongLivedAccessToken = result.longLivedAccessToken; // <<< Extrair LLAT do Usuário

                                // Lógica de estado pendente (cookie, flag pendingInstagramConnection, storeTemporaryLlat) removida conforme plano.

                                // Implementar Nova Lógica de Conexão Automática:
                                if (result.accounts && result.accounts.length > 0) {
                                    const firstAccount = result.accounts[0];
                                    if (firstAccount && firstAccount.igAccountId) {
                                        logger.info(`${TAG_JWT} Tentando conectar automaticamente a primeira conta encontrada: ${firstAccount.igAccountId} para User ${userId}`);

                                        if (userLongLivedAccessToken) { // Garante que temos o LLAT antes de tentar conectar
                                            // Chama a função para atualizar o DB e salvar o LLAT (assíncrono)
                                            connectInstagramAccount(userId, firstAccount.igAccountId, userLongLivedAccessToken) // <<< PASSA O LLAT AQUI
                                                .then(connectResult => {
                                                    if (!connectResult.success) {
                                                        logger.error(`${TAG_JWT} Falha ao chamar connectInstagramAccount (async) para ${userId}: ${connectResult.error}`);
                                                        // Opcional: Adicionar um erro específico ao token se a atualização do DB falhar?
                                                        // currentToken.igConnectionError = connectResult.error || "Falha ao salvar conexão no DB.";
                                                    } else {
                                                        logger.info(`${TAG_JWT} connectInstagramAccount chamado com sucesso (async) para ${userId}. O status será refletido na próxima leitura da sessão.`);
                                                    }
                                                })
                                                .catch(err => {
                                                     logger.error(`${TAG_JWT} Erro não capturado ao chamar connectInstagramAccount (async) para ${userId}:`, err);
                                                     // currentToken.igConnectionError = "Erro inesperado ao iniciar conexão IG.";
                                                });
                                        } else {
                                            logger.warn(`${TAG_JWT} Contas IG encontradas (${firstAccount.igAccountId}), mas Long-Lived Access Token (LLAT) ausente. Não é possível conectar automaticamente User ${userId}.`);
                                            currentToken.igConnectionError = "Token de acesso de longa duração do Instagram não obtido para conectar.";
                                        }
                                    } else {
                                         logger.warn(`${TAG_JWT} Lista de contas retornada, mas o primeiro elemento é inválido ou não possui igAccountId.`);
                                         currentToken.igConnectionError = "Erro ao processar lista de contas Instagram.";
                                    }
                                } else {
                                    logger.warn(`${TAG_JWT} fetchAvailableInstagramAccounts retornou sucesso mas sem contas IG disponíveis.`);
                                    currentToken.igConnectionError = "Nenhuma conta Instagram encontrada para vincular.";
                                }
                            } else {
                                // Se fetchAvailableInstagramAccounts falhou
                                logger.error(`${TAG_JWT} fetchAvailableInstagramAccounts falhou para User ${userId}: ${result.error}`);
                                currentToken.igConnectionError = result.error || "Falha ao buscar contas do Instagram.";
                            }
                            // ============================================================
                            // == FIM DO BLOCO MODIFICADO                              ==
                            // ============================================================
                        } catch (error) {
                            logger.error(`${TAG_JWT} Exceção ao chamar fetchAvailableInstagramAccounts ou processar conexão IG para User ${userId}:`, error);
                            currentToken.igConnectionError = error instanceof Error ? error.message : "Erro inesperado no processo de conexão IG.";
                        }
                    } else if (!userId) {
                         logger.error(`${TAG_JWT} Não foi possível identificar o usuário do DB para vincular a conta Facebook.`);
                         currentToken.igConnectionError = "Usuário não identificado para vincular.";
                    } else if (!account.access_token) {
                         logger.error(`${TAG_JWT} Access token do Facebook (SLT) ausente no callback jwt para User ${userId}.`);
                         currentToken.igConnectionError = "Token do Facebook ausente.";
                    }

                    currentToken.id = userId; 
                    currentToken.provider = 'facebook';

                } else { // Provedor Google ou Credentials
                    logger.debug(`${TAG_JWT} Processando login inicial com ${account.provider}.`);
                    if (user?.id && Types.ObjectId.isValid(user.id)) {
                        currentToken.id = user.id;
                        currentToken.provider = account.provider;
                        currentToken.name = user.name;
                        currentToken.email = user.email;
                        currentToken.image = user.image;
                        try {
                            await connectToDatabase();
                            const doc = await DbUser.findById(currentToken.id).select('role').lean();
                            currentToken.role = doc?.role ?? 'user';
                        } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar role (${account.provider}) para ${currentToken.id}:`, error); currentToken.role = 'user'; }
                    } else {
                         logger.error(`${TAG_JWT} ID do usuário inválido ou ausente para ${account.provider}: '${user?.id}'. Invalidando token.`);
                         currentToken.id = ''; 
                    }
                }
            } 

            const finalUserId = currentToken.id || token.id; 

            if (finalUserId && typeof finalUserId === 'string' && Types.ObjectId.isValid(finalUserId)) {
                currentToken.id = finalUserId; 
                currentToken.sub = finalUserId;

                if (!currentToken.name || !currentToken.email || !currentToken.image || !currentToken.role || !currentToken.provider) {
                    logger.debug(`${TAG_JWT} ID ${finalUserId} válido. Verificando/Preenchendo dados do DB no token...`);
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(finalUserId).select('name email image role provider facebookProviderAccountId').lean();
                        if (dbUser) {
                            if (!currentToken.name) currentToken.name = dbUser.name;
                            if (!currentToken.email) currentToken.email = dbUser.email;
                            if (!currentToken.image) currentToken.image = dbUser.image;
                            if (!currentToken.role) currentToken.role = dbUser.role ?? 'user';
                            if (!currentToken.provider) {
                                currentToken.provider = dbUser.provider ?? (dbUser.facebookProviderAccountId ? 'facebook' : undefined);
                            }
                        } else {
                            logger.warn(`${TAG_JWT} Usuário ${finalUserId} não encontrado no DB para preencher token.`);
                            currentToken.id = ''; 
                        }
                    } catch (error) {
                        logger.error(`${TAG_JWT} Erro ao buscar dados do DB para preencher token para ${finalUserId}:`, error);
                    }
                }
            } else if (trigger !== 'signUp' && trigger !== 'signIn') { 
                logger.warn(`${TAG_JWT} ID final inválido ou vazio ('${finalUserId}') fora do fluxo de login. Limpando token.`);
                return {} as JWT; 
            }

            logger.debug(`${TAG_JWT} Finalizado. Retornando token:`, {
                id: currentToken.id, role: currentToken.role, provider: currentToken.provider,
                email: currentToken.email, name: currentToken.name, sub: currentToken.sub,
                availableIgAccounts: currentToken.availableIgAccounts?.length,
                igConnectionError: currentToken.igConnectionError
            });
            return currentToken as JWT;
        },
        // --- Fim Callback jwt ---

        // --- Callback session ---
        // (Mantido como estava, mas revisado para consistência e remoção de pendingInstagramConnection)
        async session({ session, token }) {
             const TAG_SESSION = '[NextAuth Session Callback]';
             logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token Sub: ${token?.sub}`);

             if (!token?.id || typeof token.id !== 'string' || !Types.ObjectId.isValid(token.id)) {
                 logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}'). Retornando sessão sem usuário.`);
                 return { ...session, user: undefined, expires: session.expires }; 
             }

             session.user = {
                 id: token.id,
                 name: token.name ?? undefined,
                 email: token.email ?? undefined,
                 image: token.image ?? token.picture ?? undefined, 
                 role: token.role ?? 'user',
                 provider: token.provider,
                 availableIgAccounts: token.availableIgAccounts,
                 igConnectionError: token.igConnectionError,
                 instagramConnected: false, 
                 instagramAccountId: undefined,
                 instagramUsername: undefined,
                 planStatus: 'inactive', 
                 planExpiresAt: null,
                 affiliateCode: undefined,
                 affiliateBalance: 0,
                 affiliateRank: 1,
                 affiliateInvites: 0,
                 // pendingInstagramConnection: false, // <<< REMOVIDO CONFORME PLANO (JÁ AUSENTE/COMENTADO)
             };

             try {
                 await connectToDatabase();
                 const dbUser = await DbUser.findById(token.id)
                     .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected instagramAccountId username') // 'username' aqui é o instagramUsername
                     .lean();

                 if (dbUser && session.user) {
                     logger.debug(`${TAG_SESSION} Usuário ${token.id} encontrado no DB. Atualizando sessão.`);
                     session.user.name = dbUser.name ?? session.user.name;
                     session.user.email = dbUser.email ?? session.user.email;
                     session.user.image = dbUser.image ?? session.user.image;
                     session.user.role = dbUser.role ?? session.user.role;
                     session.user.planStatus = dbUser.planStatus ?? 'inactive';
                     session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date ? dbUser.planExpiresAt.toISOString() : null;
                     session.user.affiliateCode = dbUser.affiliateCode ?? undefined;
                     session.user.affiliateBalance = dbUser.affiliateBalance ?? 0;
                     session.user.affiliateRank = dbUser.affiliateRank ?? 1;
                     session.user.affiliateInvites = dbUser.affiliateInvites ?? 0;
                     session.user.instagramConnected = dbUser.isInstagramConnected ?? false;
                     session.user.instagramAccountId = dbUser.instagramAccountId ?? undefined;
                     session.user.instagramUsername = dbUser.username ?? undefined; 

                     if (session.user.instagramConnected) {
                        delete session.user.igConnectionError;
                     }
                     logger.debug(`${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, IG Connected: ${session.user.instagramConnected}`);

                 } else if (session.user) {
                      logger.error(`${TAG_SESSION} Usuário ${token.id} não encontrado no DB ao popular sessão. Sessão pode estar incompleta.`);
                      session.user.igConnectionError = session.user.igConnectionError || "Falha ao carregar dados completos do usuário.";
                 }
             } catch (error) {
                  logger.error(`${TAG_SESSION} Erro ao buscar dados do usuário ${token.id} na sessão:`, error);
                   if(session.user) {
                     session.user.igConnectionError = session.user.igConnectionError || "Erro ao carregar dados do usuário.";
                   }
             }
             return session;
         },
        // --- Fim Callback session ---

        // --- Callback redirect ---
        // (Mantido como estava)
        async redirect({ baseUrl }) {
            return `${baseUrl}/dashboard`;
        }
        // --- Fim Callback redirect ---
    },
    pages: {
        signIn: '/login',
        error: '/auth/error'
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60 // 30 days
    }
};

// Exporta o handler do NextAuth
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
