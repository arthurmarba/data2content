"use client";

import * as React from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

type Props = { initialAffiliateCode?: string };
type FormData = { affiliateCode: string };

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]+)")
  );
  return m && m[1] ? decodeURIComponent(m[1]) : "";
}

export default function BillingClientPage({ initialAffiliateCode = "" }: Props) {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const { register, setValue, watch } = useForm<FormData>({
    defaultValues: { affiliateCode: (initialAffiliateCode || "").toUpperCase() },
  });

  const affiliateCodeValue = watch("affiliateCode");

  useEffect(() => {
    if (affiliateCodeValue) return; // já preenchido via SSR ou usuário

    // URL e COOKIE primeiro
    const fromUrl = (
      searchParams?.get("ref") || searchParams?.get("aff") || ""
    )
      .toString()
      .trim()
      .toUpperCase();

    const fromCookie = getCookie("d2c_ref").trim().toUpperCase();

    // sessão por último
    const fromSession = (
      (session as any)?.user?.affiliateCode ||
      (session as any)?.affiliateCode ||
      (session as any)?.user?.ref ||
      (session as any)?.ref ||
      ""
    )
      .toString()
      .trim()
      .toUpperCase();

    const candidate =
      fromUrl || fromCookie || initialAffiliateCode.toUpperCase() || fromSession || "";

    if (process.env.NODE_ENV !== "production") {
      console.debug("[Billing autofill]", {
        fromUrl,
        fromCookie,
        initial: initialAffiliateCode,
        fromSession,
        picked: candidate,
        status,
      });
    }

    if (candidate) {
      setValue("affiliateCode", candidate, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [affiliateCodeValue, searchParams, session, status, initialAffiliateCode, setValue]);

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border p-6">
      <h1 className="text-2xl font-semibold mb-1">Plano Data2Content</h1>
      <p className="text-3xl font-extrabold mb-6">
        R$49,90 <span className="text-base font-normal">/mês</span>
      </p>

      <label className="block text-sm font-medium mb-1">
        Código de Afiliado (opcional)
      </label>
      <input
        {...register("affiliateCode", {
          setValueAs: (v) => (v || "").toString().trim().toUpperCase(),
        })}
        placeholder="Ex: JLS29D"
        className="w-full rounded-md border px-3 py-2 outline-none focus:ring"
      />

      <button
        type="button"
        className="mt-6 w-full rounded-md bg-black px-4 py-3 text-white"
        onClick={() => {
          const code = (watch("affiliateCode") || "").trim().toUpperCase();
          console.log("affiliateCode enviado:", code);
        }}
      >
        Assinar agora
      </button>
    </div>
  );
}
