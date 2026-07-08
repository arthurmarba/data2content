"use client";

import React from 'react';
import CampaignsBoard from './CampaignsBoard';
import { useHeaderSetup } from '@/app/dashboard/context/HeaderContext';
import useBoardMobileViewport from '@/app/dashboard/hooks/useBoardMobileViewport';

export default function CampaignsHub({ viewer }: { viewer?: any }) {
    const isMobileViewport = useBoardMobileViewport();
    const useWideDesktop = !isMobileViewport;

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
        <div className="flex h-full min-h-0 w-full overflow-hidden bg-transparent">
            <div className="mx-auto flex h-full min-h-0 w-full justify-center px-0 py-0 lg:px-8 lg:pb-5 lg:pt-[2.75rem]">
                <div
                    className={`mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden ${
                        useWideDesktop ? "lg:max-w-[1640px]" : "lg:w-[900px] xl:w-[940px]"
                    }`}
                >
                <CampaignsBoard
                    viewer={viewer}
                    compactView={!useWideDesktop}
                    showTitleMarker={false}
                />
                </div>
            </div>
        </div>
    );
}
