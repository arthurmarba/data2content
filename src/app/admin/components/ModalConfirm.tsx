// src/app/admin/components/ModalConfirm.tsx
'use client';

import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline'; // Para um botão de fechar opcional no header

interface ModalConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColorClass?: string; // Ex: 'bg-red-600 hover:bg-red-700'
  isConfirming?: boolean; // Para mostrar estado de loading/desabilitar botões
}

export default function ModalConfirm({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirmar',
  cancelButtonText = 'Cancelar',
  confirmButtonColorClass = 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500', // Default to red for destructive actions
  isConfirming = false,
}: ModalConfirmProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 w-full max-w-md p-6 rounded-xl shadow-2xl border border-gray-300 dark:border-gray-700 transform transition-all">
        <div className="flex items-start justify-between mb-4">
          <h3 id="modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
            aria-label="Fechar modal"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {typeof message === 'string' ? (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>
        ) : (
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-6">{message}</div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {cancelButtonText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center
                        ${isConfirming ? 'bg-gray-400' : confirmButtonColorClass}`}
          >
            {isConfirming && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isConfirming ? 'Processando...' : confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
