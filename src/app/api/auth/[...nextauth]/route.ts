// src/app/api/auth/[...nextauth]/route.ts (Completo - HS256 + Vinculação v6.6 - Link Token - Correção de Tipo v6)
import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Importa o modelo User atualizado
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import { cookies } from 'next/headers'; // Importar cookies para ler/escrever

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

interface SignInCallback { user: User & { id?: string }; account: Account | null; }
interface JwtCallback { token: JWT; user?: User | AdapterUser; account?: Account | null; profile?: any; trigger?: "signIn" | "signUp" | "update" | undefined; }
interface RedirectCallback { baseUrl: string; }


// --- Função customEncode ---
async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
    // Garante que o token a ser codificado não tenha valores undefined que causem erro na serialização
    const cleanToken = Object.entries(token ?? {}).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, any>);

    return await new SignJWT(cleanToken)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expirationTime)
        .sign(new TextEncoder().encode(secretString));
}

// --- Função customDecode ---
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
        // Garante que o payload retornado está em conformidade com JWT, especialmente 'id'
        if (payload && typeof payload.id !== 'string') {
             payload.id = ''; // Define como string vazia se não for string
        }
        return payload as JWT;
    } catch (err) {
        logger.error(`customDecode: Erro ao decodificar token HS256: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}


// --- FUNÇÃO HELPER: Obter LLAT e ID do Instagram ---
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

        // 3. Encontrar Conta Instagram
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

        // 4. Salvar no DB
        logger.debug(`${TAG} Atualizando usuário ${userId} no DB com LLAT e ID IG...`);
        await connectToDatabase();
        if (!Types.ObjectId.isValid(userId)) {
             logger.error(`${TAG} ID de usuário inválido para atualização no DB: ${userId}`);
             return { success: false, error: 'ID de usuário inválido.' };
        }
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
    // Configuração dos cookies principais de sessão, callback, csrf
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
    // A manipulação do cookie 'auth-link-token' é feita manualmente
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
    async signIn({ user, account, profile }: { user: User & { id?: string }, account: Account | null, profile?: any }): Promise<boolean> {
        const TAG_SIGNIN = '[NextAuth signIn Callback]';
        logger.debug(`${TAG_SIGNIN} Iniciado`, { userId: user.id, provider: account?.provider, email: user.email });

        // Permite login via credentials diretamente
        if (account?.provider === "credentials") {
            if (!user?.id) { logger.error(`${TAG_SIGNIN} Usuário de Credentials sem ID.`); return false; }
            logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials para User ${user.id}`);
            return true;
         }

        // Verifica se temos as informações mínimas para Google ou Facebook
        if (!account || !account.providerAccountId) {
            logger.error(`${TAG_SIGNIN} Informações mínimas ausentes (account, providerAccountId). Provider: ${account?.provider}`);
            return false;
        }
        // Garante que temos um email para processar (seja do user ou profile)
        const currentEmail = user?.email ?? (profile as any)?.email;
        if (!currentEmail && account.provider !== 'facebook') { // Email é opcional para vinculação FB, mas necessário para Google ou novo FB
             logger.error(`${TAG_SIGNIN} Email ausente para ${account.provider}.`);
             return false;
        }


        // Lógica para Google e Facebook
        if (account.provider === "google" || account.provider === "facebook") {
            try {
                await connectToDatabase();
                let existingUser: IUser | null = null;

                // 1. Tentar encontrar por Provider ID específico
                let query: any = {};
                 if (account.provider === 'facebook') {
                    query = { facebookProviderAccountId: account.providerAccountId };
                    logger.debug(`${TAG_SIGNIN} Tentando encontrar por facebookProviderAccountId: ${account.providerAccountId}`);
                    existingUser = await DbUser.findOne(query).exec();
                } else { // provider === 'google'
                    query = { providerAccountId: account.providerAccountId, provider: 'google' };
                     logger.debug(`${TAG_SIGNIN} Tentando encontrar por providerAccountId (Google): ${account.providerAccountId}`);
                    existingUser = await DbUser.findOne(query).exec();
                }

                // 2. Se não encontrou por Provider ID E temos um email, tentar por Email
                if (!existingUser && currentEmail) {
                    logger.debug(`${TAG_SIGNIN} Não encontrado por Provider ID, tentando por email: ${currentEmail}`);
                    query = { email: currentEmail };
                    existingUser = await DbUser.findOne(query).exec();
                }

                // 3. Processar resultado
                if (existingUser) {
                    // Usuário encontrado (pelo ID do provider ou email)
                    logger.debug(`${TAG_SIGNIN} Usuário existente encontrado (query: ${JSON.stringify(query)}) para ${account.provider}. ID: ${existingUser._id}`);
                    user.id = existingUser._id.toString(); // Passa o ID correto do DB para o JWT

                    // Atualiza dados básicos e vincula/atualiza ID do provider se necessário
                    let needsSave = false;
                    // Atualiza nome/imagem se vierem do provider e forem diferentes
                    const providerName = user?.name ?? (profile as any)?.name;
                    const providerImage = user?.image ?? (profile as any)?.picture ?? (profile as any)?.image;
                    if (providerName && providerName !== existingUser.name) { existingUser.name = providerName; needsSave = true; }
                    if (providerImage && providerImage !== existingUser.image) { existingUser.image = providerImage; needsSave = true; }

                    if (account.provider === 'facebook' && existingUser.facebookProviderAccountId !== account.providerAccountId) {
                        logger.info(`${TAG_SIGNIN} Vinculando/Atualizando facebookProviderAccountId para ${account.providerAccountId} no User ${existingUser._id}`);
                        existingUser.facebookProviderAccountId = account.providerAccountId;
                        needsSave = true;
                    } else if (account.provider === 'google' && existingUser.providerAccountId !== account.providerAccountId) {
                         logger.info(`${TAG_SIGNIN} Vinculando/Atualizando providerAccountId (Google) para ${account.providerAccountId} no User ${existingUser._id}`);
                         existingUser.providerAccountId = account.providerAccountId;
                         if (!existingUser.provider) existingUser.provider = 'google'; // Define provider se não existir
                         needsSave = true;
                    }
                    // Garante que isInstagramConnected esteja definido
                     if (existingUser.isInstagramConnected === undefined) {
                         existingUser.isInstagramConnected = !!existingUser.instagramAccountId;
                         needsSave = true;
                     }
                     // Atualiza email se encontrado por ID e email do provider é diferente (cuidado com verificação)
                     if (currentEmail && currentEmail !== existingUser.email && query.email === undefined) {
                         logger.warn(`${TAG_SIGNIN} Email do provider (${currentEmail}) diferente do email existente (${existingUser.email}) para User ${existingUser._id}. Não atualizando email automaticamente.`);
                     }


                    if (needsSave) { await existingUser.save(); logger.debug(`${TAG_SIGNIN} Dados do usuário existente atualizados/vinculados.`); }
                    return true; // Permite o login/vinculação

                } else {
                    // Usuário não encontrado
                    if (account.provider === 'google') {
                        // Cria novo usuário para Google (requer email)
                        if (!currentEmail) {
                             logger.error(`${TAG_SIGNIN} Email ausente para criar novo usuário Google.`);
                             return false;
                        }
                        logger.debug(`${TAG_SIGNIN} Criando novo usuário (Google) para email: ${currentEmail}`);
                        const newUser = new DbUser({
                            name: user?.name ?? (profile as any)?.name,
                            email: currentEmail,
                            image: user?.image ?? (profile as any)?.picture ?? (profile as any)?.image,
                            provider: account.provider,
                            providerAccountId: account.providerAccountId, // Google ID
                            facebookProviderAccountId: null,
                            role: "user", planStatus: "inactive", planExpiresAt: null,
                            affiliateBalance: 0, affiliateRank: 1, affiliateInvites: 0,
                            isInstagramConnected: false,
                         });
                        const savedUser = await newUser.save();
                        user.id = savedUser._id.toString(); // Passa o ID do NOVO usuário para JWT
                        logger.debug(`${TAG_SIGNIN} Novo usuário (Google) criado: ${user.id}`);
                        return true; // Permite o login
                    }
                    else if (account.provider === 'facebook') {
                         // Se for Facebook e NÃO encontrou, permite continuar para o JWT.
                         logger.debug(`${TAG_SIGNIN} Utilizador não encontrado para Facebook. Permitindo fluxo para JWT (possível vinculação ou novo usuário FB).`);
                         user.id = account.providerAccountId; // Passa o ID do Facebook para o JWT
                         // Passa email e nome do profile para JWT se disponíveis
                         user.email = currentEmail;
                         user.name = user?.name ?? (profile as any)?.name;
                         user.image = user?.image ?? (profile as any)?.picture ?? (profile as any)?.image;

                         logger.debug(`${TAG_SIGNIN} Passando user.id=${user.id} (providerAccountId do FB) e dados do profile para JWT.`);
                         return true; // Permite continuar
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

    // <<< CALLBACK JWT ATUALIZADO PARA USAR LINK TOKEN >>>
    async jwt({ token, user, account, profile, trigger }: JwtCallback): Promise<JWT> {
        const TAG_JWT = '[NextAuth JWT Callback]';
        logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Account Provider: ${account?.provider}. UserID entrada: ${user?.id}. Token entrada ID: ${token?.id}`);

        const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';
        // <<< CORREÇÃO AQUI vvv >>>
        // Inicializa finalTokenData com a cópia do token e garante que 'id' seja string
        let finalTokenData: JWT = { ...token, id: typeof token?.id === 'string' ? token.id : '' };

        // 1. Evento de Login/Conexão Inicial
        if (isSignInOrSignUp && account) {
            // Se for login/conexão via Facebook (potencial vinculação)
            if (account.provider === 'facebook') {
                let linkTokenUser: IUser | null = null;
                let linkTokenValue: string | undefined = undefined;

                // <<< Tenta ler e processar o cookie de link temporário 'auth-link-token' >>>
                try {
                    const cookieStore = cookies();
                    const linkCookie = cookieStore.get('auth-link-token');
                    linkTokenValue = linkCookie?.value;

                    if (linkTokenValue) {
                        logger.info(`${TAG_JWT} Cookie 'auth-link-token' encontrado. Valor: ${linkTokenValue.substring(0, 6)}...`);
                        cookieStore.delete('auth-link-token');
                        logger.info(`${TAG_JWT} Cookie 'auth-link-token' deletado.`);

                        await connectToDatabase();
                        linkTokenUser = await DbUser.findOne({
                            linkToken: linkTokenValue,
                            linkTokenExpiresAt: { $gt: new Date() }
                        }).lean().exec();

                        if (linkTokenUser) {
                            logger.info(`${TAG_JWT} Usuário encontrado via linkToken: ${linkTokenUser._id}. Iniciando vinculação.`);
                            await DbUser.updateOne(
                                { _id: linkTokenUser._id },
                                { $unset: { linkToken: "", linkTokenExpiresAt: "" } }
                            );
                            logger.info(`${TAG_JWT} linkToken removido do DB para User ${linkTokenUser._id}.`);
                        } else {
                            logger.warn(`${TAG_JWT} Link token encontrado no cookie, mas não encontrado/válido no DB (token: ${linkTokenValue.substring(0, 6)}...).`);
                        }
                    } else {
                         logger.debug(`${TAG_JWT} Cookie 'auth-link-token' não encontrado.`);
                    }
                } catch (err) {
                    logger.error(`${TAG_JWT} Erro ao tentar ler/processar cookie 'auth-link-token':`, err);
                     if (linkTokenValue) {
                         try { cookies().delete('auth-link-token'); } catch { /* Ignora erro na deleção */ }
                     }
                }
                // <<< Fim da leitura do link token >>>


                // --- LÓGICA DE VINCULAÇÃO (Se usuário foi encontrado pelo linkToken) ---
                if (linkTokenUser && account.providerAccountId) {
                    const userIdToUse = linkTokenUser._id.toString();
                    logger.info(`${TAG_JWT} *** BLOCO DE VINCULAÇÃO VIA LINK TOKEN EXECUTADO ***`);
                    logger.info(`${TAG_JWT} Vinculando Facebook (${account.providerAccountId}) à conta existente ${userIdToUse} (Provider original: ${linkTokenUser.provider})`);

                    try {
                        await connectToDatabase();
                        const userWithThisFbId = await DbUser.findOne({
                            facebookProviderAccountId: account.providerAccountId,
                            _id: { $ne: linkTokenUser._id }
                        }).select('_id').lean().exec();

                        if (userWithThisFbId) {
                            logger.error(`${TAG_JWT} Esta conta do Facebook (${account.providerAccountId}) já está vinculada a outro usuário (${userWithThisFbId._id}). Vinculação cancelada.`);
                            finalTokenData = {
                                id: userIdToUse, provider: linkTokenUser.provider, role: linkTokenUser.role,
                                name: linkTokenUser.name, email: linkTokenUser.email, image: linkTokenUser.image,
                                error: "fb_already_linked",
                            };
                        } else {
                            const updateResult = await DbUser.updateOne(
                                { _id: linkTokenUser._id },
                                { $set: { facebookProviderAccountId: account.providerAccountId } }
                            );

                            if (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0) {
                                logger.info(`${TAG_JWT} Conta Facebook vinculada com sucesso ao User ${userIdToUse}.`);
                                if (account.access_token) {
                                    getFacebookLongLivedTokenAndIgId(account.access_token, userIdToUse);
                                }
                                finalTokenData = {
                                    id: userIdToUse, provider: linkTokenUser.provider, role: linkTokenUser.role,
                                    name: linkTokenUser.name, email: linkTokenUser.email, image: linkTokenUser.image,
                                };
                                logger.debug(`${TAG_JWT} Preparando token de retorno com dados do usuário original (pós-vinculação): ID=${finalTokenData.id}, Provider=${finalTokenData.provider}`);
                            } else {
                                 logger.error(`${TAG_JWT} Falha ao vincular Facebook: Usuário existente ${userIdToUse} não encontrado/modificado no DB durante update.`);
                                 finalTokenData = {
                                     id: userIdToUse, provider: linkTokenUser.provider, role: linkTokenUser.role,
                                     name: linkTokenUser.name, email: linkTokenUser.email, image: linkTokenUser.image,
                                     error: "link_user_not_found",
                                 };
                            }
                        }
                    } catch (error) {
                         logger.error(`${TAG_JWT} Erro no DB ao vincular conta Facebook para User ${userIdToUse}:`, error);
                         finalTokenData = {
                             id: userIdToUse, provider: linkTokenUser.provider, role: linkTokenUser.role,
                             name: linkTokenUser.name, email: linkTokenUser.email, image: linkTokenUser.image,
                             error: "link_db_error",
                         };
                    }
                }
                // --- FIM DA LÓGICA DE VINCULAÇÃO ---

                // --- LOGIN NORMAL COM FACEBOOK (Sem link token válido ou não era vinculação) ---
                else {
                    logger.warn(`${TAG_JWT} *** BLOCO DE VINCULAÇÃO PULADO/FALHOU ***. Processando como login normal do Facebook.`);
                    await connectToDatabase();
                    let existingFbUser: IUser | null = null;

                    if (account.providerAccountId) {
                        existingFbUser = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).lean().exec();
                    }
                    const currentEmail = user?.email ?? (profile as any)?.email;
                    if (!existingFbUser && currentEmail) {
                        existingFbUser = await DbUser.findOne({ email: currentEmail }).lean().exec();
                        if (existingFbUser && !existingFbUser.facebookProviderAccountId && account.providerAccountId) {
                             logger.info(`${TAG_JWT} Usuário encontrado por email (${currentEmail}), atualizando facebookProviderAccountId para ${account.providerAccountId}.`);
                             await DbUser.updateOne(
                                 { _id: existingFbUser._id },
                                 { $set: { facebookProviderAccountId: account.providerAccountId } }
                             );
                             existingFbUser.facebookProviderAccountId = account.providerAccountId;
                        }
                    }

                    if (existingFbUser) {
                        logger.info(`${TAG_JWT} Login normal Facebook: Usuário existente encontrado ID: ${existingFbUser._id}`);
                        finalTokenData = {
                            id: existingFbUser._id.toString(), provider: existingFbUser.provider || 'facebook', role: existingFbUser.role,
                            name: existingFbUser.name, email: existingFbUser.email, image: existingFbUser.image,
                        };
                        if (account.access_token) {
                            getFacebookLongLivedTokenAndIgId(account.access_token, existingFbUser._id.toString());
                        }
                    } else {
                        logger.info(`${TAG_JWT} Login normal Facebook: Criando novo usuário para FB ID ${account.providerAccountId}.`);
                        if (!currentEmail || !account.providerAccountId) {
                             logger.error(`${TAG_JWT} Email (${currentEmail}) ou providerAccountId (${account.providerAccountId}) ausente para criar novo usuário FB.`);
                             finalTokenData = { ...finalTokenData, id: '', error: "fb_create_missing_data" }; // Usa id: '' e mantém outros campos
                        } else {
                            const newUser = new DbUser({
                                name: user?.name, email: currentEmail, image: user?.image,
                                provider: 'facebook', providerAccountId: null,
                                facebookProviderAccountId: account.providerAccountId,
                                role: "user", planStatus: "inactive", planExpiresAt: null,
                                affiliateBalance: 0, affiliateRank: 1, affiliateInvites: 0,
                                isInstagramConnected: false,
                            });
                            try {
                                const savedUser = await newUser.save();
                                logger.info(`${TAG_JWT} Novo usuário Facebook criado com sucesso: ${savedUser._id}`);
                                finalTokenData = {
                                    id: savedUser._id.toString(), provider: 'facebook', role: savedUser.role,
                                    name: savedUser.name, email: savedUser.email, image: savedUser.image,
                                };
                                if (account.access_token) {
                                    getFacebookLongLivedTokenAndIgId(account.access_token, savedUser._id.toString());
                                }
                            } catch (dbError: any) {
                                if (dbError.code === 11000 && dbError.keyPattern?.email) {
                                     logger.error(`${TAG_JWT} Erro: Email (${currentEmail}) já existe. Não foi possível criar novo usuário FB.`);
                                     finalTokenData = { ...finalTokenData, id: '', error: "fb_email_exists" }; // Usa id: '' e mantém outros campos
                                } else {
                                     logger.error(`${TAG_JWT} Erro ao salvar novo usuário Facebook no DB:`, dbError);
                                     finalTokenData = { ...finalTokenData, id: '', error: "fb_create_db_error" }; // Usa id: '' e mantém outros campos
                                }
                            }
                        }
                    }
                }
                // --- FIM DO LOGIN NORMAL FB ---

            }
            // Se for login/conexão via Google ou Credentials
            else {
                logger.debug(`${TAG_JWT} Processando login inicial com ${account.provider}.`);
                if (typeof user?.id === 'string' && Types.ObjectId.isValid(user.id)) {
                    finalTokenData.id = user.id;
                    finalTokenData.provider = account.provider;
                    finalTokenData.name = user.name;
                    finalTokenData.email = user.email;
                    finalTokenData.image = user.image;
                    logger.debug(`${TAG_JWT} Definindo token.id=${finalTokenData.id}, token.provider=${finalTokenData.provider}`);
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(finalTokenData.id).select('role').lean();
                        if (dbUser) { finalTokenData.role = dbUser.role; }
                        else { logger.warn(`${TAG_JWT} Usuário ${finalTokenData.id} não encontrado no DB ao buscar role (Google/Credentials).`); finalTokenData.role = undefined; } // Define role como undefined
                    } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar role (Google/Credentials):`, error); finalTokenData.role = undefined; } // Define role como undefined
                } else {
                     logger.error(`${TAG_JWT} ID do usuário inválido ou ausente para ${account.provider}: '${user?.id}'.`);
                     finalTokenData.id = ''; // Define id como string vazia em caso de erro
                     finalTokenData.role = undefined; // Garante que role seja undefined
                }
            }
        }

        // Fallback para atualizações de sessão, etc.
        if (!finalTokenData.id && token.id && Types.ObjectId.isValid(token.id as string)) {
            logger.warn(`${TAG_JWT} ID final ausente (não signIn/signUp?), recuperando do token original recebido: ${token.id}`);
            finalTokenData = { ...token }; // Restaura o token original
        }

        // Busca final de role se necessário e ID for válido
        const finalUserId = finalTokenData.id;
        // Verifica se finalUserId é uma string ObjectId válida antes de buscar role
        if (finalUserId && typeof finalUserId === 'string' && Types.ObjectId.isValid(finalUserId) && !finalTokenData.role) {
             logger.debug(`${TAG_JWT} Buscando role final para User ${finalUserId} (role estava ausente).`);
             try {
                await connectToDatabase();
                const dbUser = await DbUser.findById(finalUserId).select('role').lean();
                if (dbUser) { finalTokenData.role = dbUser.role; logger.debug(`${TAG_JWT} Role final '${finalTokenData.role}' definida.`); }
                else { logger.warn(`${TAG_JWT} Usuário ${finalUserId} não encontrado no DB na busca final de role.`); finalTokenData.role = undefined; } // Define role como undefined
             } catch (error) {
                 logger.error(`${TAG_JWT} Erro na busca final de role para User ${finalUserId}:`, error);
                 finalTokenData.role = undefined; // Define role como undefined
             }
        } else if (!finalUserId || !Types.ObjectId.isValid(finalUserId as string)) {
             // Se o ID final não for um ObjectId válido (incluindo string vazia), garante que a role seja undefined
             logger.debug(`${TAG_JWT} ID final inválido ou vazio ('${finalUserId}'), garantindo que role seja undefined.`);
             finalTokenData.role = undefined;
        }

        // Garante que 'sub' seja igual a 'id' se 'id' for válido
        if (finalTokenData.id && typeof finalTokenData.id === 'string' && finalTokenData.id !== '') {
            finalTokenData.sub = finalTokenData.id;
        } else {
             // Se id for inválido ou vazio, remove sub ou define como undefined
             delete finalTokenData.sub; // Ou finalTokenData.sub = undefined;
        }


        // Limpa o campo de erro temporário antes de retornar
        const returnToken: JWT = { ...finalTokenData };
        delete returnToken.error;

        logger.debug(`${TAG_JWT} Finalizado. Retornando token:`, JSON.stringify(returnToken));
        return returnToken;
    },

    // <<< CALLBACK SESSION (Mantido como antes) >>>
    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      const TAG_SESSION = '[NextAuth Session Callback]';
      logger.debug(`${TAG_SESSION} Iniciado. Token recebido:`, JSON.stringify(token));

      // Popula a sessão APENAS se o token contiver um ID válido do nosso DB
      // Verifica também se token.id não é uma string vazia
      if (token.id && typeof token.id === 'string' && token.id !== '' && Types.ObjectId.isValid(token.id)) {
          session.user = {
              id: token.id as string,
              name: token.name as string | undefined,
              email: token.email as string | undefined,
              image: token.image as string | undefined,
              provider: typeof token.provider === 'string' ? token.provider : undefined,
              role: typeof token.role === 'string' ? token.role : 'user', // Default 'user'
          };
          logger.debug(`${TAG_SESSION} Session.user inicializado com id='${session.user.id}', provider='${session.user.provider}', role='${session.user.role}'`);

          try {
            await connectToDatabase();
            const dbUser = await DbUser.findById(token.id)
                                       .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected')
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
              logger.debug(`${TAG_SESSION} Status conexão Instagram (do DB) para User ${token.id}: ${session.user.instagramConnected}`);

            } else if (session.user) {
               logger.error(`${TAG_SESSION} Usuário ${token.id} (ID válido) não encontrado no DB ao popular sessão. Sessão pode estar incompleta.`);
               delete session.user.planStatus; delete session.user.planExpiresAt; delete session.user.affiliateCode;
               delete session.user.affiliateBalance; delete session.user.affiliateRank; delete session.user.affiliateInvites;
               delete session.user.instagramConnected;
            }
          } catch (error) {
            logger.error(`${TAG_SESSION} Erro ao buscar/processar dados do usuário na sessão:`, error);
             if(session.user) {
                delete session.user.planStatus; delete session.user.instagramConnected; /* ... etc */
            }
          }
      } else {
          logger.error(`${TAG_SESSION} Erro: token.id ausente, inválido ou vazio ('${token.id}') ao iniciar sessão. Retornando sessão vazia.`);
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
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, }, // 30 days
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
