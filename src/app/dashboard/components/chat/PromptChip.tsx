import React from 'react';

interface PromptChipProps {
    label: string;
    onClick: () => void;
}

export function PromptChip({ label, onClick }: PromptChipProps) {
    return (
        <button
            onClick={onClick}
            className="
        group relative
        inline-flex items-center justify-center
        rounded-2xl border border-gray-200
        bg-white hover:bg-white hover:border-brand-primary/30 hover:shadow-md hover:shadow-brand-primary/5
        px-6 py-3 text-sm font-medium text-gray-600 hover:text-brand-primary
        transition-all duration-300 ease-out
        active:scale-95
      "
            title={label}
            aria-label={label}
        >
            <span className="truncate relative z-10">{label}</span>
            <div className="absolute inset-0 rounded-2xl bg-brand-primary/0 group-hover:bg-brand-primary/[0.02] transition-colors duration-300" />
        </button>
    );
}
