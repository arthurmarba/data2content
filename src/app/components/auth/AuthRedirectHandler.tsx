// src/app/components/auth/AuthRedirectHandler.tsx
// Versão: v2.3 - CORRIGIDO: Preserva parâmetros de URL (ex: ?ref=...) em redirecionamentos.
"use client";

import { useSession } from 'next-auth/react';
// <<< ALTERAÇÃO 1: Importar o useSearchParams >>>
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import React, { useEffect, useRef } from 'react';
import FullPageLoader from '@/app/components/auth/FullPageLoader'; 

const AuthRedirectHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  // <<< ALTERAÇÃO 2: Capturar os parâmetros da URL atual >>>
  const searchParams = useSearchParams();
  const inviteProcessed = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || inviteProcessed.current) return;
    if (session?.user?.agencyId) return;
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('agencyInviteCode');
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      if (data?.code) {
        inviteProcessed.current = true;
        fetch('/api/agency/accept-invite', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ inviteCode: data.code }),
        })
          .then((res) => {
            if (res.ok) update();
          })
          .catch((err) => console.error('[AuthRedirectHandler] failed to accept invite', err));
      }
    } catch {
      /* ignore */
    }
  }, [status, session, update]);

  useEffect(() => {
    console.log(`[AuthRedirectHandler v2.3] Status: ${status}, Pathname: ${pathname}, UserID: ${session?.user?.id}, isNewUser: ${session?.user?.isNewUserForOnboarding}`);

    if (status === 'loading') {
      console.log("[AuthRedirectHandler v2.3] useEffect - Sessão a carregar. Nenhuma ação.");
      return;
    }

    const isStrictlyAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth/');
    const isPublicRootPage = pathname === '/';
    const isLegalDocPage = pathname === '/termos-e-condicoes' || pathname === '/politica-de-privacidade' || pathname === '/termos-uso';
    const isMediaKitPage = pathname.startsWith('/mediakit');
    console.log(`[AuthRedirectHandler v2.3] Page checks: isStrictlyAuthPage=${isStrictlyAuthPage}, isMediaKitPage=${isMediaKitPage}`);


    if (status === 'authenticated' && session?.user) {
      console.log(`[AuthRedirectHandler v2.3] Autenticado: ${session.user.id}. isNewUser: ${session.user.isNewUserForOnboarding}`);
      if (session.user.isNewUserForOnboarding === true) {
        if (pathname !== '/auth/complete-signup' && !isLegalDocPage) {
          console.log("[AuthRedirectHandler v2.3] Novo usuário. Redirecionando para /auth/complete-signup.");
          router.replace('/auth/complete-signup');
        } else {
          console.log(`[AuthRedirectHandler v2.3] Novo usuário. Em ${pathname}. Nenhuma ação de redirecionamento.`);
        }
      } else { 
        if ((pathname === '/auth/complete-signup' || pathname === '/login' || isPublicRootPage) && !isLegalDocPage) {
          console.log("[AuthRedirectHandler v2.3] Usuário existente em página de auth/raiz. Redirecionando para /dashboard.");
          
          // <<< ALTERAÇÃO 3: Construir a URL de destino com os parâmetros >>>
          const params = searchParams.toString();
          const destination = params ? `/dashboard?${params}` : '/dashboard';
          router.replace(destination);

        } else {
            console.log(`[AuthRedirectHandler v2.3] Usuário existente. Nenhuma ação de redirecionamento de ${pathname}.`);
        }
      }
    } else if (status === 'unauthenticated') {
      if (!isStrictlyAuthPage && !isPublicRootPage && !isLegalDocPage && !isMediaKitPage) {
        console.warn("[AuthRedirectHandler v2.3] Não autenticado e não em página pública. Redirecionando para /login.");
        router.replace('/login');
      } else {
         console.log("[AuthRedirectHandler v2.3] Não autenticado. Em página pública. Nenhuma ação de redirecionamento.");
      }
    }
  // Adicionamos searchParams às dependências do useEffect
  }, [status, session, router, pathname, searchParams]);

  // Lógica de apresentação do Loader para transições (sem alterações)
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
    if (!(pathname.startsWith('/login') || pathname.startsWith('/auth/') || pathname === '/' || pathname.startsWith('/mediakit') || pathname === '/termos-e-condicoes' || pathname === '/politica-de-privacidade' || pathname === '/termos-uso')) {
      return <FullPageLoader message="A redirecionar para o login..." />;
    }
  }

  return <>{children}</>;
};

export default AuthRedirectHandler;