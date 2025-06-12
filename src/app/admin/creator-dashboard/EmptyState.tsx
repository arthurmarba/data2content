'use client';

import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  actionButton?: {
    text: string;
    onClick: () => void;
    primary?: boolean;
  };
  smallText?: boolean; // For smaller containers like charts
}

export default function EmptyState({
  icon,
  title,
  message,
  actionButton,
  smallText = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-6 md:p-8 h-full min-h-[200px]"> {/* Ensure it takes some min height */}
      {icon && (
        <div className={`mb-4 ${smallText ? 'w-10 h-10' : 'w-12 h-12'} text-gray-400 dark:text-gray-500`}>
          {icon}
        </div>
      )}
      <h3 className={`${smallText ? 'text-lg' : 'text-xl'} font-semibold text-gray-700 dark:text-gray-200 mb-1.5`}>
        {title}
      </h3>
      <p className={`${smallText ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 mb-5 max-w-md`}>
        {message}
      </p>
      {actionButton && (
        <button
          onClick={actionButton.onClick}
          type="button"
          className={`px-4 py-2 font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 text-sm
            ${
              actionButton.primary
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 disabled:bg-gray-300'
                : 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-gray-600 focus:ring-indigo-400 disabled:bg-gray-100'
            }
            disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:text-gray-400 dark:disabled:bg-gray-600`}
        >
          {actionButton.text}
        </button>
      )}
    </div>
  );
}
