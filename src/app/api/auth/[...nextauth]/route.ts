// src/app/api/auth/[...nextauth]/route.ts
// VERSÃO: v2.2.1 - Refined name handling during Facebook linking and clarified provider logic.
// - Aims to keep the original DB name more consistently.
// - Provider in token/session reflects primary registration provider.

import NextAuth from "next-auth";
import type { DefaultSession, DefaultUser, NextAuthOptions, Session, User as NextAuthUserArg, Account, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import AgencyModel from "@/app/models/Agency";

import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import type { JWT, DefaultJWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import { cookies } from 'next/headers';

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
        providerAccountId?: string | null; // Added for consistency, though id is primary
    }

    interface Session {
      user?: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        provider?: string | null; // Reflects the primary provider
        role?: string | null;
        agencyId?: string | null;
        agencyPlanStatus?: string | null;
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
        instagramAccessToken?: string | null; 
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
        agencyId?: string | null;
        agencyPlanStatus?: string | null;
        provider?: string | null; // Reflects the primary provider after initial link

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
const MAX_TOKEN_AGE_BEFORE_REFRESH_MINUTES = 60; // 1 hour

// Custom JWT encode function (remains largely the same)
async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    const TAG_ENCODE = '[NextAuth customEncode v2.2.1]';
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60); // Default 30 days
    
    const cleanToken: Record<string, any> = { ...token };

    Object.keys(cleanToken).forEach(key => {
        if (cleanToken[key] === undefined) delete cleanToken[key];
    });

    if (!cleanToken.id && cleanToken.sub) cleanToken.id = cleanToken.sub;
    else if (!cleanToken.id) cleanToken.id = ''; 

    // Ensure Date objects are stringified
    if (cleanToken.onboardingCompletedAt instanceof Date) {
        cleanToken.onboardingCompletedAt = cleanToken.onboardingCompletedAt.toISOString();
    }
    if (cleanToken.lastInstagramSyncAttempt instanceof Date) {
        cleanToken.lastInstagramSyncAttempt = cleanToken.lastInstagramSyncAttempt.toISOString();
    }
    if (cleanToken.planExpiresAt instanceof Date) {
        cleanToken.planExpiresAt = cleanToken.planExpiresAt.toISOString();
    }

    if (cleanToken.image && cleanToken.picture) delete cleanToken.picture; // Remove redundant 'picture' if 'image' exists
    delete cleanToken.instagramSyncErrorMsg; // Not needed in JWT directly, use igConnectionError

    // Serialize complex objects like availableIgAccounts carefully
    if (cleanToken.availableIgAccounts && Array.isArray(cleanToken.availableIgAccounts)) {
        try {
            // Simple stringify/parse for deep clone and ensuring plain object structure
            cleanToken.availableIgAccounts = JSON.parse(JSON.stringify(cleanToken.availableIgAccounts));
            logger.debug(`${TAG_ENCODE} availableIgAccounts serializado para JWT.`);
        } catch (e) {
            logger.error(`${TAG_ENCODE} Erro ao serializar/desserializar availableIgAccounts:`, e);
            delete cleanToken.availableIgAccounts; // Remove if problematic
            logger.warn(`${TAG_ENCODE} Campo availableIgAccounts removido do token devido a erro de serialização.`);
        }
    }
    
    return new SignJWT(cleanToken)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expirationTime)
        .sign(new TextEncoder().encode(secretString));
}

// Custom JWT decode function (remains largely the same)
async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
    const TAG_DECODE = '[NextAuth customDecode v2.2.1]';
    if (!token || !secret) {
        logger.error(`${TAG_DECODE} Token ou secret não fornecidos.`);
        return null;
    }
    const secretString = typeof secret === "string" ? secret : String(secret);
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString), { algorithms: ["HS256"] });
        const decodedPayload: Partial<JWT> = { ...payload };

        // Ensure id is a string
        if (decodedPayload.id && typeof decodedPayload.id !== 'string') {
            decodedPayload.id = String(decodedPayload.id);
        } else if (!decodedPayload.id && decodedPayload.sub) {
            decodedPayload.id = decodedPayload.sub; // Use sub as id if id is missing
        } else if (!decodedPayload.id) {
            decodedPayload.id = ''; // Default to empty string if no id/sub
        }

        // Convert date strings back to Date objects
        if (decodedPayload.onboardingCompletedAt && typeof decodedPayload.onboardingCompletedAt === 'string') {
            decodedPayload.onboardingCompletedAt = new Date(decodedPayload.onboardingCompletedAt);
        }
        if (decodedPayload.lastInstagramSyncAttempt && typeof decodedPayload.lastInstagramSyncAttempt === 'string') {
            decodedPayload.lastInstagramSyncAttempt = new Date(decodedPayload.lastInstagramSyncAttempt);
        }
        if (decodedPayload.planExpiresAt && typeof decodedPayload.planExpiresAt === 'string') {
            decodedPayload.planExpiresAt = new Date(decodedPayload.planExpiresAt);
        }
        
        // Handle picture vs image consistency
        if (decodedPayload.picture && !decodedPayload.image) { 
            decodedPayload.image = decodedPayload.picture as string;
        }
        // delete decodedPayload.picture; // Optional: remove picture after mapping

        return decodedPayload as JWT;
    } catch (err) {
        logger.error(`${TAG_DECODE} Erro ao decodificar token: ${err instanceof Error ? err.message : String(err)}`);
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
        // Consider adding state cookie for OAuth flows if not already handled by NextAuth default
    },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { scope: "openid email profile" } },
            profile(profile) { // Profile type is inferred correctly by NextAuth
                // === INÍCIO DA MODIFICAÇÃO PARA DEBUG ===
                const profileJsonString = JSON.stringify(profile, null, 2); // null, 2 para formatar o JSON
                logger.debug(`[NextAuth Google Profile DEBUG - CONTEÚDO COMPLETO] Profile recebido do Google: ${profileJsonString}`);
                // === FIM DA MODIFICAÇÃO PARA DEBUG ===
        
                // Ensure a non-empty name, fallback if necessary
                const name = profile.name && profile.name.trim() !== "" ? profile.name.trim() : profile.email?.split('@')[0] ?? "User";
                return {
                    id: profile.sub!,
                    name: name,
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
                    scope: 'email,public_profile,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights,business_management',
                    auth_type: 'rerequest' 
                }
            },
            profile(profile) { // Profile type is inferred
                logger.debug("NextAuth: Facebook profile returned:", profile);
                 // Ensure a non-empty name, fallback if necessary
                const name = profile.name && profile.name.trim() !== "" ? profile.name.trim() : profile.email?.split('@')[0] ?? "User";
                return {
                    id: profile.id!, // Facebook uses 'id'
                    name: name,
                    email: profile.email,
                    image: profile.picture?.data?.url,
                    // Note: Other custom fields are added in callbacks
                };
            }
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Senha", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials.password) {
                    return null;
                }

                await connectToDatabase();

                const user = await DbUser.findOne({ email: credentials.email }).select('+password');

                if (!user) {
                    logger.warn('Nenhum usuário encontrado com este e-mail.');
                    return null;
                }

                const passwordsMatch = await bcrypt.compare(credentials.password, user.password as string);

                if (!passwordsMatch) {
                    logger.warn('Senha incorreta.');
                    return null;
                }

                logger.info(`Login bem-sucedido para ${user.email}`);
                return {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    role: user.role,
                    agency: user.agency ? user.agency.toString() : null,
                } as NextAuthUserArg;
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
            const TAG_SIGNIN = '[NextAuth signIn v2.2.1]';
            logger.debug(`${TAG_SIGNIN} Iniciado`, { providerAccountIdReceived: authUserFromProvider.id, provider: account?.provider, email: authUserFromProvider.email });

            if (!account || !account.provider || !authUserFromProvider?.id) {
                 logger.error(`${TAG_SIGNIN} Dados essenciais ausentes (account, provider, user.id).`, { account, user: authUserFromProvider });
                 return false; // Or redirect to an error page: return '/auth/error?error=SignInMissingData';
            }

            if (account.provider === 'credentials') {
                logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials (utilizador: ${authUserFromProvider.id}).`);
                // For credentials, authUserFromProvider is already the rich object from authorize
                // No DB lookup needed here if authorize already prepared it.
                return true;
            }

            // OAuth providers (Google, Facebook)
            const provider = account.provider;
            const providerAccountId = authUserFromProvider.id; // ID from the provider (Google sub or Facebook ID)
            const currentEmailFromProvider = authUserFromProvider.email;
            const nameFromProvider = authUserFromProvider.name; // Name from provider's profile()
            const imageFromProvider = authUserFromProvider.image; // Image from provider's profile()

            if (!providerAccountId) {
                logger.error(`${TAG_SIGNIN} providerAccountId (ID do ${provider}) ausente.`);
                return false; // Or redirect
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
                            // Email: Keep existing DB email. Only set if DB email is missing.
                            if (!dbUserRecord.email && currentEmailFromProvider) {
                                dbUserRecord.email = currentEmailFromProvider;
                            } else if (dbUserRecord.email && currentEmailFromProvider && dbUserRecord.email.toLowerCase() !== currentEmailFromProvider.toLowerCase()){
                                logger.warn(`${TAG_SIGNIN} [Facebook] Email do Facebook ('${currentEmailFromProvider}') é DIFERENTE do email no DB ('${dbUserRecord.email}') para User ${dbUserRecord._id}. O email do DB será mantido.`);
                            }
                            // Name & Image: DO NOT update from Facebook if linking to an existing account. Keep DB's original name/image.
                            // The name/image from Facebook's profile() (nameFromProvider, imageFromProvider) are ignored here for an existing linked user.
                            // authUserFromProvider will be populated with dbUserRecord's details later.

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
                                        dbUserRecord.isInstagramConnected = false; // Will be set true when user selects an account
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
                            return '/login?error=FacebookLinkFailed'; // Redirect to login with error
                        }
                    } else {
                        logger.warn(`${TAG_SIGNIN} [Facebook] Nenhum linkToken ('${FACEBOOK_LINK_COOKIE_NAME}') encontrado. Vinculação requerida. Login/Criação direta via Facebook não permitida neste fluxo.`);
                        return '/login?error=FacebookLinkRequired'; // Redirect
                    }
                }
                else if (provider === 'google') {
                    // Try to find user by provider ID first
                    dbUserRecord = await DbUser.findOne({ provider: provider, providerAccountId: providerAccountId }).exec();
                    
                    if (!dbUserRecord && currentEmailFromProvider) {
                        // If not found by provider ID, try by email (to link to an existing email account)
                        const userByEmail = await DbUser.findOne({ email: currentEmailFromProvider }).exec();
                        if (userByEmail) {
                            logger.info(`${TAG_SIGNIN} [Google] Utilizador Data2Content existente ${userByEmail._id} encontrado por email. Vinculando Google ID ${providerAccountId}.`);
                            dbUserRecord = userByEmail;
                            dbUserRecord.provider = provider; // Set Google as the provider
                            dbUserRecord.providerAccountId = providerAccountId;
                            // Update name/image from Google if DB's are different or not set
                            if (nameFromProvider && nameFromProvider !== dbUserRecord.name) dbUserRecord.name = nameFromProvider;
                            if (imageFromProvider && imageFromProvider !== dbUserRecord.image) dbUserRecord.image = imageFromProvider;
                            // Ensure name is not an empty string, use a fallback if needed
                            if (dbUserRecord.name && dbUserRecord.name.trim() === "") {
                                dbUserRecord.name = currentEmailFromProvider.split('@')[0]; // Fallback name
                            }
                            await dbUserRecord.save();
                        }
                    }

                    if (!dbUserRecord) { // No existing user found by provider ID or email, create new
                        if (!currentEmailFromProvider) {
                            logger.error(`${TAG_SIGNIN} [Google] Email ausente ao CRIAR novo utilizador Google.`);
                            return false; // Or redirect
                        }
                        logger.info(`${TAG_SIGNIN} [Google] Criando NOVO utilizador Data2Content para ${currentEmailFromProvider} via Google...`);
                        
                        // Ensure name is not an empty string from provider, use a fallback
                        const finalNameForNewUser = (nameFromProvider && nameFromProvider.trim() !== "") ? nameFromProvider.trim() : currentEmailFromProvider.split('@')[0];

                        const newUserInDb = new DbUser({
                            name: finalNameForNewUser,
                            email: currentEmailFromProvider,
                            image: imageFromProvider,
                            provider: provider, // Google
                            providerAccountId: providerAccountId,
                            role: 'user',
                            isNewUserForOnboarding: true,
                            onboardingCompletedAt: null,
                            communityInspirationOptIn: true,
                            communityInspirationOptInDate: new Date(),
                            communityInspirationTermsVersion: DEFAULT_TERMS_VERSION,
                            isInstagramConnected: false,
                            planStatus: 'inactive',
                            // affiliateCode is generated by pre-save hook in User model
                        });
                        dbUserRecord = await newUserInDb.save();
                        isNewUser = true;
                        logger.info(`${TAG_SIGNIN} [Google] Novo utilizador Data2Content CRIADO com _id: '${dbUserRecord._id}'. AffiliateCode gerado: ${dbUserRecord.affiliateCode}`);
                    }
                }

                if (dbUserRecord) {
                    // Populate the authUserFromProvider object (which becomes `user` in JWT callback)
                    // with definitive data from our DB.
                    authUserFromProvider.id = dbUserRecord._id.toString(); // This is OUR DB user ID
                    authUserFromProvider.name = dbUserRecord.name; // Use name from DB
                    authUserFromProvider.email = dbUserRecord.email; // Use email from DB
                    authUserFromProvider.image = dbUserRecord.image; // Use image from DB
                    
                    // Add custom fields from DB to the user object for JWT
                    (authUserFromProvider as NextAuthUserArg).role = dbUserRecord.role ?? 'user';
                    (authUserFromProvider as NextAuthUserArg).isNewUserForOnboarding = (provider === 'google' && isNewUser) || (dbUserRecord.isNewUserForOnboarding ?? false);
                    (authUserFromProvider as NextAuthUserArg).onboardingCompletedAt = dbUserRecord.onboardingCompletedAt;
                    (authUserFromProvider as NextAuthUserArg).provider = dbUserRecord.provider ?? provider; // Primary provider from DB
                    
                    (authUserFromProvider as NextAuthUserArg).isInstagramConnected = dbUserRecord.isInstagramConnected ?? false;
                    (authUserFromProvider as NextAuthUserArg).instagramAccountId = dbUserRecord.instagramAccountId; 
                    (authUserFromProvider as NextAuthUserArg).instagramUsername = dbUserRecord.username; // Assuming 'username' is IG username
                    (authUserFromProvider as NextAuthUserArg).lastInstagramSyncAttempt = dbUserRecord.lastInstagramSyncAttempt;
                    (authUserFromProvider as NextAuthUserArg).lastInstagramSyncSuccess = dbUserRecord.lastInstagramSyncSuccess;
                    (authUserFromProvider as NextAuthUserArg).instagramSyncErrorMsg = dbUserRecord.instagramSyncErrorMsg; 
                    (authUserFromProvider as NextAuthUserArg).availableIgAccounts = dbUserRecord.availableIgAccounts as ServiceAvailableIgAccount[] | null | undefined;
                    (authUserFromProvider as NextAuthUserArg).instagramAccessToken = dbUserRecord.instagramAccessToken; 

                    (authUserFromProvider as NextAuthUserArg).planStatus = dbUserRecord.planStatus;
                    (authUserFromProvider as NextAuthUserArg).planExpiresAt = dbUserRecord.planExpiresAt;
                    (authUserFromProvider as NextAuthUserArg).affiliateCode = dbUserRecord.affiliateCode;
                    (authUserFromProvider as NextAuthUserArg).agency = dbUserRecord.agency ? dbUserRecord.agency.toString() : undefined;
                    
                    logger.debug(`${TAG_SIGNIN} [${provider}] FINAL signIn. authUser.id (interno): '${authUserFromProvider.id}', name: '${authUserFromProvider.name}', provider (final): '${(authUserFromProvider as NextAuthUserArg).provider}', planStatus: ${(authUserFromProvider as NextAuthUserArg).planStatus}, igAccountsCount: ${(authUserFromProvider as NextAuthUserArg).availableIgAccounts?.length ?? 0}, igLlatSet: ${!!(authUserFromProvider as NextAuthUserArg).instagramAccessToken}`);
                    return true;
                } else {
                    logger.error(`${TAG_SIGNIN} [${provider}] dbUserRecord não foi definido. Falha no signIn.`);
                    return false; // Or redirect
                }

            } catch (error) {
                 logger.error(`${TAG_SIGNIN} Erro no DB durante signIn para ${provider} (ProviderAccID: ${providerAccountId}):`, error);
                 return false; // Or redirect
            }
        },

        async jwt({ token, user: userFromSignIn, account, trigger, session: updateSessionData }) {
            const TAG_JWT = '[NextAuth JWT v2.2.1]';
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. UserID(signIn): ${userFromSignIn?.id}. TokenInID: ${token?.id}. Token.planStatus(in): ${token.planStatus}, Token.affiliateCode(in): ${token.affiliateCode}`);

            // On initial signIn or signUp, populate token from the user object (prepared in signIn callback)
            if ((trigger === 'signIn' || trigger === 'signUp') && userFromSignIn) {
                token.id = userFromSignIn.id; // This is our DB User ID
                token.sub = userFromSignIn.id; // Standard JWT subject claim
                token.name = userFromSignIn.name;
                token.email = userFromSignIn.email;
                token.image = userFromSignIn.image;
                token.role = (userFromSignIn as NextAuthUserArg).role ?? 'user';
                // Provider in token:
                // - If linking (e.g. Facebook), account.provider is 'facebook'.
                // - (userFromSignIn as NextAuthUserArg).provider is what we set from DB (e.g. 'google').
                // For consistency, let token.provider reflect the DB's primary provider after the initial event.
                // However, account.provider is useful to know which provider triggered this specific JWT creation.
                // Let's store the primary DB provider.
                token.provider = (userFromSignIn as NextAuthUserArg).provider; 
                
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
                token.agencyId = (userFromSignIn as NextAuthUserArg).agency ?? null;
                if (token.agencyId) {
                    try {
                        await connectToDatabase();
                        const agency = await AgencyModel.findById(token.agencyId).select('planStatus').lean();
                        token.agencyPlanStatus = agency?.planStatus ?? null;
                    } catch (e) {
                        logger.error(`${TAG_JWT} Erro ao buscar planStatus da agência ${token.agencyId}:`, e);
                        token.agencyPlanStatus = null;
                    }
                } else {
                    token.agencyPlanStatus = null;
                }

                logger.info(`${TAG_JWT} Token populado de userFromSignIn. ID: ${token.id}, Provider: ${token.provider}, planStatus: ${token.planStatus}, igAccounts: ${token.availableIgAccounts?.length}, igLlatSet: ${!!token.instagramAccessToken}`);
            }

            // For subsequent JWT reads (e.g., session creation, API calls) or updates
            if (token.id && Types.ObjectId.isValid(token.id)) {
                let needsDbRefresh = trigger === 'update' || // Explicit update
                                      !token.role ||  // Missing essential data
                                      typeof token.planStatus === 'undefined' ||
                                      typeof token.affiliateCode === 'undefined' ||
                                      (typeof token.isInstagramConnected === 'undefined' && typeof token.availableIgAccounts === 'undefined');

                // Periodic refresh logic
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
                            .select('name email image role agency provider providerAccountId facebookProviderAccountId isNewUserForOnboarding onboardingCompletedAt isInstagramConnected instagramAccountId username lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorMsg planStatus planExpiresAt affiliateCode availableIgAccounts instagramAccessToken')
                            .lean<IUser>(); // Use lean for performance

                        if (dbUser) {
                            // Update token with fresh data from DB
                            token.name = dbUser.name ?? token.name; // Prioritize DB name
                            token.email = dbUser.email ?? token.email;
                            token.image = dbUser.image ?? token.image;
                            token.role = dbUser.role ?? token.role ?? 'user';
                            token.provider = dbUser.provider ?? token.provider; // Primary provider from DB
                            
                            token.isNewUserForOnboarding = typeof dbUser.isNewUserForOnboarding === 'boolean' ? dbUser.isNewUserForOnboarding : token.isNewUserForOnboarding ?? false;
                            token.onboardingCompletedAt = dbUser.onboardingCompletedAt ?? token.onboardingCompletedAt ?? null;
                            
                            token.isInstagramConnected = dbUser.isInstagramConnected ?? token.isInstagramConnected ?? false;
                            token.instagramAccountId = dbUser.instagramAccountId ?? token.instagramAccountId ?? null;
                            token.instagramUsername = dbUser.username ?? token.instagramUsername ?? null; // IG username
                            token.lastInstagramSyncAttempt = dbUser.lastInstagramSyncAttempt ?? token.lastInstagramSyncAttempt ?? null;
                            token.lastInstagramSyncSuccess = dbUser.lastInstagramSyncSuccess ?? token.lastInstagramSyncSuccess ?? null;
                            token.igConnectionError = dbUser.instagramSyncErrorMsg ?? token.igConnectionError ?? null;
                            if (dbUser.isInstagramConnected && !dbUser.instagramSyncErrorMsg) { // Clear error if connected and no new error
                                token.igConnectionError = null; 
                            }
                            token.availableIgAccounts = (dbUser.availableIgAccounts as ServiceAvailableIgAccount[] | null | undefined) ?? token.availableIgAccounts ?? null;
                            token.instagramAccessToken = dbUser.instagramAccessToken ?? token.instagramAccessToken ?? null;

                            token.planStatus = dbUser.planStatus ?? token.planStatus ?? 'inactive';
                            token.planExpiresAt = dbUser.planExpiresAt ?? token.planExpiresAt ?? null;
                            token.affiliateCode = dbUser.affiliateCode ?? token.affiliateCode ?? null;
                            token.agencyId = dbUser.agency ? dbUser.agency.toString() : token.agencyId ?? null;
                            if (token.agencyId) {
                                try {
                                    const agency = await AgencyModel.findById(token.agencyId).select('planStatus').lean();
                                    token.agencyPlanStatus = agency?.planStatus ?? null;
                                } catch (e) {
                                    logger.error(`${TAG_JWT} Erro ao buscar planStatus da agência ${token.agencyId}:`, e);
                                    token.agencyPlanStatus = null;
                                }
                            } else {
                                token.agencyPlanStatus = null;
                            }

                            logger.info(`${TAG_JWT} Token enriquecido/atualizado do DB. ID: ${token.id}, Provider: ${token.provider}, planStatus: ${token.planStatus}, igAccounts: ${token.availableIgAccounts?.length}, igLlatSet: ${!!token.instagramAccessToken}, igErr: ${token.igConnectionError ? 'Sim ('+String(token.igConnectionError).substring(0,30)+'...)': 'Não'}`);
                        } else {
                            logger.warn(`${TAG_JWT} Utilizador ${token.id} não encontrado no DB durante refresh de token. Invalidando token (returning empty).`);
                            return {} as JWT; // Return empty object to invalidate
                        }
                    } catch (error) {
                        logger.error(`${TAG_JWT} Erro ao buscar dados do DB para enriquecer/atualizar token ${token.id}:`, error);
                        // Potentially return existing token or invalidate based on error severity
                    }
                }
            } else {
                // If token.id is invalid/missing outside of signIn/signUp, invalidate it
                if (trigger !== 'signIn' && trigger !== 'signUp') { 
                    logger.warn(`${TAG_JWT} Token com ID inválido ou ausente ('${token.id}') fora do login/signup. Invalidando.`);
                    return {} as JWT; 
                }
            }
            
            // Ensure 'picture' is not in the final token if 'image' is used
            if (token.image && (token as any).picture) delete (token as any).picture; 

            logger.debug(`${TAG_JWT} FINAL jwt. Token id: '${token.id}', name: '${token.name}', provider: '${token.provider}', planStatus: ${token.planStatus}, agencyPlanStatus: ${token.agencyPlanStatus}, affiliateCode: ${token.affiliateCode}, agencyId: ${token.agencyId}, igErr: ${token.igConnectionError ? 'Sim ('+String(token.igConnectionError).substring(0,30)+'...)': 'Não'}`);
            return token;
        },

        async session({ session, token }) {
            const TAG_SESSION = '[NextAuth Session v2.2.1]';
            logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token.Provider: ${token?.provider}, Token.planStatus (vindo do token JWT): ${token?.planStatus}`);

            if (!token?.id || !Types.ObjectId.isValid(token.id)) {
                logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}') na sessão. Sessão será retornada vazia/padrão.`);
                // @ts-ignore // NextAuth types might not expect user to be undefined, but it's safer
                return { ...session, user: undefined, expires: session.expires }; 
            }

            // Initialize session.user if it doesn't exist
            if (!session.user) session.user = { id: token.id }; 
            else session.user.id = token.id; // Ensure ID is always from token
            
            // Populate session.user from the token (which should be up-to-date from JWT callback)
            session.user.name = token.name;
            session.user.email = token.email;
            session.user.image = token.image;
            session.user.role = token.role;
            session.user.provider = token.provider; // This will be the primary provider from DB
            session.user.isNewUserForOnboarding = token.isNewUserForOnboarding;
            session.user.onboardingCompletedAt = token.onboardingCompletedAt ? (typeof token.onboardingCompletedAt === 'string' ? token.onboardingCompletedAt : new Date(token.onboardingCompletedAt).toISOString()) : null;
            
            session.user.instagramConnected = token.isInstagramConnected ?? undefined; 
            session.user.instagramAccountId = token.instagramAccountId;
            session.user.instagramUsername = token.instagramUsername;
            session.user.igConnectionError = token.igConnectionError;
            session.user.availableIgAccounts = token.availableIgAccounts; 
            session.user.instagramAccessToken = token.instagramAccessToken; 
            session.user.lastInstagramSyncAttempt = token.lastInstagramSyncAttempt ? (typeof token.lastInstagramSyncAttempt === 'string' ? token.lastInstagramSyncAttempt : new Date(token.lastInstagramSyncAttempt).toISOString()) : null;
            session.user.lastInstagramSyncSuccess = token.lastInstagramSyncSuccess;

            session.user.planStatus = token.planStatus ?? 'inactive';
            session.user.planExpiresAt = token.planExpiresAt ? (typeof token.planExpiresAt === 'string' ? token.planExpiresAt : new Date(token.planExpiresAt).toISOString()) : null;
            session.user.affiliateCode = token.affiliateCode;
            session.user.agencyId = token.agencyId ?? null;
            session.user.agencyPlanStatus = token.agencyPlanStatus ?? null;
            
            // These fields might be populated from other sources or kept if already in session
            session.user.affiliateBalance = session.user.affiliateBalance ?? undefined; 
            session.user.affiliateRank = session.user.affiliateRank ?? undefined;
            session.user.affiliateInvites = session.user.affiliateInvites ?? undefined;
            
            // Optional: Re-validate critical session fields directly from DB if needed,
            // though JWT callback should keep token fresh. This adds an extra DB call.
            // For example, to ensure planStatus is absolutely current:
            try {
                await connectToDatabase();
                const dbUserCheck = await DbUser.findById(token.id)
                    .select('planStatus planExpiresAt name role image') // Select only needed fields
                    .lean<Pick<IUser, 'planStatus' | 'planExpiresAt' | 'name' | 'role' | 'image'>>();

                if (dbUserCheck && session.user) {
                    logger.info(`${TAG_SESSION} Revalidando sessão com dados do DB para User ID: ${token.id}. DB planStatus: ${dbUserCheck.planStatus}. Session planStatus (antes da revalidação DB): ${session.user.planStatus}`);
                    session.user.planStatus = dbUserCheck.planStatus ?? session.user.planStatus ?? 'inactive';
                    if (dbUserCheck.planExpiresAt instanceof Date) {
                        session.user.planExpiresAt = dbUserCheck.planExpiresAt.toISOString();
                    } else if (dbUserCheck.planExpiresAt === null) { // Explicitly handle null
                        session.user.planExpiresAt = null;
                    }
                    if (session.user.agencyId) {
                        try {
                            const agency = await AgencyModel.findById(session.user.agencyId).select('planStatus').lean();
                            session.user.agencyPlanStatus = agency?.planStatus ?? session.user.agencyPlanStatus ?? null;
                        } catch (e) {
                            logger.error(`${TAG_SESSION} Erro ao buscar planStatus da agência ${session.user.agencyId}:`, e);
                        }
                    }
                    // Ensure name, role, image are from the latest DB record if they exist
                    if (dbUserCheck.name) session.user.name = dbUserCheck.name;
                    if (dbUserCheck.role) session.user.role = dbUserCheck.role;
                    if (dbUserCheck.image) session.user.image = dbUserCheck.image;

                } else if (!dbUserCheck) {
                    logger.warn(`${TAG_SESSION} Utilizador ${token.id} não encontrado no DB durante revalidação da sessão. Usando dados do token como estão.`);
                }
            } catch (error) {
                logger.error(`${TAG_SESSION} Erro ao buscar dados do DB para revalidação da sessão ${token.id}:`, error);
            }
            
            logger.debug(`${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, Name: ${session.user?.name}, Provider: ${session.user?.provider}, Session planStatus (final): ${session.user?.planStatus}, agencyId: ${session.user?.agencyId}, agencyPlanStatus: ${session.user?.agencyPlanStatus}, igAccounts: ${session.user?.availableIgAccounts?.length}, igErr: ${session.user?.igConnectionError ? 'Sim' : 'Não'}`);
            return session;
         },

        async redirect({ url, baseUrl }) {
            const requestedUrl = new URL(url, baseUrl); // url can be relative
            const base = new URL(baseUrl); // baseUrl is always absolute
            
            // Allow redirects to the same origin
            if (requestedUrl.origin === base.origin) {
              logger.debug(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é interna. Permitindo.`);
              return requestedUrl.toString();
            }
            // Allow redirects to common auth-related subdomains if necessary (e.g. accounts.google.com)
            // Be very careful with allowing external redirects.

            logger.warn(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é externa ou inválida. Redirecionando para baseUrl: ${baseUrl}.`);
            return baseUrl; // Default: redirect to base URL for safety
        }
    },
    pages: {
        signIn: '/login', // Your custom login page
        error: '/auth/error', // Your custom error page (e.g., for displaying OAuth errors)
        // signOut: '/auth/signout', // Custom signout page if needed
        // verifyRequest: '/auth/verify-request', // For email provider
        // newUser: '/auth/new-user' // If you want a custom page for new users (isNewUserForOnboarding)
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days (JWT expiration, also session cookie maxAge if not using DB sessions)
        // updateAge: 24 * 60 * 60, // 24 hours (how often to update the session in the background)
    }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
