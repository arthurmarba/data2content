// src/app/api/auth/[...nextauth]/route.ts
// MERGED VERSION: Combines vFinalMerged structure with vConnectAccount Facebook login/IG connection logic.
// - signIn: Allows Facebook login/signup directly (finds by FB ID or email, creates if new). Link token flow remains as priority if cookie exists.
// - signIn: Sets onboarding/community flags for new Facebook users.
// - jwt: Reintroduces fetchAvailableInstagramAccounts and connectInstagramAccount calls for Facebook provider after successful signIn.
// - jwt/session: Includes availableIgAccounts and igConnectionError fields.

import NextAuth from "next-auth";
import type { DefaultSession, DefaultUser, NextAuthOptions, Session, User as NextAuthUserArg, Account, Profile } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import type { CredentialInput } from "next-auth/providers/credentials"; // Importação correta

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // v1.9.3+ (com onboarding fields)
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import * as dataService from "@/app/lib/dataService"; // Usado para optInUserToCommunity
import { cookies } from 'next/headers';
import {
    fetchAvailableInstagramAccounts,
    connectInstagramAccount,
    AvailableInstagramAccount, // <<< IMPORTADO PARA OS TIPOS E LÓGICA JWT >>>
    clearInstagramConnection // Importado para limpar conexão em caso de erro de token
} from "@/app/lib/instagramService"; // v1.9.15+
import { UserNotFoundError, DatabaseError } from "@/app/lib/errors"; // Importar erros customizados se necessário

// --- AUGMENT NEXT-AUTH TYPES ---
// Adicionado availableIgAccounts e igConnectionError
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
        // Campos da conexão IG adicionados ao User na Session
        availableIgAccounts?: AvailableInstagramAccount[] | null;
        igConnectionError?: string | null;
    }
    interface Session extends DefaultSession {
        user?: User;
    }
}
declare module "next-auth/jwt" {
     interface JWT {
         id: string;
         sub?: string;
         name?: string | null;
         email?: string | null;
         image?: string | null; // Manter image (usado internamente e na session)
         picture?: string | null; // Manter picture (pode vir do provider)
         role?: string | null;
         provider?: string | null;
         isNewUserForOnboarding?: boolean;
         onboardingCompletedAt?: Date | null;
         isInstagramConnected?: boolean | null;
         // Campos da conexão IG adicionados ao JWT
         availableIgAccounts?: AvailableInstagramAccount[] | null;
         igConnectionError?: string | null;
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included";
const LINK_TOKEN_COOKIE_NAME = "d2c-link-token"; // Mantido para o fluxo de vinculação prioritário

// --- Funções customEncode e customDecode ---
// (Mantidas como na vFinalMerged)
async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);

    // Cria uma cópia limpa do token, removendo undefined e ajustando tipos
    const cleanToken: Record<string, any> = { ...token };
    Object.keys(cleanToken).forEach(key => {
        if (cleanToken[key] === undefined) delete cleanToken[key];
    });

    if (!cleanToken.id) cleanToken.id = ''; // Garante que id exista

    // Converte Date para string ISO se existir
    if (cleanToken.onboardingCompletedAt instanceof Date) {
        cleanToken.onboardingCompletedAt = cleanToken.onboardingCompletedAt.toISOString();
    }

    // Remove 'picture' se 'image' existir para evitar redundância (ou vice-versa, dependendo da preferência)
    if (cleanToken.image) delete cleanToken.picture;
    // Limpa campos potencialmente grandes ou complexos que não devem estar no JWT final
    delete cleanToken.availableIgAccounts; // Não codificar a lista de contas no JWT final

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

        // Garante que id seja string
        if (decodedPayload.id && typeof decodedPayload.id !== 'string') {
            decodedPayload.id = String(decodedPayload.id);
        } else if (!decodedPayload.id) {
            decodedPayload.id = '';
        }

        // Reconverte string ISO para Date se existir
        if (decodedPayload.onboardingCompletedAt && typeof decodedPayload.onboardingCompletedAt === 'string') {
            decodedPayload.onboardingCompletedAt = new Date(decodedPayload.onboardingCompletedAt);
        }

        // Garante que 'image' exista se 'picture' existir (ou vice-versa)
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
    cookies: { // Configuração de cookies da vFinalMerged
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
        GoogleProvider({ // Mantido da vFinalMerged
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { scope: "openid email profile" } },
            profile(profile: Profile & { sub?: string; picture?: string }) {
                logger.debug("[NextAuth Google Profile DEBUG] Profile recebido do Google:", JSON.stringify(profile));
                return {
                    id: profile.sub!, // Usa 'sub' como ID único do provider
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture // Mapeia 'picture' para 'image'
                };
            }
        }),
        FacebookProvider({ // Mantido da vFinalMerged (com profile ajustado)
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
                // Garante que o ID retornado aqui seja o ID do Facebook
                // O objeto 'user' passado para signIn terá user.id = profile.id
                return {
                    id: profile.id!, // Usa 'id' do Facebook como ID único do provider
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture?.data?.url // Mapeia 'picture.data.url' para 'image'
                };
            }
        }),
        CredentialsProvider({ // Mantido da vFinalMerged
            name: "Demo",
            credentials: {
                username: { label: "Utilizador", type: "text", placeholder: "demo" },
                password: { label: "Senha", type: "password", placeholder: "demo" }
            },
            async authorize(credentials, req) {
                if (credentials?.username === "demo" && credentials?.password === "demo") {
                    logger.debug("[NextAuth Credentials DEBUG] Authorize para Demo User bem-sucedido.");
                    // Retorna um objeto User compatível com a interface aumentada
                    return {
                        id: "demo-123",
                        name: "Demo User",
                        email: "demo@example.com",
                        image: null,
                        role: "user", // Adicionado role
                        isNewUserForOnboarding: false, // Adicionado
                        onboardingCompletedAt: new Date(), // Adicionado
                        isInstagramConnected: false // Adicionado
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
        // --- Callback signIn ---
        // Lógica MERGIDA: Prioriza linkToken (Facebook), depois busca/cria usuário (Google/Facebook)
        async signIn({ user: authUserFromProvider, account, profile }) {
            const TAG_SIGNIN = '[NextAuth signIn MERGED]';
            // authUserFromProvider.id aqui é o ID único DO PROVEDOR (Google sub, Facebook ID)
            logger.debug(`${TAG_SIGNIN} Iniciado`, { providerAccountIdReceived: authUserFromProvider.id, provider: account?.provider, email: authUserFromProvider.email });

            if (!account || !account.provider || !authUserFromProvider?.id) {
                 logger.error(`${TAG_SIGNIN} Dados essenciais ausentes (account, provider, user.id).`, { account, user: authUserFromProvider });
                 return false;
            }

            // --- Credentials Provider ---
            if (account.provider === 'credentials') {
                logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials (utilizador: ${authUserFromProvider.id}).`);
                // Garante que o objeto retornado por authorize tenha os campos necessários
                // O authorize já foi modificado para retornar os campos necessários.
                // Apenas garantimos que o ID interno seja o ID do provider neste caso.
                Object.assign(authUserFromProvider, { id: authUserFromProvider.id });
                return true;
            }

            // --- Google & Facebook Providers ---
            const provider = account.provider; // 'google' ou 'facebook'
            const providerAccountId = authUserFromProvider.id; // ID único no provedor (sub do Google, ID do Facebook)
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

                // --- Lógica Específica do Facebook (com Link Token e Fallback) ---
                if (provider === 'facebook') {
                    const cookieStore = cookies();
                    const linkTokenFromCookie = cookieStore.get(LINK_TOKEN_COOKIE_NAME)?.value;

                    // 1. Tenta Vincular via Link Token (Prioridade)
                    if (linkTokenFromCookie) {
                        logger.info(`${TAG_SIGNIN} [Facebook] Tentando vincular via linkToken: ${linkTokenFromCookie}`);
                        dbUserRecord = await DbUser.findOne({
                            linkToken: linkTokenFromCookie,
                            linkTokenExpiresAt: { $gt: new Date() }
                        });

                        if (dbUserRecord) {
                            logger.info(`${TAG_SIGNIN} [Facebook] Utilizador Data2Content ${dbUserRecord._id} encontrado por linkToken. Vinculando Facebook ID: ${providerAccountId}`);
                            dbUserRecord.facebookProviderAccountId = providerAccountId;
                            if (nameFromProvider && nameFromProvider !== dbUserRecord.name) dbUserRecord.name = nameFromProvider;
                            if (imageFromProvider && imageFromProvider !== dbUserRecord.image) dbUserRecord.image = imageFromProvider;
                            if (!dbUserRecord.email && currentEmailFromProvider) dbUserRecord.email = currentEmailFromProvider; // Preenche email se não existir
                            dbUserRecord.linkToken = undefined;
                            dbUserRecord.linkTokenExpiresAt = undefined;
                            await dbUserRecord.save();
                            cookieStore.delete(LINK_TOKEN_COOKIE_NAME); // Limpa cookie após sucesso
                            logger.info(`${TAG_SIGNIN} [Facebook] Vinculação por linkToken bem-sucedida para ${dbUserRecord._id}.`);
                        } else {
                            logger.warn(`${TAG_SIGNIN} [Facebook] linkToken (${linkTokenFromCookie}) inválido/expirado. Ignorando e continuando fluxo normal.`);
                            cookieStore.delete(LINK_TOKEN_COOKIE_NAME); // Limpa cookie inválido
                        }
                    }

                    // 2. Se não vinculou por token, tenta encontrar por Facebook ID (Login Normal)
                    if (!dbUserRecord) {
                        logger.debug(`${TAG_SIGNIN} [Facebook] Tentando encontrar usuário por facebookProviderAccountId: ${providerAccountId}`);
                        dbUserRecord = await DbUser.findOne({ facebookProviderAccountId: providerAccountId }).exec();
                        if (dbUserRecord) logger.info(`${TAG_SIGNIN} [Facebook] Usuário existente ${dbUserRecord._id} encontrado por facebookProviderAccountId.`);
                    }

                    // 3. Se ainda não encontrou, tenta encontrar por Email (Caso conta exista com outro provider)
                    if (!dbUserRecord && currentEmailFromProvider) {
                        logger.debug(`${TAG_SIGNIN} [Facebook] Tentando encontrar usuário por email: ${currentEmailFromProvider}`);
                        const userByEmail = await DbUser.findOne({ email: currentEmailFromProvider }).exec();
                        if (userByEmail) {
                            logger.info(`${TAG_SIGNIN} [Facebook] Usuário existente ${userByEmail._id} encontrado por email. Vinculando Facebook ID ${providerAccountId}.`);
                            dbUserRecord = userByEmail;
                            dbUserRecord.facebookProviderAccountId = providerAccountId; // Adiciona o ID do Facebook
                            if (nameFromProvider && nameFromProvider !== dbUserRecord.name) dbUserRecord.name = nameFromProvider;
                            if (imageFromProvider && imageFromProvider !== dbUserRecord.image) dbUserRecord.image = imageFromProvider;
                            // Não sobrescreve 'provider' se já existir um (ex: 'google')
                            if (!dbUserRecord.provider) dbUserRecord.provider = provider;
                            await dbUserRecord.save();
                        }
                    }

                    // 4. Se NADA foi encontrado, CRIA um novo usuário para Facebook
                    if (!dbUserRecord) {
                        if (!currentEmailFromProvider) {
                            logger.error(`${TAG_SIGNIN} [Facebook] Email ausente do provedor Facebook. Não é possível criar novo usuário.`);
                            // Poderia retornar um erro específico ou redirecionar para pedir email, mas por ora falha o login.
                            return false; // Ou redirecionar para uma página de erro/coleta de email
                        }
                        logger.info(`${TAG_SIGNIN} [Facebook] Criando NOVO utilizador Data2Content para ${currentEmailFromProvider} via Facebook...`);
                        const newUserInDb = new DbUser({
                            name: nameFromProvider,
                            email: currentEmailFromProvider,
                            image: imageFromProvider,
                            provider: provider, // Define provider como 'facebook'
                            facebookProviderAccountId: providerAccountId, // Salva o ID do Facebook
                            role: 'user',
                            isNewUserForOnboarding: true, // <<< NOVO USUÁRIO FACEBOOK >>>
                            onboardingCompletedAt: null, // <<< NOVO USUÁRIO FACEBOOK >>>
                            communityInspirationOptIn: true, // <<< NOVO USUÁRIO FACEBOOK >>>
                            communityInspirationOptInDate: new Date(), // <<< NOVO USUÁRIO FACEBOOK >>>
                            communityInspirationTermsVersion: DEFAULT_TERMS_VERSION, // <<< NOVO USUÁRIO FACEBOOK >>>
                            isInstagramConnected: false, // <<< NOVO USUÁRIO FACEBOOK >>>
                            planStatus: 'inactive', // Default
                        });
                        dbUserRecord = await newUserInDb.save();
                        isNewUser = true;
                        logger.info(`${TAG_SIGNIN} [Facebook] Novo utilizador Data2Content CRIADO com _id: '${dbUserRecord._id}'.`);
                    }
                }
                // --- Lógica Específica do Google (Mantida da vFinalMerged) ---
                else if (provider === 'google') {
                    logger.debug(`${TAG_SIGNIN} [Google] Tentando encontrar usuário por providerAccountId: ${providerAccountId}`);
                    dbUserRecord = await DbUser.findOne({ provider: provider, providerAccountId: providerAccountId }).exec();

                    if (!dbUserRecord && currentEmailFromProvider) {
                        logger.debug(`${TAG_SIGNIN} [Google] Tentando encontrar usuário por email: ${currentEmailFromProvider}`);
                        const userByEmail = await DbUser.findOne({ email: currentEmailFromProvider }).exec();
                        if (userByEmail) {
                            logger.info(`${TAG_SIGNIN} [Google] Utilizador Data2Content existente ${userByEmail._id} encontrado por email. Vinculando Google ID ${providerAccountId}.`);
                            dbUserRecord = userByEmail;
                            dbUserRecord.provider = provider; // Define/Atualiza provider para 'google'
                            dbUserRecord.providerAccountId = providerAccountId; // Adiciona o ID do Google
                            if (nameFromProvider && nameFromProvider !== dbUserRecord.name) dbUserRecord.name = nameFromProvider;
                            if (imageFromProvider && imageFromProvider !== dbUserRecord.image) dbUserRecord.image = imageFromProvider;
                             // Não sobrescreve facebookProviderAccountId se existir
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
                            providerAccountId: providerAccountId, // Salva o ID do Google
                            role: 'user',
                            isNewUserForOnboarding: true, // <<< NOVO USUÁRIO GOOGLE >>>
                            onboardingCompletedAt: null, // <<< NOVO USUÁRIO GOOGLE >>>
                            communityInspirationOptIn: true, // <<< NOVO USUÁRIO GOOGLE >>>
                            communityInspirationOptInDate: new Date(), // <<< NOVO USUÁRIO GOOGLE >>>
                            communityInspirationTermsVersion: DEFAULT_TERMS_VERSION, // <<< NOVO USUÁRIO GOOGLE >>>
                            isInstagramConnected: false, // <<< NOVO USUÁRIO GOOGLE >>>
                            planStatus: 'inactive', // Default
                        });
                        dbUserRecord = await newUserInDb.save();
                        isNewUser = true;
                        logger.info(`${TAG_SIGNIN} [Google] Novo utilizador Data2Content CRIADO com _id: '${dbUserRecord._id}'.`);
                    }
                }

                // --- Finalização e Preparação do Objeto User para JWT ---
                if (dbUserRecord) {
                    // Atualiza o objeto `authUserFromProvider` que será passado para o callback `jwt`.
                    // É crucial que `authUserFromProvider.id` seja o ID INTERNO do nosso DB (_id).
                    Object.assign(authUserFromProvider, {
                        id: dbUserRecord._id.toString(), // <<< ID INTERNO DO DB >>>
                        name: dbUserRecord.name ?? nameFromProvider, // Usa nome do DB ou do provider
                        email: dbUserRecord.email ?? currentEmailFromProvider, // Usa email do DB ou do provider
                        image: dbUserRecord.image ?? imageFromProvider, // Usa imagem do DB ou do provider
                        role: dbUserRecord.role ?? 'user',
                        isNewUserForOnboarding: isNewUser || dbUserRecord.isNewUserForOnboarding, // True se acabou de criar ou se já estava no DB
                        onboardingCompletedAt: dbUserRecord.onboardingCompletedAt,
                        isInstagramConnected: dbUserRecord.isInstagramConnected ?? false,
                        provider: dbUserRecord.provider ?? provider, // Provider principal registrado no DB
                    });
                    logger.debug(`${TAG_SIGNIN} [${provider}] FINAL signIn. authUser.id (interno): '${authUserFromProvider.id}', isNewUser: ${authUserFromProvider.isNewUserForOnboarding}, isInstaConn: ${authUserFromProvider.isInstagramConnected}`);
                    return true; // Permite o login
                } else {
                    // Este caso não deveria ocorrer com a lógica acima, mas por segurança:
                    logger.error(`${TAG_SIGNIN} [${provider}] Não foi possível encontrar, vincular ou criar utilizador Data2Content. Falha no signIn.`);
                    return false; // Bloqueia o login
                }

            } catch (error) {
                 logger.error(`${TAG_SIGNIN} Erro no DB durante signIn para ${provider} (ProviderAccID: ${providerAccountId}):`, error);
                 // Poderia verificar se é um UserNotFoundError e retornar uma mensagem específica
                 return false; // Bloqueia o login em caso de erro
            }
        }, // Fim do callback signIn

        // --- Callback jwt ---
        // Lógica MERGIDA: Popula token inicial, busca/conecta IG para Facebook, enriquece com DB
        async jwt({ token, user: userFromSignIn, account, trigger, session }) {
            const TAG_JWT = '[NextAuth JWT MERGED]';
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Provider(acc): ${account?.provider}. UserID(signIn): ${userFromSignIn?.id}. TokenInID: ${token?.id}`);

            // Limpa erros de conexão IG anteriores ao reprocessar o token
            delete token.igConnectionError;
            delete token.availableIgAccounts;

            // --- População Inicial do Token (signIn ou signUp) ---
            if ((trigger === 'signIn' || trigger === 'signUp') && userFromSignIn && account) {
                // userFromSignIn aqui já contém o ID INTERNO do nosso DB (_id) devido à modificação no signIn
                token.id = userFromSignIn.id;
                token.sub = userFromSignIn.id; // sub geralmente é o ID do usuário
                token.name = userFromSignIn.name;
                token.email = userFromSignIn.email;
                token.image = userFromSignIn.image;
                token.role = (userFromSignIn as any).role ?? 'user'; // Usa a role passada pelo signIn
                token.provider = account.provider; // Provider que acabou de logar
                token.isNewUserForOnboarding = (userFromSignIn as any).isNewUserForOnboarding;
                token.onboardingCompletedAt = (userFromSignIn as any).onboardingCompletedAt;
                token.isInstagramConnected = (userFromSignIn as any).isInstagramConnected;

                logger.info(`${TAG_JWT} Token populado de userFromSignIn. ID: ${token.id}, Provider: ${token.provider}, isNewUser: ${token.isNewUserForOnboarding}, isInstaConn: ${token.isInstagramConnected}`);

                // --- Lógica de Conexão Instagram para Facebook (Reintroduzida da vConnectAccount) ---
                if (account.provider === 'facebook') {
                    const userId = token.id; // ID interno do DB
                    const shortLivedAccessToken = account.access_token;

                    if (userId && shortLivedAccessToken && Types.ObjectId.isValid(userId)) {
                        logger.info(`${TAG_JWT} [Facebook] Iniciando busca de contas IG e LLAT para User ${userId}...`);
                        try {
                            const result = await fetchAvailableInstagramAccounts(shortLivedAccessToken, userId);

                            if (result.success) {
                                logger.info(`${TAG_JWT} [Facebook] fetchAvailableInstagramAccounts OK. Contas: ${result.accounts?.length ?? 0}. LLAT Obtido: ${!!result.longLivedAccessToken}`);
                                token.availableIgAccounts = result.accounts; // Guarda contas disponíveis no token (temporariamente)
                                const userLongLivedAccessToken = result.longLivedAccessToken;

                                if (result.accounts && result.accounts.length > 0 && userLongLivedAccessToken) {
                                    const firstAccount = result.accounts[0];
                                    if (firstAccount && firstAccount.igAccountId) {
                                        logger.info(`${TAG_JWT} [Facebook] Tentando conectar automaticamente a primeira conta IG: ${firstAccount.igAccountId} para User ${userId}`);

                                        // Chama connectInstagramAccount de forma assíncrona (não bloqueia o retorno do JWT)
                                        connectInstagramAccount(userId, firstAccount.igAccountId, userLongLivedAccessToken)
                                            .then(connectResult => {
                                                if (!connectResult.success) {
                                                    logger.error(`${TAG_JWT} [Facebook] Falha ao chamar connectInstagramAccount (async) para ${userId}: ${connectResult.error}`);
                                                    // Poderia tentar atualizar o token com erro aqui, mas é complexo fora do fluxo normal
                                                } else {
                                                    logger.info(`${TAG_JWT} [Facebook] connectInstagramAccount chamado com sucesso (async) para ${userId}. DB será atualizado e QStash notificado.`);
                                                    // A flag isInstagramConnected será atualizada na próxima leitura do DB no jwt/session
                                                }
                                            })
                                            .catch(err => {
                                                logger.error(`${TAG_JWT} [Facebook] Erro não capturado ao chamar connectInstagramAccount (async) para ${userId}:`, err);
                                            });
                                        // Poderia definir token.isInstagramConnected = true aqui optimisticamente,
                                        // mas é mais seguro depender da leitura do DB.
                                    } else {
                                        logger.warn(`${TAG_JWT} [Facebook] Lista de contas IG retornada, mas o primeiro elemento é inválido.`);
                                        token.igConnectionError = "Erro ao processar lista de contas Instagram.";
                                    }
                                } else if (!userLongLivedAccessToken && result.accounts && result.accounts.length > 0) {
                                    logger.warn(`${TAG_JWT} [Facebook] Contas IG encontradas, mas LLAT ausente. Não é possível conectar automaticamente User ${userId}.`);
                                    token.igConnectionError = "Token de acesso de longa duração do Instagram não obtido.";
                                } else {
                                    logger.warn(`${TAG_JWT} [Facebook] Nenhuma conta IG encontrada ou LLAT ausente para User ${userId}.`);
                                    token.igConnectionError = "Nenhuma conta Instagram encontrada para vincular ou token LLAT ausente.";
                                }
                            } else { // fetchAvailableInstagramAccounts falhou
                                logger.error(`${TAG_JWT} [Facebook] fetchAvailableInstagramAccounts falhou para User ${userId}: ${result.error}`);
                                token.igConnectionError = result.error || "Falha ao buscar contas do Instagram.";
                                // Se o erro for de token, invalida a conexão antiga no DB
                                if (result.error?.toLowerCase().includes('token')) {
                                    logger.warn(`${TAG_JWT} [Facebook] Erro de token detectado em fetchAvailableInstagramAccounts. Limpando conexão antiga para User ${userId}.`);
                                    await clearInstagramConnection(userId).catch(clearErr => logger.error(`${TAG_JWT} Erro ao limpar conexão após falha de token:`, clearErr));
                                    token.isInstagramConnected = false; // Atualiza token imediatamente
                                }
                            }
                        } catch (error) {
                            logger.error(`${TAG_JWT} [Facebook] Exceção durante busca/conexão IG para User ${userId}:`, error);
                            token.igConnectionError = error instanceof Error ? error.message : "Erro inesperado no processo de conexão IG.";
                            if (token.igConnectionError.toLowerCase().includes('token')) {
                                await clearInstagramConnection(userId).catch(clearErr => logger.error(`${TAG_JWT} Erro ao limpar conexão após exceção de token:`, clearErr));
                                token.isInstagramConnected = false;
                            }
                        }
                    } else {
                        if (!userId || !Types.ObjectId.isValid(userId)) logger.error(`${TAG_JWT} [Facebook] ID de usuário inválido ('${userId}') no token durante signIn/signUp.`);
                        if (!shortLivedAccessToken) logger.error(`${TAG_JWT} [Facebook] Access token (SLT) ausente no callback jwt para User ${userId}.`);
                        token.igConnectionError = "Dados necessários para conexão IG ausentes.";
                    }
                } // Fim do if (account.provider === 'facebook')
            } // Fim do if (trigger === 'signIn' || trigger === 'signUp')

            // --- Enriquecimento/Atualização do Token com Dados do DB ---
            // (Lógica mantida da vFinalMerged, mas verificando se token.id é válido primeiro)
            if (token.id && Types.ObjectId.isValid(token.id)) {
                // Atualiza se for trigger 'update' OU se campos essenciais estiverem faltando no token
                // Ou se acabou de conectar via Facebook (para pegar o status isInstagramConnected atualizado se connectInstagramAccount já rodou)
                const needsDbUpdate = trigger === 'update' ||
                                      !token.role ||
                                      typeof token.isNewUserForOnboarding === 'undefined' ||
                                      typeof token.isInstagramConnected === 'undefined' ||
                                      account?.provider === 'facebook'; // Sempre busca no DB após login FB para garantir status IG

                if (needsDbUpdate) {
                    logger.debug(`${TAG_JWT} Trigger '${trigger}' ou dados ausentes/login FB. Buscando dados frescos do DB para token ID: ${token.id}`);
                    try {
                        await connectToDatabase();
                        // Seleciona os campos que queremos garantir que estejam no token
                        const dbUser = await DbUser.findById(token.id)
                            .select('name email image role provider isNewUserForOnboarding onboardingCompletedAt isInstagramConnected facebookProviderAccountId providerAccountId')
                            .lean();

                        if (dbUser) {
                            // Atualiza token com dados do DB, priorizando DB sobre token antigo se houver conflito
                            token.name = dbUser.name ?? token.name;
                            token.email = dbUser.email ?? token.email;
                            token.image = dbUser.image ?? token.image;
                            token.role = dbUser.role ?? token.role ?? 'user';
                            // Determina o provider principal (pode ter múltiplos IDs)
                            token.provider = dbUser.provider ?? (dbUser.facebookProviderAccountId ? 'facebook' : token.provider);
                            token.isNewUserForOnboarding = typeof dbUser.isNewUserForOnboarding === 'boolean' ? dbUser.isNewUserForOnboarding : token.isNewUserForOnboarding ?? false;
                            token.onboardingCompletedAt = dbUser.onboardingCompletedAt ?? token.onboardingCompletedAt ?? null;
                            token.isInstagramConnected = typeof dbUser.isInstagramConnected === 'boolean' ? dbUser.isInstagramConnected : token.isInstagramConnected ?? false;

                            logger.info(`${TAG_JWT} Token enriquecido do DB. ID: ${token.id}, isNewUser: ${token.isNewUserForOnboarding}, isInstaConn: ${token.isInstagramConnected}`);

                            // Se a conexão está OK no DB, remove o erro do token (se houver)
                            if (token.isInstagramConnected) {
                                delete token.igConnectionError;
                            }
                        } else {
                            logger.warn(`${TAG_JWT} Utilizador ${token.id} não encontrado no DB durante atualização do token. Invalidando token.`);
                            return {} as JWT; // Retorna token vazio para invalidar
                        }
                    } catch (error) {
                        logger.error(`${TAG_JWT} Erro ao buscar dados do DB para enriquecer token ${token.id}:`, error);
                        // Não invalida o token por erro de DB, mas loga
                    }
                }
            } else {
                // Se o ID do token for inválido FORA do fluxo de signIn/signUp, invalida
                if (trigger !== 'signIn' && trigger !== 'signUp') {
                    logger.warn(`${TAG_JWT} Token com ID inválido ('${token.id}') fora do login. Invalidando.`);
                    return {} as JWT;
                }
                // Se for inválido DURANTE signIn/signUp, algo deu errado no signIn
                logger.error(`${TAG_JWT} Token com ID inválido ('${token.id}') DURANTE ${trigger}. signIn pode ter falhado em definir o ID interno.`);
                return {} as JWT; // Invalida
            }

            // Ajuste final antes de retornar (serialização de data já feita no encode)
            if (token.image) delete (token as any).picture;

            logger.debug(`${TAG_JWT} FINAL jwt. Token id: '${token.id}', Provider: ${token.provider}, isNewUser: ${token.isNewUserForOnboarding}, isInstaConn: ${token.isInstagramConnected}, ErrIG: ${token.igConnectionError ? 'Sim' : 'Não'}`);
            return token;
        }, // Fim do callback jwt

        // --- Callback session ---
        // Lógica MERGIDA: Passa dados do token (incluindo IG status/erro) e enriquece com DB
        async session({ session, token }) {
             const TAG_SESSION = '[NextAuth Session MERGED]';
             logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token isNewUser: ${token?.isNewUserForOnboarding}, Token isInstaConn: ${token?.isInstagramConnected}, Token ErrIG: ${token?.igConnectionError ? 'Sim' : 'Não'}`);

             // Validação do ID do token
             if (!token?.id || !Types.ObjectId.isValid(token.id)) {
                 logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}'). Sessão vazia.`);
                 session.user = undefined;
                 return session;
             }

             // Popula session.user com dados básicos e de conexão IG do token
             session.user = {
                 id: token.id,
                 name: token.name,
                 email: token.email,
                 image: token.image, // Usa 'image' que foi garantido no jwt
                 role: token.role,
                 provider: token.provider,
                 isNewUserForOnboarding: token.isNewUserForOnboarding,
                 onboardingCompletedAt: token.onboardingCompletedAt ? new Date(token.onboardingCompletedAt) : null, // Reconverte para Date se necessário
                 isInstagramConnected: token.isInstagramConnected,
                 // Campos de conexão IG passados do token
                 availableIgAccounts: token.availableIgAccounts,
                 igConnectionError: token.igConnectionError,
                 // Campos a serem buscados no DB
                 planStatus: undefined,
                 planExpiresAt: undefined,
                 affiliateCode: undefined,
                 instagramAccountId: undefined,
                 instagramUsername: undefined,
             };

             // Busca dados adicionais do DB (plano, afiliado, detalhes IG)
             try {
                 await connectToDatabase();
                 // Seleciona campos que NÃO estão (ou não deveriam estar) no token JWT
                 const dbUser = await DbUser.findById(token.id)
                     .select('planStatus planExpiresAt affiliateCode instagramAccountId username name email image role isInstagramConnected') // Inclui campos base para garantir consistência
                     .lean();

                 if (dbUser && session.user) {
                     // Atualiza a sessão com dados frescos do DB, priorizando o DB
                     session.user.name = dbUser.name ?? session.user.name;
                     session.user.email = dbUser.email ?? session.user.email;
                     session.user.image = dbUser.image ?? session.user.image;
                     session.user.role = dbUser.role ?? session.user.role;
                     session.user.isInstagramConnected = typeof dbUser.isInstagramConnected === 'boolean' ? dbUser.isInstagramConnected : session.user.isInstagramConnected; // Atualiza status IG do DB

                     session.user.planStatus = dbUser.planStatus ?? 'inactive';
                     session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date ? dbUser.planExpiresAt.toISOString() : null;
                     session.user.affiliateCode = dbUser.affiliateCode ?? undefined;
                     session.user.instagramAccountId = dbUser.instagramAccountId ?? undefined;
                     session.user.instagramUsername = dbUser.username ?? undefined; // Assumindo que 'username' no DB é o do Instagram

                     // Se a conexão está OK no DB, limpa o erro da sessão (pode ter vindo do token)
                     if (session.user.isInstagramConnected) {
                         delete session.user.igConnectionError;
                         // Opcional: Limpar availableIgAccounts após conexão bem sucedida
                         // delete session.user.availableIgAccounts;
                     }

                 } else if (!dbUser) {
                     logger.warn(`${TAG_SESSION} Utilizador ${token.id} não encontrado no DB ao buscar dados para sessão. Sessão pode estar incompleta.`);
                     // Mantém os dados do token, mas pode indicar erro
                     if(session.user) session.user.igConnectionError = session.user.igConnectionError || "Falha ao carregar dados completos do usuário.";
                 }
             } catch (error) {
                  logger.error(`${TAG_SESSION} Erro ao buscar dados adicionais do DB para sessão ${token.id}:`, error);
                  if(session.user) session.user.igConnectionError = session.user.igConnectionError || "Erro ao carregar dados do usuário.";
             }

             logger.debug(`${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, isNewUser: ${session.user?.isNewUserForOnboarding}, isInstaConn: ${session.user?.isInstagramConnected}, ErrIG: ${session.user?.igConnectionError ? 'Sim' : 'Não'}`);
             return session;
         }, // Fim do callback session

        // --- Callback redirect ---
        // (Mantido da vFinalMerged)
        async redirect({ url, baseUrl }) {
          const requestedUrl = new URL(url, baseUrl);
          const base = new URL(baseUrl);
          // Permite redirecionamentos para a mesma origem
          if (requestedUrl.origin === base.origin) {
            logger.debug(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é interna. Permitindo.`);
            return requestedUrl.toString();
          }
          // Bloqueia redirecionamentos externos, redirecionando para a baseUrl
          logger.warn(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é externa ou inválida. Redirecionando para baseUrl: ${baseUrl}.`);
          return baseUrl;
        }
    }, // Fim dos callbacks
    pages: {
        signIn: '/login', // Mantido
        error: '/auth/error' // Mantido
    },
    session: {
        strategy: 'jwt', // Mantido
        maxAge: 30 * 24 * 60 * 60 // 30 days (Mantido)
    }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

