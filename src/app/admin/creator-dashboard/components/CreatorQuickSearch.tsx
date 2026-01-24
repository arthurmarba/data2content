"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { SearchBar } from "@/app/components/SearchBar";
import { UserAvatar } from "@/app/components/UserAvatar";
import type { AdminCreatorListItem } from "@/types/admin/creators";
import { useCreatorSearch } from "@/hooks/useCreatorSearch";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { AnimatePresence, motion } from "framer-motion";

const CreatorBadge = ({
  name,
  photoUrl,
  onClear,
}: {
  name: string;
  photoUrl?: string | null;
  onClear: () => void;
}) => (
  <motion.div
    layoutId="creatorBadge"
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    className="flex items-center gap-2 bg-indigo-100 text-indigo-800 text-sm font-medium px-2 py-1 rounded-full"
  >
    <UserAvatar name={name} src={photoUrl} size={24} />
    <span>{name}</span>
    <button onClick={onClear} className="p-0.5 rounded-full hover:bg-indigo-200">
      <XMarkIcon className="w-4 h-4" />
    </button>
  </motion.div>
);

const ResultItem = ({ creator, highlight, isHighlighted, ...props }: any) => (
  <motion.button
    type="button"
    layout
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    className={`flex items-center w-full text-left px-3 py-2.5 rounded-md transition-colors duration-150 ${isHighlighted ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'
      }`}
    {...props}
  >
    <UserAvatar name={creator.name} src={creator.profilePictureUrl} size={32} />
    <div className="ml-3 flex flex-col items-start">
      <span className={`text-sm font-semibold ${isHighlighted ? 'text-white' : 'text-gray-900'}`}>
        <HighlightMatch text={creator.name} highlight={highlight} />
      </span>
      <span className={`text-xs ${isHighlighted ? 'text-indigo-200' : 'text-gray-500'}`}>
        <HighlightMatch text={creator.email} highlight={highlight} />
      </span>
    </div>
  </motion.button>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center text-center p-4 text-sm text-gray-500">
    <MagnifyingGlassIcon className="w-8 h-8 text-gray-300 mb-2" />
    <p className="font-medium">Nenhum criador encontrado.</p>
    <p className="text-xs">Tente refinar seu termo de busca.</p>
  </div>
);

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

interface CreatorQuickSearchProps {
  onSelect: (creator: { id: string; name: string; profilePictureUrl?: string | null }) => void;
  selectedCreatorName?: string | null;
  selectedCreatorPhotoUrl?: string | null;
  onClear: () => void;
  apiPrefix?: string;
}

export default function CreatorQuickSearch({
  onSelect,
  selectedCreatorName,
  selectedCreatorPhotoUrl,
  onClear,
  apiPrefix = '/api/admin',
}: CreatorQuickSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { results: creators, isLoading, error } = useCreatorSearch(searchTerm, { minChars: 2, apiPrefix });
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleSelect = useCallback((creator: AdminCreatorListItem) => {
    onSelect({ id: creator._id, name: creator.name, profilePictureUrl: creator.profilePictureUrl });
    setSearchTerm("");
    setShowDropdown(false);
  }, [onSelect]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (creators.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((p) => (p + 1) % creators.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((p) => (p - 1 + creators.length) % creators.length); }
      else if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault();
        const selectedCreator = creators[highlightIndex];
        if (selectedCreator) {
          handleSelect(selectedCreator);
        }
      }
      else if (e.key === 'Escape') { e.preventDefault(); setShowDropdown(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDropdown, creators, highlightIndex, handleSelect]);

  const showResults = showDropdown && searchTerm.length >= 2;

  return (
    <div className="relative w-80 sm:w-96" ref={containerRef}>
      <SearchBar
        value={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          if (val.length > 0) setShowDropdown(true);
          else setShowDropdown(false);
        }}
        placeholder="Buscar criador (mín. 2 caracteres)"
        ariaLabel="Buscar criador"
        isLoading={isLoading}
        variant="minimal"
        debounceMs={0}
        // ===== CORREÇÃO APLICADA AQUI =====
        // Desabilita o campo de busca apenas se houver um criador selecionado
        disabled={!!selectedCreatorName}
      >
        <AnimatePresence>
          {selectedCreatorName && (
            <CreatorBadge
              name={selectedCreatorName}
              photoUrl={selectedCreatorPhotoUrl}
              onClear={onClear}
            />
          )}
        </AnimatePresence>
      </SearchBar>

      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-20 left-0 top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-xl p-2 max-h-80 overflow-auto"
          >
            {isLoading && <div className="p-2 text-sm text-center text-gray-500">Carregando...</div>}
            {error && <p className="p-3 text-sm text-red-600 font-medium">{error}</p>}
            {!isLoading && !error && creators.length === 0 && <EmptyState />}

            <AnimatePresence>
              {!isLoading && !error && creators.map((creator, index) => (
                <ResultItem
                  key={creator._id}
                  creator={creator}
                  highlight={searchTerm}
                  isHighlighted={highlightIndex === index}
                  onMouseDown={(e: React.MouseEvent) => {
                    e.preventDefault();
                    handleSelect(creator);
                  }}
                  onMouseMove={() => setHighlightIndex(index)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
