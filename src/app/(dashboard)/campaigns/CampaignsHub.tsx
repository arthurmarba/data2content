"use client";

import React from 'react';
import CampaignsBoard from './CampaignsBoard';
import { useHeaderSetup } from '@/app/dashboard/context/HeaderContext';

export default function CampaignsHub({ viewer }: { viewer?: any }) {
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
                <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden lg:w-[900px] xl:w-[940px]">
                <CampaignsBoard
                    viewer={viewer}
                    compactView
                    showTitleMarker={false}
                />
                </div>
            </div>
        </div>
    );
}
