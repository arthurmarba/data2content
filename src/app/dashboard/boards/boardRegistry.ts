"use client";

import { CAMPAIGNS_ROUTE, RECORDED_MEETINGS_ROUTE } from "@/constants/routes";

export type PinnableBoardId =
  | "strategic-map"
  | "collabs"
  | "campaigns"
  | "recorded-meetings"
  | "discover"
  | "profile-analysis"
  | "media-kit"
  | "post-creation";

export type PinnableBoardConfig = {
  id: PinnableBoardId;
  title: string;
  route: string;
  visibleOnHome: boolean;
  defaultPinned: boolean;
  fixedPinned?: boolean;
};

export const PINNABLE_BOARD_REGISTRY: Record<PinnableBoardId, PinnableBoardConfig> = {
  "strategic-map": {
    id: "strategic-map",
    title: "Seu Mapa",
    route: "/dashboard/boards/mobile-strategic-profile",
    visibleOnHome: true,
    defaultPinned: true,
    fixedPinned: true,
  },
  collabs: {
    id: "collabs",
    title: "Collabs",
    route: "/dashboard/boards/mobile-strategic-profile",
    visibleOnHome: true,
    defaultPinned: true,
  },
  campaigns: {
    id: "campaigns",
    title: "Campanhas",
    route: CAMPAIGNS_ROUTE,
    visibleOnHome: true,
    defaultPinned: true,
    fixedPinned: true,
  },
  "recorded-meetings": {
    id: "recorded-meetings",
    title: "Reuniões gravadas",
    route: RECORDED_MEETINGS_ROUTE,
    visibleOnHome: true,
    defaultPinned: true,
    fixedPinned: true,
  },
  discover: {
    id: "discover",
    title: "Comunidade",
    route: "/planning/discover",
    visibleOnHome: false,
    defaultPinned: false,
  },
  "profile-analysis": {
    id: "profile-analysis",
    title: "Análise de Perfil",
    route: "/planning/graficos",
    visibleOnHome: false,
    defaultPinned: false,
  },
  "media-kit": {
    id: "media-kit",
    title: "Mídia Kit",
    route: "/dashboard/media-kit",
    visibleOnHome: true,
    defaultPinned: true,
    fixedPinned: true,
  },
  "post-creation": {
    id: "post-creation",
    title: "Criação de Post",
    route: "/calendar",
    visibleOnHome: false,
    defaultPinned: false,
  },
};

export const PINNABLE_BOARD_ORDER = (Object.keys(PINNABLE_BOARD_REGISTRY) as PinnableBoardId[]).filter(
  (boardId) => PINNABLE_BOARD_REGISTRY[boardId].visibleOnHome,
);

export const DEFAULT_PINNED_BOARD_IDS = PINNABLE_BOARD_ORDER.filter(
  (boardId) => PINNABLE_BOARD_REGISTRY[boardId].defaultPinned,
);

export const FIXED_PINNED_BOARD_IDS = PINNABLE_BOARD_ORDER.filter(
  (boardId) => PINNABLE_BOARD_REGISTRY[boardId].fixedPinned,
);

export function isPinnableBoardId(value: string): value is PinnableBoardId {
  return Object.prototype.hasOwnProperty.call(PINNABLE_BOARD_REGISTRY, value);
}

export function orderPinnedBoardIds(boardIds: readonly PinnableBoardId[]): PinnableBoardId[] {
  const boardIdSet = new Set(boardIds);
  return PINNABLE_BOARD_ORDER.filter((boardId) => boardIdSet.has(boardId));
}

export function sanitizePinnedBoardIds(rawValue: unknown): PinnableBoardId[] {
  const normalizedBoardIds = new Set<PinnableBoardId>(FIXED_PINNED_BOARD_IDS);

  if (!Array.isArray(rawValue)) {
    return [...DEFAULT_PINNED_BOARD_IDS];
  }

  rawValue.forEach((item) => {
    if (typeof item !== "string") return;
    if (!isPinnableBoardId(item)) return;
    normalizedBoardIds.add(item);
  });

  const ordered = orderPinnedBoardIds(Array.from(normalizedBoardIds));
  return ordered.length > 0 ? ordered : [...DEFAULT_PINNED_BOARD_IDS];
}
