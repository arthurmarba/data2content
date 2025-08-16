// src/app/components/Header.tsx (Menu Completo)
"use client";

import React, { useState } from 'react';
import { useSession, signOut, signIn } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
// <<< ALTERAÇÃO: Importamos todos os ícones necessários >>>
import { FaUserCircle, FaCreditCard, FaFileContract, FaShieldAlt, FaEnvelope, FaHandshake, FaTrashAlt, FaSignOutAlt, FaTachometerAlt } from 'react-icons/fa';
import { motion, AnimatePresence } from "framer-motion";

// Tipo para o usuário da sessão
interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const user = session?.user as SessionUser | undefined;
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // A lógica principal: verifica se a página atual está dentro do /dashboard
  const isDashboardPage = pathname.startsWith('/dashboard');

  if (isDashboardPage) {
    // Se estiver no dashboard, renderiza o cabeçalho completo com menu do usuário
    return (
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex-shrink-0 flex items-center gap-2 group">
              <span className="text-brand-pink text-3xl font-bold group-hover:opacity-80 transition-opacity">[2]</span>
            </Link>
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="p-2 rounded-full text-gray-500 hover:text-brand-dark hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink transition-colors"
                aria-expanded={isUserMenuOpen} aria-haspopup="true" aria-label="Menu de ações"
              >
                {user?.image ? (
                  <Image src={user.image} alt="Avatar" width={32} height={32} className="rounded-full" />
                ) : (
                  <FaUserCircle className="w-6 h-6" />
                )}
              </button>
              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-brand-dark truncate">{user?.name ?? 'Usuário'}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email || 'Sem email'}</p>
                    </div>
                    
                    {/* <<< INÍCIO DA CORREÇÃO: Links adicionados e restaurados >>> */}
                    <div className="py-1">
                       <Link
                        href="/dashboard"
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <FaTachometerAlt className="w-4 h-4 text-gray-400"/> Dashboard Principal
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <FaCreditCard className="w-4 h-4 text-gray-400"/> Gerir Assinatura
                      </Link>
                    </div>
                    <div className="py-1 border-t border-gray-100">
                      <Link
                        href="/termos-e-condicoes"
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                        onClick={() => setIsUserMenuOpen(false)}
                        target="_blank" rel="noopener noreferrer"
                      >
                        <FaFileContract className="w-4 h-4 text-gray-400"/> Termos e Condições
                      </Link>
                      <Link
                        href="/politica-de-privacidade"
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                        onClick={() => setIsUserMenuOpen(false)}
                        target="_blank" rel="noopener noreferrer"
                      >
                        <FaShieldAlt className="w-4 h-4 text-gray-400"/> Política de Privacidade
                      </Link>
                    </div>
                    <div className="py-1 border-t border-gray-100">
                      <a 
                        href="mailto:arthur@data2content.ai"
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <FaEnvelope className="w-4 h-4 text-gray-400"/> Suporte por Email
                      </a>
                      <a 
                        href="/afiliados"
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <FaHandshake className="w-4 h-4 text-gray-400"/> Programa de Afiliados
                      </a>
                    </div>
                    <div className="py-1 border-t border-gray-100">
                       <Link
                        href="/dashboard/settings#delete-account"
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-brand-red transition-colors rounded-md mx-1 my-0.5"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <FaTrashAlt className="w-4 h-4"/> Excluir Conta
                      </Link>
                    </div>
                    <div className="py-1 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          signOut({ callbackUrl: '/' });
                        }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                      >
                        <FaSignOutAlt className="w-4 h-4"/> Sair
                      </button>
                    </div>
                     {/* <<< FIM DA CORREÇÃO >>> */}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Se NÃO estiver no dashboard, renderiza o cabeçalho público e simples
  return (
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-sm shadow-sm font-sans">
      <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-4">
        <div>
          <Link href="/">
            <span className="text-2xl font-extrabold tracking-tight text-gray-800 hover:opacity-90 transition-opacity">
              data2content.ai
            </span>
          </Link>
        </div>
        <nav className="flex space-x-2">
          {session ? (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-3 py-1 text-sm rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Sair
            </button>
          ) : (
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="px-3 py-1 text-sm rounded border border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
            >
              Login
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}