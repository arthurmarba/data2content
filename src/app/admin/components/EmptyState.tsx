/**
 * @fileoverview Componente reutilizável para exibir um estado vazio (nenhum dado).
 * @version 1.0.0
 */
import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  actionButton?: React.ReactNode;
}

const EmptyState = ({ icon, title, message, actionButton }: EmptyStateProps) => {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>
      {actionButton && <div className="mt-6">{actionButton}</div>}
    </div>
  );
};

export default EmptyState;
