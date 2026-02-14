import React, { useEffect, useRef, useState } from "react";
import {
    ArrowLeft,
    Send,
    Lock,
    RefreshCcw,
    ExternalLink,
    Clock,
    ChevronDown,
    ChevronUp,
    Check,
    MoreHorizontal,
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
    budgetInput: string;
    onBudgetInputChange: (value: string) => void;
    onSaveBudget: () => void;
    budgetSaving: boolean;
    replySending: boolean;
    onSendReply: () => void;
    replyTextareaRef: React.RefObject<HTMLTextAreaElement>;
}

const STATUS_CONFIG: Record<ProposalStatus, { label: string }> = {
    novo: { label: "Recebida" },
    visto: { label: "Recebida" },
    respondido: { label: "Negociação" },
    aceito: { label: "Fechada" },
    rejeitado: { label: "Perdida" },
};

const STATUS_OPTIONS: ProposalStatus[] = ["novo", "respondido", "aceito", "rejeitado"];

const INTENT_CHIPS: Array<{ key: ReplyIntent; label: string }> = [
    { key: "accept", label: "Topar valor" },
    { key: "adjust_value", label: "Pedir ajuste" },
    { key: "adjust_scope", label: "Ajustar escopo" },
    { key: "collect_budget", label: "Pedir orçamento" },
];

const ASSISTANT_VERDICT_LABELS: Record<NonNullable<ProposalAnalysisV2>["verdict"], string> = {
    aceitar: "Pode fechar",
    ajustar: "Pedir ajuste",
    aceitar_com_extra: "Aceitar com extra",
    ajustar_escopo: "Ajustar escopo",
    coletar_orcamento: "Pedir orçamento",
};

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
    budgetInput,
    onBudgetInputChange,
    onSaveBudget,
    budgetSaving,
    replySending,
    onSendReply,
    replyTextareaRef,
}: CampaignDetailViewProps) {
    const [isContextExpanded, setIsContextExpanded] = useState(false);
    const [isAssistantExpanded, setIsAssistantExpanded] = useState(false);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const actionsMenuRef = useRef<HTMLDivElement | null>(null);

    const deliverables = Array.isArray(proposal.deliverables) ? proposal.deliverables : [];
    const briefingDeliverableChips = deliverables.slice(0, 4);
    const hiddenDeliverablesCount = Math.max(deliverables.length - briefingDeliverableChips.length, 0);
    const referenceLinks = Array.isArray(proposal.referenceLinks) ? proposal.referenceLinks : [];
    const hasAnalysis = Boolean(analysisMessage || analysisV2);
    const currentIntentLabel = INTENT_CHIPS.find((chip) => chip.key === replyIntent)?.label ?? "Estratégia";
    const selectedFunnelStatus: ProposalStatus = proposal.status === "visto" ? "novo" : proposal.status;
    const receivedBudgetLabel =
        proposal.budgetIntent === "requested" && proposal.budget === null
            ? "Marca solicitou orçamento"
            : formatMoney(proposal.budget, proposal.currency);
    const proposedBudgetLabel =
        typeof proposal.creatorProposedBudget === "number"
            ? formatMoney(proposal.creatorProposedBudget, proposal.creatorProposedCurrency || proposal.currency)
            : "Não informado";
    const assistantSummaryChips = analysisV2
        ? [
            `Diagnóstico: ${ASSISTANT_VERDICT_LABELS[analysisV2.verdict]}`,
            `Confiança: ${analysisV2.confidence.label} (${(analysisV2.confidence.score * 100).toFixed(0)}%)`,
            `Faixa: ${formatMoney(analysisV2.pricing.floor, analysisV2.pricing.currency)} - ${formatMoney(analysisV2.pricing.anchor, analysisV2.pricing.currency)}`,
            `Diferença: ${formatGapLabel(analysisV2.pricing.gapPercent)}`,
        ]
        : analysisMessage
            ? ["Resumo da IA disponível"]
            : [];

    useEffect(() => {
        if (!isActionsMenuOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (!actionsMenuRef.current) return;
            if (!actionsMenuRef.current.contains(event.target as Node)) {
                setIsActionsMenuOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsActionsMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isActionsMenuOpen]);
    return (
        <div className="flex h-full flex-col bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white">
                <div className="mx-auto w-full max-w-2xl px-4 py-2.5 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onBack}
                            className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                            aria-label="Voltar"
                        >
                            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-lg font-bold text-slate-900">
                                {proposal.campaignTitle}
                            </h1>
                            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                                <span>{proposal.brandName}</span>
                                <span className="px-1.5 text-slate-300">•</span>
                                <span>{receivedBudgetLabel}</span>
                                <span className="px-1.5 text-slate-300">•</span>
                                <span>{formatDate(proposal.createdAt)}</span>
                            </p>
                        </div>

                        <div className="hidden sm:block">
                            <div className="relative">
                                <select
                                    value={selectedFunnelStatus}
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
                <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">

                    {/* Collapsible Context Section */}
                    <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {/* Summary Header (Always Visible) */}
                        <button
                            type="button"
                            onClick={() => setIsContextExpanded(!isContextExpanded)}
                            className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-700">Briefing da campanha</p>
                                <p className="text-xs text-slate-400">Escopo, entregáveis e referências</p>
                                {briefingDeliverableChips.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {briefingDeliverableChips.map((item) => (
                                            <span key={item} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                                {item}
                                            </span>
                                        ))}
                                        {hiddenDeliverablesCount > 0 && (
                                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                                                +{hiddenDeliverablesCount}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700">
                                {isContextExpanded ? "Ocultar briefing" : "Ver briefing"}
                                {isContextExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                        </button>

                        {/* Expanded Details */}
                        {isContextExpanded && (
                            <div className="border-t border-slate-100 px-4 py-4">
                                <div className="space-y-5">
                                    {/* Description */}
                                    <div className="whitespace-pre-line text-sm leading-7 text-slate-700">
                                        {proposal.campaignDescription || (
                                            <span className="italic text-slate-400">Nenhuma descrição fornecida pela marca.</span>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="mb-2 text-xs font-semibold text-slate-500">Contato da marca</h3>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Responsável</p>
                                                <p className="mt-1 text-sm text-slate-800">{proposal.contactName || "Não informado"}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Email</p>
                                                <p className="mt-1 break-all text-sm text-slate-800">{proposal.contactEmail}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 sm:col-span-2">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">WhatsApp</p>
                                                <p className="mt-1 text-sm text-slate-800">{proposal.contactWhatsapp || "Não informado"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* References */}
                                    {referenceLinks.length > 0 && (
                                        <div>
                                            <h3 className="mb-2 text-xs font-semibold text-slate-500">Referências</h3>
                                            <div className="space-y-1">
                                                {referenceLinks.map(link => (
                                                    <a
                                                        key={link}
                                                        href={link}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
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
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <button
                                type="button"
                                onClick={() => setIsAssistantExpanded((current) => !current)}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-700">Assistente de Negociação</p>
                                    <p className="text-xs text-slate-400">Diagnóstico e sugestões da IA</p>
                                    {assistantSummaryChips.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {assistantSummaryChips.map((chip) => (
                                                <span key={chip} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                                    {chip}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700">
                                    {isAssistantExpanded ? "Ocultar assistente" : "Ver assistente"}
                                    {isAssistantExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>
                            </button>

                            {isAssistantExpanded && (
                                <div className="border-t border-slate-100 px-4 py-4">
                                    <div className="space-y-5">
                                        {!hasAnalysis && (
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-slate-600">Análise de valor, risco e resposta recomendada.</p>
                                                <button
                                                    type="button"
                                                    onClick={onAnalyze}
                                                    disabled={analysisLoading}
                                                    className={
                                                        !canInteract && !isBillingLoading
                                                            ? "text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
                                                            : "inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                                                    }
                                                >
                                                    {!canInteract && !isBillingLoading ? (
                                                        <> <Lock size={12} /> Desbloquear </>
                                                    ) : analysisLoading ? (
                                                        <> <RefreshCcw size={12} className="animate-spin" /> Analisando... </>
                                                    ) : (
                                                        "Gerar análise"
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        {hasAnalysis && !canInteract && !isBillingLoading && (
                                            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                                                <p className="text-xs font-medium text-slate-700">Visualize a análise completa e responda com 1 clique.</p>
                                                <button onClick={onUpgradeClick} className="text-xs font-semibold text-pink-600 hover:text-pink-700 hover:underline">Ver planos</button>
                                            </div>
                                        )}

                                        {canInteract && hasAnalysis && (
                                            <AnalysisSummaryCard
                                                analysisMessage={analysisMessage}
                                                analysisV2={analysisV2}
                                                viewMode={viewMode}
                                                onToggleViewMode={onToggleViewMode}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Composer Area */}
                        <div className="relative">
                            <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orçamento</p>
                                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <p className="text-[11px] text-slate-500">Recebido da marca</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-900">{receivedBudgetLabel}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-slate-500">Último valor proposto por você</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-900">{proposedBudgetLabel}</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <input
                                        value={budgetInput}
                                        onChange={(e) => onBudgetInputChange(e.target.value)}
                                        placeholder={`Ex.: ${proposal.currency === 'BRL' ? '5000' : '1000'}`}
                                        disabled={!canInteract}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 sm:max-w-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={onSaveBudget}
                                        disabled={!canInteract || budgetSaving}
                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {budgetSaving ? "Salvando..." : "Salvar orçamento proposto"}
                                    </button>
                                </div>
                                <p className="mt-2 text-[11px] text-slate-500">
                                    Este valor fica registrado na campanha para histórico de negociação.
                                </p>
                            </div>

                            {/* The Editor */}
                            <div className={`group relative rounded-2xl bg-white shadow-sm ring-1 ring-slate-100/70 transition-all focus-within:ring-2 focus-within:ring-slate-200 focus-within:shadow-md ${!canInteract ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                                <div className="flex items-center justify-between border-b border-slate-100/70 px-4 py-2.5">
                                    <p className="text-sm font-semibold text-slate-700">Rascunho de resposta</p>
                                    {canInteract && hasAnalysis && (
                                        <p className="text-xs text-slate-400 sm:text-slate-500">
                                            Estratégia: <span className="font-medium text-slate-600 sm:text-slate-700">{currentIntentLabel}</span>
                                        </p>
                                    )}
                                </div>
                                <textarea
                                    ref={replyTextareaRef}
                                    value={replyDraft}
                                    onChange={(e) => onReplyDraftChange(e.target.value)}
                                    placeholder={canInteract ? "Escreva sua resposta aqui..." : "Desbloqueie para responder..."}
                                    className="w-full min-h-[320px] resize-y border-0 bg-transparent p-5 text-[15px] leading-[1.7] text-slate-800 shadow-none outline-none ring-0 placeholder:text-slate-300 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                                    disabled={!canInteract}
                                />

                                <div className="flex flex-col gap-2.5 rounded-b-2xl border-t border-slate-100/70 bg-slate-50/40 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3">
                                        {proposal.lastResponseAt && (
                                            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 sm:text-slate-400">
                                                <Clock size={12} />
                                                Último envio: {formatDate(proposal.lastResponseAt)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative flex w-full items-center justify-end gap-2 sm:w-auto" ref={actionsMenuRef}>
                                        {canInteract && hasAnalysis && (
                                            <button
                                                type="button"
                                                onClick={() => setIsActionsMenuOpen((current) => !current)}
                                                aria-haspopup="menu"
                                                aria-expanded={isActionsMenuOpen}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-400 transition hover:border-slate-200 hover:bg-white hover:text-slate-500 sm:text-slate-500 sm:hover:text-slate-600"
                                            >
                                                <MoreHorizontal size={14} />
                                                Mais opções
                                            </button>
                                        )}

                                        {canInteract && hasAnalysis && isActionsMenuOpen && (
                                            <div className="absolute bottom-full right-0 z-20 mb-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" role="menu">
                                                <div className="border-b border-slate-100 px-3 py-2">
                                                    <p className="text-xs font-semibold text-slate-500">Estratégia</p>
                                                </div>
                                                <div className="p-1.5">
                                                    {INTENT_CHIPS.map((chip) => (
                                                        <button
                                                            key={chip.key}
                                                            type="button"
                                                            onClick={() => {
                                                                onReplyIntentChange(chip.key);
                                                                setIsActionsMenuOpen(false);
                                                            }}
                                                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-medium transition ${replyIntent === chip.key
                                                                ? "bg-slate-100 text-slate-900"
                                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                                                                }`}
                                                        >
                                                            <span>{chip.label}</span>
                                                            {replyIntent === chip.key && <Check size={13} className="text-slate-500" />}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="border-t border-slate-100 p-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onRefreshReply();
                                                            setIsActionsMenuOpen(false);
                                                        }}
                                                        disabled={replyRegenerating}
                                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
                                                    >
                                                        <RefreshCcw size={12} className={replyRegenerating ? "animate-spin" : ""} />
                                                        Refazer texto
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={onSendReply}
                                            disabled={replySending || !replyDraft.trim() || !canInteract}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 hover:shadow-lg hover:shadow-pink-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none sm:w-auto"
                                        >
                                            <Send size={14} />
                                            {replySending ? "Enviando..." : "Enviar Resposta"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Mobile Status Select (Bottom) */}
                    <div className="sm:hidden mt-8 pt-6 border-t border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">Etapa do Funil</label>
                        <div className="relative">
                            <select
                                value={selectedFunnelStatus}
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
