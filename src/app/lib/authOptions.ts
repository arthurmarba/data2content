import { Session } from "next-auth";
import NextAuth from "next-auth/next"; // Atualizado para o caminho correto
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { Model, Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
// Importa o modelo e a interface do usuário
import DbUser, { IUser } from "@/app/models/User";

// Atualize a interface BaseUser para permitir undefined
interface BaseUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

// Define a interface para o objeto account, permitindo null
interface CustomAccount {
  provider: string;
  providerAccountId: string;
  // Adicione outras propriedades, se necessário
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Define o escopo para obter a foto de perfil
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
      // Mapeia o objeto "profile" do Google para o objeto "user"
      profile(profile) {
        return {
          id: profile.sub, // O Google retorna "sub" como ID do usuário
          name: profile.name,
          email: profile.email,
          image: profile.picture, // Foto de perfil
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
        return null; // Falha na autenticação
      },
    }),
  ],

  callbacks: {
    /**
     * signIn callback:
     * - Para Google, cria o usuário no banco se não existir.
     * - Garante que user.id seja o _id do Mongo.
     */
    async signIn({
      user,
      account,
    }: {
      user: BaseUser;
      account: CustomAccount | null;
    }) {
      if (account?.provider === "google") {
        await connectToDatabase();
        // Converte DbUser explicitamente para Model<IUser> para garantir a tipagem correta do findOne
        const existingUser = await (DbUser as Model<IUser>).findOne({ email: user.email });
        if (!existingUser) {
          // Cria o usuário no Mongo (sem salvar a foto)
          const created = new DbUser({
            name: user.name,
            email: user.email,
            googleId: account.providerAccountId,
            role: "user",
          });
          await created.save();
          // Converte o _id para string, garantindo que é do tipo ObjectId
          user.id = (created._id as Types.ObjectId).toString();
        } else {
          user.id = (existingUser._id as Types.ObjectId).toString();
        }
      }
      return true;
    },

    /**
     * jwt callback:
     * - Copia user.id para token.sub.
     * - Copia user.image para token.picture, para exibir depois sem salvar no DB.
     */
    async jwt({ token, user }: { token: JWT; user?: IUser | null }) {
      if (user) {
        token.sub = user.id;
        if (user.image) {
          token.picture = user.image;
        }
      }
      return token;
    },

    /**
     * session callback:
     * - Usa token.sub para buscar dados extras (planStatus etc.) no DB.
     * - Converte planExpiresAt para string ISO e copia token.picture para session.user.image.
     *
     * Nota: Para evitar warnings de variáveis não utilizadas, os parâmetros "newSession",
     * "trigger" e "user" não são desestruturados, mas permanecem na tipagem.
     */
    async session(
      params: {
        session: Session;
        token: JWT;
        newSession: unknown;
        trigger: "update";
        user: unknown;
      }
    ): Promise<Session> {
      const { session, token } = params;
      // Garante que session.user exista definindo um objeto base com os campos obrigatórios
      const baseUser = {
        id: token.sub as string,
        name: session.user?.name ?? null,
        email: session.user?.email ?? null,
        image: session.user?.image ?? null,
      };
      session.user = baseUser;

      await connectToDatabase();
      const dbUser = await DbUser.findById(token.sub);

      if (dbUser) {
        session.user.role = dbUser.role;
        session.user.planStatus = dbUser.planStatus;
        session.user.planExpiresAt = dbUser.planExpiresAt
          ? dbUser.planExpiresAt.toISOString()
          : null;
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

    /**
     * redirect callback:
     * - Redireciona sempre para /dashboard depois de logar.
     */
    async redirect({ baseUrl }: { baseUrl: string }) {
      return baseUrl + "/dashboard";
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
