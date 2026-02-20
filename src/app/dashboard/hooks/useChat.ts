import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, CurrentTaskState } from '../components/chat/types';

interface UseChatProps {
    userWithId?: { id?: string };
    isAdmin: boolean;
    targetUserId: string;
    threadId?: string | null;  // [NEW]
    onThreadCreated?: (newThreadId: string) => void;
}

const THREAD_HISTORY_CACHE_TTL_MS = (() => {
    const parsed = Number(process.env.NEXT_PUBLIC_CHAT_THREAD_HISTORY_CACHE_TTL_MS ?? 45_000);
    return Number.isFinite(parsed) && parsed >= 5_000 ? Math.floor(parsed) : 45_000;
})();
const THREAD_HISTORY_CACHE_MAX_ENTRIES = (() => {
    const parsed = Number(process.env.NEXT_PUBLIC_CHAT_THREAD_HISTORY_CACHE_MAX_ENTRIES ?? 80);
    return Number.isFinite(parsed) && parsed >= 20 ? Math.floor(parsed) : 80;
})();

type ThreadHistoryCacheEntry = {
    messages: Message[];
    expiresAt: number;
};

const threadHistoryCache = new Map<string, ThreadHistoryCacheEntry>();
const threadHistoryInFlight = new Map<string, Promise<Message[]>>();

function pruneThreadHistoryCache(nowTs: number) {
    for (const [key, value] of threadHistoryCache.entries()) {
        if (value.expiresAt <= nowTs) threadHistoryCache.delete(key);
    }
    if (threadHistoryCache.size <= THREAD_HISTORY_CACHE_MAX_ENTRIES) return;
    const overflow = threadHistoryCache.size - THREAD_HISTORY_CACHE_MAX_ENTRIES;
    const keys = Array.from(threadHistoryCache.keys());
    for (let i = 0; i < overflow; i += 1) {
        const key = keys[i];
        if (!key) break;
        threadHistoryCache.delete(key);
    }
}

function getCachedThreadHistory(threadId: string): Message[] | null {
    const nowTs = Date.now();
    pruneThreadHistoryCache(nowTs);
    const cached = threadHistoryCache.get(threadId);
    if (!cached || cached.expiresAt <= nowTs) {
        if (cached) threadHistoryCache.delete(threadId);
        return null;
    }
    return cached.messages;
}

function setCachedThreadHistory(threadId: string, messages: Message[]) {
    const nowTs = Date.now();
    pruneThreadHistoryCache(nowTs);
    threadHistoryCache.set(threadId, {
        messages,
        expiresAt: nowTs + THREAD_HISTORY_CACHE_TTL_MS,
    });
}

function toChatMessages(raw: any): Message[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((m: any) => {
        const rawMessageId = m?.messageId ?? m?._id ?? null;
        const rawSessionId = m?.sessionId ?? null;
        return {
            sender: m.role === 'user' ? 'user' : 'consultant',
            text: m.content,
            messageId: rawMessageId ? String(rawMessageId) : null,
            sessionId: rawSessionId ? String(rawSessionId) : null,
        } as Message;
    });
}

async function fetchThreadHistory(threadId: string): Promise<Message[]> {
    const existing = threadHistoryInFlight.get(threadId);
    if (existing) return existing;

    const request = (async () => {
        const res = await fetch(`/api/ai/chat/threads/${threadId}`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const error = new Error(typeof data?.error === 'string' ? data.error : 'Não foi possível carregar o histórico agora.');
            (error as any).status = res.status;
            throw error;
        }

        const mapped = toChatMessages(data?.messages);
        setCachedThreadHistory(threadId, mapped);
        return mapped;
    })();

    threadHistoryInFlight.set(threadId, request);
    try {
        return await request;
    } finally {
        threadHistoryInFlight.delete(threadId);
    }
}

export function useChat({ userWithId, isAdmin, targetUserId, threadId, onThreadCreated }: UseChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [csatPrompted, setCsatPrompted] = useState(false);
    const [inlineAlert, setInlineAlert] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<{ type?: string | null; context?: any } | null>(null);
    const [currentTask, setCurrentTask] = useState<CurrentTaskState | null>(null);

    const autoScrollOnNext = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const historyRequestIdRef = useRef(0);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        if (autoScrollOnNext.current) {
            scrollToBottom();
            autoScrollOnNext.current = false;
        }
    }, [messages, scrollToBottom]);

    const loadThreadHistory = useCallback(async (tId: string) => {
        const requestId = historyRequestIdRef.current + 1;
        historyRequestIdRef.current = requestId;

        const cached = getCachedThreadHistory(tId);
        if (cached) {
            setInlineAlert(null);
            setMessages(cached);
            setTimeout(scrollToBottom, 0);
            return;
        }

        try {
            setMessages([]); // Clear previous
            const mapped = await fetchThreadHistory(tId);
            if (requestId !== historyRequestIdRef.current) return;

            if (mapped.length > 0) {
                setMessages(mapped);
                setTimeout(scrollToBottom, 50);
            } else {
                setMessages([]);
                setInlineAlert('Nenhuma mensagem encontrada para esta conversa.');
            }
        } catch (e: any) {
            if (requestId !== historyRequestIdRef.current) return;
            console.error("Failed to load history", e);
            const status = typeof e?.status === 'number' ? e.status : 0;
            if (status === 401 || status === 403) {
                setInlineAlert('Faça login para ver seu histórico.');
            } else if (status === 404) {
                setInlineAlert('Conversa não encontrada ou removida.');
            } else {
                setInlineAlert('Não foi possível carregar o histórico agora.');
            }
        }
    }, [scrollToBottom, setInlineAlert, setMessages]);

    useEffect(() => {
        if (threadId) {
            loadThreadHistory(threadId);
        } else {
            historyRequestIdRef.current += 1;
            setMessages([]);
        }
    }, [threadId, loadThreadHistory]);

    useEffect(() => {
        if (!threadId) return;
        setCachedThreadHistory(threadId, messages);
    }, [threadId, messages]);

    const sendPrompt = async (promptRaw: string, opts?: { skipInputReset?: boolean }) => {
        setInlineAlert(null);
        const prompt = promptRaw.trim();
        if (!prompt) return;
        if (!userWithId?.id) {
            setInlineAlert('Você precisa estar logado para enviar mensagens.');
            return;
        }
        const trimmedTarget = targetUserId.trim();
        if (isAdmin && !trimmedTarget) {
            setInlineAlert('Selecione um usuário no Admin Mode antes de enviar.');
            return;
        }
        if (isSending) return;
        if (typeof navigator !== 'undefined' && navigator && !navigator.onLine) {
            setInlineAlert('Sem conexão com a internet no momento.');
            return;
        }

        if (!opts?.skipInputReset) setInput("");
        setIsSending(true);
        autoScrollOnNext.current = true;
        setPendingAction(null);

        const localUserMsgId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        setMessages(prev => [...prev, { sender: 'user', text: prompt, messageId: localUserMsgId }]);

        try {
        const payload: Record<string, unknown> = { query: prompt };
        if (threadId) {
            payload.threadId = threadId;
        }
        if (isAdmin) {

                const targetForPayload = trimmedTarget || userWithId?.id;
                if (targetForPayload) {
                    payload.targetUserId = targetForPayload;
                }
            }

            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok && data.answer) {
                setPendingAction(data.pendingAction ?? null);
                setCurrentTask(data.currentTask ?? null);
                autoScrollOnNext.current = true;
                const messageType = (() => {
                    const responseIntent = String(data.intent || data.answerEvidence?.intent || '').toLowerCase();
                    const isScriptIntent = ['script_request', 'humor_script_request', 'proactive_script_accept'].includes(responseIntent);
                    if (isScriptIntent || /\[ROTEIRO\]/i.test(String(data.answer || ''))) return 'script';
                    const taskName = data.currentTask?.name;
                    const isInspirationIntent =
                        data.answerEvidence?.intent_group === 'inspiration' &&
                        Boolean(data.answerEvidence?.asked_for_examples);
                    if (taskName === 'content_plan') return 'content_plan';
                    if (taskName === 'ask_community_inspiration' || isInspirationIntent) return 'community_inspiration';
                    return 'other';
                })();
                setMessages(prev => [
                    ...prev,
                    {
                        sender: 'consultant',
                        text: data.answer,
                        cta: data.cta,
                        messageId: data.assistantMessageId || null,
                        sessionId: data.sessionId || sessionId,
                        messageType,
                        intent: data.intent || data.answerEvidence?.intent || data.pendingAction?.intent || null,
                        answerEvidence: data.answerEvidence || null,
                    },
                ]);
                if (data.sessionId) setSessionId(data.sessionId);
                if (data.userMessageId) {
                    setMessages(prev => prev.map((m) => m.messageId ? m : m.sender === 'user' && m.text === prompt ? { ...m, messageId: data.userMessageId, sessionId: data.sessionId || sessionId } : m));
                }

                if (data.threadId && data.threadId !== threadId && onThreadCreated) {
                    onThreadCreated(data.threadId);
                }
            } else {
                const errorText = data?.error || "Não foi possível obter resposta agora.";
                autoScrollOnNext.current = true;
                if (data?.cta) {
                    setMessages(prev => [...prev, { sender: 'consultant', text: errorText, cta: data.cta, messageType: 'other' }]);
                } else {
                    setMessages(prev => [...prev, { sender: 'consultant', text: errorText, messageType: 'other' }]);
                }
                throw new Error(errorText);
            }
        } catch (e: any) {
            setInlineAlert(e?.message || 'Falha ao consultar a IA. Tente novamente.');
            setPendingAction(null);
            setCurrentTask(null);
        } finally {
            setIsSending(false);
        }
    };

    const clearChat = useCallback(() => {
        setMessages([]);
        setSessionId(null);
        setCsatPrompted(false);
        setPendingAction(null);
        setCurrentTask(null);
        setInlineAlert(null);
    }, []);

    return {
        messages,
        setMessages,
        input,
        setInput,
        isSending,
        inlineAlert,
        setInlineAlert,
        pendingAction,
        setPendingAction,
        currentTask,
        setCurrentTask,
        messagesEndRef,
        autoScrollOnNext,
        sendPrompt,
        clearChat,
        scrollToBottom,
        sessionId,
        csatPrompted,
        setCsatPrompted,
    };
}
