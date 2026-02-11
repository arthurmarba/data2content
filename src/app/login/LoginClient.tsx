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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-12">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#FF2C7E22_0%,transparent_50%),radial-gradient(circle_at_80%_20%,#246BFD22_0%,transparent_50%),radial-gradient(circle_at_50%_80%,#FFB34722_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-[0_24px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <ButtonPrimary
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          size="lg"
          variant="brand"
          className="w-full rounded-2xl px-6 py-4 text-base font-semibold shadow-2xl shadow-brand-primary/30"
        >
          <span className="inline-flex items-center justify-center gap-3">
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
            {isLoading ? "Entrando..." : "Entrar com Google"}
          </span>
        </ButtonPrimary>
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
