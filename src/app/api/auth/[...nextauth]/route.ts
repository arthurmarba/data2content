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
    connectInstagramAccount, // <<< IMPORTA A NOVA FUNÇÃO >>>
    AvailableInstagramAccount,
} from "@/app/lib/instagramService";
// import { storeTemporaryLlat } from "@/app/lib/tempTokenStorage"; // REMOVIDO

// --- AUGMENT NEXT-AUTH TYPES ---
// (Mantido como estava)
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
        instagramConnected?: boolean | null; // Será atualizado pelo callback session a partir do DB
        instagramAccountId?: string | null; // Será atualizado pelo callback session a partir do DB
        instagramUsername?: string | null; // Será atualizado pelo callback session a partir do DB
        // pendingInstagramConnection?: boolean | null; // Removido/Obsoleto
        availableIgAccounts?: AvailableInstagramAccount[] | null; // Vem do JWT
        igConnectionError?: string | null; // Vem do JWT
        image?: string | null;
    }
    interface Session extends DefaultSession { user?: User; }
}
declare module "next-auth/jwt" {
     interface JWT {
         id: string;
         role?: string | null;
         provider?: string | null;
         // pendingInstagramConnection?: boolean | null; // Removido/Obsoleto
         availableIgAccounts?: AvailableInstagramAccount[] | null;
         igConnectionError?: string | null;
         name?: string | null;
         email?: string | null;
         picture?: string | null; // Mantido por compatibilidade
         image?: string | null;   // Usado preferencialmente
         sub?: string;
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
        // (Mantido como estava - não cria usuário FB aqui)
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
                     return true;
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
        // (MODIFICADO para chamar connectInstagramAccount)
        async jwt({ token, user, account, trigger }) {
            const TAG_JWT = '[NextAuth JWT Callback]';
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Provider: ${account?.provider}. UserID: ${user?.id}. TokenInID: ${token?.id}`);

            // Limpa campos potencialmente obsoletos do token a cada chamada
            let currentToken: Partial<JWT> = {
                id: token.id, name: token.name, email: token.email, image: token.image,
                role: token.role, provider: token.provider, sub: token.sub
            };

            const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';

            // 1. Durante o login/signup inicial com um provedor OAuth
            if (isSignInOrSignUp && account) {
                if (account.provider === 'facebook') {
                    logger.debug(`${TAG_JWT} Processando login/vinculação Facebook...`);
                    let userId = ''; // ID do usuário do NOSSO banco de dados

                    // Tenta encontrar o usuário pelo linkToken (vinculação explícita)
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

                    // Se não encontrou pelo linkToken, tenta pelo ID do Facebook (login normal/já vinculado)
                    if (!userId && account.providerAccountId) {
                        logger.debug(`${TAG_JWT} Tentando encontrar usuário pelo facebookProviderAccountId: ${account.providerAccountId}`);
                        await connectToDatabase();
                        const doc = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).lean().exec();
                        if (doc) {
                            userId = doc._id.toString();
                            logger.info(`${TAG_JWT} Usuário ${userId} identificado via facebookProviderAccountId.`);
                        } else {
                             logger.warn(`${TAG_JWT} Nenhum usuário encontrado para facebookProviderAccountId ${account.providerAccountId}.`);
                        }
                    }

                    // Se encontramos um userId (seja por linkToken ou ID do FB) e temos o SLT
                    if (userId && account.access_token) {
                        logger.info(`${TAG_JWT} Chamando fetchAvailableInstagramAccounts para User ${userId}...`);
                        const result = await fetchAvailableInstagramAccounts(account.access_token, userId);

                        // ============================================================
                        // == INÍCIO DO BLOCO MODIFICADO / SUBSTITUÍDO               ==
                        // ============================================================
                        if (result.success) {
                            logger.info(`${TAG_JWT} fetchAvailableInstagramAccounts retornou sucesso. Contas: ${result.accounts.length}`);
                            currentToken.availableIgAccounts = result.accounts; // Mantém a lista no token (para UI, se necessário)
                            const userLongLivedAccessToken = result.longLivedAccessToken; // <<< Pega o LLAT retornado

                            // <<< NOVA LÓGICA PARA CONECTAR AUTOMATICAMENTE >>>
                            if (result.accounts.length > 0) {
                                const firstAccount = result.accounts[0];
                                if (firstAccount && firstAccount.igAccountId) {
                                    logger.info(`${TAG_JWT} Tentando conectar automaticamente a primeira conta encontrada: ${firstAccount.igAccountId} para User ${userId}`);

                                    // Chama a função para atualizar o DB e salvar o LLAT (assíncrono)
                                    connectInstagramAccount(userId, firstAccount.igAccountId, userLongLivedAccessToken) // <<< Passa o LLAT
                                        .then(connectResult => {
                                            if (!connectResult.success) {
                                                logger.error(`${TAG_JWT} Falha ao chamar connectInstagramAccount (async) para ${userId}: ${connectResult.error}`);
                                                // Opcional: Definir erro no token se a atualização do DB falhar
                                                // currentToken.igConnectionError = connectResult.error || "Falha ao salvar conexão no DB.";
                                            } else {
                                                logger.info(`${TAG_JWT} connectInstagramAccount chamado com sucesso (async) para ${userId}.`);
                                            }
                                        })
                                        .catch(err => {
                                             logger.error(`${TAG_JWT} Erro não capturado ao chamar connectInstagramAccount (async) para ${userId}:`, err);
                                             // currentToken.igConnectionError = "Erro inesperado ao iniciar conexão IG.";
                                        });
                                } else {
                                     logger.warn(`${TAG_JWT} Lista de contas retornada, mas o primeiro elemento é inválido ou não possui igAccountId.`);
                                     currentToken.igConnectionError = "Erro ao processar lista de contas Instagram.";
                                }
                            } else {
                                logger.warn(`${TAG_JWT} fetchAvailableInstagramAccounts retornou sucesso mas sem contas IG disponíveis.`);
                                currentToken.igConnectionError = "Nenhuma conta Instagram encontrada para vincular.";
                            }
                            // <<< FIM DA NOVA LÓGICA DE CONEXÃO AUTOMÁTICA >>>

                        } else {
                            // Se fetchAvailableInstagramAccounts falhou
                            logger.error(`${TAG_JWT} fetchAvailableInstagramAccounts falhou: ${result.error}`);
                            currentToken.igConnectionError = result.error; // Propaga o erro para o token
                        }
                        // ============================================================
                        // == FIM DO BLOCO MODIFICADO / SUBSTITUÍDO                 ==
                        // ============================================================

                    } else if (!userId) {
                         logger.error(`${TAG_JWT} Não foi possível identificar o usuário do DB para vincular a conta Facebook.`);
                         currentToken.igConnectionError = "Usuário não identificado para vincular.";
                    } else if (!account.access_token) {
                         logger.error(`${TAG_JWT} Access token do Facebook (SLT) ausente no callback jwt.`);
                         currentToken.igConnectionError = "Token do Facebook ausente.";
                    }

                    // Define o ID no token como o userId encontrado (pode ser vazio se falhou a identificação)
                    currentToken.id = userId;
                    currentToken.provider = 'facebook'; // Garante que o provider seja definido

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
                        } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar role (${account.provider}):`, error); currentToken.role = 'user'; }
                    } else {
                         logger.error(`${TAG_JWT} ID do usuário inválido ou ausente para ${account.provider}: '${user?.id}'. Invalidando token.`);
                         currentToken.id = '';
                    }
                }
            }

            // 2. Em requisições subsequentes ou após processar login inicial
            const finalUserId = currentToken.id;
            if (finalUserId && typeof finalUserId === 'string' && Types.ObjectId.isValid(finalUserId)) {
                currentToken.sub = finalUserId;
                if (!currentToken.role) {
                     logger.debug(`${TAG_JWT} Buscando role para token existente (ID: ${finalUserId})...`);
                     try {
                         await connectToDatabase();
                         const dbUser = await DbUser.findById(finalUserId).select('role').lean();
                         currentToken.role = dbUser?.role ?? 'user';
                     } catch (error) {
                         logger.error(`${TAG_JWT} Erro ao buscar role para token existente:`, error);
                         currentToken.role = 'user';
                     }
                }
                if (!currentToken.provider) {
                    logger.debug(`${TAG_JWT} Buscando provider para token existente (ID: ${finalUserId})...`);
                     try {
                         await connectToDatabase();
                         const dbUser = await DbUser.findById(finalUserId).select('provider facebookProviderAccountId').lean();
                         if (dbUser?.provider) { currentToken.provider = dbUser.provider; }
                         else if (dbUser?.facebookProviderAccountId) { currentToken.provider = 'facebook'; }
                         else { logger.warn(`${TAG_JWT} Não foi possível determinar o provider para o usuário ${finalUserId}`); }
                     } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar provider para token existente:`, error); }
                }
            } else {
                logger.warn(`${TAG_JWT} ID final inválido ou vazio ('${finalUserId}'). Limpando sub, role e id.`);
                delete currentToken.sub;
                currentToken.role = undefined;
                currentToken.id = '';
            }

            logger.debug(`${TAG_JWT} Finalizado. Retornando token:`, { id: currentToken.id, role: currentToken.role, provider: currentToken.provider, email: currentToken.email, name: currentToken.name, sub: currentToken.sub, availableIgAccounts: currentToken.availableIgAccounts?.length, igConnectionError: currentToken.igConnectionError });
            return currentToken as JWT;
        },
        // --- Fim Callback jwt ---

        // --- Callback session ---
        // (Mantido como estava)
        async session({ session, token }) {
             // ... (código inalterado) ...
             const TAG_SESSION = '[NextAuth Session Callback]';
             logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}`);
             if (!token?.id || typeof token.id !== 'string' || !Types.ObjectId.isValid(token.id)) {
                 logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}'). Retornando sessão sem usuário.`);
                 return { ...session, user: undefined };
             }
             session.user = {
                 id: token.id, name: token.name ?? undefined, email: token.email ?? undefined,
                 image: token.image ?? token.picture ?? undefined, provider: token.provider, role: token.role ?? 'user',
                 availableIgAccounts: token.availableIgAccounts, igConnectionError: token.igConnectionError,
                 instagramConnected: undefined, instagramAccountId: undefined, instagramUsername: undefined,
                 planStatus: undefined, planExpiresAt: undefined, affiliateCode: undefined,
                 affiliateBalance: undefined, affiliateRank: undefined, affiliateInvites: undefined,
                 // pendingInstagramConnection: false, // Removido do tipo JWT, pode remover daqui também se não usado
             };
             try {
                 await connectToDatabase();
                 const dbUser = await DbUser.findById(token.id).select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected instagramAccountId username').lean();
                 if (dbUser && session.user) {
                     logger.debug(`${TAG_SESSION} Usuário ${token.id} encontrado no DB. Atualizando sessão.`);
                     session.user.name = dbUser.name ?? session.user.name; session.user.email = dbUser.email ?? session.user.email;
                     session.user.image = dbUser.image ?? session.user.image; session.user.role = dbUser.role ?? session.user.role;
                     session.user.planStatus = dbUser.planStatus ?? 'inactive'; session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date ? dbUser.planExpiresAt.toISOString() : null;
                     session.user.affiliateCode = dbUser.affiliateCode ?? undefined; session.user.affiliateBalance = dbUser.affiliateBalance ?? 0;
                     session.user.affiliateRank = dbUser.affiliateRank ?? 1; session.user.affiliateInvites = dbUser.affiliateInvites ?? 0;
                     session.user.instagramConnected = dbUser.isInstagramConnected ?? false; session.user.instagramAccountId = dbUser.instagramAccountId ?? undefined;
                     session.user.instagramUsername = dbUser.username ?? undefined;
                     logger.debug(`${TAG_SESSION} Finalizado. Retornando session.user ID: ${session.user?.id}, IG Connected: ${session.user.instagramConnected}`);

                 } else if (session.user) {
                      logger.error(`${TAG_SESSION} Usuário ${token.id} não encontrado no DB ao popular sessão.`);
                      delete session.user.planStatus; delete session.user.instagramConnected; /* etc */
                 }
             } catch (error) {
                  logger.error(`${TAG_SESSION} Erro ao buscar dados do usuário ${token.id} na sessão:`, error);
                   if(session.user) { delete session.user.planStatus; delete session.user.instagramConnected; /* etc */ }
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
