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

  useEffect(() => {
    if (affiliateCodeValue || !resolvedAffiliate) return;
    setValue("affiliateCode", resolvedAffiliate.toUpperCase(), {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [affiliateCodeValue, resolvedAffiliate, setValue]);

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
        Iniciar teste gratuito
      </button>
      <p className="mt-2 text-center text-xs text-gray-500">
        Pagamento seguro via Stripe. Teste gratuito por 7 dias; a cobrança será automática após esse período, a menos que você cancele.
      </p>
    </div>
  );
}
