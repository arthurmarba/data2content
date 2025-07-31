// src/app/admin/components/AdminAuthGuard.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import type { UserRole } from '@/types/enums';

// Suposição: Seu objeto de usuário na sessão tem uma propriedade 'role'
// ou uma propriedade booleana como 'isAdmin'.
// Ajuste esta interface conforme a estrutura real do seu objeto User na sessão.
interface AdminUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: UserRole; // Exemplo: 'admin', 'user'
  isAdmin?: boolean; // Alternativa: true/false
}

interface ExtendedSession {
  user?: AdminUser;
  expires: string; // ISOString
}

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession() as { data: ExtendedSession | null, status: 'loading' | 'authenticated' | 'unauthenticated' };
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') {
      return; // Não faça nada enquanto carrega
    }

    if (status === 'unauthenticated') {
      router.replace('/login?error=SessionRequired&callbackUrl=/admin/creator-dashboard'); // Redireciona para login
      return;
    }

    // ASSUMA que o usuário admin tem session.user.role === 'admin'
    // OU session.user.isAdmin === true.
    // Adapte esta lógica para a sua estrutura de usuário.
    // Se você não tiver um campo 'role' ou 'isAdmin', precisaremos de outra forma de verificar.
    const userIsAdmin = session?.user?.role === 'admin' || session?.user?.isAdmin === true;

    if (!userIsAdmin) {
      // Usuário autenticado mas não é admin
      router.replace('/unauthorized?error=AdminAccessRequired'); // Redireciona para uma página de não autorizado
    }
  }, [status, session, router]);

  // Enquanto carrega ou se o redirecionamento ainda não ocorreu
  if (status === 'loading' || status === 'unauthenticated' || (status === 'authenticated' && !(session?.user?.role === 'admin' || session?.user?.isAdmin === true))) {
    // Pode mostrar um loader global aqui ou retornar null para não piscar conteúdo
    // Para um loader simples:
    return (
      <div className="flex items-center justify-center h-screen bg-brand-light">
        <p className="text-lg text-gray-700">Verificando autorização...</p>
        {/* Ou um spinner/loader mais elaborado */}
      </div>
    );
  }

  // Se autenticado e admin, renderiza o conteúdo protegido
  return <>{children}</>;
}
