"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaComments, FaFileContract, FaWhatsapp, FaCreditCard, FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";

interface SidebarNavProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
};

export default function SidebarNav({ isCollapsed, onToggle }: SidebarNavProps) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/dashboard/chat", label: "Conversar com IA", icon: <FaComments /> },
    { href: "/dashboard/media-kit", label: "Mídia Kit", icon: <FaFileContract /> },
    { href: "/dashboard/whatsapp", label: "WhatsApp PRO", icon: <FaWhatsapp /> },
    { href: "/dashboard/settings", label: "Gerir Assinatura", icon: <FaCreditCard /> },
  ];

  return (
    <aside
      className={`
        h-[calc(100vh-64px)] sticky top-16
        border-r border-gray-200 bg-white
        ${isCollapsed ? "w-16" : "w-64"}
        transition-all duration-200
        flex flex-col
      `}
      aria-label="Navegação do dashboard"
    >
      <div className="p-2 flex items-center justify-end">
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
          aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
          title={isCollapsed ? "Expandir" : "Recolher"}
        >
          {isCollapsed ? <FaAngleDoubleRight className="w-4 h-4" /> : <FaAngleDoubleLeft className="w-4 h-4" />}
          {!isCollapsed && <span>Recolher</span>}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || (!item.exact && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
                    ${active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}
                  `}
                >
                  <span className={`text-base ${active ? "text-white" : "text-gray-600 group-hover:text-gray-900"}`}>{item.icon}</span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-2 text-[11px] text-gray-400 select-none">
        {!isCollapsed && <span className="px-3">v1.0</span>}
      </div>
    </aside>
  );
}
