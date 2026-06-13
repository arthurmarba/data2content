"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { resolveIntentCopy } from "./loginIntentCopy";
import { BRAND_ATMOSPHERE_BG } from "@/app/lib/brandAtmosphere";

interface CommunityCreator {
  id: string;
  name: string;
  avatarUrl?: string | null;
  hasAvatarImage?: boolean;
  hidden?: boolean;
}

function LoginComponent() {
  const searchParams = useSearchParams();
  const callbackUrlFromParams = searchParams.get("callbackUrl");
  const intentFromParams = searchParams.get("intent");
  const loginError = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);
  const [creators, setCreators] = useState<CommunityCreator[]>([]);
  const [creatorCount, setCreatorCount] = useState(0);

  useEffect(() => {
    fetch("/api/landing/community-stats")
      .then((r) => r.json())
      .then((data) => {
        const ranking: CommunityCreator[] = data?.ranking ?? [];
        const withAvatar = ranking.filter((c) => Boolean(c.avatarUrl));
        setCreators(withAvatar.slice(0, 6));
        setCreatorCount(data?.metrics?.totalSubscribers ?? data?.metrics?.activeCreators ?? withAvatar.length);
      })
      .catch(() => {});
  }, []);

  const copy = useMemo(
    () => resolveIntentCopy(callbackUrlFromParams, intentFromParams),
    [callbackUrlFromParams, intentFromParams]
  );
  const consentRequired = loginError === "TermsConsentRequired";

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    void signIn("google", {
      callbackUrl: callbackUrlFromParams || MAIN_DASHBOARD_ROUTE,
    }).catch(() => {
      setIsLoading(false);
    });
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center px-5 pt-[7dvh] pb-[11dvh]"
      style={{ backgroundImage: BRAND_ATMOSPHERE_BG }}
    >
      {/* flex-1 + justify-center centraliza o bloco no espaço disponível.
          O padding assimétrico (pb > pt) dá o viés de optical centering:
          o bloco sobe ~2dvh acima do centro geométrico — quanto mais alta
          a tela, maior o lift (corrige o "levemente baixo" no Pro Max). */}
      <div className="flex w-full flex-1 max-w-sm flex-col items-center justify-center px-1">

        {/* Logo D2C em preto */}
        <div className="flex justify-center">
          <img
            src="/images/Colorido-Simbolo.png"
            alt="Data2Content"
            style={{ filter: "brightness(0)", width: "160px", height: "auto", marginBottom: "-12px" }}
            aria-hidden="true"
          />
        </div>

        <div className="mb-5 text-center">
          {copy.badge ? (
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
              {copy.badge}
            </div>
          ) : null}
          <h1
            className="mx-auto max-w-[19rem] text-[2.5rem] font-bold leading-[1.06] tracking-tight text-zinc-950"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            {(() => {
              const words = copy.title.split(" ");
              const last = words.pop();
              return (
                <>
                  {words.join(" ")}{" "}
                  <span>{last}</span>
                </>
              );
            })()}
          </h1>
          <p
            className="mx-auto mt-3 max-w-[18rem] text-[13px] font-medium leading-relaxed text-zinc-500"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            {copy.description}
          </p>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
          {[
            { icon: "✦", label: "Pautas semanais", iconClass: "text-brand-primary" },
            { icon: "↗", label: "Collabs", iconClass: "text-brand-accent" },
            { icon: "◆", label: "Comunidade ativa", iconClass: "text-brand-sun-dark" },
          ].map(({ icon, label, iconClass }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm"
            >
              <span className={iconClass}>{icon}</span>
              {label}
            </span>
          ))}
        </div>

        {creators.length > 0 && (
          <div className="mb-5 w-full">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center">
                {creators.filter(c => !c.hidden).slice(0, 5).map((creator, i) => (
                  <div
                    key={creator.id}
                    className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-white bg-zinc-200"
                    style={{ marginLeft: i === 0 ? 0 : -10, zIndex: creators.length - i }}
                  >
                    {creator.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={creator.avatarUrl}
                        alt={creator.name}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setCreators(prev =>
                          prev.map(c => c.id === creator.id ? { ...c, hidden: true } : c)
                        )}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-zinc-500">
                        {creator.name.charAt(0)}
                      </span>
                    )}
                  </div>
                ))}
                {creatorCount > 5 && (
                  <div
                    className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white bg-zinc-100 text-[10px] font-bold text-zinc-500"
                    style={{ marginLeft: -10, zIndex: 0 }}
                  >
                    +{creatorCount - 5}
                  </div>
                )}
              </div>
              <p className="text-center text-[12.5px] leading-snug text-zinc-500">
                Somos uma comunidade de{" "}
                <span className="font-bold text-zinc-900">
                  {creatorCount} {creatorCount === 1 ? "criador" : "criadores"}
                </span>
              </p>
            </div>
          </div>
        )}

        {consentRequired ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-700">
            Continue com Google para registrar o aceite dos Termos e da Política de Privacidade.
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-[19.5rem]">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            aria-label={isLoading ? "Entrando..." : copy.buttonLabel}
            className="inline-flex w-full appearance-none items-center justify-center overflow-hidden rounded-full bg-zinc-950 px-6 py-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.20)] outline-none transition-all hover:bg-zinc-800 hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-zinc-950/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="inline-flex items-center justify-center gap-3 whitespace-nowrap">
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
              {isLoading ? "Entrando..." : copy.buttonLabel}
            </span>
          </button>
        </div>

        {copy.footer ? (
          <p className="mt-5 text-center text-[12px] font-medium leading-relaxed text-zinc-400">
            {copy.footer}
          </p>
        ) : null}

        {/* Legal — compacto, uma linha */}
        <p className={`mx-auto text-center text-[10px] leading-relaxed text-zinc-400/70 ${copy.footer ? "mt-2" : "mt-4"}`}>
          Ao continuar, você aceita os{" "}
          <Link href="/termos-e-condicoes" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-600">
            Termos
          </Link>{" "}
          e a{" "}
          <Link href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-600">
            Política de Privacidade
          </Link>.
        </p>


      </div>{/* /hero */}
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
