"use client";

import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from "next/navigation";
import Image from 'next/image';
import Head from 'next/head';
// Usando React Icons (Font Awesome)
import { FaCopy, FaCheckCircle, FaClock, FaTimesCircle, FaLock, FaTrophy, FaGift, FaMoneyBillWave, FaWhatsapp, FaUpload, FaCog, FaQuestionCircle, FaSignOutAlt, FaUserCircle, FaDollarSign, FaEllipsisV } from 'react-icons/fa';
// Framer Motion para animações
import { motion, AnimatePresence } from "framer-motion";

// --- Imports dos seus Componentes Reais ---
// Certifique-se que os caminhos estão corretos
import PaymentPanel from './PaymentPanel';
import UploadMetrics from './UploadMetrics';
import WhatsAppPanel from './WhatsAppPanel';
import PaymentModal from './PaymentModal'; // Importando o modal separado
// --- FIM IMPORTS ---


// --- INTERFACES ---
interface ExtendedUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  planStatus?: string; // 'active', 'pending', 'inactive' etc.
  planExpiresAt?: string | null; // ISO string date
  affiliateCode?: string | null; // Pode ser null aqui
  affiliateBalance?: number;
  affiliateRank?: number;
  affiliateInvites?: number;
}

// --- COMPONENTE SKELETON LOADER (Refinado) ---
const SkeletonLoader = ({ className = "" }: { className?: string }) => (
    // Usando cores mais suaves e animação pulse do Tailwind
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`}></div>
);

// --- COMPONENTE PRINCIPAL DASHBOARD ---
export default function MainDashboard() {
  // --- Hooks Chamados no Nível Superior ---
  const { data: session, status } = useSession(); // Hook 1
  const router = useRouter(); // Hook 2
  const [showPaymentModal, setShowPaymentModal] = useState(false); // Hook 3
  const [copySuccess, setCopySuccess] = useState(false); // Hook 4
  const [redeemMessage, setRedeemMessage] = useState(""); // Hook 5
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false); // Hook 6

  // --- useEffect para lidar com status da sessão (erros e redirecionamento) ---
  // ESTE HOOK É CHAMADO EM TODAS AS RENDERIZAÇÕES
  useEffect(() => {
    // --- CORREÇÃO: Lógica de redirecionamento movida para cá ---
    // Se o status for 'unauthenticated', redireciona para a home
    if (status === "unauthenticated") {
      router.push('/'); // Redireciona para a página inicial
    }
    // Se estiver autenticado mas a sessão for inválida, loga um erro
    else if (status === "authenticated" && (!session || !session.user)) {
      console.error("Erro: Autenticado, mas session ou session.user inválido.", session);
      // Poderia adicionar um redirecionamento para erro ou logout aqui também
      // signOut({ redirect: false }); // Exemplo
      // router.push('/error'); // Exemplo
    }
    // Não faz nada se status === 'loading' ou 'authenticated' com sessão válida
  }, [status, session, router]); // Dependências: re-executa se status, session ou router mudarem

  // Animação para os cards
  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
   };

  // Lógica de Resgate
  const handleRedeemBalance = useCallback(async (userId: string | undefined) => { // Hook 7
     // ... (código mantido)
     if (!userId) { setRedeemMessage("Erro: ID do usuário não encontrado."); return; }
     setRedeemMessage("Processando...");
     try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setRedeemMessage("Resgate solicitado com sucesso!");
        setTimeout(() => setRedeemMessage(""), 4000);
        router.refresh();
    } catch (error) {
        setRedeemMessage(`Erro: ${error instanceof Error ? error.message : String(error)}`);
        setTimeout(() => setRedeemMessage(""), 4000);
    }
   }, [router]);

  // Lógica para Copiar Código
  const copyAffiliateCode = useCallback(() => { // Hook 8
     // ... (código mantido)
    const user = session?.user as ExtendedUser | undefined; // Usa optional chaining aqui por segurança
    const code = user?.affiliateCode ?? "";
    if (!code || !navigator.clipboard) return;

    navigator.clipboard.writeText(code).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
        console.error('Erro ao copiar:', err);
    });
   }, [session]);

  // --- Renderização Condicional Refinada ---

  // 1. Estado de Carregamento Inicial OU Redirecionamento Pendente
  // Mostra skeleton se loading, ou mensagem de redirecionamento se unauthenticated (enquanto o useEffect redireciona)
  if (status === "loading" || status === "unauthenticated") {
    return (
        <div className="min-h-screen bg-brand-light p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Mostra Skeleton se loading */}
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
                {/* Mostra mensagem de redirecionamento se unauthenticated */}
                {status === "unauthenticated" && (
                     <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
                        <p className="text-gray-500 font-medium">Redirecionando...</p>
                    </div>
                )}
            </div>
        </div>
    );
  }

  // --- CORREÇÃO: Removido o bloco 'if (status === "unauthenticated")' daqui ---
  // A lógica foi movida para o useEffect e para a condição acima.

  // --- Verificação explícita para session e session.user ---
  // Garante que, se o status for 'authenticated', a sessão é válida antes de continuar.
  if (!session || !session.user) {
      // Mostra uma mensagem genérica de carregamento ou erro.
      // O useEffect no topo já logou um erro se for um problema persistente.
      return (
          <div className="min-h-screen flex items-center justify-center bg-brand-light">
              <p className="text-gray-500 font-medium">Carregando dados do usuário...</p>
          </div>
      );
  }

  // 4. Estado Autenticado e Válido
  // Se chegou aqui, temos: status === "authenticated" E session E session.user.
  const user = session.user as ExtendedUser;
  const userId = user?.id ?? "";
  const planStatus = user?.planStatus ?? "inactive";
  const userImage = user?.image ?? null;
  const userName = user?.name ?? 'Usuário';
  const affiliateCode = user?.affiliateCode ?? null; // Pode ser null aqui
  const affiliateBalance = user?.affiliateBalance ?? 0;
  const affiliateRank = user?.affiliateRank ?? 1;
  const affiliateInvites = user?.affiliateInvites ?? 0;
  const planExpiresAt = user?.planExpiresAt ?? null;
  const canAccessFeatures = planStatus === "active";

  // Função para obter informações de status
  const getStatusInfo = () => {
     switch (planStatus) {
      case 'active': return { text: 'Plano Ativo', colorClasses: 'text-green-700 bg-green-100 border-green-300', icon: <FaCheckCircle className="w-4 h-4"/> };
      case 'pending': return { text: 'Pagamento Pendente', colorClasses: 'text-yellow-700 bg-yellow-100 border-yellow-300', icon: <FaClock className="w-4 h-4"/> };
      default: return { text: 'Plano Inativo', colorClasses: 'text-brand-red bg-red-100 border-red-300', icon: <FaTimesCircle className="w-4 h-4"/> };
    }
  };
  const statusInfo = getStatusInfo();
  const canRedeem = affiliateBalance > 0;

  // Props específicas para PaymentPanel
  const paymentPanelUserProps = {
    planStatus: user.planStatus,
    planExpiresAt: user.planExpiresAt,
    affiliateBalance: user.affiliateBalance,
    affiliateCode: user.affiliateCode === null ? undefined : user.affiliateCode,
  };


  // Retorna o JSX do Dashboard para usuário autenticado
  return (
    <>
      <Head><title>Dashboard - Data2Content</title></Head>
      {/* Renderiza o Modal de Pagamento */}
      <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} userId={userId} />

      <div className="min-h-screen bg-brand-light">
        {/* Header do Dashboard */}
        <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
            {/* ... (código do header mantido) ... */}
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
                            <FaEllipsisV className="w-5 h-5"/>
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
                                        <a href="/dashboard/configuracoes" className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5">
                                            <FaCog className="w-4 h-4 text-gray-400"/> Configurações
                                        </a>
                                         <a href="/ajuda" className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-dark transition-colors rounded-md mx-1 my-0.5">
                                            <FaQuestionCircle className="w-4 h-4 text-gray-400"/> Ajuda
                                        </a>
                                    </div>
                                    <div className="py-1 border-t border-gray-100">
                                        {/* Botão Sair agora só chama signOut */}
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

        {/* Conteúdo Principal do Dashboard */}
        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">

            {/* Coluna Principal (Esquerda) */}
            <div className="lg:col-span-2 space-y-12">
              {/* Card Boas Vindas com Avatar */}
              <motion.section
                variants={cardVariants} initial="hidden" animate="visible" custom={0}
                className="bg-white p-6 sm:p-8 rounded-xl shadow-lg border-t-4 border-brand-pink flex flex-col sm:flex-row items-center gap-6"
              >
                 <div className="flex-shrink-0">
                    {userImage ? (
                        <Image src={userImage} alt="Avatar" width={88} height={88} className="rounded-full border-4 border-white shadow-md" />
                    ) : (
                        <span className="inline-block h-22 w-22 overflow-hidden rounded-full bg-gray-100 border-4 border-white shadow-md">
                            <FaUserCircle className="h-full w-full text-gray-300" />
                        </span>
                    )}
                 </div>
                 <div className="flex-grow text-center sm:text-left">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-brand-dark mb-2">Bem-vindo(a), {userName}!</h1>
                    <p className="text-base text-gray-600 font-light mb-4">Pronto para otimizar sua carreira de criador?</p>
                    <div className="flex items-center flex-wrap gap-2 justify-center sm:justify-start">
                        <div className={`inline-flex items-center gap-2 text-sm mb-1 px-4 py-1.5 rounded-full border ${statusInfo.colorClasses}`}>
                          <span className="text-lg">{statusInfo.icon}</span>
                          <span className="font-semibold">{statusInfo.text}</span>
                          {planStatus === 'active' && planExpiresAt && (
                              <span className="hidden md:inline text-xs opacity-80 ml-2">(Expira em {new Date(planExpiresAt).toLocaleDateString("pt-BR")})</span>
                          )}
                        </div>
                        {!canAccessFeatures && (
                            <button
                                onClick={() => {
                                    const paymentSection = document.getElementById('payment-section');
                                    if (paymentSection) {
                                        paymentSection.scrollIntoView({ behavior: 'smooth' });
                                    } else {
                                        setShowPaymentModal(true);
                                    }
                                }}
                                className="text-xs bg-brand-pink text-white px-4 py-1.5 rounded-full hover:opacity-90 font-semibold transition-default align-middle"
                            >
                                Fazer Upgrade
                            </button>
                        )}
                    </div>
                 </div>
              </motion.section>

              {/* Card de Acesso ao Tuca (via WhatsApp) */}
               <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={1}>
                 <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Consultor IA Tuca (WhatsApp)</h2>
                 {canAccessFeatures ? (
                     <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                         <div className="flex items-center gap-4 mb-4">
                              <div className="p-3 bg-green-100 rounded-full text-green-600"><FaWhatsapp className="w-6 h-6"/></div>
                              <h3 className="font-semibold text-lg text-brand-dark">Acesso Liberado via WhatsApp</h3>
                          </div>
                         <p className="text-base text-gray-700 font-light mb-6 leading-relaxed">Converse com o Tuca diretamente no seu WhatsApp para receber análises e estratégias personalizadas.</p>
                         <WhatsAppPanel userId={userId} canAccessFeatures={canAccessFeatures} />
                     </div>
                 ) : (
                     <div className="bg-gradient-to-br from-brand-pink to-brand-red text-white p-8 rounded-xl shadow-xl text-center flex flex-col items-center">
                          <div className="mb-5 text-5xl inline-block p-4 bg-white/20 rounded-full"><FaLock /></div>
                         <h3 className="text-2xl font-bold mb-3">Desbloqueie o Tuca no WhatsApp!</h3>
                         <p className="text-white/90 mb-8 text-base leading-relaxed font-light max-w-md">Assine para ter acesso ilimitado ao seu consultor IA pessoal e receber insights diretamente no seu chat.</p>
                         <button
                            onClick={() => {
                                const paymentSection = document.getElementById('payment-section');
                                if (paymentSection) {
                                    paymentSection.scrollIntoView({ behavior: 'smooth' });
                                } else {
                                    setShowPaymentModal(true);
                                }
                            }}
                            className="w-full sm:w-auto inline-block px-8 py-3 bg-white text-brand-pink rounded-full shadow-lg font-bold text-base hover:bg-gray-100 transition-default transform hover:scale-105"
                         >
                             Ver Planos e Assinar
                         </button>
                     </div>
                 )}
               </motion.section>

              {/* Card de Upload de Métricas */}
              <motion.section variants={cardVariants} initial="hidden" animate="visible" custom={2}>
                  <h2 className="text-xl font-semibold text-brand-dark mb-5 ml-1">Suas Métricas</h2>
                   <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                       <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-brand-light rounded-full text-brand-dark"><FaUpload className="w-5 h-5"/></div>
                            <h3 className="font-semibold text-lg text-brand-dark">Upload de Métricas</h3>
                        </div>
                       <p className="text-base text-gray-700 font-light mb-6 leading-relaxed">Envie seus dados mais recentes do Instagram para que o Tuca possa fazer análises precisas.</p>
                       <UploadMetrics canAccessFeatures={canAccessFeatures} userId={userId} />
                   </div>
               </motion.section>

               {/* Card Pagamento/Assinatura */}
               {!canAccessFeatures && (
                  <motion.section
                    id="payment-section"
                    variants={cardVariants} initial="hidden" animate="visible" custom={1.5}
                    className="bg-white p-6 sm:p-8 rounded-xl shadow-lg"
                  >
                     <h2 className="text-lg font-semibold text-brand-dark mb-4">Assine o Data2Content</h2>
                     {/* --- Passando o objeto de props ajustado --- */}
                     <PaymentPanel user={paymentPanelUserProps} />
                  </motion.section>
              )}

            </div> {/* Fim Coluna Principal */}

            {/* Coluna Direita (Sidebar) */}
            <div className="lg:col-span-1 space-y-8">
                 {/* Card Afiliado */}
              <motion.section
                variants={cardVariants} initial="hidden" animate="visible" custom={0.5}
                className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-brand-pink"
              >
                    {/* ... (código do card afiliado mantido) ... */}
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
                             <label className="text-xs font-medium text-gray-500 block">Seu Link de Afiliado:</label>
                             <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={affiliateCode ?? "Gerando link..."}
                                    readOnly
                                    className="flex-grow text-xs font-mono bg-gray-50 px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-pink"
                                 />
                                {affiliateCode && (
                                    <button
                                        onClick={copyAffiliateCode}
                                        title="Copiar Link"
                                        className={`p-2 rounded-md transition-all duration-200 ease-in-out ${copySuccess ? 'bg-green-100 text-green-600 scale-110' : 'bg-gray-100 text-gray-500 hover:text-brand-pink hover:bg-gray-200'}`}
                                    >
                                        {copySuccess ? <FaCheckCircle className="w-4 h-4"/> : <FaCopy className="w-4 h-4"/>}
                                    </button>
                                )}
                             </div>
                         </div>
                         <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Progresso Rank {affiliateRank + 1}</span>
                                <span>{affiliateInvites}/5 Convites</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                <motion.div
                                    className="bg-brand-pink h-2.5 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((affiliateInvites / 5) * 100, 100)}%` }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                            </div>
                         </div>
                         <div className="pt-4 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => handleRedeemBalance(userId)}
                                className="flex-1 px-4 py-2.5 bg-brand-pink text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-default disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
                                disabled={!canRedeem || redeemMessage === "Processando..."}
                            >
                                <FaMoneyBillWave className="w-4 h-4"/>
                                {redeemMessage === "Processando..." ? "Processando..." : "Resgatar Saldo"}
                            </button>
                            <button
                                onClick={() => setShowPaymentModal(true)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-default border border-gray-200 flex items-center justify-center gap-2"
                            >
                                 <FaCog className="w-4 h-4"/>
                                Dados Pagamento
                            </button>
                         </div>
                          <AnimatePresence>
                            {redeemMessage && redeemMessage !== "Processando..." && (
                                <motion.p
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className={`text-xs text-center mt-3 font-medium ${redeemMessage.startsWith('Erro:') ? 'text-brand-red' : 'text-green-600'}`}
                                >
                                    {redeemMessage}
                                </motion.p>
                            )}
                          </AnimatePresence>
                    </div>
              </motion.section>

              {/* Card Ajuda/Suporte */}
              <motion.section
                variants={cardVariants} initial="hidden" animate="visible" custom={2}
                className="bg-brand-light p-6 rounded-xl border border-gray-200 text-center hover:shadow-md transition-shadow flex flex-col items-center"
              >
                 {/* ... (código do card ajuda mantido) ... */}
                 <div className="p-3 bg-brand-pink/10 rounded-full text-brand-pink mb-4">
                    <FaQuestionCircle className="w-6 h-6"/>
                 </div>
                 <h3 className="font-semibold text-brand-dark mb-2 text-lg">Precisa de Ajuda?</h3>
                 <p className="text-sm text-gray-600 font-light mb-5 leading-relaxed">Acesse nossa central de ajuda ou entre em contato conosco.</p>
                 <a href="/ajuda" className="text-sm text-brand-pink hover:underline font-semibold mt-auto pt-2">Acessar Central de Ajuda</a>
              </motion.section>
            </div> {/* Fim Coluna Direita */}

          </div> {/* Fim Grid Principal */}
        </main>

        {/* Footer */}
        <footer className="text-center mt-20 py-10 border-t border-gray-200 text-xs text-gray-500 font-light">
             © {new Date().getFullYear()} Data2Content. Todos os direitos reservados.
        </footer>

      </div> {/* Fim Div Principal do Dashboard */}

      {/* Estilos Globais (se houver) */}
      <style jsx global>{`
        /* Adicione estilos globais específicos para esta página aqui, se necessário */
      `}</style>
    </>
  );
}
