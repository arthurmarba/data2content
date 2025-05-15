// src/app/api/auth/[...nextauth]/route.ts
// VERSION: FBLinkNoNameImgUpdate+SyncStatus_ErrorPropagation_v2.1.6_periodictokenrefresh
// - CORREÇÃO: planStatus agora é corretamente selecionado do DB no callback jwt e mapeado para a sessão no callback session.
// - CORREÇÃO: affiliateCode agora é corretamente populado no token JWT e mapeado para a sessão.
// - ADICIONADO: Lógica para atualização periódica do token JWT para buscar dados frescos do DB (ex: planStatus).
// - Mantém funcionalidades e correções da v2.1.5.

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
        availableIgAccounts?: AvailableInstagramAccount[] | null;
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
         affiliateCode?: string | null;
         image?: string | null;
         // iat (issued at) e exp (expiration time) são padrão e não precisam ser redeclarados se você usar DefaultJWT
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included";
const FACEBOOK_LINK_COOKIE_NAME = "auth-link-token";
const MAX_TOKEN_AGE_BEFORE_REFRESH_MINUTES = 60; // <<<< NOVO: Intervalo para refresh periódico (em minutos)

async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    // ... (código customEncode inalterado)
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
        .setIssuedAt() // Define o campo 'iat' automaticamente
        .setExpirationTime(expirationTime)
        .sign(new TextEncoder().encode(secretString));
}

async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
    // ... (código customDecode inalterado)
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
    // ... (configurações de cookies, providers inalteradas)
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
            // ... (código signIn inalterado, apenas atualize a tag de versão se desejar)
            const TAG_SIGNIN = '[NextAuth signIn v2.1.6]'; // Version bump
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
                    // Facebook linking logic... (inalterado)
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
                    // Google sign-in logic... (inalterado)
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
                    // User mapping logic... (inalterado)
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
                    (authUserFromProvider as NextAuthUserArg).affiliateCode = dbUserRecord.affiliateCode;
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
            const TAG_JWT = '[NextAuth JWT v2.1.6]'; // Version bump
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. UserID(signIn): ${userFromSignIn?.id}. TokenInID: ${token?.id}. Token.planStatus(in): ${token.planStatus}, Token.affiliateCode(in): ${token.affiliateCode}`);

            if (trigger !== 'update') {
                delete token.igConnectionError;
            }
            delete token.availableIgAccounts;

            if ((trigger === 'signIn' || trigger === 'signUp') && userFromSignIn) {
                // ... (mapeamento inicial do userFromSignIn para o token, inalterado da v2.1.5)
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
                token.planStatus = (userFromSignIn as NextAuthUserArg).planStatus;
                token.planExpiresAt = (userFromSignIn as NextAuthUserArg).planExpiresAt;
                token.affiliateCode = (userFromSignIn as NextAuthUserArg).affiliateCode;

                logger.info(`${TAG_JWT} Token populado de userFromSignIn. ID: ${token.id}, planStatus: ${token.planStatus}, affiliateCode: ${token.affiliateCode}`);
                // Lógica do Facebook para Instagram... (inalterada)
                if (account?.provider === 'facebook' && token.id && Types.ObjectId.isValid(token.id)) {
                    // ...
                }
            }

            if (token.id && Types.ObjectId.isValid(token.id)) {
                let needsDbRefresh = trigger === 'update' ||
                                      account?.provider === 'facebook' ||
                                      !token.role || 
                                      typeof token.isInstagramConnected === 'undefined' ||
                                      typeof token.planStatus === 'undefined' || // Se planStatus não estiver definido, atualiza
                                      typeof token.affiliateCode === 'undefined';

                // <<<< NOVO: Lógica de atualização periódica do token >>>>
                const tokenIssuedAt = token.iat; // Timestamp "issued at" em segundos (padrão JWT)
                if (!needsDbRefresh && tokenIssuedAt && typeof tokenIssuedAt === 'number') { // Só checa se não precisar de refresh por outros motivos
                    const nowInSeconds = Math.floor(Date.now() / 1000);
                    const tokenAgeInMinutes = (nowInSeconds - tokenIssuedAt) / 60;

                    if (tokenAgeInMinutes > MAX_TOKEN_AGE_BEFORE_REFRESH_MINUTES) {
                        logger.info(`${TAG_JWT} Token com ${tokenAgeInMinutes.toFixed(0)} min de idade (limite: ${MAX_TOKEN_AGE_BEFORE_REFRESH_MINUTES} min). Forçando refresh do DB.`);
                        needsDbRefresh = true;
                    }
                }
                // <<<< FIM DA NOVA LÓGICA >>>>

                if (needsDbRefresh) {
                    logger.debug(`${TAG_JWT} Trigger '${trigger}' ou refresh periódico/dados ausentes. Buscando dados frescos do DB para token ID: ${token.id}`);
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(token.id)
                            .select('name email image role provider providerAccountId facebookProviderAccountId isNewUserForOnboarding onboardingCompletedAt isInstagramConnected instagramAccountId username lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorMsg planStatus planExpiresAt affiliateCode')
                            .lean<IUser>();

                        if (dbUser) {
                            token.name = dbUser.name ?? token.name;
                            token.email = dbUser.email ?? token.email;
                            token.image = dbUser.image ?? token.image;
                            token.role = dbUser.role ?? token.role ?? 'user';
                            token.provider = dbUser.provider ?? (dbUser.facebookProviderAccountId ? 'facebook' : token.provider);
                            token.isNewUserForOnboarding = typeof dbUser.isNewUserForOnboarding === 'boolean' ? dbUser.isNewUserForOnboarding : token.isNewUserForOnboarding ?? false;
                            token.onboardingCompletedAt = dbUser.onboardingCompletedAt ?? token.onboardingCompletedAt ?? null;
                            token.isInstagramConnected = dbUser.isInstagramConnected ?? false;
                            token.instagramAccountId = dbUser.instagramAccountId ?? null;
                            token.instagramUsername = dbUser.username ?? null;
                            token.lastInstagramSyncAttempt = dbUser.lastInstagramSyncAttempt ?? null;
                            token.lastInstagramSyncSuccess = dbUser.lastInstagramSyncSuccess ?? null;
                            token.igConnectionError = dbUser.instagramSyncErrorMsg || token.igConnectionError || null;
                            if (token.isInstagramConnected && !dbUser.instagramSyncErrorMsg) {
                                delete token.igConnectionError;
                            }
                            token.planStatus = dbUser.planStatus ?? token.planStatus ?? 'inactive'; // <<<< ESSENCIAL: Atualiza o planStatus
                            token.planExpiresAt = dbUser.planExpiresAt ?? token.planExpiresAt ?? null;
                            token.affiliateCode = dbUser.affiliateCode ?? token.affiliateCode ?? null;

                            logger.info(`${TAG_JWT} Token enriquecido/atualizado do DB. ID: ${token.id}, planStatus: ${token.planStatus}, affiliateCode: ${token.affiliateCode}`);
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
            logger.debug(`${TAG_JWT} FINAL jwt. Token id: '${token.id}', planStatus: ${token.planStatus}, affiliateCode: ${token.affiliateCode}, igErr: ${token.igConnectionError ? 'Sim' : 'Não'}`);
            return token;
        },

        async session({ session, token }) {
            // ... (código session inalterado da v2.1.5, apenas atualize a tag de versão se desejar)
            const TAG_SESSION = '[NextAuth Session v2.1.6]'; // Version bump
             logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token.planStatus: ${token?.planStatus}, Token.affiliateCode: ${token?.affiliateCode}, Token.igErr: ${token?.igConnectionError}`);

             if (!token?.id || !Types.ObjectId.isValid(token.id)) {
                 logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}') na sessão. Sessão será retornada vazia/padrão.`);
                 session.user = undefined;
                 return session;
             }

             session.user = {
                 id: token.id,
                 name: token.name,
                 email: token.email,
                 image: token.image,
                 role: token.role,
                 provider: token.provider,
                 isNewUserForOnboarding: token.isNewUserForOnboarding,
                 onboardingCompletedAt: token.onboardingCompletedAt ? (typeof token.onboardingCompletedAt === 'string' ? token.onboardingCompletedAt : new Date(token.onboardingCompletedAt).toISOString()) : null,
                 instagramConnected: token.isInstagramConnected === null ? undefined : token.isInstagramConnected,
                 instagramAccountId: token.instagramAccountId,
                 instagramUsername: token.instagramUsername,
                 igConnectionError: token.igConnectionError,
                 lastInstagramSyncAttempt: token.lastInstagramSyncAttempt ? (typeof token.lastInstagramSyncAttempt === 'string' ? token.lastInstagramSyncAttempt : new Date(token.lastInstagramSyncAttempt).toISOString()) : null,
                 lastInstagramSyncSuccess: token.lastInstagramSyncSuccess,
                 planStatus: token.planStatus ?? 'inactive', 
                 planExpiresAt: token.planExpiresAt ? (typeof token.planExpiresAt === 'string' ? token.planExpiresAt : new Date(token.planExpiresAt).toISOString()) : null,
                 affiliateCode: token.affiliateCode,
                 affiliateBalance: undefined,
                 affiliateRank: undefined,
                 affiliateInvites: undefined,
             };
             
             logger.debug(`${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, planStatus: ${session.user?.planStatus}, affiliateCode: ${session.user?.affiliateCode}, igErr: ${session.user?.igConnectionError}`);
             return session;
        },

        async redirect({ url, baseUrl }) {
            // ... (código redirect inalterado)
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
        maxAge: 30 * 24 * 60 * 60 // 30 dias
    }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };