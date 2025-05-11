// src/app/components/AuthRedirectHandler.tsx
"use client";

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect } from 'react';

// Componente de Loader simples (reutilize ou crie um similar)
// Se você já tem o FullPageLoader em outro lugar, importe-o.
// Exemplo: import FullPageLoader from '@/app/components/auth/FullPageLoader';
const FullPageLoader: React.FC<{ message?: string }> = ({ message = "A carregar..." }) => (
  <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-pink mb-4"></div>
    <p className="text-gray-600">{message}</p>
  </div>
);


const AuthRedirectHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Adicione logs para depuração
    console.log(`[AuthRedirectHandler] Status: ${status}, Pathname: ${pathname}, Session User ID: ${session?.user?.id}, isNewUser: ${session?.user?.isNewUserForOnboarding}`);

    if (status === 'loading') {
      console.log("[AuthRedirectHandler] useEffect - Sessão ainda a carregar. Nenhuma ação.");
      return; // Não faz nada enquanto a sessão está carregando
    }

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth/'); // Inclui /auth/error, /auth/complete-signup, etc.

    if (status === 'authenticated' && session?.user) {
      console.log(`[AuthRedirectHandler] useEffect - Utilizador autenticado: ${session.user.id}. Flag isNewUserForOnboarding: ${session.user.isNewUserForOnboarding}`);
      if (session.user.isNewUserForOnboarding === true) {
        if (pathname !== '/auth/complete-signup') {
          console.log("[AuthRedirectHandler] useEffect - Novo utilizador. Redirecionando para /auth/complete-signup.");
          router.replace('/auth/complete-signup');
        } else {
          console.log("[AuthRedirectHandler] useEffect - Novo utilizador. Já está em /auth/complete-signup.");
        }
      } else { // Usuário existente ou onboarding já completo (isNewUserForOnboarding é false ou undefined)
        if (pathname === '/auth/complete-signup' || pathname === '/login') {
          // Se estiver em uma página de onboarding/login mas não precisa estar lá
          console.log("[AuthRedirectHandler] useEffect - Utilizador existente em página de auth desnecessária. Redirecionando para /dashboard.");
          router.replace('/dashboard');
        } else if (!isAuthPage && pathname !== '/dashboard') {
           // Se for um usuário existente, não estiver em uma página de autenticação e não estiver no dashboard,
           // poderia ser redirecionado para o dashboard. Ajuste conforme necessário para outras rotas válidas.
           console.log(`[AuthRedirectHandler] useEffect - Utilizador existente. Pathname atual: ${pathname}. Considerar redirecionar para /dashboard se não for uma rota protegida válida.`);
           // Exemplo: router.replace('/dashboard'); // Descomente e ajuste se este comportamento for desejado.
        } else {
            console.log(`[AuthRedirectHandler] useEffect - Utilizador existente. Nenhuma ação de redirecionamento necessária a partir de ${pathname}.`);
        }
      }
    } else if (status === 'unauthenticated') {
      // Se não estiver autenticado e não estiver já numa página de autenticação (como /login ou /auth/alguma-coisa)
      if (!isAuthPage) {
        console.warn("[AuthRedirectHandler] useEffect - Utilizador não autenticado e não em página de auth. Redirecionando para /login.");
        router.replace('/login');
      } else {
         console.log("[AuthRedirectHandler] useEffect - Utilizador não autenticado. Já em página de auth.");
      }
    }
  }, [status, session, router, pathname]);

  // Para evitar piscar de tela/conteúdo enquanto o redirecionamento ocorre:
  if (status === 'loading') {
    return <FullPageLoader message="A verificar autenticação..." />;
  }

  // Se autenticado, é novo usuário, mas ainda não está na página de signup (redirecionamento pendente)
  if (status === 'authenticated' && session?.user?.isNewUserForOnboarding === true && pathname !== '/auth/complete-signup') {
    // Mostra loader enquanto o useEffect redireciona
    return <FullPageLoader message="A preparar o seu primeiro acesso..." />;
  }

  // Se autenticado, não é novo usuário, mas está "preso" em uma página de auth (que não seja de erro)
  // (redirecionamento para dashboard pendente)
  if (status === 'authenticated' && 
      session?.user?.isNewUserForOnboarding === false && 
      (pathname === '/auth/complete-signup' || pathname === '/login')) {
    // Mostra loader enquanto o useEffect redireciona
    return <FullPageLoader message="A redirecionar para o seu painel..." />;
  }
  
  // Se não autenticado e tentando acessar página protegida (redirecionamento para login pendente)
  // O useEffect já trata isso, mas um loader aqui pode ser útil se houver um delay
  if (status === 'unauthenticated' && !(pathname.startsWith('/login') || pathname.startsWith('/auth/'))) {
    return <FullPageLoader message="A redirecionar para o login..." />;
  }


  return <>{children}</>; // Renderiza o conteúdo da página se nenhum redirecionamento/loader for necessário
};

export default AuthRedirectHandler;