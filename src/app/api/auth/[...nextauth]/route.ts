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
    interface Session extends DefaultSession { user?: User; }
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

export const authOptions: NextAuthOptions = {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === 'production'
                ? "__Secure-next-auth.session-token"
                : "next-auth.session-token",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" }
        },
        callbackUrl: {
            name: process.env.NODE_ENV === 'production'
                ? "__Secure-next-auth.callback-url"
                : "next-auth.callback-url",
            options: { sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" }
        },
        csrfToken: {
            name: process.env.NODE_ENV === 'production'
                ? "__Host-next-auth.csrf-token"
                : "next-auth.csrf-token",
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" }
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
                    display: 'popup'
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
                    return { id: "demo-123", name: "Demo User", email: "demo@example.com" };
                }
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
            logger.debug(`${TAG_SIGNIN} Iniciado`, { userId: user.id, provider: account?.provider });
            if (account?.provider === 'credentials') return true;
            if (!account?.providerAccountId) return false;
            const currentEmail = user.email;
            if (!currentEmail && account.provider !== 'facebook') return false;
            await connectToDatabase();
            let existing: IUser | null = null;
            if (account.provider === 'facebook') {
                existing = await DbUser.findOne({ facebookProviderAccountId: user.id }).exec();
            } else {
                existing = await DbUser.findOne({ providerAccountId: user.id, provider: 'google' }).exec();
            }
            if (!existing && currentEmail) {
                existing = await DbUser.findOne({ email: currentEmail }).exec();
            }
            if (existing) {
                user.id = existing._id.toString();
                existing.name = user.name || existing.name;
                if (account.provider === 'facebook') existing.facebookProviderAccountId = account.providerAccountId;
                else existing.providerAccountId = account.providerAccountId;
                await existing.save();
                return true;
            }
            if (account.provider === 'google') {
                const newUser = new DbUser({
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    provider: 'google',
                    providerAccountId: account.providerAccountId,
                    role: 'user',
                    isInstagramConnected: false
                });
                const saved = await newUser.save();
                user.id = saved._id.toString();
                return true;
            }
            return true;
        },
        async jwt({ token, user, account, trigger }) {
            const TAG_JWT = '[NextAuth JWT Callback]';
            let t = { ...token, id: token.id || '' };
            delete t.pendingInstagramConnection;
            delete t.availableIgAccounts;
            delete t.igConnectionError;
            if ((trigger === 'signIn' || trigger === 'signUp') && account) {
                if (account.provider === 'facebook') {
                    await connectToDatabase();
                    let userId = '';
                    const authLink = cookies().get('auth-link-token')?.value;
                    if (authLink) {
                        cookies().delete('auth-link-token');
                        const linkDoc = await DbUser.findOne({ linkToken: authLink, linkTokenExpiresAt: { $gt: new Date() } }).lean();
                        if (linkDoc) {
                            userId = linkDoc._id.toString();
                            await DbUser.updateOne({ _id: linkDoc._id }, { $unset: { linkToken: '', linkTokenExpiresAt: '' } });
                        }
                    }
                    if (!userId && account.providerAccountId) {
                        const doc = await DbUser.findOne({ facebookProviderAccountId: account.providerAccountId }).exec();
                        userId = doc?._id.toString() || '';
                    }
                    if (userId) {
                        const result = await fetchAvailableInstagramAccounts(account.access_token!, userId);
                        if (result.success) {
                            await storeTemporaryLlat(userId, result.longLivedAccessToken);
                            t.pendingInstagramConnection = true;
                            t.availableIgAccounts = result.accounts;
                            try {
                                cookies().set('ig-connect-status', 'pending', {
                                    path: '/',
                                    maxAge: 60,
                                    sameSite: 'lax',
                                    secure: process.env.NODE_ENV === 'production',
                                    httpOnly: false
                                });
                                logger.info(`${TAG_JWT} Cookie 'ig-connect-status=pending' definido.`);
                            } catch (e) {
                                logger.error(`${TAG_JWT} Não foi possível definir cookie ig-connect-status.`, e);
                            }
                        } else {
                            t.igConnectionError = result.error;
                        }
                    }
                    t.id = userId;
                } else {
                    // Google flow
                    if (user?.id && Types.ObjectId.isValid(user.id)) {
                        t.id = user.id;
                        t.provider = account.provider;
                        t.name = user.name;
                        t.email = user.email;
                        t.image = user.image;
                        const db = await connectToDatabase();
                        const doc = await DbUser.findById(t.id).select('role').lean();
                        t.role = doc?.role;
                    }
                }
            }
            if (t.id && Types.ObjectId.isValid(t.id)) t.sub = t.id;
            return t;
        },
        async session({ session, token }) {
            const TAG_SESSION = '[NextAuth Session Callback]';
            if (!token.id || !Types.ObjectId.isValid(token.id)) {
                return { ...session, user: undefined };
            }
            session.user = {
                id: token.id,
                name: token.name ?? undefined,
                email: token.email ?? undefined,
                image: token.image ?? token.picture ?? undefined,
                provider: token.provider,
                role: token.role ?? 'user',
                pendingInstagramConnection: token.pendingInstagramConnection ?? false,
                availableIgAccounts: token.availableIgAccounts,
                igConnectionError: token.igConnectionError
            };
            try {
                const db = await connectToDatabase();
                const doc = await DbUser.findById(token.id).lean();
                if (doc) {
                    session.user.instagramConnected = doc.isInstagramConnected;
                    session.user.instagramAccountId = doc.instagramAccountId;
                }
            } catch {}
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
        maxAge: 30 * 24 * 60 * 60
    }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
