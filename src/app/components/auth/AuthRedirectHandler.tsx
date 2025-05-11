// src/app/components/auth/AuthRedirectHandler.tsx
// Versão: v2 - AJUSTADO: Considera a HomePage (pathname === '/') como pública para não autenticados.
"use client";

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect } from 'react';
// Certifique-se que o caminho para FullPageLoader está correto
// (deve ser o que usamos em login/page.tsx, por exemplo)
import FullPageLoader from '@/app/components/auth/FullPageLoader'; 

const AuthRedirectHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log(`[AuthRedirectHandler v2] Status: ${status}, Pathname: ${pathname}, UserID: ${session?.user?.id}, isNewUser: ${session?.user?.isNewUserForOnboarding}`);

    if (status === 'loading') {
      console.log("[AuthRedirectHandler v2] useEffect - Sessão a carregar. Nenhuma ação.");
      return; // Não faz nada enquanto a sessão está carregando
    }

    const isStrictlyAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth/'); // Ex: /login, /auth/complete-signup, /auth/error
    const isPublicRootPage = pathname === '/'; // A HomePage é considerada pública

    if (status === 'authenticated' && session?.user) {
      console.log(`[AuthRedirectHandler v2] Autenticado: ${session.user.id}. isNewUser: ${session.user.isNewUserForOnboarding}`);
      if (session.user.isNewUserForOnboarding === true) {
        if (pathname !== '/auth/complete-signup') {
          console.log("[AuthRedirectHandler v2] Novo usuário. Redirecionando para /auth/complete-signup.");
          router.replace('/auth/complete-signup');
        } else {
          console.log("[AuthRedirectHandler v2] Novo usuário. Já em /auth/complete-signup.");
        }
      } else { // Usuário existente ou onboarding completo
        if (pathname === '/auth/complete-signup' || pathname === '/login') {
          // Se estiver em uma página de onboarding/login mas não precisa estar lá
          console.log("[AuthRedirectHandler v2] Usuário existente em página de auth desnecessária. Redirecionando para /dashboard.");
          router.replace('/dashboard');
        } else {
            console.log(`[AuthRedirectHandler v2] Usuário existente. Nenhuma ação de redirecionamento de ${pathname}.`);
        }
      }
    } else if (status === 'unauthenticated') {
      // Se não estiver autenticado E não estiver numa página de autenticação E não estiver na HomePage pública
      if (!isStrictlyAuthPage && !isPublicRootPage) {
        console.warn("[AuthRedirectHandler v2] Não autenticado e não em página pública/auth. Redirecionando para /login.");
        router.replace('/login');
      } else {
         console.log("[AuthRedirectHandler v2] Não autenticado. Em página pública/auth. Nenhuma ação de redirecionamento.");
      }
    }
  }, [status, session, router, pathname]);

  // Lógica de apresentação do Loader para transições
  if (status === 'loading') {
    return <FullPageLoader message="A verificar autenticação..." />;
  }

  if (status === 'authenticated') {
    if (session?.user?.isNewUserForOnboarding === true && pathname !== '/auth/complete-signup') {
      // Mostra loader enquanto o useEffect redireciona para o onboarding
      return <FullPageLoader message="A preparar o seu primeiro acesso..." />;
    }
    if (session?.user?.isNewUserForOnboarding === false && (pathname === '/auth/complete-signup' || pathname === '/login')) {
      // Mostra loader enquanto o useEffect redireciona para o dashboard
      return <FullPageLoader message="A redirecionar para o seu painel..." />;
    }
  } else if (status === 'unauthenticated') {
    // Se não autenticado e não estiver numa página de login/auth OU na homepage, mostra loader enquanto redireciona
    if (!(pathname.startsWith('/login') || pathname.startsWith('/auth/') || pathname === '/')) {
      return <FullPageLoader message="A redirecionar para o login..." />;
    }
  }

  return <>{children}</>; // Renderiza o conteúdo da página se nenhum redirecionamento/loader for necessário
};

export default AuthRedirectHandler;