import React from 'react';

interface SectionProps {
    title: string;
    description?: string;
    subtitle?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}

export default function Section({ title, description, subtitle, children, actions }: SectionProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                    {(description || subtitle) && <p className="text-xs text-gray-500">{description || subtitle}</p>}
                </div>
                {actions}
            </div>
            {children}
        </div>
    );
}
