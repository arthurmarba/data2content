"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Home,
  UsersRound,
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
    icon: UsersRound,
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
    <nav data-mobile-bottom-nav="true" className="fixed bottom-0 left-0 right-0 z-[200] flex h-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] items-start justify-around border-t border-zinc-100 bg-white px-1.5 pb-[env(safe-area-inset-bottom,0px)] pt-3 shadow-[0_-12px_45px_rgba(0,0,0,0.08)] lg:hidden">
      {navItems.map((item) => {
        const isActive = item.match(pathname || "");
        const Icon = item.icon;

        return (
          <Link
            key={item.key}
            href={item.href}
            className={`relative flex min-h-[3.25rem] min-w-[64px] flex-1 flex-col items-center justify-start gap-1.5 rounded-xl px-0.5 pt-0.5 transition-colors ${
              isActive ? "text-[#F6007B]" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <div
              className={`flex h-7 w-7 items-center justify-center transition-transform duration-200 ${
                isActive ? "-translate-y-px scale-[1.08]" : "translate-y-0 scale-100"
              }`}
            >
              {item.isAvatar ? (
                <div
                  className={`relative rounded-full p-0.5 transition-all duration-200 ${
                    isActive 
                      ? "ring-2 ring-[#F6007B] ring-offset-2 ring-offset-white" 
                      : "ring-1 ring-zinc-300"
                  }`}
                >
                  <UserAvatar 
                    src={user?.image} 
                    name={user?.name || "Usuário"} 
                    size={23} 
                    className="h-[23px] w-[23px]" 
                  />
                </div>
              ) : (
                <Icon 
                  strokeWidth={isActive ? 2.35 : 1.9} 
                  className={`h-[23px] w-[23px] transition-all duration-200 ${isActive ? "drop-shadow-[0_0_10px_rgba(246,0,123,0.25)]" : ""}`} 
                />
              )}
            </div>

            <span 
              className={`max-w-full truncate text-[10px] leading-none transition-all duration-200 ${
                isActive ? "font-bold text-[#F6007B]" : "font-semibold text-zinc-600"
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
