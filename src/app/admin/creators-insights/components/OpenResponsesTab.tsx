import React from 'react';
import Section from './Section';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { AdminCreatorSurveyOpenResponse } from '@/types/admin/creatorSurvey';
import { formatDate } from '../utils';

interface OpenResponsesTabProps {
    responses: AdminCreatorSurveyOpenResponse[];
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    search: string;
    onSearchChange: (value: string) => void;
    question: string;
    onQuestionChange: (value: string) => void;
    type: string;
    onTypeChange: (value: string) => void;
    sort: 'recent' | 'oldest' | 'length' | 'relevance';
    onSortChange: (value: 'recent' | 'oldest' | 'length' | 'relevance') => void;
    expanded: Record<string, boolean>;
    onToggleExpand: (id: string) => void;
    questionOptions: { value: string; label: string }[];
    typeOptions: { value: string; label: string }[];
}

export default function OpenResponsesTab({
    responses,
    loading,
    hasMore,
    onLoadMore,
    search,
    onSearchChange,
    question,
    onQuestionChange,
    type,
    onTypeChange,
    sort,
    onSortChange,
    expanded,
    onToggleExpand,
    questionOptions,
    typeOptions,
}: OpenResponsesTabProps) {
    return (
        <Section title="Respostas Abertas" subtitle="Explore o que os criadores dizem em suas próprias palavras.">
            <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="flex-1 relative">
                    <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar nas respostas..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-10 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                </div>
                <select
                    value={question}
                    onChange={(e) => onQuestionChange(e.target.value)}
                    className="rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                    {questionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <select
                    value={type}
                    onChange={(e) => onTypeChange(e.target.value)}
                    className="rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                    {typeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <select
                    value={sort}
                    onChange={(e) => onSortChange(e.target.value as any)}
                    className="rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                    <option value="recent">Mais recentes</option>
                    <option value="oldest">Mais antigas</option>
                    <option value="length">Mais longas</option>
                    <option value="relevance">Relevância (busca)</option>
                </select>
            </div>

            {loading && responses.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Carregando respostas...</div>
            ) : responses.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Nenhuma resposta encontrada com esses filtros.</div>
            ) : (
                <div className="space-y-4">
                    {responses.map((resp) => {
                        const isExpanded = expanded[resp.id];
                        const shouldTruncate = resp.text.length > 300;
                        const displayText = !isExpanded && shouldTruncate ? resp.text.slice(0, 300) + '...' : resp.text;

                        return (
                            <div key={`${resp.id}-${resp.question}`} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:border-indigo-200 transition-colors">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase tracking-wider mb-1">
                                            {resp.questionLabel || resp.question}
                                        </span>
                                        <h4 className="text-sm font-semibold text-gray-900">{resp.name}</h4>
                                        <p className="text-xs text-gray-500">@{resp.username || '—'}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(resp.updatedAt)}</span>
                                </div>
                                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 p-3 rounded-md border border-gray-100 italic">
                                    &ldquo;{displayText}&rdquo;
                                </div>
                                {shouldTruncate && (
                                    <button
                                        onClick={() => onToggleExpand(resp.id)}
                                        className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                    >
                                        {isExpanded ? 'Ver menos' : 'Ver mais'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-gray-500">
                    {loading && responses.length > 0 ? 'Carregando mais...' : ''}
                </span>
                {hasMore && (
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 shadow-sm"
                    >
                        Carregar mais respostas
                    </button>
                )}
            </div>
        </Section>
    );
}
