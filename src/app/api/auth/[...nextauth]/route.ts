// src/app/api/auth/[...nextauth]/route.ts
// VERSION: FBLinkNoNameImgUpdate+SyncStatus_ErrorPropagation_v2.1.7_ig_selection_flow_FIXED_TYPE_v2
// - CORRIGIDO: Type error na atribuição de instagramAccessToken (null vs undefined).
// - Mantém a lógica de buscar contas Instagram disponíveis e LLAT do IG durante o signIn com Facebook.
// - ATUALIZADO: Importação do instagramService para a nova estrutura modular.

import NextAuth from "next-auth";
import type { DefaultSession, DefaultUser, NextAuthOptions, Session, User as NextAuthUserArg, Account, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; 

import { Types } from "mongoose";
import type { JWT, DefaultJWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import { cookies } from 'next/headers';

// ATUALIZAÇÃO DA IMPORTAÇÃO para a nova estrutura modular
import { fetchAvailableInstagramAccounts } from "@/app/lib/instagram";
import type { AvailableInstagramAccount as ServiceAvailableIgAccount } from "@/app/lib/instagram/types";

// --- AUGMENT NEXT-AUTH TYPES ---
declare module "next-auth" {
    interface User extends DefaultUser {
        id: string;
        role?: string | null;
        provider?: string | null;
        isNewUserForOnboarding?: boolean;
        onboardingCompletedAt?: Date | null;
        isInstagramConnected?: boolean | null;
        instagramAccountId?: string | null;
        instagramUsername?: string | null;
        igConnectionError?: string | null;
        instagramSyncErrorMsg?: string | null; 
        availableIgAccounts?: ServiceAvailableIgAccount[] | null; 
        instagramAccessToken?: string | null; 
        lastInstagramSyncAttempt?: Date | null;
        lastInstagramSyncSuccess?: boolean | null;
        planStatus?: string | null;
        planExpiresAt?: Date | null;
        affiliateCode?: string | null;
        facebookProviderAccountId?: string | null;
        providerAccountId?: string | null;
    }

    interface Session {
      user?: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        provider?: string | null;
        role?: string | null;
        planStatus?: string | null;
        planExpiresAt?: string | null;
        affiliateCode?: string | null;
        affiliateBalance?: number;
        affiliateRank?: number;
        affiliateInvites?: number;

        instagramConnected?: boolean;
        instagramAccountId?: string | null;
        instagramUsername?: string | null;
        igConnectionError?: string | null;
        availableIgAccounts?: ServiceAvailableIgAccount[] | null; 
        lastInstagramSyncAttempt?: string | null;
        lastInstagramSyncSuccess?: boolean | null;

        isNewUserForOnboarding?: boolean;
        onboardingCompletedAt?: string | null;

      } & Omit<DefaultSession["user"], "id" | "name" | "email" | "image">;
    }
}

declare module "next-auth/jwt" {
     interface JWT extends DefaultJWT {
         id: string;
         role?: string | null;
         provider?: string | null;

         isNewUserForOnboarding?: boolean;
         onboardingCompletedAt?: Date | string | null;

         isInstagramConnected?: boolean | null;
         instagramAccountId?: string | null;
         instagramUsername?: string | null;
         igConnectionError?: string | null;
         availableIgAccounts?: ServiceAvailableIgAccount[] | null;
         instagramAccessToken?: string | null; 
         lastInstagramSyncAttempt?: Date | string | null;
         lastInstagramSyncSuccess?: boolean | null;
         planStatus?: string | null;
         planExpiresAt?: Date | string | null;
         affiliateCode?: string | null;
         image?: string | null;
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included";
const FACEBOOK_LINK_COOKIE_NAME = "auth-link-token";
const MAX_TOKEN_AGE_BEFORE_REFRESH_MINUTES = 60;

async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
    const cleanToken: Record<string, any> = { ...token };
    Object.keys(cleanToken).forEach(key => {
        if (cleanToken[key] === undefined) delete cleanToken[key];
    });
    if (!cleanToken.id && cleanToken.sub) cleanToken.id = cleanToken.sub;
    else if (!cleanToken.id) cleanToken.id = '';
    if (cleanToken.onboardingCompletedAt instanceof Date) {
        cleanToken.onboardingCompletedAt = cleanToken.onboardingCompletedAt.toISOString();
    }
    if (cleanToken.lastInstagramSyncAttempt instanceof Date) {
        cleanToken.lastInstagramSyncAttempt = cleanToken.lastInstagramSyncAttempt.toISOString();
    }
    if (cleanToken.planExpiresAt instanceof Date) {
        cleanToken.planExpiresAt = cleanToken.planExpiresAt.toISOString();
    }
    if (cleanToken.image && cleanToken.picture) delete cleanToken.picture;
    delete cleanToken.instagramSyncErrorMsg;
    return new SignJWT(cleanToken)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expirationTime)
        .sign(new TextEncoder().encode(secretString));
}

async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
    if (!token || !secret) {
        logger.error("[customDecode] Token ou secret não fornecidos.");
        return null;
    }
    const secretString = typeof secret === "string" ? secret : String(secret);
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString), { algorithms: ["HS256"] });
        const decodedPayload: Partial<JWT> = { ...payload };
        if (decodedPayload.id && typeof decodedPayload.id !== 'string') {
            decodedPayload.id = String(decodedPayload.id);
        } else if (!decodedPayload.id && decodedPayload.sub) {
            decodedPayload.id = decodedPayload.sub;
        } else if (!decodedPayload.id) {
            decodedPayload.id = '';
        }
        if (decodedPayload.onboardingCompletedAt && typeof decodedPayload.onboardingCompletedAt === 'string') {
            decodedPayload.onboardingCompletedAt = new Date(decodedPayload.onboardingCompletedAt);
        }
        if (decodedPayload.lastInstagramSyncAttempt && typeof decodedPayload.lastInstagramSyncAttempt === 'string') {
            decodedPayload.lastInstagramSyncAttempt = new Date(decodedPayload.lastInstagramSyncAttempt);
        }
        if (decodedPayload.planExpiresAt && typeof decodedPayload.planExpiresAt === 'string') {
            decodedPayload.planExpiresAt = new Date(decodedPayload.planExpiresAt);
        }
        if (decodedPayload.picture && !decodedPayload.image) {
            decodedPayload.image = decodedPayload.picture;
        }
        return decodedPayload as JWT;
    } catch (err) {
        logger.error(`[customDecode] Erro ao decodificar token: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}


export const authOptions: NextAuthOptions = {
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
            profile(profile: Profile & { sub?: string; picture?: string }) {
                logger.debug("[NextAuth Google Profile DEBUG] Profile recebido do Google:", JSON.stringify(profile));
                return {
                    id: profile.sub!,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture,
                };
            }
        }),
        FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID!,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: 'email,public_profile,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights',
                    auth_type: 'rerequest' 
                }
            },
            profile(profile: Profile & { id?: string; picture?: { data?: { url?: string }}}) {
                logger.debug("NextAuth: Facebook profile returned:", profile);
                return {
                    id: profile.id!,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture?.data?.url,
                };
            }
        }),
        CredentialsProvider({
            name: "Demo",
            credentials: {
                username: { label: "Utilizador", type: "text", placeholder: "demo" },
                password: { label: "Senha", type: "password", placeholder: "demo" }
            },
            async authorize(credentials, req) {
                if (credentials?.username === "demo" && credentials?.password === "demo") {
                    logger.debug("[NextAuth Credentials DEBUG] Authorize para Demo User bem-sucedido.");
                    return {
                        id: "demo-123",
                        name: "Demo User",
                        email: "demo@example.com",
                        image: null,
                        role: "user",
                        isNewUserForOnboarding: false,
                        onboardingCompletedAt: new Date(),
                        isInstagramConnected: false, 
                        planStatus: 'inactive',
                        affiliateCode: 'DEMOCODE123',
                    };
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
        async signIn({ user: authUserFromProvider, account, profile }) {
            const TAG_SIGNIN = '[NextAuth signIn v2.1.7_ig_selection_flow_FIXED_TYPE_v2]'; 
            logger.debug(`${TAG_SIGNIN} Iniciado`, { providerAccountIdReceived: authUserFromProvider.id, provider: account?.provider, email: authUserFromProvider.email });

            if (!account || !account.provider || !authUserFromProvider?.id) {
                 logger.error(`${TAG_SIGNIN} Dados essenciais ausentes (account, provider, user.id).`, { account, user: authUserFromProvider });
                 return false;
            }

            if (account.provider === 'credentials') {
                logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials (utilizador: ${authUserFromProvider.id}).`);
                return true;
            }

            const provider = account.provider;
            const providerAccountId = authUserFromProvider.id;
            const currentEmailFromProvider = authUserFromProvider.email;
            const nameFromProvider = authUserFromProvider.name;
            const imageFromProvider = authUserFromProvider.image;

            if (!providerAccountId) {
                logger.error(`${TAG_SIGNIN} providerAccountId (ID do ${provider}) ausente.`);
                return false;
            }

            try {
                await connectToDatabase();
                let dbUserRecord: IUser | null = null;
                let isNewUser = false;

                if (provider === 'facebook') {
                    const cookieStore = cookies();
                    const linkTokenFromCookie = cookieStore.get(FACEBOOK_LINK_COOKIE_NAME)?.value;

                    if (linkTokenFromCookie) {
                        dbUserRecord = await DbUser.findOne({
                            linkToken: linkTokenFromCookie,
                            linkTokenExpiresAt: { $gt: new Date() }
                        });

                        if (dbUserRecord) {
                            logger.info(`${TAG_SIGNIN} [Facebook] Utilizador Data2Content ${dbUserRecord._id} (Email DB: ${dbUserRecord.email || 'N/A'}) encontrado por linkToken.`);
                            dbUserRecord.facebookProviderAccountId = providerAccountId;
                            if (!dbUserRecord.email && currentEmailFromProvider) {
                                dbUserRecord.email = currentEmailFromProvider;
                            } else if (dbUserRecord.email && currentEmailFromProvider && dbUserRecord.email.toLowerCase() !== currentEmailFromProvider.toLowerCase()){
                                logger.warn(`${TAG_SIGNIN} [Facebook] Email do Facebook ('${currentEmailFromProvider}') é DIFERENTE do email no DB ('${dbUserRecord.email}') para User ${dbUserRecord._id}. O email do DB será mantido.`);
                            }
                            dbUserRecord.linkToken = undefined;
                            dbUserRecord.linkTokenExpiresAt = undefined;
                            
                            if (account?.access_token) {
                                logger.info(`${TAG_SIGNIN} [Facebook] Obtendo contas Instagram e LLAT do IG para User ${dbUserRecord._id} usando o token de acesso do Facebook.`);
                                try {
                                    const igAccountsResult = await fetchAvailableInstagramAccounts(account.access_token, dbUserRecord._id.toString());
                                    
                                    if (igAccountsResult.success) {
                                        logger.info(`${TAG_SIGNIN} [Facebook] ${igAccountsResult.accounts.length} contas IG encontradas. LLAT do Instagram ${igAccountsResult.longLivedAccessToken ? 'obtido' : 'NÃO obtido'}.`);
                                        dbUserRecord.availableIgAccounts = igAccountsResult.accounts; 
                                        dbUserRecord.instagramAccessToken = igAccountsResult.longLivedAccessToken ?? undefined; 
                                        dbUserRecord.isInstagramConnected = false; 
                                        dbUserRecord.instagramAccountId = null; 
                                        dbUserRecord.username = null; 
                                        dbUserRecord.instagramSyncErrorMsg = null;
                                    } else {
                                        logger.error(`${TAG_SIGNIN} [Facebook] Falha ao buscar contas IG disponíveis: ${igAccountsResult.error}`);
                                        dbUserRecord.instagramSyncErrorMsg = igAccountsResult.error; 
                                        dbUserRecord.availableIgAccounts = []; 
                                        dbUserRecord.instagramAccessToken = undefined;
                                    }
                                } catch (fetchError: any) {
                                    logger.error(`${TAG_SIGNIN} [Facebook] Erro crítico ao chamar fetchAvailableInstagramAccounts: ${fetchError.message}`);
                                    dbUserRecord.instagramSyncErrorMsg = "Erro interno ao tentar buscar contas do Instagram: " + fetchError.message.substring(0, 150);
                                    dbUserRecord.availableIgAccounts = [];
                                    dbUserRecord.instagramAccessToken = undefined;
                                }
                            } else {
                                logger.warn(`${TAG_SIGNIN} [Facebook] Token de acesso do Facebook (account.access_token) não encontrado. Não foi possível buscar contas IG.`);
                                dbUserRecord.instagramSyncErrorMsg = "Token de acesso do Facebook não disponível para buscar contas do Instagram.";
                                dbUserRecord.availableIgAccounts = [];
                                dbUserRecord.instagramAccessToken = undefined;
                            }
                            await dbUserRecord.save();
                            cookieStore.delete(FACEBOOK_LINK_COOKIE_NAME);
                            logger.info(`${TAG_SIGNIN} [Facebook] Vinculação e tentativa de busca de contas IG processadas para ${dbUserRecord._id}.`);
                        } else {
                            logger.warn(`${TAG_SIGNIN} [Facebook] linkToken ('${FACEBOOK_LINK_COOKIE_NAME}': ${linkTokenFromCookie}) inválido ou expirado. Vinculação falhou.`);
                            cookieStore.delete(FACEBOOK_LINK_COOKIE_NAME);
                            return '/login?error=FacebookLinkFailed';
                        }
                    } else {
                        logger.warn(`${TAG_SIGNIN} [Facebook] Nenhum linkToken ('${FACEBOOK_LINK_COOKIE_NAME}') encontrado. Vinculação requerida. Login/Criação direta via Facebook não permitida neste fluxo.`);
                        return '/login?error=FacebookLinkRequired';
                    }
                }
                else if (provider === 'google') {
                    dbUserRecord = await DbUser.findOne({ provider: provider, providerAccountId: providerAccountId }).exec();
                    if (!dbUserRecord && currentEmailFromProvider) {
                        const userByEmail = await DbUser.findOne({ email: currentEmailFromProvider }).exec();
                        if (userByEmail) {
                            logger.info(`${TAG_SIGNIN} [Google] Utilizador Data2Content existente ${userByEmail._id} encontrado por email. Vinculando Google ID ${providerAccountId}.`);
                            dbUserRecord = userByEmail;
                            dbUserRecord.provider = provider;
                            dbUserRecord.providerAccountId = providerAccountId;
                            if (nameFromProvider && nameFromProvider !== dbUserRecord.name) dbUserRecord.name = nameFromProvider;
                            if (imageFromProvider && imageFromProvider !== dbUserRecord.image) dbUserRecord.image = imageFromProvider;
                            await dbUserRecord.save();
                        }
                    }
                    if (!dbUserRecord) {
                        if (!currentEmailFromProvider) {
                            logger.error(`${TAG_SIGNIN} [Google] Email ausente ao CRIAR novo utilizador Google.`);
                            return false;
                        }
                        logger.info(`${TAG_SIGNIN} [Google] Criando NOVO utilizador Data2Content para ${currentEmailFromProvider} via Google...`);
                        const newUserInDb = new DbUser({
                            name: nameFromProvider,
                            email: currentEmailFromProvider,
                            image: imageFromProvider,
                            provider: provider,
                            providerAccountId: providerAccountId,
                            role: 'user',
                            isNewUserForOnboarding: true,
                            onboardingCompletedAt: null,
                            communityInspirationOptIn: true,
                            communityInspirationOptInDate: new Date(),
                            communityInspirationTermsVersion: DEFAULT_TERMS_VERSION,
                            isInstagramConnected: false,
                            planStatus: 'inactive',
                        });
                        dbUserRecord = await newUserInDb.save();
                        isNewUser = true;
                        logger.info(`${TAG_SIGNIN} [Google] Novo utilizador Data2Content CRIADO com _id: '${dbUserRecord._id}'. AffiliateCode gerado: ${dbUserRecord.affiliateCode}`);
                    }
                }

                if (dbUserRecord) {
                    authUserFromProvider.id = dbUserRecord._id.toString();
                    authUserFromProvider.name = dbUserRecord.name ?? nameFromProvider ?? null;
                    authUserFromProvider.email = dbUserRecord.email ?? currentEmailFromProvider ?? null;
                    authUserFromProvider.image = dbUserRecord.image ?? imageFromProvider ?? null;
                    
                    (authUserFromProvider as NextAuthUserArg).role = dbUserRecord.role ?? 'user';
                    (authUserFromProvider as NextAuthUserArg).isNewUserForOnboarding = (provider === 'google' && isNewUser) || (dbUserRecord.isNewUserForOnboarding ?? false);
                    (authUserFromProvider as NextAuthUserArg).onboardingCompletedAt = dbUserRecord.onboardingCompletedAt;
                    (authUserFromProvider as NextAuthUserArg).provider = dbUserRecord.provider ?? provider;
                    
                    (authUserFromProvider as NextAuthUserArg).isInstagramConnected = dbUserRecord.isInstagramConnected ?? false;
                    (authUserFromProvider as NextAuthUserArg).instagramAccountId = dbUserRecord.instagramAccountId; 
                    (authUserFromProvider as NextAuthUserArg).instagramUsername = dbUserRecord.username; 
                    (authUserFromProvider as NextAuthUserArg).lastInstagramSyncAttempt = dbUserRecord.lastInstagramSyncAttempt;
                    (authUserFromProvider as NextAuthUserArg).lastInstagramSyncSuccess = dbUserRecord.lastInstagramSyncSuccess;
                    (authUserFromProvider as NextAuthUserArg).instagramSyncErrorMsg = dbUserRecord.instagramSyncErrorMsg; 
                    (authUserFromProvider as NextAuthUserArg).availableIgAccounts = dbUserRecord.availableIgAccounts as ServiceAvailableIgAccount[] | null | undefined;
                    (authUserFromProvider as NextAuthUserArg).instagramAccessToken = dbUserRecord.instagramAccessToken; 

                    (authUserFromProvider as NextAuthUserArg).planStatus = dbUserRecord.planStatus;
                    (authUserFromProvider as NextAuthUserArg).planExpiresAt = dbUserRecord.planExpiresAt;
                    (authUserFromProvider as NextAuthUserArg).affiliateCode = dbUserRecord.affiliateCode;
                    
                    logger.debug(`${TAG_SIGNIN} [${provider}] FINAL signIn. authUser.id (interno): '${authUserFromProvider.id}', planStatus: ${(authUserFromProvider as NextAuthUserArg).planStatus}, igAccountsCount: ${(authUserFromProvider as NextAuthUserArg).availableIgAccounts?.length ?? 0}, igLlatSet: !!${(authUserFromProvider as NextAuthUserArg).instagramAccessToken}`);
                    return true;
                } else {
                    logger.error(`${TAG_SIGNIN} [${provider}] dbUserRecord não foi definido. Falha no signIn.`);
                    return false;
                }

            } catch (error) {
                 logger.error(`${TAG_SIGNIN} Erro no DB durante signIn para ${provider} (ProviderAccID: ${providerAccountId}):`, error);
                 return false;
            }
        },

        async jwt({ token, user: userFromSignIn, account, trigger, session: updateSessionData }) {
            const TAG_JWT = '[NextAuth JWT v2.1.7_ig_selection_flow_FIXED_TYPE_v2]'; 
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. UserID(signIn): ${userFromSignIn?.id}. TokenInID: ${token?.id}. Token.planStatus(in): ${token.planStatus}, Token.affiliateCode(in): ${token.affiliateCode}`);

            if ((trigger === 'signIn' || trigger === 'signUp') && userFromSignIn) {
                token.id = userFromSignIn.id;
                token.sub = userFromSignIn.id; 
                token.name = userFromSignIn.name;
                token.email = userFromSignIn.email;
                token.image = userFromSignIn.image;
                token.role = (userFromSignIn as NextAuthUserArg).role ?? 'user';
                token.provider = account?.provider ?? (userFromSignIn as NextAuthUserArg).provider;
                token.isNewUserForOnboarding = (userFromSignIn as NextAuthUserArg).isNewUserForOnboarding;
                token.onboardingCompletedAt = (userFromSignIn as NextAuthUserArg).onboardingCompletedAt;
                
                token.isInstagramConnected = (userFromSignIn as NextAuthUserArg).isInstagramConnected;
                token.instagramAccountId = (userFromSignIn as NextAuthUserArg).instagramAccountId;
                token.instagramUsername = (userFromSignIn as NextAuthUserArg).instagramUsername;
                token.lastInstagramSyncAttempt = (userFromSignIn as NextAuthUserArg).lastInstagramSyncAttempt;
                token.lastInstagramSyncSuccess = (userFromSignIn as NextAuthUserArg).lastInstagramSyncSuccess;
                token.igConnectionError = (userFromSignIn as NextAuthUserArg).instagramSyncErrorMsg ?? null; 
                token.availableIgAccounts = (userFromSignIn as NextAuthUserArg).availableIgAccounts;
                token.instagramAccessToken = (userFromSignIn as NextAuthUserArg).instagramAccessToken; 

                token.planStatus = (userFromSignIn as NextAuthUserArg).planStatus;
                token.planExpiresAt = (userFromSignIn as NextAuthUserArg).planExpiresAt;
                token.affiliateCode = (userFromSignIn as NextAuthUserArg).affiliateCode;

                logger.info(`${TAG_JWT} Token populado de userFromSignIn. ID: ${token.id}, planStatus: ${token.planStatus}, igAccounts: ${token.availableIgAccounts?.length}, igLlatSet: !!token.instagramAccessToken}`);
            }

            if (token.id && Types.ObjectId.isValid(token.id)) {
                let needsDbRefresh = trigger === 'update' ||
                                      !token.role || 
                                      typeof token.planStatus === 'undefined' ||
                                      typeof token.affiliateCode === 'undefined' ||
                                      (typeof token.isInstagramConnected === 'undefined' && typeof token.availableIgAccounts === 'undefined');

                const tokenIssuedAt = token.iat; 
                if (!needsDbRefresh && tokenIssuedAt && typeof tokenIssuedAt === 'number') {
                    const nowInSeconds = Math.floor(Date.now() / 1000);
                    const tokenAgeInMinutes = (nowInSeconds - tokenIssuedAt) / 60;
                    if (tokenAgeInMinutes > MAX_TOKEN_AGE_BEFORE_REFRESH_MINUTES) {
                        logger.info(`${TAG_JWT} Token com ${tokenAgeInMinutes.toFixed(0)} min de idade. Forçando refresh do DB.`);
                        needsDbRefresh = true;
                    }
                }

                if (needsDbRefresh) {
                    logger.debug(`${TAG_JWT} Trigger '${trigger}' ou refresh periódico/dados ausentes. Buscando dados frescos do DB para token ID: ${token.id}`);
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(token.id)
                            .select('name email image role provider providerAccountId facebookProviderAccountId isNewUserForOnboarding onboardingCompletedAt isInstagramConnected instagramAccountId username lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorMsg planStatus planExpiresAt affiliateCode availableIgAccounts instagramAccessToken')
                            .lean<IUser>();

                        if (dbUser) {
                            token.name = dbUser.name ?? token.name;
                            token.email = dbUser.email ?? token.email;
                            token.image = dbUser.image ?? token.image;
                            token.role = dbUser.role ?? token.role ?? 'user';
                            token.provider = dbUser.provider ?? (dbUser.facebookProviderAccountId ? 'facebook' : token.provider);
                            token.isNewUserForOnboarding = typeof dbUser.isNewUserForOnboarding === 'boolean' ? dbUser.isNewUserForOnboarding : token.isNewUserForOnboarding ?? false;
                            token.onboardingCompletedAt = dbUser.onboardingCompletedAt ?? token.onboardingCompletedAt ?? null;
                            
                            token.isInstagramConnected = dbUser.isInstagramConnected ?? token.isInstagramConnected ?? false;
                            token.instagramAccountId = dbUser.instagramAccountId ?? token.instagramAccountId ?? null;
                            token.instagramUsername = dbUser.username ?? token.instagramUsername ?? null;
                            token.lastInstagramSyncAttempt = dbUser.lastInstagramSyncAttempt ?? token.lastInstagramSyncAttempt ?? null;
                            token.lastInstagramSyncSuccess = dbUser.lastInstagramSyncSuccess ?? token.lastInstagramSyncSuccess ?? null;
                            token.igConnectionError = dbUser.instagramSyncErrorMsg ?? token.igConnectionError ?? null;
                            if (dbUser.isInstagramConnected && !dbUser.instagramSyncErrorMsg) {
                                token.igConnectionError = null; 
                            }
                            token.availableIgAccounts = (dbUser.availableIgAccounts as ServiceAvailableIgAccount[] | null | undefined) ?? token.availableIgAccounts ?? null;
                            token.instagramAccessToken = dbUser.instagramAccessToken ?? token.instagramAccessToken ?? null;

                            token.planStatus = dbUser.planStatus ?? token.planStatus ?? 'inactive';
                            token.planExpiresAt = dbUser.planExpiresAt ?? token.planExpiresAt ?? null;
                            token.affiliateCode = dbUser.affiliateCode ?? token.affiliateCode ?? null;

                            logger.info(`${TAG_JWT} Token enriquecido/atualizado do DB. ID: ${token.id}, planStatus: ${token.planStatus}, igAccounts: ${token.availableIgAccounts?.length}, igLlatSet: !!token.instagramAccessToken}, igErr: ${token.igConnectionError ? 'Sim ('+String(token.igConnectionError).substring(0,30)+'...)': 'Não'}`);
                        } else {
                            logger.warn(`${TAG_JWT} Utilizador ${token.id} não encontrado no DB durante refresh de token. Invalidando token.`);
                            return {} as JWT; 
                        }
                    } catch (error) {
                        logger.error(`${TAG_JWT} Erro ao buscar dados do DB para enriquecer/atualizar token ${token.id}:`, error);
                    }
                }
            } else {
                if (trigger !== 'signIn' && trigger !== 'signUp') { 
                    logger.warn(`${TAG_JWT} Token com ID inválido ou ausente ('${token.id}') fora do login/signup. Invalidando.`);
                    return {} as JWT; 
                }
            }

            if (token.image && (token as any).picture) delete (token as any).picture; 
            logger.debug(`${TAG_JWT} FINAL jwt. Token id: '${token.id}', planStatus: ${token.planStatus}, affiliateCode: ${token.affiliateCode}, igErr: ${token.igConnectionError ? 'Sim ('+String(token.igConnectionError).substring(0,30)+'...)': 'Não'}`);
            return token;
        },

        async session({ session, token }) {
            const TAG_SESSION = '[NextAuth Session v2.1.7_ig_selection_flow_FIXED_TYPE_v2]'; 
            logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token.planStatus (vindo do token JWT): ${token?.planStatus}, Token.affiliateCode: ${token?.affiliateCode}`);

            if (!token?.id || !Types.ObjectId.isValid(token.id)) {
                logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}') na sessão. Sessão será retornada vazia/padrão.`);
                return { ...session, user: undefined }; 
            }

            if (!session.user) session.user = { id: token.id }; 
            
            session.user.id = token.id; 
            session.user.name = token.name;
            session.user.email = token.email;
            session.user.image = token.image;
            session.user.role = token.role;
            session.user.provider = token.provider;
            session.user.isNewUserForOnboarding = token.isNewUserForOnboarding;
            session.user.onboardingCompletedAt = token.onboardingCompletedAt ? (typeof token.onboardingCompletedAt === 'string' ? token.onboardingCompletedAt : new Date(token.onboardingCompletedAt).toISOString()) : null;
            
            session.user.instagramConnected = token.isInstagramConnected ?? undefined; 
            session.user.instagramAccountId = token.instagramAccountId;
            session.user.instagramUsername = token.instagramUsername;
            session.user.igConnectionError = token.igConnectionError;
            session.user.availableIgAccounts = token.availableIgAccounts; 
            session.user.lastInstagramSyncAttempt = token.lastInstagramSyncAttempt ? (typeof token.lastInstagramSyncAttempt === 'string' ? token.lastInstagramSyncAttempt : new Date(token.lastInstagramSyncAttempt).toISOString()) : null;
            session.user.lastInstagramSyncSuccess = token.lastInstagramSyncSuccess;

            session.user.planStatus = token.planStatus ?? 'inactive';
            session.user.planExpiresAt = token.planExpiresAt ? (typeof token.planExpiresAt === 'string' ? token.planExpiresAt : new Date(token.planExpiresAt).toISOString()) : null;
            session.user.affiliateCode = token.affiliateCode;
            session.user.affiliateBalance = session.user.affiliateBalance ?? undefined; 
            session.user.affiliateRank = session.user.affiliateRank ?? undefined;
            session.user.affiliateInvites = session.user.affiliateInvites ?? undefined;
            
            try {
                await connectToDatabase();
                const dbUser = await DbUser.findById(token.id)
                    .select('planStatus planExpiresAt name role image') 
                    .lean<IUser>();

                if (dbUser && session.user) {
                    logger.info(`${TAG_SESSION} Revalidando sessão com dados do DB para User ID: ${token.id}. DB planStatus: ${dbUser.planStatus}. Session planStatus (antes da revalidação DB): ${session.user.planStatus}`);
                    session.user.planStatus = dbUser.planStatus ?? session.user.planStatus ?? 'inactive';
                    if (dbUser.planExpiresAt instanceof Date) {
                        session.user.planExpiresAt = dbUser.planExpiresAt.toISOString();
                    } else if (dbUser.planExpiresAt === null) {
                        session.user.planExpiresAt = null;
                    }
                    if (dbUser.name) session.user.name = dbUser.name;
                    if (dbUser.role) session.user.role = dbUser.role;
                    if (dbUser.image) session.user.image = dbUser.image;
                } else if (!dbUser) {
                    logger.warn(`${TAG_SESSION} Utilizador ${token.id} não encontrado no DB durante revalidação da sessão. Usando dados do token como estão.`);
                }
            } catch (error) {
                logger.error(`${TAG_SESSION} Erro ao buscar dados do DB para revalidação da sessão ${token.id}:`, error);
            }
            
            logger.debug(`${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, Session planStatus (final): ${session.user?.planStatus}, igAccounts: ${session.user?.availableIgAccounts?.length}, igErr: ${session.user?.igConnectionError ? 'Sim' : 'Não'}`);
            return session;
         },

        async redirect({ url, baseUrl }) {
            const requestedUrl = new URL(url, baseUrl);
            const base = new URL(baseUrl);
            if (requestedUrl.origin === base.origin) {
              logger.debug(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é interna. Permitindo.`);
              return requestedUrl.toString();
            }
            logger.warn(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é externa ou inválida. Redirecionando para baseUrl: ${baseUrl}.`);
            return baseUrl;
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
