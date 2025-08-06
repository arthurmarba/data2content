// src/app/components/Header.tsx
"use client";

import React from "react";
import { useSession, signOut, signIn } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation"; // ✅ Importado usePathname
import Link from "next/link";

const Header: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname(); // ✅ Obtém o pathname atual

  // Função para deslogar e redirecionar para "/"
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  // ✅ Se o pathname for '/dashboard', o Header não renderiza nada (retorna null)
  if (pathname === "/dashboard") {
    return null;
  }

  // Se não for '/dashboard', renderiza o Header normalmente
  return (
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-sm shadow-sm font-sans">
      <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-4">
        {/* Logo */}
        <div>
          <Link href="/">
            <span className="text-2xl font-extrabold tracking-tight text-gray-800 hover:opacity-90 transition-opacity">
              data2content.ai
            </span>
          </Link>
        </div>

        {/* Botões de navegação */}
        <nav className="flex space-x-2">
          {session ? (
            <>
              {/* Apenas botão de sair para usuários logados */}
              <button
                onClick={handleSignOut}
                className="px-3 py-1 text-sm rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              {/* Apenas botão de login para usuários deslogados */}
              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="px-3 py-1 text-sm rounded border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
              >
                Login
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;