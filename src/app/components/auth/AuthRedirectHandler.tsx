// src/app/components/auth/AuthRedirectHandler.tsx
// Versão: v2.1 - AJUSTADO: Considera páginas de termos e política como públicas.
"use client";

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect } from 'react';
import FullPageLoader from '@/app/components/auth/FullPageLoader'; 

const AuthRedirectHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log(`[AuthRedirectHandler v2.1] Status: ${status}, Pathname: ${pathname}, UserID: ${session?.user?.id}, isNewUser: ${session?.user?.isNewUserForOnboarding}`);

    if (status === 'loading') {
      console.log("[AuthRedirectHandler v2.1] useEffect - Sessão a carregar. Nenhuma ação.");
      return;
    }

    const isStrictlyAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth/');
    const isPublicRootPage = pathname === '/';
    // <<< NOVA LINHA: Define suas páginas de documentos legais como públicas >>>
    const isLegalDocPage = pathname === '/termos-e-condicoes' || pathname === '/politica-de-privacidade' || pathname === '/termos-uso'; // Adicionei /termos-uso com base no seu footer

    if (status === 'authenticated' && session?.user) {
      console.log(`[AuthRedirectHandler v2.1] Autenticado: ${session.user.id}. isNewUser: ${session.user.isNewUserForOnboarding}`);
      if (session.user.isNewUserForOnboarding === true) {
        // Se for novo usuário e não estiver na página de signup OU numa página de documento legal, redireciona para signup
        if (pathname !== '/auth/complete-signup' && !isLegalDocPage) {
          console.log("[AuthRedirectHandler v2.1] Novo usuário. Redirecionando para /auth/complete-signup.");
          router.replace('/auth/complete-signup');
        } else {
          console.log(`[AuthRedirectHandler v2.1] Novo usuário. Em ${pathname}. Nenhuma ação de redirecionamento.`);
        }
      } else { // Usuário existente ou onboarding completo
        if ((pathname === '/auth/complete-signup' || pathname === '/login') && !isLegalDocPage) {
          console.log("[AuthRedirectHandler v2.1] Usuário existente em página de auth desnecessária. Redirecionando para /dashboard.");
          router.replace('/dashboard');
        } else {
            console.log(`[AuthRedirectHandler v2.1] Usuário existente. Nenhuma ação de redirecionamento de ${pathname}.`);
        }
      }
    } else if (status === 'unauthenticated') {
      // Se não autenticado E não numa página de auth E não na raiz E não numa página de documento legal
      if (!isStrictlyAuthPage && !isPublicRootPage && !isLegalDocPage) {
        console.warn("[AuthRedirectHandler v2.1] Não autenticado e não em página pública/auth/legal. Redirecionando para /login.");
        router.replace('/login');
      } else {
         console.log("[AuthRedirectHandler v2.1] Não autenticado. Em página pública/auth/legal. Nenhuma ação de redirecionamento.");
      }
    }
  }, [status, session, router, pathname]);

  // Lógica de apresentação do Loader para transições
  if (status === 'loading') {
    return <FullPageLoader message="A verificar autenticação..." />;
  }

  if (status === 'authenticated' && session?.user?.isNewUserForOnboarding === true) {
    // Se for novo usuário, não está na página de signup e também não está lendo um doc legal, mostra loader
    if (pathname !== '/auth/complete-signup' && !(pathname === '/termos-e-condicoes' || pathname === '/politica-de-privacidade' || pathname === '/termos-uso')) {
      return <FullPageLoader message="A preparar o seu primeiro acesso..." />;
    }
  }
  
  if (status === 'authenticated' && session?.user?.isNewUserForOnboarding === false) {
    if ((pathname === '/auth/complete-signup' || pathname === '/login')) {
      return <FullPageLoader message="A redirecionar para o seu painel..." />;
    }
  } else if (status === 'unauthenticated') {
    if (!(pathname.startsWith('/login') || pathname.startsWith('/auth/') || pathname === '/' || pathname === '/termos-e-condicoes' || pathname === '/politica-de-privacidade' || pathname === '/termos-uso')) {
      return <FullPageLoader message="A redirecionar para o login..." />;
    }
  }

  return <>{children}</>;
};

export default AuthRedirectHandler;