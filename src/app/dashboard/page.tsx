"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from "next/navigation";
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import type { PlanStatus, PlanType } from '@/types/enums';
import { FaCopy, FaCheckCircle, FaClock, FaTimesCircle, FaTrophy, FaMoneyBillWave, FaCog, FaVideo, FaSpinner, FaExclamationCircle, FaInfoCircle, FaHandshake, FaEnvelope, FaUserCircle } from 'react-icons/fa';
import { motion } from "framer-motion";

// --- Imports dos seus Componentes ---
import UploadMetrics from './UploadMetrics';
import WhatsAppPanel from './WhatsAppPanel';
import PaymentModal from './PaymentModal';
import AdDealForm from './AdDealForm';
import VideoCarousel from './VideoCarousel';
import InstagramConnectCard from './InstagramConnectCard';
import StepIndicator from './StepIndicator';
import PlanCardPro from '@/components/billing/PlanCardPro';
import AffiliateCard from '@/components/affiliate/AffiliateCard';
import AffiliateHistory from '@/components/affiliate/history/AffiliateHistory';

// --- INTERFACES ---
export interface ExtendedUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  planStatus?: PlanStatus;
  planExpiresAt?: string | null;
  affiliateCode?: string | null;
  affiliateRank?: number;
  affiliateInvites?: number;
  provider?: string;
  isInstagramConnected?: boolean;
  whatsappVerified?: boolean;
  planType?: PlanType;
  stripeAccountDefaultCurrency?: string | null;
}

interface VideoData {
  id: string;
  title: string;
  youtubeVideoId: string;
}

interface CommissionLogItem {
  _id: string;
  type: string;
  status: string;
  invoiceId?: string;
  subscriptionId?: string;
  affiliateUserId: string;
  buyerUserId?: string;
  currency?: string;
  amountCents: number;
  availableAt?: string;
  transactionId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

const SkeletonLoader = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`}></div>
);

// --- COMPONENTE FUNCIONAL PARA O CARD DE AFILIADOS (PARA REUTILIZAÇÃO) ---
const AffiliateCardContent: React.FC<{
  user: ExtendedUser | undefined;
  affiliateCode: string | null;
  fullAffiliateLink: string | null;
  commissionLog: CommissionLogItem[];
  isLoadingCommissionLog: boolean;
  commissionLogError: string | null;
  copyFeedback: { type: 'code' | 'link'; success: boolean } | null;
  handleCopyToClipboard: (textToCopy: string | null, type: 'code' | 'link') => void;
  setShowPaymentModal: (show: boolean) => void;
  canRedeem: boolean;
}> = ({
  user,
  affiliateCode,
  fullAffiliateLink,
  commissionLog,
  isLoadingCommissionLog,
  commissionLogError,
  copyFeedback,
  handleCopyToClipboard,
  setShowPaymentModal,
  canRedeem
}) => {
  const { data: session } = useSession();
  const fetcher = (url: string) => fetch(url).then(r => r.json());
  const { data: connectStatus } = useSWR('/api/affiliate/connect/status', fetcher, { revalidateOnFocus: false });
  const destCurrency = connectStatus?.defaultCurrency?.toLowerCase();
  const balances: Record<string, number> = (session as any)?.user?.affiliateBalances || {};
  const entries = Object.entries(balances).sort(([a],[b]) => a.localeCompare(b));
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-brand-pink">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-brand-dark">Programa de Afiliados</h2>
        <div className="flex items-center gap-1 text-yellow-800 bg-yellow-100 px-2.5 py-1 rounded-full border border-yellow-200">
          <FaTrophy className="w-3.5 h-3.5" />
          <span className="text-xs font-bold">Rank {user?.affiliateRank ?? 1}</span>
        </div>
      </div>
      <div className="space-y-5 text-sm">
        <div className="text-center p-4 bg-brand-light rounded-lg border border-gray-200">
          <span className="text-xs text-gray-500 block mb-1">Saldos por moeda</span>
          {!entries.length ? (
            <span className="text-sm text-gray-500">Sem saldo ainda.</span>
          ) : (
            <ul className="space-y-1">
              {entries.map(([cur, cents]) => (
                <li key={cur} className="text-sm flex justify-center gap-2">
                  <span className="uppercase text-[10px] bg-gray-100 px-2 py-0.5 rounded">{cur}</span>
                  <span className="font-bold">
                    {new Intl.NumberFormat(cur==='brl'?'pt-BR':'en-US',{style:'currency',currency:cur.toUpperCase()}).format(cents/100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 block">Seu Código de Afiliado:</label>
          <div className="flex items-center gap-2">
            <input type="text" value={affiliateCode ?? "Gerando..."} readOnly className="flex-grow text-xs font-mono bg-gray-50 px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-pink" />
            {affiliateCode && (
              <button onClick={() => handleCopyToClipboard(affiliateCode, 'code')} title="Copiar Código" className={`p-2 rounded-md transition-all duration-200 ease-in-out ${ copyFeedback?.type === 'code' && copyFeedback.success ? 'bg-green-100 text-green-600 scale-110' : 'bg-gray-100 text-gray-500 hover:text-brand-pink hover:bg-gray-200' }`}>
                {copyFeedback?.type === 'code' && copyFeedback.success ? <FaCheckCircle className="w-4 h-4"/> : <FaCopy className="w-4 h-4"/>}
              </button>
            )}
          </div>
        </div>

        {fullAffiliateLink && (
          <div className="space-y-1.5 mt-4">
            <label className="text-xs font-medium text-gray-500 block">Seu Link de Indicação Completo:</label>
            <div className="flex items-center gap-2">
              <input type="text" value={fullAffiliateLink} readOnly className="flex-grow text-xs font-mono bg-gray-50 px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-pink" />
              <button onClick={() => handleCopyToClipboard(fullAffiliateLink, 'link')} title="Copiar Link Completo" className={`p-2 rounded-md transition-all duration-200 ease-in-out ${ copyFeedback?.type === 'link' && copyFeedback.success ? 'bg-green-100 text-green-600 scale-110' : 'bg-gray-100 text-gray-500 hover:text-brand-pink hover:bg-gray-200' }`}>
                {copyFeedback?.type === 'link' && copyFeedback.success ? <FaCheckCircle className="w-4 h-4"/> : <FaCopy className="w-4 h-4"/>}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Histórico de Comissões</h3>
            <a href="/afiliados" className="text-xs text-brand-pink hover:underline font-medium flex items-center gap-1">
              Saber mais <FaInfoCircle className="w-3 h-3"/>
            </a>
          </div>
          {isLoadingCommissionLog && ( <div className="text-xs text-gray-500 text-center py-4 flex items-center justify-center gap-2"> <FaSpinner className="animate-spin w-4 h-4" /> <span>Carregando histórico...</span> </div> )}
          {commissionLogError && ( <div className="text-xs text-red-500 text-center py-3 flex items-center justify-center gap-2 bg-red-50 p-2 rounded-md border border-red-200"> <FaExclamationCircle className="w-4 h-4"/> <span>{commissionLogError}</span> </div> )}
          {!isLoadingCommissionLog && !commissionLogError && commissionLog.length === 0 && ( <p className="text-xs text-gray-500 text-center py-3 italic">Nenhuma comissão recebida ainda.</p> )}
          {!isLoadingCommissionLog && !commissionLogError && commissionLog.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {commissionLog.map((logItem, index) => {
                const amt = logItem.amountCents / 100;
                const curr = (logItem.currency || 'BRL').toUpperCase();
                const mismatch = destCurrency && logItem.currency && destCurrency !== logItem.currency.toLowerCase();
                return (
                  <div key={logItem.invoiceId || logItem._id || `commission-${index}`} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200/80 text-xs hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-700">{new Date(logItem.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-green-600 text-sm">+ {amt.toLocaleString('pt-BR', { style: 'currency', currency: curr })}</span>
                        {mismatch && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800"
                            title="Moeda diferente da moeda da sua conta Stripe. O resgate só é possível quando a moeda coincidir."
                          >!
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-600 mt-1 text-[11px] leading-relaxed">{logItem.note}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-1.5 mt-6">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progresso Rank {(user?.affiliateRank ?? 1) + 1}</span>
            <span>{(user?.affiliateInvites ?? 0)}/5 Convites</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <motion.div className="bg-brand-pink h-2.5 rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(((user?.affiliateInvites ?? 0) / 5) * 100, 100)}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
          </div>
        </div>
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex-1 px-4 py-2.5 bg-brand-pink text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-default disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
            disabled={!canRedeem}
          >
            <FaMoneyBillWave className="w-4 h-4"/> Resgatar Saldo
          </button>
          <button onClick={() => setShowPaymentModal(true)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-default border border-gray-200 flex items-center justify-center gap-2">
            <FaCog className="w-4 h-4"/> Dados Pagamento
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MainDashboard() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ type: 'code' | 'link'; success: boolean } | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const swiperRef = useRef<any>(null);
  const [fullAffiliateLink, setFullAffiliateLink] = useState<string | null>(null);

  const [commissionLog, setCommissionLog] = useState<CommissionLogItem[]>([]);
  const [isLoadingCommissionLog, setIsLoadingCommissionLog] = useState(true);
  const [commissionLogError, setCommissionLogError] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);

  const scrollToPlanCard = useCallback(() => {
    const planCard = document.getElementById('plan-card');
    if (planCard) {
      planCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      console.warn("Elemento #plan-card não encontrado para scroll. Verifique o ID ou implemente a navegação.");
    }
  }, []);

  const showToastMessage = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[Toast - ${type.toUpperCase()}]: ${message}`);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/login');
    } else if (status === "authenticated" && (!session || !session.user)) {
      console.error("Erro: Autenticado, mas session ou session.user inválido.", session);
    }
  }, [status, session, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);

      if (params.get('from') === 'mp') {
        updateSession?.();
        router.replace('/dashboard');
        return;
      }

      const checkout = params.get('checkout');
      if (checkout === 'success') {
        showToastMessage('Pagamento confirmado! Bem-vindo(a) ao Pro 🎉', 'success');
        updateSession?.();
        router.replace('/dashboard');
        return;
      }
      if (checkout === 'cancel') {
        showToastMessage('Pagamento cancelado. Nada foi cobrado.', 'warning');
        router.replace('/dashboard');
        return;
      }
    }
  }, [router, updateSession, showToastMessage]);

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
  };

  const user = session?.user as ExtendedUser | undefined;
  const affiliateCode = user?.affiliateCode ?? null;
  const userId = user?.id ?? "";

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AFFILIATES_V2 === 'on') return;
    if (typeof window !== 'undefined' && affiliateCode) {
      const origin = window.location.origin;
      setFullAffiliateLink(`${origin}/?ref=${affiliateCode}`);
    } else {
      setFullAffiliateLink(null);
    }
  }, [affiliateCode]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AFFILIATES_V2 === 'on') return;
    if (status === "authenticated" && userId) {
      const fetchLog = async () => {
        setIsLoadingCommissionLog(true);
        setCommissionLogError(null);
        try {
          const response = await fetch(`/api/affiliate/commission-log`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Falha ao buscar histórico de comissões.");
          }
          const data = await response.json();
          setCommissionLog(data.items || []);
        } catch (error: any) {
          console.error("Erro ao buscar log de comissões:", error);
          setCommissionLogError(error.message || "Não foi possível carregar o histórico.");
        } finally {
          setIsLoadingCommissionLog(false);
        }
      };
      fetchLog();
    }
  }, [status, userId]);

  useEffect(() => {
    if (status === 'authenticated' && user && user.planStatus === 'inactive') {
      const stored = localStorage.getItem('agencyInviteCode');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          if (data && data.code) {
            scrollToPlanCard();
            fetch(`/api/agency/info/${data.code}`)
              .then((res) => res.ok ? res.json() : null)
              .then((info) => {
                if (info && info.name) {
                  setAgencyName(info.name);
                } else {
                  setAgencyName(data.code);
                }
              })
              .catch(() => setAgencyName(data.code));
          }
        } catch (e) {
          // ignore JSON errors
        }
      }
    }
  }, [status, user, scrollToPlanCard]);

  const handleCopyToClipboard = useCallback((textToCopy: string | null, type: 'code' | 'link') => {
    if (!textToCopy || !navigator.clipboard) {
      console.warn("Clipboard API não disponível ou texto para copiar é nulo.");
      setCopyFeedback({ type, success: false });
      setTimeout(() => setCopyFeedback(null), 2000);
      return;
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyFeedback({ type, success: true });
      setTimeout(() => setCopyFeedback(null), 2000);
    }).catch(err => {
      console.error(`Erro ao copiar ${type}:`, err);
      setCopyFeedback({ type, success: false });
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  }, []);
  
  if (status === "loading" || (status === "unauthenticated" && router)) {
    return (
      <div className="min-h-screen bg-brand-light p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {status === "loading" && (
            <>
              <div className="flex justify-between items-center h-16 mb-10">
                <SkeletonLoader className="h-8 w-24 rounded-md" />
                <SkeletonLoader className="h-10 w-10 rounded-full" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
                <div className="lg:col-span-2 space-y-10">
                  <SkeletonLoader className="h-40 rounded-xl" />
                  <SkeletonLoader className="h-60 rounded-xl" />
                  <SkeletonLoader className="h-52 rounded-xl" />
                </div>
                <div className="lg:col-span-1 space-y-8">
                  <SkeletonLoader className="h-72 rounded-xl" />
                  <SkeletonLoader className="h-36 rounded-xl" />
                </div>
              </div>
            </>
          )}
          {status === "unauthenticated" && (
            <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
              <p className="text-gray-500 font-medium">Redirecionando para login...</p>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (!user) {
    return ( <div className="min-h-screen flex items-center justify-center bg-brand-light"><p className="text-red-500 font-medium">Erro ao carregar dados do usuário.</p></div> );
  }

  const planStatus = user.planStatus ?? "inactive";
  const canAccessFeatures = planStatus === "active" || planStatus === "non_renewing";
  
  const getStatusInfo = () => {
    switch (planStatus) {
      case 'active': return { text: 'Plano Ativo', colorClasses: 'text-green-700 bg-green-100 border-green-300', icon: <FaCheckCircle className="w-4 h-4"/> };
      case 'non_renewing': return { text: 'Plano Ativo (não-renovável)', colorClasses: 'text-green-700 bg-green-100 border-green-300', icon: <FaCheckCircle className="w-4 h-4"/> };
      case 'pending': return { text: 'Pagamento Pendente', colorClasses: 'text-yellow-700 bg-yellow-100 border-yellow-300', icon: <FaClock className="w-4 h-4"/> };
      default: return { text: 'Plano Inativo', colorClasses: 'text-brand-red bg-red-100 border-red-300', icon: <FaTimesCircle className="w-4 h-4"/> };
    }
  };
  const statusInfo = getStatusInfo();

  const showPlan = planStatus !== 'active';
  const defaultCurrency = ((user?.stripeAccountDefaultCurrency ?? 'BRL').toUpperCase() === 'USD') ? 'USD' : 'BRL';
  const canRedeem = Object.values((user as any)?.affiliateBalances || {}).some((c: any) => c > 0);

  const videoGuidesData: VideoData[] = [
    { id: 'intro-plataforma', title: 'Bem-vindo à Data2Content!', youtubeVideoId: 'BHACKCNDMW8' },
    { id: 'upload-metrics-guide', title: 'Como Enviar suas Métricas', youtubeVideoId: '_dpB7R6csAE' },
    { id: 'afiliados-explainer', title: 'Entenda o Programa de Afiliados', youtubeVideoId: 'I7hJJkF00hU' },
    { id: 'whatsapp-mobi', title: 'Conectando ao Mobi no WhatsApp', youtubeVideoId: 'iG9CE55wbtY' },
    { id: 'seguranca-dados', title: 'Como Cuidamos dos Seus Dados', youtubeVideoId: 'eX2qFMC8cFo' },
  ];

  const scrollToVideoGuide = (videoId: string) => {
    const guideSection = document.getElementById('video-guides-section');
    if (guideSection) {
      guideSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (swiperRef.current && (swiperRef.current as any).slides) { 
        const slideIndex = videoGuidesData.findIndex(video => video.id === videoId);
        if (slideIndex !== -1) {
          setTimeout(() => {
            if (swiperRef.current && typeof (swiperRef.current as any).slideTo === 'function') {
              (swiperRef.current as any).slideTo(slideIndex);
            } else {
              console.warn("Swiper API `slideTo` não encontrada na referência.");
            }
          }, 300);
        } else {
          console.warn(`Vídeo com ID "${videoId}" não encontrado nos dados.`);
        }
      } else {
        console.warn("Referência do Swiper (swiperRef.current) ou swiperRef.current.slides não encontrada.");
      }
    } else {
      console.warn("Seção #video-guides-section não encontrada para scroll.");
    }
  };

  const affiliateCardProps = {
    user,
    affiliateCode,
    fullAffiliateLink,
    commissionLog,
    isLoadingCommissionLog,
    commissionLogError,
    copyFeedback,
    handleCopyToClipboard,
    setShowPaymentModal,
    canRedeem,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
      {/* --- COLUNA PRINCIPAL (ESQUERDA) --- */}
      <div className="lg:col-span-2 space-y-12">
        <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={0}>
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border-t-4 border-brand-pink flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              {user?.image ? ( <Image src={user.image} alt="Avatar" width={88} height={88} className="rounded-full border-4 border-white shadow-md" /> ) : ( <span className="inline-block h-22 w-22 overflow-hidden rounded-full bg-gray-100 border-4 border-white shadow-md"><FaUserCircle className="h-full w-full text-gray-300" /></span> )}
            </div>
            <div className="flex-grow text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-semibold text-brand-dark mb-2">Bem-vindo(a), {user?.name ?? 'Usuário'}!</h1>
              <p className="text-base text-gray-600 font-light mb-4">Pronto para otimizar sua carreira de criador?</p>
              {!canAccessFeatures && (
                <StepIndicator
                  planActive={planStatus === 'pending'}
                  instagramConnected={!!user.isInstagramConnected}
                  whatsappConnected={!!user.whatsappVerified}
                />
              )}
              {agencyName && !canAccessFeatures && (
                <p className="mt-1 text-green-700 bg-green-50 border border-green-200 inline-block px-3 py-1 rounded text-sm">
                  Convite da agência {agencyName} ativo! Desconto aplicado.
                </p>
              )}
              <div className="flex items-center flex-wrap gap-2 justify-center sm:justify-start">
                <div className={`inline-flex items-center gap-2 text-sm mb-1 px-4 py-1.5 rounded-full border ${statusInfo.colorClasses}`}> {statusInfo.icon} <span className="font-semibold">{statusInfo.text}</span> {planStatus === 'active' && user?.planExpiresAt && ( <span className="hidden md:inline text-xs opacity-80 ml-2">(Expira em {new Date(user.planExpiresAt).toLocaleDateString("pt-BR")})</span> )} </div>
                {!canAccessFeatures && (
                  <button
                    onClick={scrollToPlanCard}
                    className="text-xs bg-brand-pink text-white px-4 py-1.5 rounded-full hover:opacity-90 font-semibold transition-default align-middle"
                  >
                    Fazer Upgrade
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section id="video-guides-section" variants={cardVariants} initial="hidden" animate="visible" custom={0.5}>
          <div className="flex items-center gap-3 mb-5 ml-1"> <FaVideo className="w-5 h-5 text-brand-pink"/> <h2 className="text-xl font-semibold text-brand-dark">Guias Rápidos da Plataforma</h2> </div>
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg"> <VideoCarousel videos={videoGuidesData} swiperRef={swiperRef} /> </div>
        </motion.section>

        {showPlan && (
          <PlanCardPro
            id="plan-card"
            defaultCurrency={defaultCurrency}
            className="w-full"
          />
        )}

        <InstagramConnectCard
          canAccessFeatures={canAccessFeatures}
          onActionRedirect={scrollToPlanCard}
          showToast={showToastMessage}
        />

        <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={0.7}>
          <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Consultor IA Mobi (WhatsApp)</h2>
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
            <WhatsAppPanel
              userId={userId}
              canAccessFeatures={canAccessFeatures}
              onActionRedirect={scrollToPlanCard}
              showToast={showToastMessage}
            />
          </div>
        </motion.section>
        
        <div className="lg:hidden">
          {process.env.NEXT_PUBLIC_AFFILIATES_V2 === 'on' ? (
            <div className="space-y-4">
              <AffiliateCard />
            </div>
          ) : (
            <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={0.8}>
              <AffiliateCardContent {...affiliateCardProps} />
            </motion.section>
          )}
        </div>

        <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={1}>
          <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Suas Métricas</h2>
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
            <UploadMetrics
              canAccessFeatures={canAccessFeatures}
              userId={userId}
              onNeedHelp={() => scrollToVideoGuide('upload-metrics-guide')}
              onActionRedirect={scrollToPlanCard}
              showToast={showToastMessage}
            />
          </div>
        </motion.section>

        <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={1.2}>
          <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Suas Parcerias</h2>
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
            <AdDealForm
              userId={userId}
              canAccessFeatures={canAccessFeatures}
              onActionRedirect={scrollToPlanCard}
              showToast={showToastMessage}
            />
          </div>
        </motion.section>

        {process.env.NEXT_PUBLIC_AFFILIATES_V2 === 'on' && (
          <section className="mt-6">
            <AffiliateHistory />
          </section>
        )}
      </div>

      {/* --- COLUNA DA DIREITA (SIDEBAR) --- */}
      <div className="hidden lg:block lg:col-span-1 space-y-8">
        {process.env.NEXT_PUBLIC_AFFILIATES_V2 === 'on' ? (
          <section className="space-y-4">
            <AffiliateCard />
          </section>
        ) : (
          <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={0.5}>
            <AffiliateCardContent {...affiliateCardProps} />
          </motion.section>
        )}

        <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={3}>
          <div className="bg-brand-light p-6 rounded-xl border border-gray-200 text-center hover:shadow-md transition-shadow flex flex-col items-center">
            <div className="p-3 bg-brand-pink/10 rounded-full text-brand-pink mb-4">
              <FaEnvelope className="w-6 h-6"/>
            </div>
            <h3 className="font-semibold text-brand-dark mb-2 text-lg">Precisa de Ajuda?</h3>
            <p className="text-sm text-gray-600 font-light mb-5 leading-relaxed">
              Entre em contacto connosco por email para qualquer questão ou suporte.
            </p>
            <a 
              href="mailto:arthur@data2content.ai"
              className="text-sm text-brand-pink hover:underline font-semibold mt-auto pt-2"
            >
              Contactar Suporte por Email
            </a>
          </div>
        </motion.section>
      </div>
    </div>
  );
}