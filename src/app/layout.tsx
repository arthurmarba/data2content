// src/app/layout.tsx
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

import Header from "./components/Header";
import Footer from "./components/Footer";
import { Providers } from "./providers"; // SessionProvider

const poppins = Poppins({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "D2C Academy",
  description: "D2C Academy - Learn and Grow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body
        className={`
          ${poppins.variable} 
          antialiased 
          flex 
          flex-col 
          min-h-screen 
          bg-white 
          text-gray-900
        `}
      >
        {/* Providers = SessionProvider */}
        <Providers>
          <Header />
          <main className="flex-grow pt-20">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
