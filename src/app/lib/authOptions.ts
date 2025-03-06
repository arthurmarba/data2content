import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // 1) Define o escopo para obter a foto de perfil
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
      // 2) Mapeia o objeto "profile" do Google para o objeto "user"
      profile(profile) {
        return {
          id: profile.sub,          // O Google retorna "sub" como ID do usuário
          name: profile.name,
          email: profile.email,
          image: profile.picture,   // Foto de perfil
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
        return null; // Falha
      },
    }),
  ],

  callbacks: {
    /**
     * 1) signIn callback:
     *    - Para Google, cria o usuário no banco se não existir.
     *    - Garante que user.id seja o _id do Mongo.
     */
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await connectToDatabase();
        const existingUser = await User.findOne({ email: user.email });
        if (!existingUser) {
          // Cria o usuário no Mongo (sem salvar a foto)
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

    /**
     * 2) jwt callback:
     *    - Copia user.id para token.sub.
     *    - Copia user.image para token.picture, para exibir depois sem salvar no DB.
     */
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image; // Foto do Google
        }
      }
      return token;
    },

    /**
     * 3) session callback:
     *    - Usa token.sub para buscar dados extras (planStatus etc.) no DB.
     *    - Copia token.picture para session.user.image (exibindo a foto no front).
     */
    async session({ session, token }) {
      // Se não houver sub, não fazemos nada
      if (!token.sub) return session;

      await connectToDatabase();
      const dbUser = await User.findById(token.sub);
      if (dbUser) {
        session.user.id = dbUser._id.toString();
        session.user.role = dbUser.role;
        session.user.planStatus = dbUser.planStatus;
        session.user.planExpiresAt = dbUser.planExpiresAt;
        session.user.affiliateCode = dbUser.affiliateCode;
        session.user.affiliateBalance = dbUser.affiliateBalance;
        session.user.affiliateRank = dbUser.affiliateRank;
        session.user.affiliateInvites = dbUser.affiliateInvites;
      }

      // Copia token.picture para session.user.image
      if (token.picture) {
        session.user.image = token.picture as string;
      }
      return session;
    },

    /**
     * 4) redirect callback:
     *    - Redireciona sempre para /dashboard depois de logar
     */
    async redirect({ baseUrl }) {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET, // defina no .env
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
