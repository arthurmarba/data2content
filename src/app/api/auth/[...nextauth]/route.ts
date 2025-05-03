// src/app/api/auth/[...nextauth]/route.ts (v6.13 - Corrige userToUpdate.save)
// - Atualiza callback jwt para usar fetchAvailableInstagramAccounts.
// - Adiciona 'availableIgAccounts' e 'pendingInstagramConnection' ao token JWT.
// - Remove chamada direta a triggerDataRefresh do callback jwt.
// - Adiciona import fetchAvailableInstagramAccounts.
// - Corrige tipo da propriedade 'id' na interface ExtendedJWT.
// - Adiciona declarações para estender Session['user'] com campos customizados.
// - Corrige erro de tipo na atribuição de session.user.image.
// - Remove save() redundante em objeto lean no callback jwt.

import NextAuth from "next-auth";
import type { DefaultSession, DefaultUser, NextAuthOptions, Session, User, Account } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import { cookies } from 'next/headers';
import {
    fetchAvailableInstagramAccounts,
    AvailableInstagramAccount,
} from "@/app/lib/instagramService";
import { storeTemporaryLlat } from "@/app/lib/tempTokenStorage";

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
        pendingInstagramConnection?: boolean | null;
        availableIgAccounts?: AvailableInstagramAccount[] | null;
        igConnectionError?: string | null;
        image?: string | null;
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
        pendingInstagramConnection?: boolean | null;
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

interface SignInCallback { user: User & { id?: string }; account: Account | null; }
interface JwtCallback { token: JWT; user?: User | AdapterUser; account?: Account | null; profile?: any; trigger?: "signIn" | "signUp" | "update" | undefined; }
interface RedirectCallback { baseUrl: string; }

async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    // ... (customEncode mantido como antes)
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
    const cleanToken = Object.entries(token ?? {}).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, any>);
    if (cleanToken.id === undefined || cleanToken.id === null) { cleanToken.id = ''; }
    if (cleanToken.image && !cleanToken.picture) { cleanToken.picture = cleanToken.image; }
    return await new SignJWT(cleanToken)
        .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expirationTime)
        .sign(new TextEncoder().encode(secretString));
}

async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
    // ... (customDecode mantido como antes)
    if (!token || !secret) { logger.error("customDecode: Token ou secret não fornecidos."); return null; }
    const secretString = typeof secret === "string" ? secret : String(secret);
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString), { algorithms: ["HS256"], });
        if (payload && typeof payload.id !== 'string') { payload.id = ''; }
        if (payload && payload.picture && !payload.image) { payload.image = payload.picture; }
        return payload as JWT;
    } catch (err) { logger.error(`customDecode: Erro ao decodificar token HS256: ${err instanceof Error ? err.message : String(err)}`); return null; }
}

export const authOptions: NextAuthOptions = {
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: { /* ... (cookies mantidos) ... */
    sessionToken: { name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.session-token" : "next-auth.session-token", options: { httpOnly: true, sameSite: "lax", path: "/", domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined, secure: process.env.NODE_ENV === "production" }, },
    callbackUrl: { name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.callback-url" : "next-auth.callback-url", options: { sameSite: "lax", path: "/", domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined, secure: process.env.NODE_ENV === "production" }, },
    csrfToken: { name: process.env.NODE_ENV === 'production' ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token", options: { httpOnly: true, sameSite: "lax", path: "/", domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined, secure: process.env.NODE_ENV === "production" }, },
  },
  providers: [ /* ... (providers mantidos) ... */
    GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, authorization: { params: { scope: "openid email profile" } }, profile(profile) { logger.debug("NextAuth: Google profile returned:", profile); return { id: profile.sub, name: profile.name, email: profile.email, image: profile.picture }; }, }),
    FacebookProvider({ clientId: process.env.FACEBOOK_CLIENT_ID!, clientSecret: process.env.FACEBOOK_CLIENT_SECRET!, authorization: { params: { scope: [ 'email', 'public_profile', 'pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_manage_insights', 'instagram_manage_comments', ].join(','), }, }, profile(profile) { logger.debug("NextAuth: Facebook profile returned:", profile); return { id: profile.id, name: profile.name, email: profile.email, image: profile.picture?.data?.url, }; }, }),
    CredentialsProvider({ name: "Demo", credentials: { username: { label: "Usuário", type: "text", placeholder: "demo" }, password: { label: "Senha", type: "password", placeholder: "demo" } }, async authorize(credentials) { if (credentials?.username === "demo" && credentials?.password === "demo") { return { id: "demo-123", name: "Demo User", email: "demo@example.com" }; } return null; }, }),
  ],
  jwt: { secret: process.env.NEXTAUTH_SECRET, encode: customEncode, decode: customDecode, },
  callbacks: {
    // --- Callback signIn (sem alterações) ---
    async signIn({ user, account, profile }: { user: User & { id?: string }, account: Account | null, profile?: any }): Promise<boolean> {
        const TAG_SIGNIN = '[NextAuth signIn Callback]';
        logger.debug(`${TAG_SIGNIN} Iniciado`, { userId: user.id, provider: account?.provider, email: user.email });

        if (account?.provider === "credentials") { /* ... (credentials mantido) ... */
            if (!user?.id) { logger.error(`${TAG_SIGNIN} Usuário de Credentials sem ID.`); return false; }
            logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials para User ${user.id}`);
            return true;
        }
        if (!account || !account.providerAccountId) { /* ... (verificação mantida) ... */
             logger.error(`${TAG_SIGNIN} Informações mínimas ausentes (account, providerAccountId). Provider: ${account?.provider}`);
             return false;
        }
        const currentEmail = user?.email;
        if (!currentEmail && account.provider !== 'facebook') { /* ... (verificação mantida) ... */
              logger.error(`${TAG_SIGNIN} Email ausente para ${account.provider}.`);
              return false;
        }

        if (account.provider === "google" || account.provider === "facebook") {
            try {
                await connectToDatabase();
                let existingUser: IUser | null = null;
                let query: any = {};

                 if (account.provider === 'facebook') {
                    query = { facebookProviderAccountId: user.id };
                    logger.debug(`${TAG_SIGNIN} Tentando encontrar por facebookProviderAccountId: ${user.id}`);
                    existingUser = await DbUser.findOne(query).exec();
                } else { // Google
                    query = { providerAccountId: user.id, provider: 'google' };
                     logger.debug(`${TAG_SIGNIN} Tentando encontrar por providerAccountId (Google): ${user.id}`);
                    existingUser = await DbUser.findOne(query).exec();
                }

                if (!existingUser && currentEmail) {
                    logger.debug(`${TAG_SIGNIN} Não encontrado por Provider ID, tentando por email: ${currentEmail}`);
                    query = { email: currentEmail };
                    existingUser = await DbUser.findOne(query).exec();
                }

                if (existingUser) { // Usuário Existe
                    logger.debug(`${TAG_SIGNIN} Usuário existente encontrado (query: ${JSON.stringify(query)}) para ${account.provider}. ID: ${existingUser._id}`);
                    user.id = existingUser._id.toString(); // Atualiza user.id para ID do DB

                    let needsSave = false;
                    const providerName = user?.name;
                    const providerImage = user?.image;

                    if (providerName && providerName !== existingUser.name) { existingUser.name = providerName; needsSave = true; }
                    if (providerImage && (!existingUser.image || account.provider !== 'facebook')) { if (providerImage !== existingUser.image) { existingUser.image = providerImage; needsSave = true; logger.debug(`${TAG_SIGNIN} Atualizando imagem do usuário com a do provider ${account.provider}.`); } }
                    else if (providerImage && account.provider === 'facebook' && existingUser.image) { logger.debug(`${TAG_SIGNIN} Mantendo imagem existente em vez de atualizar com a do Facebook.`); }

                    if (account.provider === 'facebook' && existingUser.facebookProviderAccountId !== account.providerAccountId) { logger.info(`${TAG_SIGNIN} Vinculando/Atualizando facebookProviderAccountId para ${account.providerAccountId} no User ${existingUser._id}`); existingUser.facebookProviderAccountId = account.providerAccountId; needsSave = true; }
                    else if (account.provider === 'google' && existingUser.providerAccountId !== account.providerAccountId) { logger.info(`${TAG_SIGNIN} Vinculando/Atualizando providerAccountId (Google) para ${account.providerAccountId} no User ${existingUser._id}`); existingUser.providerAccountId = account.providerAccountId; if (!existingUser.provider) existingUser.provider = 'google'; needsSave = true; }
                    if (existingUser.isInstagramConnected === undefined) { existingUser.isInstagramConnected = !!existingUser.instagramAccountId; needsSave = true; }
                    if (currentEmail && existingUser.email && currentEmail !== existingUser.email && query.email === undefined) { logger.warn(`${TAG_SIGNIN} Email do provider (${currentEmail}) diferente do email existente (${existingUser.email}) para User ${existingUser._id}.`); }

                    if (needsSave) { await existingUser.save(); logger.debug(`${TAG_SIGNIN} Dados do usuário existente atualizados/vinculados.`); }
                    return true; // Permite signIn

                } else { // Usuário Não Existe
                    if (account.provider === 'google') { /* ... (criação usuário Google mantida) ... */
                        if (!currentEmail) { logger.error(`${TAG_SIGNIN} Email ausente para criar novo usuário Google.`); return false; }
                        logger.debug(`${TAG_SIGNIN} Criando novo usuário (Google) para email: ${currentEmail}`);
                        const newUser = new DbUser({ name: user.name, email: user.email, image: user.image, provider: account.provider, providerAccountId: account.providerAccountId, role: "user", planStatus: "inactive", isInstagramConnected: false, });
                        const savedUser = await newUser.save();
                        user.id = savedUser._id.toString(); // Atualiza user.id
                        logger.debug(`${TAG_SIGNIN} Novo usuário (Google) criado: ${user.id}`);
                        return true;
                    }
                    else if (account.provider === 'facebook') { /* ... (permite fluxo para JWT mantido) ... */
                         logger.debug(`${TAG_SIGNIN} Utilizador não encontrado para Facebook. Permitindo fluxo para JWT.`);
                         return true;
                    }
                }
            } catch (error) { logger.error(`${TAG_SIGNIN} Erro (${account.provider}) ao interagir com o banco:`, error); return false; }
        }
        logger.warn(`${TAG_SIGNIN} Provider não suportado ou fluxo inesperado.`);
        return false;
    },

    // --- Callback jwt ATUALIZADO ---
    async jwt({ token, user, account, profile, trigger }: JwtCallback): Promise<JWT> {
        const TAG_JWT = '[NextAuth JWT Callback v1.8.0]';
        let finalTokenData: JWT = { ...token, id: typeof token?.id === 'string' ? token.id : '' };

        logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Account Provider: ${account?.provider}. UserID entrada: ${user?.id}. Token entrada ID: ${token?.id}`);

        delete finalTokenData.pendingInstagramConnection;
        delete finalTokenData.availableIgAccounts;
        delete finalTokenData.igConnectionError;

        const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';

        if (isSignInOrSignUp && account) {
            if (account.provider === 'facebook') {
                let linkTokenUser: IUser | null = null;
                let linkTokenValue: string | undefined = undefined;
                let userIdToUse: string | undefined;
                let isLinkingFlow = false; // Flag para identificar fluxo de vinculação

                // 1.1 Tenta processar o linkToken
                try {
                    const cookieStore = cookies();
                    const linkCookie = cookieStore.get('auth-link-token');
                    linkTokenValue = linkCookie?.value;
                    if (linkTokenValue) {
                        logger.info(`${TAG_JWT} Cookie 'auth-link-token' encontrado.`);
                        cookieStore.delete('auth-link-token');
                        logger.info(`${TAG_JWT} Cookie 'auth-link-token' deletado.`);
                        await connectToDatabase();
                        // Busca usuário pelo token válido - AINDA USA LEAN AQUI
                        linkTokenUser = await DbUser.findOne({
                            linkToken: linkTokenValue,
                            linkTokenExpiresAt: { $gt: new Date() }
                        }).lean().exec();
                        if (linkTokenUser) {
                            isLinkingFlow = true; // Marca como fluxo de vinculação
                            logger.info(`${TAG_JWT} Usuário encontrado via linkToken: ${linkTokenUser._id}. Iniciando vinculação.`);
                            userIdToUse = linkTokenUser._id.toString();
                            // Remove o token do DB
                            await DbUser.updateOne({ _id: linkTokenUser._id }, { $unset: { linkToken: "", linkTokenExpiresAt: "" } });
                            logger.info(`${TAG_JWT} linkToken removido do DB para User ${userIdToUse}.`);
                        } else {
                            logger.warn(`${TAG_JWT} Link token encontrado no cookie, mas inválido/expirado no DB.`);
                        }
                    } else {
                         logger.debug(`${TAG_JWT} Cookie 'auth-link-token' não encontrado.`);
                    }
                } catch (err) {
                    logger.error(`${TAG_JWT} Erro ao processar cookie 'auth-link-token':`, err);
                    if (linkTokenValue) { try { cookies().delete('auth-link-token'); } catch {} }
                }

                // 1.2 Determina o ID do usuário final e busca o documento completo se necessário
                let dbUserDoc: IUser | null = null; // Usaremos este para ter o doc completo
                if (isLinkingFlow && linkTokenUser) {
                    userIdToUse = linkTokenUser._id.toString();
                    // No fluxo de linking, o signIn já deve ter atualizado o facebookProviderAccountId
                    // Apenas precisamos dos dados do usuário original (Google)
                    finalTokenData = {
                        ...finalTokenData,
                        id: userIdToUse,
                        provider: linkTokenUser.provider, // Provider original (google)
                        role: linkTokenUser.role,
                        name: linkTokenUser.name,
                        email: linkTokenUser.email,
                        image: linkTokenUser.image,
                    };
                    logger.debug(`${TAG_JWT} Dados básicos do token preenchidos para usuário vinculado ${userIdToUse}.`);
                } else { // Login normal ou criação
                    await connectToDatabase();
                    if (account.providerAccountId) {
                        dbUserDoc = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).exec();
                    }
                    const currentEmail = user?.email;
                    if (!dbUserDoc && currentEmail) {
                        dbUserDoc = await DbUser.findOne({ email: currentEmail }).exec();
                    }

                    // 1.3 Se encontrou usuário existente (login normal)
                    if (dbUserDoc) {
                        userIdToUse = dbUserDoc._id.toString();
                        logger.info(`${TAG_JWT} Usuário existente ${userIdToUse} encontrado/identificado (Login Normal/Email).`);
                        // --- CORREÇÃO: Vincula FB ID aqui SE necessário (caso tenha logado via email antes) ---
                        if (dbUserDoc.facebookProviderAccountId !== account.providerAccountId && account.providerAccountId) {
                             const otherUserWithFbId = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId, _id: { $ne: dbUserDoc._id } }).select('_id').lean().exec();
                             if (otherUserWithFbId) {
                                 logger.error(`${TAG_JWT} Conta Facebook (${account.providerAccountId}) já vinculada a outro usuário (${otherUserWithFbId._id}). Abortando.`);
                                 finalTokenData = {
                                     ...finalTokenData, id: userIdToUse, provider: dbUserDoc.provider, role: dbUserDoc.role,
                                     name: dbUserDoc.name, email: dbUserDoc.email, image: dbUserDoc.image,
                                     igConnectionError: "fb_already_linked",
                                 };
                                 return finalTokenData;
                             } else {
                                 logger.info(`${TAG_JWT} Vinculando FB ID ${account.providerAccountId} ao usuário existente ${userIdToUse} (encontrado por email).`);
                                 dbUserDoc.facebookProviderAccountId = account.providerAccountId;
                                 await dbUserDoc.save(); // AGORA userToUpdate É UM DOCUMENTO MONGOOSE
                             }
                        }
                        // --- FIM DA CORREÇÃO ---
                        finalTokenData = {
                            ...finalTokenData,
                            id: userIdToUse, provider: dbUserDoc.provider || 'facebook', role: dbUserDoc.role,
                            name: dbUserDoc.name, email: dbUserDoc.email, image: dbUserDoc.image,
                        };
                    }
                    // 1.4 Se NÃO encontrou -> Cria novo usuário FB
                    else {
                        logger.info(`${TAG_JWT} Usuário não encontrado. Criando novo usuário para Facebook ID ${account.providerAccountId}.`);
                        const currentEmail = user?.email;
                        if (!account.providerAccountId) { /* ... (erro mantido) ... */
                            logger.error(`${TAG_JWT} ProviderAccountId do Facebook ausente.`);
                            finalTokenData = { ...finalTokenData, id: '', igConnectionError: "fb_create_missing_id" };
                            return finalTokenData;
                        }
                        if (currentEmail) { /* ... (verificação de email existente mantida) ... */
                            const userWithEmail = await DbUser.findOne({ email: currentEmail }).select('_id').lean().exec();
                            if (userWithEmail) {
                                logger.error(`${TAG_JWT} Tentativa de criar novo usuário FB, mas email (${currentEmail}) já existe para User ${userWithEmail._id}.`);
                                finalTokenData = { ...finalTokenData, id: '', igConnectionError: "fb_email_exists" };
                                return finalTokenData;
                            }
                        }
                        const newUser = new DbUser({
                            name: user?.name, email: currentEmail, image: user?.image,
                            provider: 'facebook', providerAccountId: null, facebookProviderAccountId: account.providerAccountId,
                            role: "user", planStatus: "inactive", isInstagramConnected: false,
                        });
                        try {
                            const savedUser = await newUser.save();
                            userIdToUse = savedUser._id.toString();
                            logger.info(`${TAG_JWT} Novo usuário Facebook criado com sucesso: ${userIdToUse}`);
                            finalTokenData = {
                                ...finalTokenData, id: userIdToUse, provider: 'facebook', role: savedUser.role,
                                name: savedUser.name, email: savedUser.email, image: savedUser.image,
                            };
                        } catch (dbError: any) { /* ... (tratamento de erro mantido) ... */
                            logger.error(`${TAG_JWT} Erro ao salvar novo usuário Facebook no DB:`, dbError);
                            finalTokenData = { ...finalTokenData, id: '', igConnectionError: "fb_create_db_error" };
                            return finalTokenData;
                        }
                    }
                } // Fim do else (Login normal ou criação)

                // --- 1.5 Tenta buscar contas Instagram disponíveis ---
                if (userIdToUse && account.access_token) {
                    logger.info(`${TAG_JWT} Chamando fetchAvailableInstagramAccounts para User ${userIdToUse}...`);
                    const igAccountsResult = await fetchAvailableInstagramAccounts(account.access_token, userIdToUse);

                    if (igAccountsResult.success) {
                        logger.info(`${TAG_JWT} Busca de contas IG bem-sucedida. ${igAccountsResult.accounts.length} conta(s) encontrada(s).`);
                        const storedLlat = await storeTemporaryLlat(userIdToUse, igAccountsResult.longLivedAccessToken);
                        if (!storedLlat) {
                            logger.error(`${TAG_JWT} Falha ao armazenar LLAT temporário para ${userIdToUse}.`);
                            finalTokenData.igConnectionError = "temp_llat_storage_failed";
                        }
                        finalTokenData.pendingInstagramConnection = true;
                        finalTokenData.availableIgAccounts = igAccountsResult.accounts;
                    } else {
                        logger.error(`${TAG_JWT} Falha ao buscar contas IG: ${igAccountsResult.error}`);
                        finalTokenData.igConnectionError = igAccountsResult.error;
                    }
                } else {
                    logger.warn(`${TAG_JWT} Pulando busca de contas IG: userIdToUse ou access_token ausente.`);
                    if (!account.access_token) finalTokenData.igConnectionError = "missing_fb_token";
                }

            // --- Lógica para Google ou Credentials ---
            } else { // Google ou Credentials
                logger.debug(`${TAG_JWT} Processando login inicial com ${account.provider}.`);
                // user.id já é o ID do DB vindo do signIn
                if (user?.id && typeof user.id === 'string' && Types.ObjectId.isValid(user.id)) {
                    finalTokenData.id = user.id;
                    finalTokenData.provider = account.provider;
                    finalTokenData.name = user.name;
                    finalTokenData.email = user.email;
                    finalTokenData.image = user.image;
                    logger.debug(`${TAG_JWT} Definindo token.id=${finalTokenData.id}, token.provider=${finalTokenData.provider}`);
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(finalTokenData.id).select('role').lean();
                        finalTokenData.role = dbUser?.role;
                        if (!dbUser) logger.warn(`${TAG_JWT} Usuário ${finalTokenData.id} não encontrado no DB ao buscar role (${account.provider}).`);
                    } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar role (${account.provider}):`, error); finalTokenData.role = undefined; }
                } else {
                     logger.error(`${TAG_JWT} ID do usuário inválido ou ausente vindo do signIn para ${account.provider}: '${user?.id}'.`);
                     finalTokenData.id = '';
                     finalTokenData.role = undefined;
                }
            }
        } // Fim do if (isSignInOrSignUp && account)

        // --- Atualizações Gerais do Token ---
        if (!finalTokenData.id && token.id && Types.ObjectId.isValid(token.id as string)) {
            logger.warn(`${TAG_JWT} ID final ausente, recuperando do token original: ${token.id}`);
            finalTokenData = { ...token, id: token.id as string };
        }
        if (typeof finalTokenData.id !== 'string') { finalTokenData.id = ''; }

        if (finalTokenData.id && Types.ObjectId.isValid(finalTokenData.id)) {
            finalTokenData.sub = finalTokenData.id;
            if (!finalTokenData.role) { /* ... (busca de role mantida) ... */
                logger.debug(`${TAG_JWT} Buscando role final para User ${finalTokenData.id}.`);
                 try {
                    await connectToDatabase();
                    const dbUser = await DbUser.findById(finalTokenData.id).select('role').lean();
                    finalTokenData.role = dbUser?.role;
                    if (!dbUser) logger.warn(`${TAG_JWT} Usuário ${finalTokenData.id} não encontrado no DB na busca final de role.`);
                 } catch (error) { logger.error(`${TAG_JWT} Erro na busca final de role para User ${finalTokenData.id}:`, error); finalTokenData.role = undefined; }
            }
        } else { /* ... (limpeza de sub/role mantida) ... */
             logger.debug(`${TAG_JWT} ID final inválido ou vazio ('${finalTokenData.id}').`);
             delete finalTokenData.sub;
             finalTokenData.role = undefined;
             delete finalTokenData.pendingInstagramConnection;
             delete finalTokenData.availableIgAccounts;
        }

        delete (finalTokenData as any).error; // Remove campo interno de erro de vinculação

        logger.debug(`${TAG_JWT} Finalizado. Retornando token:`, JSON.stringify(finalTokenData));
        return finalTokenData;
    },

    // --- Callback session (sem alterações) ---
    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      const TAG_SESSION = '[NextAuth Session Callback v1.8.0]';
      logger.debug(`${TAG_SESSION} Iniciado. Token recebido:`, JSON.stringify(token));

      const validTokenId = token.id && typeof token.id === 'string' && Types.ObjectId.isValid(token.id) ? token.id : null;

      if (validTokenId) {
          session.user = {
              id: validTokenId,
              name: token.name,
              email: token.email as string | null | undefined,
              image: (token.image ?? token.picture) as string | null | undefined,
              provider: token.provider,
              role: token.role ?? 'user',
              pendingInstagramConnection: token.pendingInstagramConnection,
              availableIgAccounts: token.availableIgAccounts,
              igConnectionError: token.igConnectionError,
              planStatus: undefined, planExpiresAt: null, affiliateCode: undefined,
              affiliateBalance: undefined, affiliateRank: undefined, affiliateInvites: undefined,
              instagramConnected: undefined, instagramAccountId: undefined, instagramUsername: undefined,
          };
          logger.debug(`${TAG_SESSION} Session.user inicializado com id='${session.user.id}', provider='${session.user.provider}', role='${session.user.role}', pendingIG=${session.user.pendingInstagramConnection}`);

          try {
            await connectToDatabase();
            const dbUser = await DbUser.findById(validTokenId)
                                       .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected instagramAccountId username')
                                       .lean();

            if (dbUser && session.user) {
              logger.debug(`${TAG_SESSION} Usuário encontrado no DB para sessão: ${dbUser._id}`);
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
              session.user.instagramAccountId = dbUser.instagramAccountId;
              session.user.instagramUsername = dbUser.username;

              if (session.user.instagramConnected) {
                  delete session.user.pendingInstagramConnection;
                  delete session.user.availableIgAccounts;
                  delete session.user.igConnectionError;
              }
              logger.debug(`${TAG_SESSION} Status conexão Instagram (do DB) para User ${validTokenId}: ${session.user.instagramConnected}`);

            } else if (session.user) {
               logger.error(`${TAG_SESSION} Usuário ${validTokenId} não encontrado no DB ao popular sessão.`);
               delete session.user.planStatus; delete session.user.planExpiresAt; delete session.user.affiliateCode;
               delete session.user.affiliateBalance; delete session.user.affiliateRank; delete session.user.affiliateInvites;
               delete session.user.instagramConnected; delete session.user.instagramAccountId; delete session.user.instagramUsername;
            }
          } catch (error) {
            logger.error(`${TAG_SESSION} Erro ao buscar/processar dados do usuário na sessão:`, error);
             if(session.user) {
                delete session.user.planStatus; delete session.user.instagramConnected;
                delete session.user.instagramAccountId; delete session.user.instagramUsername;
            }
          }
      } else {
          logger.error(`${TAG_SESSION} Erro: token.id ausente, inválido ou vazio ('${token.id}') ao iniciar sessão. Retornando sessão vazia.`);
          return { ...session, user: undefined, expires: session.expires };
      }

      logger.debug(`${TAG_SESSION} Finalizado. Retornando session.user:`, JSON.stringify(session.user));
      return session;
    },

    // --- Callback redirect (mantido) ---
    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      return `${baseUrl}/dashboard`;
    },
  },
  pages: { signIn: "/login", error: "/auth/error", },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, }, // 30 days
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
