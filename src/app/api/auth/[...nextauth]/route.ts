// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Importa o modelo atualizado
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";

// --- ADICIONADO PARA VERIFICAR NEXTAUTH_URL ---
console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
// --------------------------------------------

export const runtime = "nodejs";

// --- Interfaces (mantidas) ---
interface SignInCallback { user: User & { id?: string }; account: Account | null; }
interface JwtCallback { token: JWT; user?: User | AdapterUser; account?: Account | null; profile?: any; }
interface RedirectCallback { baseUrl: string; }

// --- Função customEncode RESTAURADA ---
/**
 * Custom encode (HS256) para JWT.
 */
async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    // Calcula o tempo de expiração em segundos desde a epoch
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60); // Default 30 days
    // Cria e assina o JWT usando 'jose'
    return await new SignJWT({ ...token })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt() // Define o tempo de emissão
        .setExpirationTime(expirationTime) // Define o tempo de expiração
        .sign(new TextEncoder().encode(secretString)); // Assina com o segredo
}

// --- Função customDecode RESTAURADA ---
/**
 * Custom decode (HS256) para JWT com logs adicionais.
 */
async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
    if (!token || !secret) {
        logger.error("customDecode: Token ou secret não fornecidos.");
        return null;
    }
    const secretString = typeof secret === "string" ? secret : String(secret);
    try {
        // Log removido para evitar log excessivo de tokens
        // logger.debug("customDecode: Iniciando decodificação do token:", token.substring(0, 10) + "...");
        // Verifica e decodifica o token usando 'jose'
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString), {
            algorithms: ["HS256"], // Especifica o algoritmo esperado
        });
        // Log removido para evitar log excessivo de tokens decodificados
        // logger.debug("customDecode: Token decodificado com sucesso.");
        return payload as JWT; // Retorna o payload (conteúdo do token)
    } catch (err) {
        // Loga erros comuns como token expirado ou assinatura inválida
        logger.error("customDecode: Erro ao decodificar token:", err instanceof Error ? err.message : err);
        return null; // Retorna null se a decodificação falhar
    }
}

// --- FUNÇÃO HELPER: Obter LLAT e ID do Instagram (mantida) ---
/**
 * Troca o SLAT por LLAT, busca páginas do FB e encontra o ID da conta IG vinculada.
 * Salva o LLAT e o ID IG no banco de dados do usuário.
 */
async function getFacebookLongLivedTokenAndIgId(
    shortLivedToken: string,
    userId: string // ID do usuário no SEU banco de dados
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

        // 2. Buscar Páginas do Facebook conectadas
        logger.debug(`${TAG} Buscando páginas do Facebook para User ${userId}...`);
        const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`);
        const pagesData = await pagesResponse.json();

        if (!pagesResponse.ok || !pagesData.data) {
            logger.error(`${TAG} Erro ao buscar páginas do Facebook:`, pagesData);
            return { success: false, error: pagesData.error?.message || 'Falha ao buscar páginas do Facebook.' };
        }

        // 3. Encontrar a Conta do Instagram vinculada
        let instagramAccountId: string | null = null;
        logger.debug(`${TAG} Procurando conta Instagram vinculada entre ${pagesData.data.length} páginas...`);
        for (const page of pagesData.data) {
            const pageId = page.id;
            // Adiciona tratamento de erro para a chamada da API do Instagram
            try {
                const igResponse = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${longLivedToken}`);
                const igData = await igResponse.json();

                if (igResponse.ok && igData.instagram_business_account) {
                    instagramAccountId = igData.instagram_business_account.id;
                    logger.info(`${TAG} Conta Instagram encontrada para User ${userId}: ${instagramAccountId} (vinculada à Página FB ${pageId})`);
                    break; // Para após encontrar a primeira conta IG
                } else if (!igResponse.ok) {
                     logger.warn(`${TAG} Erro ao buscar conta IG para a página ${pageId}:`, igData);
                }
            } catch (pageError) {
                 logger.error(`${TAG} Erro de rede ou inesperado ao buscar conta IG para página ${pageId}:`, pageError);
            }
        }

        if (!instagramAccountId) {
            logger.warn(`${TAG} Nenhuma conta profissional do Instagram encontrada vinculada às páginas do Facebook para User ${userId}. O usuário pode precisar conectar a conta IG à página FB.`);
            // Não retorna erro, apenas salva o token sem o ID IG
        }

        // 4. Salvar LLAT e ID do Instagram no Banco de Dados
        logger.debug(`${TAG} Atualizando usuário ${userId} no DB com LLAT e ID IG...`);
        await connectToDatabase(); // Garante conexão
        const updateResult = await DbUser.findByIdAndUpdate(userId, {
            $set: { // Usa $set para garantir que apenas esses campos sejam atualizados
               instagramAccessToken: longLivedToken,
               instagramAccountId: instagramAccountId, // Salva null se não encontrado
            }
        }, { new: true }); // { new: true } é opcional, retorna o doc atualizado

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


/**
 * Configurações do NextAuth.
 */
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
    encode: customEncode, // Usa a função restaurada
    decode: customDecode, // Usa a função restaurada
  },
  callbacks: {
    async signIn({ user, account }: SignInCallback): Promise<boolean> {
      const TAG_SIGNIN = '[NextAuth signIn Callback]';
      logger.debug(`${TAG_SIGNIN} Iniciado`, { userId: user.id, provider: account?.provider });

      if (account?.provider === "google" || account?.provider === "facebook") {
        if (!user.email) {
             logger.error(`${TAG_SIGNIN} Email do ${account.provider} não encontrado.`);
             return false; // Impede login se não houver email
        }
        try {
          await connectToDatabase();
          let existingUser = await DbUser.findOne({ email: user.email }).exec();

          if (!existingUser) {
            logger.debug(`${TAG_SIGNIN} Criando novo usuário (${account.provider}) para email:`, user.email);
            const newUser = new DbUser({
              name: user.name, email: user.email, image: user.image,
              provider: account.provider, providerAccountId: account.providerAccountId,
              role: "user", planStatus: "inactive", planExpiresAt: null,
              affiliateBalance: 0, affiliateRank: 1, affiliateInvites: 0,
            });
            existingUser = await newUser.save();
            user.id = existingUser._id.toString(); // Atualiza o ID do usuário da sessão
            logger.debug(`${TAG_SIGNIN} Novo usuário (${account.provider}) criado: ${user.id}`);

          } else {
            logger.debug(`${TAG_SIGNIN} Usuário (${account.provider}) já existe: ${existingUser._id}`);
            user.id = existingUser._id.toString(); // Garante que o ID do DB está na sessão

             let needsSave = false;
             // Atualiza dados que podem mudar
             if (user.name && user.name !== existingUser.name) { existingUser.name = user.name; needsSave = true; }
             if (user.image && user.image !== existingUser.image) { existingUser.image = user.image; needsSave = true; }
             if (account.providerAccountId && account.providerAccountId !== existingUser.providerAccountId) {
                 existingUser.providerAccountId = account.providerAccountId;
                 existingUser.provider = account.provider;
                 needsSave = true;
             }
             // Inicializa campos de afiliado se necessário (mantido)
             if (existingUser.affiliateBalance === undefined || existingUser.affiliateBalance === null) { existingUser.affiliateBalance = 0; needsSave = true; }
             if (existingUser.affiliateRank === undefined || existingUser.affiliateRank === null) { existingUser.affiliateRank = 1; needsSave = true; }
             if (existingUser.affiliateInvites === undefined || existingUser.affiliateInvites === null) { existingUser.affiliateInvites = 0; needsSave = true; }
             if (!existingUser.affiliateCode) { logger.warn(`${TAG_SIGNIN} Usuário existente sem affiliateCode.`); needsSave = true; } // Gera no save

            if (needsSave) {
                await existingUser.save();
                logger.debug(`${TAG_SIGNIN} Dados do usuário (${account.provider}) atualizados/verificados.`);
            }
          }
        } catch (error) {
          logger.error(`${TAG_SIGNIN} Erro (${account.provider}) ao interagir com o banco:`, error);
          return false; // Impede login em caso de erro no DB
        }
      } else if (account?.provider === "credentials") {
         // Lógica para Credentials (mantida e simplificada)
         if (!user?.id) { logger.error(`${TAG_SIGNIN} Usuário de Credentials sem ID.`); return false; }
         // Não precisa buscar no DB aqui se não for inicializar nada específico
      }

      if (!user?.id) { logger.error(`${TAG_SIGNIN} user.id não definido no final.`); return false; }
      logger.debug(`${TAG_SIGNIN} Finalizado com sucesso para User ${user.id}`);
      return true; // Permite o login
    },

    async jwt({ token, user, account, profile }: JwtCallback): Promise<JWT> {
        const TAG_JWT = '[NextAuth JWT Callback]';
        logger.debug(`${TAG_JWT} Iniciado`, { userId: user?.id, accountProvider: account?.provider });

        // Na primeira vez (login) ou quando há uma conta
        if (account && user?.id) {
            token.id = user.id;
            token.provider = account.provider; // Adiciona o provider ao token JWT

            if (account.provider === 'facebook' && account.access_token) {
                logger.info(`${TAG_JWT} Login via Facebook para User ${user.id}. Iniciando processamento assíncrono de token/IG ID...`);
                // Chama a função helper em background (não bloqueia)
                getFacebookLongLivedTokenAndIgId(account.access_token, user.id)
                    .then(result => {
                        if (!result.success) { logger.error(`${TAG_JWT} Falha assíncrona ao processar dados do Facebook para User ${user.id}: ${result.error}`); }
                        else { logger.info(`${TAG_JWT} Processamento assíncrono de dados do Facebook concluído para User ${user.id}.`); }
                    })
                    .catch(error => { logger.error(`${TAG_JWT} Erro não capturado em getFacebookLongLivedTokenAndIgId (async) para User ${user.id}:`, error); });
            } else if (account.provider === 'google') {
                 logger.debug(`${TAG_JWT} Login via Google para User ${user.id}.`);
                 // Não guarda token do Google no JWT por padrão
            }
        }

        // Adiciona/atualiza a role no token (mantido)
        if (token.id && !token.role) {
             try {
                await connectToDatabase();
                const dbUser = await DbUser.findById(token.id).select('role').lean();
                if (dbUser) { token.role = dbUser.role; logger.debug(`${TAG_JWT} Role '${dbUser.role}' adicionada/confirmada no token para User ${token.id}`); }
             } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar role para User ${token.id} no callback JWT:`, error); }
        }

        logger.debug(`${TAG_JWT} Finalizado`, { tokenId: token.id, provider: token.provider });
        return token;
    },

    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      const TAG_SESSION = '[NextAuth Session Callback]';
      logger.debug(`${TAG_SESSION} Iniciado`, { tokenId: token.id });

      // Atribui dados básicos do token à sessão
      if (token.id && session.user) {
          session.user.id = token.id as string;
          // --- CORREÇÃO APLICADA AQUI ---
          // Atribui o provider DENTRO do objeto session.user, não na raiz da session
          session.user.provider = token.provider as string;
          // -----------------------------
          logger.debug(`${TAG_SESSION} Provider '${token.provider}' atribuído a session.user para User ${token.id}`);
      } else {
          logger.error(`${TAG_SESSION} Erro: token.id ou session.user inicial ausente.`);
          session.user = undefined; // Limpa o usuário da sessão
          return session;
      }

      // Busca no DB para dados atualizados
      try {
        await connectToDatabase();
        // Seleciona explicitamente os campos necessários + os novos campos do Instagram
        const dbUser = await DbUser.findById(token.id)
                                   .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites instagramAccountId')
                                   .lean();

        if (dbUser && session.user) {
          logger.debug(`${TAG_SESSION} Usuário encontrado no DB para sessão:`, dbUser._id);
          // Atribui os dados do DB para a sessão (mantido e verificado)
          session.user.name = dbUser.name ?? session.user.name;
          session.user.email = dbUser.email ?? session.user.email;
          session.user.image = dbUser.image ?? session.user.image;
          session.user.role = dbUser.role ?? 'user';
          session.user.planStatus = dbUser.planStatus ?? 'inactive';
          session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date ? dbUser.planExpiresAt.toISOString() : null;
          session.user.affiliateCode = dbUser.affiliateCode ?? undefined;
          session.user.affiliateBalance = dbUser.affiliateBalance ?? 0;
          session.user.affiliateRank = dbUser.affiliateRank ?? 1;
          session.user.affiliateInvites = dbUser.affiliateInvites ?? 0;
          // Status de conexão com Instagram
          session.user.instagramConnected = !!dbUser.instagramAccountId; // Define baseado na existência do ID
          logger.debug(`${TAG_SESSION} Status conexão Instagram para User ${token.id}: ${session.user.instagramConnected}`);

        } else if (session.user) {
           logger.error(`${TAG_SESSION} Usuário não encontrado no DB para id: ${token.id}. Sessão pode ficar incompleta.`);
           // Não limpa mais os campos padrão, apenas os customizados que não vieram do token
           if (session.user) {
               delete session.user.role;
               delete session.user.planStatus;
               delete session.user.planExpiresAt;
               delete session.user.affiliateCode;
               delete session.user.affiliateBalance;
               delete session.user.affiliateRank;
               delete session.user.affiliateInvites;
               delete session.user.instagramConnected;
               // Não deleta session.user.provider pois ele vem do token
           }
        }
      } catch (error) {
        logger.error(`${TAG_SESSION} Erro ao buscar/processar dados do usuário na sessão:`, error);
      }

      logger.debug(`${TAG_SESSION} Finalizado`, session.user);
      return session;
    },

    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // debug: process.env.NODE_ENV === 'development',
};

// Exporta o handler do NextAuth
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// --- ATUALIZAÇÃO FINAL: Definição de Tipos ---
// Lembre-se de atualizar `types/next-auth.d.ts` para incluir `provider?: string;`
// e `instagramConnected?: boolean;` na interface Session.user
