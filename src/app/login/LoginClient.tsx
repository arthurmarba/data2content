// src/app/login/LoginClient.tsx (Novo)
// Todo o conteúdo interativo da sua página de login foi movido para cá.

"use client";

import { signIn } from "next-auth/react";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { FaCheckCircle, FaInstagram, FaUsers, FaWhatsapp } from "react-icons/fa";
import QADynamicRows from "./components/QADynamicRows";

// O Suspense é usado para envolver componentes que dependem de hooks como useSearchParams
function LoginComponent() {
  const searchParams = useSearchParams();
  const callbackUrlFromParams = searchParams.get('callbackUrl');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [agencyMessage, setAgencyMessage] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

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
              setAgencyMessage(`Convite do parceiro ${info.name} ativo! Desconto será aplicado após assinatura.`);
            } else {
              setAgencyMessage(`Convite do parceiro ${data.code} ativo!`);
            }
          } catch {
            setAgencyMessage(`Convite do parceiro ${data.code} ativo!`);
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
      callbackUrl: callbackUrlFromParams || MAIN_DASHBOARD_ROUTE,
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
      window.location.href = callbackUrlFromParams || "/auth/callback";
    }
  };

  const featureHighlights = [
    {
      icon: <FaUsers className="h-5 w-5 text-rose-500" aria-hidden="true" />,
      title: "Comunidade prática",
      description: "Mentorias semanais e desafios para aplicar novas ideias no mesmo dia.",
    },
    {
      icon: <FaInstagram className="h-5 w-5 text-indigo-500" aria-hidden="true" />,
      title: "Diagnóstico Instagram",
      description: "Conecte em modo leitura e receba horários, formatos e tendências personalizadas.",
    },
    {
      icon: <FaWhatsapp className="h-5 w-5 text-emerald-500" aria-hidden="true" />,
      title: "Alertas no WhatsApp integrados",
      description: "Ative para receber notificações rápidas; dúvidas com IA ficam no Chat AI.",
    },
  ];

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-brand-light px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10">
        <QADynamicRows />
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center">
        <section className="space-y-6 text-center lg:text-left">
          <span className="inline-flex items-center justify-center rounded-full bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-500 shadow-sm backdrop-blur lg:justify-start">
            Comece em minutos
          </span>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold text-brand-dark sm:text-4xl">
              Entre agora e desbloqueie sua comunidade, métricas e IA personalizada.
            </h1>
            <p className="text-base text-slate-700 sm:text-lg">
              Use seu Google para acessar rapidamente e seguir um plano guiado: entrar na comunidade, conectar seu
              Instagram e ativar a IA do WhatsApp quando estiver pronto.
            </p>
          </div>
          <ul className="space-y-4 text-left">
            {featureHighlights.map((item) => (
              <li key={item.title} className="flex items-start gap-3 rounded-xl bg-white/70 p-3 shadow-sm backdrop-blur">
                <span className="mt-1">{item.icon}</span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="w-full rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur sm:p-8">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">Faça login para continuar</h2>
            <p className="text-sm text-slate-600">
              Preferimos um caminho só: use o Google e volte para onde parou em segundos.
            </p>
            {agencyMessage && (
              <p className="mx-auto max-w-sm rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {agencyMessage}
              </p>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <button
              onClick={handleGoogleSignIn}
              type="button"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-3 rounded-lg bg-rose-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M48 24.4C48 22.7 47.9 21.2 47.5 19.8H24.5V28.5H37.9C37.3 31.4 35.6 33.7 32.9 35.3V41.3H41.1C45.6 37.1 48 31.3 48 24.4Z"
                  fill="#4285F4"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M24.5 48.1C31.5 48.1 37.4 45.8 41.1 41.3L32.9 35.3C30.6 36.9 27.8 37.8 24.5 37.8C18.2 37.8 12.9 33.6 11 28H2.6V34.1C6.4 42.2 14.8 48.1 24.5 48.1Z"
                  fill="#34A853"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M11 28C10.5 26.6 10.2 25.1 10.2 23.5C10.2 21.9 10.5 20.4 11 19V12.9H2.6C1 15.8 0 19.5 0 23.5C0 27.5 1 31.2 2.6 34.1L11 28Z"
                  fill="#FBBC05"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M24.5 9.2C28.2 9.2 31.8 10.6 34.5 13.1L41.3 6.6C37.4 2.9 31.5 0 24.5 0C14.8 0 6.4 5.9 2.6 12.9L11 19C12.9 13.4 18.2 9.2 24.5 9.2Z"
                  fill="#EA4335"
                />
              </svg>
              Entrar com Google
            </button>
            <p className="text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <FaCheckCircle className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                Login seguro via Google OAuth. Sem compartilhar dados sem permissão.
              </span>
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => setShowEmailForm((prev) => !prev)}
              className="w-full text-sm font-medium text-rose-600 transition hover:text-rose-700"
            >
              {showEmailForm ? "Ocultar login com e-mail" : "Prefere usar e-mail e senha?"}
            </button>

            {showEmailForm && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    placeholder="seu@email.com"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
                    Senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    placeholder="Sua senha"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleCredentialsSignIn}
                  type="button"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-50"
                >
                  {isLoading ? "Entrando..." : "Entrar com e-mail e senha"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// O componente principal exportado usa Suspense para lidar com o hook useSearchParams
export default function LoginClient() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <LoginComponent />
        </Suspense>
    )
}
