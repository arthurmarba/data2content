// src/app/components/Header.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
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

/** Header do chat (experiência Gemini) — visível apenas em /dashboard/chat */
function ChatHeader({ user }: { user?: SessionUser }) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Mantém --header-h sincronizada com a altura real do header (usada no ChatPanel para paddingTop)
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
      className="absolute top-0 left-0 right-0 z-20 p-2 sm:p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200/80"
      aria-label="Barra superior do chat"
    >
      <div className="flex items-center justify-between max-w-[800px] mx-auto">
        {/* Burger: apenas no MOBILE. No desktop, quem abre/fecha é o botão do próprio Sidebar */}
        <button
          onClick={toggleSidebar}
          className="p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-200/80 transition-colors lg:hidden"
          aria-label="Abrir menu lateral"
        >
          <FaBars />
        </button>

        <div className="flex flex-col items-center">
          <h2 className="font-semibold text-gray-800 select-none">data2content</h2>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-subscribe-modal"))
            }
            className="text-xs font-semibold text-white bg-gray-900 px-3 py-1 rounded-full hover:bg-gray-800 transition-colors shadow-sm"
            aria-label="Assine o plano Pro"
          >
            Seja Assinante
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            aria-label="Abrir menu do usuário"
          >
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || "Usuário"}
                className="w-full h-full object-cover"
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
                className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                onMouseLeave={() => setIsUserMenuOpen(false)}
                role="menu"
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-brand-dark truncate">
                    {user?.name ?? "Usuário"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email || "Sem email"}</p>
                </div>
                <div className="py-1 border-t border-gray-100">
                  <Link
                    href="/termos-e-condicoes"
                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
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
                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                    onClick={() => setIsUserMenuOpen(false)}
                    role="menuitem"
                  >
                    <FaHandshake className="w-4 h-4 text-gray-400" /> Programa de Afiliados
                  </a>
                </div>
                <div className="py-1 border-t border-gray-100">
                  <Link
                    href="/dashboard/settings#delete-account"
                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-brand-red transition-colors rounded-md mx-1 my-0.5"
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
                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isChatPage = pathname.startsWith("/dashboard/chat");

  // Em /dashboard/chat usamos o header “Gemini”
  if (isChatPage) {
    return <ChatHeader user={user} />;
  }

  // Demais páginas do dashboard usam o header padrão
  if (isDashboardPage) {
    return (
      <header className="bg-white border-gray-200 shadow-sm sticky top-0 z-20 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={MAIN_DASHBOARD_ROUTE} className="flex-shrink-0 flex items-center gap-2 group">
              <div className="relative h-8 w-8 overflow-hidden">
                <Image
                  src="/images/Colorido-Simbolo.png"
                  alt="Data2Content"
                  fill
                  className="object-contain object-center group-hover:opacity-90 transition-opacity scale-[2.6]"
                  priority
                />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-gray-800 group-hover:opacity-90 transition-opacity">
                data2content
              </span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/dashboard/whatsapp-pro"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-semibold text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                aria-label="Acessar Whatsapp PRO"
              >
                <FaWhatsapp className="w-4 h-4" />
                <span>WhatsApp PRO</span>
              </Link>
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-pink-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                  aria-label="Abrir menu"
                >
                  {user?.image ? (
                    <img src={user.image} alt="Menu do usuário" className="w-6 h-6 rounded-full" />
                  ) : (
                    <FaBars className="w-6 h-6" />
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
                        <p className="text-sm font-semibold text-brand-dark truncate">
                          {user?.name ?? "Usuário"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user?.email || "Sem email"}</p>
                      </div>
                      <div className="py-1 border-t border-gray-100">
                        <Link
                          href="/termos-e-condicoes"
                          className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                          onClick={() => setIsUserMenuOpen(false)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FaFileContract className="w-4 h-4 text-gray-400" /> Termos e Condições
                        </Link>
                        <Link
                          href="/politica-de-privacidade"
                          className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                          onClick={() => setIsUserMenuOpen(false)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FaShieldAlt className="w-4 h-4 text-gray-400" /> Política de Privacidade
                        </Link>
                      </div>
                      <div className="py-1 border-t border-gray-100">
                        <a
                          href="mailto:arthur@data2content.ai"
                          className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <FaEnvelope className="w-4 h-4 text-gray-400" /> Suporte por Email
                        </a>
                        <a
                          href="/afiliados"
                          className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                        >
                          <FaHandshake className="w-4 h-4 text-gray-400" /> Programa de Afiliados
                        </a>
                      </div>
                      <div className="py-1 border-t border-gray-100">
                        <Link
                          href="/dashboard/settings#delete-account"
                          className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-brand-red transition-colors rounded-md mx-1 my-0.5"
                          onClick={() => setIsUserMenuOpen(false)}
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
                          className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5"
                        >
                          <FaSignOutAlt className="w-4 h-4" /> Sair
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // Fora do dashboard, sem header
  return null;
}
