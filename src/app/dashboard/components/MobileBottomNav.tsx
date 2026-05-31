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
  LayoutGrid,
  Activity,
  FileText,
} from "lucide-react";
import { UserAvatar } from "@/app/components/UserAvatar";
import {
  MOBILE_COMMUNITY_ROUTE,
  MOBILE_MEDIA_KIT_ROUTE,
  MOBILE_PROFILE_ROUTE,
} from "../boards/videoUpload/mobileStrategicProfileRoutes";

type MobileBottomNavItem = {
  key: string;
  label: string;
  icon: typeof Home;
  href: string;
  match: (pathname: string) => boolean;
  isAvatar?: boolean;
};

const mobileStrategicProfileNavItems: MobileBottomNavItem[] = [
  {
    key: "diagnostico",
    label: "Diagnóstico",
    icon: Activity,
    href: MOBILE_PROFILE_ROUTE,
    match: (p: string) =>
      p.startsWith(MOBILE_PROFILE_ROUTE) ||
      p.startsWith("/dashboard/boards/mobile-strategic-profile-preview"),
  },
  {
    key: "community",
    label: "Comunidade",
    icon: UsersRound,
    href: MOBILE_COMMUNITY_ROUTE,
    match: (p: string) => p.startsWith(MOBILE_COMMUNITY_ROUTE) || p.startsWith("/dashboard/discover"),
  },
  {
    key: "media-kit",
    label: "Mídia Kit",
    icon: FileText,
    href: MOBILE_MEDIA_KIT_ROUTE,
    match: (p: string) => p.startsWith(MOBILE_MEDIA_KIT_ROUTE) || p.startsWith("/media-kit"),
  },
];

const legacyNavItems: MobileBottomNavItem[] = [
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
  const isMobileStrategicProfileAppEnabled =
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED === "1";
  const navItems = isMobileStrategicProfileAppEnabled
    ? mobileStrategicProfileNavItems
    : legacyNavItems;

  // Ocultar em fluxos guiados ou print
  const isGuidedFlow = pathname === "/dashboard/instagram";
  const isPrintMode = searchParams?.get("print") === "1" || searchParams?.get("print") === "true";
  if (isGuidedFlow || isPrintMode) return null;

  return (
    <nav data-mobile-bottom-nav="true" className="fixed bottom-0 left-0 right-0 z-[200] flex h-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] items-start justify-center border-t border-zinc-100 bg-white px-3 pb-[env(safe-area-inset-bottom,0px)] pt-2.5 shadow-[0_-10px_32px_rgba(15,23,42,0.08)] lg:hidden">
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
                isActive ? "-translate-y-0.5" : "translate-y-0"
              }`}
            >
              {item.isAvatar ? (
                <div
                  className={`relative rounded-full transition-all duration-200 ${
                    isActive 
                      ? "ring-1 ring-[#F6007B] ring-offset-2 ring-offset-white" 
                      : "ring-1 ring-zinc-300"
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
                  strokeWidth={isActive ? 2.25 : 1.9} 
                  className="h-[23px] w-[23px] transition-all duration-200" 
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
