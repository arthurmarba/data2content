"use client";

import React, { useCallback, useMemo, useState } from "react";
import { FaExclamationTriangle, FaSpinner } from "react-icons/fa";
import { ChatBubbleLeftRightIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { useAdminList } from "../../../hooks/useAdminList";
import { SearchBar } from "../../components/SearchBar";
import { StatusBadge } from "../../components/StatusBadge";
import { SkeletonTable } from "../../components/SkeletonTable";
import { EmptyState } from "../../components/EmptyState";
import type {
  AdminBrandProposalDetail,
  AdminBrandProposalListItem,
  AdminBrandProposalStatus,
} from "@/types/admin/brandProposals";

export const dynamic = "force-dynamic";

const STATUS_MAPPINGS: Record<
  AdminBrandProposalStatus,
  { label: string; bgColor: string; textColor: string; borderColor: string }
> = {
  novo: {
    label: "Novo",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    borderColor: "border-blue-200",
  },
  visto: {
    label: "Visto",
    bgColor: "bg-indigo-100",
    textColor: "text-indigo-800",
    borderColor: "border-indigo-200",
  },
  respondido: {
    label: "Respondido",
    bgColor: "bg-amber-100",
    textColor: "text-amber-800",
    borderColor: "border-amber-200",
  },
  aceito: {
    label: "Aceito",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-200",
  },
  rejeitado: {
    label: "Rejeitado",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    borderColor: "border-red-200",
  },
};

function formatDateTime(value?: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value?: number | null, currency = "BRL"): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(value);
}

function formatReceivedBudget(
  value: number | null | undefined,
  currency: string,
  budgetIntent: "provided" | "requested"
): string {
  if (budgetIntent === "requested" && (value === null || value === undefined)) {
    return "Solicitação de orçamento";
  }
  return formatCurrency(value, currency);
}

export default function AdminBrandProposalsPage() {
  const {
    data,
    isLoading,
    error,
    page,
    setPage,
    limit,
    setLimit,
    filters,
    setFilters,
    reload,
  } = useAdminList<AdminBrandProposalListItem>({
    endpoint: "/api/admin/brand-proposals",
    initialParams: {
      filters: {
        status: "all",
        search: "",
        dateFrom: "",
        dateTo: "",
      },
      sort: { sortBy: "createdAt", order: "desc" },
    },
    syncWithUrl: true,
  });

  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<AdminBrandProposalDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const statusFilter = (filters.status as string) || "all";
  const searchFilter = (filters.search as string) || "";
  const dateFromFilter = (filters.dateFrom as string) || "";
  const dateToFilter = (filters.dateTo as string) || "";

  const creatorName = useMemo(
    () => selectedProposal?.creator?.name || "Criador não encontrado",
    [selectedProposal]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setPage(1);
      setFilters((prev) => ({ ...prev, search: value }));
    },
    [setFilters, setPage]
  );

  const handleStatusChange = (value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, status: value }));
  };

  const handleDateFromChange = (value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, dateFrom: value }));
  };

  const handleDateToChange = (value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, dateTo: value }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPage(1);
    setLimit(newLimit);
  };

  const handleOpenDetail = async (proposalId: string) => {
    setSelectedProposalId(proposalId);
    setIsDetailLoading(true);
    setDetailError(null);
    setSelectedProposal(null);

    try {
      const response = await fetch(`/api/admin/brand-proposals/${proposalId}`);
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseData.error || "Falha ao carregar detalhes da proposta.");
      }
      setSelectedProposal(responseData);
    } catch (fetchError: any) {
      setDetailError(fetchError.message || "Falha ao carregar detalhes da proposta.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedProposalId(null);
    setSelectedProposal(null);
    setDetailError(null);
  };

  return (
    <>
      {selectedProposalId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={handleCloseDetail}
            aria-label="Fechar detalhes"
          />

          <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Detalhes da proposta</h2>
                  <p className="text-sm text-gray-500">
                    {selectedProposal?.campaignTitle || "Carregando..."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label="Fechar"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-6 px-6 py-5">
              {isDetailLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FaSpinner className="h-4 w-4 animate-spin" />
                  Carregando detalhes...
                </div>
              ) : detailError ? (
                <EmptyState
                  icon={<FaExclamationTriangle className="h-10 w-10" />}
                  title="Erro ao carregar detalhes"
                  description={detailError}
                />
              ) : selectedProposal ? (
                <>
                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Resumo
                    </h3>
                    <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="text-gray-500">Status</dt>
                        <dd className="mt-1">
                          <StatusBadge
                            status={selectedProposal.status}
                            mappings={STATUS_MAPPINGS}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Orçamento recebido</dt>
                        <dd className="mt-1 font-medium text-gray-900">
                          {formatReceivedBudget(
                            selectedProposal.budget,
                            selectedProposal.currency,
                            selectedProposal.budgetIntent
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Orçamento proposto pelo criador</dt>
                        <dd className="mt-1 font-medium text-gray-900">
                          {formatCurrency(
                            selectedProposal.creatorProposedBudget,
                            selectedProposal.creatorProposedCurrency || selectedProposal.currency
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Criada em</dt>
                        <dd className="mt-1 text-gray-900">
                          {formatDateTime(selectedProposal.createdAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Atualizada em</dt>
                        <dd className="mt-1 text-gray-900">
                          {formatDateTime(selectedProposal.updatedAt)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Marca e campanha
                    </h3>
                    <dl className="grid grid-cols-1 gap-3 text-sm">
                      <div>
                        <dt className="text-gray-500">Marca</dt>
                        <dd className="mt-1 font-medium text-gray-900">
                          {selectedProposal.brandName}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Título da campanha</dt>
                        <dd className="mt-1 text-gray-900">{selectedProposal.campaignTitle}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Descrição</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                          {selectedProposal.campaignDescription || "Não informada"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Contato da marca
                    </h3>
                    <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="text-gray-500">Responsável</dt>
                        <dd className="mt-1 text-gray-900">
                          {selectedProposal.contactName || "Não informado"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Email</dt>
                        <dd className="mt-1 text-gray-900">{selectedProposal.contactEmail}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">WhatsApp</dt>
                        <dd className="mt-1 text-gray-900">
                          {selectedProposal.contactWhatsapp || "Não informado"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Criador
                    </h3>
                    <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="text-gray-500">Nome</dt>
                        <dd className="mt-1 text-gray-900">{creatorName}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Email</dt>
                        <dd className="mt-1 text-gray-900">{selectedProposal.creator.email}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Username</dt>
                        <dd className="mt-1 text-gray-900">
                          {selectedProposal.creator.username || "Não informado"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Slug do mídia kit</dt>
                        <dd className="mt-1 text-gray-900">
                          {selectedProposal.creator.mediaKitSlug || "Não informado"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Entregáveis e referências
                    </h3>
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Entregáveis</p>
                        {selectedProposal.deliverables.length > 0 ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-900">
                            {selectedProposal.deliverables.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-gray-900">Nenhum entregável informado.</p>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">Links de referência</p>
                        {selectedProposal.referenceLinks.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-gray-900">
                            {selectedProposal.referenceLinks.map((link) => (
                              <li key={link} className="break-all">
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {link}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-gray-900">Nenhum link informado.</p>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      UTM e origem
                    </h3>
                    <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="text-gray-500">UTM Source</dt>
                        <dd className="mt-1 text-gray-900">{selectedProposal.utmSource || "N/A"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">UTM Medium</dt>
                        <dd className="mt-1 text-gray-900">{selectedProposal.utmMedium || "N/A"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">UTM Campaign</dt>
                        <dd className="mt-1 text-gray-900">{selectedProposal.utmCampaign || "N/A"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">UTM Term</dt>
                        <dd className="mt-1 text-gray-900">{selectedProposal.utmTerm || "N/A"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">UTM Content</dt>
                        <dd className="mt-1 text-gray-900">{selectedProposal.utmContent || "N/A"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Referrer</dt>
                        <dd className="mt-1 break-all text-gray-900">
                          {selectedProposal.utmReferrer || "N/A"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Primeiro toque</dt>
                        <dd className="mt-1 text-gray-900">
                          {formatDateTime(selectedProposal.utmFirstTouchAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Último toque</dt>
                        <dd className="mt-1 text-gray-900">
                          {formatDateTime(selectedProposal.utmLastTouchAt)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-lg border border-gray-200 p-4">
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Auditoria
                    </h3>
                    <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="text-gray-500">IP de origem</dt>
                        <dd className="mt-1 text-gray-900">{selectedProposal.originIp || "N/A"}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">User-Agent</dt>
                        <dd className="mt-1 break-all text-gray-900">
                          {selectedProposal.userAgent || "N/A"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Última resposta</dt>
                        <dd className="mt-1 text-gray-900">
                          {formatDateTime(selectedProposal.lastResponseAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Mensagem da última resposta</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                          {selectedProposal.lastResponseMessage || "N/A"}
                        </dd>
                      </div>
                    </dl>
                  </section>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-800">
          Propostas de Marcas {data?.totalItems ? `(${data.totalItems})` : ""}
        </h1>

        <div className="mb-6 grid grid-cols-1 gap-4 rounded-lg border bg-gray-50 p-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Buscar</label>
            <SearchBar
              value={searchFilter}
              onSearchChange={handleSearchChange}
              placeholder="Marca, responsável, campanha, email ou criador..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => handleStatusChange(event.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-pink focus:outline-none focus:ring-brand-pink"
            >
              <option value="all">Todos</option>
              <option value="novo">Novo</option>
              <option value="visto">Visto</option>
              <option value="respondido">Respondido</option>
              <option value="aceito">Aceito</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Data inicial</label>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(event) => handleDateFromChange(event.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-pink focus:outline-none focus:ring-brand-pink"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Data final</label>
            <input
              type="date"
              value={dateToFilter}
              onChange={(event) => handleDateToChange(event.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-pink focus:outline-none focus:ring-brand-pink"
            />
          </div>
        </div>

        {isLoading ? (
          <SkeletonTable rows={limit} cols={7} />
        ) : error ? (
          <EmptyState
            icon={<FaExclamationTriangle className="h-10 w-10" />}
            title="Erro ao carregar propostas"
            description={error}
            action={
              <button
                onClick={reload}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Tentar novamente
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg bg-white shadow-md">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Marca
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Contato
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Campanha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Orçamento
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Criador
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8">
                        <EmptyState
                          icon={<ChatBubbleLeftRightIcon className="h-12 w-12" />}
                          title="Nenhuma proposta encontrada"
                          description="Ajuste os filtros para ampliar a busca."
                        />
                      </td>
                    </tr>
                  ) : (
                    data?.items.map((proposal) => (
                      <tr key={proposal.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-gray-700">
                          {formatDateTime(proposal.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={proposal.status} mappings={STATUS_MAPPINGS} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{proposal.brandName}</p>
                          <p className="text-xs text-gray-500">{proposal.mediaKitSlug || "Sem slug"}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <p className="font-medium text-gray-900">
                            {proposal.contactName || "Responsável não informado"}
                          </p>
                          <p>{proposal.contactEmail}</p>
                          <p className="text-xs text-gray-500">
                            {proposal.contactWhatsapp || "WhatsApp não informado"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(proposal.id)}
                            className="text-left text-brand-pink hover:underline"
                          >
                            {proposal.campaignTitle}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatReceivedBudget(
                            proposal.budget,
                            proposal.currency,
                            proposal.budgetIntent
                          )}
                          {proposal.creatorProposedBudget !== null && (
                            <p className="text-xs font-normal text-slate-500">
                              Proposto:{" "}
                              {formatCurrency(
                                proposal.creatorProposedBudget,
                                proposal.creatorProposedCurrency || proposal.currency
                              )}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <p>{proposal.creator.name}</p>
                          <p className="text-xs text-gray-500">{proposal.creator.email}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {data && data.totalItems > 0 && (
              <div className="mt-6 flex flex-col items-start justify-between gap-4 text-sm text-gray-600 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <p>
                    Mostrando{" "}
                    <span className="font-semibold">{(page - 1) * limit + 1}</span>
                    -
                    <span className="font-semibold">
                      {Math.min(page * limit, data.totalItems)}
                    </span>{" "}
                    de <span className="font-semibold">{data.totalItems}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <label htmlFor="proposalItemsPerPage">Itens/pág:</label>
                    <select
                      id="proposalItemsPerPage"
                      value={limit}
                      onChange={(event) => handleLimitChange(Number(event.target.value))}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <nav className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span>
                    Página <span className="font-semibold">{page}</span> de{" "}
                    <span className="font-semibold">{data.totalPages}</span>
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === data.totalPages}
                    className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
