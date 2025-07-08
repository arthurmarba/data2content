"use client";

import React, { useState, useRef, useEffect } from "react";
import { SearchBar } from "@/app/components/SearchBar";
import { UserAvatar } from "@/app/components/UserAvatar";
import type { AdminCreatorListItem } from "@/types/admin/creators";
import { useCreatorSearch } from "@/hooks/useCreatorSearch";

interface CreatorQuickSearchProps {
  onSelect: (creator: { id: string; name: string }) => void;
  selectedCreatorName?: string | null;
  onClear?: () => void;
}

export default function CreatorQuickSearch({
  onSelect,
  selectedCreatorName,
  onClear,
}: CreatorQuickSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { results: creators, isLoading, error } = useCreatorSearch(searchTerm);
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

  useEffect(() => {
    if (!showDropdown) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (creators.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % creators.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((prev) => (prev - 1 + creators.length) % creators.length);
      } else if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault();
        // --- INÍCIO DA CORREÇÃO ---
        const selectedCreator = creators[highlightIndex];
        if (selectedCreator) {
          handleSelect(selectedCreator);
        }
        // --- FIM DA CORREÇÃO ---
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDropdown, creators, highlightIndex]);

  useEffect(() => {
    if (showDropdown && creators.length > 0) {
      setHighlightIndex(0);
    } else {
      setHighlightIndex(-1);
    }
  }, [showDropdown, creators]);

  const handleSelect = (creator: AdminCreatorListItem) => {
    onSelect({ id: creator._id, name: creator.name });
    setSearchTerm("");
    setShowDropdown(false);
  };

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <SearchBar
        initialValue=""
        value={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          setShowDropdown(true);
        }}
        placeholder={selectedCreatorName || "Buscar criador..."}
        debounceMs={200}
        className="w-80 sm:w-96 flex-grow"
        variant="minimal"
        ariaLabel="Buscar criador"
        onClear={() => {
          setSearchTerm("");
          onClear && onClear();
        }}
        showClearWhenEmpty={!!selectedCreatorName}
      />
      {showDropdown && (searchTerm || isLoading) && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading && (
            <p className="p-2 text-sm text-gray-500">Carregando...</p>
          )}
          {error && (
            <p className="p-2 text-sm text-red-600">{error}</p>
          )}
          {!isLoading && !error && creators.length === 0 && (
            <p className="p-2 text-sm text-gray-500">Nenhum criador encontrado.</p>
          )}
          {creators.map((creator, index) => (
            <button
              key={creator._id}
              className={`flex items-center w-full text-left px-3 py-2 hover:bg-gray-100 ${
                highlightIndex === index ? 'bg-indigo-600 text-white' : ''
              }`}
              onClick={() => handleSelect(creator)}
            >
              <UserAvatar name={creator.name} src={creator.profilePictureUrl} size={24} />
              <span className={`ml-2 text-sm ${highlightIndex === index ? 'text-white' : 'text-gray-800'}`}>{creator.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}