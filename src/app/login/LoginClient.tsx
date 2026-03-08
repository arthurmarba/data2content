"use client";

import { signIn } from "next-auth/react";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ButtonPrimary from "@/app/landing/components/ButtonPrimary";

function LoginComponent() {
  const searchParams = useSearchParams();
  const callbackUrlFromParams = searchParams.get("callbackUrl");
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    signIn("google", {
      callbackUrl: callbackUrlFromParams || MAIN_DASHBOARD_ROUTE,
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0F1A] px-4 py-12">
      {/* Premium Dark Background with Glowing Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-brand-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-brand-accent/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />
      </div>

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-2xl">
        {/* Subtle top light effect */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="mb-10 text-center">
          <div className="inline-flex mb-6 rounded-full border border-brand-primary/20 bg-brand-primary/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary">
            Acesso Restrito
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Destaque <span className="text-brand-primary">+</span> D2C
          </h1>
          <p className="mt-4 text-[13px] font-medium leading-relaxed text-slate-400">
            Aceleradora de criadores vinculada ao celeiro oficial de talentos da agência Destaque.
          </p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-brand-primary/50 to-brand-accent/50 opacity-30 blur-sm group-hover:opacity-75 transition duration-500"></div>
          <ButtonPrimary
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            size="lg"
            variant="brand"
            className="relative w-full rounded-2xl !bg-white px-6 py-5 text-base font-bold !text-slate-900 shadow-xl transition-all hover:!bg-white hover:!text-slate-900 hover:scale-[1.01] active:scale-[0.98]"
          >
            <span className="inline-flex items-center justify-center gap-3">
              {!isLoading && (
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
              )}
              {isLoading ? "Validando Acesso..." : "Verificar Disponibilidade (Google)"}
            </span>
          </ButtonPrimary>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Requer convite prévio de consultoria.
          </p>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </div>
    </div>
  );
}

export default function LoginClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginComponent />
    </Suspense>
  );
}
