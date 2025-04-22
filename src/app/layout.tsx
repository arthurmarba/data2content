// src/app/layout.tsx (v1.1 - Header Condicional)
"use client"; // Necessário para usar hooks como usePathname

import type { Metadata } from "next"; // Metadata geralmente fica em page.tsx ou layout.tsx server-side
import { Poppins } from "next/font/google";
import { usePathname } from 'next/navigation'; // Importa o hook para pegar a rota atual
import "./globals.css";

// Importe seus componentes Header e Footer
import Header from "./components/Header";
import Footer from "./components/Footer";
import { Providers } from "./providers";

// Carrega a fonte Poppins
const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: 'swap',
  variable: "--font-poppins",
});

// Metadata pode precisar ser movida para page.tsx se este layout for client-side
// export const metadata: Metadata = {
//   title: "Data2Content: Gestão de Carreira IA para Criadores",
//   description: "Impulsione sua carreira de criador com insights de IA via WhatsApp, gestão estratégica e oportunidades exclusivas. Vire afiliado e comece a ganhar.",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname(); // Pega a rota atual

  // Define se o header global deve ser mostrado
  // Não mostra no dashboard, pois ele tem seu próprio header
  const showHeader = pathname !== '/dashboard';

  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full`}>
      {/* Head pode ser usado aqui para tags globais, mas title/desc são melhores por página */}
      <head>
         {/* Adicione links globais aqui se necessário (favicon, etc.) */}
      </head>
      <body
        className={`
          font-sans {/* Usa a fonte definida no tailwind.config.ts */}
          antialiased
          flex
          flex-col
          min-h-screen
          bg-brand-light {/* Cor de fundo base do manual */}
          text-brand-dark {/* Cor de texto base do manual */}
        `}
      >
        <Providers>
          {/* Renderiza o Header global condicionalmente */}
          {showHeader && <Header />}

          {/* Ajusta o padding do main baseado na presença do header */}
          <main className={`flex-grow ${showHeader ? 'pt-16 md:pt-20' : ''}`}>
            {children}
          </main>

          {/* Renderiza o Footer sempre (ou condicionalmente se necessário) */}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
