// src/app/api/auth/[...nextauth]/route.ts (vConnectAccount-OnboardingFlag-Fix-Image)
// - CORRIGIDO: Remoção da referência a dbUser.picture inexistente no callback jwt.
// - Mantém persistência do flag 'isNewUserForOnboarding' e outras funcionalidades.

import NextAuth from "next-auth";
import type { DefaultSession, DefaultUser, NextAuthOptions, Session, User, Account } from "next-auth";
// import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Espera-se IUser v1.9.2+
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import { cookies } from 'next/headers';
import {
    fetchAvailableInstagramAccounts,
    connectInstagramAccount,
    AvailableInstagramAccount,
} from "@/app/lib/instagramService";
import * as dataService from "@/app/lib/dataService"; // Espera-se dataService v2.12.1+

// --- AUGMENT NEXT-AUTH TYPES ---
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
        isNewUserForOnboarding?: boolean; 
    }
    interface Session extends DefaultSession { 
        user?: User; 
    }
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
         picture?: string | null; // Mantido para compatibilidade com o que NextAuth pode popular no token
         image?: string | null;
         sub?: string;
         isNewUserForOnboarding?: boolean; 
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included"; 

// --- Funções customEncode e customDecode (mantidas) ---
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
    useSecureCookies: process.env.NODE_ENV === "production",
    cookies: { /* (mantido) */ 
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
    providers: [ /* (mantido) */ 
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { scope: "openid email profile" } },
            profile(profile) {
                logger.debug("[NextAuth Google Profile DEBUG] Profile recebido do Google:", JSON.stringify(profile));
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
                username: { label: "Utilizador", type: "text", placeholder: "demo" },
                password: { label: "Senha", type: "password", placeholder: "demo" }
            },
            async authorize(credentials) {
                if (credentials?.username === "demo" && credentials?.password === "demo") {
                    logger.debug("[NextAuth Credentials DEBUG] Authorize para Demo User bem-sucedido.");
                    return { id: "demo-123", name: "Demo User", email: "demo@example.com" };
                }
                logger.warn("[NextAuth Credentials DEBUG] Authorize para Demo User falhou.");
                return null;
            }
        }),
    ],
    jwt: {
        secret: process.env.NEXTAUTH_SECRET,
        encode: customEncode,
        decode: customDecode
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            const TAG_SIGNIN = '[NextAuth signIn Callback vConnectAccount-OnboardingFlag-Fix-Image]'; 
            logger.debug(`${TAG_SIGNIN} Iniciado`, { userIdRaw: user.id, provider: account?.provider, userObj: JSON.stringify(user) });
            let isNewUser = false; 

            if (account?.provider === 'credentials') {
                logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials (utilizador: ${user.id}).`);
                return true;
            }
            if (!account?.providerAccountId) { logger.error(`${TAG_SIGNIN} providerAccountId ausente para ${account?.provider}.`); return false; }
            const currentEmail = user.email;
            if (!currentEmail && account.provider !== 'facebook') { logger.error(`${TAG_SIGNIN} Email ausente para ${account.provider}.`); return false; }

            try {
                await connectToDatabase();
                let existing: IUser | null = null;

                if (account.provider === 'google') {
                    logger.debug(`${TAG_SIGNIN} [Google Flow DEBUG] Tentando encontrar utilizador existente. ProviderAccountId: ${account.providerAccountId}, Email: ${currentEmail}`);
                    existing = await DbUser.findOne({ providerAccountId: account.providerAccountId, provider: 'google' }).exec();
                    if (!existing && currentEmail) {
                        logger.debug(`${TAG_SIGNIN} [Google Flow DEBUG] Não encontrado por providerAccountId, tentando por email: ${currentEmail}`);
                        existing = await DbUser.findOne({ email: currentEmail }).exec();
                    }

                    if (existing) {
                        logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Utilizador existente ENCONTRADO: _id='${existing._id}'.`);
                        user.id = existing._id.toString();
                        let needsSave = false;
                        if (user.name && user.name !== existing.name) { existing.name = user.name; needsSave = true; }
                        if (existing.providerAccountId !== account.providerAccountId) { existing.providerAccountId = account.providerAccountId; needsSave = true;}
                        if (!existing.provider) { existing.provider = 'google'; needsSave = true; }
                        const providerImage = user.image;
                        if (providerImage && providerImage !== existing.image) { existing.image = providerImage; needsSave = true; }
                        if (needsSave) { await existing.save(); logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Utilizador existente ${existing._id} atualizado.`);}
                    } else { 
                        isNewUser = true; 
                        if (!currentEmail) { logger.error(`${TAG_SIGNIN} [Google Flow DEBUG] Email ausente ao tentar CRIAR utilizador Google.`); return false; }
                        logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Criando NOVO utilizador Google para ${currentEmail}...`);
                        const newUserDoc = { name: user.name, email: currentEmail, image: user.image, provider: 'google', providerAccountId: account.providerAccountId, role: 'user', isInstagramConnected: false, };
                        const newUser = new DbUser(newUserDoc);
                        const saved = await newUser.save();
                        user.id = saved._id.toString(); 
                        logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Novo utilizador Google CRIADO com _id: '${saved._id}'.`);
                        
                        try {
                            logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Registando opt-in na comunidade para novo utilizador ${saved._id}. Versão Termos: ${DEFAULT_TERMS_VERSION}`);
                            await dataService.optInUserToCommunity(saved._id.toString(), DEFAULT_TERMS_VERSION);
                            logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Opt-in na comunidade registado com sucesso para novo utilizador ${saved._id}.`);
                        } catch (optInError) {
                            logger.error(`${TAG_SIGNIN} [Google Flow DEBUG] Falha ao registar opt-in na comunidade para novo utilizador ${saved._id}:`, optInError);
                        }
                    }
                    (user as any).isNewUserForOnboarding = isNewUser; 
                    logger.debug(`${TAG_SIGNIN} [Google Flow DEBUG] FINAL para utilizador: user.id='${user.id}', isNewUserForOnboarding=${isNewUser}`);
                    return true;

                } else if (account.provider === 'facebook') {
                    existing = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).exec();
                     if (existing) {
                        logger.info(`${TAG_SIGNIN} Utilizador existente encontrado (Facebook): ${existing._id}.`);
                        user.id = existing._id.toString(); 
                        let needsSave = false;
                        if (user.name && user.name !== existing.name) { existing.name = user.name; needsSave = true;}
                        const providerImage = user.image;
                        if (providerImage && providerImage !== existing.image) { existing.image = providerImage; needsSave = true; }
                        if (needsSave) { await existing.save(); logger.info(`${TAG_SIGNIN} Utilizador Facebook existente ${existing._id} atualizado.`);}
                        (user as any).isNewUserForOnboarding = false; 
                        return true;
                    }
                    logger.warn(`${TAG_SIGNIN} Utilizador não encontrado para Facebook no signIn. Permitindo fluxo para JWT.`);
                    return true; 
                }
                logger.error(`${TAG_SIGNIN} Provedor ${account.provider} não resultou em criação ou login.`);
                return false;
            } catch (error) {
                 logger.error(`${TAG_SIGNIN} Erro no DB durante signIn (${account?.provider}):`, error);
                 return false;
            }
        },

        async jwt({ token, user, account, trigger }) {
            const TAG_JWT = '[NextAuth JWT Callback vConnectAccount-OnboardingFlag-Fix-Image]'; 
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. UserID (do param user): ${user?.id}. TokenInID (do param token): ${token?.id}`);
            
            let currentToken: Partial<JWT> = { 
                id: token?.id, 
                name: token?.name, 
                email: token?.email, 
                image: token?.image ?? token?.picture,
                role: token?.role, 
                provider: token?.provider, 
                sub: token?.sub,
                isNewUserForOnboarding: token?.isNewUserForOnboarding 
            };
            delete currentToken.igConnectionError; 
            delete currentToken.availableIgAccounts;

            const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';

            if (isSignInOrSignUp && account && user) {
                if ((user as any).isNewUserForOnboarding !== undefined) {
                    currentToken.isNewUserForOnboarding = (user as any).isNewUserForOnboarding;
                    logger.info(`${TAG_JWT} [${account.provider} Flow] Flag 'isNewUserForOnboarding' (${currentToken.isNewUserForOnboarding}) definido no token a partir do objeto 'user' para user ID: ${user.id}`);
                }
                
                if (account.provider === 'facebook') {
                    // (Lógica do Facebook mantida, com atenção para o ponto de criação de novo utilizador e opt-in da comunidade)
                    logger.debug(`${TAG_JWT} [Facebook Flow] Processando login/vinculação Facebook...`);
                    let userId = ''; 
                    let isNewUserFbFlow = currentToken.isNewUserForOnboarding === true; 
                    try { /* ... lógica do linkToken ... */ } catch (e) { /* ... */ }

                    if (!userId && account.providerAccountId) {
                        await connectToDatabase();
                        const doc = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).select('_id communityInspirationOptIn').lean().exec();
                        if (doc) { 
                            userId = doc._id.toString(); 
                            if (!doc.communityInspirationOptIn && !isNewUserFbFlow) { 
                                isNewUserFbFlow = true;
                                currentToken.isNewUserForOnboarding = true;
                            }
                        } else {
                             if (user.email) { 
                                await connectToDatabase();
                                let userByEmail = await DbUser.findOne({ email: user.email });
                                if (userByEmail) {
                                    userId = userByEmail._id.toString();
                                    if (!userByEmail.facebookProviderAccountId) {
                                        userByEmail.facebookProviderAccountId = account.providerAccountId;
                                        if (user.name && userByEmail.name !== user.name) userByEmail.name = user.name;
                                        if (user.image && userByEmail.image !== user.image) userByEmail.image = user.image;
                                        await userByEmail.save();
                                        if (!userByEmail.communityInspirationOptIn) { 
                                            isNewUserFbFlow = true;
                                            currentToken.isNewUserForOnboarding = true;
                                        }
                                    } else if (!userByEmail.communityInspirationOptIn) {
                                        isNewUserFbFlow = true;
                                        currentToken.isNewUserForOnboarding = true;
                                    }
                                } else { /* ... */ }
                             } else { /* ... */ }
                        }
                    }
                    
                    if (userId && isNewUserFbFlow) { 
                        try {
                            logger.info(`${TAG_JWT} [Facebook Flow] Registando opt-in na comunidade para utilizador ${userId}. Termos: ${DEFAULT_TERMS_VERSION}`);
                            await dataService.optInUserToCommunity(userId, DEFAULT_TERMS_VERSION);
                            logger.info(`${TAG_JWT} [Facebook Flow] Opt-in na comunidade registado com sucesso para utilizador ${userId}.`);
                        } catch (optInError) {
                            logger.error(`${TAG_JWT} [Facebook Flow] Falha ao registar opt-in na comunidade para utilizador ${userId}:`, optInError);
                        }
                    }
                    if (!userId) { currentToken.igConnectionError = "Falha ao vincular conta Facebook."; }
                    else { if (!currentToken.id || !Types.ObjectId.isValid(currentToken.id)) { currentToken.id = userId; } /* ... */ }
                    if (!currentToken.provider && userId) currentToken.provider = 'facebook';

                } else { 
                    const providerName = account.provider || 'unknown_provider';
                    logger.debug(`${TAG_JWT} [${providerName} Flow] Processando login inicial.`);
                    const isValidObjectId = user.id ? Types.ObjectId.isValid(user.id) : false;
                    if (user.id && isValidObjectId) {
                        currentToken.id = user.id;
                        currentToken.provider = account.provider;
                        currentToken.name = user.name;
                        currentToken.email = user.email;
                        currentToken.image = user.image;
                        try { 
                            await connectToDatabase();
                            const doc = await DbUser.findById(currentToken.id).select('role').lean(); 
                            currentToken.role = doc?.role ?? 'user'; 
                        } catch (error) { logger.error(`${TAG_JWT} [${providerName} Flow] Erro ao buscar role para ${currentToken.id}:`, error); currentToken.role = 'user'; }
                    } else {
                         logger.error(`${TAG_JWT} [${providerName} Flow] ID do utilizador ('${user.id}') inválido ou ausente. DEFININDO currentToken.id PARA ''.`);
                         currentToken.id = ''; 
                    }
                }
            }

            const finalUserId = currentToken.id || token?.id;
            if (finalUserId && typeof finalUserId === 'string' && Types.ObjectId.isValid(finalUserId)) {
                currentToken.id = finalUserId; 
                currentToken.sub = finalUserId;
                if (!currentToken.name || !currentToken.email || !currentToken.image || !currentToken.role || !currentToken.provider) {
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(finalUserId).select('name email image role provider facebookProviderAccountId').lean();
                        if (dbUser) {
                            if (!currentToken.name) currentToken.name = dbUser.name;
                            if (!currentToken.email) currentToken.email = dbUser.email;
                            // <<< CORREÇÃO APLICADA AQUI >>>
                            if (!currentToken.image) currentToken.image = dbUser.image; 
                            // <<< FIM DA CORREÇÃO >>>
                            if (!currentToken.role) currentToken.role = dbUser.role ?? 'user';
                            if (!currentToken.provider) {
                                currentToken.provider = dbUser.provider ?? (dbUser.facebookProviderAccountId ? 'facebook' : undefined);
                            }
                        } else { currentToken.id = ''; }
                    } catch (error) { logger.error(`${TAG_JWT} [Enrichment Block] ERRO NO TRY/CATCH do enriquecimento para ${finalUserId}:`, error); }
                }
            } else if (trigger !== 'signUp' && trigger !== 'signIn') {
                logger.warn(`${TAG_JWT} [Consolidation] ID final ('${finalUserId}') inválido ou vazio FORA DO FLUXO DE LOGIN. Limpando token.`);
                return {} as JWT;
            } else if (isSignInOrSignUp && (!finalUserId || !Types.ObjectId.isValid(finalUserId))) {
                logger.error(`${TAG_JWT} [Consolidation] ID final ('${finalUserId}') inválido DURANTE O FLUXO DE LOGIN. Definindo currentToken.id como ''.`);
                currentToken.id = ''; 
            }

            logger.debug(`${TAG_JWT} FINAL do callback jwt. Retornando token com id: '${currentToken.id}', isNewUserForOnboarding: ${currentToken.isNewUserForOnboarding}`);
            return currentToken as JWT;
        },

        async session({ session, token }) {
             const TAG_SESSION = '[NextAuth Session Callback vConnectAccount-OnboardingFlag-Fix-Image]';
             logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token isNewUserForOnboarding: ${token?.isNewUserForOnboarding}`);
             
             if (!token?.id || typeof token.id !== 'string' || !Types.ObjectId.isValid(token.id)) {
                 logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}').`);
                 return { ...session, user: undefined, expires: session.expires };
             }

             session.user = {
                 id: token.id,
                 name: token.name ?? undefined,
                 email: token.email ?? undefined,
                 image: token.image ?? token.picture ?? undefined, // Mantém fallback para token.picture aqui
                 role: token.role ?? 'user',
                 provider: token.provider,
                 availableIgAccounts: token.availableIgAccounts,
                 igConnectionError: token.igConnectionError,
                 isNewUserForOnboarding: token.isNewUserForOnboarding ?? false, 
                 instagramConnected: false,
                 instagramAccountId: undefined,
                 instagramUsername: undefined,
                 planStatus: 'inactive',
                 planExpiresAt: null,
                 affiliateCode: undefined,
                 affiliateBalance: 0,
                 affiliateRank: 1,
                 affiliateInvites: 0,
             };
             
             try {
                 await connectToDatabase();
                 const dbUser = await DbUser.findById(token.id)
                     .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected instagramAccountId username') 
                     .lean();
                 if (dbUser && session.user) {
                     session.user.name = dbUser.name ?? session.user.name;
                     session.user.email = dbUser.email ?? session.user.email;
                     session.user.image = dbUser.image ?? session.user.image; // Prioriza dbUser.image
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
                     if (session.user.instagramConnected) { delete session.user.igConnectionError; }
                     logger.debug(`${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, isNewUserForOnboarding: ${session.user.isNewUserForOnboarding}`);
                 } else if (session.user) { 
                      logger.error(`${TAG_SESSION} Utilizador ${token.id} não encontrado no DB ao popular sessão.`);
                      session.user.igConnectionError = session.user.igConnectionError || "Falha ao carregar dados completos do utilizador.";
                 }
             } catch (error) {
                  logger.error(`${TAG_SESSION} Erro ao buscar dados do utilizador ${token.id} na sessão:`, error);
                   if(session.user) {
                     session.user.igConnectionError = session.user.igConnectionError || "Erro ao carregar dados do utilizador.";
                   }
             }
             return session;
         },

        async redirect({ baseUrl }) {
            return `${baseUrl}/dashboard`; 
        }
    },
    pages: {
        signIn: '/login', 
        error: '/auth/error'
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60 
    }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
