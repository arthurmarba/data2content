// Caminho do arquivo: src/app/auth/complete-signup/page.tsx
// Versão: v1.1.2 (Adiciona Logs de Debug Detalhados)
// - Adicionados console.logs para debugging do fluxo de onboarding.

"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import TermsAcceptanceStep from '@/app/components/auth/TermsAcceptanceStep'; // Certifique-se que o caminho está correto

// Componente de Loader simples
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

  console.log("[CompleteSignupPage] Componente renderizado. Status inicial da sessão:", status, "Session object:", session);

  useEffect(() => {
    console.log("[CompleteSignupPage] useEffect disparado. Status da Sessão:", status, "Session User:", session?.user?.id, "isNewUser:", session?.user?.isNewUserForOnboarding);

    if (status === "loading") {
      console.log("[CompleteSignupPage] useEffect - Sessão a carregar, definindo isLoadingPage = true.");
      setIsLoadingPage(true); 
      return; 
    }

    if (status === "unauthenticated") {
      console.warn("[CompleteSignupPage] useEffect - Utilizador não autenticado, redirecionando para /login.");
      router.replace('/login'); 
      setIsLoadingPage(false);
      return;
    }

    if (status === "authenticated" && session?.user) {
      console.log(`[CompleteSignupPage] useEffect - Utilizador ${session.user.id} autenticado. Verificando 'isNewUserForOnboarding'... Flag: ${session.user.isNewUserForOnboarding}`);
      
      if (session.user.isNewUserForOnboarding === true) {
        console.log(`[CompleteSignupPage] useEffect - 'isNewUserForOnboarding' é TRUE. Definindo userNeedsToShowTermsStep = true.`);
        setUserNeedsToShowTermsStep(true);
      } else {
        console.log(`[CompleteSignupPage] useEffect - 'isNewUserForOnboarding' é FALSE ou indefinido. Redirecionando para /dashboard.`);
        router.replace('/dashboard');
      }
      setIsLoadingPage(false);
    } else if (status === "authenticated" && !session?.user) {
        console.error("[CompleteSignupPage] useEffect - Autenticado mas sem dados de utilizador na sessão. Redirecionando para /login.");
        router.replace('/login');
        setIsLoadingPage(false);
    } else {
        // Este caso não deveria ser atingido se status for 'loading', 'unauthenticated', ou 'authenticated' com session.user
        console.warn(`[CompleteSignupPage] useEffect - Estado de status inesperado: ${status}. Definindo isLoadingPage = false.`);
        setIsLoadingPage(false);
    }
  }, [status, session, router]);

  const handleTermsAcceptedAndContinue = async () => {
    console.log(`[CompleteSignupPage] handleTermsAcceptedAndContinue - Termos aceites pelo utilizador ${session?.user?.id}. Redirecionando para dashboard.`);
    router.push('/dashboard');
  };

  console.log(`[CompleteSignupPage] Antes da renderização condicional: isLoadingPage=${isLoadingPage}, userNeedsToShowTermsStep=${userNeedsToShowTermsStep}, sessionUserExists=${!!session?.user}`);

  if (isLoadingPage) {
    console.log("[CompleteSignupPage] Renderizando FullPageLoader (isLoadingPage=true).");
    return <FullPageLoader message="A verificar o seu estado..." />;
  }

  if (!session?.user && !userNeedsToShowTermsStep) { 
    console.warn("[CompleteSignupPage] Renderizando FullPageLoader (sem sessão/utilizador e não na etapa de termos), redirecionando para login.");
    if (typeof window !== "undefined") router.replace('/login');
    return <FullPageLoader message="A redirecionar para o login..." />;
  }

  if (userNeedsToShowTermsStep && session?.user) {
    console.log("[CompleteSignupPage] Renderizando TermsAcceptanceStep.");
    return (
      <TermsAcceptanceStep
        userName={session.user.name}
        onAcceptAndContinue={handleTermsAcceptedAndContinue}
      />
    );
  }

  console.warn("[CompleteSignupPage] Renderizando FullPageLoader (fallback final), tentando redirecionar para dashboard.");
  if (typeof window !== "undefined" && status === "authenticated") {
      router.replace('/dashboard');
  }
  return <FullPageLoader message="A finalizar configuração..." />;
}
