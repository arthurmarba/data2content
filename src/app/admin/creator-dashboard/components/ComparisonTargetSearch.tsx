import React, { useState, useEffect, useRef } from "react";
import { SearchBar } from "@/app/components/SearchBar";
import { UserAvatar } from "@/app/components/UserAvatar";
import type { AdminCreatorListItem } from "@/types/admin/creators";

export interface ComparisonTarget {
  type: "user" | "segment";
  id: string;
  label: string;
}

interface ComparisonTargetSearchProps {
  segments: { value: string; label: string }[];
  onSelect: (target: ComparisonTarget) => void;
}

export default function ComparisonTargetSearch({ segments, onSelect }: ComparisonTargetSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [userResults, setUserResults] = useState<AdminCreatorListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchTerm) {
      setUserResults([]);
      return;
    }

    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "5", search: searchTerm });
        const resp = await fetch(`/api/admin/creators?${params.toString()}`);
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || "Erro ao buscar criadores");
        }
        const data = await resp.json();
        setUserResults(data.creators || []);
      } catch (e: any) {
        setError(e.message);
        setUserResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [searchTerm]);

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
    setUserResults([]);
    setShowDropdown(false);
  };

  const handleSelectSegment = (segment: { value: string; label: string }) => {
    onSelect({ type: "segment", id: segment.value, label: segment.label });
    setSearchTerm("");
    setUserResults([]);
    setShowDropdown(false);
  };

  const filteredSegments = segments.filter(seg =>
    seg.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <SearchBar
        initialValue=""
        onSearchChange={val => {
          setSearchTerm(val);
          setShowDropdown(true);
        }}
        placeholder="Buscar usuário ou segmento..."
        debounceMs={200}
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

