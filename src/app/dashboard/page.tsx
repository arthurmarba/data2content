 // src/app/dashboard/page.tsx
 "use client";

 import React, { useState, useEffect, useCallback, Fragment, useRef } from 'react';
 import { useSession, signIn, signOut } from 'next-auth/react';
 import { useRouter } from "next/navigation";
 import Image from 'next/image';
 import Head from 'next/head';
 import Link from 'next/link';
 // Usando React Icons (Font Awesome)
 import { FaCopy, FaCheckCircle, FaClock, FaTimesCircle, FaLock, FaTrophy, FaGift, FaMoneyBillWave, FaWhatsapp, FaUpload, FaCog, FaQuestionCircle, FaSignOutAlt, FaUserCircle, FaDollarSign, FaEllipsisV, FaBullhorn, FaVideo, FaSpinner, FaExclamationCircle, FaInfoCircle, FaHandshake, FaFileContract, FaShieldAlt, FaTrashAlt, FaEnvelope, FaCreditCard } from 'react-icons/fa';
 // Framer Motion para animações
 import { motion, AnimatePresence } from "framer-motion";

 // --- Imports dos seus Componentes Reais ---
 import PaymentPanel from './PaymentPanel';
 import UploadMetrics from './UploadMetrics';
 import WhatsAppPanel from './WhatsAppPanel';
 import PaymentModal from './PaymentModal';
 import AdDealForm from './AdDealForm';
 import VideoCarousel from './VideoCarousel';
 import InstagramConnectCard from './InstagramConnectCard';

 // --- FIM IMPORTS ---


 // --- INTERFACES ---
 interface ExtendedUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  planStatus?: string;
  planExpiresAt?: string | null;
  affiliateCode?: string | null;
  affiliateBalance?: number;
  affiliateRank?: number;
  affiliateInvites?: number;
  provider?: string;
 }

 interface VideoData {
    id: string;
    title: string;
    youtubeVideoId: string;
 }

 interface CommissionLogItem {
  date: string;
  amount: number;
  description: string;
  sourcePaymentId?: string;
  referredUserId?: string;
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
  redeemMessage: string;
  handleRedeemBalance: (userIdFromFunc: string | undefined) => void;
  setShowPaymentModal: (show: boolean) => void;
  canRedeem: boolean;
  userId: string;
}> = ({
  user,
  affiliateCode,
  fullAffiliateLink,
  commissionLog,
  isLoadingCommissionLog,
  commissionLogError,
  copyFeedback,
  handleCopyToClipboard,
  redeemMessage,
  handleRedeemBalance,
  setShowPaymentModal,
  canRedeem,
  userId
}) => {
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
          <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Saldo Disponível</span>
          <span className="font-bold text-3xl text-green-600 block">R$ {(user?.affiliateBalance ?? 0).toFixed(2)}</span>
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
            {commissionLog.map((logItem, index) => (
              <div key={logItem.sourcePaymentId || `commission-${index}`} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200/80 text-xs hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-700">{new Date(logItem.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span className="font-semibold text-green-600 text-sm">+ {logItem.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <p className="text-gray-600 mt-1 text-[11px] leading-relaxed">{logItem.description}</p>
              </div>
            ))}
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
          <button onClick={() => handleRedeemBalance(userId)} className="flex-1 px-4 py-2.5 bg-brand-pink text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-default disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2" disabled={!canRedeem || redeemMessage === "Processando..."}>
            <FaMoneyBillWave className="w-4 h-4"/> {redeemMessage === "Processando..." ? "Processando..." : "Resgatar Saldo"}
          </button>
          <button onClick={() => setShowPaymentModal(true)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-default border border-gray-200 flex items-center justify-center gap-2">
            <FaCog className="w-4 h-4"/> Dados Pagamento
          </button>
        </div>
        <AnimatePresence>
          {redeemMessage && redeemMessage !== "Processando..." && ( <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`text-xs text-center mt-3 font-medium ${redeemMessage.startsWith('Erro:') ? 'text-brand-red' : 'text-green-600'}`}> {redeemMessage} </motion.p> )}
        </AnimatePresence>
      </div>
    </div>
  );
};
 // --- FIM COMPONENTE FUNCIONAL PARA O CARD DE AFILIADOS ---


 export default function MainDashboard() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ type: 'code' | 'link'; success: boolean } | null>(null);
  const [redeemMessage, setRedeemMessage] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const swiperRef = useRef<any>(null);
  const [fullAffiliateLink, setFullAffiliateLink] = useState<string | null>(null);

  const [commissionLog, setCommissionLog] = useState<CommissionLogItem[]>([]);
  const [isLoadingCommissionLog, setIsLoadingCommissionLog] = useState(true);
  const [commissionLogError, setCommissionLogError] = useState<string | null>(null);

  const redirectToPaymentPanel = useCallback(() => {
    const paymentSection = document.getElementById('payment-section');
    if (paymentSection) {
      paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      console.warn("Seção #payment-section não encontrada para scroll. Verifique o ID ou implemente a navegação.");
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

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
   };

  const user = session?.user as ExtendedUser | undefined;
  const affiliateCode = user?.affiliateCode ?? null; // affiliateCode é string | null
  const userId = user?.id ?? "";

  useEffect(() => {
    if (typeof window !== 'undefined' && affiliateCode) {
      const origin = window.location.origin;
      setFullAffiliateLink(`${origin}/?ref=${affiliateCode}`);
    } else {
      setFullAffiliateLink(null);
    }
  }, [affiliateCode]);

  useEffect(() => {
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
          const data: CommissionLogItem[] = await response.json();
          setCommissionLog(data);
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


  const handleRedeemBalance = useCallback(async (userIdFromFunc: string | undefined) => {
     if (!userIdFromFunc) { setRedeemMessage("Erro: ID do usuário não encontrado."); return; }
     setRedeemMessage("Processando...");
     try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setRedeemMessage("Resgate solicitado com sucesso! Seu saldo será atualizado em breve.");
        await updateSession(); 
        setTimeout(() => setRedeemMessage(""), 5000);
    } catch (error) {
        console.error("Erro ao solicitar resgate:", error);
        setRedeemMessage(`Erro ao solicitar resgate: ${error instanceof Error ? error.message : String(error)}`);
        setTimeout(() => setRedeemMessage(""), 5000);
    }
   }, [updateSession]);

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
                {/* ... Skeleton Loader ... */}
            </div>
        </div>
     );
  }
  if (!user) {
      return ( <div className="min-h-screen flex items-center justify-center bg-brand-light"><p className="text-red-500 font-medium">Erro ao carregar dados do usuário.</p></div> );
  }

  const planStatus = user.planStatus ?? "inactive";
  const canAccessFeatures = planStatus === "active";
  
  const getStatusInfo = () => {
      switch (planStatus) {
      case 'active': return { text: 'Plano Ativo', colorClasses: 'text-green-700 bg-green-100 border-green-300', icon: <FaCheckCircle className="w-4 h-4"/> };
      case 'pending': return { text: 'Pagamento Pendente', colorClasses: 'text-yellow-700 bg-yellow-100 border-yellow-300', icon: <FaClock className="w-4 h-4"/> };
      default: return { text: 'Plano Inativo', colorClasses: 'text-brand-red bg-red-100 border-red-300', icon: <FaTimesCircle className="w-4 h-4"/> };
      }
  };
  const statusInfo = getStatusInfo(); 
  
  const paymentPanelUserProps = {
    planStatus: user.planStatus,
    planExpiresAt: user.planExpiresAt,
    affiliateBalance: user.affiliateBalance,
    // --- CORREÇÃO APLICADA AQUI ---
    affiliateCode: affiliateCode === null ? undefined : affiliateCode,
  };
  const canRedeem = (user.affiliateBalance ?? 0) > 0;

  const videoGuidesData: VideoData[] = [
    { id: 'intro-plataforma', title: 'Bem-vindo à Data2Content!', youtubeVideoId: 'BHACKCNDMW8' },
    { id: 'upload-metrics-guide', title: 'Como Enviar suas Métricas', youtubeVideoId: '_dpB7R6csAE' },
    { id: 'afiliados-explainer', title: 'Entenda o Programa de Afiliados', youtubeVideoId: 'I7hJJkF00hU' },
    { id: 'whatsapp-tuca', title: 'Conectando ao Tuca no WhatsApp', youtubeVideoId: 'iG9CE55wbtY' },
    { id: 'seguranca-dados', title: 'Como Cuidamos dos Seus Dados', youtubeVideoId: 'eX2qFMC8cFo' },
  ];

  const scrollToVideoGuide = (videoId: string) => {
    const guideSection = document.getElementById('video-guides-section');
    if (guideSection) {
        guideSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (swiperRef.current && swiperRef.current.slides) { 
            const slideIndex = videoGuidesData.findIndex(video => video.id === videoId);
            if (slideIndex !== -1) {
                setTimeout(() => {
                    if (swiperRef.current && typeof swiperRef.current.slideTo === 'function') {
                        swiperRef.current.slideTo(slideIndex);
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

  // Props para o AffiliateCardContent
  const affiliateCardProps = {
    user,
    affiliateCode,
    fullAffiliateLink,
    commissionLog,
    isLoadingCommissionLog,
    commissionLogError,
    copyFeedback,
    handleCopyToClipboard,
    redeemMessage,
    handleRedeemBalance,
    setShowPaymentModal,
    canRedeem,
    userId
  };

  return (
    <>
      <Head><title>Dashboard - Data2Content</title></Head>
      <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} userId={userId} />

      <div className="min-h-screen bg-brand-light">
        <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
            {/* ... Seu código do Header ... */}
        </header>

        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
            {/* --- COLUNA PRINCIPAL (ESQUERDA) --- */}
            <div className="lg:col-span-2 space-y-12"> 
              {/* Card de Boas-Vindas */}
               <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={0}>
                 <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border-t-4 border-brand-pink flex flex-col sm:flex-row items-center gap-6">
                     <div className="flex-shrink-0">
                        {user?.image ? ( <Image src={user.image} alt="Avatar" width={88} height={88} className="rounded-full border-4 border-white shadow-md" /> ) : ( <span className="inline-block h-22 w-22 overflow-hidden rounded-full bg-gray-100 border-4 border-white shadow-md"><FaUserCircle className="h-full w-full text-gray-300" /></span> )}
                     </div>
                     <div className="flex-grow text-center sm:text-left">
                        <h1 className="text-2xl sm:text-3xl font-semibold text-brand-dark mb-2">Bem-vindo(a), {user?.name ?? 'Usuário'}!</h1>
                        <p className="text-base text-gray-600 font-light mb-4">Pronto para otimizar sua carreira de criador?</p>
                        <div className="flex items-center flex-wrap gap-2 justify-center sm:justify-start">
                            <div className={`inline-flex items-center gap-2 text-sm mb-1 px-4 py-1.5 rounded-full border ${statusInfo.colorClasses}`}> {statusInfo.icon} <span className="font-semibold">{statusInfo.text}</span> {planStatus === 'active' && user?.planExpiresAt && ( <span className="hidden md:inline text-xs opacity-80 ml-2">(Expira em {new Date(user.planExpiresAt).toLocaleDateString("pt-BR")})</span> )} </div>
                            {!canAccessFeatures && (
                              <button
                                onClick={redirectToPaymentPanel}
                                className="text-xs bg-brand-pink text-white px-4 py-1.5 rounded-full hover:opacity-90 font-semibold transition-default align-middle"
                              >
                                Fazer Upgrade
                              </button>
                            )}
                        </div>
                     </div>
                 </div>
              </motion.section>

              {/* Guias Rápidos da Plataforma (VideoCarousel) */}
              <motion.section id="video-guides-section" variants={cardVariants} initial="hidden" animate="visible" custom={0.5}>
                  <div className="flex items-center gap-3 mb-5 ml-1"> <FaVideo className="w-5 h-5 text-brand-pink"/> <h2 className="text-xl font-semibold text-brand-dark">Guias Rápidos da Plataforma</h2> </div>
                   <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg"> <VideoCarousel videos={videoGuidesData} swiperRef={swiperRef} /> </div>
               </motion.section>

              {/* Card de Afiliados para MOBILE */}
              <div className="lg:hidden">
                <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={0.6}>
                    <AffiliateCardContent {...affiliateCardProps} />
                </motion.section>
              </div>

              {/* Consultor IA Tuca (WhatsApp) */}
              <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={1}>
                  <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Consultor IA Tuca (WhatsApp)</h2>
                  <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                    <WhatsAppPanel
                        userId={userId}
                        canAccessFeatures={canAccessFeatures}
                        onActionRedirect={redirectToPaymentPanel}
                        showToast={showToastMessage}
                    />
                  </div>
              </motion.section>

              {/* Automação de Métricas (InstagramConnectCard) */}
              <InstagramConnectCard
                  canAccessFeatures={canAccessFeatures}
                  onActionRedirect={redirectToPaymentPanel}
                  showToast={showToastMessage}
              />

              {/* Suas Métricas (UploadMetrics) */}
              <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={2}>
                  <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Suas Métricas</h2>
                   <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                        <UploadMetrics
                            canAccessFeatures={canAccessFeatures}
                            userId={userId}
                            onNeedHelp={() => scrollToVideoGuide('upload-metrics-guide')}
                            onActionRedirect={redirectToPaymentPanel}
                            showToast={showToastMessage}
                        />
                   </div>
               </motion.section>

               {/* Suas Parcerias (AdDealForm) */}
               <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={3}>
                   <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Suas Parcerias</h2>
                   <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                        <AdDealForm
                            userId={userId}
                            canAccessFeatures={canAccessFeatures}
                            onActionRedirect={redirectToPaymentPanel}
                            showToast={showToastMessage}
                        />
                   </div>
               </motion.section>

               {/* Seção de Pagamento (PaymentPanel) */}
               {!canAccessFeatures && (
                  <motion.section id="payment-section" variants={cardVariants} initial="hidden" animate="visible" custom={4} className="animated-border-card">
                     <div className="card-content bg-white p-6 sm:p-8 rounded-xl">
                         <PaymentPanel user={paymentPanelUserProps} />
                    </div>
                  </motion.section>
              )}
            </div>

            {/* --- COLUNA DA DIREITA (SIDEBAR) */}
            <div className="hidden lg:block lg:col-span-1 space-y-8">
              {/* Card de Afiliados para DESKTOP */}
              <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={0.5}>
                 <AffiliateCardContent {...affiliateCardProps} />
              </motion.section>

              {/* Seção "Precisa de Ajuda?" */}
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
        </main>

        <footer className="text-center mt-20 py-10 border-t border-gray-200 text-xs text-gray-500 font-light">
             © {new Date().getFullYear()} Data2Content. Todos os direitos reservados.
        </footer>
      </div>
       <style jsx global>{`
        /* ... (Seus estilos globais) ... */
      `}</style>
    </>
  );
}
