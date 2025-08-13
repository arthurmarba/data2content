// src/app/dashboard/billing/page.tsx
"use client";

import * as React from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAffiliateCode } from "@/hooks/useAffiliateCode";

type Props = { initialAffiliateCode?: string };
type FormData = { affiliateCode: string };

export default function BillingClientPage({ initialAffiliateCode = "" }: Props) {
  const resolvedAffiliate = useAffiliateCode();

  const { register, setValue, watch } = useForm<FormData>({
    defaultValues: { affiliateCode: (initialAffiliateCode || "").toUpperCase() },
  });

  const affiliateCodeValue = watch("affiliateCode");

  // Ajuste de prioridade: permite URL/cookie/LS/sessão sobrescrever o default inicial
  useEffect(() => {
    if (!resolvedAffiliate) return;

    const current = (affiliateCodeValue || "").trim().toUpperCase();
    const initial = (initialAffiliateCode || "").trim().toUpperCase();

    // Se o campo está vazio OU ainda igual ao default inicial, sobrescreve
    if (!current || current === initial) {
      setValue("affiliateCode", resolvedAffiliate.toUpperCase(), {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true, // já valida se houver lógica de preview
      });
    }
  }, [affiliateCodeValue, resolvedAffiliate, setValue, initialAffiliateCode]);

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

      {/* Dica visual opcional: mostra de onde veio o código resolvido */}
      {resolvedAffiliate && !affiliateCodeValue && (
        <p className="mt-2 text-sm text-gray-600">
          Código aplicado automaticamente: <b>{resolvedAffiliate}</b>
        </p>
      )}

      <button
        type="button"
        className="mt-6 w-full rounded-md bg-black px-4 py-3 text-white"
        onClick={() => {
          const code = (watch("affiliateCode") || "").trim().toUpperCase();
          // Aqui você pode chamar seu endpoint de assinatura / checkout
          console.log("affiliateCode enviado:", code);
          // fetch("/api/billing/subscribe", { ... })
        }}
      >
        Assinar agora
      </button>
    </div>
  );
}
