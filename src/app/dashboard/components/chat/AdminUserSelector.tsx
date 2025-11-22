import React, { useState, useEffect, useRef } from 'react';
import { FaSearch } from 'react-icons/fa';
import { useCreatorSearch } from '@/hooks/useCreatorSearch';

interface AdminUserSelectorProps {
    currentUserId?: string;
    currentUserName?: string | null;
    selectedLabel: string;
    onSelect: (userId: string, label: string) => void;
}

export function AdminUserSelector({
    currentUserId,
    currentUserName,
    selectedLabel,
    onSelect,
}: AdminUserSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestion, setActiveSuggestion] = useState(-1);
    const suggestionContainerRef = useRef<HTMLDivElement>(null);

    const { results: searchResults, isLoading: searchLoading, error: searchError } = useCreatorSearch(
        searchQuery.trim(),
        { minChars: 2, limit: 6 }
    );

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (!suggestionContainerRef.current) return;
            if (!suggestionContainerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (searchQuery.trim().length < 2 || (!searchLoading && searchResults.length === 0)) {
            setShowSuggestions(false);
            return;
        }
        setShowSuggestions(true);
        setActiveSuggestion(-1);
    }, [searchQuery, searchLoading, searchResults.length]);

    const handleSuggestionSelect = (creator: { _id: string; name?: string; email?: string }) => {
        const label = creator.name || creator.email || creator._id;
        onSelect(creator._id, label);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleManualApply = () => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return;
        const manualLabel = trimmed === (currentUserId || '') ? (currentUserName || 'Meu perfil') : `ID manual: ${trimmed}`;
        onSelect(trimmed, manualLabel);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' && showSuggestions && searchResults.length > 0) {
            event.preventDefault();
            setActiveSuggestion((prev) => {
                const next = prev + 1;
                return next >= searchResults.length ? 0 : next;
            });
            return;
        }
        if (event.key === 'ArrowUp' && showSuggestions && searchResults.length > 0) {
            event.preventDefault();
            setActiveSuggestion((prev) => {
                const next = prev - 1;
                return next < 0 ? searchResults.length - 1 : next;
            });
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            if (showSuggestions && searchResults.length > 0) {
                const index = activeSuggestion >= 0 ? activeSuggestion : 0;
                handleSuggestionSelect(searchResults[index]!);
            } else {
                handleManualApply();
            }
            return;
        }
        if (event.key === 'Escape') {
            setShowSuggestions(false);
            setActiveSuggestion(-1);
        }
    };

    return (
        <div className="w-full" ref={suggestionContainerRef}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Mode</span>
                <div className="flex flex-col items-end leading-tight">
                    <span className="text-[10px] text-gray-400">Contexto atual</span>
                    <span className="text-xs font-medium text-gray-700 max-w-[120px] truncate" title={selectedLabel || 'Meu perfil'}>
                        {selectedLabel || 'Meu perfil'}
                    </span>
                </div>
            </div>

            <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" aria-hidden="true" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => {
                        if (searchQuery.trim().length >= 2 && (searchLoading || searchResults.length > 0)) {
                            setShowSuggestions(true);
                        }
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Buscar usuário..."
                    className="w-full border border-gray-200 rounded-xl bg-gray-50 pl-9 pr-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                    autoCapitalize="none"
                    autoCorrect="off"
                />

                {showSuggestions && (
                    <div className="absolute z-50 bottom-full left-0 right-0 mb-1 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                        {searchLoading && (
                            <div className="px-3 py-2 text-xs text-gray-500">Carregando…</div>
                        )}
                        {searchError && !searchLoading && (
                            <div className="px-3 py-2 text-xs text-red-600">{searchError}</div>
                        )}
                        {!searchLoading && searchResults.length === 0 && !searchError && (
                            <div className="px-3 py-2 text-xs text-gray-500">Nenhum resultado.</div>
                        )}
                        <ul className="max-h-48 overflow-y-auto text-xs">
                            {searchResults.map((creator, index) => {
                                const label = creator.name || creator.email || creator._id;
                                const isActive = index === activeSuggestion;
                                return (
                                    <li
                                        key={creator._id}
                                        className={`cursor-pointer px-3 py-2.5 border-b border-gray-50 last:border-0 ${isActive ? 'bg-brand-primary/5 text-brand-primary' : 'hover:bg-gray-50 text-gray-700'}`}
                                        onMouseEnter={() => setActiveSuggestion(index)}
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            handleSuggestionSelect(creator);
                                        }}
                                    >
                                        <div className="font-medium truncate">{label}</div>
                                        <div className="text-[10px] text-gray-400 truncate">{creator._id}</div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
