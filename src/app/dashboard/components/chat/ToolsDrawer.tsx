import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaInstagram, FaTrash } from 'react-icons/fa';
import WhatsAppConnectInline from '../../WhatsAppConnectInline';
import { AdminUserSelector } from './AdminUserSelector';

interface ToolsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    instagramConnected: boolean;
    onConnectInstagram: () => void;
    isActiveLikePlan: boolean;
    isAdmin: boolean;
    currentUserId?: string;
    currentUserName?: string | null;
    selectedTargetLabel: string;
    onSelectUser: (userId: string, label: string) => void;
    onClearChat: () => void;
}

export const ToolsDrawer = React.memo(function ToolsDrawer({
    isOpen,
    onClose,
    instagramConnected,
    onConnectInstagram,
    isActiveLikePlan,
    isAdmin,
    currentUserId,
    currentUserName,
    selectedTargetLabel,
    onSelectUser,
    onClearChat,
}: ToolsDrawerProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[100]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className="absolute bottom-full left-0 mb-3 w-full sm:w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-[110] overflow-hidden origin-bottom-left"
                    >
                        <div className="px-4 pb-4 pt-4">
                            <div className="flex justify-between items-center mb-4 px-1">
                                <h3 className="text-base font-semibold text-gray-900">Ferramentas</h3>
                                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {isAdmin && (
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-2">
                                        <AdminUserSelector
                                            currentUserId={currentUserId}
                                            currentUserName={currentUserName}
                                            selectedLabel={selectedTargetLabel}
                                            onSelect={(id, label) => {
                                                onSelectUser(id, label);
                                            }}
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-between w-full text-left p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
                                            <FaInstagram className="text-xl" />
                                        </div>
                                        <div>
                                            <span className="text-sm font-semibold text-gray-900 block">Dados do Instagram</span>
                                            <p className="text-xs text-gray-500">Personalize as respostas com seus dados.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onConnectInstagram}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${instagramConnected ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                        disabled={instagramConnected}
                                    >
                                        <span aria-hidden="true" className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${instagramConnected ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => {
                                        onClearChat();
                                        onClose();
                                    }}
                                    className="flex items-center gap-4 w-full text-left p-4 bg-white hover:bg-red-50 rounded-xl border border-gray-200 transition-colors shadow-sm group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 group-hover:bg-red-200 transition-colors">
                                        <FaTrash className="text-lg" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-semibold text-gray-900 block group-hover:text-red-700 transition-colors">Limpar Conversa</span>
                                        <p className="text-xs text-gray-500 group-hover:text-red-600/70 transition-colors">Apagar histórico atual.</p>
                                    </div>
                                </button>

                                {instagramConnected && isActiveLikePlan && (
                                    <div className="p-1">
                                        <WhatsAppConnectInline />
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
});
