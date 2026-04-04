import React from 'react';

interface DemographicBarListProps {
    data: Array<{ label: string; percentage: number }>;
    maxItems?: number;
    accentClass?: string;
}

export const DemographicBarList: React.FC<DemographicBarListProps> = ({
    data,
    maxItems = 4,
    accentClass = 'from-[#D62E5E] to-[#6E1F93]',
}) => {
    if (!data?.length) return null;
    return (
        <div className="space-y-4">
            {data.slice(0, maxItems).map((item) => (
                <div key={`${item.label}-${item.percentage}`}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-zinc-700">{item.label}</span>
                        <span className="font-bold text-zinc-900">{Math.round(item.percentage)}%</span>
                    </div>
                    <div className="dashboard-progress-track mt-2 h-1.5 w-full">
                        <div
                            className={`h-full rounded-full bg-gradient-to-r ${accentClass}`}
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DemographicBarList;
