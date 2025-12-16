import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface NoDataBlockProps {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export default function NoDataBlock({ title, description, actionLabel, onAction }: NoDataBlockProps) {
    return (
        <div className="bg-white border border-amber-200 rounded-lg p-4 shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                <div>
                    <p className="text-sm font-semibold text-gray-900">{title}</p>
                    <p className="text-xs text-gray-600">{description}</p>
                </div>
            </div>
            {actionLabel && (
                <div>
                    <button
                        onClick={onAction}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
                    >
                        {actionLabel}
                    </button>
                </div>
            )}
        </div>
    );
}
