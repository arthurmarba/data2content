// src/app/login/page.tsx - VERSÃO CORRIGIDA

"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrlFromParams = searchParams.get('callbackUrl');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Adicionado para desabilitar o botão durante o login
  const [error, setError] = useState('');
  const [agencyMessage, setAgencyMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAgencyMessage() {
      if (typeof window === 'undefined') return;
      const stored = localStorage.getItem('agencyInviteCode');
      if (!stored) return;
      try {
        const data = JSON.parse(stored);
        if (data && data.code) {
          try {
            const res = await fetch(`/api/agency/info/${data.code}`);
            if (res.ok) {
              const info = await res.json();
              setAgencyMessage(`Convite da agência ${info.name} ativo! Desconto será aplicado após assinatura.`);
            } else {
              setAgencyMessage(`Convite de agência ${data.code} ativo!`);
            }
          } catch {
            setAgencyMessage(`Convite de agência ${data.code} ativo!`);
          }
        }
      } catch {
        /* ignore */
      }
    }
    loadAgencyMessage();
  }, []);

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    signIn("google", {
      callbackUrl: callbackUrlFromParams || "/auth/complete-signup",
    });
  };

  const handleCredentialsSignIn = async () => {
    setIsLoading(true);
    setError('');
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setError('Email ou senha inválidos. Por favor, tente novamente.');
      console.error("Falha no login:", result.error);
      setIsLoading(false);
    } else {
      // Após um login bem-sucedido redirecionamos sempre para uma página de
      // callback centralizada que irá decidir o destino final conforme o papel
      // do usuário.
      window.location.href = callbackUrlFromParams || "/auth/callback";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-light p-4">
      <div className="bg-brand-light p-8 sm:p-12 rounded-xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-brand-dark tracking-tight">
            Bem-vindo(a) de volta!
          </h1>
          <p className="text-gray-600 mt-3 text-base sm:text-lg">
            Acesse sua conta Data2Content para continuar.
          </p>
          {agencyMessage && (
            <p className="mt-2 text-green-700 text-sm bg-green-100 px-3 py-1 rounded">
              {agencyMessage}
            </p>
          )}
        </div>

        <div className="space-y-5">
          <button
            onClick={handleGoogleSignIn}
            type="button"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3.5 px-4 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-brand-light hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink transition-colors duration-150 group disabled:opacity-50"
          >
            {/* Ícone do Google SVG aqui */}
            <svg className="w-5 h-5 mr-3 text-gray-400 group-hover:text-gray-500 transition-colors duration-150" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M48 24.4C48 22.7 47.9 21.2 47.5 19.8H24.5V28.5H37.9C37.3 31.4 35.6 33.7 32.9 35.3V41.3H41.1C45.6 37.1 48 31.3 48 24.4Z" fill="#4285F4"/><path fillRule="evenodd" clipRule="evenodd" d="M24.5 48.1C31.5 48.1 37.4 45.8 41.1 41.3L32.9 35.3C30.6 36.9 27.8 37.8 24.5 37.8C18.2 37.8 12.9 33.6 11 28H2.6V34.1C6.4 42.2 14.8 48.1 24.5 48.1Z" fill="#34A853"/><path fillRule="evenodd" clipRule="evenodd" d="M11 28C10.5 26.6 10.2 25.1 10.2 23.5C10.2 21.9 10.5 20.4 11 19V12.9H2.6C1 15.8 0 19.5 0 23.5C0 27.5 1 31.2 2.6 34.1L11 28Z" fill="#FBBC05"/><path fillRule="evenodd" clipRule="evenodd" d="M24.5 9.2C28.2 9.2 31.8 10.6 34.5 13.1L41.3 6.6C37.4 2.9 31.5 0 24.5 0C14.8 0 6.4 5.9 2.6 12.9L11 19C12.9 13.4 18.2 9.2 24.5 9.2Z" fill="#EA4335"/></svg>
            Entrar com Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-brand-light px-2 text-gray-500">OU</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-brand-pink"
              placeholder="seu@email.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-brand-pink"
              placeholder="Sua senha"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleCredentialsSignIn}
            type="button"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3.5 px-4 border border-indigo-600 text-white bg-indigo-600 rounded-lg shadow-sm text-base font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink transition-colors duration-150 disabled:opacity-50"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}