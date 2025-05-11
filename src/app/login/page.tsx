// src/app/login/page.tsx
"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from 'next/navigation'; // Para ler callbackUrl, se necessário

// Opcional: Se você tiver um componente de loader, pode importá-lo
// import FullPageLoader from '@/app/components/auth/FullPageLoader';
// import React, { useState } from 'react';

export default function LoginPage() {
  const searchParams = useSearchParams();
  // O NextAuth geralmente anexa o callbackUrl automaticamente se você foi redirecionado para o login.
  // Usá-lo garante que o usuário volte para onde estava (ou para um destino específico após o onboarding).
  const callbackUrlFromParams = searchParams.get('callbackUrl');

  // const [isLoading, setIsLoading] = useState(false); // Opcional: para feedback de loading

  const handleGoogleSignIn = () => {
    // setIsLoading(true); // Opcional
    // O callbackUrl para /auth/complete-signup é para o fluxo de onboarding de novos usuários.
    // Se um usuário existente logar, o AuthRedirectHandler o levará ao dashboard
    // a partir da página /auth/complete-signup se isNewUserForOnboarding for false.
    signIn("google", {
      callbackUrl: callbackUrlFromParams || "/auth/complete-signup", // Prioriza callback da URL, senão vai para o onboarding
    });
  };

  const handleCredentialsSignIn = () => {
    // setIsLoading(true); // Opcional
    // Para o usuário demo, o callbackUrl pode ser diretamente o dashboard,
    // ou o callback da URL se ele estava tentando acessar uma página específica.
    signIn("credentials", {
      username: "demo",
      password: "demo",
      callbackUrl: callbackUrlFromParams || "/dashboard",
    });
  };

  // if (isLoading) { // Opcional
  //   return <FullPageLoader message="Redirecionando para o login..." />;
  // }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 sm:p-12 rounded-xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          {/* Sugestão: Adicione seu logo aqui */}
          {/* <img src="/logo.png" alt="Data2Content Logo" className="w-32 mx-auto mb-6" /> */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 tracking-tight">
            Bem-vindo(a) de volta!
          </h1>
          <p className="text-gray-600 mt-3 text-base sm:text-lg">
            Acesse sua conta Data2Content para continuar.
          </p>
        </div>

        <div className="space-y-5">
          <button
            onClick={handleGoogleSignIn}
            type="button"
            className="w-full flex items-center justify-center py-3.5 px-4 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150 group"
          >
            <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-gray-500 transition-colors duration-150" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.543 9.75h-1.06c-.11-.79-.3-1.54-.56-2.25H21.5c.28 0 .5.22.5.5s-.22.5-.5.5h-1.581c-.12-.31-.27-.62-.42-.91l1.031.52c.2.1.45.03.58-.16.13-.2.07-.46-.13-.59l-1.23-1.23c.17-.25.33-.51.47-.78h1.27c.28 0 .5-.22.5-.5s-.22-.5-.5-.5H20.2c-.3-.68-.68-1.3-1.12-1.85l.82.82c.2.2.51.2.71 0s.2-.51 0-.71l-.82-.82c.04-.03.08-.06.12-.09.55-.41 1.16-.74 1.8-.97.25-.09.4-.34.31-.59s-.34-.4-.59-.31c-.7.25-1.36.6-1.95 1.04-.1.07-.15.19-.15.3V3.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5V2.41c-.68.1-1.34.3-1.97.58l.52 1.03c.1.2.03.45-.16.58-.2.13-.46.07-.59-.13l-1.23-1.23c.25-.17.51-.33.78-.47h1.27c.28 0 .5-.22.5.5s-.22-.5-.5-.5H9.98c-.12-.31-.27-.62-.42-.91l1.03.52c.2.1.45.03.58-.16.13-.2.07-.46-.13-.59l-1.23-1.23c.17-.25.33-.51-.47.78H8.5c-.28 0-.5.22-.5.5s.22.5.5.5h1.27c.3.68.68 1.3 1.12 1.85l-.82-.82c-.2-.2-.51-.2-.71 0s-.2.51 0 .71l.82.82c-.04.03-.08.06-.12-.09-.55-.41-1.16.74-1.8.97-.25-.09-.4.34-.31-.59s-.34-.4-.59-.31c-.7-.25-1.36-.6-1.95-1.04-.1-.07-.15-.19-.15-.3V14.5c0-.28.22-.5.5-.5s.5.22.5.5v1.09c.68-.1 1.34-.3 1.97-.58l-.52-1.03c-.1-.2-.03-.45.16-.58.2.13.46.07.59.13l1.23 1.23c-.25.17-.51.33-.78.47h1.27c.28 0 .5-.22.5.5s-.22-.5-.5-.5H9.98c-.12-.31-.27-.62-.42-.91l1.03.52c.2.1.45.03.58-.16.13-.2.07-.46-.13-.59l-1.23-1.23c.17-.25.33-.51-.47.78h1.77v-2.25H12c-1.38 0-2.5 1.12-2.5 2.5S10.62 15 12 15h5.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5H12c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5h7.04c.79.11 1.54.3 2.25.56V12.5c0-.28.22-.5.5-.5s.5.22.5.5v1.58c.31-.12.62-.27.91-.42l-1.03.52c-.2.1-.45.03-.58-.16-.13-.2-.07-.46.13-.59l1.23-1.23c.25-.17.51-.33.78-.47h1.27c.28 0 .5-.22.5.5s-.22.5-.5.5h-1.58c-.12-.31-.27-.62-.42-.91l1.03-.52c.2-.1.45-.03.58.16.13.2.07-.46-.13-.59l-1.23 1.23c-.17.25-.33-.51-.47.78h1.27c.28 0 .5-.22.5.5s-.22.5-.5.5h-.2c.68.3.13.68.13 1.12.55-.82.87-1.81.87-2.88s-.32-2.06-.87-2.88z"></path><path d="M12 12.73c-1.79 0-3.24-1.45-3.24-3.23S10.21 6.27 12 6.27s3.24 1.45 3.24 3.23-1.45 3.23-3.24 3.23zm0-5.46c-1.23 0-2.24 1-2.24 2.23S10.77 11.73 12 11.73s2.24-1 2.24-2.23S13.23 7.27 12 7.27z"></path>
            </svg>
            Entrar com Google
          </button>

          {/* Se você ainda quiser o login demo: */}
          <button
            onClick={handleCredentialsSignIn}
            type="button"
            className="w-full flex items-center justify-center py-3.5 px-4 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
          >
            Login com Credenciais (demo)
          </button>
        </div>

        {/* Link para cadastro, se você tiver uma página de SignUpPage funcional */}
        {/* <p className="text-sm text-gray-600 text-center mt-8">
          Não tem uma conta?{' '}
          <a href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
            Cadastre-se
          </a>
        </p> */}
      </div>
    </div>
  );
}