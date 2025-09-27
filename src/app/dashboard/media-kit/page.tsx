// src/app/dashboard/media-kit/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import MediaKitView from '@/app/mediakit/[token]/MediaKitView';
import { motion, AnimatePresence } from 'framer-motion';
import { FaExclamationTriangle, FaWhatsapp, FaTimes } from 'react-icons/fa';
import BillingSubscribeModal from '../billing/BillingSubscribeModal';
import WhatsAppConnectInline from '../WhatsAppConnectInline';
import DiscoverBillingGate from '../discover/DiscoverBillingGate';

type Summary = any;
type VideoListItem = any;
type Kpis = any;
type Demographics = any;

import React from 'react';

function SelfMediaKitContent({ userId, fallbackName, fallbackEmail, fallbackImage, compactPadding, publicUrlForCopy }: { userId: string; fallbackName?: string | null; fallbackEmail?: string | null; fallbackImage?: string | null; compactPadding?: boolean; publicUrlForCopy?: string | null; }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [demographics, setDemographics] = useState<Demographics | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [sRes, vRes, kRes, dRes] = await Promise.all([
          fetch(`/api/v1/users/${userId}/highlights/performance-summary`, { cache: 'no-store' }),
          fetch(`/api/v1/users/${userId}/videos/list?sortBy=views&limit=5`, { cache: 'no-store' }),
          fetch(`/api/v1/users/${userId}/kpis/periodic-comparison?comparisonPeriod=last_30d_vs_previous_30d`, { cache: 'no-store' }),
          fetch(`/api/demographics/${userId}`, { cache: 'no-store' })
        ]);
        const s = sRes.ok ? await sRes.json() : null;
        const vj = vRes.ok ? await vRes.json() : { posts: [] };
        const v = Array.isArray(vj?.posts) ? vj.posts : [];
        const k = kRes.ok ? await kRes.json() : null;
        const d = dRes.ok ? await dRes.json() : null;
        if (!mounted) return;
        setSummary(s);
        setVideos((v || []).map((video: any) => ({
          ...video,
          format: video.format ? [video.format] : [],
          proposal: video.proposal ? [video.proposal] : [],
          context: video.context ? [video.context] : [],
          tone: video.tone ? [video.tone] : [],
          references: video.references ? [video.references] : [],
        })));
        setKpis(k);
        setDemographics(d);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Falha ao carregar dados do Mídia Kit');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (userId) load();
    return () => { mounted = false; };
  }, [userId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 border border-gray-200 rounded-lg">
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
              <div className="mt-3 h-24 bg-gray-100 rounded animate-pulse" />
              <div className="mt-3 h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-md w-full border border-yellow-200 bg-yellow-50 text-yellow-900 rounded-lg p-3 text-sm">{error}</div>
      </div>
    );
  }

  const user = {
    _id: userId,
    name: fallbackName || 'Criador',
    email: fallbackEmail || undefined,
    profile_picture_url: fallbackImage || undefined,
  } as any;

  return (
    <MediaKitView
      user={user}
      summary={summary}
      videos={videos}
      kpis={kpis}
      demographics={demographics}
      showSharedBanner={false}
      showOwnerCtas={true}
      compactPadding={compactPadding}
      publicUrlForCopy={publicUrlForCopy || undefined}
    />
  );
}

export default function MediaKitSelfServePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const fetchedOnce = useRef(false);

  // Gate: impedir acesso ao Mídia Kit antes de conectar Instagram
  useEffect(() => {
    if (status === 'authenticated' && !instagramConnected) {
      router.replace('/dashboard/onboarding');
    }
  }, [status, instagramConnected, router]);

  // Lógica do Modal de Pagamento
  const [showBillingModal, setShowBillingModal] = useState(false);
  const closeBillingModal = () => setShowBillingModal(false);
  const openedAfterIgRef = useRef(false);
  const showIgConnectSuccess = sp.get("instagramLinked") === "true";
  const processingIgLinkRef = useRef(false);

  const planStatus = String((session?.user as any)?.planStatus || "").toLowerCase();
  const isActiveLike = useMemo(
    () => new Set(["active", "trial", "trialing", "non_renewing"]).has(planStatus),
    [planStatus]
  );
  
  // Lógica e Estado para o Modal do WhatsApp
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  
  const handleWhatsAppLink = () => {
    setShowWhatsAppModal(true);
  };

  useEffect(() => {
    const handler = () => setShowBillingModal(true);
    window.addEventListener("open-subscribe-modal" as any, handler);
    return () => window.removeEventListener("open-subscribe-modal" as any, handler);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(sp.toString());
    if (params.get("instagramLinked") === "true") {
      params.delete("instagramLinked");
      const next = window.location.pathname + (params.toString() ? `?${params}` : "");
      router.replace(next, { scroll: false });
    }
  }, [sp, router]);

  // Após retorno do OAuth: atualiza sessão e finaliza conexão se houver apenas 1 conta IG
  useEffect(() => {
    const run = async () => {
      if (!showIgConnectSuccess) return;
      if (processingIgLinkRef.current) return;
      processingIgLinkRef.current = true;
      try {
        const updated = await update();
        const u = updated?.user as any;
        if (!u) return;
        if (u.instagramConnected) return; // já conectado

        const accounts = Array.isArray(u.availableIgAccounts) ? u.availableIgAccounts : [];
        if (accounts.length === 1 && accounts[0]?.igAccountId) {
          const res = await fetch('/api/instagram/connect-selected-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instagramAccountId: accounts[0].igAccountId }),
          });
          if (res.ok) {
            await update(); // refletir instagramConnected=true na sessão
          } else {
            const err = await res.json().catch(() => ({}));
            setError(err?.error || 'Falha ao finalizar a conexão do Instagram.');
          }
        } else if (accounts.length > 1) {
          // Redireciona para o Chat, que possui o seletor de contas IG
          router.push('/dashboard/chat?instagramLinked=true');
        }
      } catch (e: any) {
        console.error('Erro ao finalizar conexão do Instagram:', e);
      }
    };
    run();
  }, [showIgConnectSuccess, update, router]);

  useEffect(() => {
    if (showIgConnectSuccess && instagramConnected && !isActiveLike && !openedAfterIgRef.current) {
      openedAfterIgRef.current = true;
      setShowBillingModal(true);
    }
  }, [showIgConnectSuccess, instagramConnected, isActiveLike]);

  // Toolbar state (share link)

  const handleCorrectInstagramLink = async () => {
    try {
      const response = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST' });
      if (!response.ok) {
        console.error('Falha ao preparar a vinculação da conta.');
        setError('Falha ao preparar a vinculação com o Facebook. Tente novamente.');
        return;
      }
      signIn('facebook', { callbackUrl: '/dashboard/media-kit?instagramLinked=true' });
    } catch (error) {
      console.error('Erro ao iniciar o signIn com o Facebook:', error);
      setError('Ocorreu um erro inesperado ao tentar conectar. Tente novamente.');
    }
  };
  
  useEffect(() => {
    let mounted = true;
    const loadOrCreateLink = async () => {
      if (status !== 'authenticated') return;
      if (!instagramConnected) {
        setLoading(false);
        setUrl(null);
        return;
      }
      if (fetchedOnce.current) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/users/media-kit-token', { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        if (res.ok && (data?.url || data?.publicUrl)) {
          setUrl(data?.url ?? data?.publicUrl);
          fetchedOnce.current = true;
        } else {
          const resCreate = await fetch('/api/users/media-kit-token', { method: 'POST' });
          const created = await resCreate.json();
          if (!mounted) return;
          if (!resCreate.ok || !(created?.url || created?.publicUrl)) {
            throw new Error(created?.error || 'Falha ao gerar link do Mídia Kit.');
          }
          setUrl(created?.url ?? created?.publicUrl);
          fetchedOnce.current = true;
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Erro inesperado ao carregar o Mídia Kit.');
        setUrl(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadOrCreateLink();
    return () => { mounted = false; };
  }, [status, instagramConnected]);

  // (compartilhamento via toolbar removido; botão interno do MediaKitView usa publicUrlForCopy)

  if (status === 'loading') {
    return <div className="p-6">Carregando…</div>;
  }
  if (status === 'unauthenticated') {
    return <div className="p-6"><p className="text-sm text-gray-600">Faça login para visualizar seu Mídia Kit.</p></div>;
  }

  // ===== IG não conectado → redireciona para Onboarding =====
  if (!instagramConnected) {
    return <div className="p-6 text-sm text-gray-600">Redirecionando para o onboarding…</div>;
  }

  // ===== Estado principal (IG conectado) =====
  return (
    <>
      {/* Gate reativo para WhatsApp/Assinatura (torna visível o vínculo para assinantes) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <DiscoverBillingGate />
      </div>

      <section className="w-full bg-white pb-10" aria-label="Mídia Kit">
        {/* Conteúdo do Mídia Kit (sem iframe) */}
        <SelfMediaKitContent
          userId={(session?.user as any)?.id as string}
          fallbackName={session?.user?.name}
          fallbackEmail={session?.user?.email}
          fallbackImage={session?.user?.image}
          publicUrlForCopy={url}
          compactPadding
        />
      </section>

      <BillingSubscribeModal open={showBillingModal} onClose={closeBillingModal} />

      <AnimatePresence>
        {showWhatsAppModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowWhatsAppModal(false)}
              className="fixed inset-0 bg-black/50 z-50"
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed bottom-0 left-0 right-0 bg-gray-50 p-4 pt-5 rounded-t-2xl shadow-2xl z-[60] border-t"
            >
              <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Vincular com WhatsApp</h3>
                  <button onClick={() => setShowWhatsAppModal(false)} className="p-1 rounded-full hover:bg-gray-200 text-gray-500"><FaTimes /></button>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <WhatsAppConnectInline />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
