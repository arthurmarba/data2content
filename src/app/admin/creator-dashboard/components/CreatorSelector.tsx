'use client';

import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, CheckIcon } from '@heroicons/react/24/solid';
import { SearchBar } from '@/app/components/SearchBar';
import { UserAvatar } from '@/app/components/UserAvatar';
import { useCreatorSearch } from '@/hooks/useCreatorSearch';
import type { AdminCreatorListItem } from '@/types/admin/creators';
import { AnimatePresence, motion } from 'framer-motion';

// Componentes visuais consistentes com o QuickSearch
const HighlightMatch = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
      )}
    </span>
  );
};

const EmptyState = ({ message, subMessage }: { message: string, subMessage: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center text-center p-8 text-sm text-gray-500"
  >
    <MagnifyingGlassIcon className="w-10 h-10 text-gray-300 mb-3" />
    <p className="font-semibold text-gray-600">{message}</p>
    <p className="text-xs">{subMessage}</p>
  </motion.div>
);

interface CreatorSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (creator: { id: string; name: string }) => void;
}

export default function CreatorSelector({ isOpen, onClose, onSelect }: CreatorSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { results: creators, isLoading, error } = useCreatorSearch(isOpen ? searchTerm : '', { limit: 10, minChars: 2 });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [selectedId, setSelectedId] = useState<string | null>(null); // Para o feedback de "check"

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
      setSearchTerm('');
      setHighlightIndex(-1);
      setSelectedId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (creators.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(p => (p + 1) % creators.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(p => (p - 1 + creators.length) % creators.length); }
        // ===== CORREÇÃO 1: VERIFICAÇÃO DE TIPO =====
        else if (e.key === 'Enter' && highlightIndex >= 0) {
          e.preventDefault();
          const selectedCreator = creators[highlightIndex];
          if (selectedCreator) {
            handleSelect(selectedCreator);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, creators, highlightIndex]);

  const handleSelect = (creator: AdminCreatorListItem) => {
    setSelectedId(creator._id); // Ativa o "check"
    setTimeout(() => {
      onSelect({ id: creator._id, name: creator.name });
      onClose();
    }, 300); // Delay para o usuário ver o feedback
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg text-gray-800">Selecionar Criador</h3>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </header>
            <div className="p-4">
              <SearchBar
                ref={searchInputRef}
                value={searchTerm}
                onSearchChange={setSearchTerm}
                placeholder="Buscar por nome ou email..."
                autoFocus
                debounceMs={200}
                // ===== CORREÇÃO 2: PROP 'variant' REMOVIDA =====
                isLoading={isLoading}
              />
            </div>
            <div className="min-h-[240px] max-h-80 overflow-y-auto px-2 pb-2">
              {isLoading && <div className="p-4 text-center text-sm text-gray-500">Carregando...</div>}
              {error && <p className="text-sm text-center font-medium text-red-600 p-4">{error}</p>}
              {!isLoading && !error && searchTerm.length < 2 && (
                <EmptyState message="Busque por um criador" subMessage="Digite ao menos 2 caracteres para começar." />
              )}
              {!isLoading && !error && searchTerm.length >= 2 && creators.length === 0 && (
                <EmptyState message="Nenhum resultado" subMessage="Tente um termo de busca diferente." />
              )}
              
              <AnimatePresence>
                {creators.map((creator, index) => (
                  <motion.button
                    layout
                    key={creator._id}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center w-full text-left p-3 my-1 rounded-lg transition-colors duration-150 ${
                        highlightIndex === index ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => handleSelect(creator)}
                    onMouseMove={() => setHighlightIndex(index)}
                  >
                    <UserAvatar name={creator.name} src={creator.profilePictureUrl} size={32} />
                    <div className="ml-3 flex-1 flex flex-col items-start">
                        <span className={`text-sm font-semibold ${highlightIndex === index ? 'text-white' : 'text-gray-900'}`}>
                            <HighlightMatch text={creator.name} highlight={searchTerm} />
                        </span>
                        <span className={`text-xs ${highlightIndex === index ? 'text-indigo-200' : 'text-gray-500'}`}>
                            <HighlightMatch text={creator.email} highlight={searchTerm} />
                        </span>
                    </div>
                    {/* Otimização de Design: Feedback de "check" */}
                    {selectedId === creator._id && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                            <CheckIcon className="w-5 h-5 text-white bg-green-500 rounded-full p-0.5" />
                        </motion.div>
                    )}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}