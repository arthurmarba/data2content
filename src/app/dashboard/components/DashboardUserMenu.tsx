"use client";

import React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaArrowRight,
  FaCreditCard,
  FaEnvelope,
  FaFileContract,
  FaHandshake,
  FaLink,
  FaShieldAlt,
  FaSignOutAlt,
  FaTrashAlt,
  FaUserCircle,
} from "react-icons/fa";
import { UserAvatar } from "@/app/components/UserAvatar";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

function UserMenuPanel({
  user,
  onClose,
  align = "right",
}: {
  user?: SessionUser;
  onClose: () => void;
  align?: "left" | "right";
}) {
  const itemBaseClass =
    "mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100/90 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/25";
  const positionClass = align === "left" ? "left-0 origin-bottom-left" : "right-0 origin-bottom-right";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`absolute bottom-[calc(100%+0.75rem)] z-[260] w-72 max-w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 py-2 shadow-[0_24px_50px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/5 backdrop-blur-xl focus:outline-none ${positionClass}`}
      onMouseLeave={onClose}
      role="menu"
    >
      <div className="border-b border-slate-100 px-4 pb-3 pt-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <FaUserCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user?.name ?? "Usuário"}
            </p>
            <p className="truncate text-xs text-slate-500">{user?.email || "Sem email"}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 py-1">
        <Link
          href="/dashboard/instagram-connection"
          className={itemBaseClass}
          onClick={onClose}
          role="menuitem"
        >
          <FaLink className="h-4 w-4 text-slate-400" /> Conexão
        </Link>
        <Link
          href="/settings"
          className={itemBaseClass}
          onClick={onClose}
          role="menuitem"
        >
          <FaCreditCard className="h-4 w-4 text-slate-400" /> Gerir assinatura
        </Link>
      </div>
      <div className="border-t border-slate-100 py-1">
        <Link
          href="/termos-e-condicoes"
          className={itemBaseClass}
          onClick={onClose}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
        >
          <FaFileContract className="h-4 w-4 text-slate-400" /> Termos e Condições
        </Link>
        <Link
          href="/politica-de-privacidade"
          className={itemBaseClass}
          onClick={onClose}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
        >
          <FaShieldAlt className="h-4 w-4 text-slate-400" /> Política de Privacidade
        </Link>
      </div>
      <div className="border-t border-slate-100 py-1">
        <a
          href="mailto:arthur@data2content.ai"
          className={itemBaseClass}
          onClick={onClose}
          role="menuitem"
        >
          <FaEnvelope className="h-4 w-4 text-slate-400" /> Suporte por Email
        </a>
        <Link
          href="/afiliados"
          className={itemBaseClass}
          onClick={onClose}
          role="menuitem"
        >
          <FaHandshake className="h-4 w-4 text-slate-400" /> Programa de Afiliados
        </Link>
      </div>
      <div className="border-t border-slate-100 py-1">
        <Link
          href="/dashboard/settings#delete-account"
          className={`${itemBaseClass} text-red-600 hover:bg-red-50 hover:text-red-700`}
          onClick={onClose}
          role="menuitem"
        >
          <FaTrashAlt className="w-4 h-4" /> Excluir Conta
        </Link>
      </div>
      <div className="border-t border-slate-100 py-1">
        <button
          onClick={() => {
            onClose();
            signOut({ callbackUrl: "/" });
          }}
          className={itemBaseClass}
          role="menuitem"
        >
          <FaSignOutAlt className="w-4 h-4" /> Sair
        </button>
      </div>
    </motion.div>
  );
}

export default function DashboardUserMenu({
  user,
  showLabel = false,
  align = "right",
  className = "",
}: {
  user?: SessionUser;
  showLabel?: boolean;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const isAuthenticated = Boolean(user?.id);

  if (!isAuthenticated) {
    const handleSignIn = () => {
      const callbackUrl =
        typeof window !== "undefined" ? window.location.href : "/";
      redirectToGoogleConsentLogin(callbackUrl);
    };

    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={handleSignIn}
          title="Entrar"
          className={`group flex w-full items-center gap-3 text-left backdrop-blur-xl transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-300/70 focus:ring-offset-2 ${
            showLabel
              ? "justify-start rounded-[22px] border border-zinc-200/80 bg-white/78 px-3 py-3 shadow-[0_12px_28px_rgba(24,24,27,0.06)] hover:bg-white"
              : "mx-auto h-[52px] w-[52px] justify-center rounded-[18px] bg-transparent p-0 shadow-none hover:bg-black/[0.035]"
          }`}
          aria-label="Entrar com Google"
        >
          <span
            className={`inline-flex items-center justify-center rounded-full bg-white/72 text-zinc-700 ring-1 ring-white/70 ${
              showLabel ? "h-11 w-11" : "h-10 w-10"
            }`}
          >
            <FaUserCircle className={showLabel ? "h-5 w-5" : "h-4.5 w-4.5"} />
          </span>
          {showLabel ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-zinc-900">
                Entrar
              </span>
              <span className="block truncate text-[11px] text-zinc-500/90">
                Retomar com Google
              </span>
            </span>
          ) : null}
          {showLabel ? <FaArrowRight className="h-3.5 w-3.5 text-zinc-500" /> : null}
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`group flex w-full items-center gap-3 text-left backdrop-blur-xl transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-300/70 focus:ring-offset-2 ${
          showLabel
            ? "justify-start rounded-[22px] border border-zinc-200/80 bg-white/78 px-3 py-3 shadow-[0_12px_28px_rgba(24,24,27,0.06)] hover:bg-white"
            : "mx-auto h-[52px] w-[52px] justify-center rounded-[18px] bg-transparent p-0 shadow-none hover:bg-black/[0.035]"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Abrir menu do usuário"
      >
        <span className={`overflow-hidden rounded-full ring-1 ring-white/70 ${showLabel ? "h-11 w-11" : "h-10 w-10"}`}>
          <UserAvatar
            name={user?.name || "Usuário"}
            src={user?.image}
            size={showLabel ? 44 : 40}
            className="h-full w-full"
          />
        </span>
        {showLabel ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-zinc-900">
              {user?.name ?? "Usuário"}
            </span>
            <span className="block truncate text-[11px] text-zinc-500/90">{user?.email ?? "Minha conta"}</span>
          </span>
        ) : null}
      </button>
      <AnimatePresence>
        {open ? <UserMenuPanel user={user} onClose={() => setOpen(false)} align={align} /> : null}
      </AnimatePresence>
    </div>
  );
}
