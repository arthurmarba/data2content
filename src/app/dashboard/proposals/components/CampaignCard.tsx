import React from "react";
import { ChevronDown } from "lucide-react";
import { ProposalListItem, ProposalStatus } from "./types";

interface CampaignCardProps {
    proposal: ProposalListItem;
    onClick: () => void;
    onStatusChange?: (id: string, status: ProposalStatus) => void;
    formatMoney: (value: number | null, currency: string) => string;
    formatDate: (value: string | null) => string;
}

const STATUS_TONE: Record<ProposalStatus, { header: string; text: string; ring: string }> = {
    novo: {
        header: "bg-pink-50 border-pink-100",
        text: "text-pink-700",
        ring: "hover:ring-pink-200",
    },
    visto: {
        header: "bg-slate-50 border-slate-100",
        text: "text-slate-700",
        ring: "hover:ring-slate-200",
    },
    respondido: {
        header: "bg-amber-50 border-amber-100",
        text: "text-amber-700",
        ring: "hover:ring-amber-200",
    },
    aceito: {
        header: "bg-emerald-50 border-emerald-100",
        text: "text-emerald-700",
        ring: "hover:ring-emerald-200",
    },
    rejeitado: {
        header: "bg-rose-50 border-rose-100",
        text: "text-rose-700",
        ring: "hover:ring-rose-200",
    },
};

const STATUS_LABELS: Record<ProposalStatus, string> = {
    novo: "Recebida",
    visto: "Recebida",
    respondido: "Negociação",
    aceito: "Fechada",
    rejeitado: "Perdida",
};

const STATUS_OPTIONS: ProposalStatus[] = ["novo", "respondido", "aceito", "rejeitado"];

export default function CampaignCard({ proposal, onClick, onStatusChange, formatMoney, formatDate }: CampaignCardProps) {
    const tone = STATUS_TONE[proposal.status] || STATUS_TONE.visto;
    const label = STATUS_LABELS[proposal.status] || "Campanha";

    const handleStatusClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation();
        if (onStatusChange) {
            onStatusChange(proposal.id, e.target.value as ProposalStatus);
        }
    };

    return (
        <div
            className={`group relative flex h-60 w-full flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white text-left shadow-sm ring-1 ring-transparent transition hover:-translate-y-1 hover:shadow-xl ${tone.ring} sm:h-64 sm:rounded-[2rem] cursor-pointer`}
            onClick={onClick}
        >
            <div className={`flex items-center justify-between gap-2 border-b px-5 py-3 ${tone.header}`}>
                <div className="relative z-10" onClick={handleStatusClick}>
                    {onStatusChange ? (
                        <div className="relative inline-flex items-center">
                            <select
                                value={proposal.status}
                                onChange={handleStatusChange}
                                className={`appearance-none border-0 bg-transparent bg-none py-0.5 pl-0 pr-5 text-[11px] font-bold uppercase tracking-wider ${tone.text} shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 cursor-pointer`}
                            >
                                {STATUS_OPTIONS.map(s => (
                                    <option key={s} value={s} className="text-slate-700 bg-white">
                                        {STATUS_LABELS[s]}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={12} className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 ${tone.text} opacity-70`} />
                        </div>
                    ) : (
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${tone.text}`}>{label}</span>
                    )}
                </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-6">
                <h3 className="line-clamp-2 text-lg font-bold leading-[1.1] text-slate-900 group-hover:text-pink-600 transition-colors">
                    {proposal.campaignTitle}
                </h3>

                <p className="mt-2 line-clamp-1 text-sm font-medium text-slate-400">
                    {proposal.brandName}
                </p>

                <div className="mt-auto pt-4">
                    {proposal.budget !== null ? (
                        <p className="text-lg font-bold text-slate-800">
                            {formatMoney(proposal.budget, proposal.currency)}
                        </p>
                    ) : (
                        <p className="text-sm font-medium text-slate-400">Orçamento não informado</p>
                    )}
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                        Recebida em {formatDate(proposal.createdAt)}
                    </p>
                </div>
            </div>
        </div>
    );
}
