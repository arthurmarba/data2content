import React, { useState, useEffect, useRef } from "react";
import { SearchBar } from "@/app/components/SearchBar";
import { UserAvatar } from "@/app/components/UserAvatar";
import type { AdminCreatorListItem } from "@/types/admin/creators";
import { useCreatorSearch } from "@/hooks/useCreatorSearch";

export interface ComparisonTarget {
  type: "user" | "segment";
  id: string;
  label: string;
}

interface ComparisonTargetSearchProps {
  segments: { value: string; label:string }[];
  onSelect: (target: ComparisonTarget) => void;
}

export default function ComparisonTargetSearch({ segments, onSelect }: ComparisonTargetSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { results: userResults, isLoading, error } = useCreatorSearch(searchTerm);
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

  const handleSelectUser = (user: AdminCreatorListItem) => {
    onSelect({ type: "user", id: user._id, label: user.name });
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handleSelectSegment = (segment: { value: string; label: string }) => {
    onSelect({ type: "segment", id: segment.value, label: segment.label });
    setSearchTerm("");
    setShowDropdown(false);
  };

  const filteredSegments = segments.filter(seg =>
    seg.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <SearchBar
        value={searchTerm}
        onSearchChange={val => {
          setSearchTerm(val);
          setShowDropdown(true);
        }}
        placeholder="Buscar usuário ou segmento..."
        // ===== CORREÇÃO APLICADA AQUI: Prop 'debounceMs' removida =====
        className="w-60"
      />
      {showDropdown && (searchTerm || isLoading) && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading && <p className="p-2 text-sm text-gray-500">Carregando...</p>}
          {error && <p className="p-2 text-sm text-red-600">{error}</p>}
          {!isLoading && !error && filteredSegments.length === 0 && userResults.length === 0 && (
            <p className="p-2 text-sm text-gray-500">Nenhum resultado encontrado.</p>
          )}
          {filteredSegments.map(seg => (
            <button
              key={`seg-${seg.value}`}
              className="flex items-center w-full text-left px-3 py-2 hover:bg-gray-100"
              onClick={() => handleSelectSegment(seg)}
            >
              <span className="text-sm text-gray-800">{seg.label}</span>
            </button>
          ))}
          {userResults.map(user => (
            <button
              key={`user-${user._id}`}
              className="flex items-center w-full text-left px-3 py-2 hover:bg-gray-100"
              onClick={() => handleSelectUser(user)}
            >
              <UserAvatar name={user.name} src={user.profilePictureUrl} size={24} />
              <span className="ml-2 text-sm text-gray-800">{user.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}