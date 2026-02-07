import React, { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaPaperPlane, FaInstagram, FaCheckCircle, FaExclamationTriangle, FaBell } from 'react-icons/fa';
import { ToolsDrawer } from './ToolsDrawer';

interface ComposerProps {
    input: string;
    setInput: (value: string) => void;
    onSend: () => void;
    isSending: boolean;
    inlineAlert: string | null;
    onOpenTools: () => void;
    isToolsOpen: boolean;
    onCloseTools: () => void;
    onOpenAlerts: () => void;
    isAlertsOpen: boolean;
    onCloseAlerts: () => void;
    alertsBadgeCount: number;
    instagramConnected: boolean;
    onConnectInstagram: () => void;
    instagramUsername: string | null;
    isActiveLikePlan: boolean;
    isAdmin: boolean;
    currentUserId?: string;
    currentUserName?: string | null;
    selectedTargetLabel: string;
    onSelectUser: (userId: string, label: string) => void;
    onClearChat: () => void;
}

export const Composer = React.memo(function Composer({
    input,
    setInput,
    onSend,
    isSending,
    inlineAlert,
    onOpenTools,
    isToolsOpen,
    onCloseTools,
    onOpenAlerts,
    isAlertsOpen,
    onCloseAlerts,
    alertsBadgeCount,
    instagramConnected,
    onConnectInstagram,
    instagramUsername,
    isActiveLikePlan,
    isAdmin,
    currentUserId,
    currentUserName,
    selectedTargetLabel,
    onSelectUser,
    onClearChat,
}: ComposerProps) {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const suppressNextClickRef = useRef(false);
    const suppressTimeoutRef = useRef<number | null>(null);

    const dismissActiveInput = useCallback(() => {
        if (typeof document === 'undefined') return false;
        const active = document.activeElement as HTMLElement | null;
        if (!active) return false;
        const tagName = active.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || active.isContentEditable) {
            active.blur();
            return true;
        }
        return false;
    }, []);

    const triggerTouchAction = useCallback(
        (action: () => void, event: { preventDefault: () => void }) => {
            if (suppressNextClickRef.current) return;
            const didBlur = dismissActiveInput();
            if (!didBlur) return;
            suppressNextClickRef.current = true;
            event.preventDefault();
            if (typeof window !== 'undefined') {
                if (suppressTimeoutRef.current) {
                    window.clearTimeout(suppressTimeoutRef.current);
                }
                suppressTimeoutRef.current = window.setTimeout(() => {
                    suppressNextClickRef.current = false;
                    suppressTimeoutRef.current = null;
                }, 700);
            }
            action();
        },
        [dismissActiveInput]
    );

    const handlePointerActivation = useCallback(
        (action: () => void, event: React.PointerEvent<HTMLElement>) => {
            if (event.pointerType === 'mouse') return;
            triggerTouchAction(action, event);
        },
        [triggerTouchAction]
    );

    const runWithClickSuppression = useCallback((action: () => void) => {
        if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            if (suppressTimeoutRef.current) {
                window.clearTimeout(suppressTimeoutRef.current);
                suppressTimeoutRef.current = null;
            }
            return;
        }
        action();
    }, []);

    useEffect(() => {
        return () => {
            if (suppressTimeoutRef.current) {
                window.clearTimeout(suppressTimeoutRef.current);
                suppressTimeoutRef.current = null;
            }
        };
    }, []);

    const toggleAlerts = useCallback(() => {
        if (isAlertsOpen) {
            onCloseAlerts();
        } else {
            onOpenAlerts();
        }
    }, [isAlertsOpen, onCloseAlerts, onOpenAlerts]);

    // auto-resize do textarea
    useEffect(() => {
        const el = textAreaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [input]);

    return (
        <div className="relative z-20 w-full flex-none border-t border-gray-100 bg-white/95 px-3 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-sm sm:px-4">
            <div className="mx-auto max-w-6xl relative">
                <ToolsDrawer
                    isOpen={isToolsOpen}
                    onClose={onCloseTools}
                    instagramConnected={instagramConnected}
                    onConnectInstagram={onConnectInstagram}
                    isActiveLikePlan={isActiveLikePlan}
                    isAdmin={isAdmin}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    selectedTargetLabel={selectedTargetLabel}
                    onSelectUser={onSelectUser}
                    onClearChat={onClearChat}
                />

                <AnimatePresence>
                    {inlineAlert && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                            role="alert"
                        >
                            <FaExclamationTriangle className="flex-shrink-0" />
                            <span>{inlineAlert}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="relative flex items-end gap-1.5 rounded-2xl border border-gray-200 bg-gray-50/80 p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors focus-within:border-gray-300 focus-within:bg-white sm:gap-2">
                    <div className="flex items-center gap-1">
                        <button
                            onPointerDown={(event) => handlePointerActivation(onOpenTools, event)}
                            onClick={() => runWithClickSuppression(onOpenTools)}
                            className={`relative flex h-11 w-11 touch-manipulation items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${isToolsOpen ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                            aria-label="Abrir ferramentas"
                            title="Ferramentas"
                        >
                            <FaPlus />
                        </button>

                        <button
                            onPointerDown={(event) => handlePointerActivation(toggleAlerts, event)}
                            onClick={() => runWithClickSuppression(toggleAlerts)}
                            className={`relative flex h-11 w-11 touch-manipulation flex-shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${isAlertsOpen ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                            aria-label="Abrir conversas"
                            title="Conversas"
                        >
                            <FaBell className="text-[12px] sm:text-[13px]" />
                            {alertsBadgeCount > 0 && (
                                <span className="absolute -right-1 -top-0.5 inline-flex min-w-[18px] rounded-full bg-red-500 px-1.5 py-[2px] text-[10px] font-bold leading-none text-white">
                                    {alertsBadgeCount > 99 ? '99+' : alertsBadgeCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <textarea
                        ref={textAreaRef}
                        value={input}
                        rows={1}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!isSending) onSend();
                            }
                        }}
                        placeholder="Digite sua mensagem..."
                        className="max-h-[200px] min-h-[44px] flex-1 resize-none overflow-hidden rounded-xl border-0 bg-transparent px-2 py-2 text-[15px] leading-6 text-gray-900 outline-none ring-0 transition-colors placeholder:text-gray-400 focus:bg-white focus:ring-0 break-words"
                        style={{ minHeight: '44px' }}
                        disabled={isSending}
                        data-testid="chat-input"
                    />

                    <motion.button
                        key="send"
                        animate={{
                            scale: input.trim().length > 0 && !isSending ? 1 : 0.9,
                            opacity: input.trim().length > 0 || isSending ? 1 : 0.4
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onSend}
                        className={`flex h-11 w-11 touch-manipulation flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${input.trim().length > 0
                            ? 'bg-gray-900 text-white hover:bg-gray-800'
                            : 'bg-gray-200 text-gray-400'
                            }`}
                        disabled={!input.trim() || isSending}
                        aria-label="Enviar mensagem"
                        data-testid="chat-send"
                    >
                        {isSending ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FaPaperPlane className="w-4 h-4 translate-x-[-1px] translate-y-[1px]" />
                        )}
                    </motion.button>
                </div>

                <div className="mt-1 flex justify-center">
                    {!instagramConnected ? (
                        <button
                            onClick={onConnectInstagram}
                            className="flex items-center gap-1 text-[11px] font-medium text-gray-500 transition-colors hover:text-brand-primary"
                        >
                            <FaInstagram /> Conectar Instagram para respostas mais precisas
                        </button>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <FaCheckCircle className="text-emerald-500" />
                            Conectado como @{instagramUsername}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});
