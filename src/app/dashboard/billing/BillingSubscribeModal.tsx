"use client";

import React, { useEffect, useMemo, useState } from "react";
import SubscribeModal from "@/components/billing/SubscribeModal";

interface BillingSubscribeModalProps {
  open: boolean;
  onClose: () => void;
}

type PricesShape = { monthly: { brl: number; usd: number }; annual: { brl: number; usd: number } };

export default function BillingSubscribeModal({ open, onClose }: BillingSubscribeModalProps) {
  const [prices, setPrices] = useState<PricesShape | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPrices() {
      try {
        const res = await fetch("/api/billing/prices", { cache: "no-store" });
        const data = await res.json();
        // data.prices: [{ plan: 'monthly'|'annual', currency: 'BRL'|'USD', unitAmount: number|null }, ...]
        const byKey: PricesShape = {
          monthly: { brl: 0, usd: 0 },
          annual: { brl: 0, usd: 0 },
        };
        const items = Array.isArray(data?.prices) ? data.prices : [];
        for (const it of items) {
          const plan = String(it.plan || "").toLowerCase();
          const currency = String(it.currency || "").toUpperCase();
          const val = typeof it.unitAmount === "number" ? it.unitAmount / 100 : 0;
          if (plan === "monthly" && (currency === "BRL" || currency === "USD")) {
            (byKey.monthly as any)[currency.toLowerCase()] = val;
          }
          if (plan === "annual" && (currency === "BRL" || currency === "USD")) {
            (byKey.annual as any)[currency.toLowerCase()] = val;
          }
        }
        if (!cancelled) setPrices(byKey);
      } catch {
        if (!cancelled) setPrices({ monthly: { brl: 0, usd: 0 }, annual: { brl: 0, usd: 0 } });
      }
    }
    if (open && !prices) loadPrices();
    return () => {
      cancelled = true;
    };
  }, [open, prices]);

  if (!open) return null;
  if (!prices) return null; // evita piscar estrutura incorreta; modal abrirá quando preços chegarem

  // Usa o modal original (SubscribeModal) para manter o design idêntico
  return <SubscribeModal open={open} onClose={onClose} prices={prices} />;
}
