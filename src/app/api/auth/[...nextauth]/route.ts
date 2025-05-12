// src/app/api/auth/[...nextauth]/route.ts
// - Lógica de signIn para Facebook prioriza linkToken para vinculação, não cria novo utilizador.
// - Lógica de signIn para Google mantida (cria novo utilizador se necessário).
// - Callbacks jwt e session robustecidos para consistência de dados.
// - CORRIGIDO: Tipos dos perfis Google e Facebook.
// - CORRIGIDO: Configuração do CredentialsProvider restaurada e completa.
// - CORRIGIDO: Remoção de imports de CredentialsConfig e CredentialInput da importação principal de 'next-auth'.

import NextAuth from "next-auth";
// Removido CredentialsConfig e CredentialInput daqui
import type { DefaultSession, DefaultUser, NextAuthOptions, Session, User as NextAuthUserArg, Account, Profile } from "next-auth"; 
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials"; // O tipo para 'credentials' dentro daqui será inferido.
import type { CredentialInput } from "next-auth/providers/credentials"; // Importação correta se precisar do tipo CredentialInput explicitamente em outro lugar

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Seu UserModel é DbUser
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import * as dataService from "@/app/lib/dataService";
import { cookies } from 'next/headers';
// import {
//     fetchAvailableInstagramAccounts,
//     connectInstagramAccount,
//     AvailableInstagramAccount,
// } from "@/app/lib/instagramService";


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
         image?: string | null;
         role?: string | null;
         provider?: string | null;
         isNewUserForOnboarding?: boolean;
         onboardingCompletedAt?: Date | null; 
         isInstagramConnected?: boolean | null; 
     }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included";
const LINK_TOKEN_COOKIE_NAME = "d2c-link-token"; 

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
    delete cleanToken.picture; 

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
            // A estrutura de 'credentials' define os campos do formulário
            credentials: {
                username: { label: "Utilizador", type: "text", placeholder: "demo" },
                password: { label: "Senha", type: "password", placeholder: "demo" }
            },
            // A função 'authorize' recebe os credentials submetidos
            async authorize(credentials, req) { 
                // 'credentials' aqui será do tipo Record<string, string | undefined>
                // baseado nos campos definidos acima.
                if (credentials?.username === "demo" && credentials?.password === "demo") {
                    logger.debug("[NextAuth Credentials DEBUG] Authorize para Demo User bem-sucedido.");
                    return { id: "demo-123", name: "Demo User", email: "demo@example.com", image: null };
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
            const TAG_SIGNIN = '[NextAuth signIn vFinalMerged]';
            logger.debug(`${TAG_SIGNIN} Iniciado`, { providerAccountIdReceived: authUserFromProvider.id, provider: account?.provider, authUserFromProviderObj: JSON.stringify(authUserFromProvider) });
            
            if (account?.provider === 'credentials') {
                logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials (utilizador: ${authUserFromProvider.id}).`);
                Object.assign(authUserFromProvider, { 
                    isNewUserForOnboarding: false, 
                    onboardingCompletedAt: new Date(), 
                    role: 'user' 
                });
                return true;
            }

            const providerAccountId = authUserFromProvider.id; 
            if (!providerAccountId) { 
                logger.error(`${TAG_SIGNIN} ID do provedor (sub/id) ausente para ${account?.provider}.`);
                return false;
            }
            // account.providerAccountId é o ID único do utilizador no provedor.
            // Para Google, é o 'sub'. Para Facebook, é o 'id' do Facebook.
            // authUserFromProvider.id é mapeado a partir disto na função profile de cada provedor.
            if (!account?.providerAccountId) { 
                logger.error(`${TAG_SIGNIN} account.providerAccountId ausente para ${account?.provider}.`);
                return false;
            }
            
            const currentEmailFromProvider = authUserFromProvider.email;

            try {
                await connectToDatabase();
                let dbUserRecord: IUser | null = null;

                if (account.provider === 'facebook') {
                    const cookieStore = cookies();
                    const linkTokenFromCookie = cookieStore.get(LINK_TOKEN_COOKIE_NAME)?.value;

                    if (linkTokenFromCookie) {
                        logger.info(`${TAG_SIGNIN} [Facebook] linkTokenFromCookie encontrado: ${linkTokenFromCookie}`);
                        dbUserRecord = await DbUser.findOne({ 
                            linkToken: linkTokenFromCookie, 
                            linkTokenExpiresAt: { $gt: new Date() } 
                        });

                        if (dbUserRecord) {
                            logger.info(`${TAG_SIGNIN} [Facebook] Utilizador Data2Content ${dbUserRecord._id} encontrado por linkToken.`);
                            dbUserRecord.linkToken = undefined;
                            dbUserRecord.linkTokenExpiresAt = undefined;
                            cookieStore.delete(LINK_TOKEN_COOKIE_NAME);

                            logger.info(`${TAG_SIGNIN} [Facebook] Vinculando Facebook (ID: ${account.providerAccountId}) ao utilizador Data2Content: ${dbUserRecord._id}`);
                            dbUserRecord.facebookProviderAccountId = account.providerAccountId;
                            // Se o provider principal não for facebook, pode-se manter o provider original ou adicionar a uma lista
                            // dbUserRecord.provider = account.provider; // Comentado para não sobrescrever o provider original
                            if (authUserFromProvider.name && authUserFromProvider.name !== dbUserRecord.name) dbUserRecord.name = authUserFromProvider.name;
                            if (authUserFromProvider.image && authUserFromProvider.image !== dbUserRecord.image) dbUserRecord.image = authUserFromProvider.image;
                            if (!dbUserRecord.email && currentEmailFromProvider) dbUserRecord.email = currentEmailFromProvider;
                            
                            await dbUserRecord.save();
                            logger.info(`${TAG_SIGNIN} [Facebook] Utilizador Data2Content ${dbUserRecord._id} atualizado com dados do Facebook.`);
                        } else {
                            logger.warn(`${TAG_SIGNIN} [Facebook] linkToken (${linkTokenFromCookie}) inválido/expirado. Vinculação falhou.`);
                            cookieStore.delete(LINK_TOKEN_COOKIE_NAME);
                            return false; 
                        }
                    } else {
                        logger.warn(`${TAG_SIGNIN} [Facebook] Nenhum linkToken encontrado para vinculação. Vinculação falhou.`);
                        return false; 
                    }
                } else if (account.provider === 'google') {
                    dbUserRecord = await DbUser.findOne({ provider: account.provider, providerAccountId: providerAccountId }).exec();
                    
                    if (!dbUserRecord && currentEmailFromProvider) {
                        const userByEmail = await DbUser.findOne({ email: currentEmailFromProvider }).exec();
                        if (userByEmail) {
                            logger.info(`${TAG_SIGNIN} [Google] Utilizador Data2Content existente encontrado por email (${currentEmailFromProvider}). Vinculando Google.`);
                            dbUserRecord = userByEmail;
                            dbUserRecord.provider = account.provider; 
                            dbUserRecord.providerAccountId = providerAccountId; 
                            if (authUserFromProvider.name && authUserFromProvider.name !== dbUserRecord.name) dbUserRecord.name = authUserFromProvider.name;
                            if (authUserFromProvider.image && authUserFromProvider.image !== dbUserRecord.image) dbUserRecord.image = authUserFromProvider.image;
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
                            name: authUserFromProvider.name, email: currentEmailFromProvider, image: authUserFromProvider.image,
                            provider: account.provider, providerAccountId: providerAccountId, 
                            role: 'user', isNewUserForOnboarding: true, onboardingCompletedAt: null,
                            communityInspirationOptIn: true, communityInspirationOptInDate: new Date(),
                            communityInspirationTermsVersion: DEFAULT_TERMS_VERSION, isInstagramConnected: false,
                        });
                        dbUserRecord = await newUserInDb.save();
                        logger.info(`${TAG_SIGNIN} [Google] Novo utilizador Data2Content CRIADO com _id: '${dbUserRecord._id}'.`);
                    }
                }

                if (dbUserRecord) {
                    Object.assign(authUserFromProvider, {
                        id: dbUserRecord._id.toString(), 
                        name: dbUserRecord.name,
                        email: dbUserRecord.email,
                        image: dbUserRecord.image, 
                        role: dbUserRecord.role,
                        isNewUserForOnboarding: dbUserRecord.isNewUserForOnboarding,
                        onboardingCompletedAt: dbUserRecord.onboardingCompletedAt,
                        isInstagramConnected: dbUserRecord.isInstagramConnected,
                        provider: dbUserRecord.provider, 
                    });
                    logger.debug(`${TAG_SIGNIN} [${account.provider}] FINAL signIn. authUser.id: '${authUserFromProvider.id}', isNewUser: ${authUserFromProvider.isNewUserForOnboarding}, isInstaConn: ${authUserFromProvider.isInstagramConnected}`);
                    return true;
                } else {
                    logger.error(`${TAG_SIGNIN} [${account.provider}] Não foi possível encontrar, vincular ou criar utilizador Data2Content. Falha no signIn.`);
                    return false;
                }

            } catch (error) {
                 logger.error(`${TAG_SIGNIN} Erro no DB durante signIn para ${account?.provider} (ID: ${account?.providerAccountId}):`, error);
                 return false;
            }
        },

        async jwt({ token, user: userFromSignIn, account, trigger }) {
            const TAG_JWT = '[NextAuth JWT vFinalMerged]';
            logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. UserID(signIn): ${userFromSignIn?.id}. TokenInID: ${token?.id}`);

            if ((trigger === 'signIn' || trigger === 'signUp') && userFromSignIn) {
                token.id = userFromSignIn.id; 
                token.sub = userFromSignIn.id;
                token.name = userFromSignIn.name;
                token.email = userFromSignIn.email;
                token.image = userFromSignIn.image;
                token.role = (userFromSignIn as any).role ?? 'user';
                token.provider = account?.provider ?? token.provider;
                token.isNewUserForOnboarding = (userFromSignIn as any).isNewUserForOnboarding;
                token.onboardingCompletedAt = (userFromSignIn as any).onboardingCompletedAt;
                token.isInstagramConnected = (userFromSignIn as any).isInstagramConnected;
                logger.info(`${TAG_JWT} Token populado de userFromSignIn. ID: ${token.id}, isNewUser: ${token.isNewUserForOnboarding}, isInstaConn: ${token.isInstagramConnected}`);
            }

            if (token.id && Types.ObjectId.isValid(token.id)) {
                if (trigger === 'update' || !token.role || typeof token.isNewUserForOnboarding === 'undefined' || typeof token.isInstagramConnected === 'undefined') {
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(token.id)
                            .select('name email image role provider isNewUserForOnboarding onboardingCompletedAt isInstagramConnected')
                            .lean();
                        if (dbUser) {
                            token.name = dbUser.name ?? token.name;
                            token.email = dbUser.email ?? token.email;
                            token.image = dbUser.image ?? token.image;
                            token.role = dbUser.role ?? token.role ?? 'user';
                            token.provider = dbUser.provider ?? token.provider;
                            token.isNewUserForOnboarding = dbUser.isNewUserForOnboarding ?? false;
                            token.onboardingCompletedAt = dbUser.onboardingCompletedAt ?? null;
                            token.isInstagramConnected = dbUser.isInstagramConnected ?? false;
                            logger.info(`${TAG_JWT} Token enriquecido do DB. ID: ${token.id}, isNewUser: ${token.isNewUserForOnboarding}, isInstaConn: ${token.isInstagramConnected}`);
                        } else {
                            logger.warn(`${TAG_JWT} Utilizador ${token.id} não encontrado no DB. Invalidando token.`);
                            return {} as JWT; 
                        }
                    } catch (error) {
                        logger.error(`${TAG_JWT} Erro ao buscar dados do DB para token ${token.id}:`, error);
                    }
                }
            } else {
                if (!(trigger === 'signIn' || trigger === 'signUp')) {
                    logger.warn(`${TAG_JWT} Token com ID inválido ('${token.id}') fora do login. Invalidando.`);
                    return {} as JWT;
                }
                logger.error(`${TAG_JWT} Token com ID inválido ('${token.id}') DURANTE login. signIn falhou.`);
                return {} as JWT;
            }
            
            if (token.onboardingCompletedAt instanceof Date) {
                token.onboardingCompletedAt = token.onboardingCompletedAt.toISOString() as any;
            }
            delete (token as any).picture;

            logger.debug(`${TAG_JWT} FINAL jwt. Token id: '${token.id}', isNewUser: ${token.isNewUserForOnboarding}, isInstaConn: ${token.isInstagramConnected}`);
            return token;
        },

        async session({ session, token }) {
             const TAG_SESSION = '[NextAuth Session vFinalMerged]';
             logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token isNewUser: ${token?.isNewUserForOnboarding}, Token isInstaConn: ${token?.isInstagramConnected}`);

             if (!token?.id || !Types.ObjectId.isValid(token.id)) {
                 logger.error(`${TAG_SESSION} Token ID inválido ('${token?.id}'). Sessão vazia.`);
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
                 planStatus: undefined, 
                 planExpiresAt: undefined,
                 affiliateCode: undefined,
                 instagramAccountId: undefined,
                 instagramUsername: undefined,
             };
             
             try {
                 await connectToDatabase();
                 const dbUser = await DbUser.findById(token.id)
                     .select('planStatus planExpiresAt affiliateCode instagramAccountId username') 
                     .lean();
                 if (dbUser && session.user) {
                     session.user.planStatus = dbUser.planStatus ?? 'inactive';
                     session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date ? dbUser.planExpiresAt.toISOString() : null;
                     session.user.affiliateCode = dbUser.affiliateCode ?? undefined;
                     session.user.instagramAccountId = dbUser.instagramAccountId ?? undefined;
                     session.user.instagramUsername = dbUser.username ?? undefined;
                 } else if (!dbUser) {
                     logger.warn(`${TAG_SESSION} Utilizador ${token.id} não encontrado no DB ao buscar dados para sessão.`);
                 }
             } catch (error) {
                  logger.error(`${TAG_SESSION} Erro ao buscar dados adicionais para sessão ${token.id}:`, error);
             }
             logger.debug(`${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, isNewUser: ${session.user?.isNewUserForOnboarding}, isInstaConn: ${session.user?.isInstagramConnected}`);
             return session;
         },

        async redirect({ url, baseUrl }) {
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
