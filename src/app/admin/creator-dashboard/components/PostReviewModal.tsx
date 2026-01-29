'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type ReviewStatus = 'do' | 'dont' | 'almost';

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
    do: 'Fazer',
    dont: 'Não fazer',
    almost: 'Quase lá',
};

interface IPostReviewData {
    _id?: string;
    coverUrl?: string | null;
    creatorName?: string;
    text_content?: string;
    description?: string;
}

interface PostReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    post: IPostReviewData | null;
    apiPrefix: string;
}

const PostReviewModal: React.FC<PostReviewModalProps> = ({ isOpen, onClose, post, apiPrefix }) => {
    const [status, setStatus] = useState<ReviewStatus>('do');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !post?._id) return;
        let isMounted = true;
        const fetchReview = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${apiPrefix}/dashboard/post-reviews?postId=${post._id}`);
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Falha ao carregar review.');
                }
                const data = await res.json();
                if (!isMounted) return;
                if (data.review) {
                    setStatus(data.review.status || 'do');
                    setNote(data.review.note || '');
                } else {
                    setStatus('do');
                    setNote('');
                }
            } catch (err: any) {
                if (isMounted) setError(err.message || 'Falha ao carregar review.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchReview();
        return () => {
            isMounted = false;
        };
    }, [isOpen, post, apiPrefix]);

    useEffect(() => {
        if (!isOpen) {
            setStatus('do');
            setNote('');
            setError(null);
            setLoading(false);
            setSaving(false);
        }
    }, [isOpen]);

    const handleSave = async () => {
        if (!post?._id) return;
        const trimmedNote = note.trim();
        if (!trimmedNote) {
            setError('A anotação é obrigatória.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`${apiPrefix}/dashboard/post-reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId: post._id,
                    status,
                    note: trimmedNote,
                }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Falha ao salvar review.');
            }
            onClose();
        } catch (err: any) {
            setError(err.message || 'Falha ao salvar review.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !post) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-lg shadow-xl relative p-6 space-y-4">
                <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:bg-gray-100 rounded-full p-1" aria-label="Fechar">
                    <XMarkIcon className="w-5 h-5" />
                </button>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Marcar conteúdo</h3>
                    <p className="text-sm text-gray-500">Defina a categoria e a anotação para esta análise.</p>
                </div>
                <div className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-100">
                    {post.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={String(post.coverUrl)} alt="capa" className="w-24 h-24 object-cover rounded border shadow-sm" />
                    ) : (
                        <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">Sem img</div>
                    )}
                    <div className="flex-1 text-sm text-gray-600 overflow-hidden">
                        <p className="font-semibold text-gray-800 truncate">{post.creatorName || 'Criador'}</p>
                        <p className="line-clamp-3 mt-1 leading-relaxed">{post.text_content || post.description || 'Sem legenda...'}</p>
                    </div>
                </div>
                {loading ? (
                    <div className="text-sm text-gray-500 flex items-center gap-2 py-4">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        Carregando review...
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="review-status" className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Categoria</label>
                            <select
                                id="review-status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value as ReviewStatus)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                            >
                                {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="review-note" className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Anotação</label>
                            <textarea
                                id="review-note"
                                rows={4}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Escreva observações para a reunião..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none"
                            />
                        </div>
                    </div>
                )}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
                        <XMarkIcon className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading || !note.trim()}
                        className="px-6 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-200"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PostReviewModal;
