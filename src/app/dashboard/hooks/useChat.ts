import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, CurrentTaskState } from '../components/chat/types';

interface UseChatProps {
    userWithId?: { id?: string };
    isAdmin: boolean;
    targetUserId: string;
    threadId?: string | null;  // [NEW]
    onThreadCreated?: (newThreadId: string) => void;
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
        try {
            setMessages([]); // Clear previous
            const res = await fetch(`/api/ai/chat/threads/${tId}`);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    setInlineAlert('Faça login para ver seu histórico.');
                } else if (res.status === 404) {
                    setInlineAlert('Conversa não encontrada ou removida.');
                } else {
                    setInlineAlert('Não foi possível carregar o histórico agora.');
                }
                return;
            }
            const data = await res.json();
            if (data.messages) {
                const mapped: Message[] = data.messages.map((m: any) => {
                    const rawMessageId = m?.messageId ?? m?._id ?? null;
                    const rawSessionId = m?.sessionId ?? null;
                    return {
                        sender: m.role === 'user' ? 'user' : 'consultant',
                        text: m.content,
                        messageId: rawMessageId ? String(rawMessageId) : null,
                        sessionId: rawSessionId ? String(rawSessionId) : null,
                    };
                });
                setMessages(mapped);
                setTimeout(scrollToBottom, 50);
            } else {
                setInlineAlert('Nenhuma mensagem encontrada para esta conversa.');
            }
        } catch (e) {
            console.error("Failed to load history", e);
            setInlineAlert('Não foi possível carregar o histórico agora.');
        }
    }, [scrollToBottom, setInlineAlert, setMessages]);

    useEffect(() => {
        if (threadId) {
            loadThreadHistory(threadId);
        } else {
            setMessages([]);
        }
    }, [threadId, loadThreadHistory]);

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
