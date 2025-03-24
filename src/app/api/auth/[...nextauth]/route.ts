import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";

// Tipos do JWT + Funções da lib 'jose' para assinar/verificar
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";

export const runtime = "nodejs";

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
 * Custom encode (HS256) para remover a criptografia "dir"/"A256GCM".
 */
async function customEncode({
  token,
  secret,
  maxAge,
}: JWTEncodeParams): Promise<string> {
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET ausente em customEncode");
  }
  // Converte para string, caso seja Buffer ou outro tipo
  const secretString = typeof secret === "string" ? secret : String(secret);

  const expirationTime =
    Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);

  return await new SignJWT(token as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(new TextEncoder().encode(secretString));
}

/**
 * Custom decode (HS256)
 */
async function customDecode({
  token,
  secret,
}: JWTDecodeParams): Promise<JWT | null> {
  if (!token || !secret) return null;
  const secretString = typeof secret === "string" ? secret : String(secret);

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString));
    return payload as JWT;
  } catch (err) {
    console.error("Erro ao decodificar JWT customizado:", err);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  /**
   * NÃO defina `secret: process.env.NEXTAUTH_SECRET` aqui no topo.
   * Mova-o para dentro de `jwt: {...}`.
   */
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { scope: "openid email profile" } },
      profile(profile) {
        console.log("NextAuth: Google profile returned:", profile);
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

  // Configurações do JWT
  jwt: {
    secret: process.env.NEXTAUTH_SECRET, // Mover o secret para cá
    encode: customEncode,
    decode: customDecode,
  },

  callbacks: {
    async signIn({ user, account }: SignInCallback): Promise<boolean> {
      console.log("NextAuth: signIn callback - user:", user, "account:", account);
      if (account?.provider === "google") {
        try {
          await connectToDatabase();
          const existingUser = (await DbUser.findOne({ email: user.email })) as IUser | null;

          if (!existingUser) {
            console.log("NextAuth: Criando novo usuário no DB para email:", user.email);
            const created = new DbUser({
              name: user.name,
              email: user.email,
              googleId: account.providerAccountId,
              role: "user",
            });
            await created.save();
            user.id = (created._id as Types.ObjectId).toString();
          } else {
            console.log("NextAuth: Usuário já existe no DB, id =", existingUser._id);
            user.id = (existingUser._id as Types.ObjectId).toString();
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
        if (user.image) {
          token.picture = user.image;
        }
      }
      console.log("NextAuth: JWT Callback - token:", token, "user:", user);
      return token;
    },

    async session({ session, token }: SessionCallback): Promise<Session> {
      console.log("NextAuth: Session Callback (antes) - token:", token, "session:", session);

      if (!session.user) {
        session.user = { id: "", name: "", email: "", image: "" };
      }
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
      console.log("NextAuth: Session Callback (depois) - session:", session);
      return session;
    },

    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      return baseUrl + "/dashboard";
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
  // Se quiser habilitar debug, adicione:
  // debug: true,
};

// Apenas usamos a importação do NextAuth uma vez no topo.
// Aqui, reaproveitamos a mesma importação:
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
