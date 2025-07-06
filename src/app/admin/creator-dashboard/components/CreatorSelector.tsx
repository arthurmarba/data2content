'use client';

import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { SearchBar } from '@/app/components/SearchBar';
import { UserAvatar } from '@/app/components/UserAvatar';
import { useCreatorSearch } from '@/hooks/useCreatorSearch';

interface CreatorSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (creator: { id: string; name: string }) => void;
}

export default function CreatorSelector({ isOpen, onClose, onSelect }: CreatorSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { results: creators, isLoading, error } = useCreatorSearch(
    isOpen ? searchTerm : '',
    { limit: 10 }
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onClose()}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg text-gray-800">Selecionar Criador</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <SearchBar
            ref={searchInputRef}
            initialValue={searchTerm}
            onSearchChange={(val) => setSearchTerm(val)}
            placeholder="Buscar por nome ou email..."
            autoFocus={isOpen}
            debounceMs={200}
          />
          <div className="max-h-60 overflow-y-auto divide-y">
            {isLoading && <p className="text-sm text-gray-500 p-2">Carregando...</p>}
            {error && <p className="text-sm text-red-600 p-2">{error}</p>}
            {!isLoading && !error && creators.length === 0 && (
              <p className="text-sm text-gray-500 p-2">Nenhum criador encontrado.</p>
            )}
            {creators.map((creator) => (
              <button
                key={creator._id}
                className="flex items-center w-full text-left p-2 hover:bg-gray-100"
                onClick={() => {
                  onSelect({ id: creator._id, name: creator.name });
                  onClose();
                }}
              >
                <UserAvatar name={creator.name} src={creator.profilePictureUrl} size={32} />
                <span className="ml-3 text-sm text-gray-800">{creator.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
