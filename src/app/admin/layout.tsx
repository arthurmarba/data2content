// src/app/admin/layout.tsx
import React from 'react';
import Sidebar from './components/Sidebar';
import AdminAuthGuard from './components/AdminAuthGuard';
import { Toaster } from 'react-hot-toast'; // Nova importação

// Definição do SidebarPlaceholder PODE SER REMOVIDA se não for mais usada em nenhum outro lugar.

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthGuard> {/* Envolve o conteúdo com o AuthGuard */}
      <Toaster
        position="top-right" // Posição comum para toasts
        toastOptions={{
          duration: 5000, // Duração padrão de 5 segundos
          // Estilos podem ser adicionados aqui se necessário, ou via CSS global
          // Exemplo de estilos para toasts de sucesso e erro:
          // success: {
          //   style: {
          //     background: 'green',
          //     color: 'white',
          //   },
          // },
          // error: {
          //   style: {
          //     background: 'red',
          //     color: 'white',
          //   },
          // },
        }}
      />
      <div className="flex h-screen bg-brand-light">
        <Sidebar /> {/* Substituição feita aqui */}

        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          {/*
            Aqui pode entrar um Topbar/Header específico do admin no futuro, se necessário.
            Por exemplo, para exibir o título da página atual ou controles do usuário admin.
          */}
          {children}
        </main>
      </div>
    </AdminAuthGuard>
  );
}
