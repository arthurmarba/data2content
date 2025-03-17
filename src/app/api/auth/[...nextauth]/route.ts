// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import type { JWT } from "next-auth/jwt";

// Garante que essa rota use Node.js em vez de Edge (importante para Mongoose).
export const runtime = "nodejs";

// Interfaces para os callbacks
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

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { scope: "openid email profile" },
      },
      profile(profile) {
        // Retorna o shape básico do usuário
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
          // Exemplo simples de usuário 'demo'
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

  callbacks: {
    async signIn({ user, account }: SignInCallback): Promise<boolean> {
      if (account?.provider === "google") {
        try {
          await connectToDatabase();
          const existingUser = (await DbUser.findOne({ email: user.email })) as IUser | null;

          if (!existingUser) {
            const created = new DbUser({
              name: user.name,
              email: user.email,
              googleId: account.providerAccountId,
              role: "user",
            });
            await created.save();
            user.id = (created._id as Types.ObjectId).toString();
          } else {
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
        // Se for Google, user.id é o _id do DB; se for demo, é "demo-123"
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      console.log("JWT Callback - token:", token, "user:", user);
      return token;
    },

    async session({ session, token }: SessionCallback): Promise<Session> {
      console.log("Session Callback (antes) - token:", token, "session:", session);
      // Inicializa session.user se ainda não existir
      if (!session.user) {
        session.user = { id: "", name: "", email: "", image: "" };
      }
      session.user.id = token.sub as string;

      try {
        await connectToDatabase();
        let dbUser: IUser | null = null;

        // 1) Verifica se token.sub é string
        if (typeof token.sub === "string") {
          // 2) Se for um ObjectId válido, usamos findById
          if (Types.ObjectId.isValid(token.sub)) {
            dbUser = await DbUser.findById(token.sub);
          } else {
            // 3) Caso contrário, pesquisamos por googleId
            dbUser = await DbUser.findOne({ googleId: token.sub });
          }
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
      console.log("Session Callback (depois) - session:", session);
      return session;
    },

    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
};

// Cria o handler NextAuth e exporta como GET e POST (App Router).
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
