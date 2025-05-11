// src/app/auth/complete-signup/page.tsx
// Versão: v1.2.1 (Adiciona chamada à API de conclusão de onboarding e atualização de sessão)

"use client";

import React, { useEffect, useState } from 'react'; // Adicionado useState
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import TermsAcceptanceStep from '@/app/components/auth/TermsAcceptanceStep';
// Ajuste o caminho do FullPageLoader se necessário.
import FullPageLoader from '@/app/components/auth/FullPageLoader';

export default function CompleteSignupPage() {
  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();

  const [isSubmitting, setIsSubmitting] = useState(false); // Estado para o processo de submissão
  const [submitError, setSubmitError] = useState<string | null>(null); // Estado para erros na submissão

  console.log(`[CompleteSignupPage v1.2.1] Renderizado. Status: ${status}. isNewUser: ${session?.user?.isNewUserForOnboarding}. Submitting: ${isSubmitting}`);

  useEffect(() => {
    if (status === "authenticated") {
      if (!session?.user) {
        console.error("[CompleteSignupPage v1.2.1] Autenticado mas sem 'session.user'. Redirecionando para /login (segurança).");
        router.replace('/login');
      } else if (session.user.isNewUserForOnboarding === false && !isSubmitting) { // Não redirecionar se estiver submetendo
        console.warn("[CompleteSignupPage v1.2.1] 'isNewUserForOnboarding' é FALSE. Redirecionando para /dashboard (segurança).");
        router.replace('/dashboard');
      }
    } else if (status === "unauthenticated") {
      console.warn("[CompleteSignupPage v1.2.1] Não autenticado. Redirecionando para /login (segurança).");
      router.replace('/login');
    }
  }, [status, session, router, isSubmitting]);

  const handleTermsAcceptedAndContinue = async () => {
    console.log(`[CompleteSignupPage v1.2.1] Termos aceites pelo utilizador ${session?.user?.id}. Iniciando submissão.`);
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/user/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Não é necessário enviar body se a API apenas usa a sessão para identificar o usuário
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Falha ao completar o onboarding. Resposta não JSON.' }));
        console.error("[CompleteSignupPage v1.2.1] Falha na API complete-onboarding:", errorData);
        throw new Error(errorData.message || `Erro ${response.status} ao completar o onboarding.`);
      }

      console.log("[CompleteSignupPage v1.2.1] Onboarding completado no backend com sucesso. Atualizando sessão do cliente...");
      
      // Força a atualização da sessão. Os callbacks jwt e session do NextAuth serão chamados.
      // É importante que o callback session leia o estado atualizado do usuário do banco de dados
      // para que 'isNewUserForOnboarding' seja atualizado para false na sessão do cliente.
      await updateSession(); 
      
      console.log("[CompleteSignupPage v1.2.1] Sessão do cliente atualizada. Redirecionando para /dashboard.");
      router.push('/dashboard');

    } catch (error) {
      console.error("[CompleteSignupPage v1.2.1] Erro durante handleTermsAcceptedAndContinue:", error);
      setSubmitError(error instanceof Error ? error.message : 'Ocorreu um erro desconhecido ao processar sua solicitação.');
      setIsSubmitting(false); // Permite nova tentativa ou mostra erro
    }
    // Não definimos setIsSubmitting(false) no bloco try bem-sucedido porque o redirecionamento ocorre.
  };

  if (status === "loading" || isSubmitting) {
    const message = isSubmitting ? "A processar sua aceitação..." : "A verificar o seu estado...";
    console.log(`[CompleteSignupPage v1.2.1] Renderizando FullPageLoader (${message}).`);
    return <FullPageLoader message={message} />;
  }

  if (status === "authenticated" && session?.user?.isNewUserForOnboarding === true) {
    console.log("[CompleteSignupPage v1.2.1] Renderizando TermsAcceptanceStep.");
    return (
      <>
        <TermsAcceptanceStep
          userName={session?.user?.name}
          onAcceptAndContinue={handleTermsAcceptedAndContinue}
          // Você pode querer passar 'isSubmitting' para o TermsAcceptanceStep
          // para desabilitar o botão ou mostrar um indicador de loading nele.
          // Ex: isSubmitting={isSubmitting}
        />
        {submitError && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-red-600 text-white text-center z-50">
            <p>Erro: {submitError}</p>
            <button onClick={() => setSubmitError(null)} className="ml-2 underline">Fechar</button>
          </div>
        )}
      </>
    );
  }

  console.warn(`[CompleteSignupPage v1.2.1] Estado de renderização de fallback. Status: ${status}, isNewUser: ${session?.user?.isNewUserForOnboarding}. Aguardando redirecionamento.`);
  return <FullPageLoader message="A finalizar ou a redirecionar..." />;
}