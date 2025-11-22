import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, CurrentTaskState } from '../components/chat/types';

interface UseChatProps {
    userWithId?: { id?: string };
    isAdmin: boolean;
    targetUserId: string;
}

export function useChat({ userWithId, isAdmin, targetUserId }: UseChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
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

        setMessages(prev => [...prev, { sender: 'user', text: prompt }]);

        try {
            const payload: Record<string, unknown> = { query: prompt };
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
                setMessages(prev => [...prev, { sender: 'consultant', text: data.answer, cta: data.cta }]);
            } else {
                const errorText = data?.error || "Não foi possível obter resposta agora.";
                autoScrollOnNext.current = true;
                if (data?.cta) {
                    setMessages(prev => [...prev, { sender: 'consultant', text: errorText, cta: data.cta }]);
                } else {
                    setMessages(prev => [...prev, { sender: 'consultant', text: errorText }]);
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
        scrollToBottom
    };
}
