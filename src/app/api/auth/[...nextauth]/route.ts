// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import type { NextAuthOptions, Session, User, Account } from "next-auth"; // Tipos padrão
import type { AdapterUser } from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Sua interface IUser do Mongoose
import { Types } from "mongoose";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";
// import { nanoid } from 'nanoid';

export const runtime = "nodejs";

/**
 * Interfaces auxiliares para os callbacks (mantidas para clareza interna).
 */
interface SignInCallback {
  user: User & { id?: string }; // User from provider or authorize
  account: Account | null;
}

interface JwtCallback {
  token: JWT;
  user?: User | AdapterUser; // User object on initial sign in
}

interface RedirectCallback {
  baseUrl: string;
}

/**
 * Custom encode (HS256) para JWT.
 */
async function customEncode({ token, secret, maxAge }: JWTEncodeParams): Promise<string> {
    if (!secret) throw new Error("NEXTAUTH_SECRET ausente em customEncode");
    const secretString = typeof secret === "string" ? secret : String(secret);
    const expirationTime = Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60);
    return await new SignJWT({ ...token })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expirationTime)
        .sign(new TextEncoder().encode(secretString));
}


/**
 * Custom decode (HS256) para JWT com logs adicionais.
 */
async function customDecode({ token, secret }: JWTDecodeParams): Promise<JWT | null> {
    if (!token || !secret) {
        console.error("customDecode: Token ou secret não fornecidos.");
        return null;
    }
    const secretString = typeof secret === "string" ? secret : String(secret);
    try {
        console.debug("customDecode: Iniciando decodificação do token:", token.substring(0, 10) + "...");
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secretString), {
            algorithms: ["HS256"],
        });
        console.debug("customDecode: Token decodificado com sucesso.");
        return payload as JWT;
    } catch (err) {
        console.error("customDecode: Erro ao decodificar token:", err instanceof Error ? err.message : err);
        return null;
    }
}


/**
 * Configurações do NextAuth.
 */
export const authOptions: NextAuthOptions = {
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    // ... (configuração de cookies mantida) ...
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined,
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined,
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
         domain: process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_COOKIE_DOMAIN : undefined,
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
      // ... (provider de Credentials mantido) ...
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
      console.debug("NextAuth: signIn callback initiated", { userId: user.id, provider: account?.provider });
      if (account?.provider === "google") {
        if (!user.email) {
             console.error("Erro no signIn: Email do Google não encontrado.");
             return false;
        }
        try {
          await connectToDatabase();
          let existingUser = await DbUser.findOne({ email: user.email }).exec() as IUser | null;

          if (!existingUser) {
            console.debug("NextAuth: Criando novo usuário para email:", user.email);
            const newUser = new DbUser({
              name: user.name,
              email: user.email,
              image: user.image,
              googleId: account.providerAccountId, // Salva o ID do Google
              role: "user", // Role padrão
              planStatus: "inactive",
              planExpiresAt: null,
              affiliateBalance: 0, // Inicializa
              affiliateRank: 1,    // Inicializa
              affiliateInvites: 0, // Inicializa
            });
            // Hook pre-save gerará affiliateCode
            existingUser = await newUser.save();
            user.id = existingUser._id.toString(); // Atribui o ID do DB ao user da sessão
            console.debug("NextAuth: Novo usuário criado com sucesso, id =", user.id);
            console.debug("NextAuth: Código de afiliado atribuído pelo hook:", existingUser.affiliateCode);

          } else {
            console.debug("NextAuth: Usuário já existe, id =", existingUser._id.toString());
            user.id = existingUser._id.toString(); // Garante que o ID do DB esteja no user da sessão

             let needsSave = false;
             // Atualiza nome/imagem se mudou
             if (user.name && user.name !== existingUser.name) { existingUser.name = user.name; needsSave = true; }
             if (user.image && user.image !== existingUser.image) { existingUser.image = user.image; needsSave = true; }
             // Atualiza googleId se não existia (caso raro de conta criada manualmente antes)
             if (!existingUser.googleId && account.providerAccountId) { existingUser.googleId = account.providerAccountId; needsSave = true; }

             // Inicializa campos de afiliado se necessário
             if (existingUser.affiliateBalance === undefined || existingUser.affiliateBalance === null) { existingUser.affiliateBalance = 0; needsSave = true; }
             if (existingUser.affiliateRank === undefined || existingUser.affiliateRank === null) { existingUser.affiliateRank = 1; needsSave = true; }
             if (existingUser.affiliateInvites === undefined || existingUser.affiliateInvites === null) { existingUser.affiliateInvites = 0; needsSave = true; }
             // Verifica código de afiliado (hook cuidará se 'needsSave' for true)
             if (!existingUser.affiliateCode) {
                 console.warn("Usuário existente sem affiliateCode. Será gerado no próximo save (se houver).");
                 // Descomente abaixo se quiser forçar a criação imediata
                 // needsSave = true;
             }

            if (needsSave) {
                await existingUser.save();
                console.debug("NextAuth: Dados do usuário existente atualizados/verificados.");
            }
          }
        } catch (error) {
          console.error("Erro durante signIn ao interagir com o banco:", error);
          return false;
        }
      } else if (account?.provider === "credentials") {
         // Lógica similar para Credentials (verificar/inicializar afiliado)
         if (!user?.id) { console.error("Erro: Usuário de Credentials sem ID."); return false; }
         try {
            await connectToDatabase();
            const credUser = await DbUser.findById(user.id);
            if (credUser && !credUser.affiliateCode) {
                credUser.affiliateBalance = credUser.affiliateBalance ?? 0;
                credUser.affiliateRank = credUser.affiliateRank ?? 1;
                credUser.affiliateInvites = credUser.affiliateInvites ?? 0;
                await credUser.save(); // Hook pre-save gerará o código
                console.debug("NextAuth: Código/dados de afiliado inicializados para usuário de Credentials.");
            }
         } catch(error) { console.error("Erro ao verificar/atualizar usuário de Credentials:", error); }
      }

      if (!user?.id) { console.error("Erro no signIn: user.id não definido."); return false; }
      return true; // Permite o login
    },

    async jwt({ token, user, account }: { token: JWT; user?: User | AdapterUser; account?: Account | null }): Promise<JWT> {
        console.debug("NextAuth: JWT Callback initiated", { userId: user?.id, accountProvider: account?.provider });
        // Na primeira vez (login), adiciona o ID do usuário ao token
        if (account && user?.id) {
            token.id = user.id;
        }
        // Poderia adicionar a role ao token aqui também para evitar busca no DB a cada sessão?
        // if (user?.role) { token.role = user.role } // Exemplo, mas requer buscar no DB no signIn
        console.debug("NextAuth: JWT Callback finished", { tokenId: token.id });
        return token;
    },

    async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
      console.debug("NextAuth: Session Callback initiated", { tokenId: token.id });

      // Garante que user exista e atribui o ID do token
      if (token.id && session.user) {
          session.user.id = token.id as string;
      } else {
          console.error("Erro na Session Callback: token.id ou session.user ausente.");
          return session; // Retorna sessão original ou vazia
      }

      try {
        await connectToDatabase();
        // Busca o usuário no DB a cada chamada de sessão para ter dados atualizados
        const dbUser = await DbUser.findById(token.id).lean(); // .lean() para objeto JS puro

        if (dbUser && session.user) {
          console.debug("NextAuth: Usuário encontrado no DB para sessão:", dbUser._id);

          // Atribui os dados do DB para a sessão
          session.user.name = dbUser.name ?? session.user.name; // Mantém da sessão se DB for nulo
          session.user.email = dbUser.email ?? session.user.email;
          session.user.image = dbUser.image ?? session.user.image;

          // Campos customizados
          session.user.role = dbUser.role ?? 'user'; // Default para 'user' se não definido
          session.user.planStatus = dbUser.planStatus ?? 'inactive';
          session.user.planExpiresAt = dbUser.planExpiresAt instanceof Date
                                        ? dbUser.planExpiresAt.toISOString()
                                        : null;
          session.user.affiliateCode = dbUser.affiliateCode ?? undefined; // Usa undefined se não existir
          session.user.affiliateBalance = dbUser.affiliateBalance ?? 0;
          // <<< LÓGICA SIMPLIFICADA para affiliateRank >>>
          session.user.affiliateRank = dbUser.affiliateRank ?? 1; // Usa default 1 se não definido
          session.user.affiliateInvites = dbUser.affiliateInvites ?? 0;

        } else if (session.user) {
           // Se não encontrou usuário no DB, remove campos customizados da sessão
           console.error(`Usuário não encontrado no DB para id: ${token.id}, limpando campos customizados.`);
           delete session.user.role;
           delete session.user.planStatus;
           delete session.user.planExpiresAt;
           delete session.user.affiliateCode;
           delete session.user.affiliateBalance;
           delete session.user.affiliateRank;
           delete session.user.affiliateInvites;
        }
      } catch (error) {
        console.error("Erro ao buscar/processar dados do usuário na sessão:", error);
        // Não quebra a sessão, mas loga o erro
      }

      console.debug("NextAuth: Session Callback finished", session.user);
      return session; // Retorna a sessão modificada (ou original em caso de erro)
    },

    async redirect({ baseUrl }: RedirectCallback): Promise<string> {
      // Redireciona sempre para o dashboard após login/erro
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: "/login", // Página de login customizada
    error: "/auth/error", // Página para exibir erros de autenticação
    // signOut: '/auth/signout', // Página opcional de signout
    // verifyRequest: '/auth/verify-request', // Usado para email provider
    // newUser: '/auth/new-user' // Página opcional para novos usuários
  },
  session: {
    strategy: "jwt", // Usa JWT para sessão
    maxAge: 30 * 24 * 60 * 60, // Duração da sessão: 30 dias
  },
  // debug: process.env.NODE_ENV === 'development', // Habilita logs detalhados em dev
};

// Exporta o handler do NextAuth
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
