import { AdminCreatorSurveyListParams, DistributionEntry } from '@/types/admin/creatorSurvey';

export function classNames(...args: Array<string | false | null | undefined>) {
    return args.filter(Boolean).join(' ');
}

export function formatDate(value?: string) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('pt-BR');
}

export function buildParams(filters: AdminCreatorSurveyListParams) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.username) params.set('username', filters.username);
    if (filters.stage?.length) params.set('stage', filters.stage.join(','));
    if (filters.pains?.length) params.set('pains', filters.pains.join(','));
    if (filters.hardestStage?.length) params.set('hardestStage', filters.hardestStage.join(','));
    if (filters.monetizationStatus?.length) params.set('monetizationStatus', filters.monetizationStatus.join(','));
    if (filters.nextPlatform?.length) params.set('nextPlatform', filters.nextPlatform.join(','));
    if (filters.niches?.length) params.set('niches', filters.niches.join(','));
    if (filters.brandTerritories?.length) params.set('brandTerritories', filters.brandTerritories.join(','));
    if (filters.accountReasons?.length) params.set('accountReasons', filters.accountReasons.join(','));
    if (filters.country?.length) params.set('country', filters.country.join(','));
    if (filters.city?.length) params.set('city', filters.city.join(','));
    if (filters.gender?.length) params.set('gender', filters.gender.join(','));
    if (filters.followersMin !== undefined) params.set('followersMin', String(filters.followersMin));
    if (filters.followersMax !== undefined) params.set('followersMax', String(filters.followersMax));
    if (filters.mediaMin !== undefined) params.set('mediaMin', String(filters.mediaMin));
    if (filters.mediaMax !== undefined) params.set('mediaMax', String(filters.mediaMax));
    if (filters.engagementMin !== undefined) params.set('engagementMin', String(filters.engagementMin));
    if (filters.engagementMax !== undefined) params.set('engagementMax', String(filters.engagementMax));
    if (filters.reachMin !== undefined) params.set('reachMin', String(filters.reachMin));
    if (filters.reachMax !== undefined) params.set('reachMax', String(filters.reachMax));
    if (filters.growthMin !== undefined) params.set('growthMin', String(filters.growthMin));
    if (filters.growthMax !== undefined) params.set('growthMax', String(filters.growthMax));
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    return params;
}

export function isAllNoData(data?: DistributionEntry[]) {
    return Boolean(data && data.length && data.every((d) => d.value === 'Sem dado'));
}
