import React, { useEffect, useRef, useState } from "react";
import {
    ArrowLeft,
    Send,
    Lock,
    RefreshCcw,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Link2,
    ArrowRight,
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
    compactView?: boolean;
    onBack: () => void;
    onStatusChange: (id: string, status: ProposalStatus) => void;
    // Formatters
    formatDate: (value: string | null) => string;
    formatMoney: (value: number | null, currency: string) => string;
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

const STATUS_CONFIG: Record<ProposalStatus, {
    label: string;
    badgeClassName: string;
    heroClassName: string;
    statClassName: string;
    accentClassName: string;
    selectClassName: string;
}> = {
    novo: {
        label: "Recebida",
        badgeClassName: "border border-rose-200/80 bg-rose-50/92 text-rose-700",
        heroClassName: "border-rose-100/80 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,241,242,0.92))]",
        statClassName: "border-rose-100/80 bg-white/80",
        accentClassName: "text-rose-500",
        selectClassName: "border-rose-200 bg-white/92 text-rose-700 hover:border-rose-300 focus:border-rose-300 focus:ring-rose-100",
    },
    visto: {
        label: "Recebida",
        badgeClassName: "border border-rose-200/80 bg-rose-50/92 text-rose-700",
        heroClassName: "border-rose-100/80 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,241,242,0.92))]",
        statClassName: "border-rose-100/80 bg-white/80",
        accentClassName: "text-rose-500",
        selectClassName: "border-rose-200 bg-white/92 text-rose-700 hover:border-rose-300 focus:border-rose-300 focus:ring-rose-100",
    },
    respondido: {
        label: "Em negociação",
        badgeClassName: "border border-amber-200/80 bg-amber-50/92 text-amber-700",
        heroClassName: "border-amber-100/80 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,251,235,0.94))]",
        statClassName: "border-amber-100/80 bg-white/82",
        accentClassName: "text-amber-500",
        selectClassName: "border-amber-200 bg-white/92 text-amber-700 hover:border-amber-300 focus:border-amber-300 focus:ring-amber-100",
    },
    aceito: {
        label: "Fechada",
        badgeClassName: "border border-emerald-200/80 bg-emerald-50/92 text-emerald-700",
        heroClassName: "border-emerald-100/80 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.13),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,253,245,0.94))]",
        statClassName: "border-emerald-100/80 bg-white/82",
        accentClassName: "text-emerald-500",
        selectClassName: "border-emerald-200 bg-white/92 text-emerald-700 hover:border-emerald-300 focus:border-emerald-300 focus:ring-emerald-100",
    },
    rejeitado: {
        label: "Perdida",
        badgeClassName: "border border-zinc-200/90 bg-zinc-100/90 text-zinc-600",
        heroClassName: "border-zinc-200/90 bg-[radial-gradient(circle_at_top_right,rgba(161,161,170,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,244,245,0.94))]",
        statClassName: "border-zinc-200/90 bg-white/82",
        accentClassName: "text-zinc-500",
        selectClassName: "border-zinc-200 bg-white/92 text-zinc-700 hover:border-zinc-300 focus:border-zinc-300 focus:ring-zinc-100",
    },
};

const STATUS_OPTIONS: ProposalStatus[] = ["novo", "respondido", "aceito", "rejeitado"];
const STATUS_SELECT_BASE_CLASS =
    "appearance-none rounded-xl border py-1.5 pl-3 pr-8 text-xs font-medium outline-none transition focus:ring-2";

const INTENT_CHIPS: Array<{ key: ReplyIntent; label: string }> = [
    { key: "accept", label: "Topar valor" },
    { key: "adjust_value", label: "Pedir ajuste" },
    { key: "adjust_scope", label: "Ajustar escopo" },
    { key: "collect_budget", label: "Pedir orçamento" },
];
const REPLY_INTENT_THEME: Record<ReplyIntent, { chipClass: string; menuActiveClass: string; menuActiveIconClass: string }> = {
    accept: {
        chipClass: "border border-pink-200 bg-pink-50 text-pink-700 shadow-sm",
        menuActiveClass: "bg-pink-50 text-pink-800",
        menuActiveIconClass: "text-pink-600",
    },
    adjust_value: {
        chipClass: "border border-amber-200 bg-amber-50 text-amber-700",
        menuActiveClass: "bg-amber-50 text-amber-800",
        menuActiveIconClass: "text-amber-600",
    },
    adjust_scope: {
        chipClass: "border border-orange-200 bg-orange-50 text-orange-700",
        menuActiveClass: "bg-orange-50 text-orange-800",
        menuActiveIconClass: "text-orange-600",
    },
    collect_budget: {
        chipClass: "border border-zinc-200 bg-zinc-100 text-zinc-700",
        menuActiveClass: "bg-zinc-100 text-zinc-800",
        menuActiveIconClass: "text-zinc-600",
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
        cardClass: "border-zinc-200 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.04)]",
        selectClass: "border-zinc-200 bg-zinc-50 text-zinc-700 focus:border-pink-200 focus:ring-pink-100",
        typePillClass: "border border-zinc-200 bg-zinc-100 text-zinc-600",
    },
    sent: {
        cardClass: "border-zinc-200 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.04)]",
        selectClass: "border-pink-200 bg-pink-50 text-pink-700 focus:border-pink-300 focus:ring-pink-100",
        typePillClass: "border border-pink-200 bg-pink-50 text-pink-700",
    },
    approved: {
        cardClass: "border-zinc-200 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.04)]",
        selectClass: "border-emerald-200 bg-emerald-50 text-emerald-700 focus:border-emerald-300 focus:ring-emerald-100",
        typePillClass: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    changes_requested: {
        cardClass: "border-zinc-200 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.04)]",
        selectClass: "border-amber-200 bg-amber-50 text-amber-700 focus:border-amber-300 focus:ring-amber-100",
        typePillClass: "border border-amber-200 bg-amber-50 text-amber-700",
    },
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
    compactView = false,
    onBack,
    onStatusChange,
    formatDate,
    formatMoney,
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
    const [isAssetsExpanded, setIsAssetsExpanded] = useState(false);
    const [isReplyComposerFocused, setIsReplyComposerFocused] = useState(false);
    const [isIntentMenuOpen, setIsIntentMenuOpen] = useState(false);
    const [isSummaryExtrasOpen, setIsSummaryExtrasOpen] = useState(false);
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
    const [assetPickerType, setAssetPickerType] = useState<CampaignLinkItem["entityType"]>('script');
    const [selectedScriptToLink, setSelectedScriptToLink] = useState('');
    const [selectedPubliToLink, setSelectedPubliToLink] = useState('');
    const negotiationCardRef = useRef<HTMLDivElement | null>(null);

    const deliverables = Array.isArray(proposal.deliverables) ? proposal.deliverables : [];
    const referenceLinks = Array.isArray(proposal.referenceLinks) ? proposal.referenceLinks : [];
    const hasAnalysis = Boolean(analysisMessage || analysisV2);
    const selectedFunnelStatus: ProposalStatus = proposal.status === "visto" ? "novo" : proposal.status;
    const statusTheme = STATUS_CONFIG[selectedFunnelStatus];
    const receivedBudgetLabel =
        proposal.budgetIntent === "requested" && proposal.budget === null
            ? "Marca solicitou orçamento"
            : formatMoney(proposal.budget, proposal.currency);
    const proposedBudgetLabel =
        typeof proposal.creatorProposedBudget === "number"
            ? formatMoney(proposal.creatorProposedBudget, proposal.creatorProposedCurrency || proposal.currency)
            : "Não informado";
    const summaryDescription = proposal.campaignDescription?.trim() || "";
    const hasSummaryDescription = Boolean(summaryDescription);
    const summaryItems = [
        proposal.contactName ? { label: "Contato", value: proposal.contactName } : null,
        proposal.contactEmail ? { label: "Email", value: proposal.contactEmail } : null,
        proposal.contactWhatsapp ? { label: "WhatsApp", value: proposal.contactWhatsapp } : null,
        { label: "Recebida", value: formatDate(proposal.createdAt) },
    ].filter((item): item is { label: string; value: string } => item !== null);
    const summaryPreview = [
        formatDate(proposal.createdAt),
        deliverables.length > 0 ? `${deliverables.length} entrega${deliverables.length > 1 ? "s" : ""}` : null,
        referenceLinks.length > 0 ? `${referenceLinks.length} referência${referenceLinks.length > 1 ? "s" : ""}` : null,
    ]
        .filter(Boolean)
        .join(" • ");
    const isFocusMode = isReplyComposerFocused;
    const shouldShowSupportingSections = !isFocusMode;
    const responseEmail = proposal.contactEmail || "Email não informado";
    const pricingSummary = [receivedBudgetLabel, proposedBudgetLabel !== "Não informado" ? `Seu valor ${proposedBudgetLabel}` : null]
        .filter(Boolean)
        .join(" • ");
    const heroMetaItems = [
        proposal.contactName || null,
        responseEmail,
        deliverables.length > 0 ? `${deliverables.length} item${deliverables.length > 1 ? "s" : ""}` : "Sem entregas",
    ].filter((item): item is string => item !== null);
    const heroMetaDate = formatDate(proposal.createdAt);
    const shouldShowAssetsSection = campaignLinksLoading || campaignLinks.length > 0 || Boolean(campaignLinksError);
    const shouldShowPricingSection =
        proposal.budgetIntent === "requested" ||
        proposal.budget !== null ||
        typeof proposal.creatorProposedBudget === "number" ||
        budgetInput.trim().length > 0;
    const hasSummaryExtras = referenceLinks.length > 0;
    const aiPreview = !canInteract && !isBillingLoading
        ? "IA no plano"
        : hasAnalysis
            ? "IA pronta"
            : "Gerar sugestão";
    const getLinkTheme = (link: CampaignLinkItem) => {
        if (link.entityType !== "script") {
            return {
                cardClass: "border-zinc-200 bg-white/90 shadow-[0_14px_34px_rgba(15,23,42,0.04)]",
                typePillClass: "border border-zinc-200 bg-zinc-100 text-zinc-500",
                selectClass: "border-zinc-200 bg-white text-zinc-700",
            };
        }
        return SCRIPT_APPROVAL_THEME[link.scriptApprovalStatus || "draft"];
    };
    const rootShellClass = compactView ? "px-3 py-2" : "dashboard-page-shell py-1.5 sm:py-2";
    const mainShellClass = compactView
        ? `${isFocusMode ? "px-3 py-1 pb-20" : "px-3 py-3"}`
        : `dashboard-page-shell ${isFocusMode ? "py-1 pb-20 sm:py-2 sm:pb-16" : "py-4"}`;

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

    useEffect(() => {
        const textarea = replyTextareaRef.current;
        if (!textarea) return;
        textarea.style.height = "0px";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, [isFocusMode, replyDraft, replyTextareaRef]);

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
    };

    const handleComposerBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
        const nextFocusedElement = event.relatedTarget as Node | null;
        if (nextFocusedElement && negotiationCardRef.current?.contains(nextFocusedElement)) {
            return;
        }
        setIsReplyComposerFocused(false);
        setIsIntentMenuOpen(false);
    };

    const campaignBriefingSections = shouldShowSupportingSections ? (
        <div className="mx-auto w-full max-w-[42rem] divide-y divide-zinc-100">
            {!isFocusMode && shouldShowPricingSection ? (
                <section className="py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                        <p className="dashboard-muted-label">Valores</p>
                        <p className="mt-1 text-base font-semibold tracking-[-0.02em] text-zinc-950">Negociação</p>
                        <p className="mt-1 line-clamp-1 text-sm text-zinc-500">{pricingSummary}</p>
                    </div>
                    <div className="pt-3">
                        <div className="space-y-3">
                            <div aria-label={`Valor da marca: ${receivedBudgetLabel}`}>
                                <p className="dashboard-muted-label">Valor da marca</p>
                                <p className="mt-1 text-sm font-medium text-zinc-900">{receivedBudgetLabel}</p>
                            </div>
                            <div aria-label={`Seu último valor: ${proposedBudgetLabel}`}>
                                <p className="dashboard-muted-label">Seu valor</p>
                                <p className="mt-1 text-sm font-medium text-zinc-900">{proposedBudgetLabel}</p>
                            </div>
                        </div>
                        <div className="mt-3 space-y-2.5">
                            <input
                                value={budgetInput}
                                onChange={(e) => onBudgetInputChange(e.target.value)}
                                placeholder={`Ex.: ${proposal.currency === 'BRL' ? '5000' : '1000'}`}
                                className="dashboard-select w-full rounded-[0.95rem] px-3 py-2 text-sm text-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-100"
                            />
                            <button
                                type="button"
                                onClick={onSaveBudget}
                                disabled={budgetSaving}
                                className="dashboard-secondary-button inline-flex items-center justify-center rounded-[1rem] px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {budgetSaving ? "Salvando..." : "Salvar valor"}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            <section className={`py-4 ${!isFocusMode && shouldShowPricingSection ? "" : "first:pt-0"} last:pb-0`}>
                <div className="min-w-0">
                    <p className="dashboard-muted-label">Briefing</p>
                    <p className="mt-1 text-base font-semibold tracking-[-0.02em] text-zinc-950">Contexto da campanha</p>
                    <p className="mt-1 line-clamp-1 text-sm leading-6 text-zinc-500">
                        {summaryPreview || "Sem contexto adicional."}
                    </p>
                </div>

                <div className="space-y-4 pt-3">
                    {hasSummaryDescription ? (
                        <div>
                            <p className="dashboard-muted-label">Descrição</p>
                            <p className="mt-1 break-words text-sm leading-6 text-zinc-700">{summaryDescription}</p>
                        </div>
                    ) : null}
                    <div>
                        <p className="dashboard-muted-label">Entregas</p>
                        {deliverables.length > 0 ? (
                            <ul className="mt-1.5 space-y-1.5">
                                {deliverables.map((item, index) => (
                                    <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-6 text-zinc-700">
                                        <span className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-zinc-300" aria-hidden="true" />
                                        <span className="min-w-0 break-words">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-1 text-sm text-zinc-500">Não informado</p>
                        )}
                    </div>
                    <div className="space-y-3">
                        {summaryItems.map((item) => (
                            <div key={item.label} className="min-w-0">
                                <p className="dashboard-muted-label">{item.label}</p>
                                <p className="mt-1 break-words text-sm font-medium text-zinc-800">{item.value}</p>
                            </div>
                        ))}
                    </div>
                    {hasSummaryExtras ? (
                        <div className="border-t border-zinc-100 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsSummaryExtrasOpen((current) => !current)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
                            >
                                {isSummaryExtrasOpen ? "Ocultar extras" : "Ver referências e contato"}
                                {isSummaryExtrasOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>

                            {isSummaryExtrasOpen ? (
                                <div className="mt-4 space-y-4">
                                    {proposal.contactWhatsapp ? (
                                        <div>
                                            <p className="dashboard-muted-label">WhatsApp</p>
                                            <p className="mt-1 text-sm text-zinc-800">{proposal.contactWhatsapp}</p>
                                        </div>
                                    ) : null}
                                    {referenceLinks.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="dashboard-muted-label">Referências</p>
                                            <div className="space-y-1.5">
                                                {referenceLinks.map((link) => (
                                                    <a
                                                        key={link}
                                                        href={link}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex max-w-full items-center gap-1.5 text-xs font-semibold text-pink-600 hover:underline"
                                                    >
                                                        <ExternalLink size={12} />
                                                        <span className="truncate">{link}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </section>

            {shouldShowAssetsSection ? (
                <section className="py-4 last:pb-0">
                    <button
                        type="button"
                        onClick={handleToggleAssetsExpanded}
                        className="flex w-full items-center justify-between gap-3 text-left"
                    >
                        <div className="min-w-0">
                            <p className="dashboard-muted-label">Ativos</p>
                            <p className="mt-1 text-base font-semibold tracking-[-0.02em] text-zinc-950">Itens vinculados</p>
                            <p className="mt-1 text-sm text-zinc-500">
                                {campaignLinks.length === 0 ? "Nenhum ativo vinculado." : `${campaignLinks.length} ativo${campaignLinks.length > 1 ? "s" : ""} vinculado${campaignLinks.length > 1 ? "s" : ""}.`}
                            </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                            {isAssetsExpanded ? "Fechar" : "Abrir"}
                            {isAssetsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </span>
                    </button>

                    {isAssetsExpanded ? (
                        <>
                            <div className="pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAssetPickerOpen((current) => !current)}
                                    className="dashboard-secondary-button inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold"
                                >
                                    <Link2 size={13} />
                                    {isAssetPickerOpen ? "Fechar adição" : "Adicionar ativo"}
                                </button>
                            </div>

                            {campaignLinksError || linkableError ? (
                                <div className="pt-2">
                                    {campaignLinksError ? <p className="text-xs text-rose-500">{campaignLinksError}</p> : null}
                                    {linkableError ? <p className="text-xs text-amber-600">{linkableError}</p> : null}
                                </div>
                            ) : null}

                            {isAssetPickerOpen ? (
                                <div className="space-y-2 pt-3">
                                    <div className="dashboard-segmented grid grid-cols-2 gap-1 rounded-full p-1">
                                        <button
                                            type="button"
                                            onClick={() => setAssetPickerType('script')}
                                            className={`rounded-full px-2 py-1.5 text-xs font-semibold transition ${assetPickerType === 'script'
                                                ? 'bg-white text-zinc-900 shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-800'
                                                }`}
                                        >
                                            Roteiros
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAssetPickerType('publi')}
                                            className={`rounded-full px-2 py-1.5 text-xs font-semibold transition ${assetPickerType === 'publi'
                                                ? 'bg-white text-zinc-900 shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-800'
                                                }`}
                                        >
                                            Publis
                                        </button>
                                    </div>
                                    <div className="space-y-2">
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
                                            className="dashboard-select w-full rounded-[1rem] px-3 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-100"
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
                                            className="dashboard-primary-button inline-flex items-center justify-center rounded-[1rem] px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {linkMutating &&
                                                activeLinkMutationId === (assetPickerType === 'script' ? selectedScriptToLink : selectedPubliToLink)
                                                ? "Vinculando..."
                                                : "Vincular"}
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            <div className="pt-3">
                                {campaignLinksLoading ? (
                                    <p className="text-xs text-zinc-400">Carregando ativos...</p>
                                ) : campaignLinks.length === 0 ? (
                                    <p className="text-xs text-zinc-400">Sem ativos.</p>
                                ) : (
                                    <div className="divide-y divide-zinc-100">
                                        {campaignLinks.map((link) => (
                                            <div key={link.id} className="py-3 first:pt-0 last:pb-0">
                                                <div className="space-y-2">
                                                    <div className="min-w-0">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getLinkTheme(link).typePillClass}`}>
                                                            {link.entityType === 'script' ? 'Roteiro' : 'Publi'}
                                                        </span>
                                                        <p className="mt-1 truncate text-sm font-semibold text-zinc-900">
                                                            {link.entity?.title || "Item removido"}
                                                        </p>
                                                        {link.entity?.subtitle ? (
                                                            <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{link.entity.subtitle}</p>
                                                        ) : null}
                                                        {link.entity?.detailUrl ? (
                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
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
                                                                    className="inline-flex text-xs font-semibold text-pink-600 hover:underline"
                                                                >
                                                                    Abrir
                                                                </a>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <div className="pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                void onUnlinkEntity(link.id);
                                                            }}
                                                            disabled={linkMutating}
                                                            className="text-xs font-semibold text-zinc-500 transition hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Remover
                                                        </button>
                                                    </div>
                                                </div>
                                                {link.entityType === 'script' ? (
                                                    <select
                                                        value={link.scriptApprovalStatus || "draft"}
                                                        onChange={(event) => {
                                                            void onUpdateLinkStatus(
                                                                link.id,
                                                                event.target.value as CampaignLinkScriptApprovalStatus
                                                            );
                                                        }}
                                                        disabled={linkMutating}
                                                        className={`mt-2 w-full rounded-full border px-2.5 py-1.5 text-xs font-medium outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100 ${SCRIPT_APPROVAL_THEME[link.scriptApprovalStatus || "draft"].selectClass}`}
                                                    >
                                                        {SCRIPT_APPROVAL_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : null}
                </section>
            ) : null}
        </div>
    ) : null;

    return (
        <div className="flex h-full min-h-0 flex-col bg-transparent">
            <header className="sticky top-0 z-20 shrink-0 border-b border-zinc-100 bg-white/95 backdrop-blur-md">
                <div className={rootShellClass}>
                    <div className={isFocusMode ? "" : "mx-auto w-full max-w-[42rem]"}>
                        <div className={`flex ${compactView ? "items-center gap-2.5" : "items-center gap-3 sm:items-center"}`}>
                            <button
                                type="button"
                                onClick={onBack}
                                className="group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900"
                                aria-label="Voltar"
                            >
                                <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                            </button>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-medium text-zinc-500">
                                    {proposal.campaignTitle || "Campanha"}
                                </p>
                            </div>

                            <div className={isFocusMode ? "hidden" : "hidden sm:flex sm:items-center sm:gap-2"}>
                                <div className="relative">
                                    <select
                                        value={selectedFunnelStatus}
                                        onChange={(e) => onStatusChange(proposal.id, e.target.value as ProposalStatus)}
                                        className={`${STATUS_SELECT_BASE_CLASS} ${statusTheme.selectClassName}`}
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                                </div>
                            </div>
                        </div>

                        {!isFocusMode && (
                            <div className="mt-1 flex items-center gap-2 sm:hidden">
                                <div className="relative min-w-0">
                                    <select
                                        value={selectedFunnelStatus}
                                        onChange={(e) => onStatusChange(proposal.id, e.target.value as ProposalStatus)}
                                        className={`${STATUS_SELECT_BASE_CLASS} ${statusTheme.selectClassName} min-w-[9rem] max-w-[11rem] pr-9`}
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto">
                <div className={mainShellClass}>
                    <div className={isFocusMode ? "flex flex-col gap-2" : "flex flex-col gap-4"}>
                        {!isFocusMode ? (
                            <section className="order-0 border-b border-zinc-100 pb-3">
                                <div className="mx-auto flex w-full max-w-[42rem] items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:text-[11px] sm:tracking-[0.16em]">
                                                        {proposal.brandName || "Marca não informada"}
                                                    </span>
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] sm:px-2.5 sm:py-0.5 sm:text-[10px] sm:tracking-[0.12em] ${statusTheme.badgeClassName}`}>
                                                        {statusTheme.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="shrink-0 text-[17px] font-semibold tabular-nums tracking-[-0.03em] text-zinc-900 sm:text-[18px]">
                                                {receivedBudgetLabel}
                                            </p>
                                        </div>
                                        <h1 className={`mt-1 line-clamp-2 ${compactView ? "text-[17px] leading-[1.14]" : "text-[21px] leading-[1.08]"} font-semibold tracking-[-0.03em] text-zinc-950`}>
                                            {proposal.campaignTitle || "Campanha sem título"}
                                        </h1>
                                        <div className="mt-2 flex items-start gap-3">
                                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-5 text-zinc-500 sm:text-[13px]">
                                                {heroMetaItems.map((item, index) => (
                                                    <React.Fragment key={`${item}-${index}`}>
                                                        <span className="truncate">{item}</span>
                                                        {index < heroMetaItems.length - 1 ? <span className="text-zinc-300">•</span> : null}
                                                    </React.Fragment>
                                                ))}
                                                <span className="text-zinc-300">•</span>
                                                <span className="text-zinc-400">{heroMetaDate}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        ) : null}
                        {campaignBriefingSections ? (
                            <div className="order-1">{campaignBriefingSections}</div>
                        ) : null}

                        <div
                            ref={negotiationCardRef}
                            className={`order-1 flex flex-col transition ${isFocusMode ? "shadow-sm" : ""}`}
                        >
                            <div className={`${isFocusMode ? "px-3 py-2" : "border-b border-zinc-100 pb-2 pt-1"}`}>
                                <div className={`mx-auto flex w-full ${isFocusMode ? "max-w-none" : "max-w-[42rem]"} items-center justify-between gap-2`}>
                                    {isFocusMode ? (
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold tracking-[-0.02em] text-zinc-950">Responder</p>
                                        </div>
                                    ) : (
                                        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 sm:text-[12px]">
                                            <span className="h-1 w-1 rounded-full bg-emerald-400" aria-hidden="true" />
                                            {aiPreview}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2">
                                        {!isFocusMode && canInteract && hasAnalysis ? (
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsIntentMenuOpen((current) => !current)}
                                                    className={`inline-flex items-center gap-1 text-[11px] font-medium transition ${
                                                        isIntentMenuOpen
                                                            ? "text-zinc-700"
                                                            : "text-zinc-400 hover:text-zinc-700"
                                                    }`}
                                                    aria-label={isIntentMenuOpen ? "Fechar ajustes de resposta" : "Ajustar resposta"}
                                                >
                                                    Ajustar resposta
                                                    {isIntentMenuOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                </button>
                                                {isIntentMenuOpen ? (
                                                    <div className="absolute right-0 top-[calc(100%+0.4rem)] z-10 flex min-w-[11rem] flex-col gap-1 rounded-[1rem] border border-zinc-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
                                                        {INTENT_CHIPS.map((chip) => (
                                                            <button
                                                                key={chip.key}
                                                                type="button"
                                                                onClick={() => {
                                                                    onReplyIntentChange(chip.key);
                                                                    setIsIntentMenuOpen(false);
                                                                }}
                                                                className={`inline-flex items-center rounded-[0.8rem] px-2.5 py-2 text-left text-[11px] font-semibold transition ${
                                                                    replyIntent === chip.key
                                                                        ? REPLY_INTENT_THEME[chip.key].menuActiveClass
                                                                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                                                                }`}
                                                            >
                                                                {chip.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={isFocusMode ? () => setIsReplyComposerFocused(false) : !canInteract && !isBillingLoading ? onUpgradeClick : hasAnalysis ? onRefreshReply : onAnalyze}
                                            data-focus-control={isFocusMode ? "true" : undefined}
                                            disabled={!isFocusMode && (analysisLoading || replyRegenerating)}
                                            className={
                                                isFocusMode
                                                    ? "dashboard-secondary-button inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                                                    : !canInteract && !isBillingLoading
                                                        ? "inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 transition hover:text-zinc-700"
                                                        : "inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 transition hover:text-zinc-700 disabled:opacity-50"
                                            }
                                        >
                                            {isFocusMode ? (
                                                "Sair do foco"
                                            ) : !canInteract && !isBillingLoading ? (
                                                <> <Lock size={11} /> Desbloquear IA </>
                                            ) : analysisLoading || replyRegenerating ? (
                                                <> <RefreshCcw size={11} className="animate-spin" /> Atualizando... </>
                                            ) : hasAnalysis ? (
                                                <> <RefreshCcw size={11} /> Atualizar </>
                                            ) : (
                                                "Gerar"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className={`order-2 flex flex-col transition ${isReplyComposerFocused ? 'ring-2 ring-pink-100' : ''}`}>
                                {!canInteract && (
                                    <div 
                                        onClick={onUpgradeClick}
                                        className="dashboard-soft-accent-card order-1 mb-3 mt-3 flex cursor-pointer items-center justify-between px-4 py-3 transition-colors group hover:brightness-[0.99]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Lock className="h-3 w-3 text-pink-500 transition-colors" />
                                            <span className="text-[11px] font-semibold text-zinc-700 transition-colors">
                                                Desbloqueie agora a IA de Negociação e Sugestão de Preços
                                            </span>
                                        </div>
                                        <ArrowRight className="h-3 w-3 translate-x-0 text-zinc-400 transition-all group-hover:translate-x-1 group-hover:text-zinc-700" />
                                    </div>
                                )}

                                <div className="order-3 mx-auto w-full max-w-[42rem]">
                                    {/* Card de Análise/Recomendação da IA com Overlay */}
                                    {hasAnalysis && (
                                        <div className="relative mb-4">
                                            {/* Overlay de Bloqueio apenas para a Análise/Recomendação */}
                                            {!canInteract && (
                                                <div 
                                                    onClick={onUpgradeClick}
                                                    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[4px] rounded-2xl border border-zinc-100 cursor-pointer group px-4 py-6"
                                                >
                                                    <div className="flex flex-col items-center gap-2 text-center">
                                                        <div className="rounded-xl bg-brand-primary/10 p-2 border border-brand-primary/20 shadow-sm transition group-hover:scale-110">
                                                            <Lock className="w-5 h-5 text-brand-primary" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-bold text-zinc-900 tracking-tight">Recomendação da IA bloqueada</p>
                                                            <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
                                                                Assine o Pro para desbloquear sugestões e o playbook de negociação.
                                                            </p>
                                                        </div>
                                                        <button 
                                                            className="mt-2 rounded-full bg-zinc-950 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-zinc-800"
                                                        >
                                                            Desbloquear
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <AnalysisSummaryCard 
                                                analysisV2={analysisV2}
                                                analysisMessage={analysisMessage}
                                                analysisPricingMeta={analysisPricingMeta}
                                                viewMode={viewMode}
                                                onToggleViewMode={onToggleViewMode}
                                            />
                                        </div>
                                    )}

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
                                        placeholder="Escreva o email de resposta..."
                                        className={`w-full resize-none overflow-hidden border-x-0 border-b-0 border-t-0 bg-transparent px-0 py-4 text-[16px] leading-8 tracking-[-0.01em] text-zinc-800 outline-none placeholder:text-[15px] placeholder:tracking-normal placeholder:text-zinc-300 ${isFocusMode ? "min-h-[64vh] sm:min-h-[520px]" : "min-h-[360px]"}`}
                                    />
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <div className="sticky bottom-0 z-20 shrink-0 border-t border-zinc-100 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-3 sm:px-5">
                <div className="mx-auto w-full max-w-[42rem]">
                    <button
                        type="button"
                        onClick={onSendReply}
                        data-focus-control="true"
                        disabled={replySending || !replyDraft.trim()}
                        className="dashboard-primary-button inline-flex w-full items-center justify-center gap-2 rounded-[1rem] px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Send size={14} />
                        {replySending ? "Enviando..." : "Enviar resposta"}
                    </button>
                </div>
            </div>
        </div>
    );
}
