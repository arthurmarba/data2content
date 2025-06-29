// src/app/components/auth/AuthRedirectHandler.tsx
// Versão: v2.2 - AJUSTADO: Rota /mediakit liberada para acesso público.
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
    console.log(`[AuthRedirectHandler v2.2] Status: ${status}, Pathname: ${pathname}, UserID: ${session?.user?.id}, isNewUser: ${session?.user?.isNewUserForOnboarding}`);

    if (status === 'loading') {
      console.log("[AuthRedirectHandler v2.2] useEffect - Sessão a carregar. Nenhuma ação.");
      return;
    }

    const isStrictlyAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth/');
    const isPublicRootPage = pathname === '/';
    const isLegalDocPage = pathname === '/termos-e-condicoes' || pathname === '/politica-de-privacidade' || pathname === '/termos-uso';
    // <<< ALTERAÇÃO 1: Definindo a rota do Media Kit como pública >>>
    const isMediaKitPage = pathname.startsWith('/mediakit');
    console.log(`[AuthRedirectHandler v2.2] Page checks: isStrictlyAuthPage=${isStrictlyAuthPage}, isMediaKitPage=${isMediaKitPage}`);


    if (status === 'authenticated' && session?.user) {
      console.log(`[AuthRedirectHandler v2.2] Autenticado: ${session.user.id}. isNewUser: ${session.user.isNewUserForOnboarding}`);
      if (session.user.isNewUserForOnboarding === true) {
        if (pathname !== '/auth/complete-signup' && !isLegalDocPage) {
          console.log("[AuthRedirectHandler v2.2] Novo usuário. Redirecionando para /auth/complete-signup.");
          router.replace('/auth/complete-signup');
        } else {
          console.log(`[AuthRedirectHandler v2.2] Novo usuário. Em ${pathname}. Nenhuma ação de redirecionamento.`);
        }
      } else { 
        if ((pathname === '/auth/complete-signup' || pathname === '/login') && !isLegalDocPage) {
          console.log("[AuthRedirectHandler v2.2] Usuário existente em página de auth desnecessária. Redirecionando para /dashboard.");
          router.replace('/dashboard');
        } else {
            console.log(`[AuthRedirectHandler v2.2] Usuário existente. Nenhuma ação de redirecionamento de ${pathname}.`);
        }
      }
    } else if (status === 'unauthenticated') {
      // <<< ALTERAÇÃO 2: Adicionada a verificação !isMediaKitPage para impedir o redirecionamento >>>
      // Se não autenticado E não numa página de auth E não na raiz E não numa página legal E NÃO num Media Kit
      if (!isStrictlyAuthPage && !isPublicRootPage && !isLegalDocPage && !isMediaKitPage) {
        console.warn("[AuthRedirectHandler v2.2] Não autenticado e não em página pública. Redirecionando para /login.");
        router.replace('/login');
      } else {
         console.log("[AuthRedirectHandler v2.2] Não autenticado. Em página pública. Nenhuma ação de redirecionamento.");
      }
    }
  }, [status, session, router, pathname]);

  // Lógica de apresentação do Loader para transições
  if (status === 'loading') {
    return <FullPageLoader message="A verificar autenticação..." />;
  }

  if (status === 'authenticated' && session?.user?.isNewUserForOnboarding === true) {
    if (pathname !== '/auth/complete-signup' && !(pathname === '/termos-e-condicoes' || pathname === '/politica-de-privacidade' || pathname === '/termos-uso')) {
      return <FullPageLoader message="A preparar o seu primeiro acesso..." />;
    }
  }
  
  if (status === 'authenticated' && session?.user?.isNewUserForOnboarding === false) {
    if ((pathname === '/auth/complete-signup' || pathname === '/login')) {
      return <FullPageLoader message="A redirecionar para o seu painel..." />;
    }
  } else if (status === 'unauthenticated') {
    // <<< ALTERAÇÃO 3: Adicionada a exceção para a rota /mediakit na lógica do loader >>>
    // Esta condição agora impede que o loader de redirecionamento apareça na página do Media Kit.
    if (!(pathname.startsWith('/login') || pathname.startsWith('/auth/') || pathname === '/' || pathname.startsWith('/mediakit') || pathname === '/termos-e-condicoes' || pathname === '/politica-de-privacidade' || pathname === '/termos-uso')) {
      return <FullPageLoader message="A redirecionar para o login..." />;
    }
  }

  return <>{children}</>;
};

export default AuthRedirectHandler;