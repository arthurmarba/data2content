// src/app/api/auth/[...nextauth]/route.ts

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

// Definimos nosso NextAuthOptions
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
        // Exemplo simples: login "demo"/"demo"
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
    // 1) signIn callback
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await connectToDatabase();
        const existingUser = await User.findOne({ email: user.email });
        if (!existingUser) {
          const created = await User.create({
            name: user.name,
            email: user.email,
            googleId: account.providerAccountId,
            role: "user",
          });
          user.id = created._id.toString();
        } else {
          user.id = existingUser._id.toString();
        }
      }
      return true;
    },

    // 2) jwt callback
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id; // Copia user.id para token.sub
        if (user.image) {
          token.picture = user.image; // Salva a foto no token
        }
      }
      return token;
    },

    // 3) session callback
    async session({ session, token }) {
      // Se não tiver token.sub, não temos ID de usuário
      if (!token.sub) return session;

      // Conecta ao banco e carrega dados extras
      await connectToDatabase();
      const dbUser = await User.findById(token.sub);

      // Se session.user estiver indefinido, inicializamos
      if (!session.user) {
        session.user = {
          name: null,
          email: null,
          image: null,
        };
      }

      // Forçamos as propriedades extras via type assertion
      const typedUser = session.user as {
        id?: string;
        role?: string;
        planStatus?: string;
        planExpiresAt?: string | null;
        affiliateCode?: string;
        affiliateBalance?: number;
        affiliateRank?: number;
        affiliateInvites?: number;
        name: string | null;
        email: string | null;
        image: string | null;
      };

      // Se achamos o usuário no banco, populamos
      if (dbUser) {
        typedUser.id = dbUser._id.toString();
        typedUser.role = dbUser.role;
        typedUser.planStatus = dbUser.planStatus;
        typedUser.planExpiresAt = dbUser.planExpiresAt;
        typedUser.affiliateCode = dbUser.affiliateCode;
        typedUser.affiliateBalance = dbUser.affiliateBalance;
        typedUser.affiliateRank = dbUser.affiliateRank;
        typedUser.affiliateInvites = dbUser.affiliateInvites;
      }

      // Ajusta a imagem, se estiver no token
      if (token.picture) {
        typedUser.image = token.picture as string;
      }

      return session;
    },

    // 4) redirect callback
    async redirect({ baseUrl }) {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
