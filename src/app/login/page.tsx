// src/app/login/page.tsx
"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

// Opcional: Se você tiver um componente de loader, pode importá-lo
// import FullPageLoader from '@/app/components/auth/FullPageLoader';
// import React, { useState } from 'react';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrlFromParams = searchParams.get('callbackUrl');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSignIn = () => {
    // setIsLoading(true); // Opcional
    // O callbackUrl para /auth/complete-signup é para o fluxo de onboarding de novos usuários.
    // Se um usuário existente logar, o AuthRedirectHandler o levará ao dashboard
    // a partir da página /auth/complete-signup se isNewUserForOnboarding for false.
    signIn("google", {
      callbackUrl: callbackUrlFromParams || "/auth/complete-signup", // Prioriza callback da URL, senão vai para o onboarding
    });
  };

  const handleCredentialsSignIn = async () => {
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      console.error("Falha no login:", result.error);
    } else {
      window.location.href = "/agency/dashboard";
    }
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
              <path d="M21.543 9.75h-1.06c-.11-.79-.3-1.54-.56-2.25H21.5c.28 0 .5.22.5.5s-.22.5-.5.5h-1.581c-.12-" />
            </svg>
            Entrar com Google
          </button>

          <div>
            <label className="block text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Sua senha"
            />
          </div>

          <button
            onClick={handleCredentialsSignIn}
            type="button"
            className="w-full flex items-center justify-center py-3.5 px-4 border border-indigo-600 text-white bg-indigo-600 rounded-lg shadow-sm text-base font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
          >
            Entrar
          </button>
        </div>
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