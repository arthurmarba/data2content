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

    const handleTouchStartActivation = useCallback(
        (action: () => void, event: React.TouchEvent<HTMLElement>) => {
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
        <div
            className="sticky bottom-0 left-0 right-0 flex-none bg-white px-4 pt-2 pb-safe z-20 shadow-[0_-6px_24px_-12px_rgba(15,23,42,0.3)]"
        >
            {/* Gradient Fade - Positioned absolutely above the composer */}
            <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/60 to-transparent pointer-events-none" />

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
                            className="mb-3 flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg"
                            role="alert"
                        >
                            <FaExclamationTriangle className="flex-shrink-0" />
                            <span>{inlineAlert}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="relative flex items-end gap-1.5 sm:gap-2 bg-white rounded-[28px] border border-gray-200/80 focus-within:border-brand-primary/40 focus-within:shadow-lg focus-within:shadow-brand-primary/10 transition-all duration-300 p-1.5">
                    <div className="flex items-center gap-1">
                        <button
                            onPointerDown={(event) => handlePointerActivation(onOpenTools, event)}
                            onTouchStart={(event) => handleTouchStartActivation(onOpenTools, event)}
                            onClick={() => runWithClickSuppression(onOpenTools)}
                            className={`relative flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full transition-all ${isToolsOpen ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50`}
                            aria-label="Abrir ferramentas"
                            title="Ferramentas"
                        >
                            <FaPlus />
                        </button>

                        <button
                            onPointerDown={(event) => handlePointerActivation(toggleAlerts, event)}
                            onTouchStart={(event) => handleTouchStartActivation(toggleAlerts, event)}
                            onClick={() => runWithClickSuppression(toggleAlerts)}
                            className={`relative flex-shrink-0 flex items-center justify-center rounded-full px-2.5 sm:px-3 h-10 sm:h-11 text-[12px] sm:text-[13px] font-semibold transition-all border ${isAlertsOpen ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:bg-gray-100'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50`}
                            aria-label="Abrir conversas"
                            title="Conversas"
                        >
                            <FaBell className="text-[12px] sm:text-[13px]" />
                            <span className="hidden sm:inline">Conversas</span>
                            {alertsBadgeCount > 0 && (
                                <span className="ml-2 inline-flex min-w-[18px] rounded-full bg-red-500 px-1.5 py-[2px] text-[10px] font-bold leading-none text-white">
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
                        className="flex-1 min-h-[44px] resize-none overflow-hidden bg-transparent py-2.5 px-2.5 border-0 ring-0 focus:ring-0 outline-none text-[15px] leading-6 placeholder-gray-400 text-gray-900 max-h-[200px] rounded-2xl focus:bg-white/50 transition-colors break-words"
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
                        className={`flex-shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-all duration-300 ${input.trim().length > 0
                            ? 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-md shadow-brand-primary/25'
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

                <div className="mt-2 flex justify-center">
                    {!instagramConnected ? (
                        <button
                            onClick={onConnectInstagram}
                            className="text-xs font-medium text-brand-primary hover:text-brand-primary-dark hover:underline flex items-center gap-1"
                        >
                            <FaInstagram /> Conectar Instagram para melhores resultados
                        </button>
                    ) : (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <FaCheckCircle className="text-emerald-500" />
                            Conectado como @{instagramUsername}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});
