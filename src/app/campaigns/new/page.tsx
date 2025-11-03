import type { Metadata } from 'next';

import CampaignNewClient from './CampaignNewClient';

export const metadata: Metadata = {
  title: 'Criar campanha com criadores | Data2Content',
  description: 'Envie um briefing completo e receba sugestões de criadores ideais para a sua campanha.',
};

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function CampaignNewPage({ searchParams = {} }: PageProps) {
  const getParam = (key: string): string | null => {
    const value = searchParams[key];
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return typeof value === 'string' ? value : null;
  };

  const initialContext = {
    originHandle: getParam('origin_handle'),
    originSlug: getParam('origin_slug'),
    originAffiliate: getParam('origin_affiliate'),
    utmSource: getParam('utm_source'),
    utmMedium: getParam('utm_medium'),
    utmCampaign: getParam('utm_campaign'),
  };

  return <CampaignNewClient initialContext={initialContext} />;
}
