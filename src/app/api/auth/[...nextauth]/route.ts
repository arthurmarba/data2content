// src/app/api/auth/[...nextauth]/route.ts
// VERSION: FBLinkNoNameImgUpdate+SyncStatus_ErrorPropagation_v2.1.5_affiliatecodefix
// - CORREÇÃO: planStatus agora é corretamente selecionado do DB no callback jwt e mapeado para a sessão no callback session.
// - CORREÇÃO: affiliateCode agora é corretamente populado no token JWT e mapeado para a sessão.
// - Mantém funcionalidades e correções da v2.1.4.

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
import {
    fetchAvailableInstagramAccounts,
    connectInstagramAccount,
    AvailableInstagramAccount,
    clearInstagramConnection
} from "@/app/lib/instagramService";

// --- AUGMENT NEXT-AUTH TYPES (ALINHADO COM User.ts v1.9.5 e Plano + AffiliateCode) ---
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
        availableIgAccounts?: AvailableInstagramAccount[] | null;
        lastInstagramSyncAttempt?: Date | null;
        lastInstagramSyncSuccess?: boolean | null;
        planStatus?: string | null;
        planExpiresAt?: Date | null;
        affiliateCode?: string | null; // <<<< GARANTIDO AQUI
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
        affiliateCode?: string | null; // <<<< GARANTIDO AQUI
        affiliateBalance?: number;
        affiliateRank?: number;
        affiliateInvites?: number;

        instagramConnected?: boolean;
        instagramAccountId?: string | null;
        instagramUsername?: string | null;
        igConnectionError?: string | null;
        availableIgAccounts?: AvailableInstagramAccount[] | null;
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
         instagramSyncErrorMsg?: string | null;
         availableIgAccounts?: AvailableInstagramAccount[] | null;
         lastInstagramSyncAttempt?: Date | string | null;
         lastInstagramSyncSuccess?: boolean | null;
         planStatus?: string | null;
         planExpiresAt?: Date | string | null;
         affiliateCode?: string | null; // <<<< ALTERAÇÃO AFFILIATECODE: Adicionado
         image?: string | null;
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included";
const FACEBOOK_LINK_COOKIE_NAME = "auth-link-token";

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

    delete cleanToken.availableIgAccounts;
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
                        affiliateCode: 'DEMOCODE123', // <<<< ALTERAÇÃO AFFILIATECODE: Exemplo para demo user
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
            const TAG_SIGNIN = '[NextAuth signIn v2.1.5]'; // Version bump
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
                            await dbUserRecord.save();
                            cookieStore.delete(FACEBOOK_LINK_COOKIE_NAME);
                            logger.info(`${TAG_SIGNIN} [Facebook] Vinculação por linkToken bem-sucedida para ${dbUserRecord._id}.`);
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
                            // affiliateCode será gerado pelo hook pre('save') no modelo User
                        });
                        dbUserRecord = await newUserInDb.save();
                        isNewUser = true;
                        logger.info(`${TAG_SIGNIN} [Google] Novo utilizador Data2Content CRIADO com _id: '${dbUserRecord._id}'. AffiliateCode gerado: ${dbUserRecord.affiliateCode}`);
                    }
                }

                if (dbUserRecord) {
                    authUserFromProvider.id = dbUserRecord._id.toString();
                    const resolvedName = dbUserRecord.name ?? nameFromProvider;
                    authUserFromProvider.name = resolvedName === null ? undefined : resolvedName;
                    authUserFromProvider.email = dbUserRecord.email ?? currentEmailFromProvider;
                    const resolvedImage = dbUserRecord.image ?? imageFromProvider;
                    authUserFromProvider.image = resolvedImage === null ? undefined : resolvedImage;
                    
                    (authUserFromProvider as NextAuthUserArg).role = dbUserRecord.role ?? 'user';
                    (authUserFromProvider as NextAuthUserArg).isNewUserForOnboarding = (provider === 'google' && isNewUser) || (dbUserRecord.isNewUserForOnboarding ?? false);
                    (authUserFromProvider as NextAuthUserArg).onboardingCompletedAt = dbUserRecord.onboardingCompletedAt;
                    (authUserFromProvider as NextAuthUserArg).isInstagramConnected = dbUserRecord.isInstagramConnected ?? false;
                    (authUserFromProvider as NextAuthUserArg).provider = dbUserRecord.provider ?? provider;
                    (authUserFromProvider as NextAuthUserArg).lastInstagramSyncAttempt = dbUserRecord.lastInstagramSyncAttempt;
                    (authUserFromProvider as NextAuthUserArg).lastInstagramSyncSuccess = dbUserRecord.lastInstagramSyncSuccess;
                    (authUserFromProvider as NextAuthUserArg).instagramSyncErrorMsg = dbUserRecord.instagramSyncErrorMsg;
                    (authUserFromProvider as NextAuthUserArg).planStatus = dbUserRecord.planStatus;
                    (authUserFromProvider as NextAuthUserArg).planExpiresAt = dbUserRecord.planExpiresAt;
                    (authUserFromProvider as NextAuthUserArg).affiliateCode = dbUserRecord.affiliateCode; // <<<< ALTERAÇÃO AFFILIATECODE: Garantindo que está aqui
                    (authUserFromProvider as NextAuthUserArg).instagramAccountId = dbUserRecord.instagramAccountId;
                    authUserFromProvider.instagramUsername = dbUserRecord.username; 

                    logger.debug(`${TAG_SIGNIN} [${provider}] FINAL signIn. authUser.id (interno): '${authUserFromProvider.id}', planStatus: ${(authUserFromProvider as NextAuthUserArg).planStatus}, affiliateCode: ${(authUserFromProvider as NextAuthUserArg).affiliateCode}`);
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
            const TAG_JWT = '[NextAuth JWT v2.1.5]'; // Version bump
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. UserID(signIn): ${userFromSignIn?.id}. TokenInID: ${token?.id}. Token.planStatus(in): ${token.planStatus}, Token.affiliateCode(in): ${token.affiliateCode}`);

            if (trigger !== 'update') {
                delete token.igConnectionError;
            }
            delete token.availableIgAccounts;

            if ((trigger === 'signIn' || trigger === 'signUp') && userFromSignIn) {
                token.id = userFromSignIn.id;
                token.sub = userFromSignIn.id; // Geralmente o sub é o id do usuário
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
                token.planStatus = (userFromSignIn as NextAuthUserArg).planStatus;
                token.planExpiresAt = (userFromSignIn as NextAuthUserArg).planExpiresAt;
                token.affiliateCode = (userFromSignIn as NextAuthUserArg).affiliateCode; // <<<< ALTERAÇÃO AFFILIATECODE: Adicionado

                logger.info(`${TAG_JWT} Token populado de userFromSignIn. ID: ${token.id}, planStatus: ${token.planStatus}, affiliateCode: ${token.affiliateCode}`);

                if (account?.provider === 'facebook' && token.id && Types.ObjectId.isValid(token.id)) {
                    const userId = token.id;
                    const shortLivedAccessToken = account.access_token;

                    if (userId && shortLivedAccessToken) {
                        logger.info(`${TAG_JWT} [Facebook] Iniciando busca de contas IG e LLAT para User ${userId}...`);
                        try {
                            const result = await fetchAvailableInstagramAccounts(shortLivedAccessToken, userId);
                            if (result.success) {
                                logger.info(`${TAG_JWT} [Facebook] fetchAvailableInstagramAccounts OK. Contas: ${result.accounts?.length ?? 0}. LLAT Obtido: ${!!result.longLivedAccessToken}`);
                                const userLongLivedAccessToken = result.longLivedAccessToken;

                                if (result.accounts && result.accounts.length > 0 && userLongLivedAccessToken) {
                                    const firstAccount = result.accounts[0];
                                    if (firstAccount && firstAccount.igAccountId) {
                                        logger.info(`${TAG_JWT} [Facebook] Tentando conectar automaticamente a primeira conta IG: ${firstAccount.igAccountId} para User ${userId}`);
                                        connectInstagramAccount(userId, firstAccount.igAccountId, userLongLivedAccessToken)
                                            .then(connectResult => {
                                                if (!connectResult.success) {
                                                    logger.error(`${TAG_JWT} [Facebook] Falha ao chamar connectInstagramAccount (async) para ${userId}: ${connectResult.error}`);
                                                } else {
                                                    logger.info(`${TAG_JWT} [Facebook] connectInstagramAccount chamado com sucesso (async) para ${userId}. O status será atualizado no DB.`);
                                                }
                                            })
                                            .catch(err => {
                                                logger.error(`${TAG_JWT} [Facebook] Erro não capturado ao chamar connectInstagramAccount (async) para ${userId}:`, err);
                                            });
                                    } else {
                                        token.igConnectionError = token.igConnectionError || "Erro ao processar lista de contas Instagram do Facebook.";
                                    }
                                } else {
                                    token.igConnectionError = token.igConnectionError || "Nenhuma conta Instagram encontrada para vincular ou token de longa duração (LLAT) ausente.";
                                }
                            } else {
                                token.igConnectionError = token.igConnectionError || result.error || "Falha ao buscar contas do Instagram.";
                                if (result.error?.toLowerCase().includes('token')) {
                                     await clearInstagramConnection(userId).catch(clearErr => logger.error(`${TAG_JWT} Erro ao limpar conexão IG após falha em fetchAvailableInstagramAccounts:`, clearErr));
                                }
                            }
                        } catch (error) {
                            const typedError = error as Error;
                            token.igConnectionError = token.igConnectionError || typedError.message || "Erro inesperado no processo de conexão IG.";
                            if (token.igConnectionError.toLowerCase().includes('token') && Types.ObjectId.isValid(userId)) {
                                await clearInstagramConnection(userId).catch(clearErr => logger.error(`${TAG_JWT} Erro ao limpar conexão IG após exceção em fetchAvailableInstagramAccounts:`, clearErr));
                            }
                        }
                    } else {
                        token.igConnectionError = token.igConnectionError || "Dados necessários (userId, SLT) para conexão IG ausentes.";
                    }
                }
            }

            if (token.id && Types.ObjectId.isValid(token.id)) {
                const needsDbRefresh = trigger === 'update' ||
                                      account?.provider === 'facebook' || // Sempre atualiza após login com Facebook para pegar status da conexão IG
                                      !token.role || 
                                      typeof token.isInstagramConnected === 'undefined' ||
                                      typeof token.planStatus === 'undefined' ||
                                      typeof token.affiliateCode === 'undefined'; // <<<< ALTERAÇÃO AFFILIATECODE: Adicionada verificação

                if (needsDbRefresh) {
                    logger.debug(`${TAG_JWT} Trigger '${trigger}' ou dados ausentes/login FB/refresh necessário. Buscando dados frescos do DB para token ID: ${token.id}`);
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(token.id)
                            .select('name email image role provider providerAccountId facebookProviderAccountId isNewUserForOnboarding onboardingCompletedAt isInstagramConnected instagramAccountId username lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorMsg planStatus planExpiresAt affiliateCode') // affiliateCode já está no select
                            .lean<IUser>();

                        if (dbUser) {
                            token.name = dbUser.name ?? token.name;
                            token.email = dbUser.email ?? token.email;
                            token.image = dbUser.image ?? token.image; // Manter a imagem do token se a do DB for null e a do token existir
                            token.role = dbUser.role ?? token.role ?? 'user';
                            token.provider = dbUser.provider ?? (dbUser.facebookProviderAccountId ? 'facebook' : token.provider);
                            token.isNewUserForOnboarding = typeof dbUser.isNewUserForOnboarding === 'boolean' ? dbUser.isNewUserForOnboarding : token.isNewUserForOnboarding ?? false;
                            token.onboardingCompletedAt = dbUser.onboardingCompletedAt ?? token.onboardingCompletedAt ?? null;

                            token.isInstagramConnected = dbUser.isInstagramConnected ?? false;
                            token.instagramAccountId = dbUser.instagramAccountId ?? null;
                            token.instagramUsername = dbUser.username ?? null; // 'username' no IUser é o instagram username
                            token.lastInstagramSyncAttempt = dbUser.lastInstagramSyncAttempt ?? null;
                            token.lastInstagramSyncSuccess = dbUser.lastInstagramSyncSuccess ?? null;
                            
                            token.igConnectionError = dbUser.instagramSyncErrorMsg || token.igConnectionError || null;
                            if (token.isInstagramConnected && !dbUser.instagramSyncErrorMsg) { // Se conectado e SEM erro no DB, limpa erro do token
                                delete token.igConnectionError;
                            }
                            
                            token.planStatus = dbUser.planStatus ?? token.planStatus ?? 'inactive';
                            token.planExpiresAt = dbUser.planExpiresAt ?? token.planExpiresAt ?? null;
                            token.affiliateCode = dbUser.affiliateCode ?? token.affiliateCode ?? null; // <<<< ALTERAÇÃO AFFILIATECODE: Adicionado/Garantido


                            logger.info(`${TAG_JWT} Token enriquecido/atualizado do DB. ID: ${token.id}, isInstaConn: ${token.isInstagramConnected}, planStatus: ${token.planStatus}, affiliateCode: ${token.affiliateCode}, igConnErr: ${token.igConnectionError}`);
                        } else {
                            logger.warn(`${TAG_JWT} Utilizador ${token.id} não encontrado no DB durante refresh de token. Invalidando token.`);
                            return {} as JWT; // Retorna token vazio para invalidar
                        }
                    } catch (error) {
                        logger.error(`${TAG_JWT} Erro ao buscar dados do DB para enriquecer/atualizar token ${token.id}:`, error);
                        // Não invalidar o token aqui necessariamente, pode ser um erro temporário de DB
                    }
                }
            } else {
                 // Se não há token.id (exceto no primeiro signIn/signUp onde userFromSignIn ainda não foi processado para token)
                if (trigger !== 'signIn' && trigger !== 'signUp') { // Evita warning/erro desnecessário no primeiro fluxo
                    logger.warn(`${TAG_JWT} Token com ID inválido ou ausente ('${token.id}') fora do login/signup. Invalidando.`);
                    return {} as JWT;
                }
                 // Este log pode ser muito verboso se userFromSignIn for avaliado antes de token.id ser setado no primeiro JWT call
                 // logger.error(`${TAG_JWT} Token com ID inválido ou ausente ('${token.id}') DURANTE ${trigger}. Isso não deveria acontecer. Invalidando.`);
                 // return {} as JWT;
            }

            // Limpeza final
            if (token.image && (token as any).picture) delete (token as any).picture; // Remove 'picture' se 'image' já existe e tem valor
            logger.debug(`${TAG_JWT} FINAL jwt. Token id: '${token.id}', planStatus: ${token.planStatus}, affiliateCode: ${token.affiliateCode}, igErr: ${token.igConnectionError ? 'Sim' : 'Não'}`);
            return token;
        },

        async session({ session, token }) {
             const TAG_SESSION = '[NextAuth Session v2.1.5]'; // Version bump
             logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token.planStatus: ${token?.planStatus}, Token.affiliateCode: ${token?.affiliateCode}, Token.igErr: ${token?.igConnectionError}`);

             if (!token?.id || !Types.ObjectId.isValid(token.id)) { // Verifica se token.id existe e é um ObjectId válido
                 logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}') na sessão. Sessão será retornada vazia/padrão.`);
                 session.user = undefined; // Limpa o usuário da sessão
                 return session;
             }

             // Mapeia os campos do token para session.user
             session.user = {
                 id: token.id,
                 name: token.name,
                 email: token.email,
                 image: token.image,
                 role: token.role,
                 provider: token.provider,
                 isNewUserForOnboarding: token.isNewUserForOnboarding,
                 onboardingCompletedAt: token.onboardingCompletedAt ? (typeof token.onboardingCompletedAt === 'string' ? token.onboardingCompletedAt : new Date(token.onboardingCompletedAt).toISOString()) : null,

                 instagramConnected: token.isInstagramConnected === null ? undefined : token.isInstagramConnected, // Trata null do token para undefined na session se necessário
                 instagramAccountId: token.instagramAccountId,
                 instagramUsername: token.instagramUsername,
                 igConnectionError: token.igConnectionError, // Mantém o erro se existir no token
                 // availableIgAccounts não é passado para a sessão usualmente, pois pode ser grande e é mais para o momento do login/conexão
                 lastInstagramSyncAttempt: token.lastInstagramSyncAttempt ? (typeof token.lastInstagramSyncAttempt === 'string' ? token.lastInstagramSyncAttempt : new Date(token.lastInstagramSyncAttempt).toISOString()) : null,
                 lastInstagramSyncSuccess: token.lastInstagramSyncSuccess,

                 planStatus: token.planStatus ?? 'inactive', 
                 planExpiresAt: token.planExpiresAt ? (typeof token.planExpiresAt === 'string' ? token.planExpiresAt : new Date(token.planExpiresAt).toISOString()) : null,
                 
                 affiliateCode: token.affiliateCode, // <<<< ALTERAÇÃO AFFILIATECODE: Mapeado do token
                 affiliateBalance: undefined, // Estes seriam populados se estivessem no token e fossem necessários na sessão
                 affiliateRank: undefined,
                 affiliateInvites: undefined,
             };
             
             logger.debug(`${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, planStatus: ${session.user?.planStatus}, affiliateCode: ${session.user?.affiliateCode}, igErr: ${session.user?.igConnectionError}`);
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
        error: '/auth/error' // Página para exibir erros de autenticação (ex: /auth/error?error=CredentialsSignin)
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60 // 30 dias
    }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };