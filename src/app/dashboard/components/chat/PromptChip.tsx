import React from 'react';

interface PromptChipProps {
    label: string;
    onClick: () => void;
}

export function PromptChip({ label, onClick }: PromptChipProps) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900 active:scale-[0.99]"
            title={label}
            aria-label={label}
        >
            <span className="truncate">{label}</span>
        </button>
    );
}
