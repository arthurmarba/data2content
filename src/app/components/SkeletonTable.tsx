'use client';

import React from 'react';

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

/**
 * Componente para exibir um skeleton loader em formato de tabela.
 * Útil para indicar carregamento de dados em listas e tabelas,
 * mantendo a estabilidade do layout (evitando layout shift).
 * @param {number} rows - Número de linhas do skeleton a serem exibidas. Padrão: 10.
 * @param {number} cols - Número de colunas do skeleton a serem exibidas. Padrão: 5.
 * @param {string} className - Classes CSS adicionais para o container.
 */
export function SkeletonTable({ rows = 10, cols = 5, className = '' }: SkeletonTableProps) {
  // Cria um array de linhas para o mapeamento
  const tableRows = Array.from({ length: rows });
  // Cria um array de colunas para o mapeamento aninhado
  const tableCols = Array.from({ length: cols });

  return (
    <div
      role="status"
      className={`w-full p-4 space-y-4 border border-gray-200 divide-y divide-gray-200 rounded shadow animate-pulse dark:divide-gray-700 md:p-6 dark:border-gray-700 ${className}`}
    >
      {tableRows.map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center justify-between pt-4">
          {/* Mapeia as colunas para criar os retângulos de placeholder */}
          {tableCols.map((_, colIndex) => (
            <div key={colIndex} className="w-full mx-2">
              <div className="h-2.5 bg-gray-300 rounded-full dark:bg-gray-600 w-full"></div>
            </div>
          ))}
          {/* Um elemento final para simular uma coluna de ações/ícone */}
          <div className="w-24 h-2.5 bg-gray-200 rounded-full dark:bg-gray-700"></div>
        </div>
      ))}
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
