import React from 'react';

export const ThinkingIndicator = () => {
    return (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2">
            <div className="flex items-center gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse [animation-delay:240ms]" />
            </div>
            <span className="text-[12px] font-medium text-gray-500">
                Preparando resposta
            </span>
        </div>
    );
};
