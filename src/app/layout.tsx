// src/app/layout.tsx
// REMOVIDO: "use client";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Imports do NextAuth para buscar a sessão no servidor
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route"; // Ajuste o caminho se necessário

import Header from "./components/Header";
import Footer from "./components/Footer";
import { Providers } from "./providers";
import AuthRedirectHandler from "./components/auth/AuthRedirectHandler";
import ClientHooksWrapper from "./components/ClientHooksWrapper"; // Nosso novo componente

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: 'swap',
  variable: "--font-poppins",
});

// Agora você pode descomentar e usar metadados, pois este é um Server Component
export const metadata: Metadata = {
  title: "Data2Content: Gestão de Carreira IA para Criadores",
  description: "Impulsione sua carreira de criador com insights de IA via WhatsApp, gestão estratégica e oportunidades exclusivas. Vire afiliado e comece a ganhar.",
};

export default async function RootLayout({ // ✅ Adicionado async
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Hooks de cliente como usePathname, useSearchParams, useEffect foram removidos daqui.
  // A lógica do affiliate ref code está agora em ClientHooksWrapper.

  // ✅ Buscar a sessão no servidor
  const session = await getServerSession(authOptions);
  // Precisamos garantir que a sessão seja serializável para passar para o Providers (que é um client component)
  const serializableSession = session ? JSON.parse(JSON.stringify(session)) : null;

  // A lógica para 'showHeader' (pathname !== '/dashboard') precisará ser movida
  // para dentro do componente Header ou tratada com layouts de rota.
  // Por agora, vamos renderizar o Header e ele mesmo controlará sua visibilidade.
  // A main tag precisará de uma lógica similar para o padding-top.

  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full`}>
      <head>
        {/* Você pode adicionar outros metadados ou links aqui se necessário */}
      </head>
      <body
        className={`
          font-sans
          antialiased
          flex
          flex-col
          min-h-screen
          bg-brand-light
          text-brand-dark
        `}
      >
        <Providers session={serializableSession}> {/* ✅ Passa a sessão para o Providers */}
          <ClientHooksWrapper /> {/* ✅ Renderiza o wrapper para os hooks de cliente (lógica de afiliado) */}
          <AuthRedirectHandler>
            {/* O Header agora será responsável por sua própria lógica de exibição */}
            <Header />
            {/* A classe de padding da main tag também precisará ser condicional dentro de um client component
                ou o Header sempre ocupará seu espaço, mesmo que invisível, ou usamos CSS para o layout.
                Uma solução simples é o Header renderizar 'null' e não ocupar espaço.
                Outra é o MainContentWrapper que usa usePathname.
            */}
            <MainContentWrapper> {/* Criaremos este wrapper simples */}
              {children}
            </MainContentWrapper>
            <Footer />
          </AuthRedirectHandler>
        </Providers>
      </body>
    </html>
  );
}

// Componente wrapper simples para a lógica de padding da tag <main>
// já que `usePathname` não pode ser usado diretamente em RootLayout (Server Component)
const MainContentWrapper = ({ children }: { children: React.ReactNode }) => {
  // Este precisa ser um Client Component para usar usePathname
  // Poderíamos criar um arquivo separado para ele ou definir aqui com "use client" no topo do arquivo.
  // Para simplificar a explicação atual, imagine que a lógica do padding será ajustada
  // ou que o Header, ao se esconder, não ocupará espaço.
  // A melhor forma é o Header se tornar um client component e retornar null quando não deve ser exibido.
  // Se Header retornar null, o padding não será um problema.
  // Assumindo que o Header vai lidar com isso:
  return <main className="flex-grow pt-16 md:pt-20">{children}</main>;
  // Se o Header *não* for sempre renderizado (ou seja, se ele retornar null),
  // a classe pt-16 md:pt-20 pode precisar ser condicional.
  // Isso é melhor tratado no componente Header ou em um wrapper em volta do {children} + Header.
  // Vamos simplificar por agora e ajustar o Header no próximo passo.
};