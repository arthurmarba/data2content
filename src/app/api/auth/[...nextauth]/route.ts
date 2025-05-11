// src/app/api/auth/[...nextauth]/route.ts
// - Callback 'session' atualizado para buscar 'isNewUserForOnboarding' e 'onboardingCompletedAt'
//   do banco de dados para garantir que a sessão reflita o estado de onboarding mais recente.

import NextAuth from "next-auth";
import type { DefaultSession, DefaultUser, NextAuthOptions, Session, User, Account } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // IUser precisará incluir onboardingCompletedAt?: Date
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
import * as dataService from "@/app/lib/dataService";

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
        onboardingCompletedAt?: Date | null; // Adicionado para melhor rastreamento
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
         picture?: string | null;
         image?: string | null;
         sub?: string;
         isNewUserForOnboarding?: boolean;
         onboardingCompletedAt?: Date | null; // Adicionado para melhor rastreamento
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included";

// --- Funções customEncode e customDecode (mantidas) ---
// (código omitido para brevidade, assumindo que é o mesmo da versão anterior)
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
    if (cleanToken.onboardingCompletedAt instanceof Date) { // Garantir que o Date seja serializável
        cleanToken.onboardingCompletedAt = cleanToken.onboardingCompletedAt.toISOString();
    }
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
        if (payload && typeof payload.onboardingCompletedAt === 'string') { // Desserializar Date
            payload.onboardingCompletedAt = new Date(payload.onboardingCompletedAt);
        }
        return payload as JWT;
    } catch (err) {
        logger.error(`customDecode: Erro ao decodificar token HS256: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}


export const authOptions: NextAuthOptions = {
    // ... useSecureCookies, cookies, providers, jwt (mantidos, omitidos para brevidade) ...
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
            // (código do signIn mantido, omitido para brevidade)
            const TAG_SIGNIN = '[NextAuth signIn Callback vConnectAccount-OnboardingFlag-Fix-Image]';
            logger.debug(`${TAG_SIGNIN} Iniciado`, { userIdRaw: user.id, provider: account?.provider, userObj: JSON.stringify(user) });
            let isNewUser = false; 
            let dbUserForJwt: Partial<IUser> = {}; // Para passar dados para o JWT callback

            if (account?.provider === 'credentials') {
                logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials (utilizador: ${user.id}).`);
                dbUserForJwt = { _id: user.id as any, isNewUserForOnboarding: false, onboardingCompletedAt: new Date() } // Demo user não é novo
                Object.assign(user, { isNewUserForOnboarding: dbUserForJwt.isNewUserForOnboarding, onboardingCompletedAt: dbUserForJwt.onboardingCompletedAt });
                return true;
            }
            // ... (restante da lógica do signIn como estava, mas garantindo que `user` tenha `isNewUserForOnboarding` e `onboardingCompletedAt` populados se possível)
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
                        dbUserForJwt = { // Popular para JWT
                            _id: existing._id,
                            isNewUserForOnboarding: existing.isNewUserForOnboarding,
                            onboardingCompletedAt: existing.onboardingCompletedAt,
                            role: existing.role
                        };
                        // ... (atualizações no existing como antes) ...
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
                        const newUserDocData = { 
                            name: user.name, 
                            email: currentEmail, 
                            image: user.image, 
                            provider: 'google', 
                            providerAccountId: account.providerAccountId, 
                            role: 'user', 
                            isInstagramConnected: false,
                            isNewUserForOnboarding: true, // Novo usuário, flag é true
                            // onboardingCompletedAt não é definido aqui, pois o onboarding não foi feito
                        };
                        const newUserDb = new DbUser(newUserDocData);
                        const saved = await newUserDb.save();
                        user.id = saved._id.toString(); 
                        dbUserForJwt = { // Popular para JWT
                            _id: saved._id,
                            isNewUserForOnboarding: saved.isNewUserForOnboarding,
                            onboardingCompletedAt: saved.onboardingCompletedAt, // será undefined
                            role: saved.role
                        };
                        logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Novo utilizador Google CRIADO com _id: '${saved._id}'.`);
                        
                        try {
                            logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Registando opt-in na comunidade para novo utilizador ${saved._id}. Versão Termos: ${DEFAULT_TERMS_VERSION}`);
                            await dataService.optInUserToCommunity(saved._id.toString(), DEFAULT_TERMS_VERSION); // optInUserToCommunity atualiza UserModel, incluindo isNewUserForOnboarding
                            logger.info(`${TAG_SIGNIN} [Google Flow DEBUG] Opt-in na comunidade registado com sucesso para novo utilizador ${saved._id}.`);
                        } catch (optInError) {
                            logger.error(`${TAG_SIGNIN} [Google Flow DEBUG] Falha ao registar opt-in na comunidade para novo utilizador ${saved._id}:`, optInError);
                        }
                    }
                    // Passar os dados do DB para o objeto user que vai pro JWT callback
                    Object.assign(user, { 
                        isNewUserForOnboarding: dbUserForJwt.isNewUserForOnboarding, 
                        onboardingCompletedAt: dbUserForJwt.onboardingCompletedAt,
                        role: dbUserForJwt.role 
                    });
                    logger.debug(`${TAG_SIGNIN} [Google Flow DEBUG] FINAL para utilizador: user.id='${user.id}', isNewUserForOnboarding=${user.isNewUserForOnboarding}`);
                    return true;

                } else if (account.provider === 'facebook') {
                    // ... (lógica do Facebook similar, garantindo que user.isNewUserForOnboarding e user.onboardingCompletedAt sejam populados) ...
                    existing = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).exec();
                     if (existing) {
                        logger.info(`${TAG_SIGNIN} Utilizador existente encontrado (Facebook): ${existing._id}.`);
                        user.id = existing._id.toString(); 
                        Object.assign(user, { 
                            isNewUserForOnboarding: existing.isNewUserForOnboarding, 
                            onboardingCompletedAt: existing.onboardingCompletedAt,
                            role: existing.role 
                        });
                        // ... (atualizações no existing como antes) ...
                        return true;
                    }
                    // ... (se for novo usuário Facebook) ...
                    // Object.assign(user, { isNewUserForOnboarding: true, onboardingCompletedAt: undefined });
                    logger.warn(`${TAG_SIGNIN} Utilizador não encontrado para Facebook no signIn. Permitindo fluxo para JWT. (CONSIDERAR CRIAR USUÁRIO FB AQUI E SETAR FLAGS DE ONBOARDING)`);
                    (user as any).isNewUserForOnboarding = true; // Assumindo que se não existe, é novo e precisa de onboarding
                    return true; 
                }
                logger.error(`${TAG_SIGNIN} Provedor ${account.provider} não resultou em criação ou login.`);
                return false;
            } catch (error) {
                 logger.error(`${TAG_SIGNIN} Erro no DB durante signIn (${account?.provider}):`, error);
                 return false;
            }
        },

        async jwt({ token, user, account, trigger, session: sessionDataFromUpdate }) { // Adicionado sessionDataFromUpdate
            const TAG_JWT = '[NextAuth JWT Callback vConnectAccount-OnboardingFlag-Fix-Image]';
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. UserID (do param user): ${user?.id}. TokenInID (do param token): ${token?.id}. SessionData: ${JSON.stringify(sessionDataFromUpdate)}`);

            let currentToken: Partial<JWT> = { ...token }; // Começa com o token existente

            const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';

            if (isSignInOrSignUp && user) { // Popula o token com dados do objeto user (vindo do signIn)
                currentToken.id = user.id;
                currentToken.name = user.name;
                currentToken.email = user.email;
                currentToken.image = user.image;
                currentToken.provider = account?.provider;
                currentToken.role = (user as any).role ?? token?.role ?? 'user';
                
                if ((user as any).isNewUserForOnboarding !== undefined) {
                    currentToken.isNewUserForOnboarding = (user as any).isNewUserForOnboarding;
                }
                if ((user as any).onboardingCompletedAt !== undefined) {
                    currentToken.onboardingCompletedAt = (user as any).onboardingCompletedAt;
                }
                logger.info(`${TAG_JWT} [${account?.provider} Flow] Token inicial populado/atualizado. isNewUser: ${currentToken.isNewUserForOnboarding}, onboardingCompletedAt: ${currentToken.onboardingCompletedAt}`);
            }
            
            // Se o trigger for 'update' (chamado por updateSession() no cliente)
            // E se passarmos dados para updateSession({ someData: ... }), eles virão em sessionDataFromUpdate
            // No nosso caso, não estamos passando dados extras para updateSession(), então ele só reavalia.
            // A melhor forma de atualizar o token é buscando do DB se o ID existir.

            // Garante que o token sempre tenha o ID e busca dados do DB se necessário para enriquecer/atualizar
            if (currentToken.id && Types.ObjectId.isValid(currentToken.id)) {
                currentToken.sub = currentToken.id;
                try {
                    await connectToDatabase();
                    // Busca sempre do DB para garantir dados frescos, especialmente para 'update' trigger
                    const dbUser = await DbUser.findById(currentToken.id)
                        .select('name email image role provider isNewUserForOnboarding onboardingCompletedAt') // Adicionado isNewUserForOnboarding e onboardingCompletedAt
                        .lean();
                    
                    if (dbUser) {
                        currentToken.name = dbUser.name ?? currentToken.name;
                        currentToken.email = dbUser.email ?? currentToken.email;
                        currentToken.image = dbUser.image ?? currentToken.image;
                        currentToken.role = dbUser.role ?? currentToken.role ?? 'user';
                        currentToken.provider = dbUser.provider ?? currentToken.provider;
                        // Atualiza as flags de onboarding com base no DB
                        currentToken.isNewUserForOnboarding = dbUser.isNewUserForOnboarding ?? false;
                        currentToken.onboardingCompletedAt = dbUser.onboardingCompletedAt ?? null;
                    } else if (!isSignInOrSignUp) { // Se não for login e não encontrar usuário, invalida o token
                        logger.warn(`${TAG_JWT} Utilizador ${currentToken.id} não encontrado no DB durante enriquecimento de token. Invalidando token.`);
                        return {} as JWT;
                    }
                } catch (error) {
                    logger.error(`${TAG_JWT} Erro ao buscar dados do DB para enriquecer token ${currentToken.id}:`, error);
                }
            } else if (!isSignInOrSignUp) { // Se não tem ID válido e não é signIn/signUp
                logger.warn(`${TAG_JWT} Token sem ID válido fora do fluxo de login. Invalidando token.`);
                return {} as JWT;
            }
            
            // Limpeza final de campos não serializáveis ou redundantes
            delete (currentToken as any).igConnectionError;
            delete (currentToken as any).availableIgAccounts;
            if (currentToken.onboardingCompletedAt instanceof Date) { // Serializa Date para o JWT
                currentToken.onboardingCompletedAt = currentToken.onboardingCompletedAt.toISOString() as any;
            }


            logger.debug(`${TAG_JWT} FINAL do callback jwt. Retornando token com id: '${currentToken.id}', isNewUser: ${currentToken.isNewUserForOnboarding}, onboardingCompletedAt: ${currentToken.onboardingCompletedAt}`);
            return currentToken as JWT;
        },

        async session({ session, token }) {
            const TAG_SESSION = '[NextAuth Session Callback vConnectAccount-OnboardingFlag-Fix-Image-v2]';
            logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token isNewUser: ${token?.isNewUserForOnboarding}, Token onboardingCompletedAt: ${token?.onboardingCompletedAt}`);

            if (!token?.id || typeof token.id !== 'string' || !Types.ObjectId.isValid(token.id)) {
                logger.error(`${TAG_SESSION} Token ID inválido ou ausente ('${token?.id}'). Retornando sessão vazia.`);
                return { ...session, user: undefined, expires: session.expires };
            }

            // Inicializa session.user com os dados do token (que já devem estar atualizados pelo JWT callback)
            session.user = {
                id: token.id,
                name: token.name ?? undefined,
                email: token.email ?? undefined,
                image: token.image ?? token.picture ?? undefined,
                role: token.role ?? 'user',
                provider: token.provider,
                isNewUserForOnboarding: token.isNewUserForOnboarding ?? false, // Primariamente do token
                onboardingCompletedAt: token.onboardingCompletedAt ? new Date(token.onboardingCompletedAt) : null, // Desserializa se veio como string
                // Campos default que podem ser sobrescritos pelo DB se necessário
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
            
            // Opcional: Se precisar de mais dados do DB que não estão no token, pode buscar aqui.
            // Mas o JWT callback já deve ter enriquecido o token com os dados mais recentes do DB.
            // Se o JWT callback já busca do DB, esta busca adicional pode ser redundante
            // a menos que queira buscar campos que não são colocados no JWT por questões de tamanho/segurança.
            try {
                await connectToDatabase();
                const dbUser = await DbUser.findById(token.id)
                    .select('planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected instagramAccountId username isNewUserForOnboarding onboardingCompletedAt') // Adicionado isNewUserForOnboarding e onboardingCompletedAt
                    .lean();

                if (dbUser && session.user) {
                    // Sobrescreve/complementa com dados do DB se necessário ou se mais atualizados
                    session.user.planStatus = dbUser.planStatus ?? session.user.planStatus;
                    session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date ? dbUser.planExpiresAt.toISOString() : (dbUser.planExpiresAt ?? session.user.planExpiresAt);
                    session.user.affiliateCode = dbUser.affiliateCode ?? session.user.affiliateCode;
                    session.user.affiliateBalance = dbUser.affiliateBalance ?? session.user.affiliateBalance;
                    session.user.affiliateRank = dbUser.affiliateRank ?? session.user.affiliateRank;
                    session.user.affiliateInvites = dbUser.affiliateInvites ?? session.user.affiliateInvites;
                    session.user.instagramConnected = dbUser.isInstagramConnected ?? session.user.instagramConnected;
                    session.user.instagramAccountId = dbUser.instagramAccountId ?? session.user.instagramAccountId;
                    session.user.instagramUsername = dbUser.username ?? session.user.instagramUsername; // 'username' do DB

                    // Confirma/atualiza flags de onboarding com base no DB como fonte da verdade
                    session.user.isNewUserForOnboarding = dbUser.isNewUserForOnboarding ?? token.isNewUserForOnboarding ?? false;
                    session.user.onboardingCompletedAt = dbUser.onboardingCompletedAt ? new Date(dbUser.onboardingCompletedAt) : (token.onboardingCompletedAt ? new Date(token.onboardingCompletedAt) : null);

                    logger.debug(`${TAG_SESSION} Sessão enriquecida com dados do DB. User ID: ${session.user?.id}, isNewUser: ${session.user.isNewUserForOnboarding}, onboardingCompletedAt: ${session.user.onboardingCompletedAt}`);
                } else if (session.user) {
                     logger.warn(`${TAG_SESSION} Utilizador ${token.id} não encontrado no DB ao tentar enriquecer sessão (pode já ter sido tratado no JWT).`);
                }
            } catch (error) {
                 logger.error(`${TAG_SESSION} Erro ao buscar dados adicionais do utilizador ${token.id} para sessão:`, error);
            }
            return session;
        },
        async redirect({ url, baseUrl }) {
          // (código do redirect mantido, omitido para brevidade)
          const requestedUrl = new URL(url, baseUrl);
          const base = new URL(baseUrl);
          if (requestedUrl.origin === base.origin) {
            logger.debug(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é interna. Permitindo.`);
            return requestedUrl.toString();
          }
          logger.debug(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é externa ou inválida. Redirecionando para baseUrl: ${baseUrl}.`);
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