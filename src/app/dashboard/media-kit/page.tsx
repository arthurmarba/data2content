// src/app/dashboard/media-kit/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import MediaKitView from '@/app/mediakit/[token]/MediaKitView';
import { motion, AnimatePresence } from 'framer-motion';
import { FaExclamationTriangle, FaShareAlt, FaLink, FaCheck, FaWhatsapp, FaTimes } from 'react-icons/fa';
import BillingSubscribeModal from '../billing/BillingSubscribeModal';
import WhatsAppConnectInline from '../WhatsAppConnectInline';

export default function MediaKitSelfServePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
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

  // Toolbar sizing
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarH, setToolbarH] = useState<number>(0);
  const TOP_SPACING = 8;
  const BELOW_BAR_GAP = 8;
  const iframeTop = url ? TOP_SPACING + toolbarH + BELOW_BAR_GAP : 0;

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const apply = () => setToolbarH(el.offsetHeight || 0);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => { ro.disconnect(); window.removeEventListener('resize', apply); };
  }, [url]);

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

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {/* noop */}
  };

  const nativeShare = async () => {
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Meu Mídia Kit', url });
      } else {
        await copyLink();
      }
    } catch {/* share cancelado */}
  };

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
  const safeBottom = 'env(safe-area-inset-bottom, 0px)';

  return (
    <>
      <section
        className="relative h-[calc(100svh-var(--header-h,4rem))] w-full bg-white overflow-hidden"
        aria-label="Mídia Kit embutido"
      >
        {url && (
          <div
            ref={toolbarRef}
            className="absolute left-0 right-0 z-20 px-2 sm:px-4"
            style={{ top: TOP_SPACING }}
          >
            <div className="w-full rounded-xl border border-gray-200 bg-white/90 supports-[backdrop-filter]:bg-white/60 backdrop-blur p-2 sm:p-3 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                
                {isActiveLike && (
                  <button
                    onClick={handleWhatsAppLink}
                    className="inline-flex items-center gap-2 rounded-md bg-green-500 text-white px-3 py-1.5 text-xs font-bold hover:bg-green-600 transition-colors"
                  >
                    <FaWhatsapp className="h-3.5 w-3.5" />
                    Vincular WhatsApp
                  </button>
                )}
                
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-800 font-medium">
                  <FaShareAlt className="h-3.5 w-3.5" />
                  Compartilhar meu Mídia Kit
                </div>
                <div className="flex-1" />
                <div className="flex w-full md:w-auto items-center gap-2">
                  <input
                    value={url}
                    readOnly
                    className="flex-1 md:w-[360px] text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2"
                  />
                  <button
                    onClick={copyLink}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    title="Copiar link"
                  >
                    {copied ? <FaCheck className="h-3.5 w-3.5" /> : <FaLink className="h-3.5 w-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    onClick={nativeShare}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    title="Compartilhar"
                  >
                    <FaShareAlt className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white z-10"
            >
              <div className="mx-auto max-w-6xl px-4 pt-6">
                {/* Skeleton toolbar */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-9 w-9 bg-gray-200 rounded animate-pulse" />
                  <div className="flex-1" />
                  <div className="h-9 w-40 bg-gray-200 rounded animate-pulse" />
                </div>
                {/* Skeleton content blocks */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="p-4 border border-gray-200 rounded-lg">
                      <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
                      <div className="mt-3 h-24 bg-gray-100 rounded animate-pulse" />
                      <div className="mt-3 h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="mt-6 h-64 bg-gray-100 rounded animate-pulse" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="absolute inset-0 grid place-items-center p-4 z-10">
            <div className="max-w-md w-full border border-yellow-200 bg-yellow-50 text-yellow-900 rounded-lg p-3 text-sm flex items-start gap-2">
              <FaExclamationTriangle className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Não foi possível carregar o Mídia Kit</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {url && (
          <div
            className="absolute left-0 right-0 bottom-0"
            style={{ top: iframeTop }}
          >
            <iframe
              key={url}
              src={url}
              className="h-full w-full border-0"
              allow="clipboard-write; fullscreen; accelerometer; gyroscope; encrypted-media"
            />
          </div>
        )}
        <div style={{ height: `calc(${safeBottom})` }} aria-hidden="true" />
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
              style={{ paddingBottom: `calc(${safeBottom} + 20px)` }}
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
