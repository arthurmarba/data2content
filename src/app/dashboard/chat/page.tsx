// src/app/dashboard/chat/page.tsx

"use client";

import ChatPanel from "@/app/dashboard/ChatPanel";
import InstagramConnectCard from "@/app/dashboard/InstagramConnectCard";
import { useSearchParams } from "next/navigation";
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import BillingSubscribeModal from "@/app/dashboard/billing/BillingSubscribeModal";

export default function ChatHomePage() {
  const sp = useSearchParams();
  const showIgConnect = sp.get('instagramLinked') === 'true';
  const { data: session, status } = useSession();
  const instagramConnected = Boolean(session?.user?.instagramConnected);
  const planStatus = (session?.user?.planStatus || '').toLowerCase();
  const isActiveLike = useMemo(() => new Set(['active','trial','trialing','non_renewing']).has(planStatus), [planStatus]);

  // Modal de assinatura (PRO)
  const [showBillingModal, setShowBillingModal] = useState(false);
  const openBillingModal = () => setShowBillingModal(true);
  const closeBillingModal = () => setShowBillingModal(false);
  const openedAfterIgRef = useRef(false);


  // Abrir modal de assinatura automaticamente após conexão IG (apenas uma vez)
  useEffect(() => {
    if (showIgConnect && instagramConnected && !isActiveLike && !openedAfterIgRef.current) {
      openedAfterIgRef.current = true;
      setShowBillingModal(true);
    }
  }, [showIgConnect, instagramConnected, isActiveLike]);

  // (Mídia Kit banner e lógica foram movidos para o ChatPanel)

  return (
    // Container ajustado para sidebar: remove full-bleed
    <div className="relative w-full bg-white text-gray-900 h-[calc(100vh-4rem)] flex flex-col">
      
      {/* Cards superiores (Conexão IG) */}
      <div className="mx-auto max-w-4xl w-full px-4 pt-2 space-y-2">
        {showIgConnect && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <InstagramConnectCard
              canAccessFeatures={true}
              onActionRedirect={() => { /* no-op in chat */ }}
              showToast={() => { /* no-op in chat */ }}
            />
          </div>
        )}
      </div>

      {/* O ChatPanel agora ocupa o espaço restante de forma flexível */}
      <div className="flex-grow w-full">
        <ChatPanel onUpsellClick={openBillingModal} />
      </div>

      {/* Modal de Assinatura (Checkout) */}
      <BillingSubscribeModal open={showBillingModal} onClose={closeBillingModal} />
    </div>
  );
}
