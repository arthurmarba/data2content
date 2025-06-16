'use client';

import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Componente para exibir um estado vazio de forma padronizada.
 * @param {ReactNode} icon - Ícone a ser exibido acima do título.
 * @param {string} title - O título principal da mensagem.
 * @param {string} description - Um texto descritivo opcional.
 * @param {ReactNode} action - Um componente de ação, como um botão.
 * @param {string} className - Classes CSS adicionais para o container.
 */
export function EmptyState({
  icon,
  title = 'Nenhum dado encontrado',
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-gray-800 rounded-lg shadow-md ${className}`}>
      {icon && <div className="mb-4 text-gray-400 dark:text-gray-500">{icon}</div>}
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">{title}</h2>
      {description && <p className="mb-4 text-gray-500 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
