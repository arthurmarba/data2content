// src/app/api/auth/[...nextauth]/route.ts (vConnectAccount - COM LOGS DETALHADOS)
// - Modifica callback JWT para chamar connectInstagramAccount após fetch bem-sucedido.
// - Importa connectInstagramAccount de instagramService.
// - Remove uso de storeTemporaryLlat, cookie ig-connect-status e flag pendingInstagramConnection.
// - ADICIONADOS LOGS DETALHADOS PARA DEBUG DE ID DE USUÁRIO (08/05/2025)

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
    connectInstagramAccount,
    AvailableInstagramAccount,
} from "@/app/lib/instagramService";

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
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

// --- Funções customEncode e customDecode ---
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
                username: { label: "Usuário", type: "text", placeholder: "demo" },
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
            const TAG_SIGNIN = '[NextAuth signIn Callback]';
            logger.debug(`${TAG_SIGNIN} Iniciado`, { userIdRaw: user.id, provider: account?.provider, userObj: JSON.stringify(user) });

            if (account?.provider === 'credentials') {
                logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials (usuário: ${user.id}).`);
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

                if (account.provider === 'google') {
                    logger.debug(`${TAG_SIGNIN} [Google Flow DEBUG] Tentando encontrar usuário existente. ProviderAccountId: ${account.providerAccountId}, Email: ${currentEmail}`);
                    existing = await DbUser.findOne({ providerAccountId: account.providerAccountId, provider: 'google' }).exec();
                    if (!existing && currentEmail) {
                        logger.debug(`${TAG_SIGNIN} [Google Flow DEBUG] Não encontrado por providerAccountId, tentando por email: ${currentEmail}`);
                        existing = await DbUser.findOne({ email: currentEmail }).exec();
                    }

                    if (existing) {
                        logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Usuário existente ENCONTRADO: _id='${existing._id}'. ProviderAccountId do DB: ${existing.providerAccountId}`);
                        user.id = existing._id.toString();
                        logger.debug(`${TAG_SIGNIN} [Google Flow DEBUG] user.id ATRIBUÍDO (existente): '${user.id}'`);

                        let needsSave = false;
                        if (user.name && user.name !== existing.name) { existing.name = user.name; needsSave = true; }
                        if (existing.providerAccountId !== account.providerAccountId) { existing.providerAccountId = account.providerAccountId; needsSave = true;}
                        if (!existing.provider) { existing.provider = 'google'; needsSave = true; }
                        const providerImage = user.image;
                        if (providerImage && providerImage !== existing.image) { existing.image = providerImage; needsSave = true; }

                        if (needsSave) {
                            await existing.save();
                            logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Usuário existente ${existing._id} atualizado.`);
                        }
                        logger.debug(`${TAG_SIGNIN} [Google Flow DEBUG] FINAL para usuário existente: user.id='${user.id}', user.name='${user.name}', user.email='${user.email}'`);
                        return true;
                    }

                    if (!currentEmail) {
                         logger.error(`${TAG_SIGNIN} [Google Flow DEBUG] Email ausente ao tentar CRIAR usuário Google.`);
                         return false;
                    }
                    logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Criando NOVO usuário Google para ${currentEmail}...`);
                    const newUser = new DbUser({
                        name: user.name, email: currentEmail, image: user.image,
                        provider: 'google', providerAccountId: account.providerAccountId,
                        role: 'user', isInstagramConnected: false
                    });
                    const saved = await newUser.save();
                    user.id = saved._id.toString();
                    logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Novo usuário Google CRIADO com _id: '${saved._id}'. user.id ATRIBUÍDO: '${user.id}'`);
                    logger.debug(`${TAG_SIGNIN} [Google Flow DEBUG] FINAL para novo usuário: user.id='${user.id}', user.name='${user.name}', user.email='${user.email}'`);
                    return true;

                } else if (account.provider === 'facebook') {
                    // A lógica do Facebook signIn é mais complexa e focada na vinculação.
                    // Se o objetivo principal não for criar uma sessão FB, mas sim vincular,
                    // a checagem de 'existing' pode ser diferente.
                    existing = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).exec();
                     if (existing) {
                        logger.info(`${TAG_SIGNIN} Usuário existente encontrado (Facebook): ${existing._id}. Atualizando user.id para _id do DB.`);
                        user.id = existing._id.toString(); // Garante que o user.id seja o _id do MongoDB
                        // Atualiza dados se necessário
                        let needsSave = false;
                        if (user.name && user.name !== existing.name) { existing.name = user.name; needsSave = true;}
                        const providerImage = user.image;
                        if (providerImage && providerImage !== existing.image) { existing.image = providerImage; needsSave = true; }
                        if (needsSave) { await existing.save(); logger.info(`${TAG_SIGNIN} Usuário Facebook existente ${existing._id} atualizado.`);}
                        return true;
                    }
                    logger.warn(`${TAG_SIGNIN} Usuário não encontrado para Facebook no signIn (ou sem email para vincular via email). Permitindo fluxo para JWT (vinculação ou falha lá). user.id atual: ${user.id}`);
                    return true; // Permite que o callback JWT trate a criação/vinculação
                }

                logger.error(`${TAG_SIGNIN} Provedor ${account.provider} não resultou em criação ou login (final do try).`);
                return false;

            } catch (error) {
                 logger.error(`${TAG_SIGNIN} Erro no DB durante signIn (${account?.provider}):`, error);
                 return false;
            }
        },

        async jwt({ token, user, account, trigger }) {
            const TAG_JWT = '[NextAuth JWT Callback]';
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Provider: ${account?.provider}. UserID (do param): ${user?.id}. TokenInID (do param): ${token?.id}`);

            let currentToken: Partial<JWT> = {
                id: token?.id, name: token?.name, email: token?.email, image: token?.image,
                role: token?.role, provider: token?.provider, sub: token?.sub
            };
            delete currentToken.igConnectionError;
            delete currentToken.availableIgAccounts;

            const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';

            if (isSignInOrSignUp && account && user) { // Adicionado 'user' aqui para garantir que existe neste fluxo
                if (account.provider === 'facebook') {
                    logger.debug(`${TAG_JWT} [Facebook Flow DEBUG] Processando login/vinculação Facebook...`);
                    let userId = ''; // Este será o _id do MongoDB

                    try {
                        const authLink = cookies().get('auth-link-token')?.value;
                        if (authLink) {
                            logger.info(`${TAG_JWT} [Facebook Flow DEBUG] Cookie 'auth-link-token' encontrado: ${authLink}`);
                            cookies().delete('auth-link-token');
                            await connectToDatabase();
                            const linkDoc = await DbUser.findOne({ linkToken: authLink, linkTokenExpiresAt: { $gt: new Date() } }).lean();
                            if (linkDoc) {
                                userId = linkDoc._id.toString();
                                logger.info(`${TAG_JWT} [Facebook Flow DEBUG] Usuário ${userId} (MongoDB _id) identificado via linkToken.`);
                                await DbUser.updateOne({ _id: linkDoc._id }, { $unset: { linkToken: '', linkTokenExpiresAt: '' } });
                            } else {
                                logger.warn(`${TAG_JWT} [Facebook Flow DEBUG] Link token do cookie inválido ou expirado.`);
                            }
                        } else {
                             logger.debug(`${TAG_JWT} [Facebook Flow DEBUG] Cookie 'auth-link-token' não encontrado.`);
                        }
                    } catch (e) { logger.error(`${TAG_JWT} [Facebook Flow DEBUG] Erro ao processar link token:`, e); }

                    // Se não encontrou pelo linkToken, tenta pelo providerAccountId do Facebook
                    if (!userId && account.providerAccountId) {
                        logger.debug(`${TAG_JWT} [Facebook Flow DEBUG] Tentando encontrar usuário pelo facebookProviderAccountId: ${account.providerAccountId}`);
                        await connectToDatabase();
                        const doc = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).lean().exec();
                        if (doc) {
                            userId = doc._id.toString(); // Este é o _id do MongoDB
                            logger.info(`${TAG_JWT} [Facebook Flow DEBUG] Usuário ${userId} (MongoDB _id) identificado via facebookProviderAccountId.`);
                        } else {
                             logger.warn(`${TAG_JWT} [Facebook Flow DEBUG] Nenhum usuário encontrado para facebookProviderAccountId ${account.providerAccountId}.`);
                             // Neste ponto, para Facebook, o objetivo é vincular, não criar um novo usuário se não houver contexto (linkToken ou sessão existente)
                             // O user.id aqui é o ID numérico do Facebook, vindo do profile callback
                             logger.debug(`${TAG_JWT} [Facebook Flow DEBUG] user.id (do Facebook profile): '${user.id}'. Email do user: '${user.email}'`);
                             if (user.email) { // Tenta vincular ou encontrar por email se não achou pelo providerAccountId
                                logger.info(`${TAG_JWT} [Facebook Flow DEBUG] Tentando encontrar DbUser por email ('${user.email}') para possível vinculação/criação FB.`);
                                await connectToDatabase();
                                let userByEmail = await DbUser.findOne({ email: user.email });
                                if (userByEmail) {
                                    logger.info(`${TAG_JWT} [Facebook Flow DEBUG] DbUser '${userByEmail._id}' encontrado por email. Vinculando facebookProviderAccountId.`);
                                    userId = userByEmail._id.toString();
                                    if (!userByEmail.facebookProviderAccountId) {
                                        userByEmail.facebookProviderAccountId = account.providerAccountId;
                                        if (user.name && userByEmail.name !== user.name) userByEmail.name = user.name;
                                        if (user.image && userByEmail.image !== user.image) userByEmail.image = user.image;
                                        await userByEmail.save();
                                    }
                                } else {
                                    // Se o objetivo NÃO é criar usuário via FB, esta parte deve ser removida ou ajustada
                                    logger.error(`${TAG_JWT} [Facebook Flow DEBUG] Nenhum usuário existente encontrado por email para vincular conta Facebook. Nova criação de usuário via FB não implementada/desabilitada aqui.`);
                                    // userId permanece ''
                                }
                             } else {
                                 logger.error(`${TAG_JWT} [Facebook Flow DEBUG] Email ausente do perfil do Facebook, não é possível vincular/criar usuário por email.`);
                                 // userId permanece ''
                             }
                        }
                    }
                    // Se userId ainda for vazio aqui, a vinculação falhou ou não foi possível identificar o usuário do DB
                    if (!userId) {
                        logger.error(`${TAG_JWT} [Facebook Flow DEBUG] Não foi possível determinar o MongoDB _id para o fluxo do Facebook. O token não terá um ID válido.`);
                        // Define um erro no token para a sessão, mas não limpa o id para não interferir com a sessão Google se houver uma
                        // currentToken.id = ''; // NÃO FAÇA ISSO AQUI se o objetivo é só vincular
                        currentToken.igConnectionError = "Falha ao vincular conta Facebook: usuário do sistema não identificado.";
                    } else {
                        // userId é um MongoDB _id. Prosseguir com a lógica do Instagram usando este userId.
                        // O id do token principal (se já existir de uma sessão Google) não deve ser sobrescrito.
                        // Se currentToken.id já é um ObjectId válido (da sessão Google), mantenha-o.
                        // Se não há currentToken.id (fluxo de link puro sem sessão NextAuth ainda), então defina-o com o userId (MongoDB _id).
                        if (!currentToken.id || !Types.ObjectId.isValid(currentToken.id)) {
                            logger.info(`${TAG_JWT} [Facebook Flow DEBUG] Definindo currentToken.id para o userId do Facebook Flow (MongoDB _id): '${userId}'`);
                            currentToken.id = userId;
                        } else {
                            logger.info(`${TAG_JWT} [Facebook Flow DEBUG] Mantendo currentToken.id existente ('${currentToken.id}') da sessão Google durante o fluxo do Facebook.`);
                            // Garante que o userId para operações do IG seja o correto
                            // userId = currentToken.id; // Desnecessário se já estiver usando o userId correto
                        }

                        if (account.access_token) {
                            logger.info(`${TAG_JWT} [Facebook Flow DEBUG] Chamando fetchAvailableInstagramAccounts para User (MongoDB _id) ${userId}...`);
                            try {
                                const result = await fetchAvailableInstagramAccounts(account.access_token, userId); // userId AQUI DEVE SER O MONGODB _ID
                                if (result.success) {
                                    // ... (lógica de connectInstagramAccount mantida, usando 'userId' que é o MongoDB _id)
                                    if (result.accounts && result.accounts.length > 0) {
                                        const firstAccount = result.accounts[0];
                                        if (firstAccount && firstAccount.igAccountId && result.longLivedAccessToken) {
                                            connectInstagramAccount(userId, firstAccount.igAccountId, result.longLivedAccessToken)
                                                .then(/* ... */).catch(/* ... */);
                                        } // ... (logs de erro para outros casos)
                                    } // ... (logs de erro para outros casos)
                                    currentToken.availableIgAccounts = result.accounts;
                                } else {
                                    logger.error(`${TAG_JWT} [Facebook Flow DEBUG] fetchAvailableInstagramAccounts falhou para User ${userId}: ${result.error}`);
                                    currentToken.igConnectionError = result.error || "Falha ao buscar contas do Instagram.";
                                }
                            } catch (error) {
                                logger.error(`${TAG_JWT} [Facebook Flow DEBUG] Exceção ao chamar fetchAvailableInstagramAccounts ou processar conexão IG para User ${userId}:`, error);
                                currentToken.igConnectionError = error instanceof Error ? error.message : "Erro inesperado no processo de conexão IG.";
                            }
                        } else {
                            logger.error(`${TAG_JWT} [Facebook Flow DEBUG] Access token do Facebook (SLT) ausente para User ${userId}.`);
                            currentToken.igConnectionError = "Token do Facebook ausente.";
                        }
                    }
                    // Define o provider no token para fins informativos, mas o ID principal deve ser do Google se já logado.
                    // Se não havia sessão Google, currentToken.provider será 'facebook'.
                    if (!currentToken.provider && userId) currentToken.provider = 'facebook';

                } else { // Provedor Google ou Credentials
                    const providerName = account.provider || 'unknown_provider';
                    logger.debug(`${TAG_JWT} [${providerName} Flow DEBUG] Processando login inicial.`);
                    logger.debug(`${TAG_JWT} [${providerName} Flow DEBUG] Objeto 'user' recebido do signIn: ${JSON.stringify(user)}`);
                    logger.debug(`${TAG_JWT} [${providerName} Flow DEBUG] Valor de user?.id ANTES da validação: '${user.id}'`);

                    const isValidObjectId = user.id ? Types.ObjectId.isValid(user.id) : false;
                    logger.debug(`${TAG_JWT} [${providerName} Flow DEBUG] Resultado de Types.ObjectId.isValid(user.id='${user.id}'): ${isValidObjectId}`);

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
                            logger.debug(`${TAG_JWT} [${providerName} Flow DEBUG] Role buscada do DB: '${currentToken.role}' para user ID '${currentToken.id}'`);
                        } catch (error) {
                            logger.error(`${TAG_JWT} [${providerName} Flow DEBUG] Erro ao buscar role para ${currentToken.id}:`, error);
                            currentToken.role = 'user'; // Fallback role
                        }
                    } else {
                         logger.error(`${TAG_JWT} [${providerName} Flow DEBUG] ID do usuário ('${user.id}') inválido ou ausente. DEFININDO currentToken.id PARA ''.`);
                         currentToken.id = ''; // ID é explicitamente definido como STRING VAZIA!
                    }
                    logger.debug(`${TAG_JWT} [${providerName} Flow DEBUG] currentToken.id APÓS bloco inicial: '${currentToken.id}'`);
                }
            }

            const finalUserId = currentToken.id || token?.id;
            logger.debug(`${TAG_JWT} [Consolidation DEBUG] finalUserId determinado como: '${finalUserId}'. (currentToken.id: '${currentToken.id}', token?.id: '${token?.id}')`);


            if (finalUserId && typeof finalUserId === 'string' && Types.ObjectId.isValid(finalUserId)) {
                currentToken.id = finalUserId;
                currentToken.sub = finalUserId;
                logger.debug(`${TAG_JWT} [Consolidation DEBUG] finalUserId ('${finalUserId}') é válido. currentToken.id e .sub definidos.`);

                if (!currentToken.name || !currentToken.email || !currentToken.image || !currentToken.role || !currentToken.provider) {
                    logger.debug(`${TAG_JWT} [Enrichment Block DEBUG] ENTRANDO NO BLOCO DE ENRIQUECIMENTO DE TOKEN PARA UserID: ${finalUserId}. Valores atuais: name='${currentToken.name}', email='${currentToken.email}', image='${currentToken.image}', role='${currentToken.role}', provider='${currentToken.provider}'`);
                    try {
                        logger.debug(`${TAG_JWT} [Enrichment Block DEBUG] Chamando connectToDatabase() ANTES de findById.`);
                        await connectToDatabase();
                        logger.debug(`${TAG_JWT} [Enrichment Block DEBUG] connectToDatabase() CONCLUÍDO. Chamando DbUser.findById('${finalUserId}')...`);
                        const dbUser = await DbUser.findById(finalUserId).select('name email image role provider facebookProviderAccountId').lean();
                        logger.debug(`${TAG_JWT} [Enrichment Block DEBUG] Resultado de DbUser.findById: ${dbUser ? `ENCONTRADO (ID: ${dbUser._id})` : 'NÃO ENCONTRADO (null)'}`);

                        if (dbUser) {
                            if (!currentToken.name) currentToken.name = dbUser.name;
                            if (!currentToken.email) currentToken.email = dbUser.email;
                            if (!currentToken.image) currentToken.image = dbUser.image;
                            if (!currentToken.role) currentToken.role = dbUser.role ?? 'user';
                            if (!currentToken.provider) {
                                currentToken.provider = dbUser.provider ?? (dbUser.facebookProviderAccountId ? 'facebook' : undefined);
                            }
                            logger.debug(`${TAG_JWT} [Enrichment Block DEBUG] Token enriquecido. ID mantido: ${currentToken.id}`);
                        } else {
                            logger.warn(`${TAG_JWT} [Enrichment Block DEBUG] Usuário ${finalUserId} NÃO encontrado no DB para preencher token. DEFININDO currentToken.id PARA ''.`);
                            currentToken.id = '';
                        }
                    } catch (error) {
                        logger.error(`${TAG_JWT} [Enrichment Block DEBUG] ERRO NO TRY/CATCH do enriquecimento para ${finalUserId}:`, error);
                    }
                } else {
                    logger.debug(`${TAG_JWT} [Enrichment Block DEBUG] PULO DO BLOCO DE ENRIQUECIMENTO para UserID: ${finalUserId}. Dados já completos no token inicial.`);
                }
            } else if (trigger !== 'signUp' && trigger !== 'signIn') {
                logger.warn(`${TAG_JWT} [Consolidation DEBUG] ID final ('${finalUserId}') inválido ou vazio FORA DO FLUXO DE LOGIN. Limpando token (retornando {}).`);
                return {} as JWT;
            } else if (isSignInOrSignUp && (!finalUserId || !Types.ObjectId.isValid(finalUserId))) {
                logger.error(`${TAG_JWT} [Consolidation DEBUG] ID final ('${finalUserId}') inválido ou não é ObjectId válido DURANTE O FLUXO DE LOGIN. Definindo currentToken.id como ''.`);
                currentToken.id = ''; // Garante que um ID inválido no login não prossiga
            }


            logger.debug(`${TAG_JWT} FINAL do callback jwt. Retornando token com id: '${currentToken.id}', sub: '${currentToken.sub}', provider: '${currentToken.provider}'`, {
                availableIgAccountsCount: currentToken.availableIgAccounts?.length,
                igConnectionError: currentToken.igConnectionError
            });
            return currentToken as JWT;
        },

        async session({ session, token }) {
             const TAG_SESSION = '[NextAuth Session Callback]';
             logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token Sub: ${token?.sub}, Token Provider: ${token?.provider}`);

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
             };

             try {
                 await connectToDatabase();
                 const dbUser = await DbUser.findById(token.id)
                     .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected instagramAccountId username')
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
        maxAge: 30 * 24 * 60 * 60 // 30 days
    }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };