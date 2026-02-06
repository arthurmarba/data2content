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
import { FEEDBACK_REASONS, FeedbackReasonCode } from "./components/chat/feedbackReasons";
import { usePricingAnalysis } from "./hooks/usePricingAnalysis";
import { useAlerts } from "./hooks/useAlerts";
import { AlertsDrawer } from "./components/chat/AlertsDrawer";
import { useChatThreads } from "./components/chat/useChatThreads";
import { useThreadSelection } from "./components/chat/useThreadSelection";
import useCreatorProfileExtended from "@/hooks/useCreatorProfileExtended";
import { track } from "@/lib/track";
import type { RenderDensity } from "./components/chat/chatUtils";
import { ThinkingIndicator } from "./components/chat/ThinkingIndicator";

interface SessionUserWithId {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

const normalizeSectionHeading = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseResponseSections = (text: string) => {
  const sections: Record<string, string[]> = {};
  let current: string | null = null;

  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^#{1,3}\s+(.*)$/);
    if (match) {
      const normalized = normalizeSectionHeading(match[1] || '');
      const base = normalized.split(/[(:\-–—]/)[0] ?? '';
      const baseTrimmed = base.trim();
      current = baseTrimmed || normalized;
      if (!sections[current]) sections[current] = [];
      return;
    }
    if (current) {
      const bucket = sections[current] ?? [];
      bucket.push(line);
      sections[current] = bucket;
    }
  });

  const cleanup = (lines?: string[]) =>
    (lines || []).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const pick = (keys: string[]) => {
    for (const key of keys) {
      const content = cleanup(sections[key]);
      if (content) return content;
    }
    return '';
  };

  return {
    summary: pick(['resumo']),
    actions: pick(['proximas acoes', 'proximos passos', 'acoes']),
    hasDisclosure: Boolean(sections['detalhes']?.length || sections['metodologia']?.length),
  };
};

type TapDebugState = {
  innerHeight: number | null;
  viewportHeight: number | null;
  appHeightVar: string | null;
  composerHeightVar: string | null;
  activeElement: string | null;
  lastTapTarget: string | null;
  lastTapType: string | null;
};

/* ---------- Componente principal ---------- */

export default function ChatPanel({
  onUpsellClick,
  calculationContext,
  fullHeight = false,
  topSlot,
  selectedThreadId,
  onThreadCreated,
  onSelectThread,
}: {
  onUpsellClick?: () => void;
  calculationContext?: ChatCalculationContext | null;
  fullHeight?: boolean;
  topSlot?: React.ReactNode;
  selectedThreadId?: string | null;
  onThreadCreated?: (id: string) => void;
  onSelectThread?: (id: string | null) => void;
} = {}) {
  const { data: session } = useSession();
  const router = useRouter();
  const tapDebugEnabled = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("tapdebug");
  }, []);

  const role = String((session?.user as any)?.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const previousTargetRef = useRef<string | null>(null);
  const initializedTargetRef = useRef(false);
  const lastAssistantKeyRef = useRef<string | null>(null);
  const firstFeedbackTrackedRef = useRef(false);
  const scrollDepthRef = useRef<Set<number>>(new Set());
  const copyTimeoutRef = useRef<number | null>(null);
  const fastTapCandidateRef = useRef<{
    target: HTMLElement;
    active: HTMLElement;
    startX: number;
    startY: number;
  } | null>(null);
  const fastTapStateRef = useRef<{
    until: number;
    target: HTMLElement | null;
    allowFirst: boolean;
  } | null>(null);

  const [viewMode, setViewMode] = useState<'reading' | 'compact'>('reading');
  const [copiedSection, setCopiedSection] = useState<'summary' | 'actions' | null>(null);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [disclosureSignal, setDisclosureSignal] = useState(0);

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [tapDebugState, setTapDebugState] = useState<TapDebugState | null>(null);
  const lastTapInfoRef = useRef<{ target: string | null; type: string | null } | null>(null);
  const [skipAutoSelect, setSkipAutoSelect] = useState(false);
  const { selectedThreadId: storedThreadId, setSelectedThreadId: setStoredThreadId } = useThreadSelection(selectedThreadId);
  const effectiveThreadId = selectedThreadId ?? storedThreadId;

  useEffect(() => {
    // Keep local state in sync when parent controls a thread id.
    if (selectedThreadId !== undefined) {
      setStoredThreadId(selectedThreadId ?? null);
    }
  }, [selectedThreadId, setStoredThreadId]);

  // Mobile Safari: first tap while a textarea is focused often just dismisses the keyboard.
  useEffect(() => {
    const root = panelRef.current;
    if (!root || typeof window === "undefined") return;

    const isEditable = (el: Element | null) => {
      if (!el) return false;
      const tag = (el as HTMLElement).tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
    };

    const interactiveSelector = "button, [role=\"button\"]";
    const moveThresholdSq = 8 * 8;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const active = document.activeElement;
      if (!isEditable(active)) return;
      if (!(active instanceof HTMLElement)) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (active.contains(target)) return;
      const interactive = target.closest<HTMLElement>(interactiveSelector);
      if (!interactive) return;
      if (interactive instanceof HTMLButtonElement && interactive.disabled) return;

      const touch = event.touches[0];
      if (!touch) return;
      fastTapCandidateRef.current = {
        target: interactive,
        active,
        startX: touch.clientX,
        startY: touch.clientY,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const candidate = fastTapCandidateRef.current;
      if (!candidate) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - candidate.startX;
      const dy = touch.clientY - candidate.startY;
      if (dx * dx + dy * dy > moveThresholdSq) {
        fastTapCandidateRef.current = null;
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const candidate = fastTapCandidateRef.current;
      if (!candidate) return;
      fastTapCandidateRef.current = null;
      if (!candidate.target.isConnected) return;
      if (candidate.target instanceof HTMLButtonElement && candidate.target.disabled) return;
      if (isEditable(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
      } else if (isEditable(candidate.active)) {
        candidate.active.blur();
      }
      fastTapStateRef.current = {
        until: Date.now() + 700,
        target: candidate.target,
        allowFirst: true,
      };
      if (event.cancelable) event.preventDefault();
      candidate.target.click();
    };

    const handleTouchCancel = () => {
      fastTapCandidateRef.current = null;
    };

    const handleClickCapture = (event: MouseEvent) => {
      const state = fastTapStateRef.current;
      if (!state) return;
      if (Date.now() > state.until) {
        fastTapStateRef.current = null;
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLElement) || !state.target || !state.target.contains(target)) return;
      if (state.allowFirst) {
        state.allowFirst = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      fastTapStateRef.current = null;
    };

    root.addEventListener("touchstart", handleTouchStart, { capture: true, passive: true });
    root.addEventListener("touchmove", handleTouchMove, { capture: true, passive: true });
    root.addEventListener("touchend", handleTouchEnd, { capture: true, passive: false });
    root.addEventListener("touchcancel", handleTouchCancel, true);
    root.addEventListener("click", handleClickCapture, true);

    return () => {
      root.removeEventListener("touchstart", handleTouchStart, true);
      root.removeEventListener("touchmove", handleTouchMove, true);
      root.removeEventListener("touchend", handleTouchEnd, true);
      root.removeEventListener("touchcancel", handleTouchCancel, true);
      root.removeEventListener("click", handleClickCapture, true);
    };
  }, []);

  const selectThread = useCallback((id: string | null) => {
    setStoredThreadId(id);
    if (id) {
      setSkipAutoSelect(false);
    }
    onSelectThread?.(id);
  }, [onSelectThread, setStoredThreadId]);

  const userWithId = session?.user as SessionUserWithId | undefined;
  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const instagramUsername = ((session?.user as any)?.instagramUsername as string | undefined) || null;
  const billingStatus = useBillingStatus();
  const planStatusSession = (session?.user as any)?.planStatus;
  const hasPremiumAccess = billingStatus.hasPremiumAccess || isPlanActiveLike(planStatusSession);
  const isActiveLikePlan = hasPremiumAccess;
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [selectedTargetLabel, setSelectedTargetLabel] = useState<string>('');
  const { profile: surveyProfile } = useCreatorProfileExtended();

  const {
    threads,
    loading: threadsLoading,
    loadingMore: threadsLoadingMore,
    error: threadsError,
    refresh: refreshThreads,
    loadMore: loadMoreThreads,
    toggleFavorite,
    renameThread,
    deleteThread,
    hasMore,
  } = useChatThreads({ autoLoad: true, limit: 50 });

  const handleThreadCreated = useCallback((newId: string) => {
    refreshThreads();
    onThreadCreated?.(newId);
    selectThread(newId);
    setSkipAutoSelect(false);
  }, [onThreadCreated, refreshThreads, selectThread]);

  const {
    messages,
    setMessages,
    input,
    setInput,
    isSending,
    inlineAlert,
    setInlineAlert,
    pendingAction,
    messagesEndRef,
    autoScrollOnNext,
    sendPrompt,
    clearChat,
    scrollToBottom,
    sessionId
  } = useChat({
    userWithId,
    isAdmin,
    targetUserId,
    threadId: effectiveThreadId,
    onThreadCreated: handleThreadCreated
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

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const thresholds = [0.25, 0.5, 0.75, 0.95];
    const throttleMs = 150;
    let timeoutId: number | null = null;
    const handleScroll = () => {
      if (root.scrollHeight <= root.clientHeight) return;
      const depth = (root.scrollTop + root.clientHeight) / Math.max(root.scrollHeight, 1);
      thresholds.forEach((threshold) => {
        if (depth >= threshold && !scrollDepthRef.current.has(threshold)) {
          scrollDepthRef.current.add(threshold);
          track('chat_scroll_depth', {
            depth: Math.round(threshold * 100),
            session_id: sessionId || null,
            thread_id: effectiveThreadId || null,
          });
        }
      });
    };
    const onScroll = () => {
      if (timeoutId) return;
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        handleScroll();
      }, throttleMs);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    handleScroll();
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [sessionId, effectiveThreadId]);

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
        return [
          ...prev,
          {
            sender: 'consultant',
            text: assistantMsg.content,
            contextCalcId: pricingAnalysisContext.calcId,
            messageType: 'other',
          },
        ];
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
        setMessages((prev) => [...prev, { sender: 'consultant', text: String(data.message), messageType: 'other' }]);
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
    let lastHeight = 0;

    const updateHeight = () => {
      const height = Math.round(el.getBoundingClientRect().height);
      if (height <= 0) return;
      if (lastHeight > 0 && Math.abs(height - lastHeight) < 2) return;
      if (height === lastHeight) return;
      lastHeight = height;
      document.documentElement.style.setProperty("--composer-h", `${height}px`);
    };

    updateHeight();
    const hasResizeObserver = typeof ResizeObserver !== 'undefined';
    let ro: ResizeObserver | null = null;
    if (hasResizeObserver) {
      ro = new ResizeObserver(updateHeight);
      ro.observe(el);
    } else {
      window.addEventListener('resize', updateHeight);
    }
    const rafId = window.requestAnimationFrame(updateHeight);

    return () => {
      ro?.disconnect();
      if (!hasResizeObserver) {
        window.removeEventListener('resize', updateHeight);
      }
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (!tapDebugEnabled) return;
    if (typeof window === "undefined") return;

    const formatElement = (element: Element | null) => {
      if (!element) return null;
      const el = element as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const className =
        typeof el.className === "string"
          ? el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      const classes = className ? `.${className}` : "";
      return `${tag}${id}${classes}`;
    };

    const readCssVar = (name: string) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || null;
    };

    let rafId = 0;
    const updateState = () => {
      const active = formatElement(document.activeElement);
      const lastTap = lastTapInfoRef.current;
      setTapDebugState({
        innerHeight: Number.isFinite(window.innerHeight) ? window.innerHeight : null,
        viewportHeight: window.visualViewport?.height ?? null,
        appHeightVar: readCssVar("--app-height"),
        composerHeightVar: readCssVar("--composer-h"),
        activeElement: active,
        lastTapTarget: lastTap?.target ?? null,
        lastTapType: lastTap?.type ?? null,
      });
    };

    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateState();
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const topElement = document.elementFromPoint(event.clientX, event.clientY);
      lastTapInfoRef.current = {
        target: formatElement(topElement),
        type: event.type,
      };
      scheduleUpdate();
    };

    const handleResize = () => {
      scheduleUpdate();
    };

    scheduleUpdate();
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true } as any);
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [tapDebugEnabled]);

  useEffect(() => {
    ensureAlertsLoaded();
  }, [ensureAlertsLoaded]);

  // Seleciona automaticamente a thread mais recente caso nada esteja selecionado ao carregar a lista
  useEffect(() => {
    if (skipAutoSelect) return;
    if (effectiveThreadId) return;
    if (!threads.length) return;
    const first = threads[0];
    if (!first?._id) return;
    selectThread(first._id);
  }, [effectiveThreadId, threads, selectThread, skipAutoSelect]);

  useEffect(() => {
    refreshAlertsUnreadCount();
    const id = window.setInterval(() => {
      refreshAlertsUnreadCount();
    }, 60000);
    return () => window.clearInterval(id);
  }, [refreshAlertsUnreadCount]);

  // Auto-refresh alerts + threads ao abrir o sino (uma vez por abertura)
  const refreshedOnOpenRef = useRef(false);
  useEffect(() => {
    if (!isAlertsOpen) {
      refreshedOnOpenRef.current = false;
      return;
    }
    if (refreshedOnOpenRef.current) return;
    refreshedOnOpenRef.current = true;
    refreshAlerts();
    refreshThreads();
  }, [isAlertsOpen, refreshAlerts, refreshThreads]);

  const handleSend = async () => {
    await sendPrompt(input);
  };
  const handleNewChat = useCallback(() => {
    setSkipAutoSelect(true);
    selectThread(null);
    clearChat();
  }, [clearChat, selectThread]);

  const pendingActionLabel = (() => {
    if (!pendingAction?.type) return null;
    if (pendingAction.type === 'confirm_fetch_day_stats') return 'A IA quer buscar estatísticas por dia. Confirma?';
    if (pendingAction.type === 'clarify_community_inspiration_objective') return 'A IA pediu para clarificar objetivo/tema antes de trazer exemplos.';
    if (pendingAction.type === 'confirm_another_action') return 'A IA sugeriu uma ação e pediu confirmação. Deseja seguir?';
    if (pendingAction.type === 'survey_update_request') return 'Atualize seu perfil (2 min) para respostas mais alinhadas.';
    return 'A IA sugeriu uma próxima ação. Deseja prosseguir?';
  })();

  const isWelcome = messages.length === 0;
  const fullName = (session?.user?.name || "").trim();
  const firstName = fullName ? fullName.split(" ")[0] : "visitante";
  const messageSpacingClass = viewMode === 'compact' ? 'space-y-2 sm:space-y-3' : 'space-y-4 sm:space-y-6';
  const renderDensity: RenderDensity = viewMode === 'compact' ? 'compact' : 'comfortable';
  const shouldVirtualize = messages.length >= 60;

  const lastAssistantMessage = React.useMemo(
    () => [...messages].reverse().find((m) => m.sender === 'consultant'),
    [messages]
  );
  const responseSections = React.useMemo(
    () => parseResponseSections(lastAssistantMessage?.text || ''),
    [lastAssistantMessage?.text]
  );
  const summaryText = responseSections.summary;
  const actionsText = responseSections.actions;
  const hasSummary = Boolean(summaryText);
  const hasActions = Boolean(actionsText);
  const showSummaryActions = hasSummary || hasActions;
  const hasDisclosure = React.useMemo(
    () => messages.some((msg) => msg.sender === 'consultant' && /#{1,3}\s*(Detalhes|Metodologia)/i.test(msg.text)),
    [messages]
  );

  const handleCopySection = useCallback(
    async (kind: 'summary' | 'actions', text: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopiedSection(kind);
        track(`chat_copy_${kind}`, {
          length: text.length,
          session_id: sessionId || null,
          thread_id: effectiveThreadId || null,
        });
        if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = window.setTimeout(() => setCopiedSection(null), 1600);
      } catch (error) {
        console.error('[chat] falha ao copiar secao', error);
      }
    },
    [effectiveThreadId, sessionId]
  );

  const handleToggleViewMode = useCallback(
    (mode: 'reading' | 'compact') => {
      setViewMode(mode);
      track('chat_view_mode_toggle', {
        mode,
        session_id: sessionId || null,
        thread_id: effectiveThreadId || null,
      });
    },
    [effectiveThreadId, sessionId]
  );

  const handleToggleDisclosures = useCallback(() => {
    const next = !disclosureOpen;
    setDisclosureOpen(next);
    setDisclosureSignal((value) => value + 1);
    track('chat_disclosure_toggle_all', {
      open: next,
      session_id: sessionId || null,
      thread_id: effectiveThreadId || null,
    });
  }, [disclosureOpen, effectiveThreadId, sessionId]);

  const handleDisclosureToggle = useCallback(
    ({ title, open }: { title: string; open: boolean }) => {
      track('chat_disclosure_toggle', {
        title,
        open,
        session_id: sessionId || null,
        thread_id: effectiveThreadId || null,
      });
    },
    [effectiveThreadId, sessionId]
  );

  const handleCopyCode = useCallback(
    ({ code, language }: { code: string; language?: string | null }) => {
      track('chat_copy_code', {
        language: language || null,
        length: code.length,
        session_id: sessionId || null,
        thread_id: effectiveThreadId || null,
      });
    },
    [effectiveThreadId, sessionId]
  );

  const messageRenderOptions = React.useMemo(
    () => ({
      density: renderDensity,
      disclosureOpen,
      disclosureSignal,
      stepsStyle: true,
      enableDisclosure: true,
      onToggleDisclosure: handleDisclosureToggle,
      onCopyCode: handleCopyCode,
    }),
    [renderDensity, disclosureOpen, disclosureSignal, handleDisclosureToggle, handleCopyCode]
  );
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
            messageType: 'other',
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

  const surveyUpdatedAt = React.useMemo(() => {
    if (!surveyProfile?.updatedAt) return null;
    const dateVal = surveyProfile.updatedAt instanceof Date ? surveyProfile.updatedAt : new Date(surveyProfile.updatedAt);
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }, [surveyProfile?.updatedAt]);

  const hasCoreSurvey = React.useMemo(() => {
    if (!surveyProfile) return false;
    return Boolean(
      (surveyProfile.stage && surveyProfile.stage.length > 0) ||
      surveyProfile.mainGoal3m ||
      (surveyProfile.niches && surveyProfile.niches.length > 0)
    );
  }, [surveyProfile]);

  const surveyIsStale = React.useMemo(() => {
    if (!surveyUpdatedAt) return !hasCoreSurvey;
    const STALE_MS = 1000 * 60 * 60 * 24 * 120; // ~4 meses
    return Date.now() - surveyUpdatedAt.getTime() > STALE_MS;
  }, [hasCoreSurvey, surveyUpdatedAt]);

  const surveyReminderLabel = !isAdmin && (surveyIsStale || !hasCoreSurvey) ? 'Atualizar pesquisa (2 min)' : null;

  const [csatVisible, setCsatVisible] = useState(false);
  const [csatScore, setCsatScore] = useState<number | null>(null);
  const [csatComment, setCsatComment] = useState('');
  const [csatSent, setCsatSent] = useState(false);
  const [csatPrompted, setCsatPrompted] = useState(false);
  const [csatDismissed, setCsatDismissed] = useState(false);
  const [lastAssistantTs, setLastAssistantTs] = useState<number | null>(null);
  const [lastUserActivity, setLastUserActivity] = useState<number>(() => Date.now());
  const lastActivityUpdateRef = useRef<number>(Date.now());
  const [activeFeedbackSurface, setActiveFeedbackSurface] = useState<'none' | 'message' | 'csat'>('none');
  const [suppressCsatUntil, setSuppressCsatUntil] = useState<number>(0);
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, 'up' | 'down'>>({});
  const [csatReasons, setCsatReasons] = useState<FeedbackReasonCode[]>([]);
  const [csatReasonOther, setCsatReasonOther] = useState('');
  const [csatError, setCsatError] = useState<string | null>(null);

  // Marca última atividade do usuário (keydown, click, scroll)
  useEffect(() => {
    const markActivity = () => {
      const now = Date.now();
      if (now - lastActivityUpdateRef.current < 1000) return;
      lastActivityUpdateRef.current = now;
      setLastUserActivity(now);
    };
    const events: Array<keyof WindowEventMap> = ['keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, markActivity));
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Atualiza timestamp quando chega mensagem do assistant (fim da resposta)
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.sender === 'consultant');
    const key = lastAssistant?.messageId || lastAssistant?.text || null;
    if (key && lastAssistantKeyRef.current !== key) {
      lastAssistantKeyRef.current = key;
      setLastAssistantTs(Date.now());
    }
  }, [messages]);

  useEffect(() => {
    firstFeedbackTrackedRef.current = false;
    scrollDepthRef.current.clear();
  }, [sessionId, effectiveThreadId]);

  // Gatilho de CSAT por inatividade com período de graça pós-resposta
  useEffect(() => {
    if (!sessionId) return;
    if (csatSent || csatPrompted || csatDismissed) return;
    if (!lastAssistantTs) return;
    if (activeFeedbackSurface !== 'none') return;
    const now = Date.now();
    if (now < suppressCsatUntil) return;
    const INACTIVITY_MS = 90_000;
    const GRACE_MS = 15_000;
    const MIN_DELAY_MS = 2_000;
    const target = Math.max(lastAssistantTs + GRACE_MS, lastUserActivity + INACTIVITY_MS);
    const delay = Math.max(target - now, MIN_DELAY_MS);
    const timer = window.setTimeout(() => {
      if (isSending) return;
      if (input.trim().length > 0) return;
      setCsatVisible(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [sessionId, csatSent, csatPrompted, csatDismissed, lastAssistantTs, lastUserActivity, isSending, input, activeFeedbackSurface, suppressCsatUntil]);

  const submitCsat = async (score: number) => {
    if (!sessionId || csatSent) return;
    try {
      const reasonCodes = score <= 3 ? csatReasons : [];
      const combinedComment = (() => {
        const base = csatComment.trim();
        const other = csatReasonOther.trim();
        if (reasonCodes.includes('other') && other) {
          return base ? `${base} | Motivo: ${other}` : `Motivo: ${other}`;
        }
        return base || null;
      })();
      await fetch('/api/chat/feedback/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, csat: score, comment: combinedComment, reasonCodes }),
      });
      setCsatSent(true);
      setCsatVisible(false);
      setCsatScore(score);
      setCsatError(null);
    } catch (e) {
      console.error('Falha ao enviar CSAT', e);
    }
  };

  useEffect(() => {
    if (csatVisible && sessionId && !csatPrompted) {
      fetch('/api/chat/feedback/csat-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => { /* ignore */ });
      setCsatPrompted(true);
    }
  }, [csatVisible, sessionId, csatPrompted]);

  const defaultPrompts = React.useMemo(() => ([
    { label: "narrativa que gera compartilhamentos", requiresIG: true },
    { label: "melhor dia/hora pra postar por formato", requiresIG: true },
    { label: "planejamento baseado em categorias", requiresIG: true },
    { label: "ranking dos meus melhores formatos", requiresIG: true },
  ]), []);

  const toggleCsatReason = (code: FeedbackReasonCode) => {
    setCsatReasons((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      return [...prev, code];
    });
    setCsatError(null);
  };

  const handleCsatSubmit = () => {
    if (!csatScore) {
      setCsatError('Escolha uma nota');
      return;
    }
    if (csatScore <= 3 && csatReasons.length === 0) {
      setCsatError('Selecione pelo menos um motivo');
      return;
    }
    if (csatScore <= 3 && csatReasons.includes('other') && !csatReasonOther.trim()) {
      setCsatError('Descreva o motivo em "outro"');
      return;
    }
    setCsatError(null);
    submitCsat(csatScore);
  };

  const enterMessageFeedback = useCallback(() => {
    setActiveFeedbackSurface('message');
    setSuppressCsatUntil(Date.now() + 120_000);
    setCsatVisible(false);
  }, []);

  const exitMessageFeedback = useCallback(() => {
    setActiveFeedbackSurface('none');
  }, []);

  // Busca feedback existente da sessão para mostrar ícones já ativos
  useEffect(() => {
    if (!sessionId) return;
    let aborted = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/chat/feedback/session?sessionId=${sessionId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (aborted) return;
        const map: Record<string, 'up' | 'down'> = {};
        (data?.feedback || []).forEach((f: any) => {
          if (f?.messageId && (f.rating === 'up' || f.rating === 'down')) {
            map[f.messageId] = f.rating;
          }
        });
        setFeedbackByMessage(map);
      } catch {
        // ignora
      }
    };
    load();
    return () => {
      aborted = true;
    };
  }, [sessionId]);

  const welcomePrompts = React.useMemo(() => {
    const prompts: Array<{ label: string; requiresIG?: boolean }> = [];
    const nicheHint = surveyProfile?.niches?.[0];
    const mainGoal = surveyProfile?.mainGoal3m;
    const hardestStage = surveyProfile?.hardestStage?.[0];
    const pricingFear = surveyProfile?.pricingFear;
    const wantsPublis = surveyProfile?.hasDoneSponsoredPosts && surveyProfile.hasDoneSponsoredPosts !== 'nunca-sem-interesse';
    const nextPlatform = surveyProfile?.nextPlatform?.find(Boolean);
    const mainReason = surveyProfile?.mainPlatformReasons?.[0];
    const stage = surveyProfile?.stage?.[0];

    if (mainGoal === 'aumentar-engajamento' || hardestStage === 'planejar') {
      prompts.push({
        label: `roteiro de 3 posts para ${nicheHint || 'meu nicho'} focando em salvamentos/compartilhamentos`,
        requiresIG: true,
      });
    }
    if (mainReason === 'metricas') {
      prompts.push({
        label: "o que meus últimos posts dizem sobre tema e formato",
        requiresIG: true,
      });
    }
    if (mainReason === 'media-kit' || mainReason === 'negociar' || pricingFear) {
      prompts.push({
        label: "simular contraproposta de publi com preço seguro",
        requiresIG: false,
      });
    }
    if (pricingFear || wantsPublis) {
      prompts.push({
        label: "simular contraproposta de publi com preço seguro",
        requiresIG: false,
      });
    }
    if (stage === 'iniciante' || stage === 'hobby') {
      prompts.push({
        label: `primeiros 3 posts para ${nicheHint || 'meu nicho'} (simples e rápidos)`,
        requiresIG: false,
      });
    }
    if (nextPlatform && nextPlatform !== 'nenhuma') {
      const nextLabel = nextPlatform === 'outra' ? 'meu próximo canal' : nextPlatform;
      prompts.push({
        label: `plano rápido para começar no ${nextLabel} com 3 conteúdos de teste`,
        requiresIG: false,
      });
    }

    if (!prompts.length) return defaultPrompts;
    const seen = new Set<string>();
    const unique = prompts.filter((p) => {
      if (seen.has(p.label)) return false;
      seen.add(p.label);
      return true;
    });
    return unique.slice(0, 4);
  }, [defaultPrompts, surveyProfile]);

  return (
    <div
      ref={panelRef}
      className="relative flex flex-col w-full bg-white overflow-hidden min-h-0"
      style={{
        height: fullHeight ? '100%' : 'auto',
        minHeight: '0px',
      }}
    >
      {tapDebugEnabled && tapDebugState ? (
        <div className="fixed right-2 top-2 z-[9999] pointer-events-none rounded-md bg-black/80 px-2 py-1 text-[10px] leading-tight text-white">
          <div>
            inner: {tapDebugState.innerHeight ?? "-"} / vv: {tapDebugState.viewportHeight ?? "-"}
          </div>
          <div>--app-height: {tapDebugState.appHeightVar ?? "-"}</div>
          <div>--composer-h: {tapDebugState.composerHeightVar ?? "-"}</div>
          <div>active: {tapDebugState.activeElement ?? "-"}</div>
          <div>top: {tapDebugState.lastTapTarget ?? "-"}</div>
          <div>event: {tapDebugState.lastTapType ?? "-"}</div>
        </div>
      ) : null}


      {/* timeline (único scroll) */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide overscroll-contain px-3 py-5 sm:px-4 sm:py-6"
        style={{
          paddingBottom: '2.5rem',
          scrollPaddingBottom: '2.5rem',
          scrollbarGutter: 'stable',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {topSlot ? (
          <div className="mx-auto w-full max-w-6xl">
            {topSlot}
          </div>
        ) : null}
        {isWelcome ? (
          <div className="h-full flex flex-col items-center justify-center pb-10">
            <div className="w-full max-w-6xl text-center px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="text-3xl sm:text-6xl font-bold tracking-tight text-gray-900 mb-4">
                  Olá, <span className="text-brand-primary">{firstName}</span>
                </h1>
                <p className="text-lg sm:text-2xl text-gray-500 font-medium">O que vamos criar hoje?</p>
                {surveyReminderLabel ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 border border-amber-200">
                    <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                    Pesquisa desatualizada? Refaça em 2 minutos para respostas mais alinhadas.
                  </div>
                ) : null}
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
          <div className="relative mx-auto max-w-6xl w-full pb-4">
            {messages.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Visualização</span>
                  <div className="flex items-center rounded-full border border-gray-200 bg-white p-0.5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => handleToggleViewMode('reading')}
                      aria-pressed={viewMode === 'reading'}
                      data-testid="chat-mode-read"
                      className={`rounded-full px-3 py-1 font-semibold transition-colors ${viewMode === 'reading'
                        ? 'bg-brand-primary text-white'
                        : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Leitura
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleViewMode('compact')}
                      aria-pressed={viewMode === 'compact'}
                      data-testid="chat-mode-compact"
                      className={`rounded-full px-3 py-1 font-semibold transition-colors ${viewMode === 'compact'
                        ? 'bg-brand-primary text-white'
                        : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Compacto
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {showSummaryActions && hasSummary ? (
                    <button
                      type="button"
                      onClick={() => handleCopySection('summary', summaryText)}
                      className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold text-gray-600 shadow-sm transition-colors hover:border-brand-primary/40 hover:text-gray-900"
                    >
                      {copiedSection === 'summary' ? 'Resumo copiado' : 'Copiar resumo'}
                    </button>
                  ) : null}
                  {showSummaryActions && hasActions ? (
                    <button
                      type="button"
                      onClick={() => handleCopySection('actions', actionsText)}
                      className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold text-gray-600 shadow-sm transition-colors hover:border-brand-primary/40 hover:text-gray-900"
                    >
                      {copiedSection === 'actions' ? 'Ações copiadas' : 'Copiar ações'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleToggleDisclosures}
                    disabled={!hasDisclosure}
                    data-testid="chat-disclosure-toggle"
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold text-gray-600 shadow-sm transition-colors hover:border-brand-primary/40 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {disclosureOpen ? 'Recolher tudo' : 'Expandir tudo'}
                  </button>
                </div>
              </div>
            ) : null}
            <ul role="list" aria-live="polite" className={messageSpacingClass}>
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.messageId ? `msg-${msg.messageId}` : `msg-${idx}`}
                  message={msg}
                  virtualize={shouldVirtualize}
                  onUpsellClick={onUpsellClick}
                  onConnectInstagram={handleCorrectInstagramLink}
                  onEvidenceAction={(prompt) => sendPrompt(prompt, { skipInputReset: true })}
                  onSendPrompt={(prompt) => sendPrompt(prompt, { skipInputReset: true })}
                  onFeedbackStart={enterMessageFeedback}
                  onFeedbackEnd={exitMessageFeedback}
                  onFeedbackSubmitted={(rating, messageId) => {
                    setLastUserActivity(Date.now());
                    if (messageId && (rating === 'up' || rating === 'down')) {
                      setFeedbackByMessage((prev) => ({ ...prev, [messageId]: rating }));
                    }
                    if (!firstFeedbackTrackedRef.current && lastAssistantTs) {
                      firstFeedbackTrackedRef.current = true;
                      track('chat_time_to_feedback', {
                        ms_since_response: Date.now() - lastAssistantTs,
                        rating,
                        session_id: sessionId || null,
                        thread_id: effectiveThreadId || null,
                      });
                    }
                    if (rating === 'up' || rating === 'down') {
                      track('chat_message_feedback', {
                        rating,
                        message_id: messageId || null,
                        session_id: sessionId || null,
                        thread_id: effectiveThreadId || null,
                      });
                    }
                  }}
                  initialFeedback={msg.messageId ? feedbackByMessage[msg.messageId] : undefined}
                  renderOptions={messageRenderOptions}
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
                    <div className="max-w-[92%] sm:max-w-[80%] lg:max-w-[72ch]">
                      <ThinkingIndicator />
                    </div>
                  </motion.li>
                )}
              </AnimatePresence>
            </ul>
            <div
              ref={messagesEndRef}
              className="h-px"
              style={{ scrollMarginBottom: 'calc(var(--composer-h, 160px) + 16px)' }}
            />
          </div>
        )}
      </div>

      {
        pendingAction ? (
          <div className="px-4 pb-2">
            <div className="mx-auto max-w-6xl rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 shadow-sm">
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
                {pendingAction?.type === 'survey_update_request' ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                    onClick={() => router.push('/#etapa-5-pesquisa')}
                  >
                    Atualizar pesquisa agora
                  </button>
                ) : null}
                {sessionId ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300"
                    onClick={() => {
                      setCsatDismissed(false);
                      setCsatVisible(true);
                    }}
                  >
                    Encerrar conversa
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null
      }

      {/* CSAT prompt */}
      {sessionId && csatVisible && !csatSent ? (
        <div className="fixed bottom-4 right-4 z-30 max-w-sm w-[320px]">
          <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">Essa conversa te ajudou?</p>
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      className={`h-8 w-8 rounded-full border text-sm font-semibold transition-colors ${csatScore === score
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-gray-200 text-gray-700 hover:border-brand-primary hover:text-brand-primary'}`}
                      onClick={() => {
                        setCsatScore(score);
                        if (score > 3) {
                          setCsatReasons([]);
                          setCsatReasonOther('');
                        }
                        setCsatError(null);
                        if (score > 3) handleCsatSubmit();
                      }}
                      disabled={csatSent}
                      aria-pressed={csatScore === score}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setCsatVisible(false);
                  setCsatDismissed(true);
                  setCsatPrompted(true);
                }}
              >
                Agora não
              </button>
            </div>
            {csatScore !== null && csatScore <= 3 ? (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-[12px] font-semibold text-gray-700">O que faltou?</p>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_REASONS.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => toggleCsatReason(opt.code)}
                      className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${csatReasons.includes(opt.code)
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-gray-200 text-gray-600 hover:border-rose-200 hover:text-rose-700'}`}
                      disabled={csatSent}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {csatReasons.includes('other') ? (
                  <textarea
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-brand-primary focus:outline-none"
                    placeholder="Conte rapidamente o que houve"
                    value={csatReasonOther}
                    onChange={(e) => {
                      setCsatReasonOther(e.target.value);
                      setCsatError(null);
                    }}
                    disabled={csatSent}
                    rows={2}
                  />
                ) : null}
                <button
                  type="button"
                  className="self-end rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-primary-dark"
                  onClick={handleCsatSubmit}
                  disabled={csatSent}
                >
                  Enviar
                </button>
              </div>
            ) : null}
            <div className="mt-2 text-[11px] text-rose-600 min-h-[16px]">{csatError}</div>
            {csatSent ? (
              <p className="text-xs font-semibold text-emerald-600">Feedback registrado. Obrigado! 🌟</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Composer — Fixed at bottom */}
      <div ref={inputWrapperRef} className="flex-none">
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
        threads={threads}
        threadsLoading={threadsLoading}
        threadsLoadingMore={threadsLoadingMore}
        threadsError={threadsError}
        threadsHasMore={hasMore}
        onRefreshThreads={refreshThreads}
        onLoadMoreThreads={loadMoreThreads}
        onSelectThread={(id) => {
          selectThread(id);
          setAlertsOpen(false);
        }}
        onNewChat={() => {
          handleNewChat();
          setAlertsOpen(false);
        }}
        onToggleFavorite={(threadId, nextFavorite) => toggleFavorite(threadId, nextFavorite)}
        onDeleteThread={(threadId) => {
          deleteThread(threadId);
          if (effectiveThreadId === threadId) {
            handleNewChat();
          }
        }}
        onRenameThread={(threadId, title) => renameThread(threadId, title)}
        selectedThreadId={effectiveThreadId}
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
            className="absolute right-6 z-20 p-3 bg-brand-primary text-white rounded-full shadow-lg hover:bg-brand-primary-dark transition-colors"
            style={{ bottom: 'calc(var(--composer-h, 80px) + 1rem)' }}
            aria-label="Voltar ao fim"
          >
            <FaArrowDown />
          </motion.button>
        )}
      </AnimatePresence>

    </div >
  );
}
