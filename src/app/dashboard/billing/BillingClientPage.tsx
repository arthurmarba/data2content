"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
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
  const [debouncedAffiliateCode] = useDebounce(affiliateCodeValue, 400);

  const [preview, setPreview] = useState<{
    nextCycleAmount?: number | null;
    currency?: string | null;
  } | null>(null);

  const formatCurrency = (
    amount?: number | null,
    currency?: string | null
  ): string => {
    const cur =
      typeof currency === "string" && currency.trim()
        ? currency.trim().toUpperCase()
        : "BRL";
    const locale = cur === "BRL" ? "pt-BR" : "en-US";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: cur,
      }).format(((amount ?? 0) as number) / 100);
    } catch {
      const val = (((amount ?? 0) as number) / 100).toFixed(2);
      const symbol = cur === "BRL" ? "R$" : "$";
      return `${symbol} ${val}`;
    }
  };

  useEffect(() => {
    if (affiliateCodeValue || !resolvedAffiliate) return;
    setValue("affiliateCode", resolvedAffiliate.toUpperCase(), {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
  }, [affiliateCodeValue, resolvedAffiliate, setValue]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/billing/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: "monthly",
            currency: "BRL",
            affiliateCode: (debouncedAffiliateCode || "").trim().toUpperCase(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setPreview({
            nextCycleAmount: data?.nextCycleAmount ?? data?.total,
            currency: data?.currency || "BRL",
          });
        } else if (!cancelled) {
          setPreview(null);
        }
      } catch {
        if (!cancelled) setPreview(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedAffiliateCode]);

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border p-6">
      <h1 className="text-2xl font-semibold mb-1">Plano Data2Content</h1>
      <p className="text-3xl font-extrabold mb-6">
        {formatCurrency(preview?.nextCycleAmount ?? 4990, preview?.currency)}
        <span className="text-base font-normal">/mês</span>
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
        Pagamento seguro via Stripe. Teste gratuito por 7 dias; a cobrança inicial após esse período usará o valor com desconto e será automática, a menos que você cancele.
      </p>
    </div>
  );
}
