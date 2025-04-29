// src/app/api/auth/[...nextauth]/route.ts (Completo - Restaurado Encode/Decode + Vinculação v2)
import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Importa o modelo atualizado com facebookProviderAccountId
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";

// Remova esta linha após a depuração
// console.log("--- DEBUG --- NEXTAUTH_SECRET:", process.env.NEXTAUTH_SECRET ? process.env.NEXTAUTH_SECRET.substring(0, 5) + "..." : "NÃO DEFINIDA");

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

interface SignInCallback { user: User & { id?: string }; account: Account | null; }
interface JwtCallback { token: JWT; user?: User | AdapterUser; account?: Account | null; profile?: any; trigger?: "signIn" | "signUp" | "update" | undefined; }
interface RedirectCallback { baseUrl: string; }


// --- Função customEncode RESTAURADA ---
async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    // logger.debug("customEncode: Codificando token:", JSON.stringify(token)); // Log opcional
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
    return await new SignJWT({ ...token })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expirationTime)
        .sign(new TextEncoder().encode(secretString));
}

// --- Função customDecode RESTAURADA ---
async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
    if (!token || !secret) {
        logger.error("customDecode: Token ou secret não fornecidos.");
        return null;
    }
    const secretString = typeof secret === "string" ? secret : String(secret);
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString), {
            algorithms: ["HS256"],
        });
        // logger.debug("customDecode: Token decodificado com sucesso. Payload:", JSON.stringify(payload)); // Log opcional
        return payload as JWT;
    } catch (err) {
        logger.error(`customDecode: Erro ao decodificar token HS256: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}


// --- FUNÇÃO HELPER: Obter LLAT e ID do Instagram (Completa) ---
async function getFacebookLongLivedTokenAndIgId(
    shortLivedToken: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const TAG = '[getFacebookLongLivedTokenAndIgId]';
    const FB_APP_ID = process.env.FACEBOOK_CLIENT_ID;
    const FB_APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET;

    if (!FB_APP_ID || !FB_APP_SECRET) {
        logger.error(`${TAG} Variáveis de ambiente FACEBOOK_CLIENT_ID ou FACEBOOK_CLIENT_SECRET não definidas.`);
        return { success: false, error: 'Configuração do servidor incompleta.' };
     }

    try {
        // 1. Trocar SLAT por LLAT
        logger.debug(`${TAG} Trocando SLAT por LLAT para User ${userId}...`);
        const llatResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortLivedToken}`);
        const llatData = await llatResponse.json();
        if (!llatResponse.ok || !llatData.access_token) {
            logger.error(`${TAG} Erro ao obter LLAT:`, llatData);
            return { success: false, error: llatData.error?.message || 'Falha ao obter token de longa duração.' };
        }
        const longLivedToken = llatData.access_token;
        logger.debug(`${TAG} LLAT obtido com sucesso para User ${userId}.`);

        // 2. Buscar Páginas do Facebook
        logger.debug(`${TAG} Buscando páginas do Facebook para User ${userId}...`);
        const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`);
        const pagesData = await pagesResponse.json();
         if (!pagesResponse.ok || !pagesData.data) {
            logger.error(`${TAG} Erro ao buscar páginas do Facebook:`, pagesData);
            return { success: false, error: pagesData.error?.message || 'Falha ao buscar páginas do Facebook.' };
         }
        logger.debug(`${TAG} Encontradas ${pagesData.data.length} páginas.`);

        // 3. Encontrar a Conta do Instagram vinculada
        let instagramAccountId: string | null = null;
        logger.debug(`${TAG} Procurando conta Instagram vinculada...`);
        for (const page of pagesData.data) {
             const pageId = page.id;
             try {
                 const igResponse = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${longLivedToken}`);
                 const igData = await igResponse.json();
                 if (igResponse.ok && igData.instagram_business_account) {
                     instagramAccountId = igData.instagram_business_account.id;
                     logger.info(`${TAG} Conta Instagram encontrada para User ${userId}: ${instagramAccountId} (vinculada à Página FB ${pageId})`);
                     break;
                 } else if (!igResponse.ok) {
                      logger.warn(`${TAG} Erro ao buscar conta IG para a página ${pageId}:`, igData);
                 }
             } catch (pageError) {
                  logger.error(`${TAG} Erro de rede ou inesperado ao buscar conta IG para página ${pageId}:`, pageError);
             }
        }
        if (!instagramAccountId) { logger.warn(`${TAG} Nenhuma conta IG encontrada.`); }

        // 4. Salvar LLAT e ID do Instagram no Banco de Dados
        logger.debug(`${TAG} Atualizando usuário ${userId} no DB com LLAT e ID IG...`);
        await connectToDatabase();
        const updateResult = await DbUser.findByIdAndUpdate(userId, {
            $set: {
               instagramAccessToken: longLivedToken,
               instagramAccountId: instagramAccountId,
               isInstagramConnected: !!instagramAccountId
            }
        }, { new: true });

        if (!updateResult) {
            logger.error(`${TAG} Usuário ${userId} não encontrado no DB para atualização.`);
            return { success: false, error: 'Usuário não encontrado no banco de dados.' };
         }

        logger.info(`${TAG} Usuário ${userId} atualizado com sucesso com dados do Instagram.`);
        return { success: true };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro inesperado no processo:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Erro interno: ${message}` };
     }
}
// --- FIM FUNÇÃO HELPER ---

export const authOptions: NextAuthOptions = {
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined, secure: process.env.NODE_ENV === "production" },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: { sameSite: "lax", path: "/", domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined, secure: process.env.NODE_ENV === "production" },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined, secure: process.env.NODE_ENV === "production" },
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile" } },
      profile(profile) {
        logger.debug("NextAuth: Google profile returned:", profile);
        return { id: profile.sub, name: profile.name, email: profile.email, image: profile.picture };
      },
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'email', 'public_profile', 'pages_show_list',
            'pages_read_engagement', 'instagram_basic',
            'instagram_manage_insights', 'instagram_manage_comments',
          ].join(','),
        },
      },
    }),
    CredentialsProvider({
      name: "Demo",
      credentials: { username: { label: "Usuário", type: "text", placeholder: "demo" }, password: { label: "Senha", type: "password", placeholder: "demo" } },
      async authorize(credentials) {
        if (credentials?.username === "demo" && credentials?.password === "demo") {
          return { id: "demo-123", name: "Demo User", email: "demo@example.com" } as User;
        }
        return null;
      },
    }),
  ],
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    encode: customEncode,
    decode: customDecode,
  },
  callbacks: {
    // <<< CALLBACK SIGNIN (Corrigido para não criar user FB indevidamente) >>>
    async signIn({ user, account, profile }: { user: User & { id?: string }, account: Account | null, profile?: any }): Promise<boolean> {
        const TAG_SIGNIN = '[NextAuth signIn Callback]';
        logger.debug(`${TAG_SIGNIN} Iniciado`, { userId: user.id, provider: account?.provider, email: user.email });

        if (!account || !user.email) {
            logger.error(`${TAG_SIGNIN} Account ou User Email ausente.`);
            return false;
        }

        if (account.provider === "credentials") {
            if (!user?.id) { logger.error(`${TAG_SIGNIN} Usuário de Credentials sem ID.`); return false; }
            logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials para User ${user.id}`);
            return true;
         }

        if (account.provider === "google" || account.provider === "facebook") {
            try {
                await connectToDatabase();
                let existingUser: IUser | null = null;

                // 1. Tentar encontrar por Provider ID específico
                let query: any = {};
                 if (account.provider === 'facebook' && account.providerAccountId) {
                    query = { facebookProviderAccountId: account.providerAccountId };
                    logger.debug(`${TAG_SIGNIN} Tentando encontrar por facebookProviderAccountId: ${account.providerAccountId}`);
                    existingUser = await DbUser.findOne(query).exec();
                } else if (account.provider === 'google' && account.providerAccountId) {
                    query = { providerAccountId: account.providerAccountId, provider: 'google' };
                     logger.debug(`${TAG_SIGNIN} Tentando encontrar por providerAccountId (Google): ${account.providerAccountId}`);
                    existingUser = await DbUser.findOne(query).exec();
                }

                // 2. Se não encontrou por Provider ID, tentar por Email
                if (!existingUser) {
                    logger.debug(`${TAG_SIGNIN} Não encontrado por Provider ID, tentando por email: ${user.email}`);
                    query = { email: user.email };
                    existingUser = await DbUser.findOne(query).exec();
                }

                // 3. Processar resultado
                if (existingUser) {
                    // UTILIZADOR EXISTENTE ENCONTRADO (por ID do provider ou por email)
                    logger.debug(`${TAG_SIGNIN} Usuário existente encontrado (query: ${JSON.stringify(query)}) para ${account.provider}. ID: ${existingUser._id}`);
                    user.id = existingUser._id.toString(); // Passa o ID correto para o JWT

                    // Atualiza dados / Vincula conta FB se necessário
                    let needsSave = false;
                    if (user.name && user.name !== existingUser.name) { existingUser.name = user.name; needsSave = true; } // Atualiza nome
                    if (user.image && user.image !== existingUser.image) { existingUser.image = user.image; needsSave = true; } // Atualiza imagem

                    if (account.provider === 'facebook' && existingUser.facebookProviderAccountId !== account.providerAccountId) {
                        logger.info(`${TAG_SIGNIN} Vinculando/Atualizando facebookProviderAccountId para ${account.providerAccountId} no User ${existingUser._id}`);
                        existingUser.facebookProviderAccountId = account.providerAccountId;
                        needsSave = true;
                    }
                    else if (account.provider === 'google' && existingUser.providerAccountId !== account.providerAccountId) {
                         logger.info(`${TAG_SIGNIN} Vinculando/Atualizando providerAccountId (Google) para ${account.providerAccountId} no User ${existingUser._id}`);
                         existingUser.providerAccountId = account.providerAccountId;
                         if (!existingUser.provider) existingUser.provider = 'google';
                         needsSave = true;
                    }
                     if (existingUser.isInstagramConnected === undefined) {
                         existingUser.isInstagramConnected = !!existingUser.instagramAccountId;
                         needsSave = true;
                     }

                    if (needsSave) { await existingUser.save(); logger.debug(`${TAG_SIGNIN} Dados do usuário existente atualizados/vinculados.`); }
                    return true; // Permite o login

                } else {
                    // UTILIZADOR NÃO ENCONTRADO
                    // Se for Google, cria um novo utilizador
                    if (account.provider === 'google') {
                        logger.debug(`${TAG_SIGNIN} Criando novo usuário (Google) para email:`, user.email);
                        const newUser = new DbUser({
                            name: user.name, email: user.email, image: user.image,
                            provider: account.provider,
                            providerAccountId: account.providerAccountId, // Google ID
                            facebookProviderAccountId: null,
                            role: "user", planStatus: "inactive", planExpiresAt: null,
                            affiliateBalance: 0, affiliateRank: 1, affiliateInvites: 0,
                            isInstagramConnected: false,
                         });
                        const savedUser = await newUser.save();
                        user.id = savedUser._id.toString(); // Passa o ID do NOVO utilizador para JWT
                        logger.debug(`${TAG_SIGNIN} Novo usuário (Google) criado: ${user.id}`);
                        return true; // Permite o login
                    }
                    // Se for Facebook e NÃO encontrou, NÃO cria aqui.
                    else if (account.provider === 'facebook') {
                         logger.debug(`${TAG_SIGNIN} Utilizador não encontrado para Facebook. Permitindo fluxo para JWT (possível vinculação).`);
                         user.id = profile?.id ?? user.id;
                         if (!user.id && account.providerAccountId) {
                             user.id = account.providerAccountId;
                             logger.warn(`${TAG_SIGNIN} Usando providerAccountId como user.id para Facebook.`);
                         }
                         if (!user.id) {
                             logger.error(`${TAG_SIGNIN} Não foi possível determinar um ID para o novo utilizador/vinculação do Facebook.`);
                             return false;
                         }
                         logger.debug(`${TAG_SIGNIN} Passando user.id=${user.id} (do perfil/provider FB) para JWT.`);
                         return true; // Permite continuar para o JWT
                    }
                }
            } catch (error) {
                logger.error(`${TAG_SIGNIN} Erro (${account.provider}) ao interagir com o banco:`, error);
                return false;
            }
        }

        logger.warn(`${TAG_SIGNIN} Provider não suportado ou fluxo inesperado.`);
        return false;
    },

    // <<< CALLBACK JWT (Mantido da versão anterior - com lógica de vinculação) >>>
    async jwt({ token, user, account, profile, trigger }: JwtCallback): Promise<JWT> {
        const TAG_JWT = '[NextAuth JWT Callback]';
        logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Account Provider: ${account?.provider}. Token recebido:`, JSON.stringify(token));
        logger.debug(`${TAG_JWT} User ID (entrada): ${user?.id}`);

        const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';
        const existingTokenId = token.id; // ID da sessão existente (se houver)

        // 1. Evento de Login/Conexão Inicial (account existe)
        if (isSignInOrSignUp && account && user?.id) { // user.id agora vem do signIn
            // Se for login/conexão via Facebook
            if (account.provider === 'facebook') {
                // Cenário de Vinculação: Usuário já estava logado (existingTokenId existe)
                // E o login atual é Facebook, E o provider da sessão NÃO é Facebook
                if (existingTokenId && token.provider !== 'facebook') {
                    logger.info(`${TAG_JWT} Vinculando Facebook (${account.providerAccountId}) à conta existente ${existingTokenId} (provider original: ${token.provider})`);
                    const userIdToUse = existingTokenId as string; // ID da conta Google

                    try {
                        await connectToDatabase();
                        // Verifica se a conta FB já está vinculada a OUTRO utilizador
                        const userWithThisFbId = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId });
                        if (userWithThisFbId && userWithThisFbId._id.toString() !== userIdToUse) {
                            logger.error(`${TAG_JWT} Esta conta do Facebook (${account.providerAccountId}) já está vinculada a outro usuário (${userWithThisFbId._id}). Vinculação cancelada.`);
                            token.error = "fb_already_linked";
                            token.id = userIdToUse; // Mantém ID original
                            return token;
                        }

                        // Atualiza o utilizador existente para vincular o FB ID
                        const updatedUser = await DbUser.findByIdAndUpdate(userIdToUse, {
                            $set: { facebookProviderAccountId: account.providerAccountId }
                        }, { new: true });

                        if (updatedUser) {
                            logger.info(`${TAG_JWT} Conta Facebook vinculada com sucesso ao User ${userIdToUse}.`);
                            if (account.access_token) { getFacebookLongLivedTokenAndIgId(account.access_token, userIdToUse); }
                            token.id = userIdToUse; // *** Garante ID correto da sessão existente ***
                            // token.provider permanece o original
                        } else {
                             logger.error(`${TAG_JWT} Falha ao vincular Facebook: Usuário existente ${userIdToUse} não encontrado no DB.`);
                             token.error = "link_user_not_found";
                             token.id = userIdToUse; // Mantém ID original
                             return token;
                        }
                    } catch (error) {
                         logger.error(`${TAG_JWT} Erro ao vincular conta Facebook no DB para User ${userIdToUse}:`, error);
                         token.error = "link_db_error";
                         token.id = userIdToUse; // Mantém ID original
                         return token;
                    }
                }
                // Cenário de Login Novo com Facebook (sem sessão prévia ou já era Facebook)
                else {
                    logger.debug(`${TAG_JWT} Processando login/conexão inicial com Facebook.`);
                    token.id = user.id; // ID do utilizador (novo ou existente encontrado pelo signIn)
                    token.provider = 'facebook';
                    logger.debug(`${TAG_JWT} Definindo token.id=${token.id}, token.provider=${token.provider}`);
                    if (account.access_token) { getFacebookLongLivedTokenAndIgId(account.access_token, token.id as string); }
                }
            }
            // Se for login/conexão via Google ou Credentials
            else {
                logger.debug(`${TAG_JWT} Processando login inicial com ${account.provider}.`);
                token.id = user.id; // ID do usuário do DB (findOrCreate no signIn)
                token.provider = account.provider;
                logger.debug(`${TAG_JWT} Definindo token.id=${token.id}, token.provider=${token.provider}`);
            }
        }

        // 2. Garante que ID persista em eventos subsequentes
        if (!token.id && user?.id) {
             token.id = user.id;
             logger.warn(`${TAG_JWT} ID recuperado para token em evento subsequente.`);
        } else if (!token.id && !user?.id && existingTokenId) {
            token.id = existingTokenId;
             logger.warn(`${TAG_JWT} ID recuperado do token anterior em evento subsequente.`);
        }


        // 3. Adiciona/Atualiza Role
        const finalUserId = token.id;
        if (finalUserId && (!token.role || isSignInOrSignUp)) {
             try {
                await connectToDatabase();
                const dbUser = await DbUser.findById(finalUserId).select('role').lean();
                if (dbUser) { token.role = dbUser.role; logger.debug(`${TAG_JWT} Role '${token.role}' definida/confirmada no token para User ${finalUserId}`); }
                else { logger.warn(`${TAG_JWT} Usuário ${finalUserId} não encontrado no DB ao buscar role.`); delete token.role; }
             } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar role para User ${finalUserId} no callback JWT:`, error); }
        }

        // Cria um novo objeto de token para retornar
        const returnToken: JWT = { ...token };
        delete returnToken.error;

        logger.debug(`${TAG_JWT} Finalizado. Retornando token:`, JSON.stringify(returnToken));
        return returnToken;
    },

    // <<< CALLBACK SESSION (Mantido como antes) >>>
    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      const TAG_SESSION = '[NextAuth Session Callback]';
      logger.debug(`${TAG_SESSION} Iniciado. Token recebido:`, JSON.stringify(token));

      if (token.id) {
          session.user = {
              id: token.id as string,
              provider: token.provider as string,
              role: token.role as string ?? 'user',
          };
          logger.debug(`${TAG_SESSION} Session.user inicializado com id='${session.user.id}', provider='${session.user.provider}', role='${session.user.role}'`);

          try {
            await connectToDatabase();
            const dbUser = await DbUser.findById(token.id)
                                       .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected')
                                       .lean();

            if (dbUser && session.user) {
              logger.debug(`${TAG_SESSION} Usuário encontrado no DB para sessão:`, dbUser._id);
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
              logger.debug(`${TAG_SESSION} Status conexão Instagram (do DB) para User ${token.id}: ${session.user.instagramConnected}`);

            } else {
               logger.error(`${TAG_SESSION} Usuário ${token.id} não encontrado no DB. Sessão pode estar incompleta.`);
               delete session.user?.planStatus;
               delete session.user?.instagramConnected;
               // ... outros
            }
          } catch (error) {
            logger.error(`${TAG_SESSION} Erro ao buscar/processar dados do usuário na sessão:`, error);
            if(session.user) {
                delete session.user.planStatus;
                delete session.user.instagramConnected;
                // ... etc
            }
          }
      } else {
          logger.error(`${TAG_SESSION} Erro: token.id ausente no token recebido. Retornando sessão vazia.`);
          return { ...session, user: undefined, expires: session.expires };
      }

      logger.debug(`${TAG_SESSION} Finalizado. Retornando session.user:`, JSON.stringify(session.user));
      return session;
    },

    // <<< CALLBACK REDIRECT MANTIDO >>>
    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      return `${baseUrl}/dashboard`;
    },
  },
  pages: { signIn: "/login", error: "/auth/error", },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
