// src/app/api/auth/[...nextauth]/route.ts (v6.8 - Correção Imagem Vinculação)
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
import { cookies } from 'next/headers';
import { triggerDataRefresh, getFacebookLongLivedTokenAndIgId } from "@/app/lib/instagramService";

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
        if (payload && typeof payload.id !== 'string') {
             payload.id = '';
        }
        return payload as JWT;
    } catch (err) {
        logger.error(`customDecode: Erro ao decodificar token HS256: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}


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
      // Solicita permissões para perfil, email, páginas e insights do Instagram
      authorization: {
        params: {
          scope: [
            'email', 'public_profile', 'pages_show_list',
            'pages_read_engagement', 'instagram_basic',
            'instagram_manage_insights', 'instagram_manage_comments',
          ].join(','),
        },
      },
      // Opcional: profile callback para normalizar dados do Facebook se necessário
      // profile(profile) { ... }
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

        if (account?.provider === "credentials") {
            if (!user?.id) { logger.error(`${TAG_SIGNIN} Usuário de Credentials sem ID.`); return false; }
            logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials para User ${user.id}`);
            return true;
         }

        if (!account || !account.providerAccountId) {
            logger.error(`${TAG_SIGNIN} Informações mínimas ausentes (account, providerAccountId). Provider: ${account?.provider}`);
            return false;
        }
        const currentEmail = user?.email ?? (profile as any)?.email;
        if (!currentEmail && account.provider !== 'facebook') {
             logger.error(`${TAG_SIGNIN} Email ausente para ${account.provider}.`);
             return false;
        }

        if (account.provider === "google" || account.provider === "facebook") {
            try {
                await connectToDatabase();
                let existingUser: IUser | null = null;
                let query: any = {};

                 if (account.provider === 'facebook') {
                    query = { facebookProviderAccountId: account.providerAccountId };
                    logger.debug(`${TAG_SIGNIN} Tentando encontrar por facebookProviderAccountId: ${account.providerAccountId}`);
                    existingUser = await DbUser.findOne(query).exec();
                } else {
                    query = { providerAccountId: account.providerAccountId, provider: 'google' };
                     logger.debug(`${TAG_SIGNIN} Tentando encontrar por providerAccountId (Google): ${account.providerAccountId}`);
                    existingUser = await DbUser.findOne(query).exec();
                }

                if (!existingUser && currentEmail) {
                    logger.debug(`${TAG_SIGNIN} Não encontrado por Provider ID, tentando por email: ${currentEmail}`);
                    query = { email: currentEmail };
                    existingUser = await DbUser.findOne(query).exec();
                }

                if (existingUser) {
                    logger.debug(`${TAG_SIGNIN} Usuário existente encontrado (query: ${JSON.stringify(query)}) para ${account.provider}. ID: ${existingUser._id}`);
                    user.id = existingUser._id.toString();

                    let needsSave = false;
                    const providerName = user?.name ?? (profile as any)?.name;
                    const providerImage = user?.image ?? (profile as any)?.picture ?? (profile as any)?.image;

                    if (providerName && providerName !== existingUser.name) {
                        existingUser.name = providerName;
                        needsSave = true;
                    }

                    // --- LÓGICA DE ATUALIZAÇÃO DE IMAGEM MODIFICADA ---
                    // Só atualiza a imagem se:
                    // 1. O provedor fornecer uma imagem (providerImage é truthy)
                    // 2. E (OU o usuário ainda não tem imagem OU o provedor NÃO é o Facebook)
                    // Isso prioriza a imagem existente (do Google) durante a vinculação do Facebook.
                    if (providerImage && (!existingUser.image || account.provider !== 'facebook')) {
                        if (providerImage !== existingUser.image) { // Verifica se é realmente diferente
                            existingUser.image = providerImage;
                            needsSave = true;
                            logger.debug(`${TAG_SIGNIN} Atualizando imagem do usuário com a do provider ${account.provider}.`);
                        }
                    } else if (providerImage && account.provider === 'facebook' && existingUser.image) {
                         // Log para indicar que a imagem existente está sendo mantida
                         logger.debug(`${TAG_SIGNIN} Mantendo imagem existente (${existingUser.image.substring(0,20)}...) em vez de atualizar com a do Facebook (${providerImage.substring(0,20)}...).`);
                    }
                    // --- FIM DA LÓGICA MODIFICADA ---

                    if (account.provider === 'facebook' && existingUser.facebookProviderAccountId !== account.providerAccountId) {
                        logger.info(`${TAG_SIGNIN} Vinculando/Atualizando facebookProviderAccountId para ${account.providerAccountId} no User ${existingUser._id}`);
                        existingUser.facebookProviderAccountId = account.providerAccountId;
                        needsSave = true;
                    } else if (account.provider === 'google' && existingUser.providerAccountId !== account.providerAccountId) {
                         logger.info(`${TAG_SIGNIN} Vinculando/Atualizando providerAccountId (Google) para ${account.providerAccountId} no User ${existingUser._id}`);
                         existingUser.providerAccountId = account.providerAccountId;
                         if (!existingUser.provider) existingUser.provider = 'google';
                         needsSave = true;
                    }
                     if (existingUser.isInstagramConnected === undefined) {
                         existingUser.isInstagramConnected = !!existingUser.instagramAccountId;
                         needsSave = true;
                     }
                     if (currentEmail && currentEmail !== existingUser.email && query.email === undefined) {
                         logger.warn(`${TAG_SIGNIN} Email do provider (${currentEmail}) diferente do email existente (${existingUser.email}) para User ${existingUser._id}. Não atualizando email automaticamente.`);
                     }

                    if (needsSave) {
                        await existingUser.save();
                        logger.debug(`${TAG_SIGNIN} Dados do usuário existente atualizados/vinculados.`);
                    }
                    return true;

                } else {
                    // Usuário não encontrado
                    if (account.provider === 'google') {
                        if (!currentEmail) {
                             logger.error(`${TAG_SIGNIN} Email ausente para criar novo usuário Google.`);
                             return false;
                        }
                        logger.debug(`${TAG_SIGNIN} Criando novo usuário (Google) para email: ${currentEmail}`);
                        const newUser = new DbUser({
                            name: user?.name ?? (profile as any)?.name,
                            email: currentEmail,
                            image: user?.image ?? (profile as any)?.picture ?? (profile as any)?.image, // Usa a imagem do Google
                            provider: account.provider,
                            providerAccountId: account.providerAccountId,
                            // ... outros campos padrão ...
                            role: "user", planStatus: "inactive", isInstagramConnected: false,
                         });
                        const savedUser = await newUser.save();
                        user.id = savedUser._id.toString();
                        logger.debug(`${TAG_SIGNIN} Novo usuário (Google) criado: ${user.id}`);
                        return true;
                    }
                    else if (account.provider === 'facebook') {
                         logger.debug(`${TAG_SIGNIN} Utilizador não encontrado para Facebook. Permitindo fluxo para JWT (possível vinculação ou novo usuário FB).`);
                         user.id = account.providerAccountId;
                         user.email = currentEmail;
                         user.name = user?.name ?? (profile as any)?.name;
                         user.image = user?.image ?? (profile as any)?.picture ?? (profile as any)?.image; // Passa a imagem do Facebook para o JWT
                         logger.debug(`${TAG_SIGNIN} Passando user.id=${user.id} (providerAccountId do FB) e dados do profile para JWT.`);
                         return true;
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

    async jwt({ token, user, account, profile, trigger }: JwtCallback): Promise<JWT> {
        const TAG_JWT = '[NextAuth JWT Callback]';
        logger.debug(`${TAG_JWT} Iniciado. Trigger: ${trigger}. Account Provider: ${account?.provider}. UserID entrada: ${user?.id}. Token entrada ID: ${token?.id}`);

        const isSignInOrSignUp = trigger === 'signIn' || trigger === 'signUp';
        let finalTokenData: JWT = { ...token, id: typeof token?.id === 'string' ? token.id : '' };

        // 1. Evento de Login/Conexão Inicial
        if (isSignInOrSignUp && account) {
            if (account.provider === 'facebook') {
                let linkTokenUser: IUser | null = null;
                let linkTokenValue: string | undefined = undefined;

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
                                { $set: { facebookProviderAccountId: account.providerAccountId } } // A imagem não é atualizada aqui, foi tratada no signIn
                            );
                            if (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0) {
                                logger.info(`${TAG_JWT} Conta Facebook vinculada com sucesso ao User ${userIdToUse}.`);
                                if (account.access_token) {
                                    getFacebookLongLivedTokenAndIgId(account.access_token, userIdToUse)
                                        .then(result => {
                                            if (result.success) {
                                                logger.info(`${TAG_JWT} getFacebookLongLivedTokenAndIgId concluído com sucesso para ${userIdToUse}.`);
                                                logger.info(`${TAG_JWT} Disparando coleta inicial de dados (triggerDataRefresh) para ${userIdToUse}...`);
                                                triggerDataRefresh(userIdToUse).catch(err => {
                                                     logger.error(`${TAG_JWT} Erro não capturado na coleta inicial (triggerDataRefresh) para ${userIdToUse}:`, err);
                                                });
                                            } else {
                                                 logger.error(`${TAG_JWT} Falha ao obter LLAT/IG ID para ${userIdToUse}: ${result.error}`);
                                            }
                                        })
                                        .catch(err => {
                                             logger.error(`${TAG_JWT} Erro não capturado em getFacebookLongLivedTokenAndIgId para ${userIdToUse}:`, err);
                                        });
                                }
                                // Prepara token com dados do usuário original (Google neste caso)
                                finalTokenData = {
                                    id: userIdToUse, provider: linkTokenUser.provider, role: linkTokenUser.role,
                                    name: linkTokenUser.name, email: linkTokenUser.email, image: linkTokenUser.image, // Usa imagem do Google
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
                            name: existingFbUser.name, email: existingFbUser.email, image: existingFbUser.image, // Usa imagem do DB
                        };
                        if (account.access_token) {
                            getFacebookLongLivedTokenAndIgId(account.access_token, existingFbUser._id.toString()).catch(err => {
                                 logger.error(`${TAG_JWT} Erro não capturado em getFacebookLongLivedTokenAndIgId (login normal FB) para ${existingFbUser?._id}:`, err);
                            });
                        }
                    } else {
                        logger.info(`${TAG_JWT} Login normal Facebook: Criando novo usuário para FB ID ${account.providerAccountId}.`);
                        if (!currentEmail || !account.providerAccountId) {
                             logger.error(`${TAG_JWT} Email (${currentEmail}) ou providerAccountId (${account.providerAccountId}) ausente para criar novo usuário FB.`);
                             finalTokenData = { ...finalTokenData, id: '', error: "fb_create_missing_data" };
                        } else {
                            const newUser = new DbUser({
                                name: user?.name, email: currentEmail, image: user?.image, // Usa imagem do Facebook se veio no user/profile
                                provider: 'facebook', providerAccountId: null,
                                facebookProviderAccountId: account.providerAccountId,
                                role: "user", planStatus: "inactive", isInstagramConnected: false,
                            });
                            try {
                                const savedUser = await newUser.save();
                                logger.info(`${TAG_JWT} Novo usuário Facebook criado com sucesso: ${savedUser._id}`);
                                finalTokenData = {
                                    id: savedUser._id.toString(), provider: 'facebook', role: savedUser.role,
                                    name: savedUser.name, email: savedUser.email, image: savedUser.image,
                                };
                                if (account.access_token) {
                                    getFacebookLongLivedTokenAndIgId(account.access_token, savedUser._id.toString()).catch(err => {
                                         logger.error(`${TAG_JWT} Erro não capturado em getFacebookLongLivedTokenAndIgId (novo usuário FB) para ${savedUser._id}:`, err);
                                    });
                                    logger.info(`${TAG_JWT} Disparando coleta inicial de dados (triggerDataRefresh) para NOVO usuário FB ${savedUser._id}...`);
                                    triggerDataRefresh(savedUser._id.toString()).catch(err => {
                                         logger.error(`${TAG_JWT} Erro não capturado na coleta inicial (triggerDataRefresh) para NOVO usuário FB ${savedUser._id}:`, err);
                                    });
                                }
                            } catch (dbError: any) {
                                if (dbError.code === 11000 && dbError.keyPattern?.email) {
                                     logger.error(`${TAG_JWT} Erro: Email (${currentEmail}) já existe. Não foi possível criar novo usuário FB.`);
                                     finalTokenData = { ...finalTokenData, id: '', error: "fb_email_exists" };
                                } else {
                                     logger.error(`${TAG_JWT} Erro ao salvar novo usuário Facebook no DB:`, dbError);
                                     finalTokenData = { ...finalTokenData, id: '', error: "fb_create_db_error" };
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
                    finalTokenData.image = user.image; // Imagem do Google/Credentials
                    logger.debug(`${TAG_JWT} Definindo token.id=${finalTokenData.id}, token.provider=${finalTokenData.provider}`);
                    try {
                        await connectToDatabase();
                        const dbUser = await DbUser.findById(finalTokenData.id).select('role').lean();
                        if (dbUser) { finalTokenData.role = dbUser.role; }
                        else { logger.warn(`${TAG_JWT} Usuário ${finalTokenData.id} não encontrado no DB ao buscar role (Google/Credentials).`); finalTokenData.role = undefined; }
                    } catch (error) { logger.error(`${TAG_JWT} Erro ao buscar role (Google/Credentials):`, error); finalTokenData.role = undefined; }
                } else {
                     logger.error(`${TAG_JWT} ID do usuário inválido ou ausente para ${account.provider}: '${user?.id}'.`);
                     finalTokenData.id = '';
                     finalTokenData.role = undefined;
                }
            }
        }

        if (!finalTokenData.id && token.id && Types.ObjectId.isValid(token.id as string)) {
            logger.warn(`${TAG_JWT} ID final ausente (não signIn/signUp?), recuperando do token original recebido: ${token.id}`);
            finalTokenData = { ...token };
        }

        const finalUserId = finalTokenData.id;
        if (finalUserId && typeof finalUserId === 'string' && Types.ObjectId.isValid(finalUserId) && !finalTokenData.role) {
             logger.debug(`${TAG_JWT} Buscando role final para User ${finalUserId} (role estava ausente).`);
             try {
                await connectToDatabase();
                const dbUser = await DbUser.findById(finalUserId).select('role').lean();
                if (dbUser) { finalTokenData.role = dbUser.role; logger.debug(`${TAG_JWT} Role final '${finalTokenData.role}' definida.`); }
                else { logger.warn(`${TAG_JWT} Usuário ${finalUserId} não encontrado no DB na busca final de role.`); finalTokenData.role = undefined; }
             } catch (error) {
                 logger.error(`${TAG_JWT} Erro na busca final de role para User ${finalUserId}:`, error);
                 finalTokenData.role = undefined;
             }
        } else if (!finalUserId || !Types.ObjectId.isValid(finalUserId as string)) {
             logger.debug(`${TAG_JWT} ID final inválido ou vazio ('${finalUserId}'), garantindo que role seja undefined.`);
             finalTokenData.role = undefined;
        }

        if (finalTokenData.id && typeof finalTokenData.id === 'string' && finalTokenData.id !== '') {
            finalTokenData.sub = finalTokenData.id;
        } else {
             delete finalTokenData.sub;
        }

        const returnToken: JWT = { ...finalTokenData };
        delete returnToken.error;

        logger.debug(`${TAG_JWT} Finalizado. Retornando token:`, JSON.stringify(returnToken));
        return returnToken;
    },

    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      const TAG_SESSION = '[NextAuth Session Callback]';
      logger.debug(`${TAG_SESSION} Iniciado. Token recebido:`, JSON.stringify(token));

      if (token.id && typeof token.id === 'string' && token.id !== '' && Types.ObjectId.isValid(token.id)) {
          session.user = {
              id: token.id as string,
              name: token.name as string | undefined,
              email: token.email as string | undefined,
              image: token.image as string | undefined, // <<< Vem do JWT (que agora prioriza a imagem original)
              provider: typeof token.provider === 'string' ? token.provider : undefined,
              role: typeof token.role === 'string' ? token.role : 'user',
          };
          logger.debug(`${TAG_SESSION} Session.user inicializado com id='${session.user.id}', provider='${session.user.provider}', role='${session.user.role}'`);

          try {
            await connectToDatabase();
            const dbUser = await DbUser.findById(token.id)
                                       .select('name email image role planStatus planExpiresAt affiliateCode affiliateBalance affiliateRank affiliateInvites isInstagramConnected') // Inclui 'image'
                                       .lean();

            if (dbUser && session.user) {
              logger.debug(`${TAG_SESSION} Usuário encontrado no DB para sessão: ${dbUser._id}`);
              session.user.name = dbUser.name ?? session.user.name;
              session.user.email = dbUser.email ?? session.user.email;
              // <<< Lógica de Imagem na Sessão >>>
              // Prioriza a imagem do DB (que não foi sobrescrita pelo FB no signIn)
              // Se por algum motivo a imagem do DB for nula, mantém a imagem do token (original do Google)
              session.user.image = dbUser.image ?? session.user.image;
              logger.debug(`${TAG_SESSION} Imagem final da sessão: ${session.user.image?.substring(0,30)}... (Prioridade: DB, Fallback: Token)`);
              // <<< Fim Lógica Imagem >>>
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

    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      return `${baseUrl}/dashboard`;
    },
  },
  pages: { signIn: "/login", error: "/auth/error", },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, }, // 30 days
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
