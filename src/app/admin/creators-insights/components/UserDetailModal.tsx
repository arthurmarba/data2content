import React, { useEffect } from 'react';
import { XMarkIcon, UserCircleIcon, MapPinIcon, CurrencyDollarIcon, TrophyIcon, FireIcon, ChartBarIcon, AcademicCapIcon } from '@heroicons/react/24/outline';
import { AdminCreatorSurveyDetail } from '@/types/admin/creatorSurvey';
import CreatorHistoryChart from './CreatorHistoryChart';
import SkeletonBlock from '../../components/SkeletonBlock';
import { formatDate } from '../utils';

interface UserDetailModalProps {
    detail: AdminCreatorSurveyDetail | null;
    loading: boolean;
    onClose: () => void;
    notesDraft: string;
    onNotesChange: (value: string) => void;
    notesSaving: boolean;
}

export default function UserDetailModal({
    detail,
    loading,
    onClose,
    notesDraft,
    onNotesChange,
    notesSaving,
}: UserDetailModalProps) {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end print:bg-white print:static print:block transition-all">
            <div className="absolute inset-0 print:hidden" onClick={onClose} />

            <div className="w-full max-w-2xl h-full bg-gray-50 shadow-2xl overflow-y-auto relative z-10 print:w-full print:max-w-none print:shadow-none print:h-auto print:overflow-visible flex flex-col">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-6 py-4 flex items-start justify-between">
                    {loading || !detail ? (
                        <div className="space-y-2 w-full">
                            <SkeletonBlock height="h-6" width="w-1/3" />
                            <SkeletonBlock height="h-4" width="w-1/4" />
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                                    {detail.name?.[0]?.toUpperCase() || <UserCircleIcon className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{detail.name}</h3>
                                    <p className="text-sm text-gray-500">@{detail.username}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    <MapPinIcon className="w-3 h-3" />
                                    {detail.city || 'N/A'}{detail.country ? `, ${detail.country}` : ''}
                                </span>
                                {detail.profile.stage && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                        {detail.profile.stage.join(', ')}
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-500">
                                    Atualizado em {formatDate(detail.updatedAt || detail.createdAt)}
                                </span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 p-6 space-y-6">
                    {loading ? (
                        <div className="space-y-4">
                            <SkeletonBlock height="h-32" />
                            <SkeletonBlock height="h-32" />
                            <SkeletonBlock height="h-32" />
                        </div>
                    ) : !detail ? (
                        <div className="flex items-center justify-center h-full text-gray-500">Falha ao carregar detalhes.</div>
                    ) : (
                        <>
                            {/* Key Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <MetricCard label="Seguidores" value={detail.followersCount} />
                                <MetricCard label="Posts" value={detail.mediaCount} />
                                <MetricCard label="Alcance" value={detail.reach} />
                                <MetricCard label="Engajamento" value={detail.engaged} />
                            </div>

                            {/* Charts Section */}
                            {detail.insightsHistory && detail.insightsHistory.length > 1 && (
                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm overflow-hidden">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
                                        <ChartBarIcon className="w-4 h-4 text-indigo-500" />
                                        Evolução Recente
                                    </h4>
                                    <CreatorHistoryChart history={detail.insightsHistory} />
                                </div>
                            )}

                            {/* Info Sections */}
                            <div className="grid grid-cols-1 gap-6">
                                <ContentCard title="Perfil & Identidade" icon={UserCircleIcon} color="text-indigo-600">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                                        <InfoRow label="Nicho/Temas" value={detail.profile.niches?.join(', ')} />
                                        <InfoRow label="Territórios de Marca" value={detail.profile.brandTerritories?.join(', ')} />
                                        <InfoRow label="Tem Ajuda?" value={detail.profile.hasHelp?.join(', ')} />
                                        <InfoRow label="Marcas dos Sonhos" value={detail.profile.dreamBrands?.join(', ')} Highlight />
                                    </div>
                                </ContentCard>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ContentCard title="Objetivos" icon={TrophyIcon} color="text-amber-600">
                                        <div className="space-y-3">
                                            <InfoRow label="Prioridade (3 meses)" value={detail.profile.mainGoal3m ?? undefined} />
                                            <InfoRow label="História de Sucesso (12 meses)" value={detail.profile.success12m ?? undefined} />
                                            <InfoRow label="Expectativa Diária" value={detail.profile.dailyExpectation ?? undefined} />
                                        </div>
                                    </ContentCard>

                                    <ContentCard title="Dores & Desafios" icon={FireIcon} color="text-red-600">
                                        <div className="space-y-3">
                                            <InfoRow label="Dores Principais" value={detail.profile.mainPains?.join(', ')} />
                                            <InfoRow label="Etapa Mais Difícil" value={detail.profile.hardestStage?.join(', ')} />
                                            <InfoRow label="Outra Dor" value={detail.profile.otherPain ?? undefined} />
                                        </div>
                                    </ContentCard>
                                </div>

                                <ContentCard title="Monetização & Negócios" icon={CurrencyDollarIcon} color="text-emerald-600">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                                        <InfoRow label="Faz Publis?" value={detail.profile.hasDoneSponsoredPosts ?? undefined} />
                                        <InfoRow label="Faixa de Preço" value={detail.profile.avgPriceRange ?? undefined} Highlight />
                                        <InfoRow label="Pricing Combo" value={detail.profile.bundlePriceRange ?? undefined} />
                                        <InfoRow label="Método de Precificação" value={detail.profile.pricingMethod ?? undefined} />
                                        <InfoRow label="Medo ao Precificar" value={detail.profile.pricingFear ?? undefined} />
                                    </div>
                                </ContentCard>

                                <ContentCard title="Plataforma & Aprendizado" icon={AcademicCapIcon} color="text-violet-600">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                                        <InfoRow label="Motivo de Uso da Plataforma" value={detail.profile.mainPlatformReasons?.join(', ')} />
                                        <InfoRow label="Estilos de Aprendizado" value={detail.profile.learningStyles?.join(', ')} />
                                        <InfoRow label="Próximas Plataformas" value={detail.profile.nextPlatform?.join(', ')} />
                                        <InfoRow label="Preferência de Notificação" value={detail.profile.notificationPref?.join(', ')} />
                                    </div>
                                </ContentCard>
                            </div>

                            {/* Notes Section */}
                            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-5 shadow-sm print:hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-bold text-yellow-800 flex items-center gap-2">
                                        📋 Notas do Time
                                    </h4>
                                    {notesSaving && <span className="text-xs text-yellow-600 animate-pulse font-medium">Salvando...</span>}
                                </div>
                                <textarea
                                    value={notesDraft}
                                    onChange={(e) => onNotesChange(e.target.value)}
                                    placeholder="Escreva observações internas sobre este criador..."
                                    className="w-full rounded-lg border-yellow-300 bg-yellow-50 focus:ring-yellow-500 focus:border-yellow-500 text-sm min-h-[100px] text-gray-800 placeholder:text-yellow-800/50"
                                />
                                <p className="text-xs text-yellow-700 mt-2">Salvo automaticamente.</p>
                            </div>

                            {/* Print Notes */}
                            {notesDraft && (
                                <div className="hidden print:block space-y-2 break-inside-avoid mt-4">
                                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-1">Notas Internas</h4>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{notesDraft}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ContentCard({ title, icon: Icon, children, color }: { title: string, icon: any, children: React.ReactNode, color: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm break-inside-avoid">
            <h4 className={`flex items-center gap-2 text-sm font-bold mb-4 border-b border-gray-100 pb-2 ${color}`}>
                <Icon className="w-5 h-5" />
                {title}
            </h4>
            {children}
        </div>
    );
}

function InfoRow({ label, value, Highlight }: { label: string; value?: string; Highlight?: boolean }) {
    if (!value) return null;
    return (
        <div className="group">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
            <p className={`text-sm leading-relaxed ${Highlight ? 'font-medium text-indigo-900 bg-indigo-50 inline-block px-1 rounded -ml-1' : 'text-gray-700'}`}>
                {value}
            </p>
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value?: number | null }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-center text-center hover:border-indigo-300 transition-colors">
            <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-gray-900">{value != null ? value.toLocaleString('pt-BR') : '—'}</p>
        </div>
    );
}
