// VERSÃO: v2.3.0
// - Normaliza planStatus: trialing -> trial, non_renewing -> active
// - Se planStatus original for 'non_renewing', força cancelAtPeriodEnd = true
// - Session revalida usando status normalizado (evita reintroduzir valores crus do DB)
// - Mantém hard-id no JWT, custom encode/decode e refresh quando 'inactive' mas com sinais de assinatura

import NextAuth from "next-auth";
import type {
  DefaultSession,
  DefaultUser,
  NextAuthOptions,
  Session,
  User as NextAuthUserArg,
} from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import AgencyModel from "@/app/models/Agency";

import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import type {
  JWT,
  DefaultJWT,
  JWTEncodeParams,
  JWTDecodeParams,
} from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
import { logger } from "@/app/lib/logger";
import { cookies } from "next/headers";

import { fetchAvailableInstagramAccounts } from "@/app/lib/instagram";
import type { AvailableInstagramAccount as ServiceAvailableIgAccount } from "@/app/lib/instagram/types";

// --- AUGMENT NEXT-AUTH TYPES ---
declare module "next-auth" {
  interface User extends DefaultUser {
    id: string;
    role?: string | null;
    provider?: string | null;
    agency?: string | null;
    isNewUserForOnboarding?: boolean;
    onboardingCompletedAt?: Date | null;
    isInstagramConnected?: boolean | null;
    instagramAccountId?: string | null;
    instagramUsername?: string | null;
    igConnectionError?: string | null;
    instagramSyncErrorMsg?: string | null;
    availableIgAccounts?: ServiceAvailableIgAccount[] | null;
    instagramAccessToken?: string | null;
    lastInstagramSyncAttempt?: Date | null;
    lastInstagramSyncSuccess?: boolean | null;

    // Billing
    planStatus?: string | null;
    planType?: string | null;
    planInterval?: string | null;
    planExpiresAt?: Date | null;
    cancelAtPeriodEnd?: boolean | null;
    // Stripe IDs
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;

    // Afiliados
    affiliateCode?: string | null;
    affiliateBalances?: Record<string, number>;

    facebookProviderAccountId?: string | null;
    providerAccountId?: string | null;

    // Stripe Connect (payouts)
    stripeAccountStatus?: "pending" | "verified" | "disabled" | null;
    stripeAccountDefaultCurrency?: string | null;
  }

  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string | null;
      role?: string | null;

      // Agência
      agencyId?: string | null;
      agencyPlanStatus?: string | null;
      agencyPlanType?: string | null;

      // Billing
      planStatus?: string | null;
      planType?: string | null;
      planInterval?: string | null;
      planExpiresAt?: string | null;
      cancelAtPeriodEnd?: boolean | null;
      // Stripe IDs também no client
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      stripePriceId?: string | null;

      // Afiliados
      affiliateCode?: string | null;
      affiliateBalances?: Record<string, number>;
      affiliateRank?: number;
      affiliateInvites?: number;

      // Instagram
      instagramConnected?: boolean;
      instagramAccountId?: string | null;
      instagramUsername?: string | null;
      igConnectionError?: string | null;
      availableIgAccounts?: ServiceAvailableIgAccount[] | null;
      instagramAccessToken?: string | null;
      lastInstagramSyncAttempt?: string | null;
      lastInstagramSyncSuccess?: boolean | null;

      // Onboarding
      isNewUserForOnboarding?: boolean;
      onboardingCompletedAt?: string | null;

      // Stripe Connect (payouts)
      stripeAccountStatus?: "pending" | "verified" | "disabled" | null;
      stripeAccountDefaultCurrency?: string | null;
    } & Omit<DefaultSession["user"], "id" | "name" | "email" | "image">;

    affiliateCode?: string | null;
    affiliateBalances?: Record<string, number>;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role?: string | null;
    agencyId?: string | null;
    agencyPlanStatus?: string | null;
    agencyPlanType?: string | null;
    provider?: string | null;

    // Onboarding
    isNewUserForOnboarding?: boolean;
    onboardingCompletedAt?: Date | string | null;

    // Instagram
    isInstagramConnected?: boolean | null;
    instagramAccountId?: string | null;
    instagramUsername?: string | null;
    igConnectionError?: string | null;
    availableIgAccounts?: ServiceAvailableIgAccount[] | null;
    instagramAccessToken?: string | null;
    lastInstagramSyncAttempt?: Date | string | null;
    lastInstagramSyncSuccess?: boolean | null;

    // Billing
    planStatus?: string | null;
    planType?: string | null;
    planInterval?: string | null;
    planExpiresAt?: Date | string | null;
    cancelAtPeriodEnd?: boolean | null;
    // Stripe IDs
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;

    // Afiliados
    affiliateCode?: string | null;
    affiliateBalances?: Record<string, number>;

    image?: string | null;

    // Stripe Connect (payouts)
    stripeAccountStatus?: "pending" | "verified" | "disabled" | null;
    stripeAccountDefaultCurrency?: string | null;
  }
}
// --- END AUGMENT NEXT-AUTH TYPES ---

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included";
const FACEBOOK_LINK_COOKIE_NAME = "auth-link-token";
const MAX_TOKEN_AGE_BEFORE_REFRESH_MINUTES = 60; // 1 hour

// Helpers de normalização de plano
function isNonRenewing(v: unknown): boolean {
  const s = String(v ?? "").toLowerCase().trim();
  return s === "non_renewing" || s === "non-renewing" || s === "nonrenewing";
}

// Normaliza valores legados de plano
function normalizePlanStatusValue(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).toLowerCase().trim();
  if (s === "trialing" || s === "trial") return "trial";
  if (isNonRenewing(s)) return "active"; // acesso liberado até o fim do ciclo
  return s;
}

function normalizeBalances(input: unknown): Record<string, number> {
  if (!input) return {};
  try {
    if (input instanceof Map) return Object.fromEntries(input as Map<string, number>);
    if (Array.isArray(input)) return Object.fromEntries(input as any);
    if (typeof input === "object") return { ...(input as Record<string, number>) };
    return {};
  } catch {
    return {};
  }
}

function ensureStringId(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  return s && s !== "undefined" ? s : null;
}

async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
  const TAG_ENCODE = "[NextAuth customEncode v2.3.0]";
  if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
  const secretString = typeof secret === "string" ? secret : String(secret);
  const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);

  const cleanToken: Record<string, any> = { ...token };
  Object.keys(cleanToken).forEach((key) => {
    if (cleanToken[key] === undefined) delete cleanToken[key];
  });

  // nunca gravar id vazio; usa sub->id; se nada, ERRO
  const idFromToken = ensureStringId(cleanToken.id) ?? ensureStringId(cleanToken.sub);
  if (!idFromToken) {
    logger.error(`${TAG_ENCODE} Token sem id/sub. Abortando encode para evitar sessão inválida.`);
    throw new Error("JWT encode sem id/sub");
  }
  cleanToken.id = idFromToken;

  if (cleanToken.onboardingCompletedAt instanceof Date) {
    cleanToken.onboardingCompletedAt = cleanToken.onboardingCompletedAt.toISOString();
  }
  if (cleanToken.lastInstagramSyncAttempt instanceof Date) {
    cleanToken.lastInstagramSyncAttempt = cleanToken.lastInstagramSyncAttempt.toISOString();
  }
  if (cleanToken.planExpiresAt instanceof Date) {
    cleanToken.planExpiresAt = cleanToken.planExpiresAt.toISOString();
  }

  if (cleanToken.image && cleanToken.picture) delete cleanToken.picture;
  delete cleanToken.instagramSyncErrorMsg;

  if (cleanToken.availableIgAccounts && Array.isArray(cleanToken.availableIgAccounts)) {
    try {
      cleanToken.availableIgAccounts = JSON.parse(JSON.stringify(cleanToken.availableIgAccounts));
      logger.debug(`${TAG_ENCODE} availableIgAccounts serializado para JWT.`);
    } catch (e) {
      logger.error(`${TAG_ENCODE} Erro ao serializar availableIgAccounts:`, e);
      delete cleanToken.availableIgAccounts;
      logger.warn(`${TAG_ENCODE} availableIgAccounts removido do token (erro de serialização).`);
    }
  }

  return new SignJWT(cleanToken)
    .setSubject(cleanToken.id) // subject sempre válido
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(new TextEncoder().encode(secretString));
}

async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
  const TAG_DECODE = "[NextAuth customDecode v2.3.0]";
  if (!token || !secret) {
    logger.error(`${TAG_DECODE} Token ou secret não fornecidos.`);
    return null;
  }
  const secretString = typeof secret === "string" ? secret : String(secret);
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString), {
      algorithms: ["HS256"],
    });
    const decodedPayload: Partial<JWT> = { ...(payload as any) };

    // Recupera id de sub; se nada, considera inválido
    const id = ensureStringId(decodedPayload.id) ?? ensureStringId((decodedPayload as any).sub);
    if (!id) {
      logger.error(`${TAG_DECODE} Payload sem id/sub. Decodificação aceita, porém token inválido para sessão.`);
      return null;
    }
    decodedPayload.id = id;

    if (typeof decodedPayload.onboardingCompletedAt === "string") {
      decodedPayload.onboardingCompletedAt = new Date(decodedPayload.onboardingCompletedAt);
    }
    if (typeof decodedPayload.lastInstagramSyncAttempt === "string") {
      decodedPayload.lastInstagramSyncAttempt = new Date(decodedPayload.lastInstagramSyncAttempt);
    }
    if (typeof decodedPayload.planExpiresAt === "string") {
      decodedPayload.planExpiresAt = new Date(decodedPayload.planExpiresAt);
    }

    if ((decodedPayload as any).picture && !decodedPayload.image) {
      decodedPayload.image = (decodedPayload as any).picture as string;
    }

    return decodedPayload as JWT;
  } catch (err) {
    logger.error(`${TAG_DECODE} Erro ao decodificar token: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: { sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production" ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile" } },
      profile(profile) {
        const profileJsonString = JSON.stringify(profile, null, 2);
        logger.debug(`[NextAuth Google Profile DEBUG - CONTEÚDO COMPLETO] Profile recebido do Google: ${profileJsonString}`);
        const name = profile.name && profile.name.trim() !== "" ? profile.name.trim() : profile.email?.split("@")[0] ?? "User";
        return { id: profile.sub!, name, email: profile.email, image: profile.picture };
      },
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "email,public_profile,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights,business_management",
          auth_type: "rerequest",
        },
      },
      profile(profile) {
        logger.debug("NextAuth: Facebook profile returned:", profile);
        const name = profile.name && profile.name.trim() !== "" ? profile.name.trim() : profile.email?.split("@")[0] ?? "User";
        return { id: profile.id!, name, email: profile.email, image: (profile as any).picture?.data?.url };
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        await connectToDatabase();
        const user = await DbUser.findOne({ email: credentials.email }).select("+password");
        if (!user) { logger.warn("Nenhum usuário encontrado com este e-mail."); return null; }
        const passwordsMatch = await bcrypt.compare(credentials.password, user.password as string);
        if (!passwordsMatch) { logger.warn("Senha incorreta."); return null; }
        logger.info(`Login bem-sucedido para ${user.email}`);
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          agency: user.agency ? user.agency.toString() : null,
        } as NextAuthUserArg;
      },
    }),
  ],
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    encode: customEncode,
    decode: customDecode,
  },
  callbacks: {
    async signIn({ user: authUserFromProvider, account }) {
      const TAG_SIGNIN = "[NextAuth signIn v2.3.0]";
      logger.debug(`${TAG_SIGNIN} Iniciado`, {
        providerAccountIdReceived: authUserFromProvider.id,
        provider: account?.provider,
        email: authUserFromProvider.email,
      });

      if (!account || !account.provider || !authUserFromProvider?.id) {
        logger.error(`${TAG_SIGNIN} Dados essenciais ausentes (account, provider, user.id).`, { account, user: authUserFromProvider });
        return false;
      }

      if (account.provider === "credentials") {
        logger.debug(`${TAG_SIGNIN} Permitindo login via Credentials (utilizador: ${authUserFromProvider.id}).`);
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

        if (provider === "facebook") {
          const cookieStore = cookies();
          const linkTokenFromCookie = cookieStore.get(FACEBOOK_LINK_COOKIE_NAME)?.value;

          if (linkTokenFromCookie) {
            dbUserRecord = await DbUser.findOne({
              linkToken: linkTokenFromCookie,
              linkTokenExpiresAt: { $gt: new Date() },
            });

            if (dbUserRecord) {
              logger.info(`${TAG_SIGNIN} [Facebook] Utilizador Data2Content ${dbUserRecord._id} (Email DB: ${dbUserRecord.email || "N/A"}) encontrado por linkToken.`);
              // Evita vincular uma conta Facebook já usada por outro usuário
              const conflict = await DbUser.findOne({
                facebookProviderAccountId: providerAccountId,
                _id: { $ne: dbUserRecord._id },
              }).select('_id email').lean();
              if (conflict) {
                logger.warn(`${TAG_SIGNIN} [Facebook] providerAccountId ${providerAccountId} já vinculado a outro usuário ${conflict._id}. Abortando.`);
                cookies().delete(FACEBOOK_LINK_COOKIE_NAME);
                return "/dashboard/instagram/connect?error=FacebookAlreadyLinked";
              }
              dbUserRecord.facebookProviderAccountId = providerAccountId;
              if (!dbUserRecord.email && currentEmailFromProvider) {
                dbUserRecord.email = currentEmailFromProvider;
              } else if (dbUserRecord.email && currentEmailFromProvider && dbUserRecord.email.toLowerCase() !== currentEmailFromProvider.toLowerCase()) {
                logger.warn(`${TAG_SIGNIN} [Facebook] Email do Facebook ('${currentEmailFromProvider}') difere do DB ('${dbUserRecord.email}') — mantendo DB.`);
              }

              dbUserRecord.linkToken = undefined;
              dbUserRecord.linkTokenExpiresAt = undefined;

              if (account?.access_token) {
                logger.info(`${TAG_SIGNIN} [Facebook] Obtendo contas IG/LLAT…`);
                try {
                  const igAccountsResult = await fetchAvailableInstagramAccounts(account.access_token, dbUserRecord._id.toString());
                  if (igAccountsResult.success) {
                    logger.info(`${TAG_SIGNIN} [Facebook] ${igAccountsResult.accounts.length} contas IG; LLAT ${igAccountsResult.longLivedAccessToken ? "OK" : "N/A"}.`);
                    dbUserRecord.availableIgAccounts = igAccountsResult.accounts;
                    dbUserRecord.instagramAccessToken = igAccountsResult.longLivedAccessToken ?? undefined;
                    dbUserRecord.isInstagramConnected = false;
                    dbUserRecord.instagramAccountId = null;
                    dbUserRecord.username = null;
                    dbUserRecord.instagramSyncErrorMsg = null;
                  } else {
                    logger.error(`${TAG_SIGNIN} [Facebook] Falha IG: ${igAccountsResult.error}`);
                    dbUserRecord.instagramSyncErrorMsg = igAccountsResult.error;
                    dbUserRecord.availableIgAccounts = [];
                    dbUserRecord.instagramAccessToken = undefined;
                  }
                } catch (fetchError: any) {
                  logger.error(`${TAG_SIGNIN} [Facebook] Erro crítico IG: ${fetchError.message}`);
                  dbUserRecord.instagramSyncErrorMsg = "Erro interno ao tentar buscar contas do Instagram: " + fetchError.message.substring(0, 150);
                  dbUserRecord.availableIgAccounts = [];
                  dbUserRecord.instagramAccessToken = undefined;
                }
              } else {
                logger.warn(`${TAG_SIGNIN} [Facebook] account.access_token ausente — não dá pra buscar IG.`);
                dbUserRecord.instagramSyncErrorMsg = "Token de acesso do Facebook não disponível para buscar contas do Instagram.";
                dbUserRecord.availableIgAccounts = [];
                dbUserRecord.instagramAccessToken = undefined;
              }
              await dbUserRecord.save();
              cookies().delete(FACEBOOK_LINK_COOKIE_NAME);
              logger.info(`${TAG_SIGNIN} [Facebook] Vinculação/IG processadas para ${dbUserRecord._id}.`);
            } else {
              logger.warn(`${TAG_SIGNIN} [Facebook] linkToken '${FACEBOOK_LINK_COOKIE_NAME}' inválido/expirado. Vinculação falhou.`);
              cookies().delete(FACEBOOK_LINK_COOKIE_NAME);
              return "/dashboard/instagram/connect?error=FacebookLinkFailed";
            }
          } else {
            logger.warn(`${TAG_SIGNIN} [Facebook] Sem linkToken ('${FACEBOOK_LINK_COOKIE_NAME}'). Tentando fallback pela sessão ativa.`);
            // Fallback: usar sessão atual (se existir) para identificar o usuário-alvo da vinculação
            let sessionUserId: string | null = null;
            try {
              const sessionCookieName = process.env.NODE_ENV === 'production'
                ? '__Secure-next-auth.session-token'
                : 'next-auth.session-token';
              const sessionToken = cookieStore.get(sessionCookieName)?.value
                ?? cookieStore.get('__Secure-next-auth.session-token')?.value
                ?? cookieStore.get('next-auth.session-token')?.value;
              if (sessionToken && process.env.NEXTAUTH_SECRET) {
                const decoded = await customDecode({ token: sessionToken, secret: process.env.NEXTAUTH_SECRET });
                if (decoded?.id) sessionUserId = String(decoded.id);
              }
            } catch (e) {
              logger.warn(`${TAG_SIGNIN} [Facebook] Fallback sessão - falha ao decodificar token de sessão.`, e);
            }

            if (!sessionUserId) {
              logger.warn(`${TAG_SIGNIN} [Facebook] Sem linkToken e sem sessão ativa decodificável. Bloqueando login direto.`);
              return "/dashboard/instagram/connect?error=FacebookLinkRequired";
            }

            dbUserRecord = await DbUser.findById(sessionUserId);
            if (!dbUserRecord) {
              logger.warn(`${TAG_SIGNIN} [Facebook] Fallback sessão: user ${sessionUserId} não encontrado no DB.`);
              return "/dashboard/instagram/connect?error=FacebookLinkRequired";
            }

            // Checagem de conflito: a conta Facebook já foi vinculada a outro usuário?
            {
              const conflict = await DbUser.findOne({
                facebookProviderAccountId: providerAccountId,
                _id: { $ne: dbUserRecord._id },
              }).select('_id').lean();
              if (conflict) {
                logger.warn(`${TAG_SIGNIN} [Facebook] providerAccountId ${providerAccountId} já vinculado a ${conflict._id}. Abortando.`);
                return "/dashboard/instagram/connect?error=FacebookAlreadyLinked";
              }
            }

            // Aplicar atualizações de vinculação + descoberta IG (mesma lógica do ramo com linkToken)
            dbUserRecord.facebookProviderAccountId = providerAccountId;
            if (!dbUserRecord.email && currentEmailFromProvider) {
              dbUserRecord.email = currentEmailFromProvider;
            } else if (dbUserRecord.email && currentEmailFromProvider && dbUserRecord.email.toLowerCase() !== currentEmailFromProvider.toLowerCase()) {
              logger.warn(`${TAG_SIGNIN} [Facebook] Email do Facebook ('${currentEmailFromProvider}') difere do DB ('${dbUserRecord.email}') — mantendo DB.`);
            }

            if (account?.access_token) {
              logger.info(`${TAG_SIGNIN} [Facebook] (fallback sessão) Obtendo contas IG/LLAT…`);
              try {
                const igAccountsResult = await fetchAvailableInstagramAccounts(account.access_token, dbUserRecord._id.toString());
                if (igAccountsResult.success) {
                  logger.info(`${TAG_SIGNIN} [Facebook] (fallback sessão) ${igAccountsResult.accounts.length} contas IG; LLAT ${igAccountsResult.longLivedAccessToken ? "OK" : "N/A"}.`);
                  dbUserRecord.availableIgAccounts = igAccountsResult.accounts;
                  dbUserRecord.instagramAccessToken = igAccountsResult.longLivedAccessToken ?? undefined;
                  dbUserRecord.isInstagramConnected = false;
                  dbUserRecord.instagramAccountId = null;
                  dbUserRecord.username = null;
                  dbUserRecord.instagramSyncErrorMsg = null;
                } else {
                  logger.error(`${TAG_SIGNIN} [Facebook] (fallback sessão) Falha IG: ${igAccountsResult.error}`);
                  dbUserRecord.instagramSyncErrorMsg = igAccountsResult.error;
                  dbUserRecord.availableIgAccounts = [];
                  dbUserRecord.instagramAccessToken = undefined;
                }
              } catch (fetchError: any) {
                logger.error(`${TAG_SIGNIN} [Facebook] (fallback sessão) Erro crítico IG: ${fetchError.message}`);
                dbUserRecord.instagramSyncErrorMsg = "Erro interno ao tentar buscar contas do Instagram: " + fetchError.message.substring(0, 150);
                dbUserRecord.availableIgAccounts = [];
                dbUserRecord.instagramAccessToken = undefined;
              }
            } else {
              logger.warn(`${TAG_SIGNIN} [Facebook] (fallback sessão) account.access_token ausente — não dá pra buscar IG.`);
              dbUserRecord.instagramSyncErrorMsg = "Token de acesso do Facebook não disponível para buscar contas do Instagram.";
              dbUserRecord.availableIgAccounts = [];
              dbUserRecord.instagramAccessToken = undefined;
            }

            await dbUserRecord.save();
            cookies().delete(FACEBOOK_LINK_COOKIE_NAME);
            logger.info(`${TAG_SIGNIN} [Facebook] Vinculação/IG processadas via sessão ativa para ${dbUserRecord._id}.`);
          }
        } else if (provider === "google") {
          dbUserRecord = await DbUser.findOne({ provider, providerAccountId }).exec();

          if (!dbUserRecord && currentEmailFromProvider) {
            const userByEmail = await DbUser.findOne({ email: currentEmailFromProvider }).exec();
            if (userByEmail) {
              logger.info(`${TAG_SIGNIN} [Google] Usuário existente ${userByEmail._id} por email. Vinculando Google ID ${providerAccountId}.`);
              dbUserRecord = userByEmail;
              dbUserRecord.provider = provider;
              dbUserRecord.providerAccountId = providerAccountId;
              if (nameFromProvider && nameFromProvider !== dbUserRecord.name) dbUserRecord.name = nameFromProvider;
              if (imageFromProvider && imageFromProvider !== dbUserRecord.image) dbUserRecord.image = imageFromProvider;
              if (dbUserRecord.name && dbUserRecord.name.trim() === "") {
                dbUserRecord.name = currentEmailFromProvider.split("@")[0];
              }
              await dbUserRecord.save();
            }
          }

          if (!dbUserRecord) {
            if (!currentEmailFromProvider) {
              logger.error(`${TAG_SIGNIN} [Google] Email ausente ao CRIAR novo utilizador Google.`);
              return false;
            }
            logger.info(`${TAG_SIGNIN} [Google] Criando NOVO utilizador para ${currentEmailFromProvider}…`);

            const finalNameForNewUser = nameFromProvider?.trim() || currentEmailFromProvider.split("@")[0];

            const newUserInDb = new DbUser({
              name: finalNameForNewUser,
              email: currentEmailFromProvider,
              image: imageFromProvider,
              provider,
              providerAccountId,
              role: "user",
              isNewUserForOnboarding: true,
              onboardingCompletedAt: null,
              communityInspirationOptIn: true,
              communityInspirationOptInDate: new Date(),
              communityInspirationTermsVersion: DEFAULT_TERMS_VERSION,
              isInstagramConnected: false,
              planStatus: "inactive",
            });
            dbUserRecord = await newUserInDb.save();
            isNewUser = true;
            logger.info(`${TAG_SIGNIN} [Google] Novo utilizador _id='${dbUserRecord._id}'. AffiliateCode: ${dbUserRecord.affiliateCode}`);
          }
        }

        if (dbUserRecord) {
          try {
            const cookieStore = cookies();
            const ref = cookieStore.get("d2c_ref")?.value;
            if (ref && !dbUserRecord.affiliateUsed) {
              if (!dbUserRecord.affiliateCode || dbUserRecord.affiliateCode !== ref) {
                const refUser = await DbUser.findOne({ affiliateCode: ref });
                if (refUser && String(refUser._id) !== String(dbUserRecord._id)) {
                  dbUserRecord.affiliateUsed = ref;
                  await dbUserRecord.save();
                }
              }
            }
          } catch (e) {
            logger.warn("[NextAuth signIn] falha ao aplicar affiliateUsed", e);
          }

          authUserFromProvider.id = dbUserRecord._id.toString();
          authUserFromProvider.name = dbUserRecord.name;
          authUserFromProvider.email = dbUserRecord.email;
          authUserFromProvider.image = dbUserRecord.image;

          (authUserFromProvider as NextAuthUserArg).role = dbUserRecord.role ?? "user";
          (authUserFromProvider as NextAuthUserArg).isNewUserForOnboarding =
            (provider === "google" && isNewUser) || (dbUserRecord.isNewUserForOnboarding ?? false);
          (authUserFromProvider as NextAuthUserArg).onboardingCompletedAt = dbUserRecord.onboardingCompletedAt;
          (authUserFromProvider as NextAuthUserArg).provider = dbUserRecord.provider ?? provider;

          // Instagram
          (authUserFromProvider as NextAuthUserArg).isInstagramConnected = dbUserRecord.isInstagramConnected ?? false;
          (authUserFromProvider as NextAuthUserArg).instagramAccountId = dbUserRecord.instagramAccountId;
          (authUserFromProvider as NextAuthUserArg).instagramUsername = dbUserRecord.username;
          (authUserFromProvider as NextAuthUserArg).lastInstagramSyncAttempt = dbUserRecord.lastInstagramSyncAttempt;
          (authUserFromProvider as NextAuthUserArg).lastInstagramSyncSuccess = dbUserRecord.lastInstagramSyncSuccess;
          (authUserFromProvider as NextAuthUserArg).instagramSyncErrorMsg = dbUserRecord.instagramSyncErrorMsg;
          (authUserFromProvider as NextAuthUserArg).availableIgAccounts =
            (dbUserRecord.availableIgAccounts as ServiceAvailableIgAccount[] | null | undefined);
          (authUserFromProvider as NextAuthUserArg).instagramAccessToken = dbUserRecord.instagramAccessToken;

          // Billing
          (authUserFromProvider as NextAuthUserArg).planStatus = dbUserRecord.planStatus;
          (authUserFromProvider as NextAuthUserArg).planType = dbUserRecord.planType;
          (authUserFromProvider as NextAuthUserArg).planInterval = dbUserRecord.planInterval;
          (authUserFromProvider as NextAuthUserArg).planExpiresAt = dbUserRecord.planExpiresAt;
          (authUserFromProvider as NextAuthUserArg).cancelAtPeriodEnd = (dbUserRecord as any).cancelAtPeriodEnd ?? null;
          // Stripe IDs
          (authUserFromProvider as any).stripeCustomerId = dbUserRecord.stripeCustomerId ?? null;
          (authUserFromProvider as any).stripeSubscriptionId = dbUserRecord.stripeSubscriptionId ?? null;
          (authUserFromProvider as any).stripePriceId = dbUserRecord.stripePriceId ?? null;

          // Afiliados
          (authUserFromProvider as NextAuthUserArg).affiliateCode = dbUserRecord.affiliateCode;
          (authUserFromProvider as any).affiliateBalances = normalizeBalances((dbUserRecord as any).affiliateBalances);

          // Stripe Connect
          (authUserFromProvider as any).stripeAccountStatus = dbUserRecord.paymentInfo?.stripeAccountStatus ?? null;
          (authUserFromProvider as any).stripeAccountDefaultCurrency = dbUserRecord.paymentInfo?.stripeAccountDefaultCurrency ?? null;

          (authUserFromProvider as NextAuthUserArg).agency = dbUserRecord.agency ? dbUserRecord.agency.toString() : undefined;

          logger.debug(
            `${TAG_SIGNIN} [${provider}] FINAL signIn. authUser.id: '${authUserFromProvider.id}', provider: '${(authUserFromProvider as NextAuthUserArg).provider}', planStatus: ${(authUserFromProvider as NextAuthUserArg).planStatus}, igAccountsCount: ${(authUserFromProvider as NextAuthUserArg).availableIgAccounts?.length ?? 0}, igLlatSet: ${!!(authUserFromProvider as NextAuthUserArg).instagramAccessToken}`
          );
          return true;
        } else {
          logger.error(`${TAG_SIGNIN} [${provider}] dbUserRecord não definido. Falha no signIn.`);
          return false;
        }
      } catch (error) {
        logger.error(`${TAG_SIGNIN} Erro no DB durante signIn para ${provider} (ProviderAccID: ${providerAccountId}):`, error);
        return false;
      }
    },

    async jwt({ token, user: userFromSignIn, trigger }) {
      const TAG_JWT = "[NextAuth JWT v2.3.0]";
      logger.debug(
        `${TAG_JWT} Iniciado. Trigger: ${trigger}. UserID(signIn): ${userFromSignIn?.id}. TokenInID: ${token?.id}. Token.planStatus(in): ${token.planStatus}, Token.affiliateCode(in): ${token.affiliateCode}`
      );

      if (typeof token.affiliateCode === "undefined") token.affiliateCode = null;
      if (typeof token.affiliateBalances === "undefined") token.affiliateBalances = {};
      if (typeof (token as any).cancelAtPeriodEnd === "undefined") (token as any).cancelAtPeriodEnd = null;

      if ((trigger === "signIn" || trigger === "signUp") && userFromSignIn) {
        token.id = (userFromSignIn as any).id;
        token.sub = (userFromSignIn as any).id;
        token.name = userFromSignIn.name;
        token.email = userFromSignIn.email;
        token.image = (userFromSignIn as any).image;
        token.role = (userFromSignIn as NextAuthUserArg).role ?? "user";
        token.provider = (userFromSignIn as NextAuthUserArg).provider;

        // Onboarding
        token.isNewUserForOnboarding = (userFromSignIn as NextAuthUserArg).isNewUserForOnboarding;
        token.onboardingCompletedAt = (userFromSignIn as NextAuthUserArg).onboardingCompletedAt;

        // Instagram
        token.isInstagramConnected = (userFromSignIn as NextAuthUserArg).isInstagramConnected;
        token.instagramAccountId = (userFromSignIn as NextAuthUserArg).instagramAccountId;
        token.instagramUsername = (userFromSignIn as NextAuthUserArg).instagramUsername;
        token.lastInstagramSyncAttempt = (userFromSignIn as NextAuthUserArg).lastInstagramSyncAttempt;
        token.lastInstagramSyncSuccess = (userFromSignIn as NextAuthUserArg).lastInstagramSyncSuccess;
        token.igConnectionError = (userFromSignIn as NextAuthUserArg).instagramSyncErrorMsg ?? null;
        token.availableIgAccounts = (userFromSignIn as NextAuthUserArg).availableIgAccounts;
        token.instagramAccessToken = (userFromSignIn as NextAuthUserArg).instagramAccessToken;

        // Billing
        const rawStatus = (userFromSignIn as NextAuthUserArg).planStatus;
        token.planStatus = normalizePlanStatusValue(rawStatus);
        token.planType = (userFromSignIn as NextAuthUserArg).planType;
        token.planInterval = (userFromSignIn as NextAuthUserArg).planInterval;
        token.planExpiresAt = (userFromSignIn as NextAuthUserArg).planExpiresAt;
        (token as any).cancelAtPeriodEnd =
          (userFromSignIn as NextAuthUserArg).cancelAtPeriodEnd ??
          (isNonRenewing(rawStatus) ? true : null);

        // Stripe IDs
        (token as any).stripeCustomerId = (userFromSignIn as any).stripeCustomerId ?? null;
        (token as any).stripeSubscriptionId = (userFromSignIn as any).stripeSubscriptionId ?? null;
        (token as any).stripePriceId = (userFromSignIn as any).stripePriceId ?? null;

        // Afiliados
        token.affiliateCode = (userFromSignIn as NextAuthUserArg).affiliateCode;
        const anyUser = userFromSignIn as any;
        token.affiliateBalances = normalizeBalances(anyUser.affiliateBalances);

        // Stripe Connect
        token.stripeAccountStatus = anyUser.stripeAccountStatus ?? null;
        token.stripeAccountDefaultCurrency = anyUser.stripeAccountDefaultCurrency ?? null;

        // Agência
        token.agencyId = (userFromSignIn as NextAuthUserArg).agency ?? null;
        if (token.agencyId) {
          try {
            await connectToDatabase();
            const agency = await AgencyModel.findById(token.agencyId).select("planStatus planType").lean();
            token.agencyPlanStatus = agency?.planStatus ?? null;
            token.agencyPlanType = agency?.planType ?? null;
          } catch (e) {
            logger.error(`${TAG_JWT} Erro ao buscar planStatus da agência ${token.agencyId}:`, e);
            token.agencyPlanStatus = null;
            token.agencyPlanType = null;
          }
        } else {
          token.agencyPlanStatus = null;
          token.agencyPlanType = null;
        }

        logger.info(
          `${TAG_JWT} Token populado de userFromSignIn. ID: ${token.id}, Provider: ${token.provider}, planStatus: ${token.planStatus}, igAccounts: ${token.availableIgAccounts?.length}, igLlatSet: ${!!token.instagramAccessToken}`
        );
      }

      // Fallback forte: garante id presente fora do fluxo de signIn
      if (!ensureStringId(token.id) && ensureStringId((token as any).sub)) {
        token.id = String((token as any).sub);
      }
      if (!ensureStringId(token.id)) {
        // Tenta recuperar pelo email (uma vez)
        if (token.email) {
          try {
            await connectToDatabase();
            const u = await DbUser.findOne({ email: token.email }).select("_id").lean();
            if (u?._id) {
              token.id = u._id.toString();
              token.sub = token.id;
              logger.warn(`${TAG_JWT} Recuperado token.id via lookup por email (${token.email}).`);
            }
          } catch (e) {
            logger.error(`${TAG_JWT} Falha ao recuperar id por email:`, e);
          }
        }
      }
      if (!ensureStringId(token.id)) {
        logger.warn(`${TAG_JWT} Persistindo token SEM id mesmo após fallbacks. Invalidando token.`);
        return {} as JWT;
      }

      if (token.id && Types.ObjectId.isValid(token.id)) {
        // NEW: se o token diz "inactive" mas há sinais de assinatura/expiração/cancelamento, forçamos refresh imediato
        const inactiveButHasSignals =
          normalizePlanStatusValue(token.planStatus) === "inactive" &&
          ((token as any).stripeSubscriptionId || token.planExpiresAt || (token as any).cancelAtPeriodEnd);

        let needsDbRefresh =
          trigger === "update" ||
          inactiveButHasSignals || // <- PATCH principal
          !token.role ||
          typeof token.planStatus === "undefined" ||
          typeof token.planType === "undefined" ||
          typeof token.planInterval === "undefined" ||
          typeof token.affiliateCode === "undefined" ||
          typeof token.affiliateBalances === "undefined" ||
          typeof (token as any).cancelAtPeriodEnd === "undefined" ||
          typeof token.stripeAccountStatus === "undefined" ||
          typeof token.stripeAccountDefaultCurrency === "undefined" ||
          (typeof token.isInstagramConnected === "undefined" && typeof token.availableIgAccounts === "undefined");

        const tokenIssuedAt = token.iat;
        if (!needsDbRefresh && tokenIssuedAt && typeof tokenIssuedAt === "number") {
          const nowInSeconds = Math.floor(Date.now() / 1000);
          const tokenAgeInMinutes = (nowInSeconds - tokenIssuedAt) / 60;
          if (tokenAgeInMinutes > MAX_TOKEN_AGE_BEFORE_REFRESH_MINUTES) {
            logger.info(`${TAG_JWT} Token com ${tokenAgeInMinutes.toFixed(0)} min de idade. Forçando refresh do DB.`);
            needsDbRefresh = true;
          }
        }

        if (needsDbRefresh) {
          logger.debug(`${TAG_JWT} Trigger '${trigger}' ou refresh necessário. Buscando dados frescos do DB para token ID: ${token.id}`);
          try {
            await connectToDatabase();
            const dbUser = await DbUser.findById(token.id)
              .select(
                "name email image role agency provider providerAccountId facebookProviderAccountId " +
                  "isNewUserForOnboarding onboardingCompletedAt " +
                  "isInstagramConnected instagramAccountId username lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorMsg " +
                  "planStatus planType planInterval planExpiresAt cancelAtPeriodEnd " +
                  "stripeCustomerId stripeSubscriptionId stripePriceId " +
                  "affiliateCode availableIgAccounts instagramAccessToken affiliateBalances " +
                  "paymentInfo.stripeAccountStatus paymentInfo.stripeAccountDefaultCurrency"
              )
              .lean<IUser>();

            if (dbUser) {
              const rawDbPlanStatus = dbUser.planStatus;

              token.name = dbUser.name ?? token.name;
              token.email = dbUser.email ?? token.email;
              token.image = dbUser.image ?? token.image;
              token.role = dbUser.role ?? token.role ?? "user";
              token.provider = dbUser.provider ?? token.provider;

              // Onboarding
              token.isNewUserForOnboarding =
                typeof dbUser.isNewUserForOnboarding === "boolean" ? dbUser.isNewUserForOnboarding : token.isNewUserForOnboarding ?? false;
              token.onboardingCompletedAt = dbUser.onboardingCompletedAt ?? token.onboardingCompletedAt ?? null;

              // Instagram
              token.isInstagramConnected = dbUser.isInstagramConnected ?? token.isInstagramConnected ?? false;
              token.instagramAccountId = dbUser.instagramAccountId ?? token.instagramAccountId ?? null;
              token.instagramUsername = dbUser.username ?? token.instagramUsername ?? null;
              token.lastInstagramSyncAttempt = dbUser.lastInstagramSyncAttempt ?? token.lastInstagramSyncAttempt ?? null;
              token.lastInstagramSyncSuccess = dbUser.lastInstagramSyncSuccess ?? token.lastInstagramSyncSuccess ?? null;
              token.igConnectionError = dbUser.instagramSyncErrorMsg ?? token.igConnectionError ?? null;
              if (dbUser.isInstagramConnected && !dbUser.instagramSyncErrorMsg) token.igConnectionError = null;
              token.availableIgAccounts =
                (dbUser.availableIgAccounts as ServiceAvailableIgAccount[] | null | undefined) ?? token.availableIgAccounts ?? null;
              token.instagramAccessToken = dbUser.instagramAccessToken ?? token.instagramAccessToken ?? null;

              // Billing
              token.planStatus =
                normalizePlanStatusValue(rawDbPlanStatus) ??
                normalizePlanStatusValue(token.planStatus) ??
                "inactive";
              token.planType = dbUser.planType ?? token.planType ?? null;
              token.planInterval = dbUser.planInterval ?? token.planInterval ?? null;
              token.planExpiresAt = dbUser.planExpiresAt ?? token.planExpiresAt ?? null;
              (token as any).cancelAtPeriodEnd =
                (dbUser as any).cancelAtPeriodEnd ??
                (token as any).cancelAtPeriodEnd ??
                (isNonRenewing(rawDbPlanStatus) ? true : null);

              // Stripe IDs
              (token as any).stripeCustomerId = dbUser.stripeCustomerId ?? (token as any).stripeCustomerId ?? null;
              (token as any).stripeSubscriptionId = dbUser.stripeSubscriptionId ?? (token as any).stripeSubscriptionId ?? null;
              (token as any).stripePriceId = dbUser.stripePriceId ?? (token as any).stripePriceId ?? null;

              // Afiliados
              token.affiliateCode = dbUser.affiliateCode ?? token.affiliateCode ?? null;
              token.affiliateBalances = normalizeBalances((dbUser as any).affiliateBalances);

              // Stripe Connect
              token.stripeAccountStatus = dbUser.paymentInfo?.stripeAccountStatus ?? null;
              token.stripeAccountDefaultCurrency = dbUser.paymentInfo?.stripeAccountDefaultCurrency ?? null;

              // Agência
              token.agencyId = dbUser.agency ? dbUser.agency.toString() : token.agencyId ?? null;
              if (token.agencyId) {
                try {
                  const agency = await AgencyModel.findById(token.agencyId).select("planStatus planType").lean();
                  token.agencyPlanStatus = agency?.planStatus ?? null;
                  token.agencyPlanType = agency?.planType ?? null;
                } catch (e) {
                  logger.error(`${TAG_JWT} Erro ao buscar planStatus da agência ${token.agencyId}:`, e);
                  token.agencyPlanStatus = null;
                  token.agencyPlanType = null;
                }
              } else {
                token.agencyPlanStatus = null;
                token.agencyPlanType = null;
              }

              logger.info(
                `${TAG_JWT} Token atualizado do DB. ID: ${token.id}, Provider: ${token.provider}, planStatus: ${token.planStatus}, igAccounts: ${token.availableIgAccounts?.length}, igLlatSet: ${!!token.instagramAccessToken}, igErr: ${
                  token.igConnectionError ? "Sim (" + String(token.igConnectionError).substring(0, 30) + "...)" : "Não"
                }`
              );
            } else {
              logger.warn(`${TAG_JWT} Utilizador ${token.id} não encontrado no DB. Invalidando token.`);
              return {} as JWT;
            }
          } catch (error) {
            logger.error(`${TAG_JWT} Erro ao enriquecer token ${token.id} do DB:`, error);
          }
        }
      } else {
        if (trigger !== "signIn" && trigger !== "signUp") {
          logger.warn(`${TAG_JWT} Token com ID inválido/ausente ('${(token as any).id}') fora do login/signup. Invalidando.`);
          return {} as JWT;
        }
      }

      if (token.image && (token as any).picture) delete (token as any).picture;

      logger.debug(
        `${TAG_JWT} FINAL jwt. Token id: '${(token as any).id}', provider: '${(token as any).provider}', planStatus: ${(token as any).planStatus}, agencyPlanStatus: ${(token as any).agencyPlanStatus}, affiliateCode: ${(token as any).affiliateCode}, agencyId: ${(token as any).agencyId}`
      );
      return token;
    },

    async session({ session, token }) {
      const TAG_SESSION = "[NextAuth Session v2.3.0]";
      logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token.Provider: ${token?.provider}, Token.planStatus: ${token?.planStatus}`);

      if (!token?.id || !Types.ObjectId.isValid(token.id)) {
        logger.error(`${TAG_SESSION} Token ID inválido/ausente ('${token?.id}') na sessão. Retornando sessão básica.`);
        return { ...session, user: undefined, expires: session.expires };
      }

      if (session.user) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.image;
        session.user.role = token.role;
        session.user.provider = token.provider;

        // Onboarding
        session.user.isNewUserForOnboarding = token.isNewUserForOnboarding;
        session.user.onboardingCompletedAt = token.onboardingCompletedAt ? new Date(token.onboardingCompletedAt).toISOString() : null;

        // Instagram
        session.user.instagramConnected = token.isInstagramConnected ?? undefined;
        session.user.instagramAccountId = token.instagramAccountId;
        session.user.instagramUsername = token.instagramUsername;
        session.user.igConnectionError = token.igConnectionError;
        session.user.availableIgAccounts = token.availableIgAccounts;
        session.user.instagramAccessToken = token.instagramAccessToken;
        session.user.lastInstagramSyncAttempt = token.lastInstagramSyncAttempt ? new Date(token.lastInstagramSyncAttempt).toISOString() : null;
        session.user.lastInstagramSyncSuccess = token.lastInstagramSyncSuccess;

        // Billing
        session.user.planStatus = normalizePlanStatusValue(token.planStatus) ?? "inactive";
        session.user.planType = token.planType ?? null;
        session.user.planInterval = token.planInterval ?? null;
        session.user.planExpiresAt = token.planExpiresAt ? new Date(token.planExpiresAt).toISOString() : null;
        session.user.cancelAtPeriodEnd = !!token.cancelAtPeriodEnd;
        // Stripe IDs
        session.user.stripeCustomerId = (token as any).stripeCustomerId ?? null;
        session.user.stripeSubscriptionId = (token as any).stripeSubscriptionId ?? null;
        session.user.stripePriceId = (token as any).stripePriceId ?? null;

        // Agência
        (session.user as any).agencyId = token.agencyId ?? null;
        (session.user as any).agencyPlanStatus = token.agencyPlanStatus ?? null;
        (session.user as any).agencyPlanType = token.agencyPlanType ?? null;

        // Afiliados
        session.user.affiliateCode = token.affiliateCode;
        session.user.affiliateBalances = token.affiliateBalances || {};
        (session.user as any).affiliateRank = (session.user as any).affiliateRank ?? undefined;
        (session.user as any).affiliateInvites = (session.user as any).affiliateInvites ?? undefined;

        // Stripe Connect
        session.user.stripeAccountStatus = token.stripeAccountStatus ?? null;
        session.user.stripeAccountDefaultCurrency = token.stripeAccountDefaultCurrency ?? null;
      }

      session.affiliateCode = token.affiliateCode ?? null;
      session.affiliateBalances = token.affiliateBalances || {};

      try {
        await connectToDatabase();
        const dbUserCheck = await DbUser.findById(token.id)
          .select(
            "planStatus planType planInterval planExpiresAt cancelAtPeriodEnd " +
              "stripeCustomerId stripeSubscriptionId stripePriceId " +
              "name role image"
          )
          .lean<
            Pick<
              IUser,
              | "planStatus"
              | "planType"
              | "planInterval"
              | "planExpiresAt"
              | "name"
              | "role"
              | "image"
              | "stripeCustomerId"
              | "stripeSubscriptionId"
              | "stripePriceId"
            > & { cancelAtPeriodEnd?: boolean | null }
          >();

        if (dbUserCheck && session.user) {
          logger.info(`${TAG_SESSION} Revalidando sessão com dados do DB para User ID: ${token.id}. DB planStatus: ${dbUserCheck.planStatus}.`);
          // ⚠️ Usar status normalizado para não reintroduzir 'trialing' ou 'non_renewing'
          session.user.planStatus = normalizePlanStatusValue(dbUserCheck.planStatus) ?? session.user.planStatus ?? "inactive";
          session.user.planType = dbUserCheck.planType ?? session.user.planType ?? null;
          session.user.planInterval = dbUserCheck.planInterval ?? session.user.planInterval ?? null;

          if (dbUserCheck.planExpiresAt instanceof Date) session.user.planExpiresAt = dbUserCheck.planExpiresAt.toISOString();
          else if (dbUserCheck.planExpiresAt === null) session.user.planExpiresAt = null;

          session.user.cancelAtPeriodEnd =
            typeof dbUserCheck.cancelAtPeriodEnd === "boolean"
              ? dbUserCheck.cancelAtPeriodEnd
              : (session.user.cancelAtPeriodEnd ?? false) || isNonRenewing(dbUserCheck.planStatus);

          // Stripe IDs
          session.user.stripeCustomerId = (dbUserCheck as any).stripeCustomerId ?? session.user.stripeCustomerId ?? null;
          session.user.stripeSubscriptionId = (dbUserCheck as any).stripeSubscriptionId ?? session.user.stripeSubscriptionId ?? null;
          session.user.stripePriceId = (dbUserCheck as any).stripePriceId ?? session.user.stripePriceId ?? null;

          if (dbUserCheck.name) session.user.name = dbUserCheck.name;
          if (dbUserCheck.role) session.user.role = dbUserCheck.role;
          if (dbUserCheck.image) session.user.image = dbUserCheck.image;
        } else if (!dbUserCheck) {
          logger.warn(`${TAG_SESSION} Utilizador ${token.id} não encontrado no DB. Usando dados do token.`);
        }
      } catch (error) {
        logger.error(`${TAG_SESSION} Erro ao revalidar sessão ${token.id}:`, error);
      }

      logger.debug(
        `${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, planStatus: ${session.user?.planStatus}, cancelAtPeriodEnd: ${session.user?.cancelAtPeriodEnd}, stripeSub: ${session.user?.stripeSubscriptionId}`
      );
      return session;
    },

    async redirect({ url, baseUrl }) {
      const requestedUrl = new URL(url, baseUrl);
      const base = new URL(baseUrl);

      if (requestedUrl.origin === base.origin) {
        logger.debug(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é interna. Permitindo.`);
        return requestedUrl.toString();
      }

      logger.warn(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é externa/ inválida. Redirecionando para baseUrl: ${baseUrl}.`);
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
