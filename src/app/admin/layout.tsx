'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import AdminAuthGuard from './components/AdminAuthGuard'; // Mantendo seu componente de guarda de rota
import {
  Bars3Icon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

// --- Itens do Menu ---
const menuItems = [
  { label: 'Painel Criadores', href: '/admin/creator-dashboard', icon: ChartBarIcon },
  { label: 'Afiliados', href: '/admin/affiliates', icon: UserGroupIcon },
  { label: 'Resgates', href: '/admin/redemptions', icon: CurrencyDollarIcon },
];

// --- Componente do Layout Admin ---
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Componente interno para o conteúdo da sidebar, evitando repetição de código
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
        <div className="p-4 mb-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Admin</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Dashboard</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
        {menuItems.map(item => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
            <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)} // Fecha o menu ao clicar em um item no mobile
                className={`
                flex items-center gap-3 px-3 py-2 rounded-lg
                transition-colors duration-150
                ${isActive
                    ? 'bg-indigo-100 text-indigo-700 font-semibold dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'}
                `}
            >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
            </Link>
            );
        })}
        </nav>
    </div>
  );

  return (
    <AdminAuthGuard> {/* ✅ Seu AuthGuard foi mantido */}
      <Toaster
        position="top-right"
        toastOptions={{ duration: 5000 }}
      />
      <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
        {/* Sidebar para Desktop */}
        <aside className="hidden md:flex md:flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
          <SidebarContent />
        </aside>

        {/* Sidebar para Mobile (Overlay) */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
            <div
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60"
                aria-hidden="true"
            ></div>
            <aside className="relative w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* Conteúdo Principal */}
        <div className="flex-1 flex flex-col w-full">
          {/* Topbar com botão hamburger (apenas em mobile) */}
          <header className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 md:hidden sticky top-0 z-30">
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Abrir menu"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">Admin</h1>
            <div className="w-8 h-8" /> {/* Espaço para alinhar o título ao centro */}
          </header>

          {/* Conteúdo da Página */}
          <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
