// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import { Types } from "mongoose";

// Tipos e funções para custom JWT via 'jose'
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";

export const runtime = "nodejs";

/**
 * Interfaces auxiliares para os callbacks.
 */
interface SignInCallback {
  user: User & { id?: string };
  account: Account | null;
}

interface JwtCallback {
  token: JWT;
  user?: User;
}

interface SessionCallback {
  session: Session;
  token: JWT;
}

interface RedirectCallback {
  baseUrl: string;
}

/**
 * Custom encode (HS256) para JWT.
 * Essa abordagem remove a criptografia "dir"/"A256GCM". 
 * Caso não seja estritamente necessária, considere usar o padrão do NextAuth.
 */
async function customEncode({
  token,
  secret,
  maxAge,
}: JWTEncodeParams): Promise<string> {
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET ausente em customEncode");
  }
  const secretString = typeof secret === "string" ? secret : String(secret);
  const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
  return await new SignJWT(token as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(new TextEncoder().encode(secretString));
}

/**
 * Custom decode (HS256) para JWT com logs adicionais.
 */
async function customDecode({
  token,
  secret,
}: JWTDecodeParams): Promise<JWT | null> {
  if (!token || !secret) {
    console.error("customDecode: Token ou secret não fornecidos.");
    return null;
  }
  const secretString = typeof secret === "string" ? secret : String(secret);
  try {
    console.debug("customDecode: Iniciando decodificação do token:", token);
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString));
    console.debug("customDecode: Token decodificado com sucesso. Payload:", payload);
    return payload as JWT;
  } catch (err) {
    console.error("customDecode: Erro ao decodificar token:", err);
    return null;
  }
}

/**
 * Configurações do NextAuth.
 * - Cookies seguros apenas em produção.
 * - Custom JWT para encode/decode.
 */
export const authOptions: NextAuthOptions = {
  // Use cookies seguros apenas em produção
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile" } },
      profile(profile) {
        console.debug("NextAuth: Google profile returned:", profile);
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    CredentialsProvider({
      name: "Demo",
      credentials: {
        username: { label: "Usuário", type: "text", placeholder: "demo" },
        password: { label: "Senha", type: "password", placeholder: "demo" },
      },
      async authorize(credentials) {
        if (credentials?.username === "demo" && credentials?.password === "demo") {
          return {
            id: "demo-123",
            name: "Demo User",
            email: "demo@example.com",
          } as User;
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
    async signIn({ user, account }: SignInCallback): Promise<boolean> {
      console.debug("NextAuth: signIn callback", { user, account });
      if (account?.provider === "google") {
        try {
          await connectToDatabase();
          const existingUser = (await DbUser.findOne({ email: user.email })) as IUser | null;
          if (!existingUser) {
            console.debug("NextAuth: Criando novo usuário para email:", user.email);
            const created = new DbUser({
              name: user.name,
              email: user.email,
              googleId: account.providerAccountId,
              role: "user",
            });
            await created.save();
            user.id = created._id.toString();
          } else {
            console.debug("NextAuth: Usuário já existe, id =", existingUser._id);
            user.id = existingUser._id.toString();
          }
        } catch (error) {
          console.error("Erro durante signIn:", error);
        }
      }
      return true;
    },
    async jwt({ token, user }: JwtCallback): Promise<JWT> {
      if (user) {
        token.sub = user.id;
        if (user.image) token.picture = user.image;
      }
      console.debug("NextAuth: JWT Callback", { token, user });
      return token;
    },
    async session({ session, token }: SessionCallback): Promise<Session> {
      console.debug("NextAuth: Session Callback (antes)", { token, session });
      session.user = session.user || { id: "", name: "", email: "", image: "" };
      session.user.id = token.sub as string;
      try {
        await connectToDatabase();
        let dbUser = await DbUser.findById(token.sub);
        if (!dbUser && typeof token.sub === "string") {
          dbUser = await DbUser.findOne({ googleId: token.sub });
        }
        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.planStatus = dbUser.planStatus;
          session.user.planExpiresAt = dbUser.planExpiresAt
            ? dbUser.planExpiresAt.toISOString()
            : null;
          session.user.affiliateCode = dbUser.affiliateCode
            ? dbUser.affiliateCode.toString()
            : undefined;
          session.user.affiliateBalance = dbUser.affiliateBalance;
          session.user.affiliateRank = dbUser.affiliateRank
            ? dbUser.affiliateRank.toString()
            : undefined;
          session.user.affiliateInvites = dbUser.affiliateInvites;
        }
      } catch (error) {
        console.error("Erro ao buscar dados do usuário na sessão:", error);
      }
      if (token.picture) {
        session.user.image = token.picture as string;
      }
      console.debug("NextAuth: Session Callback (depois)", session);
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
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  // debug: true, // Ative para logs detalhados durante o desenvolvimento
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
