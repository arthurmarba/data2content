import React, { useState } from "react";
import {
    ArrowLeft,
    Send,
    Lock,
    RefreshCcw,
    Sparkles,
    Calendar,
    DollarSign,
    ExternalLink,
    CheckCircle2,
    Clock,
    XCircle,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Info
} from "lucide-react";
import { ProposalDetail, ProposalStatus, ReplyIntent, AnalysisViewMode } from "./types";
import { ProposalAnalysisV2 } from "@/types/proposals";
import AnalysisSummaryCard from "./AnalysisSummaryCard";

interface CampaignDetailViewProps {
    proposal: ProposalDetail;
    onBack: () => void;
    onStatusChange: (id: string, status: ProposalStatus) => void;
    // Formatters
    formatDate: (value: string | null) => string;
    formatMoney: (value: number | null, currency: string) => string;
    formatGapLabel: (value: number | null) => string;
    // Interaction / Billing
    canInteract: boolean;
    isBillingLoading: boolean;
    onUpgradeClick: () => void;
    // Analysis / AI
    analysisLoading: boolean;
    analysisMessage: string | null;
    analysisV2: ProposalAnalysisV2 | null;
    viewMode: AnalysisViewMode;
    onToggleViewMode: () => void;
    onAnalyze: () => void;
    // Reply
    replyDraft: string;
    onReplyDraftChange: (value: string) => void;
    replyIntent: ReplyIntent;
    onReplyIntentChange: (intent: ReplyIntent) => void;
    replyRegenerating: boolean;
    onRefreshReply: () => void;
    replySending: boolean;
    onSendReply: () => void;
    replyTextareaRef: React.RefObject<HTMLTextAreaElement>;
}

// Helper to avoid hydration mismatch on icon if needed, but here simple ref is fine.
const checkCircleIcon = AlertCircle; // Fallback or distinct icon for 'respondido'

const STATUS_CONFIG: Record<ProposalStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    novo: { label: "Nova", icon: Sparkles, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
    visto: { label: "Lida", icon: Clock, color: "text-slate-600", bg: "bg-slate-100 border-slate-200" },
    respondido: { label: "Respondida", icon: checkCircleIcon, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
    aceito: { label: "Fechada", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
    rejeitado: { label: "Recusada", icon: XCircle, color: "text-rose-600", bg: "bg-rose-50 border-rose-100" },
};

const STATUS_OPTIONS: ProposalStatus[] = ["novo", "visto", "respondido", "aceito", "rejeitado"];

const INTENT_CHIPS: Array<{ key: ReplyIntent; label: string }> = [
    { key: "accept", label: "Topar valor" },
    { key: "adjust_value", label: "Pedir ajuste" },
    { key: "adjust_scope", label: "Ajustar escopo" },
    { key: "collect_budget", label: "Pedir orçamento" },
];

export default function CampaignDetailView({
    proposal,
    onBack,
    onStatusChange,
    formatDate,
    formatMoney,
    formatGapLabel,
    canInteract,
    isBillingLoading,
    onUpgradeClick,
    analysisLoading,
    analysisMessage,
    analysisV2,
    viewMode,
    onToggleViewMode,
    onAnalyze,
    replyDraft,
    onReplyDraftChange,
    replyIntent,
    onReplyIntentChange,
    replyRegenerating,
    onRefreshReply,
    replySending,
    onSendReply,
    replyTextareaRef,
}: CampaignDetailViewProps) {
    const [isContextExpanded, setIsContextExpanded] = useState(false);

    const deliverables = Array.isArray(proposal.deliverables) ? proposal.deliverables : [];
    const referenceLinks = Array.isArray(proposal.referenceLinks) ? proposal.referenceLinks : [];
    const hasAnalysis = Boolean(analysisMessage || analysisV2);
    const showComposer = hasAnalysis || replyDraft.trim().length > 0;

    const statusConfig = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.novo;
    const StatusIcon = statusConfig.icon;

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <header className="shrink-0 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-20">
                <div className="mx-auto max-w-3xl w-full px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onBack}
                            className="group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                            aria-label="Voltar"
                        >
                            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                                    {proposal.campaignTitle}
                                </h1>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${statusConfig.bg} ${statusConfig.color}`}>
                                    {statusConfig.label}
                                </span>
                            </div>
                            <p className="truncate text-xs font-medium text-slate-500">{proposal.brandName}</p>
                        </div>

                        <div className="hidden sm:block">
                            <div className="relative">
                                <select
                                    value={proposal.status}
                                    onChange={(e) => onStatusChange(proposal.id, e.target.value as ProposalStatus)}
                                    className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                                >
                                    {STATUS_OPTIONS.map(s => (
                                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content - Centered Single Column */}
            <main className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl w-full px-4 py-6 sm:px-6">

                    {/* Collapsible Context Section */}
                    <div className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-300">
                        {/* Summary Header (Always Visible) */}
                        <div
                            onClick={() => setIsContextExpanded(!isContextExpanded)}
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition select-none"
                        >
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
                                        <DollarSign size={16} />
                                    </div>
                                    <span className="text-sm font-bold">{formatMoney(proposal.budget, proposal.currency)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600">
                                    <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600">
                                        <Calendar size={16} />
                                    </div>
                                    <span className="text-sm font-bold">{formatDate(proposal.createdAt)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {isContextExpanded ? "Ocultar detalhes" : "Ver briefing"}
                                {isContextExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {isContextExpanded && (
                            <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                                <div className="pt-4 space-y-6">
                                    {/* Description */}
                                    <div className="prose prose-sm prose-slate max-w-none text-slate-600 leading-relaxed whitespace-pre-line">
                                        {proposal.campaignDescription || (
                                            <span className="italic text-slate-400">Nenhuma descrição fornecida pela marca.</span>
                                        )}
                                    </div>

                                    {/* Deliverables */}
                                    <div>
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Entregáveis</h3>
                                        {deliverables.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {deliverables.map(d => (
                                                    <span key={d} className="inline-flex items-center px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm">
                                                        {d}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <p className="text-xs text-slate-500 italic">Nenhum entregável listado.</p>}
                                    </div>

                                    {/* References */}
                                    {referenceLinks.length > 0 && (
                                        <div>
                                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Referências</h3>
                                            <div className="space-y-1">
                                                {referenceLinks.map(link => (
                                                    <a
                                                        key={link}
                                                        href={link}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                                                    >
                                                        <ExternalLink size={12} />
                                                        <span className="truncate">{link}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* FOCUS AREA: AI & Reply */}
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* AI Action Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-pink-100 text-pink-600">
                                    <Sparkles size={16} />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">Assistente de Negociação</h2>
                            </div>

                            {!hasAnalysis && (
                                <button
                                    type="button"
                                    onClick={onAnalyze}
                                    disabled={analysisLoading}
                                    className={
                                        !canInteract && !isBillingLoading
                                            ? "text-xs font-bold text-slate-500 hover:text-slate-900 transition"
                                            : "inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                                    }
                                >
                                    {!canInteract && !isBillingLoading ? (
                                        <> <Lock size={12} /> Desbloquear </>
                                    ) : analysisLoading ? (
                                        <> <RefreshCcw size={12} className="animate-spin" /> Analisando... </>
                                    ) : (
                                        "Gerar Análise"
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Upgrade Banner (if needed) */}
                        {!canInteract && !isBillingLoading && hasAnalysis && (
                            <div className="p-4 bg-gradient-to-r from-pink-50 to-white border border-pink-100 rounded-xl flex items-center justify-between shadow-sm">
                                <p className="text-xs font-medium text-slate-700">Visualize a análise completa e responda com 1 clique.</p>
                                <button onClick={onUpgradeClick} className="text-xs font-bold uppercase tracking-wider text-pink-600 hover:text-pink-700 hover:underline">Ver planos</button>
                            </div>
                        )}

                        {/* Analysis Card */}
                        {canInteract && hasAnalysis && (
                            <div className="space-y-4">
                                <AnalysisSummaryCard
                                    analysisMessage={analysisMessage}
                                    analysisV2={analysisV2}
                                    viewMode={viewMode}
                                    onToggleViewMode={onToggleViewMode}
                                    formatMoney={formatMoney}
                                    formatGapLabel={formatGapLabel}
                                />
                            </div>
                        )}

                        {/* Composer Area */}
                        <div className="relative">

                            {/* Intent Chips (Above Composer) */}
                            {canInteract && hasAnalysis && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {INTENT_CHIPS.map(chip => (
                                        <button
                                            key={chip.key}
                                            onClick={() => onReplyIntentChange(chip.key)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95
                                            ${replyIntent === chip.key
                                                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                                        >
                                            {chip.label}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={onRefreshReply}
                                        disabled={replyRegenerating}
                                        className="ml-auto inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-pink-600 hover:text-pink-700 hover:bg-pink-50 rounded-lg transition disabled:opacity-50"
                                    >
                                        <RefreshCcw size={12} className={replyRegenerating ? "animate-spin" : ""} />
                                        <span className="hidden sm:inline">Refazer resposta</span>
                                    </button>
                                </div>
                            )}

                            {/* The Editor */}
                            <div className={`group relative rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-all focus-within:ring-2 focus-within:ring-pink-500/20 focus-within:shadow-md ${!canInteract ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                                <textarea
                                    ref={replyTextareaRef}
                                    value={replyDraft}
                                    onChange={(e) => onReplyDraftChange(e.target.value)}
                                    placeholder={canInteract ? "Escreva sua resposta aqui..." : "Desbloqueie para responder..."}
                                    className="w-full min-h-[300px] resize-y rounded-t-2xl p-5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-300 outline-none"
                                    disabled={!canInteract}
                                />

                                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                                    <div className="flex items-center gap-3">
                                        {proposal.lastResponseAt && (
                                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                                                <Clock size={12} />
                                                Último envio: {formatDate(proposal.lastResponseAt)}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onSendReply}
                                        disabled={replySending || !replyDraft.trim() || !canInteract}
                                        className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-pink-700 hover:shadow-lg hover:shadow-pink-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                                    >
                                        <Send size={14} />
                                        {replySending ? "Enviando..." : "Enviar Resposta"}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Mobile Status Select (Bottom) */}
                    <div className="sm:hidden mt-8 pt-6 border-t border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Status da Proposta</label>
                        <div className="relative">
                            <select
                                value={proposal.status}
                                onChange={(e) => onStatusChange(proposal.id, e.target.value as ProposalStatus)}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 px-4 text-base font-medium text-slate-700 shadow-sm outline-none transition focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                            >
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
