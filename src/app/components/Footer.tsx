"use client";

import React from "react";
import { usePathname } from 'next/navigation';

const Footer: React.FC = () => {
  const pathname = usePathname();
  // Oculta o rodapé na página de chat para experiência full-page estilo Gemini/ChatGPT
  if (pathname?.startsWith('/dashboard/chat')) return null;

  return (
    <footer className="bg-gray-800 py-4 px-6 text-center">
      <p className="text-sm text-gray-400">
        &copy; {new Date().getFullYear()} D2C Academy. Todos os direitos reservados.
      </p>
    </footer>
  );
};

export default Footer;
