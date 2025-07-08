"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useRef,
} from "react";
import { debounce } from "lodash";
import { FaSearch } from "react-icons/fa"; // Usando react-icons para o ícone
import { XMarkIcon } from "@heroicons/react/24/solid";

interface SearchBarProps {
  initialValue?: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  value?: string;
  onClear?: () => void;
  /**
   * When true, the clear button is displayed even if the input is empty.
   * Useful for showing a selected value that can be cleared.
   */
  showClearWhenEmpty?: boolean;
  /**
   * Visual variant of the input. Default keeps the bordered style while
   * 'minimal' removes the box and uses only a bottom border.
   */
  variant?: 'default' | 'minimal';
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
 * @param {string} ariaLabel - Rótulo de acessibilidade para o input.
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      initialValue = "",
      onSearchChange,
      placeholder = "Buscar...",
      debounceMs = 500,
      className = "",
      autoFocus = false,
      ariaLabel,
      value,
      onClear,
      showClearWhenEmpty = false,
      variant = 'default',
    }: SearchBarProps,
    ref,
  ) {
    const [inputValue, setInputValue] = useState(initialValue);
    // --- CORREÇÃO APLICADA AQUI ---
    // Alterado de useRef<HTMLInputElement>(null) para useRef<HTMLInputElement | null>(null)
    // para criar uma ref mutável.
    const localRef = useRef<HTMLInputElement | null>(null);

    const setRefs = (node: HTMLInputElement | null) => {
      // Agora esta atribuição é permitida
      localRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    };

    // useMemo garante que a função debounced seja criada apenas uma vez
    const debouncedOnChange = useMemo(
      () =>
        debounce((value: string) => {
          onSearchChange(value);
        }, debounceMs),
      [onSearchChange, debounceMs],
    );

    useEffect(() => {
      setInputValue(value ?? initialValue);
    }, [value, initialValue]);

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
          aria-label={ariaLabel}
          ref={setRefs}
          autoFocus={autoFocus}
          className={`block w-full pl-10 pr-8 py-2 sm:text-sm text-black dark:text-white focus:outline-none ${
            variant === 'minimal'
              ? '!bg-brand-light dark:bg-gray-800 border-0 border-b border-gray-200 rounded-none shadow-none focus:border-gray-400 focus:ring-0 placeholder-gray-500'
              : 'border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 dark:border-gray-600'
          }`}
        />
        {onClear && (inputValue || showClearWhenEmpty) && (
          <button
            type="button"
            onClick={() => {
              setInputValue("");
              onClear();
              localRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            aria-label="Limpar busca"
          >
            <XMarkIcon className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
    );
  },
);