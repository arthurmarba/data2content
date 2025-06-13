// src/app/admin/components/Sidebar.tsx
'use client'; // Necessário para hooks como usePathname

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartBarIcon,
  UsersIcon,
  UserGroupIcon, // Para Afiliados
  BanknotesIcon, // Para Resgates
  CpuChipIcon,  // Para Inteligência (ou LightBulbIcon)
  HomeIcon,     // Para o Dashboard Admin (Creator Dashboard)
} from '@heroicons/react/24/outline'; // Usando outline para consistência

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/admin/creator-dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/admin/creators-management', label: 'Criadores', icon: UsersIcon }, // Exemplo de rota
  { href: '/admin/affiliates', label: 'Afiliados', icon: UserGroupIcon }, // Exemplo de rota
  { href: '/admin/redemptions', label: 'Resgates', icon: BanknotesIcon }, // Exemplo de rota
  { href: '/admin/intelligence-hub', label: 'Inteligência', icon: CpuChipIcon }, // Exemplo de rota
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col shadow-lg"> {/* Alterado para bg-gray-900 para um tom mais escuro */}
      <div className="h-20 flex items-center justify-center border-b border-gray-700/50">
        {/* Pode adicionar um logo ou título aqui */}
        <Link href="/admin/creator-dashboard" className="text-xl font-bold text-white hover:text-gray-200 transition-colors">
          Admin Panel
        </Link>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin/creator-dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`
                flex items-center px-3 py-2.5 rounded-lg transition-all duration-150 ease-in-out group
                text-sm font-medium
                ${
                  isActive
                    ? 'bg-brand-pink text-white shadow-sm' // Estilo ativo com brand-pink
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }
              `}
            >
              <item.icon className={`w-5 h-5 mr-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-700/50 mt-auto">
        {/* Pode adicionar informações do usuário admin ou um link de logout aqui */}
        <p className="text-xs text-gray-500 text-center">&copy; {new Date().getFullYear()} Data2Content</p>
      </div>
    </aside>
  );
}
