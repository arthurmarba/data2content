// src/app/dashboard/chat/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import ChatPanel from "@/app/dashboard/ChatPanel";
import InstagramConnectCard from "@/app/dashboard/InstagramConnectCard";
import BillingSubscribeModal from "@/app/dashboard/billing/BillingSubscribeModal";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { isPlanActiveLike } from "@/utils/planStatus";

export default function ChatHomePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const showIgConnect = sp.get("instagramLinked") === "true";

  const { data: session } = useSession();
  const billingStatus = useBillingStatus();
  const instagramConnected = Boolean(session?.user?.instagramConnected);
  const planStatus = (session?.user as any)?.planStatus;
  const isActiveLike = useMemo(
    () => Boolean(billingStatus.hasPremiumAccess || isPlanActiveLike(planStatus)),
    [billingStatus.hasPremiumAccess, planStatus]
  );

  // Modal de assinatura (PRO)
  const [showBillingModal, setShowBillingModal] = useState(false);
  const openBillingModal = () => setShowBillingModal(true);
  const closeBillingModal = () => setShowBillingModal(false);
  const openedAfterIgRef = useRef(false);

  useEffect(() => {
    const handler = () => setShowBillingModal(true);
    window.addEventListener("open-subscribe-modal" as any, handler);
    return () => window.removeEventListener("open-subscribe-modal" as any, handler);
  }, []);

  // Limpa o parâmetro ?instagramLinked=true do URL após a primeira renderização
  useEffect(() => {
    const params = new URLSearchParams(sp.toString());
    if (params.get("instagramLinked") === "true") {
      params.delete("instagramLinked");
      const next = window.location.pathname + (params.toString() ? `?${params}` : "");
      router.replace(next, { scroll: false });
    }
  }, [sp, router]);

  // Abre o modal após IG conectar (se não tiver plano ativo) — apenas uma vez
  useEffect(() => {
    if (showIgConnect && instagramConnected && !isActiveLike && !openedAfterIgRef.current) {
      openedAfterIgRef.current = true;
      setShowBillingModal(true);
    }
  }, [showIgConnect, instagramConnected, isActiveLike]);

  return (
    // Offset do header fixo já é tratado pelo layout; aqui garantimos altura total da viewport
    <div
      className="relative w-full bg-white text-gray-900 flex flex-col overflow-hidden"
      style={{ minHeight: "100svh" }}
    >
      {/* Card de conexão IG quando voltamos do OAuth */}
      <div className="mx-auto max-w-4xl w-full px-4 pt-2 space-y-2">
        {showIgConnect && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <InstagramConnectCard
              canAccessFeatures={true}
              onActionRedirect={() => {}}
              showToast={() => {}}
            />
          </div>
        )}
      </div>

      {/* Chat ocupa todo o restante */}
      <div className="flex-1 w-full min-h-0">
        <ChatPanel onUpsellClick={openBillingModal} />
      </div>

      {/* Modal de Assinatura (Checkout) */}
      <BillingSubscribeModal open={showBillingModal} onClose={closeBillingModal} />
    </div>
  );
}
