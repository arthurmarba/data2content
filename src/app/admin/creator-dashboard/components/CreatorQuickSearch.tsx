"use client";

import React, { useState, useRef, useEffect } from "react";
import { SearchBar } from "@/app/components/SearchBar";
import { UserAvatar } from "@/app/components/UserAvatar";
import { XMarkIcon } from "@heroicons/react/24/solid";
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

  const handleSelect = (creator: AdminCreatorListItem) => {
    onSelect({ id: creator._id, name: creator.name });
    setSearchTerm("");
    setShowDropdown(false);
  };

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <SearchBar
        initialValue=""
        onSearchChange={(val) => {
          setSearchTerm(val);
          setShowDropdown(true);
        }}
        placeholder="Buscar criador..."
        debounceMs={200}
        className="w-48"
      />
      {selectedCreatorName && onClear && (
        <span className="ml-2 flex items-center text-sm text-indigo-700">
          <span className="mr-1">{selectedCreatorName}</span>
          <button
            onClick={onClear}
            className="p-1 rounded-full bg-gray-200 hover:bg-gray-300"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </span>
      )}
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
          {creators.map((creator) => (
            <button
              key={creator._id}
              className="flex items-center w-full text-left px-3 py-2 hover:bg-gray-100"
              onClick={() => handleSelect(creator)}
            >
              <UserAvatar name={creator.name} src={creator.profilePictureUrl} size={24} />
              <span className="ml-2 text-sm text-gray-800">{creator.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
