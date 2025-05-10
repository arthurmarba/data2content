 // src/app/dashboard/page.tsx
 "use client";

 import React, { useState, useEffect, useCallback, Fragment, useRef } from 'react';
 import { useSession, signIn, signOut } from 'next-auth/react';
 import { useRouter } from "next/navigation";
 import Image from 'next/image';
 import Head from 'next/head';
 // Usando React Icons (Font Awesome)
 import { FaCopy, FaCheckCircle, FaClock, FaTimesCircle, FaLock, FaTrophy, FaGift, FaMoneyBillWave, FaWhatsapp, FaUpload, FaCog, FaQuestionCircle, FaSignOutAlt, FaUserCircle, FaDollarSign, FaEllipsisV, FaBullhorn, FaVideo, FaSpinner, FaExclamationCircle } from 'react-icons/fa'; // FaSpinner, FaExclamationCircle adicionados
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

 // --- Interface para o Log de Comissão (Frontend) ---
 interface CommissionLogItem {
  date: string; // Recebido como string da API, convertido para Date para uso
  amount: number;
  description: string;
  sourcePaymentId?: string; // Opcional, para referência futura
  referredUserId?: string; // Opcional, para referência futura
 }


 // --- COMPONENTE SKELETON LOADER (Refinado) ---
 const SkeletonLoader = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`}></div>
 );

 // --- COMPONENTE PRINCIPAL DASHBOARD ---
 export default function MainDashboard() {
  // --- Hooks Chamados no Nível Superior ---
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ type: 'code' | 'link'; success: boolean } | null>(null);
  const [redeemMessage, setRedeemMessage] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const swiperRef = useRef<any>(null);
  const [fullAffiliateLink, setFullAffiliateLink] = useState<string | null>(null);

  // --- Estados para o Log de Comissões ---
  const [commissionLog, setCommissionLog] = useState<CommissionLogItem[]>([]);
  const [isLoadingCommissionLog, setIsLoadingCommissionLog] = useState(true);
  const [commissionLogError, setCommissionLogError] = useState<string | null>(null);


  // --- useEffect para lidar com status da sessão ---
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/');
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
  const affiliateCode = user?.affiliateCode ?? null;
  const userId = user?.id ?? "";

  // --- useEffect para gerar o link de afiliado completo ---
  useEffect(() => {
    if (typeof window !== 'undefined' && affiliateCode) {
      const origin = window.location.origin;
      setFullAffiliateLink(`${origin}/?ref=${affiliateCode}`);
    } else {
      setFullAffiliateLink(null);
    }
  }, [affiliateCode]);

  // --- useEffect para buscar o log de comissões ---
  useEffect(() => {
    // Só busca o log se o usuário estiver autenticado e tiver um ID
    if (status === "authenticated" && userId) {
      const fetchLog = async () => {
        setIsLoadingCommissionLog(true);
        setCommissionLogError(null);
        try {
          // A API /api/affiliate/commission-log usa a sessão para identificar o usuário
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
  }, [status, userId]); // Depende do status da sessão e do userId para re-executar


  const handleRedeemBalance = useCallback(async (userIdFromFunc: string | undefined) => {
     if (!userIdFromFunc) { setRedeemMessage("Erro: ID do usuário não encontrado."); return; }
     setRedeemMessage("Processando...");
     try {
        // Simulação de chamada à API de resgate
        await new Promise(resolve => setTimeout(resolve, 1500));
        setRedeemMessage("Resgate solicitado com sucesso! Seu saldo será atualizado em breve.");
        
        // Força a atualização da sessão para refletir o novo saldo
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


  if (status === "loading" || status === "unauthenticated") {
    // Skeleton loader JSX (mantido como no seu código original)
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
  if (!user) { // Checagem do usuário após o status de loading/unauthenticated
      return ( <div className="min-h-screen flex items-center justify-center bg-brand-light"><p className="text-red-500 font-medium">Erro ao carregar dados do usuário. Tente recarregar a página.</p></div> );
  }

  // Dados do Usuário Autenticado (restante)
  const planStatus = user.planStatus ?? "inactive";
  const userImage = user.image ?? null;
  const userName = user.name ?? 'Usuário';
  const affiliateBalance = user.affiliateBalance ?? 0;
  const affiliateRank = user.affiliateRank ?? 1;
  const affiliateInvites = user.affiliateInvites ?? 0;
  const planExpiresAt = user.planExpiresAt ?? null;
  const canAccessFeatures = planStatus === "active";
  
  const getStatusInfo = () => {
     switch (planStatus) {
      case 'active': return { text: 'Plano Ativo', colorClasses: 'text-green-700 bg-green-100 border-green-300', icon: <FaCheckCircle className="w-4 h-4"/> };
      case 'pending': return { text: 'Pagamento Pendente', colorClasses: 'text-yellow-700 bg-yellow-100 border-yellow-300', icon: <FaClock className="w-4 h-4"/> };
      default: return { text: 'Plano Inativo', colorClasses: 'text-brand-red bg-red-100 border-red-300', icon: <FaTimesCircle className="w-4 h-4"/> };
    }
  };
  const statusInfo = getStatusInfo();
  const canRedeem = affiliateBalance > 0;

  const paymentPanelUserProps = {
    planStatus: user.planStatus,
    planExpiresAt: user.planExpiresAt,
    affiliateBalance: user.affiliateBalance,
    affiliateCode: affiliateCode === null ? undefined : affiliateCode,
  };

  const scrollToSection = (sectionId: string) => { /* ... (mantido) ... */ };
  const scrollToVideoGuide = (videoId: string) => { /* ... (mantido) ... */ };
  const videoGuidesData: VideoData[] = [ /* ... (mantido) ... */ ];


  return (
    <>
      <Head><title>Dashboard - Data2Content</title></Head>
      <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} userId={userId} />

      <div className="min-h-screen bg-brand-light">
        <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
            {/* Header JSX mantido como no seu código original */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <a href="/dashboard" className="flex-shrink-0 flex items-center gap-2 group">
                        <span className="text-brand-pink text-3xl font-bold group-hover:opacity-80 transition-opacity">[2]</span>
                    </a>
                    <div className="relative">
                        <button
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className="p-2 rounded-full text-gray-500 hover:text-brand-dark hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink transition-colors"
                            aria-expanded={isUserMenuOpen} aria-haspopup="true" aria-label="Menu de ações"
                        >
                           {userImage ? (
                                <Image src={userImage} alt="Avatar" width={32} height={32} className="rounded-full" />
                           ) : (
                                <FaUserCircle className="w-6 h-6" />
                           )}
                        </button>
                        <AnimatePresence>
                            {isUserMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                    className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                                    onMouseLeave={() => setIsUserMenuOpen(false)}
                                >
                                    <div className="px-4 py-3 border-b border-gray-100">
                                        <p className="text-sm font-semibold text-brand-dark truncate">{userName}</p>
                                        <p className="text-xs text-gray-500 truncate">{user.email || 'Sem email'}</p>
                                    </div>
                                    <div className="py-1">
                                         <a href="/ajuda" className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5">
                                            <FaQuestionCircle className="w-4 h-4 text-gray-400"/> Ajuda
                                        </a>
                                    </div>
                                    <div className="py-1 border-t border-gray-100">
                                        <button
                                            onClick={() => signOut({ callbackUrl: '/' })}
                                            className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-brand-red transition-colors rounded-md mx-1 my-0.5"
                                        >
                                            <FaSignOutAlt className="w-4 h-4"/> Sair
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>

        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">

            <div className="lg:col-span-2 space-y-12">
              {/* Card Boas Vindas JSX mantido como no seu código original */}
              <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={0}>
                 <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border-t-4 border-brand-pink flex flex-col sm:flex-row items-center gap-6">
                     <div className="flex-shrink-0">
                        {userImage ? ( <Image src={userImage} alt="Avatar" width={88} height={88} className="rounded-full border-4 border-white shadow-md" /> ) : ( <span className="inline-block h-22 w-22 overflow-hidden rounded-full bg-gray-100 border-4 border-white shadow-md"><FaUserCircle className="h-full w-full text-gray-300" /></span> )}
                     </div>
                     <div className="flex-grow text-center sm:text-left">
                        <h1 className="text-2xl sm:text-3xl font-semibold text-brand-dark mb-2">Bem-vindo(a), {userName}!</h1>
                        <p className="text-base text-gray-600 font-light mb-4">Pronto para otimizar sua carreira de criador?</p>
                        <div className="flex items-center flex-wrap gap-2 justify-center sm:justify-start">
                            <div className={`inline-flex items-center gap-2 text-sm mb-1 px-4 py-1.5 rounded-full border ${statusInfo.colorClasses}`}> {statusInfo.icon} <span className="font-semibold">{statusInfo.text}</span> {planStatus === 'active' && planExpiresAt && ( <span className="hidden md:inline text-xs opacity-80 ml-2">(Expira em {new Date(planExpiresAt).toLocaleDateString("pt-BR")})</span> )} </div>
                            {!canAccessFeatures && ( <button onClick={() => scrollToSection('payment-section')} className="text-xs bg-brand-pink text-white px-4 py-1.5 rounded-full hover:opacity-90 font-semibold transition-default align-middle"> Fazer Upgrade </button> )}
                        </div>
                     </div>
                 </div>
              </motion.section>
              {/* Outros cards da coluna principal (Guias, Tuca, Instagram, Métricas, Parcerias, Pagamento) mantidos como no seu código original */}
              <motion.section id="video-guides-section" variants={cardVariants} initial="hidden" animate="visible" custom={0.5}>
                  <div className="flex items-center gap-3 mb-5 ml-1"> <FaVideo className="w-5 h-5 text-brand-pink"/> <h2 className="text-xl font-semibold text-brand-dark">Guias Rápidos da Plataforma</h2> </div>
                   <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg"> <VideoCarousel videos={videoGuidesData} swiperRef={swiperRef} /> </div>
               </motion.section>

              <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={1}>
                  <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Consultor IA Tuca (WhatsApp)</h2>
                  {canAccessFeatures ? ( <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg"> <WhatsAppPanel userId={userId} canAccessFeatures={canAccessFeatures} /> </div> ) : ( <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg relative overflow-hidden border border-gray-200"> <p className="text-center text-gray-500">Assine um plano para liberar o Tuca.</p> </div> )}
              </motion.section>

              <InstagramConnectCard />

              <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={2}>
                  <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Suas Métricas</h2>
                   <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                        <div className="flex items-center gap-4 mb-4"> <div className="p-3 bg-brand-light rounded-full text-brand-dark"><FaUpload className="w-5 h-5"/></div> <h3 className="font-semibold text-lg text-brand-dark">Upload de Métricas</h3> </div>
                       {canAccessFeatures ? ( <p className="text-base text-gray-700 font-light mb-6 leading-relaxed">Envie seus dados mais recentes do Instagram para que o Tuca possa fazer análises precisas. <button onClick={() => scrollToVideoGuide('upload-metrics-guide')} className="text-brand-pink hover:underline text-xs font-medium">(Ver Guia)</button></p> ) : ( <p className="text-base text-gray-700 font-light mb-6 leading-relaxed"> <span className="font-semibold text-brand-red"><FaLock className="inline w-3 h-3 mr-1 mb-0.5"/> Recurso bloqueado.</span> Assine um plano para poder enviar seus prints e liberar esta funcionalidade. </p> )}
                       <UploadMetrics canAccessFeatures={canAccessFeatures} userId={userId} onNeedHelp={() => scrollToVideoGuide('upload-metrics-guide')} />
                   </div>
               </motion.section>

               <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={3}>
                   <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Suas Parcerias</h2>
                   <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                        <div className="flex items-center gap-4 mb-4"> <div className="p-3 bg-blue-100 rounded-full text-blue-600"><FaBullhorn className="w-5 h-5"/></div> <h3 className="font-semibold text-lg text-brand-dark">Registar Nova Publicidade</h3> </div>
                       {canAccessFeatures ? ( <> <p className="text-base text-gray-700 font-light mb-6 leading-relaxed"> Registe os detalhes das suas parcerias para que o Tuca possa analisar seu faturamento e valor de mercado. </p> <AdDealForm userId={userId} /> </> ) : ( <p className="text-base text-gray-700 font-light mb-6 leading-relaxed"> <span className="font-semibold text-brand-red"><FaLock className="inline w-3 h-3 mr-1 mb-0.5"/> Recurso bloqueado.</span> Assine um plano para poder registar e analisar suas parcerias publicitárias. </p> )}
                   </div>
               </motion.section>

               {!canAccessFeatures && (
                  <motion.section id="payment-section" variants={cardVariants} initial="hidden" animate="visible" custom={4} className="animated-border-card">
                     <div className="card-content bg-white p-6 sm:p-8 rounded-xl">
                         <PaymentPanel user={paymentPanelUserProps} />
                    </div>
                  </motion.section>
              )}
            </div>

            <div className="lg:col-span-1 space-y-8">
              <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={0.5}>
                 <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-brand-pink">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-brand-dark">Programa de Afiliados</h2>
                        <div className="flex items-center gap-1 text-yellow-800 bg-yellow-100 px-2.5 py-1 rounded-full border border-yellow-200">
                            <FaTrophy className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold">Rank {affiliateRank}</span>
                        </div>
                     </div>
                    <div className="space-y-5 text-sm">
                         <div className="text-center p-4 bg-brand-light rounded-lg border border-gray-200">
                            <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Saldo Disponível</span>
                            <span className="font-bold text-3xl text-green-600 block">R$ {affiliateBalance.toFixed(2)}</span>
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

                        {/* --- SEÇÃO HISTÓRICO DE COMISSÕES --- */}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Histórico de Comissões Recebidas</h3>
                            {isLoadingCommissionLog && (
                                <div className="text-xs text-gray-500 text-center py-4 flex items-center justify-center gap-2">
                                <FaSpinner className="animate-spin w-4 h-4" />
                                <span>Carregando histórico...</span>
                                </div>
                            )}
                            {commissionLogError && (
                                <div className="text-xs text-red-500 text-center py-3 flex items-center justify-center gap-2 bg-red-50 p-2 rounded-md border border-red-200">
                                <FaExclamationCircle className="w-4 h-4"/>
                                <span>{commissionLogError}</span>
                                </div>
                            )}
                            {!isLoadingCommissionLog && !commissionLogError && commissionLog.length === 0 && (
                                <p className="text-xs text-gray-500 text-center py-3 italic">Nenhuma comissão recebida ainda.</p>
                            )}
                            {!isLoadingCommissionLog && !commissionLogError && commissionLog.length > 0 && (
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {commissionLog.map((logItem, index) => (
                                    <div key={logItem.sourcePaymentId || `commission-${index}`} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200/80 text-xs hover:shadow-sm transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <span className="font-medium text-gray-700">
                                        {new Date(logItem.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </span>
                                        <span className="font-semibold text-green-600 text-sm">
                                        + {logItem.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 mt-1 text-[11px] leading-relaxed">{logItem.description}</p>
                                    </div>
                                ))}
                                </div>
                            )}
                        </div>
                        {/* --- FIM: HISTÓRICO DE COMISSÕES --- */}


                         <div className="space-y-1.5 mt-6">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Progresso Rank {affiliateRank + 1}</span>
                                <span>{affiliateInvites}/5 Convites</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                <motion.div className="bg-brand-pink h-2.5 rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min((affiliateInvites / 5) * 100, 100)}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
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
              </motion.section>
              <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={3}>
                 <div className="bg-brand-light p-6 rounded-xl border border-gray-200 text-center hover:shadow-md transition-shadow flex flex-col items-center">
                    <div className="p-3 bg-brand-pink/10 rounded-full text-brand-pink mb-4">
                        <FaQuestionCircle className="w-6 h-6"/>
                    </div>
                    <h3 className="font-semibold text-brand-dark mb-2 text-lg">Precisa de Ajuda?</h3>
                    <p className="text-sm text-gray-600 font-light mb-5 leading-relaxed">Acesse nossa central de ajuda ou entre em contato conosco.</p>
                    <a href="/ajuda" className="text-sm text-brand-pink hover:underline font-semibold mt-auto pt-2">Acessar Central de Ajuda</a>
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #aaa;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #ccc #f1f1f1;
        }
        @keyframes spin-gradient-border { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .animated-border-card { position: relative; border-radius: 0.80rem; overflow: hidden; padding: 2px; z-index: 1; background: white; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
        .animated-border-card::before { content: ''; position: absolute; inset: -200%; z-index: -1; background: conic-gradient( from 90deg, #E91E63, #EF4444, #E91E63 ); animation: spin-gradient-border 4s linear infinite; }
        .animated-border-card > .card-content { position: relative; z-index: 2; border-radius: calc(0.80rem - 2px); }
      `}</style>
    </>
  );
}
