"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import CampaignsBoard from './CampaignsBoard';
import { useHeaderSetup } from '@/app/dashboard/context/HeaderContext';
import useBoardMobileViewport from '@/app/dashboard/hooks/useBoardMobileViewport';
import type { CampaignEntrySource } from '@/constants/routes';
import { track } from '@/lib/track';
import DesktopWorkspaceHeader from '@/app/dashboard/components/DesktopWorkspaceHeader';

const CAMPAIGN_ENTRY_SOURCES = new Set<CampaignEntrySource>([
    'sidebar',
    'home_alert',
    'home_board',
    'email',
    'deep_link',
    'direct',
]);

export default function CampaignsHub({ viewer }: { viewer?: any }) {
    const isMobileViewport = useBoardMobileViewport();
    const useWideDesktop = !isMobileViewport;
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const creatorId = (session?.user as { id?: string } | undefined)?.id ?? null;
    const trackedViewRef = React.useRef(false);
    const source = React.useMemo<CampaignEntrySource>(() => {
        const requestedSource = searchParams?.get('source') as CampaignEntrySource | null;
        if (requestedSource && CAMPAIGN_ENTRY_SOURCES.has(requestedSource)) return requestedSource;
        return searchParams?.get('proposalId') ? 'deep_link' : 'direct';
    }, [searchParams]);

    React.useEffect(() => {
        if (trackedViewRef.current) return;
        trackedViewRef.current = true;
        track('campaigns_hub_viewed', {
            creator_id: creatorId,
            source,
        });
    }, [creatorId, source]);

    useHeaderSetup(
        {
            variant: 'compact',
            showSidebarToggle: true,
            showUserMenu: true,
            hideBrandLogoOnMobile: true,
            sticky: true,
            contentTopPadding: 0,
            title: undefined,
            subtitle: undefined,
            condensedOnScroll: false,
        },
        []
    );

    return (
        <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#f5f5f4]">
            <div className="mx-auto flex h-full min-h-0 w-full justify-center px-0 py-0 lg:px-8">
                <div
                    className={`mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden ${
                        useWideDesktop ? "lg:max-w-[1640px]" : "lg:w-[900px] xl:w-[940px]"
                    }`}
                >
                    {useWideDesktop ? (
                        <DesktopWorkspaceHeader
                            eyebrow="Central comercial"
                            title="Campanhas"
                            description="Acompanhe propostas, organize publis e calcule seus valores em um só lugar."
                        />
                    ) : null}
                    <div className="min-h-0 flex-1 lg:pb-7">
                        <CampaignsBoard
                            viewer={viewer}
                            compactView={!useWideDesktop}
                            showTitleMarker={false}
                            dedicatedView={useWideDesktop}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
