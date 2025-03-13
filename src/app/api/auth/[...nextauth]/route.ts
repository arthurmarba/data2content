// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth/next";
import type { NextAuthOptions, Session, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel, { IUser } from "@/app/models/User";
import { Types } from "mongoose";
import type { JWT } from "next-auth/jwt";

// Parâmetros para o callback signIn
interface SignInParams {
  user: {
    email?: string | null;
    name?: string | null;
    id?: string;
    image?: string | null;
  };
  account: {
    provider?: string;
    providerAccountId?: string;
  } | null;
}

// Parâmetros para o callback jwt
interface JwtParams {
  token: JWT;
  user?: User;
}

// Parâmetros para o callback redirect
interface RedirectParams {
  baseUrl: string;
  url: string;
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
    async signIn({ user, account }: SignInParams): Promise<boolean> {
      if (account?.provider === "google") {
        await connectToDatabase();
        const existingUser = (await UserModel.findOne({ email: user.email })) as IUser | null;
        if (!existingUser) {
          const created = await UserModel.create({
            name: user.name,
            email: user.email,
            googleId: account.providerAccountId,
            role: "user",
          });
          if (created && created._id) {
            user.id = created._id instanceof Types.ObjectId
              ? created._id.toString()
              : String(created._id);
          }
        } else {
          if (existingUser._id) {
            user.id = existingUser._id instanceof Types.ObjectId
              ? existingUser._id.toString()
              : String(existingUser._id);
          }
        }
      }
      return true;
    },

    async jwt({ token, user }: JwtParams): Promise<JWT> {
      if (user) {
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      // Garantindo que session.user exista (a module augmentation já define as propriedades customizadas)
      if (!session.user) {
        session.user = { name: "", email: "", image: "" };
      }
      session.user.id = token.sub as string;

      await connectToDatabase();
      const dbUser = await UserModel.findById(token.sub);
      if (dbUser) {
        session.user.role = dbUser.role;
        session.user.planStatus = dbUser.planStatus;
        session.user.planExpiresAt = dbUser.planExpiresAt ? dbUser.planExpiresAt.toISOString() : null;
        session.user.affiliateCode = dbUser.affiliateCode ? dbUser.affiliateCode.toString() : undefined;
        session.user.affiliateBalance = dbUser.affiliateBalance;
        session.user.affiliateRank = dbUser.affiliateRank ? dbUser.affiliateRank.toString() : undefined;
        session.user.affiliateInvites = dbUser.affiliateInvites;
      }
      if (token.picture) {
        session.user.image = token.picture as string;
      }
      return session;
    },

    async redirect({ baseUrl }: RedirectParams): Promise<string> {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
