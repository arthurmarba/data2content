import React, { useEffect, useRef, useState } from "react";
import {
    ArrowLeft,
    Send,
    Lock,
    RefreshCcw,
    ExternalLink,
    Clock,
    Mail,
    ChevronDown,
    ChevronUp,
    Check,
    Link2,
} from "lucide-react";
import {
    ProposalDetail,
    ProposalStatus,
    ReplyIntent,
    AnalysisViewMode,
    CampaignLinkItem,
    CampaignLinkScriptApprovalStatus,
    LinkableScriptItem,
    LinkablePubliItem,
} from "./types";
import { ProposalAnalysisV2, ProposalPricingConsistency, ProposalPricingSource } from "@/types/proposals";
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
    analysisPricingMeta: {
        pricingConsistency: ProposalPricingConsistency | null;
        pricingSource: ProposalPricingSource | null;
        limitations: string[];
    };
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
    // Campaign Links
    campaignLinks: CampaignLinkItem[];
    campaignLinksLoading: boolean;
    campaignLinksError: string | null;
    availableScripts: LinkableScriptItem[];
    availablePublis: LinkablePubliItem[];
    linkableLoading: boolean;
    linkableError: string | null;
    linkMutating: boolean;
    activeLinkMutationId: string | null;
    onLinkScript: (scriptId: string) => Promise<void>;
    onLinkPubli: (publiId: string) => Promise<void>;
    onUnlinkEntity: (linkId: string) => Promise<void>;
    onUpdateLinkStatus: (linkId: string, status: CampaignLinkScriptApprovalStatus) => Promise<void>;
}

const STATUS_CONFIG: Record<ProposalStatus, { label: string }> = {
    novo: { label: "Recebida" },
    visto: { label: "Recebida" },
    respondido: { label: "Em negociação" },
    aceito: { label: "Fechada" },
    rejeitado: { label: "Perdida" },
};

const STATUS_OPTIONS: ProposalStatus[] = ["novo", "respondido", "aceito", "rejeitado"];
const STATUS_THEME: Record<ProposalStatus, { selectClass: string }> = {
    novo: {
        selectClass: "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 focus:border-sky-400 focus:ring-sky-100",
    },
    visto: {
        selectClass: "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 focus:border-sky-400 focus:ring-sky-100",
    },
    respondido: {
        selectClass: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 focus:border-amber-400 focus:ring-amber-100",
    },
    aceito: {
        selectClass: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100",
    },
    rejeitado: {
        selectClass: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 focus:border-rose-400 focus:ring-rose-100",
    },
};

const INTENT_CHIPS: Array<{ key: ReplyIntent; label: string }> = [
    { key: "accept", label: "Topar valor" },
    { key: "adjust_value", label: "Pedir ajuste" },
    { key: "adjust_scope", label: "Ajustar escopo" },
    { key: "collect_budget", label: "Pedir orçamento" },
];
const REPLY_INTENT_THEME: Record<ReplyIntent, { chipClass: string; menuActiveClass: string; menuActiveIconClass: string }> = {
    accept: {
        chipClass: "bg-emerald-50 text-emerald-700",
        menuActiveClass: "bg-emerald-50 text-emerald-800",
        menuActiveIconClass: "text-emerald-600",
    },
    adjust_value: {
        chipClass: "bg-amber-50 text-amber-700",
        menuActiveClass: "bg-amber-50 text-amber-800",
        menuActiveIconClass: "text-amber-600",
    },
    adjust_scope: {
        chipClass: "bg-orange-50 text-orange-700",
        menuActiveClass: "bg-orange-50 text-orange-800",
        menuActiveIconClass: "text-orange-600",
    },
    collect_budget: {
        chipClass: "bg-sky-50 text-sky-700",
        menuActiveClass: "bg-sky-50 text-sky-800",
        menuActiveIconClass: "text-sky-600",
    },
};

const SCRIPT_APPROVAL_OPTIONS: Array<{ value: CampaignLinkScriptApprovalStatus; label: string }> = [
    { value: "draft", label: "Rascunho" },
    { value: "sent", label: "Enviado para marca" },
    { value: "approved", label: "Aprovado" },
    { value: "changes_requested", label: "Ajustes solicitados" },
];
const SCRIPT_APPROVAL_THEME: Record<CampaignLinkScriptApprovalStatus, { cardClass: string; selectClass: string; typePillClass: string }> = {
    draft: {
        cardClass: "border-slate-200 bg-slate-50/70",
        selectClass: "border-slate-200 bg-slate-50 text-slate-700 focus:border-slate-300 focus:ring-slate-100",
        typePillClass: "bg-white text-slate-600",
    },
    sent: {
        cardClass: "border-sky-200 bg-sky-50/70",
        selectClass: "border-sky-200 bg-sky-50 text-sky-700 focus:border-sky-300 focus:ring-sky-100",
        typePillClass: "bg-sky-100 text-sky-700",
    },
    approved: {
        cardClass: "border-emerald-200 bg-emerald-50/70",
        selectClass: "border-emerald-200 bg-emerald-50 text-emerald-700 focus:border-emerald-300 focus:ring-emerald-100",
        typePillClass: "bg-emerald-100 text-emerald-700",
    },
    changes_requested: {
        cardClass: "border-amber-200 bg-amber-50/70",
        selectClass: "border-amber-200 bg-amber-50 text-amber-700 focus:border-amber-300 focus:ring-amber-100",
        typePillClass: "bg-amber-100 text-amber-700",
    },
};
const ASSISTANT_SUMMARY_CHIP_THEME: Record<"neutral" | "info" | "positive" | "warning", string> = {
    neutral: "bg-slate-100 text-slate-700",
    info: "bg-sky-50 text-sky-700",
    positive: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
};

const ASSISTANT_VERDICT_LABELS: Record<NonNullable<ProposalAnalysisV2>["verdict"], string> = {
    aceitar: "Pode fechar",
    ajustar: "Pedir ajuste",
    aceitar_com_extra: "Aceitar com extra",
    ajustar_escopo: "Ajustar escopo",
    coletar_orcamento: "Pedir orçamento",
};

function appendQueryParam(url: string, key: string, value: string): string {
    const [rawWithoutHash, hash = ""] = url.split("#");
    const withoutHash = rawWithoutHash ?? "";
    const separator = withoutHash.includes("?") ? "&" : "?";
    const next = `${withoutHash}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    return hash ? `${next}#${hash}` : next;
}

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
    analysisPricingMeta,
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
    campaignLinks,
    campaignLinksLoading,
    campaignLinksError,
    availableScripts,
    availablePublis,
    linkableLoading,
    linkableError,
    linkMutating,
    activeLinkMutationId,
    onLinkScript,
    onLinkPubli,
    onUnlinkEntity,
    onUpdateLinkStatus,
}: CampaignDetailViewProps) {
    const [isContextExpanded, setIsContextExpanded] = useState(false);
    const [isAssetsExpanded, setIsAssetsExpanded] = useState(false);
    const [isNegotiationOptionsOpen, setIsNegotiationOptionsOpen] = useState(false);
    const [isAssistantOptionsExpanded, setIsAssistantOptionsExpanded] = useState(true);
    const [isBudgetOptionsExpanded, setIsBudgetOptionsExpanded] = useState(false);
    const [isReplyComposerFocused, setIsReplyComposerFocused] = useState(false);
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
    const [assetPickerType, setAssetPickerType] = useState<CampaignLinkItem["entityType"]>('script');
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const [selectedScriptToLink, setSelectedScriptToLink] = useState('');
    const [selectedPubliToLink, setSelectedPubliToLink] = useState('');
    const actionsMenuRef = useRef<HTMLDivElement | null>(null);
    const negotiationCardRef = useRef<HTMLDivElement | null>(null);

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
    const isFocusMode = isReplyComposerFocused;
    const shouldShowSupportingSections = !isFocusMode;
    const selectedStatusTheme = STATUS_THEME[selectedFunnelStatus];
    const currentIntentTheme = REPLY_INTENT_THEME[replyIntent];
    const getLinkTheme = (link: CampaignLinkItem) => {
        if (link.entityType !== "script") {
            return {
                cardClass: "border-slate-100 bg-slate-50/70",
                typePillClass: "bg-white text-slate-500",
                selectClass: "border-slate-200 bg-white text-slate-700",
            };
        }
        return SCRIPT_APPROVAL_THEME[link.scriptApprovalStatus || "draft"];
    };
    const assistantSummaryChips = analysisV2
        ? [
            {
                label: `Diagnóstico: ${ASSISTANT_VERDICT_LABELS[analysisV2.verdict]}`,
                tone: (analysisV2.verdict === "aceitar" || analysisV2.verdict === "aceitar_com_extra")
                    ? "positive"
                    : analysisV2.verdict === "coletar_orcamento"
                        ? "info"
                        : "warning",
            },
            {
                label: `Confiança: ${analysisV2.confidence.label} (${(analysisV2.confidence.score * 100).toFixed(0)}%)`,
                tone: analysisV2.confidence.label === "alta"
                    ? "positive"
                    : analysisV2.confidence.label === "baixa"
                        ? "warning"
                        : "neutral",
            },
            {
                label: `Faixa: ${formatMoney(analysisV2.pricing.floor, analysisV2.pricing.currency)} - ${formatMoney(analysisV2.pricing.anchor, analysisV2.pricing.currency)}`,
                tone: "info",
            },
            {
                label: `Diferença: ${formatGapLabel(analysisV2.pricing.gapPercent)}`,
                tone: analysisV2.pricing.gapPercent !== null && analysisV2.pricing.gapPercent > 0
                    ? "warning"
                    : "positive",
            },
        ].filter((chip): chip is { label: string; tone: "neutral" | "info" | "positive" | "warning" } => Boolean(chip))
        : analysisMessage
            ? [{ label: "Análise rápida pronta", tone: "neutral" as const }]
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

    useEffect(() => {
        if (!availableScripts.length) {
            setSelectedScriptToLink('');
            return;
        }
        setSelectedScriptToLink((current) =>
            current && availableScripts.some((item) => item.id === current)
                ? current
                : availableScripts[0]?.id ?? ''
        );
    }, [availableScripts]);

    useEffect(() => {
        if (!availablePublis.length) {
            setSelectedPubliToLink('');
            return;
        }
        setSelectedPubliToLink((current) =>
            current && availablePublis.some((item) => item.id === current)
                ? current
                : availablePublis[0]?.id ?? ''
        );
    }, [availablePublis]);

    const handleLinkScriptClick = async () => {
        if (!selectedScriptToLink) return;
        await onLinkScript(selectedScriptToLink);
    };

    const handleLinkPubliClick = async () => {
        if (!selectedPubliToLink) return;
        await onLinkPubli(selectedPubliToLink);
    };

    const handleLinkSelectedAsset = async () => {
        if (assetPickerType === 'script') {
            await handleLinkScriptClick();
            return;
        }
        await handleLinkPubliClick();
    };

    const handleToggleAssetsExpanded = () => {
        setIsAssetsExpanded((current) => {
            const next = !current;
            if (!next) {
                setIsAssetPickerOpen(false);
            }
            return next;
        });
    };

    const handleComposerFocus = () => {
        setIsReplyComposerFocused(true);
        setIsNegotiationOptionsOpen(false);
        setIsActionsMenuOpen(false);
    };

    const handleComposerBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
        const nextFocusedElement = event.relatedTarget as Node | null;
        if (nextFocusedElement && negotiationCardRef.current?.contains(nextFocusedElement)) {
            return;
        }
        setIsReplyComposerFocused(false);
    };

    return (
        <div className="flex h-full flex-col bg-white">
            {/* Header */}
            <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white">
                <div className="dashboard-page-shell py-2.5">
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
                                <span>{proposal.brandName || "Marca não informada"}</span>
                                <span className="px-1.5 text-slate-300">/</span>
                                <span className="text-slate-700">{proposal.campaignTitle || "Campanha sem título"}</span>
                            </h1>
                            <p className={`mt-0.5 truncate text-xs font-medium text-slate-500 ${isFocusMode ? "hidden" : ""}`}>
                                <span>{receivedBudgetLabel}</span>
                                <span className="px-1.5 text-slate-300">•</span>
                                <span>{formatDate(proposal.createdAt)}</span>
                            </p>
                        </div>

                        <div className={isFocusMode ? "hidden" : "hidden sm:block"}>
                            <div className="relative">
                                <select
                                    value={selectedFunnelStatus}
                                    onChange={(e) => onStatusChange(proposal.id, e.target.value as ProposalStatus)}
                                    className={`appearance-none rounded-lg border py-1.5 pl-3 pr-8 text-xs font-semibold shadow-sm outline-none transition focus:ring-2 ${selectedStatusTheme.selectClass}`}
                                >
                                    {STATUS_OPTIONS.map(s => (
                                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            </div>
                        </div>
                    </div>

                    {!isFocusMode && (
                        <div className="relative mt-2 sm:hidden">
                            <select
                                value={selectedFunnelStatus}
                                onChange={(e) => onStatusChange(proposal.id, e.target.value as ProposalStatus)}
                                className={`w-full appearance-none rounded-lg border py-2 pl-3 pr-8 text-xs font-semibold shadow-sm outline-none transition focus:ring-2 ${selectedStatusTheme.selectClass}`}
                            >
                                {STATUS_OPTIONS.map(s => (
                                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content - Centered Single Column */}
            <main className="flex-1 overflow-y-auto">
                <div className={`dashboard-page-shell ${isFocusMode ? "py-1 pb-20 sm:py-2 sm:pb-16" : "py-4"}`}>

                    <div className={isFocusMode ? "space-y-2" : "space-y-3"}>
                        {shouldShowSupportingSections && (
                            <>
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">Briefing da campanha</p>
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
                                <button
                                    type="button"
                                    onClick={() => setIsContextExpanded((current) => !current)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                >
                                    {isContextExpanded ? "Recolher detalhes" : "Ver detalhes"}
                                    {isContextExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                            </div>

                            {isContextExpanded && (
                                <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                                    <div className="whitespace-pre-line text-sm leading-7 text-slate-700">
                                        {proposal.campaignDescription || (
                                            <span className="italic text-slate-400">Sem descrição.</span>
                                        )}
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Responsável</p>
                                            <p className="mt-1 text-sm text-slate-800">{proposal.contactName || "Não informado"}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">WhatsApp</p>
                                            <p className="mt-1 text-sm text-slate-800">{proposal.contactWhatsapp || "Não informado"}</p>
                                        </div>
                                    </div>
                                    {referenceLinks.length > 0 && (
                                        <div className="space-y-1">
                                            {referenceLinks.map((link) => (
                                                <a
                                                    key={link}
                                                    href={link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                                                >
                                                    <ExternalLink size={12} />
                                                    <span className="truncate">{link}</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-800">Ativos vinculados</p>
                                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                        {campaignLinks.length}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleToggleAssetsExpanded}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                >
                                    {isAssetsExpanded ? "Fechar gestão" : "Gerenciar"}
                                    {isAssetsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                            </div>

                            {isAssetsExpanded && (
                                <div className="border-t border-slate-100 px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsAssetPickerOpen((current) => !current)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                    >
                                        <Link2 size={13} />
                                        {isAssetPickerOpen ? "Fechar adição" : "Adicionar ativo"}
                                    </button>
                                </div>
                            )}

                            {isAssetsExpanded && (campaignLinksError || linkableError) && (
                                <div className="border-t border-slate-100 px-4 py-2">
                                    {campaignLinksError && <p className="text-xs text-rose-500">{campaignLinksError}</p>}
                                    {linkableError && <p className="text-xs text-amber-600">{linkableError}</p>}
                                </div>
                            )}

                            {isAssetsExpanded && isAssetPickerOpen && (
                                <div className="space-y-2 border-t border-slate-100 px-4 py-3">
                                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setAssetPickerType('script')}
                                            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${assetPickerType === 'script'
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Roteiros
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAssetPickerType('publi')}
                                            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${assetPickerType === 'publi'
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            Publis
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <select
                                            value={assetPickerType === 'script' ? selectedScriptToLink : selectedPubliToLink}
                                            onChange={(event) => {
                                                if (assetPickerType === 'script') {
                                                    setSelectedScriptToLink(event.target.value);
                                                    return;
                                                }
                                                setSelectedPubliToLink(event.target.value);
                                            }}
                                            disabled={
                                                linkableLoading ||
                                                linkMutating ||
                                                (assetPickerType === 'script'
                                                    ? availableScripts.length === 0
                                                    : availablePublis.length === 0)
                                            }
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                        >
                                            {assetPickerType === 'script'
                                                ? availableScripts.length === 0
                                                    ? <option value="">Sem roteiros disponíveis</option>
                                                    : availableScripts.map((item) => (
                                                        <option key={item.id} value={item.id}>{item.title}</option>
                                                    ))
                                                : availablePublis.length === 0
                                                    ? <option value="">Sem publis disponíveis</option>
                                                    : availablePublis.map((item) => (
                                                        <option key={item.id} value={item.id}>
                                                            {item.description || item.theme || "Publi sem descrição"}
                                                        </option>
                                                    ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleLinkSelectedAsset();
                                            }}
                                            disabled={
                                                linkMutating ||
                                                linkableLoading ||
                                                (assetPickerType === 'script' ? !selectedScriptToLink : !selectedPubliToLink)
                                            }
                                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[130px]"
                                        >
                                            {linkMutating &&
                                                activeLinkMutationId === (assetPickerType === 'script' ? selectedScriptToLink : selectedPubliToLink)
                                                ? "Vinculando..."
                                                : "Vincular"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isAssetsExpanded && (
                                <div className="space-y-2 border-t border-slate-100 px-4 py-3">
                                    {campaignLinksLoading ? (
                                        <p className="text-xs text-slate-400">Carregando ativos...</p>
                                    ) : campaignLinks.length === 0 ? (
                                        <p className="text-xs text-slate-400">Sem ativos.</p>
                                    ) : (
                                        campaignLinks.map((link) => (
                                            <div key={link.id} className={`rounded-xl border p-3 ${getLinkTheme(link).cardClass}`}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getLinkTheme(link).typePillClass}`}>
                                                            {link.entityType === 'script' ? 'Roteiro' : 'Publi'}
                                                        </span>
                                                        <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                                                            {link.entity?.title || "Item removido"}
                                                        </p>
                                                        {link.entity?.subtitle ? (
                                                            <p className="text-xs text-slate-500">{link.entity.subtitle}</p>
                                                        ) : null}
                                                        {link.entity?.detailUrl && (
                                                            <a
                                                                href={
                                                                    link.entityType === 'script'
                                                                        ? appendQueryParam(
                                                                            appendQueryParam(link.entity.detailUrl, "scriptId", link.entityId),
                                                                            "proposalId",
                                                                            proposal.id
                                                                        )
                                                                        : appendQueryParam(link.entity.detailUrl, "proposalId", proposal.id)
                                                                }
                                                                className="mt-1 inline-flex text-xs font-medium text-blue-600 hover:underline"
                                                            >
                                                                Abrir
                                                            </a>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            void onUnlinkEntity(link.id);
                                                        }}
                                                        disabled={linkMutating}
                                                        className="text-xs font-semibold text-slate-500 transition hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                                {link.entityType === 'script' && (
                                                    <select
                                                        value={link.scriptApprovalStatus || "draft"}
                                                        onChange={(event) => {
                                                            void onUpdateLinkStatus(
                                                                link.id,
                                                                event.target.value as CampaignLinkScriptApprovalStatus
                                                            );
                                                        }}
                                                        disabled={linkMutating}
                                                        className={`mt-2 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 ${SCRIPT_APPROVAL_THEME[link.scriptApprovalStatus || "draft"].selectClass}`}
                                                    >
                                                        {SCRIPT_APPROVAL_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                            </>
                        )}

                        <div
                            ref={negotiationCardRef}
                            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white transition ${isFocusMode ? "shadow-sm" : ""}`}
                        >
                            <div className={`flex items-center justify-between gap-3 border-b border-slate-100 ${isFocusMode ? "px-3 py-2" : "px-4 py-3"}`}>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">Resposta da campanha</p>
                                    <div className="mt-1 inline-flex max-w-full items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5">
                                        <Mail size={12} className="mt-0.5 shrink-0 text-sky-700" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Respondendo para</p>
                                            <p className="truncate text-xs font-semibold text-sky-900">{proposal.contactEmail}</p>
                                        </div>
                                    </div>
                                </div>
                                {isFocusMode ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsReplyComposerFocused(false)}
                                        data-focus-control="true"
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                    >
                                        Sair do foco
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setIsNegotiationOptionsOpen((current) => !current)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                    >
                                        {isNegotiationOptionsOpen ? "Fechar opções" : "Opções"}
                                        {isNegotiationOptionsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                )}
                            </div>

                            {isNegotiationOptionsOpen && (
                                <div className="space-y-3 border-b border-slate-100 px-4 py-4">
                                    <section className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsAssistantOptionsExpanded((current) => !current)}
                                            className="flex w-full items-center justify-between gap-2 text-left"
                                        >
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">IA de negociação</p>
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                                {hasAnalysis ? "Com análise" : "Sem análise"}
                                                {isAssistantOptionsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </span>
                                        </button>

                                        {isAssistantOptionsExpanded && (
                                            <div className="mt-3 space-y-3 border-t border-slate-200/80 pt-3">
                                                {!hasAnalysis && (
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm text-slate-600">Gerar diagnóstico e sugestão de resposta.</p>
                                                        <button
                                                            type="button"
                                                            onClick={onAnalyze}
                                                            disabled={analysisLoading}
                                                            className={
                                                                !canInteract && !isBillingLoading
                                                                    ? "inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
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
                                                    <div className="flex items-center justify-between rounded-xl border border-fuchsia-200 bg-fuchsia-50/70 px-3 py-2.5">
                                                        <p className="text-xs font-medium text-fuchsia-800">Análise completa disponível no plano.</p>
                                                        <button onClick={onUpgradeClick} className="text-xs font-semibold text-pink-600 hover:text-pink-700 hover:underline">Ver planos</button>
                                                    </div>
                                                )}

                                                {canInteract && hasAnalysis && (
                                                    <div className="space-y-3">
                                                        {assistantSummaryChips.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {assistantSummaryChips.map((chip) => (
                                                                    <span
                                                                        key={chip.label}
                                                                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${ASSISTANT_SUMMARY_CHIP_THEME[chip.tone]}`}
                                                                    >
                                                                        {chip.label}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <AnalysisSummaryCard
                                                            analysisMessage={analysisMessage}
                                                            analysisV2={analysisV2}
                                                            analysisPricingMeta={analysisPricingMeta}
                                                            viewMode={viewMode}
                                                            onToggleViewMode={onToggleViewMode}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </section>

                                    <section className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsBudgetOptionsExpanded((current) => !current)}
                                            className="flex w-full items-center justify-between gap-2 text-left"
                                        >
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Valores e proposta</p>
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                                {isBudgetOptionsExpanded ? "Ocultar" : "Mostrar"}
                                                {isBudgetOptionsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </span>
                                        </button>

                                        {isBudgetOptionsExpanded && (
                                            <div className="mt-3 space-y-3 border-t border-slate-200/80 pt-3">
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    <div
                                                        className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                                                        aria-label={`Valor da marca: ${receivedBudgetLabel}`}
                                                    >
                                                        <p className="text-sm font-semibold text-slate-900">{receivedBudgetLabel}</p>
                                                    </div>
                                                    <div
                                                        className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                                                        aria-label={`Seu último valor: ${proposedBudgetLabel}`}
                                                    >
                                                        <p className="text-sm font-semibold text-slate-900">{proposedBudgetLabel}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                                                        {budgetSaving ? "Salvando..." : "Salvar"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                </div>
                            )}

                            <div className={`transition ${!canInteract ? 'opacity-50 grayscale-[0.5]' : ''} ${isReplyComposerFocused ? 'ring-2 ring-slate-200' : ''}`}>
                                <textarea
                                    ref={replyTextareaRef}
                                    value={replyDraft}
                                    onChange={(e) => onReplyDraftChange(e.target.value)}
                                    onFocus={handleComposerFocus}
                                    onBlur={handleComposerBlur}
                                    onKeyDown={(event) => {
                                        if (event.key !== "Escape") return;
                                        setIsReplyComposerFocused(false);
                                        event.currentTarget.blur();
                                    }}
                                    placeholder={canInteract ? "Escreva a resposta..." : "Desbloqueie para responder..."}
                                    className={`w-full resize-y border-y border-slate-100 bg-transparent p-4 text-[15px] leading-[1.7] text-slate-800 outline-none placeholder:text-slate-300 ${isFocusMode ? "min-h-[64vh] sm:min-h-[520px]" : "min-h-[360px]"}`}
                                    disabled={!canInteract}
                                />

                                <div className={`flex flex-col gap-2.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between ${isFocusMode ? "sticky bottom-0 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2.5 backdrop-blur" : "bg-slate-50/40"}`}>
                                    <div className={`flex items-center gap-2.5 ${isFocusMode ? "hidden sm:flex" : "flex-wrap"}`}>
                                        {proposal.lastResponseAt && (
                                            <span className={`flex items-center gap-1.5 text-[11px] font-medium text-slate-400 ${isFocusMode ? "hidden" : ""}`}>
                                                <Clock size={12} />
                                                {formatDate(proposal.lastResponseAt)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative flex w-full items-center justify-end gap-2 sm:w-auto" ref={actionsMenuRef}>
                                        {canInteract && hasAnalysis && !isFocusMode && (
                                            <button
                                                type="button"
                                                onClick={() => setIsActionsMenuOpen((current) => !current)}
                                                aria-haspopup="menu"
                                                aria-expanded={isActionsMenuOpen}
                                                className={`inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-xs font-semibold transition hover:opacity-90 ${currentIntentTheme.chipClass}`}
                                            >
                                                {currentIntentLabel}
                                                <ChevronDown size={13} className={isActionsMenuOpen ? "rotate-180 transition-transform" : "transition-transform"} />
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
                                                                ? REPLY_INTENT_THEME[chip.key].menuActiveClass
                                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                                                                }`}
                                                        >
                                                            <span>{chip.label}</span>
                                                            {replyIntent === chip.key && <Check size={13} className={REPLY_INTENT_THEME[chip.key].menuActiveIconClass} />}
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
                                            data-focus-control="true"
                                            disabled={replySending || !replyDraft.trim() || !canInteract}
                                            className={`inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50 ${isFocusMode ? "w-full" : "w-full sm:w-auto"}`}
                                        >
                                            <Send size={14} />
                                            {replySending ? "Enviando..." : "Enviar"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
