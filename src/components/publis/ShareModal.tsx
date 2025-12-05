import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, ClipboardDocumentIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    publiId: string | null;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, publiId }) => {
    const [loading, setLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string>(''); // YYYY-MM-DD
    const [liveUpdate, setLiveUpdate] = useState(false);
    const [copied, setCopied] = useState(false);

    // Reset state when opening
    React.useEffect(() => {
        if (isOpen && publiId) {
            setGeneratedLink(null);
            setExpiresAt('');
            setLiveUpdate(false);
            setCopied(false);
        }
    }, [isOpen, publiId]);

    const handleGenerate = async () => {
        if (!publiId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/publis/${publiId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                    liveUpdate,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setGeneratedLink(data.link);
                toast.success('Link gerado com sucesso!');
            } else {
                toast.error(data.error || 'Erro ao gerar link');
            }
        } catch (error) {
            toast.error('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!publiId) return;
        if (!confirm('Tem certeza que deseja revogar o link? O cliente perderá acesso imediatamente.')) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/publis/${publiId}/share/revoke`, {
                method: 'POST',
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Link revogado!');
                onClose();
            } else {
                toast.error(data.error || 'Erro ao revogar');
            }
        } catch (error) {
            toast.error('Erro de conexão');
        } finally {
            setLoading(false);
        }
    }

    const copyToClipboard = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Copiado!');
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                            Compartilhar Publi
                        </Dialog.Title>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {!generatedLink ? (
                            <>
                                <p className="text-sm text-gray-500">
                                    Configure as opções abaixo para gerar um link seguro para o seu cliente.
                                </p>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Expiração (Opcional)
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                        value={expiresAt}
                                        onChange={(e) => setExpiresAt(e.target.value)}
                                        min={format(new Date(), 'yyyy-MM-dd')}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Deixe em branco para acesso permanente até revogação.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        id="liveUpdate"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={liveUpdate}
                                        onChange={(e) => setLiveUpdate(e.target.checked)}
                                    />
                                    <label htmlFor="liveUpdate" className="text-sm text-gray-700">
                                        Atualizar métricas em tempo real (se disponível)
                                    </label>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={handleGenerate}
                                        disabled={loading}
                                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                    >
                                        {loading ? 'Gerando...' : 'Gerar Link Público'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="bg-green-50 p-4 rounded-lg mb-4 text-center">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-2">
                                        <CheckIcon className="h-6 w-6 text-green-600" />
                                    </div>
                                    <h3 className="text-sm font-medium text-green-900">Link pronto!</h3>
                                    <p className="text-xs text-green-700 mt-1">Este link é público e único para esta publi.</p>
                                </div>

                                <div className="relative mt-1 rounded-md shadow-sm">
                                    <input
                                        type="text"
                                        readOnly
                                        className="block w-full rounded-md border-gray-300 pr-10 focus:border-indigo-500 focus:ring-indigo-500 text-sm text-gray-500 bg-gray-50"
                                        value={generatedLink}
                                    />
                                    <button
                                        type="button"
                                        onClick={copyToClipboard}
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                    >
                                        {copied ? <CheckIcon className="h-5 w-5 text-green-500" /> : <ClipboardDocumentIcon className="h-5 w-5" />}
                                    </button>
                                </div>

                                <div className="mt-6 flex flex-col gap-2">
                                    <button
                                        onClick={onClose}
                                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        Fechar
                                    </button>
                                    <button
                                        onClick={handleRevoke}
                                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none"
                                    >
                                        <TrashIcon className="h-4 w-4 mr-1.5" />
                                        Revogar este link
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default ShareModal;
