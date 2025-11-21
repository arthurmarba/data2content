import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaPaperPlane, FaInstagram, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
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
    const inputWrapperRef = useRef<HTMLDivElement>(null);
    const safeBottom = 'env(safe-area-inset-bottom, 0px)';

    // auto-resize do textarea
    useEffect(() => {
        const el = textAreaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [input]);

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

    return (
        <div
            ref={inputWrapperRef}
            className="relative flex-none bg-white px-4 py-2 z-20"
            style={{ paddingBottom: `max(16px, ${safeBottom})` }}
        >
            {/* Gradient Fade - Positioned absolutely above the composer */}
            <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/60 to-transparent pointer-events-none" />

            <div className="mx-auto max-w-3xl relative">
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

                <div className="relative flex items-end gap-2 bg-white rounded-[24px] border border-gray-200 focus-within:border-brand-primary/30 focus-within:shadow-lg focus-within:shadow-brand-primary/5 transition-all duration-300 p-1.5">
                    <button
                        onClick={onOpenTools}
                        className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                        aria-label="Abrir ferramentas"
                        title="Ferramentas"
                    >
                        <FaPlus />
                    </button>

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
                        className="flex-1 resize-none overflow-hidden bg-transparent py-2 px-2 border-0 ring-0 focus:ring-0 outline-none text-[15px] leading-6 placeholder-gray-400 text-gray-900 max-h-[200px]"
                        style={{ minHeight: '40px' }}
                        disabled={isSending}
                    />

                    <motion.button
                        key="send"
                        animate={{
                            scale: input.trim().length > 0 && !isSending ? 1 : 0.9,
                            opacity: input.trim().length > 0 || isSending ? 1 : 0.4
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onSend}
                        className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${input.trim().length > 0
                            ? 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-md shadow-brand-primary/20'
                            : 'bg-gray-200 text-gray-400'
                            }`}
                        disabled={!input.trim() || isSending}
                        aria-label="Enviar mensagem"
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
