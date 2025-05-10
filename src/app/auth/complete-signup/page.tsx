// Caminho do arquivo: src/app/auth/complete-signup/page.tsx
// Versão: v1.1.1 (Corrige Condição de Safeguard)
// - CORRIGIDO: Condição redundante em if (!session?.user && status !== "loading")
// - Mantém uso de session.user.isNewUserForOnboarding.

"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import TermsAcceptanceStep from '@/app/components/auth/TermsAcceptanceStep'; // Certifique-se que o caminho está correto
// import { logger } from '@/app/lib/logger'; // Descomente se tiver um logger configurado para o frontend

// Componente de Loader simples (pode ser substituído pelo seu SkeletonLoader ou similar)
const FullPageLoader: React.FC<{ message?: string }> = ({ message = "A carregar a sua sessão..." }) => (
  <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-pink mb-4"></div>
    <p className="text-gray-600">{message}</p>
  </div>
);

export default function CompleteSignupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [userNeedsToShowTermsStep, setUserNeedsToShowTermsStep] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  useEffect(() => {
    // console.log("[CompleteSignupPage] useEffect disparado. Status da Sessão:", status); 

    if (status === "loading") {
      setIsLoadingPage(true); 
      return; 
    }

    if (status === "unauthenticated") {
      console.warn("[CompleteSignupPage] Utilizador não autenticado, redirecionando para login.");
      router.replace('/login'); 
      setIsLoadingPage(false); // Define isLoadingPage como false após o redirecionamento
      return;
    }

    if (status === "authenticated" && session?.user) {
      console.log(`[CompleteSignupPage] Utilizador ${session.user.id} autenticado. Flag 'isNewUserForOnboarding':`, session.user.isNewUserForOnboarding);
      
      if (session.user.isNewUserForOnboarding === true) {
        console.log(`[CompleteSignupPage] 'isNewUserForOnboarding' é true para ${session.user.id}. Exibindo etapa de aceite de termos.`);
        setUserNeedsToShowTermsStep(true);
      } else {
        console.log(`[CompleteSignupPage] 'isNewUserForOnboarding' é false ou ausente para ${session.user.id}. Redirecionando para dashboard.`);
        router.replace('/dashboard');
      }
      setIsLoadingPage(false);
    } else if (status === "authenticated" && !session?.user) {
        console.error("[CompleteSignupPage] Autenticado mas sem dados de utilizador na sessão. Redirecionando para login.");
        router.replace('/login');
        setIsLoadingPage(false);
    }
    // Se o status não for nenhum dos acima (o que não deve acontecer), 
    // isLoadingPage pode precisar ser definido como false em algum ponto para evitar loop de loader.
    // No entanto, os casos acima devem cobrir todos os estados de `status`.
  }, [status, session, router]);

  const handleTermsAcceptedAndContinue = async () => {
    console.log(`[CompleteSignupPage] Termos aceites pelo utilizador ${session?.user?.id}. Redirecionando para dashboard.`);
    router.push('/dashboard');
  };

  if (isLoadingPage) { // Modificado para apenas isLoadingPage, pois status === "loading" já é coberto
    return <FullPageLoader message="A verificar o seu estado..." />;
  }

  // Se, após o carregamento, não houver sessão ou utilizador, e não estamos mostrando os termos, redireciona.
  // O useEffect já deve ter tratado a maioria dos redirecionamentos. Esta é uma salvaguarda.
  // <<< CORREÇÃO APLICADA AQUI >>>
  if (!session?.user && !userNeedsToShowTermsStep) { 
    console.warn("[CompleteSignupPage] Sem sessão/utilizador após verificação inicial e não na etapa de termos, redirecionando para login.");
    if (typeof window !== "undefined") router.replace('/login');
    return <FullPageLoader message="A redirecionar para o login..." />;
  }
  // <<< FIM DA CORREÇÃO >>>

  if (userNeedsToShowTermsStep && session?.user) {
    return (
      <TermsAcceptanceStep
        userName={session.user.name}
        onAcceptAndContinue={handleTermsAcceptedAndContinue}
      />
    );
  }

  // Fallback final: Se não está a carregar, não precisa mostrar os termos, e tem sessão/utilizador
  // mas ainda não foi redirecionado pelo useEffect (o que seria estranho), redireciona para o dashboard.
  console.warn("[CompleteSignupPage] Estado inesperado no final da renderização, tentando redirecionar para dashboard como fallback.");
  if (typeof window !== "undefined" && status === "authenticated") {
      router.replace('/dashboard');
  }
  return <FullPageLoader message="A finalizar configuração..." />;
}
