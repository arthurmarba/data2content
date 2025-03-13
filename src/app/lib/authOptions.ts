// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth/next";
import type { NextAuthOptions, Session, User, Account } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { Model, Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User";
import type { JWT } from "next-auth/jwt";

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
      profile(profile) {
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

  callbacks: {
    async signIn({ user, account }: { user: User; account: Account | null }): Promise<boolean> {
      if (account?.provider === "google") {
        try {
          await connectToDatabase();
          const existingUser = await (DbUser as Model<IUser>).findOne({ email: user.email });
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

    async jwt({ token, user }: { token: JWT; user?: User }): Promise<JWT> {
      if (user) {
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      // Garante que session.user exista
      if (!session.user) {
        session.user = { name: null, email: null, image: null };
      }

      session.user.id = token.sub as string;

      try {
        await connectToDatabase();
        const dbUser = await DbUser.findById(token.sub);
        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.planStatus = dbUser.planStatus;
          session.user.planExpiresAt = dbUser.planExpiresAt ? dbUser.planExpiresAt.toISOString() : null;
          session.user.affiliateCode = dbUser.affiliateCode?.toString();
          session.user.affiliateBalance = dbUser.affiliateBalance;
          session.user.affiliateRank = dbUser.affiliateRank?.toString();
          session.user.affiliateInvites = dbUser.affiliateInvites;
        }
      } catch (error) {
        console.error("Erro ao buscar dados do usuário na sessão:", error);
      }

      if (token.picture) {
        session.user.image = token.picture as string;
      }
      return session;
    },

    async redirect({ baseUrl, url }: { baseUrl: string; url: string }): Promise<string> {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
