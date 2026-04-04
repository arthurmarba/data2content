"use client";

import React from "react";

import {
  DEFAULT_PINNED_BOARD_IDS,
  FIXED_PINNED_BOARD_IDS,
  PINNABLE_BOARD_REGISTRY,
  type PinnableBoardConfig,
  type PinnableBoardId,
  sanitizePinnedBoardIds,
} from "./boardRegistry";

const STORAGE_KEY_PREFIX = "dashboard:pinned-boards:v1";
const PINNED_BOARDS_SYNC_EVENT = "dashboard:pinned-boards-sync";

function buildStorageKey(userId: string | null | undefined) {
  return `${STORAGE_KEY_PREFIX}:${userId?.trim() || "anonymous"}`;
}

function areSameBoardLists(a: readonly PinnableBoardId[], b: readonly PinnableBoardId[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function usePinnedBoards(userId: string | null | undefined) {
  const storageKey = React.useMemo(() => buildStorageKey(userId), [userId]);
  const [pinnedBoardIds, setPinnedBoardIds] = React.useState<PinnableBoardId[]>([
    ...DEFAULT_PINNED_BOARD_IDS,
  ]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (!storedValue) {
        setPinnedBoardIds([...DEFAULT_PINNED_BOARD_IDS]);
        setHydrated(true);
        return;
      }

      const parsedValue = JSON.parse(storedValue);
      setPinnedBoardIds(sanitizePinnedBoardIds(parsedValue));
    } catch {
      setPinnedBoardIds([...DEFAULT_PINNED_BOARD_IDS]);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const syncPinnedBoards = (nextBoardIds: PinnableBoardId[]) => {
      setPinnedBoardIds((currentBoardIds) =>
        areSameBoardLists(currentBoardIds, nextBoardIds) ? currentBoardIds : nextBoardIds,
      );
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;

      if (!event.newValue) {
        syncPinnedBoards([...DEFAULT_PINNED_BOARD_IDS]);
        return;
      }

      try {
        syncPinnedBoards(sanitizePinnedBoardIds(JSON.parse(event.newValue)));
      } catch {
        syncPinnedBoards([...DEFAULT_PINNED_BOARD_IDS]);
      }
    };

    const handleLocalSync = (event: Event) => {
      const customEvent = event as CustomEvent<{
        storageKey?: string;
        pinnedBoardIds?: unknown;
      }>;

      if (customEvent.detail?.storageKey !== storageKey) return;
      syncPinnedBoards(sanitizePinnedBoardIds(customEvent.detail?.pinnedBoardIds));
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(PINNED_BOARDS_SYNC_EVENT, handleLocalSync as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PINNED_BOARDS_SYNC_EVENT, handleLocalSync as EventListener);
    };
  }, [storageKey]);

  React.useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    window.localStorage.setItem(storageKey, JSON.stringify(pinnedBoardIds));
    window.dispatchEvent(
      new CustomEvent(PINNED_BOARDS_SYNC_EVENT, {
        detail: {
          storageKey,
          pinnedBoardIds,
        },
      }),
    );
  }, [hydrated, pinnedBoardIds, storageKey]);

  const isPinned = React.useCallback(
    (boardId: PinnableBoardId) => pinnedBoardIds.includes(boardId),
    [pinnedBoardIds],
  );

  const isFixedPinned = React.useCallback(
    (boardId: PinnableBoardId) => FIXED_PINNED_BOARD_IDS.includes(boardId),
    [],
  );

  const pinBoard = React.useCallback(
    (boardId: PinnableBoardId) => {
      if (pinnedBoardIds.includes(boardId)) return false;
      setPinnedBoardIds((current) => sanitizePinnedBoardIds([...current, boardId]));
      return true;
    },
    [pinnedBoardIds],
  );

  const unpinBoard = React.useCallback(
    (boardId: PinnableBoardId) => {
      if (FIXED_PINNED_BOARD_IDS.includes(boardId)) return false;
      if (!pinnedBoardIds.includes(boardId)) return false;
      setPinnedBoardIds((current) => current.filter((currentBoardId) => currentBoardId !== boardId));
      return true;
    },
    [pinnedBoardIds],
  );

  const orderedPinnedBoards = React.useMemo<PinnableBoardConfig[]>(
    () => pinnedBoardIds.map((boardId) => PINNABLE_BOARD_REGISTRY[boardId]),
    [pinnedBoardIds],
  );

  return {
    hydrated,
    pinnedBoardIds,
    orderedPinnedBoards,
    isPinned,
    isFixedPinned,
    pinBoard,
    unpinBoard,
  };
}
