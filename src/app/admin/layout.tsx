'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import AdminAuthGuard from './components/AdminAuthGuard';
import { SWRConfig } from 'swr';
import {
  Bars3Icon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

// --- Itens do Menu ---
interface MenuItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
}

const menuItems: MenuItem[] = [
  {
    label: 'Painel Criadores',
    href: '/admin/creator-dashboard',
    icon: ChartBarIcon,
    children: [
      { label: 'Resumo', href: '/admin/creator-dashboard#platform-summary' },
      { label: 'Rankings', href: '/admin/creator-dashboard#creator-rankings' },
      { label: 'Top Movers', href: '/admin/creator-dashboard#top-movers' },
      { label: 'Análise de Conteúdo', href: '/admin/creator-dashboard#platform-content-analysis' },
      { label: 'Visão Geral', href: '/admin/creator-dashboard#platform-overview' },
      { label: 'Posts', href: '/admin/creator-dashboard#global-posts-explorer' },
    ],
  },
  {
    label: 'Revisão de Conteúdo',
    href: '/admin/reviewed-posts',
    icon: PencilSquareIcon,
  },
  {
    label: 'Insights Criadores',
    href: '/admin/creators-insights',
    icon: ChartBarIcon,
  },
  { label: 'Afiliados', href: '/admin/affiliates', icon: UserGroupIcon },
  { label: 'Parceiros', href: '/admin/agencies', icon: UserGroupIcon },
  { label: 'Resgates', href: '/admin/redemptions', icon: CurrencyDollarIcon },
  { label: 'Billing Debug', href: '/admin/billing-debug', icon: CurrencyDollarIcon },
  {
    label: 'Chat Telemetria',
    href: '/admin/chat-telemetry',
    icon: ChatBubbleBottomCenterTextIcon,
    children: [
      { label: 'Overview', href: '/admin/chat-telemetry' },
      { label: 'Sessions', href: '/admin/chat-telemetry/sessions' },
      { label: 'Quality', href: '/admin/chat-telemetry/quality' },
      { label: 'Review Queue', href: '/admin/chat-telemetry/review-queue' },
    ],
  },
];

// --- Componente do Layout Admin ---
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  // Componente interno para o conteúdo da sidebar, evitando repetição de código
  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex flex-col h-full overflow-x-hidden">
      <div className={`p-4 mb-4 border-b border-gray-200 flex items-center justify-between ${collapsed ? 'px-2' : ''}`}>
        {!collapsed && (
          <div>
            <h2 className="text-xl font-bold text-brand-dark">Admin</h2>
            <p className="text-sm text-gray-600">Dashboard</p>
          </div>
        )}
        {/* Botão de recolher apenas no desktop */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden md:flex p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors ${collapsed ? 'mx-auto' : ''}`}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          {collapsed ? (
            <ChevronRightIcon className="w-5 h-5" />
          ) : (
            <ChevronLeftIcon className="w-5 h-5" />
          )}
        </button>
      </div>
      <nav className={`flex-1 space-y-2 ${collapsed ? 'px-2' : 'px-4'}`}>
        {menuItems.map(item => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg
                  transition-all duration-150
                  ${isActive
                    ? 'bg-indigo-100 text-indigo-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
                  ${collapsed ? 'justify-center px-2' : ''}
                  `}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
              {isActive && item.children && !collapsed && ( // Renderiza filhos apenas se o item pai estiver ativo e não estiver recolhido
                <ul className="mt-1 ml-8 space-y-1 text-sm">
                  {item.children.map(child => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        onClick={() => setIsSidebarOpen(false)}
                        className="block px-2 py-1 text-gray-600 hover:text-indigo-700 truncate"
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <AdminAuthGuard>
      <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 60 * 1000 }}>
        <Toaster
          position="top-right"
          toastOptions={{ duration: 5000 }}
        />
        <div className="flex min-h-screen bg-gray-50">
          {/* Sidebar para Desktop */}
          <aside
            className={`hidden md:flex md:flex-col bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'
              }`}
          >
            <SidebarContent collapsed={isCollapsed} />
          </aside>

          {/* Sidebar para Mobile (Overlay) */}
          {isSidebarOpen && (
            <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
              <div
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60"
                aria-hidden="true"
              ></div>
              <aside className="relative w-64 bg-white border-r border-gray-200 flex flex-col">
                <SidebarContent />
              </aside>
            </div>
          )}

          {/* Conteúdo Principal */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Topbar com botão hamburger (apenas em mobile) */}
            <header className="flex items-center justify-between bg-white p-4 border-b border-gray-200 md:hidden sticky top-0 z-30">
              <button
                onClick={() => setIsSidebarOpen(prev => !prev)}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-200"
                aria-label="Abrir menu"
              >
                <Bars3Icon className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-bold text-gray-800">Admin</h1>
              <div className="w-8 h-8" /> {/* Espaço para alinhar o título ao centro */}
            </header>

            {/* Conteúdo da Página */}
            <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </SWRConfig>
    </AdminAuthGuard>
  );
}
