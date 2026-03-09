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
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from "@/app/lib/mongoTransient";

import { fetchAvailableInstagramAccounts } from "@/app/lib/instagram";
import type { AvailableInstagramAccount as ServiceAvailableIgAccount } from "@/app/lib/instagram/types";
import type { ProTrialState } from "@/types/billing";
import { isInstagramReconnectV2Enabled } from "@/app/lib/instagram/reconnectConfig";
import {
  IG_RECONNECT_ERROR_CODES,
  inferReconnectErrorCodeFromMessage,
  normalizeInstagramReconnectErrorCode,
  type InstagramReconnectErrorCode,
} from "@/app/lib/instagram/reconnectErrors";
import {
  generateInstagramReconnectFlowId,
  INSTAGRAM_RECONNECT_FLOW_COOKIE_NAME,
  normalizeInstagramReconnectFlowId,
} from "@/app/lib/instagram/reconnectFlow";

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
    instagramSyncErrorCode?: string | null;
    availableIgAccounts?: ServiceAvailableIgAccount[] | null;
    lastInstagramSyncAttempt?: Date | null;
    lastInstagramSyncSuccess?: boolean | null;
    instagramReconnectNotifiedAt?: Date | null;
    instagramDisconnectCount?: number;
    instagramReconnectState?: "idle" | "oauth_in_progress" | "awaiting_account_selection" | "finalizing" | "connected" | "failed" | null;
    instagramReconnectFlowId?: string | null;

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

    // Trial (Plano Pro)
    proTrialStatus?: ProTrialState | null;
    proTrialActivatedAt?: Date | null;
    proTrialExpiresAt?: Date | null;

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

      // Parceiro
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
      // Trial (Plano Pro)
      proTrialStatus?: ProTrialState | null;
      proTrialActivatedAt?: string | null;
      proTrialExpiresAt?: string | null;

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
      igConnectionErrorCode?: string | null;
      availableIgAccounts?: ServiceAvailableIgAccount[] | null;
      lastInstagramSyncAttempt?: string | null;
      lastInstagramSyncSuccess?: boolean | null;
      instagramReconnectNotifiedAt?: string | null;
      instagramDisconnectCount?: number;
      instagramReconnectState?: "idle" | "oauth_in_progress" | "awaiting_account_selection" | "finalizing" | "connected" | "failed" | null;
      instagramReconnectFlowId?: string | null;

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
    igConnectionErrorCode?: string | null;
    availableIgAccounts?: ServiceAvailableIgAccount[] | null;
    lastInstagramSyncAttempt?: Date | string | null;
    lastInstagramSyncSuccess?: boolean | null;
    instagramReconnectNotifiedAt?: Date | string | null;
    instagramDisconnectCount?: number;
    instagramReconnectState?: "idle" | "oauth_in_progress" | "awaiting_account_selection" | "finalizing" | "connected" | "failed" | null;
    instagramReconnectFlowId?: string | null;

    // Billing
    planStatus?: string | null;
    planType?: string | null;
    planInterval?: string | null;
    planExpiresAt?: Date | string | null;
    cancelAtPeriodEnd?: boolean | null;
    proTrialStatus?: ProTrialState | null;
    proTrialActivatedAt?: Date | string | null;
    proTrialExpiresAt?: Date | string | null;
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

type SessionRevalidationSnapshot = {
  planStatus?: string | null;
  planType?: string | null;
  planInterval?: string | null;
  planExpiresAt?: Date | string | null;
  cancelAtPeriodEnd?: boolean | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  proTrialStatus?: ProTrialState | null;
  proTrialActivatedAt?: Date | string | null;
  proTrialExpiresAt?: Date | string | null;
  name?: string | null;
  role?: string | null;
  image?: string | null;
};

type SessionRevalidationCacheEntry = {
  expiresAt: number;
  snapshot: SessionRevalidationSnapshot;
};

console.log("--- SERVER START --- NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
export const runtime = "nodejs";

const DEFAULT_TERMS_VERSION = "1.0_community_included";
const FACEBOOK_LINK_COOKIE_NAME = "auth-link-token";
const MAX_TOKEN_AGE_BEFORE_REFRESH_MINUTES = 60; // 1 hour
const DEV_E2E_USER_ID = "00000000000000000000e2e1";
const ALLOW_LOCAL_E2E_CREDENTIALS = process.env.ALLOW_LOCAL_E2E_CREDENTIALS === "1";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_LOCAL_E2E_HTTP =
  ALLOW_LOCAL_E2E_CREDENTIALS &&
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(process.env.NEXTAUTH_URL ?? "");
const USE_SECURE_AUTH_COOKIES = IS_PRODUCTION && !IS_LOCAL_E2E_HTTP;
const NEXTAUTH_OAUTH_COOKIE_MAX_AGE_SECONDS = 15 * 60;
const SESSION_DB_REVALIDATION_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.NEXTAUTH_SESSION_DB_REVALIDATION_CACHE_TTL_MS ?? 60_000);
  return Number.isFinite(parsed) && parsed >= 5_000 ? Math.floor(parsed) : 60_000;
})();

declare global {
  // eslint-disable-next-line no-var
  var __nextAuthSessionRevalidationCache: Map<string, SessionRevalidationCacheEntry> | undefined;
}

function buildAuthCookieName(baseName: string, prefix: "__Secure-" | "__Host-" | "") {
  return `${USE_SECURE_AUTH_COOKIES ? prefix : ""}next-auth.${baseName}`;
}

function getSessionRevalidationCache() {
  if (!global.__nextAuthSessionRevalidationCache) {
    global.__nextAuthSessionRevalidationCache = new Map<string, SessionRevalidationCacheEntry>();
  }
  return global.__nextAuthSessionRevalidationCache;
}

function pruneSessionRevalidationCache(nowTs: number) {
  const cache = getSessionRevalidationCache();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= nowTs) {
      cache.delete(key);
    }
  }
}

function applySessionRevalidationSnapshot(
  session: Session,
  snapshot: SessionRevalidationSnapshot,
) {
  if (!session.user) return;

  session.user.planStatus = normalizePlanStatusValue(snapshot.planStatus) ?? session.user.planStatus ?? "inactive";
  session.user.planType = snapshot.planType ?? session.user.planType ?? null;
  session.user.planInterval = snapshot.planInterval ?? session.user.planInterval ?? null;

  if (snapshot.planExpiresAt instanceof Date) session.user.planExpiresAt = snapshot.planExpiresAt.toISOString();
  else if (typeof snapshot.planExpiresAt === "string") session.user.planExpiresAt = new Date(snapshot.planExpiresAt).toISOString();
  else if (snapshot.planExpiresAt === null) session.user.planExpiresAt = null;

  session.user.cancelAtPeriodEnd =
    typeof snapshot.cancelAtPeriodEnd === "boolean"
      ? snapshot.cancelAtPeriodEnd
      : session.user.cancelAtPeriodEnd ?? false;

  session.user.stripeCustomerId = snapshot.stripeCustomerId ?? session.user.stripeCustomerId ?? null;
  session.user.stripeSubscriptionId = snapshot.stripeSubscriptionId ?? session.user.stripeSubscriptionId ?? null;
  session.user.stripePriceId = snapshot.stripePriceId ?? session.user.stripePriceId ?? null;
  session.user.proTrialStatus = snapshot.proTrialStatus ?? session.user.proTrialStatus ?? null;
  session.user.proTrialActivatedAt =
    snapshot.proTrialActivatedAt instanceof Date
      ? snapshot.proTrialActivatedAt.toISOString()
      : typeof snapshot.proTrialActivatedAt === "string"
        ? new Date(snapshot.proTrialActivatedAt).toISOString()
        : session.user.proTrialActivatedAt ?? null;
  session.user.proTrialExpiresAt =
    snapshot.proTrialExpiresAt instanceof Date
      ? snapshot.proTrialExpiresAt.toISOString()
      : typeof snapshot.proTrialExpiresAt === "string"
        ? new Date(snapshot.proTrialExpiresAt).toISOString()
        : session.user.proTrialExpiresAt ?? null;

  if (snapshot.name) session.user.name = snapshot.name;
  if (snapshot.role) session.user.role = snapshot.role;
  if (snapshot.image) session.user.image = snapshot.image;
}

function getDevE2EIdentity() {
  if (process.env.NODE_ENV === "production" && !ALLOW_LOCAL_E2E_CREDENTIALS) return null;
  const email = process.env.E2E_EMAIL?.trim();
  if (!email) return null;
  return {
    id: process.env.E2E_USER_ID?.trim() || DEV_E2E_USER_ID,
    email,
  };
}

function isDevE2EIdentity(params: {
  id?: string | null;
  email?: string | null;
  provider?: string | null;
}) {
  const identity = getDevE2EIdentity();
  if (!identity) return false;
  if (params.provider && params.provider !== "credentials") return false;
  return params.id === identity.id || params.email === identity.email;
}

function resolveDevE2ECredentialsUser(credentials: { email?: string | null; password?: string | null }) {
  const identity = getDevE2EIdentity();
  if (!identity) return null;
  const expectedPassword = process.env.E2E_PASSWORD?.trim();
  const providedEmail = credentials.email?.trim();
  const providedPassword = credentials.password?.trim();

  if (!expectedPassword) return null;
  if (providedEmail !== identity.email || providedPassword !== expectedPassword) return null;

  return {
    id: identity.id,
    name: "E2E Test User",
    email: identity.email,
    image: null,
    role: "user",
    agency: null,
    provider: "credentials",
    planStatus: "active",
    proTrialStatus: "active",
  } as NextAuthUserArg;
}

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

function resolveReconnectErrorCode(
  message?: string | null,
  fallback: InstagramReconnectErrorCode = IG_RECONNECT_ERROR_CODES.UNKNOWN
): InstagramReconnectErrorCode {
  const inferred = inferReconnectErrorCodeFromMessage(message ?? undefined);
  return inferred === IG_RECONNECT_ERROR_CODES.UNKNOWN ? fallback : inferred;
}

function resolveReconnectErrorCodeFromFetchFailure(params: {
  message?: string | null;
  fetchReconnectErrorCode?: string | null;
  fallback?: InstagramReconnectErrorCode;
}): InstagramReconnectErrorCode {
  const normalizedFromFetch = normalizeInstagramReconnectErrorCode(
    params.fetchReconnectErrorCode ?? null
  );
  if (normalizedFromFetch !== IG_RECONNECT_ERROR_CODES.UNKNOWN) {
    return normalizedFromFetch;
  }
  return resolveReconnectErrorCode(
    params.message,
    params.fallback ?? IG_RECONNECT_ERROR_CODES.UNKNOWN
  );
}

function resolveReconnectFlowId(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const normalized = normalizeInstagramReconnectFlowId(candidate);
    if (normalized) return normalized;
  }
  return generateInstagramReconnectFlowId();
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

  // nunca gravar id vazio; usa sub->id; se nada, assina sem subject e mantém sessão básica
  const idFromToken = ensureStringId(cleanToken.id) ?? ensureStringId(cleanToken.sub);
  if (idFromToken) {
    cleanToken.id = idFromToken;
  } else {
    logger.warn(`${TAG_ENCODE} Token sem id/sub. Assinando JWT sem subject (sessão básica).`);
    delete (cleanToken as any).id;
    delete (cleanToken as any).sub;
  }

  if (cleanToken.onboardingCompletedAt instanceof Date) {
    cleanToken.onboardingCompletedAt = cleanToken.onboardingCompletedAt.toISOString();
  }
  if (cleanToken.lastInstagramSyncAttempt instanceof Date) {
    cleanToken.lastInstagramSyncAttempt = cleanToken.lastInstagramSyncAttempt.toISOString();
  }
  if (cleanToken.instagramReconnectNotifiedAt instanceof Date) {
    cleanToken.instagramReconnectNotifiedAt = cleanToken.instagramReconnectNotifiedAt.toISOString();
  }
  if (cleanToken.planExpiresAt instanceof Date) {
    cleanToken.planExpiresAt = cleanToken.planExpiresAt.toISOString();
  }
  if (cleanToken.proTrialActivatedAt instanceof Date) {
    cleanToken.proTrialActivatedAt = cleanToken.proTrialActivatedAt.toISOString();
  }
  if (cleanToken.proTrialExpiresAt instanceof Date) {
    cleanToken.proTrialExpiresAt = cleanToken.proTrialExpiresAt.toISOString();
  }

  if (cleanToken.image && cleanToken.picture) delete cleanToken.picture;
  delete cleanToken.instagramSyncErrorMsg;
  delete cleanToken.instagramSyncErrorCode;
  delete cleanToken.instagramAccessToken;

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

  const builder = new SignJWT(cleanToken)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime);

  if (idFromToken) builder.setSubject(idFromToken);

  return builder.sign(new TextEncoder().encode(secretString));
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
    if (typeof decodedPayload.proTrialActivatedAt === "string") {
      decodedPayload.proTrialActivatedAt = new Date(decodedPayload.proTrialActivatedAt);
    }
    if (typeof decodedPayload.proTrialExpiresAt === "string") {
      decodedPayload.proTrialExpiresAt = new Date(decodedPayload.proTrialExpiresAt);
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

const authOptionsConfig = {
  useSecureCookies: USE_SECURE_AUTH_COOKIES,
  trustHost: true,
  cookies: {
    sessionToken: {
      name: buildAuthCookieName("session-token", "__Secure-"),
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: USE_SECURE_AUTH_COOKIES,
      },
    },
    callbackUrl: {
      name: buildAuthCookieName("callback-url", "__Secure-"),
      options: { sameSite: "lax", path: "/", secure: USE_SECURE_AUTH_COOKIES },
    },
    csrfToken: {
      name: buildAuthCookieName("csrf-token", "__Host-"),
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: USE_SECURE_AUTH_COOKIES },
    },
    state: {
      name: buildAuthCookieName("state", "__Secure-"),
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: USE_SECURE_AUTH_COOKIES,
        maxAge: NEXTAUTH_OAUTH_COOKIE_MAX_AGE_SECONDS,
      },
    },
    nonce: {
      name: buildAuthCookieName("nonce", "__Secure-"),
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: USE_SECURE_AUTH_COOKIES,
        maxAge: NEXTAUTH_OAUTH_COOKIE_MAX_AGE_SECONDS,
      },
    },
    pkceCodeVerifier: {
      name: buildAuthCookieName("pkce.code_verifier", "__Secure-"),
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: USE_SECURE_AUTH_COOKIES,
        maxAge: NEXTAUTH_OAUTH_COOKIE_MAX_AGE_SECONDS,
      },
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
        const devE2EUser = resolveDevE2ECredentialsUser({
          email: credentials.email,
          password: credentials.password,
        });
        if (devE2EUser) {
          logger.info(`[NextAuth Credentials] Login dev/E2E liberado para ${devE2EUser.email}`);
          return devE2EUser;
        }
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
          proTrialStatus: user.proTrialStatus ?? null,
          proTrialActivatedAt: user.proTrialActivatedAt ?? null,
          proTrialExpiresAt: user.proTrialExpiresAt ?? null,
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
      const reconnectV2Enabled = isInstagramReconnectV2Enabled();

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
          const reconnectFlowIdFromCookie = normalizeInstagramReconnectFlowId(
            cookieStore.get(INSTAGRAM_RECONNECT_FLOW_COOKIE_NAME)?.value
          );

          if (linkTokenFromCookie) {
            dbUserRecord = await DbUser.findOne({
              linkToken: linkTokenFromCookie,
              linkTokenExpiresAt: { $gt: new Date() },
            });

            if (dbUserRecord) {
              const reconnectFlowId = resolveReconnectFlowId(
                dbUserRecord.instagramReconnectFlowId,
                reconnectFlowIdFromCookie
              );
              dbUserRecord.instagramReconnectFlowId = reconnectFlowId;
              logger.info(`${TAG_SIGNIN} [Facebook] Utilizador Data2Content ${dbUserRecord._id} (Email DB: ${dbUserRecord.email || "N/A"}) encontrado por linkToken. flowId=${reconnectFlowId}`);
              // Evita vincular uma conta Facebook já usada por outro usuário
              const conflict = await DbUser.findOne({
                facebookProviderAccountId: providerAccountId,
                _id: { $ne: dbUserRecord._id },
              }).select('_id email').lean();
              if (conflict) {
                logger.warn(`${TAG_SIGNIN} [Facebook] providerAccountId ${providerAccountId} já vinculado a outro usuário ${conflict._id}. Abortando. flowId=${reconnectFlowId}`);
                dbUserRecord.instagramReconnectState = "failed";
                dbUserRecord.instagramReconnectUpdatedAt = new Date();
                dbUserRecord.instagramSyncErrorCode = IG_RECONNECT_ERROR_CODES.FACEBOOK_ALREADY_LINKED;
                dbUserRecord.instagramSyncErrorMsg = "Esta conta do Facebook já está vinculada a outro usuário.";
                await dbUserRecord.save();
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
              dbUserRecord.instagramReconnectState = "oauth_in_progress";
              dbUserRecord.instagramReconnectUpdatedAt = new Date();

              if (account?.access_token) {
                logger.info(`${TAG_SIGNIN} [Facebook] Obtendo contas IG/LLAT… flowId=${reconnectFlowId}`);
                try {
                  const igAccountsResult = await fetchAvailableInstagramAccounts(account.access_token, dbUserRecord._id.toString());
                  if (igAccountsResult.success) {
                    logger.info(`${TAG_SIGNIN} [Facebook] ${igAccountsResult.accounts.length} contas IG; LLAT ${igAccountsResult.longLivedAccessToken ? "OK" : "N/A"}. flowId=${reconnectFlowId}`);
                    dbUserRecord.availableIgAccounts = igAccountsResult.accounts;
                    dbUserRecord.instagramAccessToken = igAccountsResult.longLivedAccessToken ?? undefined;
                    dbUserRecord.instagramAccessTokenExpiresAt = (igAccountsResult as any).longLivedAccessTokenExpiresAt ?? undefined;
                    dbUserRecord.instagramSyncErrorMsg = null;
                    dbUserRecord.instagramSyncErrorCode = null;
                    dbUserRecord.instagramReconnectState = "awaiting_account_selection";
                    dbUserRecord.instagramReconnectUpdatedAt = new Date();
                    if (!reconnectV2Enabled) {
                      dbUserRecord.isInstagramConnected = false;
                      dbUserRecord.instagramAccountId = null;
                      dbUserRecord.username = null;
                    }
                  } else {
                    logger.error(`${TAG_SIGNIN} [Facebook] Falha IG: ${igAccountsResult.error}. flowId=${reconnectFlowId}`);
                    dbUserRecord.instagramSyncErrorMsg = igAccountsResult.error;
                    dbUserRecord.instagramSyncErrorCode = resolveReconnectErrorCodeFromFetchFailure({
                      message: igAccountsResult.error,
                      fetchReconnectErrorCode: igAccountsResult.reconnectErrorCode ?? null,
                      fallback: IG_RECONNECT_ERROR_CODES.NO_IG_ACCOUNT,
                    });
                    dbUserRecord.availableIgAccounts = [];
                    dbUserRecord.instagramReconnectState = "failed";
                    dbUserRecord.instagramReconnectUpdatedAt = new Date();
                    if (!reconnectV2Enabled) {
                      dbUserRecord.instagramAccessToken = undefined;
                    }
                  }
                } catch (fetchError: any) {
                  logger.error(`${TAG_SIGNIN} [Facebook] Erro crítico IG: ${fetchError.message}. flowId=${reconnectFlowId}`);
                  dbUserRecord.instagramSyncErrorMsg = "Erro interno ao tentar buscar contas do Instagram: " + fetchError.message.substring(0, 150);
                  dbUserRecord.instagramSyncErrorCode = resolveReconnectErrorCode(fetchError?.message);
                  dbUserRecord.availableIgAccounts = [];
                  dbUserRecord.instagramReconnectState = "failed";
                  dbUserRecord.instagramReconnectUpdatedAt = new Date();
                  if (!reconnectV2Enabled) {
                    dbUserRecord.instagramAccessToken = undefined;
                  }
                }
              } else {
                logger.warn(`${TAG_SIGNIN} [Facebook] account.access_token ausente — não dá pra buscar IG. flowId=${reconnectFlowId}`);
                dbUserRecord.instagramSyncErrorMsg = "Token de acesso do Facebook não disponível para buscar contas do Instagram.";
                dbUserRecord.instagramSyncErrorCode = IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID;
                dbUserRecord.availableIgAccounts = [];
                dbUserRecord.instagramReconnectState = "failed";
                dbUserRecord.instagramReconnectUpdatedAt = new Date();
                if (!reconnectV2Enabled) {
                  dbUserRecord.instagramAccessToken = undefined;
                }
              }
              await dbUserRecord.save();
              cookies().delete(FACEBOOK_LINK_COOKIE_NAME);
              logger.info(`${TAG_SIGNIN} [Facebook] Vinculação/IG processadas para ${dbUserRecord._id}. flowId=${reconnectFlowId}`);
              logger.info(`${TAG_SIGNIN} telemetry ig_oauth_callback_ok userId=${dbUserRecord._id} flowId=${reconnectFlowId} reconnectState=${dbUserRecord.instagramReconnectState ?? "idle"}`);
            } else {
              logger.warn(`${TAG_SIGNIN} [Facebook] linkToken '${FACEBOOK_LINK_COOKIE_NAME}' inválido/expirado. Vinculação falhou. flowId=${reconnectFlowIdFromCookie ?? "none"}`);
              cookies().delete(FACEBOOK_LINK_COOKIE_NAME);
              return "/dashboard/instagram/connect?error=FacebookLinkFailed";
            }
          } else {
            logger.warn(`${TAG_SIGNIN} [Facebook] Sem linkToken ('${FACEBOOK_LINK_COOKIE_NAME}'). Tentando fallback pela sessão ativa. flowId=${reconnectFlowIdFromCookie ?? "none"}`);
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
              logger.warn(`${TAG_SIGNIN} [Facebook] Sem linkToken e sem sessão ativa decodificável. Bloqueando login direto. flowId=${reconnectFlowIdFromCookie ?? "none"}`);
              return "/dashboard/instagram/connect?error=FacebookLinkRequired";
            }

            dbUserRecord = await DbUser.findById(sessionUserId);
            if (!dbUserRecord) {
              logger.warn(`${TAG_SIGNIN} [Facebook] Fallback sessão: user ${sessionUserId} não encontrado no DB. flowId=${reconnectFlowIdFromCookie ?? "none"}`);
              return "/dashboard/instagram/connect?error=FacebookLinkRequired";
            }
            const reconnectFlowId = resolveReconnectFlowId(
              dbUserRecord.instagramReconnectFlowId,
              reconnectFlowIdFromCookie
            );
            dbUserRecord.instagramReconnectFlowId = reconnectFlowId;

            // Checagem de conflito: a conta Facebook já foi vinculada a outro usuário?
            {
              const conflict = await DbUser.findOne({
                facebookProviderAccountId: providerAccountId,
                _id: { $ne: dbUserRecord._id },
              }).select('_id').lean();
              if (conflict) {
                logger.warn(`${TAG_SIGNIN} [Facebook] providerAccountId ${providerAccountId} já vinculado a ${conflict._id}. Abortando. flowId=${reconnectFlowId}`);
                dbUserRecord.instagramReconnectState = "failed";
                dbUserRecord.instagramReconnectUpdatedAt = new Date();
                dbUserRecord.instagramSyncErrorCode = IG_RECONNECT_ERROR_CODES.FACEBOOK_ALREADY_LINKED;
                dbUserRecord.instagramSyncErrorMsg = "Esta conta do Facebook já está vinculada a outro usuário.";
                await dbUserRecord.save();
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
            dbUserRecord.instagramReconnectState = "oauth_in_progress";
            dbUserRecord.instagramReconnectUpdatedAt = new Date();

            if (account?.access_token) {
              logger.info(`${TAG_SIGNIN} [Facebook] (fallback sessão) Obtendo contas IG/LLAT… flowId=${reconnectFlowId}`);
              try {
                const igAccountsResult = await fetchAvailableInstagramAccounts(account.access_token, dbUserRecord._id.toString());
                if (igAccountsResult.success) {
                  logger.info(`${TAG_SIGNIN} [Facebook] (fallback sessão) ${igAccountsResult.accounts.length} contas IG; LLAT ${igAccountsResult.longLivedAccessToken ? "OK" : "N/A"}. flowId=${reconnectFlowId}`);
                  dbUserRecord.availableIgAccounts = igAccountsResult.accounts;
                  dbUserRecord.instagramAccessToken = igAccountsResult.longLivedAccessToken ?? undefined;
                  dbUserRecord.instagramAccessTokenExpiresAt = (igAccountsResult as any).longLivedAccessTokenExpiresAt ?? undefined;
                  dbUserRecord.instagramSyncErrorMsg = null;
                  dbUserRecord.instagramSyncErrorCode = null;
                  dbUserRecord.instagramReconnectState = "awaiting_account_selection";
                  dbUserRecord.instagramReconnectUpdatedAt = new Date();
                  if (!reconnectV2Enabled) {
                    dbUserRecord.isInstagramConnected = false;
                    dbUserRecord.instagramAccountId = null;
                    dbUserRecord.username = null;
                  }
                } else {
                  logger.error(`${TAG_SIGNIN} [Facebook] (fallback sessão) Falha IG: ${igAccountsResult.error}. flowId=${reconnectFlowId}`);
                  dbUserRecord.instagramSyncErrorMsg = igAccountsResult.error;
                  dbUserRecord.instagramSyncErrorCode = resolveReconnectErrorCodeFromFetchFailure({
                    message: igAccountsResult.error,
                    fetchReconnectErrorCode: igAccountsResult.reconnectErrorCode ?? null,
                    fallback: IG_RECONNECT_ERROR_CODES.NO_IG_ACCOUNT,
                  });
                  dbUserRecord.availableIgAccounts = [];
                  dbUserRecord.instagramReconnectState = "failed";
                  dbUserRecord.instagramReconnectUpdatedAt = new Date();
                  if (!reconnectV2Enabled) {
                    dbUserRecord.instagramAccessToken = undefined;
                  }
                }
              } catch (fetchError: any) {
                logger.error(`${TAG_SIGNIN} [Facebook] (fallback sessão) Erro crítico IG: ${fetchError.message}. flowId=${reconnectFlowId}`);
                dbUserRecord.instagramSyncErrorMsg = "Erro interno ao tentar buscar contas do Instagram: " + fetchError.message.substring(0, 150);
                dbUserRecord.instagramSyncErrorCode = resolveReconnectErrorCode(fetchError?.message);
                dbUserRecord.availableIgAccounts = [];
                dbUserRecord.instagramReconnectState = "failed";
                dbUserRecord.instagramReconnectUpdatedAt = new Date();
                if (!reconnectV2Enabled) {
                  dbUserRecord.instagramAccessToken = undefined;
                }
              }
            } else {
              logger.warn(`${TAG_SIGNIN} [Facebook] (fallback sessão) account.access_token ausente — não dá pra buscar IG. flowId=${reconnectFlowId}`);
              dbUserRecord.instagramSyncErrorMsg = "Token de acesso do Facebook não disponível para buscar contas do Instagram.";
              dbUserRecord.instagramSyncErrorCode = IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID;
              dbUserRecord.availableIgAccounts = [];
              dbUserRecord.instagramReconnectState = "failed";
              dbUserRecord.instagramReconnectUpdatedAt = new Date();
              if (!reconnectV2Enabled) {
                dbUserRecord.instagramAccessToken = undefined;
              }
            }

            await dbUserRecord.save();
            cookies().delete(FACEBOOK_LINK_COOKIE_NAME);
            logger.info(`${TAG_SIGNIN} [Facebook] Vinculação/IG processadas via sessão ativa para ${dbUserRecord._id}. flowId=${reconnectFlowId}`);
            logger.info(`${TAG_SIGNIN} telemetry ig_oauth_callback_ok userId=${dbUserRecord._id} flowId=${reconnectFlowId} reconnectState=${dbUserRecord.instagramReconnectState ?? "idle"}`);
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
          (authUserFromProvider as NextAuthUserArg).instagramSyncErrorCode = dbUserRecord.instagramSyncErrorCode;
          (authUserFromProvider as NextAuthUserArg).availableIgAccounts =
            (dbUserRecord.availableIgAccounts as ServiceAvailableIgAccount[] | null | undefined);
          (authUserFromProvider as NextAuthUserArg).instagramReconnectNotifiedAt = dbUserRecord.instagramReconnectNotifiedAt;
          (authUserFromProvider as NextAuthUserArg).instagramDisconnectCount = dbUserRecord.instagramDisconnectCount ?? 0;
          (authUserFromProvider as NextAuthUserArg).instagramReconnectState = dbUserRecord.instagramReconnectState ?? "idle";
          (authUserFromProvider as NextAuthUserArg).instagramReconnectFlowId = dbUserRecord.instagramReconnectFlowId ?? null;

          // Billing
          (authUserFromProvider as NextAuthUserArg).planStatus = dbUserRecord.planStatus;
          (authUserFromProvider as NextAuthUserArg).planType = dbUserRecord.planType;
          (authUserFromProvider as NextAuthUserArg).planInterval = dbUserRecord.planInterval;
          (authUserFromProvider as NextAuthUserArg).planExpiresAt = dbUserRecord.planExpiresAt;
          (authUserFromProvider as NextAuthUserArg).cancelAtPeriodEnd = (dbUserRecord as any).cancelAtPeriodEnd ?? null;
          (authUserFromProvider as NextAuthUserArg).proTrialStatus = (dbUserRecord as any).proTrialStatus ?? null;
          (authUserFromProvider as NextAuthUserArg).proTrialActivatedAt = (dbUserRecord as any).proTrialActivatedAt ?? null;
          (authUserFromProvider as NextAuthUserArg).proTrialExpiresAt = (dbUserRecord as any).proTrialExpiresAt ?? null;
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
            `${TAG_SIGNIN} [${provider}] FINAL signIn. authUser.id: '${authUserFromProvider.id}', provider: '${(authUserFromProvider as NextAuthUserArg).provider}', planStatus: ${(authUserFromProvider as NextAuthUserArg).planStatus}, igAccountsCount: ${(authUserFromProvider as NextAuthUserArg).availableIgAccounts?.length ?? 0}, reconnectState: ${(authUserFromProvider as NextAuthUserArg).instagramReconnectState ?? "idle"}, flowId: ${(authUserFromProvider as NextAuthUserArg).instagramReconnectFlowId ?? "none"}`
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
      if (typeof token.proTrialStatus === "undefined") token.proTrialStatus = null;
      if (typeof token.proTrialActivatedAt === "undefined") token.proTrialActivatedAt = null;
      if (typeof token.proTrialExpiresAt === "undefined") token.proTrialExpiresAt = null;

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
        token.igConnectionErrorCode = (userFromSignIn as NextAuthUserArg).instagramSyncErrorCode ?? null;
        token.availableIgAccounts = (userFromSignIn as NextAuthUserArg).availableIgAccounts;
        token.instagramReconnectNotifiedAt = (userFromSignIn as NextAuthUserArg).instagramReconnectNotifiedAt ?? null;
        token.instagramDisconnectCount = (userFromSignIn as NextAuthUserArg).instagramDisconnectCount ?? 0;
        token.instagramReconnectState = (userFromSignIn as NextAuthUserArg).instagramReconnectState ?? "idle";
        token.instagramReconnectFlowId = (userFromSignIn as NextAuthUserArg).instagramReconnectFlowId ?? null;

        // Billing
        const rawStatus = (userFromSignIn as NextAuthUserArg).planStatus;
        token.planStatus = normalizePlanStatusValue(rawStatus);
        token.planType = (userFromSignIn as NextAuthUserArg).planType;
        token.planInterval = (userFromSignIn as NextAuthUserArg).planInterval;
        token.planExpiresAt = (userFromSignIn as NextAuthUserArg).planExpiresAt;
        (token as any).cancelAtPeriodEnd =
          (userFromSignIn as NextAuthUserArg).cancelAtPeriodEnd ??
          (isNonRenewing(rawStatus) ? true : null);
        token.proTrialStatus = (userFromSignIn as any).proTrialStatus ?? null;
        token.proTrialActivatedAt = (userFromSignIn as any).proTrialActivatedAt ?? null;
        token.proTrialExpiresAt = (userFromSignIn as any).proTrialExpiresAt ?? null;

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

        // Parceiro
        token.agencyId = (userFromSignIn as NextAuthUserArg).agency ?? null;
        if (token.agencyId) {
          try {
            await connectToDatabase();
            const agency = await AgencyModel.findById(token.agencyId).select("planStatus planType").lean();
            token.agencyPlanStatus = agency?.planStatus ?? null;
            token.agencyPlanType = agency?.planType ?? null;
          } catch (e) {
            logger.error(`${TAG_JWT} Erro ao buscar planStatus do parceiro ${token.agencyId}:`, e);
            token.agencyPlanStatus = null;
            token.agencyPlanType = null;
          }
        } else {
          token.agencyPlanStatus = null;
          token.agencyPlanType = null;
        }

        logger.info(
          `${TAG_JWT} Token populado de userFromSignIn. ID: ${token.id}, Provider: ${token.provider}, planStatus: ${token.planStatus}, igAccounts: ${token.availableIgAccounts?.length}, reconnectState: ${token.instagramReconnectState ?? "idle"}, flowId: ${token.instagramReconnectFlowId ?? "none"}`
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
        delete (token as any).id;
        delete (token as any).sub;
        (token as any).invalidated = true;
        return token;
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
          (typeof token.isInstagramConnected === "undefined" && typeof token.availableIgAccounts === "undefined") ||
          typeof token.instagramReconnectState === "undefined" ||
          typeof token.instagramReconnectFlowId === "undefined";

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
            const dbUser = await withMongoTransientRetry(
              async () => {
                await connectToDatabase();
                return DbUser.findById(token.id)
                  .select(
                    "name email image role agency provider providerAccountId facebookProviderAccountId " +
                    "isNewUserForOnboarding onboardingCompletedAt " +
                    "isInstagramConnected instagramAccountId username lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorMsg instagramSyncErrorCode instagramReconnectNotifiedAt instagramDisconnectCount instagramReconnectState " +
                    "instagramReconnectFlowId " +
                    "planStatus planType planInterval planExpiresAt cancelAtPeriodEnd proTrialStatus proTrialActivatedAt proTrialExpiresAt " +
                    "stripeCustomerId stripeSubscriptionId stripePriceId " +
                    "affiliateCode availableIgAccounts affiliateBalances " +
                    "paymentInfo.stripeAccountStatus paymentInfo.stripeAccountDefaultCurrency"
                  )
                  .lean<IUser>();
              },
              {
                retries: 1,
                onRetry: (error, retryCount) => {
                  logger.warn(`${TAG_JWT} Falha transitória ao enriquecer token ${token.id} do DB. Retry #${retryCount}.`, {
                    error: getErrorMessage(error),
                  });
                },
              }
            );

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
              if (token.onboardingCompletedAt && token.isNewUserForOnboarding) {
                token.isNewUserForOnboarding = false;
              }

              // Instagram
              token.isInstagramConnected = dbUser.isInstagramConnected ?? token.isInstagramConnected ?? false;
              token.instagramAccountId = dbUser.instagramAccountId ?? token.instagramAccountId ?? null;
              token.instagramUsername = dbUser.username ?? token.instagramUsername ?? null;
              token.lastInstagramSyncAttempt = dbUser.lastInstagramSyncAttempt ?? token.lastInstagramSyncAttempt ?? null;
              token.lastInstagramSyncSuccess = dbUser.lastInstagramSyncSuccess ?? token.lastInstagramSyncSuccess ?? null;
              token.igConnectionError = dbUser.instagramSyncErrorMsg ?? token.igConnectionError ?? null;
              token.igConnectionErrorCode = dbUser.instagramSyncErrorCode ?? token.igConnectionErrorCode ?? null;
              if (dbUser.isInstagramConnected && !dbUser.instagramSyncErrorMsg) token.igConnectionError = null;
              if (dbUser.isInstagramConnected && !dbUser.instagramSyncErrorCode) token.igConnectionErrorCode = null;
              token.availableIgAccounts =
                (dbUser.availableIgAccounts as ServiceAvailableIgAccount[] | null | undefined) ?? token.availableIgAccounts ?? null;
              token.instagramReconnectNotifiedAt = dbUser.instagramReconnectNotifiedAt ?? token.instagramReconnectNotifiedAt ?? null;
              token.instagramDisconnectCount = typeof dbUser.instagramDisconnectCount === 'number'
                ? dbUser.instagramDisconnectCount
                : token.instagramDisconnectCount ?? 0;
              token.instagramReconnectState = dbUser.instagramReconnectState ?? token.instagramReconnectState ?? "idle";
              token.instagramReconnectFlowId = dbUser.instagramReconnectFlowId ?? token.instagramReconnectFlowId ?? null;

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
              token.proTrialStatus =
                (dbUser as any).proTrialStatus ?? token.proTrialStatus ?? null;
              token.proTrialActivatedAt =
                (dbUser as any).proTrialActivatedAt ?? token.proTrialActivatedAt ?? null;
              token.proTrialExpiresAt =
                (dbUser as any).proTrialExpiresAt ?? token.proTrialExpiresAt ?? null;

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

              // Parceiro
              token.agencyId = dbUser.agency ? dbUser.agency.toString() : token.agencyId ?? null;
              if (token.agencyId) {
                try {
                  const agency = await AgencyModel.findById(token.agencyId).select("planStatus planType").lean();
                  token.agencyPlanStatus = agency?.planStatus ?? null;
                  token.agencyPlanType = agency?.planType ?? null;
                } catch (e) {
                  logger.error(`${TAG_JWT} Erro ao buscar planStatus do parceiro ${token.agencyId}:`, e);
                  token.agencyPlanStatus = null;
                  token.agencyPlanType = null;
                }
              } else {
                token.agencyPlanStatus = null;
                token.agencyPlanType = null;
              }

              logger.info(
                `${TAG_JWT} Token atualizado do DB. ID: ${token.id}, Provider: ${token.provider}, planStatus: ${token.planStatus}, igAccounts: ${token.availableIgAccounts?.length}, reconnectState: ${token.instagramReconnectState ?? "idle"}, flowId: ${token.instagramReconnectFlowId ?? "none"}, igErr: ${token.igConnectionError ? "Sim (" + String(token.igConnectionError).substring(0, 30) + "...)" : "Não"
                }`
              );
            } else {
              if (isDevE2EIdentity({
                id: ensureStringId(token.id),
                email: token.email ?? null,
                provider: token.provider ?? null,
              })) {
                logger.warn(`${TAG_JWT} Utilizador dev/E2E ${token.id} ainda não materializado no DB. Mantendo token.`);
                return token;
              }
              logger.warn(`${TAG_JWT} Utilizador ${token.id} não encontrado no DB. Invalidando token.`);
              delete (token as any).id;
              delete (token as any).sub;
              (token as any).invalidated = true;
              return token;
            }
          } catch (error) {
            if (isTransientMongoError(error)) {
              logger.warn(`${TAG_JWT} Erro transitório ao enriquecer token ${token.id} do DB. Mantendo dados atuais do token.`, {
                error: getErrorMessage(error),
              });
            } else {
              logger.error(`${TAG_JWT} Erro ao enriquecer token ${token.id} do DB:`, error);
            }
          }
        }
      } else {
        if (trigger !== "signIn" && trigger !== "signUp") {
          logger.warn(`${TAG_JWT} Token com ID inválido/ausente ('${(token as any).id}') fora do login/signup. Invalidando.`);
          delete (token as any).id;
          delete (token as any).sub;
          (token as any).invalidated = true;
          return token;
        }
      }

      if (token.image && (token as any).picture) delete (token as any).picture;

      logger.debug(
        `${TAG_JWT} FINAL jwt. Token id: '${(token as any).id}', provider: '${(token as any).provider}', planStatus: ${(token as any).planStatus}, agencyPlanStatus: ${(token as any).agencyPlanStatus}, affiliateCode: ${(token as any).affiliateCode}, agencyId: ${(token as any).agencyId}, flowId: ${(token as any).instagramReconnectFlowId ?? "none"}`
      );
      return token;
    },

    async session({ session, token }) {
      const TAG_SESSION = "[NextAuth Session v2.3.0]";
      logger.debug(`${TAG_SESSION} Iniciado. Token ID: ${token?.id}, Token.Provider: ${token?.provider}, Token.planStatus: ${token?.planStatus}`);

      const invalidateSession = () => null as unknown as Session;

      if (!token?.id || !Types.ObjectId.isValid(token.id)) {
        logger.error(
          `${TAG_SESSION} Token ID inválido/ausente ('${token?.id}') na sessão. Invalidando sessão.`
        );
        return invalidateSession();
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
        (session.user as any).igConnectionErrorCode = token.igConnectionErrorCode ?? null;
        session.user.availableIgAccounts = token.availableIgAccounts;
        session.user.lastInstagramSyncAttempt = token.lastInstagramSyncAttempt ? new Date(token.lastInstagramSyncAttempt).toISOString() : null;
        session.user.lastInstagramSyncSuccess = token.lastInstagramSyncSuccess;
        session.user.instagramReconnectState = token.instagramReconnectState ?? "idle";
        session.user.instagramReconnectFlowId = token.instagramReconnectFlowId ?? null;
        (session.user as any).instagramReconnectNotifiedAt = token.instagramReconnectNotifiedAt
          ? new Date(token.instagramReconnectNotifiedAt).toISOString()
          : null;
        (session.user as any).instagramDisconnectCount = token.instagramDisconnectCount ?? 0;

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
        session.user.proTrialStatus = token.proTrialStatus ?? null;
        session.user.proTrialActivatedAt = token.proTrialActivatedAt
          ? new Date(token.proTrialActivatedAt as any).toISOString()
          : null;
        session.user.proTrialExpiresAt = token.proTrialExpiresAt
          ? new Date(token.proTrialExpiresAt as any).toISOString()
          : null;

        // Parceiro
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

      const nowTs = Date.now();
      pruneSessionRevalidationCache(nowTs);

      if (
        isDevE2EIdentity({
          id: token.id ?? null,
          email: token.email ?? null,
          provider: token.provider ?? null,
        })
      ) {
        logger.debug(
          `${TAG_SESSION} Sessão dev/E2E detectada para ${token.id}. Pulando revalidação no DB.`
        );
        return session;
      }

      const cachedSessionSnapshot = getSessionRevalidationCache().get(token.id);
      if (cachedSessionSnapshot && cachedSessionSnapshot.expiresAt > nowTs) {
        applySessionRevalidationSnapshot(session, cachedSessionSnapshot.snapshot);
        logger.debug(`${TAG_SESSION} Reutilizando cache de revalidação para ${token.id}.`);
        return session;
      }

      try {
        const dbUserCheck = await withMongoTransientRetry(
          async () => {
            await connectToDatabase();
            return DbUser.findById(token.id)
              .select(
                "planStatus planType planInterval planExpiresAt cancelAtPeriodEnd " +
                "stripeCustomerId stripeSubscriptionId stripePriceId " +
                "name role image proTrialStatus proTrialActivatedAt proTrialExpiresAt"
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
          },
          {
            retries: 1,
            onRetry: (error, retryCount) => {
              logger.warn(
                `${TAG_SESSION} Falha transitória ao revalidar sessão ${token.id}. Retry #${retryCount}.`,
                { error: getErrorMessage(error) }
              );
            },
          }
        );

        if (dbUserCheck && session.user) {
          logger.info(`${TAG_SESSION} Revalidando sessão com dados do DB para User ID: ${token.id}. DB planStatus: ${dbUserCheck.planStatus}.`);
          const snapshot: SessionRevalidationSnapshot = {
            planStatus: dbUserCheck.planStatus ?? session.user.planStatus ?? null,
            planType: dbUserCheck.planType ?? session.user.planType ?? null,
            planInterval: dbUserCheck.planInterval ?? session.user.planInterval ?? null,
            planExpiresAt: dbUserCheck.planExpiresAt ?? session.user.planExpiresAt ?? null,
            cancelAtPeriodEnd:
              typeof dbUserCheck.cancelAtPeriodEnd === "boolean"
                ? dbUserCheck.cancelAtPeriodEnd
                : (session.user.cancelAtPeriodEnd ?? false) || isNonRenewing(dbUserCheck.planStatus),
            stripeCustomerId: (dbUserCheck as any).stripeCustomerId ?? session.user.stripeCustomerId ?? null,
            stripeSubscriptionId: (dbUserCheck as any).stripeSubscriptionId ?? session.user.stripeSubscriptionId ?? null,
            stripePriceId: (dbUserCheck as any).stripePriceId ?? session.user.stripePriceId ?? null,
            proTrialStatus: (dbUserCheck as any).proTrialStatus ?? session.user.proTrialStatus ?? null,
            proTrialActivatedAt: (dbUserCheck as any).proTrialActivatedAt ?? session.user.proTrialActivatedAt ?? null,
            proTrialExpiresAt: (dbUserCheck as any).proTrialExpiresAt ?? session.user.proTrialExpiresAt ?? null,
            name: dbUserCheck.name ?? session.user.name ?? null,
            role: dbUserCheck.role ?? session.user.role ?? null,
            image: dbUserCheck.image ?? session.user.image ?? null,
          };
          applySessionRevalidationSnapshot(session, snapshot);
          getSessionRevalidationCache().set(token.id, {
            snapshot,
            expiresAt: nowTs + SESSION_DB_REVALIDATION_CACHE_TTL_MS,
          });
        } else if (!dbUserCheck) {
          if (isDevE2EIdentity({
            id: token.id ?? null,
            email: token.email ?? null,
            provider: token.provider ?? null,
          })) {
            logger.warn(
              `${TAG_SESSION} Utilizador dev/E2E ${token.id} ainda não existe no DB. Mantendo sessão baseada no token.`
            );
            logger.debug(
              `${TAG_SESSION} Finalizado com fallback dev/E2E. Session.user ID: ${session.user?.id}, planStatus: ${session.user?.planStatus}`
            );
            return session;
          }
          logger.warn(
            `${TAG_SESSION} Utilizador ${token.id} não encontrado no DB. Invalidando sessão.`
          );
          return invalidateSession();
        }
      } catch (error) {
        if (isTransientMongoError(error)) {
          logger.warn(`${TAG_SESSION} Erro transitório ao revalidar sessão ${token.id}. Mantendo dados do token.`, {
            error: getErrorMessage(error),
          });
        } else {
          logger.error(`${TAG_SESSION} Erro ao revalidar sessão ${token.id}:`, error);
        }
      }

      logger.debug(
        `${TAG_SESSION} Finalizado. Session.user ID: ${session.user?.id}, planStatus: ${session.user?.planStatus}, cancelAtPeriodEnd: ${session.user?.cancelAtPeriodEnd}, stripeSub: ${session.user?.stripeSubscriptionId}`
      );
      return session;
    },

    async redirect({ url, baseUrl }) {
      const requestedUrl = new URL(url, baseUrl);
      const base = new URL(baseUrl);
      const isEquivalentLocalOrigin =
        process.env.NODE_ENV !== "production" &&
        requestedUrl.port === base.port &&
        ((requestedUrl.hostname === "127.0.0.1" && base.hostname === "localhost") ||
          (requestedUrl.hostname === "localhost" && base.hostname === "127.0.0.1"));

      if (requestedUrl.origin === base.origin || isEquivalentLocalOrigin) {
        // Se o provider recusar consentimento e o NextAuth tentar enviar para /login?error=...
        if (requestedUrl.pathname === "/login" && requestedUrl.searchParams.has("error")) {
          logger.warn(`[NextAuth Redirect Callback] Interceptando redirecionamento para /login com erro (${requestedUrl.searchParams.get("error")}). Enviando para página inicial.`);
          return new URL("/", base).toString();
        }
        if (process.env.NODE_ENV !== "production") {
          logger.debug(`[NextAuth Redirect Callback] URL solicitada (${requestedUrl.toString()}) é interna. Permitindo.`);
        }
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
} satisfies NextAuthOptions & { trustHost?: boolean };

export const authOptions: NextAuthOptions = authOptionsConfig as NextAuthOptions;

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
