"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  FaArrowDown
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { isPlanActiveLike } from "@/utils/planStatus";
import { MessageBubble } from './components/chat/MessageBubble';
import { Composer } from './components/chat/Composer';
import { PromptChip } from './components/chat/PromptChip';
import { AlertItem, ChatCalculationContext } from './components/chat/types';
import { useChat } from "./hooks/useChat";
import { usePricingAnalysis } from "./hooks/usePricingAnalysis";
import { useAlerts } from "./hooks/useAlerts";
import { AlertsDrawer } from "./components/chat/AlertsDrawer";

interface SessionUserWithId {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/* ---------- Componente principal ---------- */

export default function ChatPanel({
  onUpsellClick,
  calculationContext,
  fullHeight = false,
}: {
  onUpsellClick?: () => void;
  calculationContext?: ChatCalculationContext | null;
  fullHeight?: boolean;
} = {}) {
  const { data: session } = useSession();
  const router = useRouter();

  const role = String((session?.user as any)?.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const previousTargetRef = useRef<string | null>(null);
  const initializedTargetRef = useRef(false);

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const userWithId = session?.user as SessionUserWithId | undefined;
  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const instagramUsername = ((session?.user as any)?.instagramUsername as string | undefined) || null;
  const billingStatus = useBillingStatus();
  const planStatusSession = (session?.user as any)?.planStatus;
  const hasPremiumAccess = billingStatus.hasPremiumAccess || isPlanActiveLike(planStatusSession);
  const isActiveLikePlan = hasPremiumAccess;
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [selectedTargetLabel, setSelectedTargetLabel] = useState<string>('');

  const {
    messages,
    setMessages,
    input,
    setInput,
    isSending,
    inlineAlert,
    setInlineAlert,
    pendingAction,
    currentTask,
    messagesEndRef,
    autoScrollOnNext,
    sendPrompt,
    clearChat,
    scrollToBottom
  } = useChat({
    userWithId,
    isAdmin,
    targetUserId
  });

  const {
    alerts,
    status: alertsStatus,
    setStatus: setAlertsStatus,
    unreadCount: alertsUnreadCount,
    hasNext: alertsHasNext,
    fetchState: alertsFetchState,
    ensureLoaded: ensureAlertsLoaded,
    refresh: refreshAlerts,
    loadMore: loadMoreAlerts,
    markAsRead: markAlertAsRead,
    refreshUnreadCount: refreshAlertsUnreadCount,
  } = useAlerts();

  const [isAlertsOpen, setAlertsOpen] = useState(false);

  const {
    pricingAnalysisContext,
    preloadedMessages,
    lastPricingCalcIdRef,
    isAutoPricingRunningRef
  } = usePricingAnalysis(calculationContext);

  useEffect(() => {
    if (initializedTargetRef.current) return;
    if (userWithId?.id) {
      setTargetUserId(userWithId.id);
      setSelectedTargetLabel(session?.user?.name || 'Meu perfil');
      initializedTargetRef.current = true;
    }
  }, [session?.user?.name, userWithId?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    const trimmed = targetUserId.trim();
    if (previousTargetRef.current === null) {
      previousTargetRef.current = trimmed;
      return;
    }
    if (trimmed !== previousTargetRef.current) {
      clearChat();
      setInput('');
      previousTargetRef.current = trimmed;
    }
  }, [isAdmin, targetUserId, clearChat, setInput]);

  useEffect(() => {
    const trimmed = targetUserId.trim();
    if (!trimmed) return;
    if (trimmed === (userWithId?.id || '')) {
      setSelectedTargetLabel(session?.user?.name || 'Meu perfil');
      return;
    }
    if (!selectedTargetLabel || selectedTargetLabel === previousTargetRef.current) {
      setSelectedTargetLabel(trimmed);
    }
  }, [session?.user?.name, selectedTargetLabel, targetUserId, userWithId?.id]);

  const applyTargetSelection = (id: string, label: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    initializedTargetRef.current = true;
    setTargetUserId(trimmed);
    setSelectedTargetLabel(label || trimmed);
    setInlineAlert(null);
  };

  const handleCorrectInstagramLink = async () => {
    try {
      const response = await fetch('/api/auth/iniciar-vinculacao-fb', { method: 'POST' });
      if (!response.ok) return console.error('Falha ao preparar a vinculação da conta.');
      signIn('facebook', { callbackUrl: '/dashboard/chat?instagramLinked=true' });
    } catch (error) {
      console.error('Erro no processo de vinculação:', error);
      setInlineAlert('Não foi possível iniciar a conexão com o Instagram. Tente novamente.');
    }
  };

  // detectar “fim” — corrigido: early return + cleanup
  useEffect(() => {
    const root = scrollRef.current;
    const target = messagesEndRef.current;
    if (!root || !target) return;

    const io = new IntersectionObserver(
      (entries) => setIsAtBottom(entries[0]?.isIntersecting ?? false),
      { root, threshold: 1.0, rootMargin: "0px 0px 60px 0px" }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [messagesEndRef]);

  // Pricing Analysis Integration
  useEffect(() => {
    if (!pricingAnalysisContext || !preloadedMessages.length) return;

    setMessages((prev) => {
      if (prev.some((msg) => msg.contextCalcId === pricingAnalysisContext.calcId)) {
        return prev;
      }
      autoScrollOnNext.current = true;
      // Add the assistant message from preloaded messages
      const assistantMsg = preloadedMessages.find(m => m.role === 'assistant');
      if (assistantMsg) {
        return [...prev, { sender: 'consultant', text: assistantMsg.content, contextCalcId: pricingAnalysisContext.calcId }];
      }
      return prev;
    });
  }, [pricingAnalysisContext, preloadedMessages, setMessages, autoScrollOnNext]);

  useEffect(() => {
    if (!calculationContext) return;
    if (calculationContext.context !== 'publi-calculator') return;
    if (!pricingAnalysisContext) return;
    if (!preloadedMessages.length) return;
    if (pricingAnalysisContext.calcId !== calculationContext.calcId) return;
    if (lastPricingCalcIdRef.current === pricingAnalysisContext.calcId) return;
    if (isAutoPricingRunningRef.current) return;

    let cancelled = false;
    isAutoPricingRunningRef.current = true;

    const runAutoAnalysis = async () => {
      try {
        const response = await fetch('/api/ai/pricing-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calcId: pricingAnalysisContext.calcId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.message) {
          throw new Error(data?.error || 'Falha ao gerar análise automática.');
        }
        if (cancelled) return;
        lastPricingCalcIdRef.current = pricingAnalysisContext.calcId;
        autoScrollOnNext.current = true;
        setMessages((prev) => [...prev, { sender: 'consultant', text: String(data.message) }]);
      } catch (error) {
        console.error('[ChatPanel] Falha ao gerar insight automático de precificação.', error);
        if (!cancelled) {
          setInlineAlert('Não consegui gerar a análise automática agora. Você pode pedir uma comparação manualmente.');
        }
      } finally {
        if (!cancelled) {
          lastPricingCalcIdRef.current = pricingAnalysisContext.calcId;
        }
        isAutoPricingRunningRef.current = false;
      }
    };

    runAutoAnalysis();
    return () => {
      cancelled = true;
    };
  }, [calculationContext, preloadedMessages, pricingAnalysisContext, isAutoPricingRunningRef, lastPricingCalcIdRef, autoScrollOnNext, setMessages, setInlineAlert]);


  // mede a altura do composer em --composer-h
  useEffect(() => {
    const el = inputWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--composer-h", `${el.offsetHeight}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    ensureAlertsLoaded();
  }, [ensureAlertsLoaded]);

  useEffect(() => {
    refreshAlertsUnreadCount();
    const id = window.setInterval(() => {
      refreshAlertsUnreadCount();
    }, 60000);
    return () => window.clearInterval(id);
  }, [refreshAlertsUnreadCount]);

  const handleSend = async () => {
    await sendPrompt(input);
  };

  const pendingActionLabel = (() => {
    if (!pendingAction?.type) return null;
    if (pendingAction.type === 'confirm_fetch_day_stats') return 'A IA quer buscar estatísticas por dia. Confirma?';
    if (pendingAction.type === 'clarify_community_inspiration_objective') return 'A IA pediu para clarificar objetivo/tema antes de trazer exemplos.';
    if (pendingAction.type === 'confirm_another_action') return 'A IA sugeriu uma ação e pediu confirmação. Deseja seguir?';
    return 'A IA sugeriu uma próxima ação. Deseja prosseguir?';
  })();
  const TASK_NAME_MAPPING: Record<string, string> = {
    content_plan: 'Criando Planejamento de Conteúdo',
    pricing_analysis: 'Analisando Precificação',
    market_analysis: 'Analisando Mercado',
    competitor_analysis: 'Analisando Concorrência',
    audience_analysis: 'Analisando Audiência',
  };

  const getFriendlyTaskName = (taskName: string) => {
    return TASK_NAME_MAPPING[taskName] || `Processando: ${taskName}`;
  };

  const currentTaskLabel = currentTask?.name ? `Tarefa em andamento: ${getFriendlyTaskName(currentTask.name)}` : null;

  const isWelcome = messages.length === 0;
  const fullName = (session?.user?.name || "").trim();
  const firstName = fullName ? fullName.split(" ")[0] : "visitante";
  const handleAlertSelect = useCallback(
    (alert: AlertItem) => {
      if (!alert) return;
      autoScrollOnNext.current = true;
      setMessages((prev) => {
        if (prev.some((msg) => msg.alertId === alert.id)) return prev;
        const content = alert.body ? `*${alert.title}*\n\n${alert.body}` : alert.title;
        return [
          ...prev,
          {
            sender: 'consultant',
            text: content,
            alertId: alert.id,
            alertTitle: alert.title,
            alertSeverity: alert.severity ?? 'info',
          },
        ];
      });
      setAlertsOpen(false);
      markAlertAsRead(alert.id).then((ok) => {
        if (!ok) {
          setInlineAlert((prev) => prev ?? 'Não consegui marcar o alerta como lido agora.');
        }
      }).catch(() => {
        setInlineAlert((prev) => prev ?? 'Não consegui marcar o alerta como lido agora.');
      });
    },
    [autoScrollOnNext, markAlertAsRead, setAlertsOpen, setInlineAlert, setMessages]
  );

  const welcomePrompts = [
    { label: "narrativa que gera compartilhamentos", requiresIG: true },
    { label: "melhor dia/hora pra postar por formato", requiresIG: true },
    { label: "planejamento baseado em categorias", requiresIG: true },
  ];

  return (
    <div
      className="relative flex flex-col w-full bg-white overflow-hidden"
      style={{ height: fullHeight ? 'calc(100svh - var(--header-h, 0px))' : '100svh' }}
    >


      {/* timeline (único scroll) */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide overscroll-contain px-4 py-6"
      >
        {isWelcome ? (
          <div className="h-full flex flex-col items-center justify-center pb-10">
            <div className="w-full max-w-3xl text-center px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-gray-900 mb-4">
                  Olá, <span className="text-brand-primary">{firstName}</span>
                </h1>
                <p className="text-xl sm:text-2xl text-gray-500 font-medium">O que vamos criar hoje?</p>
              </motion.div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } }}
                className="flex flex-wrap justify-center gap-3 mt-12"
              >
                {welcomePrompts.map((p, i) => (
                  <motion.div key={i} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <PromptChip
                      label={p.label}
                      onClick={() => {
                        if (p.requiresIG && !instagramConnected && !isAdmin) {
                          handleCorrectInstagramLink();
                        } else {
                          setInput(p.label);
                          setTimeout(handleSend, 0);
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        ) : (
          <div className="relative mx-auto max-w-3xl w-full pb-4">
            <ul role="list" aria-live="polite" className="space-y-6">
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={idx}
                  message={msg}
                  onUpsellClick={onUpsellClick}
                  onConnectInstagram={handleCorrectInstagramLink}
                />
              ))}

              {/* “Respondendo…” inline */}
                <AnimatePresence>
                {isSending && (
                  <motion.li
                    key="respondendo-inline"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="w-full flex justify-start"
                  >
                    <div className="max-w-[92%] sm:max-w-[80%] lg:max-w-[72ch] rounded-2xl bg-gray-100/80 px-3.5 py-2.5 flex items-center gap-3 border border-gray-100">
                      <div className="flex items-center gap-1" aria-hidden>
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-300 animate-bounce delay-150" />
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-200 animate-bounce delay-300" />
                      </div>
                      <span className="text-sm text-gray-500 font-medium">Digitando...</span>
                    </div>
                  </motion.li>
                )}
              </AnimatePresence>
            </ul>
            <div ref={messagesEndRef} className="h-px" />
          </div>
        )}
      </div>

      {pendingAction ? (
        <div className="px-4 pb-2">
          <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 shadow-sm">
            <p className="text-sm font-semibold text-gray-800">
              {pendingActionLabel || 'A IA deixou uma pergunta em aberto.'}
            </p>
            {pendingAction?.context?.originalSuggestion ? (
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                {pendingAction.context.originalSuggestion}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-primary-dark disabled:opacity-60"
                onClick={() => sendPrompt('Sim, pode seguir com isso.', { skipInputReset: true })}
                disabled={isSending}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-brand-primary hover:text-brand-primary disabled:opacity-60"
                onClick={() => sendPrompt('Prefiro não seguir com isso agora.', { skipInputReset: true })}
                disabled={isSending}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {currentTaskLabel ? (
        <div className="px-4 pb-2">
          <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-brand-primary/40 bg-white/80 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Modo tarefa</p>
            <p className="text-sm font-semibold text-gray-800">{currentTaskLabel}</p>
            {currentTask?.objective ? (
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">{currentTask.objective}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Composer — Fixed at bottom */}
      <div ref={inputWrapperRef}>
        <Composer
          input={input}
          setInput={setInput}
          onSend={handleSend}
          isSending={isSending}
          inlineAlert={inlineAlert}
          onOpenTools={() => setIsToolsOpen(true)}
          isToolsOpen={isToolsOpen}
          onCloseTools={() => setIsToolsOpen(false)}
          onOpenAlerts={() => {
            setIsToolsOpen(false);
            setAlertsOpen(true);
            ensureAlertsLoaded();
          }}
          isAlertsOpen={isAlertsOpen}
          onCloseAlerts={() => setAlertsOpen(false)}
          alertsBadgeCount={alertsUnreadCount}
          instagramConnected={instagramConnected}
          onConnectInstagram={handleCorrectInstagramLink}
          instagramUsername={instagramUsername}
          isActiveLikePlan={isActiveLikePlan}
          isAdmin={isAdmin}
          currentUserId={userWithId?.id}
          currentUserName={session?.user?.name}
          selectedTargetLabel={selectedTargetLabel}
          onSelectUser={applyTargetSelection}
          onClearChat={clearChat}
        />
      </div>

      <AlertsDrawer
        isOpen={isAlertsOpen}
        onClose={() => setAlertsOpen(false)}
        alerts={alerts}
        status={alertsStatus}
        onStatusChange={(status) => {
          setAlertsStatus(status);
          refreshAlerts(status);
        }}
        loading={alertsFetchState.loading}
        error={alertsFetchState.error}
        unreadCount={alertsUnreadCount}
        hasNext={alertsHasNext}
        onRefresh={() => refreshAlerts()}
        onLoadMore={loadMoreAlerts}
        onSelectAlert={handleAlertSelect}
      />

      {/* Voltar ao fim */}
      <AnimatePresence>
        {!isAtBottom && messages.length > 0 && (
          <motion.button
            key="back-to-end"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={scrollToBottom}
            className="absolute bottom-24 right-6 z-20 p-3 bg-brand-primary text-white rounded-full shadow-lg hover:bg-brand-primary-dark transition-colors"
            aria-label="Voltar ao fim"
          >
            <FaArrowDown />
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
