'use client';

import React from 'react';

// Interface para definir a aparência de um status específico
interface BadgeMapping {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor?: string; // Borda opcional para mais customização
}

// Props do componente StatusBadge
interface StatusBadgeProps {
  status?: string | null; // Status pode ser nulo ou indefinido
  mappings: Record<string, BadgeMapping>;
  defaultLabel?: string;
}

/**
 * Componente genérico para exibir um badge de status.
 * A aparência do badge é determinada por um objeto de mapeamento passado via props.
 * @param {string | null} status - A chave do status a ser exibida (ex: 'active', 'pending_approval').
 * @param {Record<string, BadgeMapping>} mappings - Um objeto que mapeia chaves de status para seus labels e cores.
 * @param {string} defaultLabel - O texto a ser exibido se o status for nulo/indefinido. Padrão: 'N/A'.
 */
export function StatusBadge({ status, mappings, defaultLabel = 'N/A' }: StatusBadgeProps) {
  // Se o status for nulo ou inválido, usa um mapeamento padrão
  const defaultMap: BadgeMapping = {
    label: status || defaultLabel,
    bgColor: 'bg-gray-100 dark:bg-gray-700',
    textColor: 'text-gray-600 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-600'
  };

  const map = status ? mappings[status] : defaultMap;
  
  // Se mesmo com um status válido, não houver mapeamento, usa o padrão
  const finalMap = map || { ...defaultMap, label: status || defaultLabel };

  return (
    <span
      className={`
        inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold
        border
        ${finalMap.bgColor} 
        ${finalMap.textColor}
        ${finalMap.borderColor || 'border-transparent'}
      `}
    >
      {finalMap.label}
    </span>
  );
}
