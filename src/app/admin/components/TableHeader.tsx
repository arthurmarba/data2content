// src/app/admin/components/TableHeader.tsx
'use client';

import React from 'react';
import { ChevronUpIcon, ChevronDownIcon, ArrowsUpDownIcon } from '@heroicons/react/24/solid'; // Usando solid para ícones mais visíveis

export interface ColumnConfig<T = any> { // T é o tipo do item da linha, útil se sortBy for keyof T
  key: string; // Ou keyof T se quiser tipagem mais forte para sortBy
  label: string;
  sortable?: boolean;
  className?: string; // Para estilização customizada do <th>
  headerClassName?: string; // Específico para o header, se diferente do corpo da célula
}

export interface SortConfig {
  sortBy: string; // Ou keyof T
  sortOrder: 'asc' | 'desc';
}

interface TableHeaderProps {
  columns: ColumnConfig[];
  sortConfig: SortConfig | null; // Pode ser null se não houver ordenação inicial
  onSort: (columnKey: string) => void; // Ou (columnKey: keyof T) => void
}

export default function TableHeader({ columns, sortConfig, onSort }: TableHeaderProps) {
  const renderSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.sortBy !== columnKey) {
      // Ícone padrão para colunas ordenáveis que não estão atualmente ordenadas
      // Ou um ícone mais sutil como ArrowsUpDownIcon para indicar que é ordenável
      return <ArrowsUpDownIcon className="w-3.5 h-3.5 inline text-gray-400 ml-1 opacity-60 group-hover:opacity-100" />;
    }
    if (sortConfig.sortOrder === 'asc') {
      return <ChevronUpIcon className="w-4 h-4 inline text-indigo-600 ml-1" />;
    }
    return <ChevronDownIcon className="w-4 h-4 inline text-indigo-600 ml-1" />;
  };

  return (
    <thead className="bg-gray-50 dark:bg-gray-700/50"> {/* dark: mantido por flexibilidade, mas não será usado no tema claro admin */}
      <tr>
        {columns.map((col) => (
          <th
            key={col.key}
            scope="col"
            className={`
              px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider
              ${col.sortable ? 'cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
              ${col.headerClassName || col.className || ''}
            `}
            onClick={() => col.sortable && onSort(col.key)}
            title={col.sortable ? `Ordenar por ${col.label}` : undefined}
          >
            <div className="flex items-center">
              <span>{col.label}</span>
              {col.sortable && renderSortIcon(col.key)}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}
