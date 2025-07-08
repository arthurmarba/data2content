"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  ReactNode,
} from "react";
import { debounce } from "lodash";

export const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
    />
  </svg>
);

const Spinner = () => (
    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
);

interface SearchBarProps {
  onSearchChange: (value: string) => void;
  value?: string;
  placeholder?: string;
  className?: string;
  isLoading?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  variant?: 'default' | 'minimal';
  ariaLabel?: string;
  autoFocus?: boolean;
  debounceMs?: number;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar(
    {
      onSearchChange,
      value,
      placeholder = "Buscar...",
      className = "",
      isLoading = false,
      disabled = false,
      children,
      variant = 'default',
      ariaLabel,
      autoFocus = false,
      debounceMs = 300,
    }: SearchBarProps,
    ref,
  ) {
    const [inputValue, setInputValue] = useState(value ?? "");
    
    const debouncedOnChange = useMemo(
      () => debounce(onSearchChange, debounceMs),
      [onSearchChange, debounceMs]
    );

    useEffect(() => {
      if (value !== inputValue) setInputValue(value ?? '');
    }, [value]);
    
    useEffect(() => {
      debouncedOnChange(inputValue);
      return () => debouncedOnChange.cancel();
    }, [inputValue, debouncedOnChange]);

    // ===== ALTERAÇÃO 2: REMOÇÃO DAS CLASSES 'dark:' PARA CORRIGIR CORES =====
    const minimalVariantClasses = `
      bg-transparent border-0
      focus:ring-0 focus:border-indigo-500 focus:border-b
      placeholder-gray-500
      transition-all duration-200
    `;
    const defaultVariantClasses = `
      bg-white border border-gray-300 rounded-md shadow-sm
      focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
    `;

    return (
      <div className={`relative flex items-center ${className}`}>
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <div className="transition-opacity duration-200">
            {isLoading ? <Spinner /> : <SearchIcon className="h-5 w-5 text-gray-400" />}
          </div>
        </div>
        
        {children && (
          <div className="absolute inset-y-0 left-0 pl-12 flex items-center z-10">
            {children}
          </div>
        )}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={children ? "" : placeholder}
          aria-label={ariaLabel || placeholder}
          ref={ref}
          disabled={disabled}
          autoFocus={autoFocus}
          // ===== ALTERAÇÃO 3: REMOÇÃO DA CLASSE 'dark:text-gray-200' =====
          className={`block w-full py-2 sm:text-sm text-gray-900 focus:outline-none 
            ${children ? 'pl-44' : 'pl-10'} 
            ${disabled ? 'cursor-default' : ''}
            ${variant === 'minimal' ? minimalVariantClasses : defaultVariantClasses}
          `}
        />
      </div>
    );
  },
);

SearchBar.displayName = "SearchBar";