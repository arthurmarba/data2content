"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Home,
  TrendingUp,
  DollarSign,
  PenLine,
  LayoutGrid
} from "lucide-react";
import { UserAvatar } from "@/app/components/UserAvatar";

type MobileBottomNavItem = {
  key: string;
  label: string;
  icon: typeof Home;
  href: string;
  match: (pathname: string) => boolean;
  isAvatar?: boolean;
};

const navItems: MobileBottomNavItem[] = [
  {
    key: "home",
    label: "Comunidade",
    icon: Home,
    href: "/dashboard/home",
    match: (p: string) => p === "/dashboard/home" || p === "/" || p === "/dashboard",
  },
  {
    key: "analysis",
    label: "Análise",
    icon: TrendingUp,
    href: "/planning/graficos",
    match: (p: string) => p.startsWith("/planning/graficos"),
  },
  {
    key: "campaigns",
    label: "Campanhas",
    icon: DollarSign,
    href: "/campaigns",
    match: (p: string) => p.startsWith("/campaigns"),
  },
  {
    key: "calendar",
    label: "Criação",
    icon: PenLine,
    href: "/calendar",
    match: (p: string) => p.startsWith("/calendar"),
  },
  {
    key: "profile",
    label: "Perfil",
    icon: LayoutGrid,
    href: "/dashboard/media-kit",
    match: (p: string) => p.startsWith("/dashboard/media-kit") || p.startsWith("/media-kit") || p.startsWith("/dashboard/settings"),
    isAvatar: true,
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const user = session?.user as any;

  // Ocultar em fluxos guiados ou print
  const isGuidedFlow = pathname === "/dashboard/instagram";
  const isPrintMode = searchParams?.get("print") === "1" || searchParams?.get("print") === "true";

  if (isGuidedFlow || isPrintMode) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[200] flex h-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] items-start justify-around border-t border-zinc-100 bg-white px-1 pb-[env(safe-area-inset-bottom,0px)] pt-3.5 shadow-[0_-12px_45px_rgba(0,0,0,0.08)] lg:hidden">
      {navItems.map((item) => {
        const isActive = item.match(pathname || "");
        const Icon = item.icon;

        return (
          <Link
            key={item.key}
            href={item.href}
            className={`relative flex flex-col items-center justify-center gap-1.5 min-w-[64px] transition-colors ${
              isActive ? "text-[#F6007B]" : "text-zinc-400 hover:text-zinc-900"
            }`}
          >
            <div
              className={`flex items-center justify-center transition-transform duration-200 ${
                isActive ? "-translate-y-px scale-[1.08]" : "translate-y-0 scale-100"
              }`}
            >
              {item.isAvatar ? (
                <div
                  className={`relative rounded-full p-0.5 transition-all duration-200 ${
                    isActive 
                      ? "ring-2 ring-[#F6007B] ring-offset-2 ring-offset-white" 
                      : "ring-1 ring-zinc-200"
                  }`}
                >
                  <UserAvatar 
                    src={user?.image} 
                    name={user?.name || "Usuário"} 
                    size={24} 
                    className="h-6 w-6" 
                  />
                </div>
              ) : (
                <Icon 
                  strokeWidth={isActive ? 2.5 : 2} 
                  className={`h-6 w-6 transition-all duration-200 ${isActive ? "drop-shadow-[0_0_10px_rgba(246,0,123,0.25)]" : ""}`} 
                />
              )}
            </div>

            <span 
              className={`text-[10px] tracking-tight transition-all duration-200 ${
                isActive ? "font-bold text-[#F6007B]" : "font-semibold text-zinc-500"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
