"use client";

import Link from "next/link";
import React from "react";

// Define as props que o componente aceita
interface ButtonPrimaryProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  rel?: string; // Adicionado para suportar o atributo rel="nofollow"
}

export default function ButtonPrimary({
  href,
  onClick,
  children,
  className = "",
  rel,
}: ButtonPrimaryProps) {
  // Classes de estilo baseadas no seu código de referência
  // CORREÇÃO: A cor da sombra foi alterada para usar a cor personalizada 'brand-pink'
  const commonClasses = `
    group inline-flex items-center justify-center gap-3 rounded-full 
    bg-gradient-to-r from-brand-pink to-brand-red 
    px-8 py-4 text-lg font-bold text-white 
    shadow-lg shadow-brand-pink/30 
    transition-all duration-300 
    hover:shadow-xl hover:shadow-brand-pink/40 hover:scale-105 
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2
    ${className}
  `;

  // Se a prop 'href' for fornecida, renderiza um componente Link do Next.js
  if (href) {
    return (
      <Link href={href} className={commonClasses} rel={rel}>
        {children}
      </Link>
    );
  }

  // Caso contrário, renderiza um botão padrão
  return (
    <button onClick={onClick} className={commonClasses}>
      {children}
    </button>
  );
}
