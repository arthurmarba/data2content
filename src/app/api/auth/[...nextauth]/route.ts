import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

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

    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Se o token não tiver 'sub', não temos um ID de usuário
      if (!token.sub) return session;

      // Conecta ao banco e carrega dados extras
      await connectToDatabase();
      const dbUser = await User.findById(token.sub);

      // Se por algum motivo session.user estiver indefinido,
      // inicializamos com um objeto mínimo. Assim, evitamos o erro de TS.
      if (!session.user) {
        session.user = {
          name: null,
          email: null,
          image: null,
        };
      }

      if (dbUser) {
        // Agora é seguro acessar session.user, pois garantimos que não é undefined
        session.user.id = dbUser._id.toString();
        session.user.role = dbUser.role;
        session.user.planStatus = dbUser.planStatus;
        session.user.planExpiresAt = dbUser.planExpiresAt;
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

    async redirect({ baseUrl }) {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
