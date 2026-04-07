"use client";

import React from 'react';
import { ChevronDownIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { FaThumbtack } from "react-icons/fa";
import { useOptionalHeaderConfig } from "../context/HeaderContext";

interface BoardProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    titleInlineAction?: React.ReactNode;
    headerActions?: React.ReactNode;
    showTitleMarker?: boolean;
    titleMarkerVariant?: 'dot' | 'chip';
    titleClassName?: string;
    className?: string;
    headerClassName?: string;
    contentClassName?: string;
    variant?: 'column' | 'card' | 'workspace' | 'compact';
    showChevron?: boolean;
    showOptions?: boolean;
    hideActionsUntilHover?: boolean;
    mobilePresentation?: 'flat' | 'surface';
    promoteHeaderOnMobile?: boolean;
    mobileHeaderAccessory?: React.ReactNode;
    desktopWidthClassName?: string;
    disableMobilePaddingTop?: boolean;
}

export default function Board({ 
    title, 
    subtitle, 
    children, 
    titleInlineAction,
    headerActions,
    showTitleMarker = true,
    titleMarkerVariant = 'dot',
    titleClassName = "",
    className = "",
    headerClassName = "",
    contentClassName = "",
    variant = 'column',
    showChevron = true,
    showOptions = true,
    hideActionsUntilHover = false,
    mobilePresentation = 'surface',
    promoteHeaderOnMobile = false,
    mobileHeaderAccessory,
    desktopWidthClassName = "",
    disableMobilePaddingTop = false,
}: BoardProps) {
    const isCard = variant === 'card';
    const isCompact = variant === 'compact';
    const isWorkspace = variant === 'workspace';
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
    const headerContext = useOptionalHeaderConfig();
    const updateHeaderConfig = headerContext?.updateConfig;
    const isMobileFlat = mobilePresentation === 'flat';

    const surfaceClassName = React.useMemo(() => {
        if (isCompact) {
            return 'h-full lg:h-[calc(100%-0.75rem)] max-h-full lg:max-h-[calc(100%-0.75rem)] w-full max-w-[460px] self-start overflow-visible rounded-none lg:rounded-[24px]';
        }

        if (isCard) {
            return 'h-full lg:h-[calc(100%-0.9rem)] max-h-full lg:max-h-[calc(100%-0.9rem)] w-full max-w-[820px] self-start overflow-visible rounded-none lg:rounded-[32px]';
        }

        if (isWorkspace) {
            return 'h-full lg:h-[calc(100%-1rem)] max-h-full lg:max-h-[calc(100%-1rem)] w-full self-start overflow-visible rounded-none lg:rounded-[32px]';
        }

        return 'h-full lg:h-[calc(100%-0.9rem)] w-full min-w-0 lg:min-w-[320px] self-start overflow-visible rounded-none lg:rounded-[32px]';
    }, [isCard, isCompact, isWorkspace]);

    const titleBarPaddingClassName = isCompact ? (disableMobilePaddingTop ? 'px-1 pt-0 pb-3 lg:pt-0' : 'px-1 pt-0 pb-3') : (disableMobilePaddingTop ? 'px-1 pt-0 pb-3.5 lg:pt-0' : 'px-1 pt-0 pb-3.5');
    const contentPaddingClassName = isCompact ? (disableMobilePaddingTop ? 'p-3 pt-0 lg:pt-3' : 'p-3') : '';
    const hasInlineTitleAction = Boolean(titleInlineAction);
    const usesTitleChip = showTitleMarker && titleMarkerVariant === 'chip';

    React.useEffect(() => {
        if (!promoteHeaderOnMobile || !updateHeaderConfig) return;

        updateHeaderConfig({
            mobileTitle: title,
            mobileSubtitle: subtitle ?? null,
            mobileAccessory: mobileHeaderAccessory ?? null,
        });

        return () => {
            updateHeaderConfig({
                mobileTitle: null,
                mobileSubtitle: null,
                mobileAccessory: null,
            });
        };
    }, [mobileHeaderAccessory, promoteHeaderOnMobile, subtitle, title, updateHeaderConfig]);

    const handleBoardWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        if (event.defaultPrevented) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;

        const target = event.target;
        if (target instanceof Node && scrollContainer.contains(target)) {
            return;
        }

        const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (maxScrollTop <= 0) return;

        const nextScrollTop = Math.max(
            0,
            Math.min(scrollContainer.scrollTop + event.deltaY, maxScrollTop),
        );

        if (nextScrollTop === scrollContainer.scrollTop) return;

        scrollContainer.scrollTop = nextScrollTop;
        event.preventDefault();
    }, []);

    return (
        <div className={`
            dashboard-board-shell group relative flex min-h-0 flex-col flex-shrink-0 transition-all duration-300
            ${surfaceClassName}
            ${desktopWidthClassName}
            ${className}
        `}
            data-mobile-frame={isMobileFlat ? "flat" : "surface"}
            onWheel={handleBoardWheel}
        >
            <div className={`
                dashboard-board-titlebar relative z-[2] min-h-[2.25rem]
                ${promoteHeaderOnMobile ? 'hidden lg:block' : ''}
                ${titleBarPaddingClassName}
                ${headerClassName}
            `}>
                <div className={`${hasInlineTitleAction ? "pointer-events-auto" : "pointer-events-none"} absolute inset-x-0 top-1/2 z-[1] flex -translate-y-1/2 justify-center px-14 sm:px-16`}>
                    <div className="min-w-0 max-w-full">
                        <div className={`flex min-w-0 items-center justify-center text-center ${usesTitleChip ? 'gap-2' : 'gap-1.5'}`}>
                            {usesTitleChip ? (
                                <span
                                    aria-hidden="true"
                                    className="hidden h-5.5 w-5.5 shrink-0 items-center justify-center rounded-[0.7rem] bg-white ring-1 ring-zinc-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] text-zinc-400 lg:inline-flex"
                                >
                                    <FaThumbtack className="h-2.5 w-2.5" />
                                </span>
                            ) : showTitleMarker ? (
                                <span
                                    aria-hidden="true"
                                    className="hidden h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-zinc-400 lg:inline-flex"
                                >
                                    <FaThumbtack className="h-2.5 w-2.5" />
                                </span>
                            ) : null}
                            {hasInlineTitleAction ? (
                                <span className="pointer-events-auto inline-flex shrink-0">
                                    {titleInlineAction}
                                </span>
                            ) : null}
                            <h2 className={`dashboard-type-board-title pointer-events-none min-w-0 truncate text-center leading-none ${titleClassName}`}>{title}</h2>
                            {showChevron && <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                        </div>
                        {subtitle ? (
                            <div className="mt-1 flex justify-center">
                                <span className="dashboard-chip">
                                    {subtitle}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>
                
                <div className={`relative z-[2] ml-auto flex min-h-[2.25rem] items-center gap-2 transition-opacity ${hideActionsUntilHover ? "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100" : ""}`}>
                    {headerActions}
                    {showOptions && (
                        <button className="rounded-full border border-zinc-100/70 bg-white/58 p-2 text-zinc-500 transition-colors hover:border-pink-100/80 hover:bg-white/92 hover:text-zinc-800">
                            <EllipsisHorizontalIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            <div
                className={`
                    dashboard-board-surface relative min-h-0 flex-1 overflow-hidden rounded-[inherit] bg-white
                `}
            >
                <div
                    ref={scrollContainerRef}
                    data-board-scroll-container="true"
                    className={`dashboard-board-content dashboard-scrollbar relative z-[1] min-h-0 h-full overflow-y-auto scroll-smooth ${contentPaddingClassName} ${contentClassName}`}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
