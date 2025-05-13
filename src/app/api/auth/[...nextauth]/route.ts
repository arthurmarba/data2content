// src/app/api/auth/[...nextauth]/route.ts
// VERSION: FBLinkNoNameImgUpdate + SyncStatus
// - MODIFICADO (session callback): Adiciona lastInstagramSyncAttempt e lastInstagramSyncSuccess à sessão.
// - MODIFICADO (User interface): Adiciona os campos de status de sincronização.
// - Mantém lógica anterior para signIn (Facebook): STRICTLY requires 'auth-link-token', links to existing user,
//   Name/Image from FB DO NOT update DB, FB email only populates DB email if empty, NO new user creation via FB.
// - Mantém lógica anterior para signIn (Google).
// - Mantém lógica anterior para jwt (Instagram connection).

import NextAuth from "next-auth";
import type { DefaultSession, DefaultUser, NextAuthOptions, Session, User as NextAuthUserArg, Account, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import type { CredentialInput } from "next-auth/providers/credentials";

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import * as dataService from "@/app/lib/dataService";
import { cookies } from 'next/headers';
import {
    fetchAvailableInstagramAccounts,
    connectInstagramAccount,
    AvailableInstagramAccount,
    clearInstagramConnection
} from "@/app/lib/instagramService";
import { UserNotFoundError, DatabaseError } from "@/app/lib/errors";

// --- AUGMENT NEXT-AUTH TYPES ---
declare module "next-auth" {
    interface User extends DefaultUser {
        id: string;
        role?: string | null;
        provider?: string | null;
        isNewUserForOnboarding?: boolean;
        onboardingCompletedAt?: Date | null;
        image?: string | null;
        isInstagramConnected?: boolean | null;
        planStatus?: string | null;
        planExpiresAt?: string | null;
        affiliateCode?: string | null;
        instagramAccountId?: string | null;
        instagramUsername?: string | null;
        availableIgAccounts?: AvailableInstagramAccount[] | null;
        igConnectionError?: string | null;
        // <<< ADICIONADO: Campos de status da sincronização >>>
        lastInstagramSyncAttempt?: string | null; // Enviado como string ISO para o cliente
        lastInstagramSyncSuccess?: boolean | null;
    }
    interface Session extends DefaultSession {
        user?: User; // User aqui já inclui os novos campos
    }
}
declare module "next-auth/jwt" {
     interface JWT {
         id: string;
         sub?: string;
         name?: string | null;
         email?: string | null;
         image?: string | null;
         picture?: string | null;
         role?: string | null;
         provider?: string | null;
         isNewUserForOnboarding?: boolean;
         onboardingCompletedAt?: Date | null; // Mantido como Date no JWT, convertido para string no encode
         isInstagramConnected?: boolean | null;
         availableIgAccounts?: AvailableInstagramAccount[] | null;
         igConnectionError?: string | null;
         // <<< ADICIONADO: Campos de status da sincronização (opcional no JWT, mas populado na session) >>>
         lastInstagramSyncAttempt?: Date | null; // Pode ser Date no JWT
         lastInstagramSyncSuccess?: boolean | null;
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included";
const FACEBOOK_LINK_COOKIE_NAME = "auth-link-token";

// --- Funções customEncode e customDecode ---
async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
    const cleanToken: Record<string, any> = { ...token };
    Object.keys(cleanToken).forEach(key => {
        if (cleanToken[key] === undefined) delete cleanToken[key];
    });
    if (!cleanToken.id) cleanToken.id = '';
    if (cleanToken.onboardingCompletedAt instanceof Date) {
        cleanToken.onboardingCompletedAt = cleanToken.onboardingCompletedAt.toISOString();
    }
    // <<< ADICIONADO: Serializar lastInstagramSyncAttempt para o JWT se for Date >>>
    if (cleanToken.lastInstagramSyncAttempt instanceof Date) {
        cleanToken.lastInstagramSyncAttempt = cleanToken.lastInstagramSyncAttempt.toISOString();
    }
    if (cleanToken.image) delete cleanToken.picture;
    delete cleanToken.availableIgAccounts; // Não incluir a lista completa no JWT final
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
        } else if (!decodedPayload.id) {
            decodedPayload.id = '';
        }
        if (decodedPayload.onboardingCompletedAt && typeof decodedPayload.onboardingCompletedAt === 'string') {
            decodedPayload.onboardingCompletedAt = new Date(decodedPayload.onboardingCompletedAt);
        }
        // <<< ADICIONADO: Deserializar lastInstagramSyncAttempt do JWT se for string >>>
        if (decodedPayload.lastInstagramSyncAttempt && typeof decodedPayload.lastInstagramSyncAttempt === 'string') {
            decodedPayload.lastInstagramSyncAttempt = new Date(decodedPayload.lastInstagramSyncAttempt);
        }
        if (decodedPayload.picture && !decodedPayload.image) decodedPayload.image = decodedPayload.picture;
        return decodedPayload as JWT;
    } catch (err) {
        logger.error(`[customDecode] Erro ao decodificar token: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
// --- Fim Funções customEncode e customDecode ---

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
                    image: profile.picture
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
                        isInstagramConnected: false
                        // Não precisa adicionar lastInstagramSyncAttempt/Success para demo user
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
            const TAG_SIGNIN = '[NextAuth signIn FBLinkNoNameImgUpdate+SyncStatus]';
            logger.debug(`${TAG_SIGNIN} Iniciado`, { providerAccountIdReceived: authUserFromProvider.id, provider: account?.provider, email: authUserFromProvider.email });

            if (!account || !account.provider || !authUserFromProvider?.id) {
                 logger.error(`${TAG_SIGNIN} Dados essenciais ausentes (account, provider, user.id).`, { account, user: authUserFromProvider });
                 return false;
            }

            if (account.provider === 'credentials') {
                logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials (utilizador: ${authUserFromProvider.id}).`);
                Object.assign(authUserFromProvider, { id: authUserFromProvider.id });
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
                        logger.info(`${TAG_SIGNIN} [Facebook] Tentando vincular via linkToken ('${FACEBOOK_LINK_COOKIE_NAME}'): ${linkTokenFromCookie}`);
                        dbUserRecord = await DbUser.findOne({
                            linkToken: linkTokenFromCookie,
                            linkTokenExpiresAt: { $gt: new Date() }
                        });

                        if (dbUserRecord) {
                            logger.info(`${TAG_SIGNIN} [Facebook] Utilizador Data2Content ${dbUserRecord._id} (Email DB: ${dbUserRecord.email || 'N/A'}) encontrado por linkToken.`);
                            logger.info(`${TAG_SIGNIN} [Facebook] Vinculando Facebook ID: ${providerAccountId}. Email do Facebook Provider: ${currentEmailFromProvider || 'N/A'}.`);
                            dbUserRecord.facebookProviderAccountId = providerAccountId;
                            logger.info(`${TAG_SIGNIN} [Facebook] Nome e Imagem do DB para User ${dbUserRecord._id} serão mantidos (não atualizados pelo Facebook).`);
                            if (!dbUserRecord.email && currentEmailFromProvider) {
                                dbUserRecord.email = currentEmailFromProvider;
                                logger.info(`${TAG_SIGNIN} [Facebook] Email do utilizador ${dbUserRecord._id} preenchido com o email do Facebook: ${currentEmailFromProvider} (estava vazio).`);
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
                            return false;
                        }
                    } else {
                        logger.warn(`${TAG_SIGNIN} [Facebook] Nenhum linkToken ('${FACEBOOK_LINK_COOKIE_NAME}') encontrado. Vinculação requerida. Login/Criação direta via Facebook não permitida.`);
                        return false;
                    }
                }
                else if (provider === 'google') {
                    logger.debug(`${TAG_SIGNIN} [Google] Tentando encontrar usuário por providerAccountId: ${providerAccountId}`);
                    dbUserRecord = await DbUser.findOne({ provider: provider, providerAccountId: providerAccountId }).exec();

                    if (!dbUserRecord && currentEmailFromProvider) {
                        logger.debug(`${TAG_SIGNIN} [Google] Tentando encontrar usuário por email: ${currentEmailFromProvider}`);
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
                        logger.info(`${TAG_SIGNIN} [Google] Novo utilizador Data2Content CRIADO com _id: '${dbUserRecord._id}'.`);
                    }
                }

                if (dbUserRecord) {
                    Object.assign(authUserFromProvider, {
                        id: dbUserRecord._id.toString(),
                        name: dbUserRecord.name ?? nameFromProvider,
                        email: dbUserRecord.email ?? currentEmailFromProvider,
                        image: dbUserRecord.image ?? imageFromProvider,
                        role: dbUserRecord.role ?? 'user',
                        isNewUserForOnboarding: (provider === 'google' && isNewUser) || (dbUserRecord.isNewUserForOnboarding ?? false),
                        onboardingCompletedAt: dbUserRecord.onboardingCompletedAt,
                        isInstagramConnected: dbUserRecord.isInstagramConnected ?? false,
                        provider: dbUserRecord.provider ?? provider,
                        // <<< ADICIONADO: Passar dados de sincronização para o JWT se disponíveis no DBUserRecord >>>
                        lastInstagramSyncAttempt: dbUserRecord.lastInstagramSyncAttempt,
                        lastInstagramSyncSuccess: dbUserRecord.lastInstagramSyncSuccess,
                    });
                    logger.debug(`${TAG_SIGNIN} [${provider}] FINAL signIn. authUser.id (interno): '${authUserFromProvider.id}', isNewUser: ${authUserFromProvider.isNewUserForOnboarding}, isInstaConn: ${authUserFromProvider.isInstagramConnected}`);
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

        async jwt({ token, user: userFromSignIn, account, trigger, session }) {
            const TAG_JWT = '[NextAuth JWT FBLinkNoNameImgUpdate+SyncStatus]';
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Provider(acc): ${account?.provider}. UserID(signIn): ${userFromSignIn?.id}. TokenInID: ${token?.id}`);

            delete token.igConnectionError;
            delete token.availableIgAccounts;

            if ((trigger === 'signIn' || trigger === 'signUp') && userFromSignIn && account) {
                token.id = userFromSignIn.id;
                token.sub = userFromSignIn.id;
                token.name = userFromSignIn.name;
                token.email = userFromSignIn.email;
                token.image = userFromSignIn.image;
                token.role = (userFromSignIn as any).role ?? 'user';
                token.provider = account.provider;
                token.isNewUserForOnboarding = (userFromSignIn as any).isNewUserForOnboarding;
                token.onboardingCompletedAt = (userFromSignIn as any).onboardingCompletedAt;
                token.isInstagramConnected = (userFromSignIn as any).isInstagramConnected;
                // <<< ADICIONADO: Popula dados de sincronização no token a partir de userFromSignIn >>>
                token.lastInstagramSyncAttempt = (userFromSignIn as any).lastInstagramSyncAttempt;
                token.lastInstagramSyncSuccess = (userFromSignIn as any).lastInstagramSyncSuccess;


                logger.info(`${TAG_JWT} Token populado de userFromSignIn. ID: ${token.id}, Provider: ${token.provider}, isNewUser: ${token.isNewUserForOnboarding}, isInstaConn: ${token.isInstagramConnected}`);

                if (account.provider === 'facebook') {
                    const userId = token.id;
                    const shortLivedAccessToken = account.access_token;

                    if (userId && shortLivedAccessToken && Types.ObjectId.isValid(userId)) {
                        logger.info(`${TAG_JWT} [Facebook] Iniciando busca de contas IG e LLAT para User ${userId}...`);
                        try {
                            const result = await fetchAvailableInstagramAccounts(shortLivedAccessToken, userId);
                            if (result.success) {
                                logger.info(`${TAG_JWT} [Facebook] fetchAvailableInstagramAccounts OK. Contas: ${result.accounts?.length ?? 0}. LLAT Obtido: ${!!result.longLivedAccessToken}`);
                                token.availableIgAccounts = result.accounts;
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
                                                    logger.info(`${TAG_JWT} [Facebook] connectInstagramAccount chamado com sucesso (async) para ${userId}.`);
                                                    // Após a conexão, o status de sincronização será atualizado no DB.
                                                    // O próximo fetch do DB no JWT (se 'needsDbUpdate') ou na session pegará os valores atualizados.
                                                }
                                            })
                                            .catch(err => {
                                                logger.error(`${TAG_JWT} [Facebook] Erro não capturado ao chamar connectInstagramAccount (async) para ${userId}:`, err);
                                            });
                                    } else {
                                        logger.warn(`${TAG_JWT} [Facebook] Lista de contas IG retornada, mas o primeiro elemento é inválido.`);
                                        token.igConnectionError = "Erro ao processar lista de contas Instagram.";
                                    }
                                } else if (!userLongLivedAccessToken && result.accounts && result.accounts.length > 0) {
                                    logger.warn(`${TAG_JWT} [Facebook] Contas IG encontradas, mas LLAT ausente.`);
                                    token.igConnectionError = "Token de acesso de longa duração do Instagram não obtido.";
                                } else {
                                    logger.warn(`${TAG_JWT} [Facebook] Nenhuma conta IG encontrada ou LLAT ausente para User ${userId}.`);
                                    token.igConnectionError = "Nenhuma conta Instagram encontrada para vincular ou token LLAT ausente.";
                                }
                            } else {
                                logger.error(`${TAG_JWT} [Facebook] fetchAvailableInstagramAccounts falhou para User ${userId}: ${result.error}`);
                                token.igConnectionError = result.error || "Falha ao buscar contas do Instagram.";
                                if (result.error?.toLowerCase().includes('token')) {
                                    logger.warn(`${TAG_JWT} [Facebook] Erro de token. Limpando conexão antiga para User ${userId}.`);
                                    await clearInstagramConnection(userId).catch(clearErr => logger.error(`${TAG_JWT} Erro ao limpar conexão:`, clearErr));
                                    token.isInstagramConnected = false;
                                }
                            }
                        } catch (error) {
                            logger.error(`${TAG_JWT} [Facebook] Exceção durante busca/conexão IG para User ${userId}:`, error);
                            token.igConnectionError = error instanceof Error ? error.message : "Erro inesperado no processo de conexão IG.";
                            if (token.igConnectionError.toLowerCase().includes('token')) {
                                await clearInstagramConnection(userId).catch(clearErr => logger.error(`${TAG_JWT} Erro ao limpar conexão:`, clearErr));
                                token.isInstagramConnected = false;
                            }
                        }
                    } else {
                        if (!userId || !Types.ObjectId.isValid(userId)) logger.error(`${TAG_JWT} [Facebook] ID de usuário inválido ('${userId}') no token.`);
                        if (!shortLivedAccessToken) logger.error(`${TAG_JWT} [Facebook] Access token (SLT) ausente para User ${userId}.`);
                        token.igConnectionError = "Dados necessários para conexão IG ausentes.";
                    }
                }
            }

            if (token.id && Types.ObjectId.isValid(token.id)) {
                const needsDbUpdate = trigger === 'update' ||
                                      !token.role ||
                                      typeof token.isNewUserForOnboarding === 'undefined' ||
                                      typeof token.isInstagramConnected === 'undefined' ||
                                      // <<< ADICIONADO: Atualizar dados de sincronização se não estiverem no token >>>
                                      typeof token.lastInstagramSyncAttempt === 'undefined' ||
                                      typeof token.lastInstagramSyncSuccess === 'undefined' ||
                                      account?.provider === 'facebook';

                if (needsDbUpdate) {
                    logger.debug(`${TAG_JWT} Trigger '${trigger}' ou dados ausentes/login FB. Buscando dados frescos do DB para token ID: ${token.id}`);
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(token.id)
                            // <<< ADICIONADO: Selecionar campos de sincronização >>>
                            .select('name email image role provider isNewUserForOnboarding onboardingCompletedAt isInstagramConnected facebookProviderAccountId providerAccountId lastInstagramSyncAttempt lastInstagramSyncSuccess')
                            .lean();
                        if (dbUser) {
                            token.name = dbUser.name ?? token.name;
                            token.email = dbUser.email ?? token.email;
                            token.image = dbUser.image ?? token.image;
                            token.role = dbUser.role ?? token.role ?? 'user';
                            token.provider = dbUser.provider ?? (dbUser.facebookProviderAccountId ? 'facebook' : token.provider);
                            token.isNewUserForOnboarding = typeof dbUser.isNewUserForOnboarding === 'boolean' ? dbUser.isNewUserForOnboarding : token.isNewUserForOnboarding ?? false;
                            token.onboardingCompletedAt = dbUser.onboardingCompletedAt ?? token.onboardingCompletedAt ?? null;
                            token.isInstagramConnected = typeof dbUser.isInstagramConnected === 'boolean' ? dbUser.isInstagramConnected : token.isInstagramConnected ?? false;
                            // <<< ADICIONADO: Popula dados de sincronização no token a partir do DB >>>
                            token.lastInstagramSyncAttempt = dbUser.lastInstagramSyncAttempt ?? token.lastInstagramSyncAttempt ?? null;
                            token.lastInstagramSyncSuccess = typeof dbUser.lastInstagramSyncSuccess === 'boolean' ? dbUser.lastInstagramSyncSuccess : token.lastInstagramSyncSuccess ?? null;

                            logger.info(`${TAG_JWT} Token enriquecido do DB. ID: ${token.id}, isNewUser: ${token.isNewUserForOnboarding}, isInstaConn: ${token.isInstagramConnected}`);
                            if (token.isInstagramConnected) {
                                delete token.igConnectionError;
                            }
                        } else {
                            logger.warn(`${TAG_JWT} Utilizador ${token.id} não encontrado no DB. Invalidando token.`);
                            return {} as JWT;
                        }
                    } catch (error) {
                        logger.error(`${TAG_JWT} Erro ao buscar dados do DB para enriquecer token ${token.id}:`, error);
                    }
                }
            } else {
                if (trigger !== 'signIn' && trigger !== 'signUp') {
                    logger.warn(`${TAG_JWT} Token com ID inválido ('${token.id}') fora do login. Invalidando.`);
                    return {} as JWT;
                }
                logger.error(`${TAG_JWT} Token com ID inválido ('${token.id}') DURANTE ${trigger}.`);
                return {} as JWT;
            }

            if (token.image) delete (token as any).picture;
            logger.debug(`${TAG_JWT} FINAL jwt. Token id: '${token.id}', Provider: ${token.provider}, isNewUser: ${token.isNewUserForOnboarding}, isInstaConn: ${token.isInstagramConnected}, ErrIG: ${token.igConnectionError ? 'Sim' : 'Não'}`);
            return token;
        },

        async session({ session, token }) {
             const TAG_SESSION = '[NextAuth Session FBLinkNoNameImgUpdate+SyncStatus]';
             logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token isNewUser: ${token?.isNewUserForOnboarding}, Token isInstaConn: ${token?.isInstagramConnected}, Token ErrIG: ${token?.igConnectionError ? 'Sim' : 'Não'}`);

             if (!token?.id || !Types.ObjectId.isValid(token.id)) {
                 logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}'). Sessão vazia.`);
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
                 onboardingCompletedAt: token.onboardingCompletedAt ? new Date(token.onboardingCompletedAt) : null,
                 isInstagramConnected: token.isInstagramConnected,
                 availableIgAccounts: token.availableIgAccounts,
                 igConnectionError: token.igConnectionError,
                 planStatus: undefined,
                 planExpiresAt: undefined,
                 affiliateCode: undefined,
                 instagramAccountId: undefined,
                 instagramUsername: undefined,
                 // <<< ADICIONADO: Campos de status da sincronização na sessão >>>
                 lastInstagramSyncAttempt: token.lastInstagramSyncAttempt ? new Date(token.lastInstagramSyncAttempt).toISOString() : null,
                 lastInstagramSyncSuccess: token.lastInstagramSyncSuccess,
             };

             try {
                 await connectToDatabase();
                 const dbUser = await DbUser.findById(token.id)
                     // <<< ADICIONADO: Selecionar campos de sincronização do DB >>>
                     .select('planStatus planExpiresAt affiliateCode instagramAccountId username name email image role isInstagramConnected lastInstagramSyncAttempt lastInstagramSyncSuccess')
                     .lean();

                 if (dbUser && session.user) {
                     session.user.name = dbUser.name ?? session.user.name;
                     session.user.email = dbUser.email ?? session.user.email;
                     session.user.image = dbUser.image ?? session.user.image;
                     session.user.role = dbUser.role ?? session.user.role;
                     session.user.isInstagramConnected = typeof dbUser.isInstagramConnected === 'boolean' ? dbUser.isInstagramConnected : session.user.isInstagramConnected;
                     session.user.planStatus = dbUser.planStatus ?? 'inactive';
                     session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date ? dbUser.planExpiresAt.toISOString() : null;
                     session.user.affiliateCode = dbUser.affiliateCode ?? undefined;
                     session.user.instagramAccountId = dbUser.instagramAccountId ?? undefined;
                     session.user.instagramUsername = dbUser.username ?? undefined;
                     // <<< ADICIONADO: Popula dados de sincronização na sessão a partir do DB >>>
                     session.user.lastInstagramSyncAttempt = dbUser.lastInstagramSyncAttempt ? dbUser.lastInstagramSyncAttempt.toISOString() : null;
                     session.user.lastInstagramSyncSuccess = typeof dbUser.lastInstagramSyncSuccess === 'boolean' ? dbUser.lastInstagramSyncSuccess : null;

                     if (session.user.isInstagramConnected) {
                         delete session.user.igConnectionError;
                     }
                 } else if (!dbUser) {
                     logger.warn(`${TAG_SESSION} Utilizador ${token.id} não encontrado no DB para sessão.`);
                     if(session.user) session.user.igConnectionError = session.user.igConnectionError || "Falha ao carregar dados completos do usuário.";
                 }
             } catch (error) {
                  logger.error(`${TAG_SESSION} Erro ao buscar dados adicionais do DB para sessão ${token.id}:`, error);
                  if(session.user) session.user.igConnectionError = session.user.igConnectionError || "Erro ao carregar dados do usuário.";
             }
             logger.debug(`${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, isNewUser: ${session.user?.isNewUserForOnboarding}, isInstaConn: ${session.user?.isInstagramConnected}, ErrIG: ${session.user?.igConnectionError ? 'Sim' : 'Não'}`);
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
