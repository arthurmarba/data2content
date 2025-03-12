// src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import User, { IUser } from "@/app/models/User";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

/**
 * Parâmetros para o callback signIn do NextAuth
 */
interface SignInParams {
  user: {
    /** Email do usuário retornado pelo provedor */
    email?: string | null;
    /** Nome do usuário retornado pelo provedor */
    name?: string | null;
    /** Identificador único do usuário */
    id?: string;
    /** URL da imagem do usuário */
    image?: string | null;
  };
  account: {
    /** Nome do provedor (ex.: 'google' ou 'credentials') */
    provider?: string;
    /** Identificador específico da conta no provedor */
    providerAccountId?: string;
  } | null;
}

interface JwtParams {
  token: {
    sub?: string;
    picture?: string;
    [key: string]: unknown;
  };
  user?: {
    id?: string;
    image?: string;
    [key: string]: unknown;
  };
}

/**
 * Interface para os parâmetros do callback session, conforme o padrão NextAuth.
 */
interface NextAuthSessionParams {
  session: Session & {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      role?: string;
      planStatus?: string;
      planExpiresAt?: string | null;
      affiliateCode?: string;
      affiliateBalance?: number;
      affiliateRank?: number;
      affiliateInvites?: number;
    };
  };
  token: JWT & { picture?: string; sub?: string };
}

interface RedirectParams {
  baseUrl: string;
  url: string;
}

const authOptions = {
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
          };
        }
        return null;
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }: SignInParams): Promise<boolean> {
      if (account?.provider === "google") {
        await connectToDatabase();
        // Define o tipo de existingUser explicitamente como IUser ou null
        const existingUser = (await User.findOne({ email: user.email })) as IUser | null;
        if (!existingUser) {
          // Ao criar o usuário, garante que o retorno seja tipado como IUser
          const created = (await User.create({
            name: user.name,
            email: user.email,
            googleId: account.providerAccountId,
            role: "user",
          })) as IUser;
          user.id = created._id.toString();
        } else {
          user.id = existingUser._id.toString();
        }
      }
      return true;
    },

    async jwt({ token, user }: JwtParams) {
      if (user) {
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },

    async session({ session, token }: NextAuthSessionParams) {
      if (!token.sub) return session;

      await connectToDatabase();
      const dbUser = await User.findById(token.sub);

      if (dbUser) {
        session.user.id = dbUser._id.toString();
        session.user.role = dbUser.role;
        session.user.planStatus = dbUser.planStatus;
        session.user.planExpiresAt = dbUser.planExpiresAt ? dbUser.planExpiresAt.toString() : null;
        session.user.affiliateCode = dbUser.affiliateCode;
        session.user.affiliateBalance = dbUser.affiliateBalance;
        session.user.affiliateRank = dbUser.affiliateRank;
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
