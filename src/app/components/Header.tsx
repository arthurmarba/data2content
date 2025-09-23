// src/app/components/Header.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBars,
  FaUserCircle,
  FaFileContract,
  FaShieldAlt,
  FaEnvelope,
  FaHandshake,
  FaTrashAlt,
  FaSignOutAlt,
  FaWhatsapp,
} from "react-icons/fa";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { useSidebar } from "../dashboard/context/SidebarContext";

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/** Header unificado do dashboard (chat, mídia kit, settings, billing) */
function ChatHeader({ user }: { user?: SessionUser }) {
  const { toggleSidebar } = useSidebar();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Mantém --header-h sincronizada com a altura real do header
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      style={{ paddingTop: "var(--sat)" }} // safe-area iOS
      className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-5 py-4 sm:py-5 bg-white"
      aria-label="Barra superior do dashboard"
    >
      <div className="flex items-center justify-between w-full">
        {/* Grupo esquerdo: hambúrguer + logo */}
        <div className="flex items-center gap-3 ml-1 sm:ml-2">
          <button
            onClick={() => toggleSidebar()}
            className="p-2 text-gray-700 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Alternar menu lateral"
            title="Menu"
          >
            <FaBars className="w-6 h-6" />
          </button>
          <Link href="/dashboard" aria-label="Início" className="font-bold text-2xl text-brand-dark flex items-center gap-2 group">
            <div className="relative h-8 w-8 overflow-hidden">
              <Image
                src="/images/Colorido-Simbolo.png"
                alt="Data2Content"
                fill
                className="object-contain object-center group-hover:opacity-90 transition-opacity scale-[2.4]"
                priority
              />
            </div>
            <span>data2content</span>
          </Link>
        </div>

        {/* Avatar / menu do usuário (direita) */}
        <div className="relative flex items-center mr-1 sm:mr-2">
          <button
            onClick={() => setIsUserMenuOpen((v) => !v)}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            aria-label="Abrir menu do usuário"
          >
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || "Usuário"}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <FaUserCircle className="w-full h-full text-gray-400" />
            )}
          </button>

          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="origin-top-right absolute right-2 mt-2 w-64 max-w-[92vw] rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                onMouseLeave={() => setIsUserMenuOpen(false)}
                role="menu"
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-base font-semibold text-brand-dark truncate">
                    {user?.name ?? "Usuário"}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{user?.email || "Sem email"}</p>
                </div>
                <div className="py-1 border-t border-gray-100">
                  <Link
                    href="/termos-e-condicoes"
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-base text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                    onClick={() => setIsUserMenuOpen(false)}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                  >
                    <FaFileContract className="w-4 h-4 text-gray-400" /> Termos e Condições
                  </Link>
                  <Link
                    href="/politica-de-privacidade"
                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                    onClick={() => setIsUserMenuOpen(false)}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                  >
                    <FaShieldAlt className="w-4 h-4 text-gray-400" /> Política de Privacidade
                  </Link>
                </div>
                <div className="py-1 border-t border-gray-100">
                  <a
                    href="mailto:arthur@data2content.ai"
                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                    onClick={() => setIsUserMenuOpen(false)}
                    role="menuitem"
                  >
                    <FaEnvelope className="w-4 h-4 text-gray-400" /> Suporte por Email
                  </a>
                  <a
                    href="/afiliados"
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-base text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                    onClick={() => setIsUserMenuOpen(false)}
                    role="menuitem"
                  >
                    <FaHandshake className="w-4 h-4 text-gray-400" /> Programa de Afiliados
                  </a>
                </div>
                <div className="py-1 border-t border-gray-100">
                  <Link
                    href="/dashboard/settings#delete-account"
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-base text-red-600 hover:bg-red-50 hover:text-brand-red transition-colors rounded-md mx-1 my-0.5"
                    onClick={() => setIsUserMenuOpen(false)}
                    role="menuitem"
                  >
                    <FaTrashAlt className="w-4 h-4" /> Excluir Conta
                  </Link>
                </div>
                <div className="py-1 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      signOut({ callbackUrl: "/" });
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-base text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                    role="menuitem"
                  >
                    <FaSignOutAlt className="w-4 h-4" /> Sair
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const user = session?.user as SessionUser | undefined;
  const isDashboardPage = pathname.startsWith("/dashboard");
  const { toggleSidebar } = useSidebar();

  // Usar o header unificado também em /dashboard/media-kit, /dashboard/settings e /dashboard/billing
  const isGeminiHeaderPage = /^\/dashboard\/(chat|media-kit|settings|billing|discover|afiliados)/.test(pathname);
  // Fluxo de onboarding/instagram: header minimalista (apenas logo)
  const isOnboardingFlow = /^\/dashboard\/(onboarding|instagram)/.test(pathname);

  if (isGeminiHeaderPage) {
    return <ChatHeader user={user} />;
  }

  if (isOnboardingFlow) {
    return (
      <header className="bg-white border-gray-200 shadow-sm sticky top-0 z-20 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-start items-center h-16">
            <Link href="/" className="flex-shrink-0 flex items-center gap-2 group" aria-label="Início">
              <div className="relative h-8 w-8 overflow-hidden">
                <Image
                  src="/images/Colorido-Simbolo.png"
                  alt="Data2Content"
                  fill
                  className="object-contain object-center group-hover:opacity-90 transition-opacity scale-[2.4]"
                  priority
                />
              </div>
            </Link>
          </div>
        </div>
      </header>
    );
  }

  // Demais páginas do dashboard usam o header padrão
  if (isDashboardPage) {
    return (
      <header className="bg-white sticky top-0 z-20 px-3 sm:px-5">
        <div className="flex justify-between items-center h-16 w-full">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleSidebar()}
                className="p-2 text-gray-700 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Alternar menu lateral"
                title="Menu"
              >
                <FaBars className="w-6 h-6" />
              </button>
              <Link href={MAIN_DASHBOARD_ROUTE} className="font-bold text-2xl text-brand-dark flex items-center gap-2 group" aria-label="Início">
                <div className="relative h-8 w-8 overflow-hidden">
                  <Image
                    src="/images/Colorido-Simbolo.png"
                    alt="Data2Content"
                    fill
                    className="object-contain object-center group-hover:opacity-90 transition-opacity scale-[2.4]"
                    priority
                  />
                </div>
                <span>data2content</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/whatsapp-pro"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm sm:text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                aria-label="Acessar Whatsapp PRO"
              >
                <FaWhatsapp className="w-5 h-5" />
                <span>WhatsApp PRO</span>
              </Link>
              <button
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Perfil"
                title={user?.name || 'Perfil'}
              >
                {user?.image ? (
                  <img src={user.image} alt={user?.name || 'Usuário'} className="w-full h-full object-cover object-center" />
                ) : (
                  <FaUserCircle className="w-full h-full text-gray-400" />
                )}
              </button>
            </div>
          </div>
      </header>
    );
  }

  // Fora do dashboard, sem header
  return null;
}
