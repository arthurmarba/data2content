'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import { FaSearch } from 'react-icons/fa'; // Usando react-icons para o ícone

interface SearchBarProps {
  initialValue?: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

/**
 * Componente de barra de busca com lógica de debounce embutida.
 * A função `onSearchChange` só é chamada após o usuário parar de digitar
 * pelo tempo definido em `debounceMs`.
 * @param {string} initialValue - O valor inicial do campo de busca.
 * @param {(value: string) => void} onSearchChange - Callback acionado após o debounce.
 * @param {string} placeholder - Texto de placeholder para o input.
 * @param {number} debounceMs - O tempo de espera em milissegundos. Padrão: 500.
 * @param {string} className - Classes CSS adicionais para o container.
 */
export function SearchBar({
  initialValue = '',
  onSearchChange,
  placeholder = 'Buscar...',
  debounceMs = 500,
  className = '',
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(initialValue);

  // useMemo garante que a função debounced seja criada apenas uma vez
  const debouncedOnChange = useMemo(
    () => debounce((value: string) => {
      onSearchChange(value);
    }, debounceMs),
    [onSearchChange, debounceMs]
  );

  // Efeito que chama a função debounced quando o valor do input muda
  useEffect(() => {
    debouncedOnChange(inputValue);

    // Função de limpeza para cancelar qualquer chamada pendente quando o componente é desmontado
    return () => {
      debouncedOnChange.cancel();
    };
  }, [inputValue, debouncedOnChange]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <FaSearch className="h-4 w-4 text-gray-400" />
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm 
                   focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm
                   dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
      />
    </div>
  );
}
