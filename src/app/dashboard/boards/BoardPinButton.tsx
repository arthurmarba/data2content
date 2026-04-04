"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FaThumbtack } from "react-icons/fa";

import { PINNABLE_BOARD_REGISTRY, type PinnableBoardId } from "./boardRegistry";
import { usePinnedBoards } from "./usePinnedBoards";

type BoardPinButtonProps = {
  boardId: PinnableBoardId;
  boardTitle: string;
  redirectOnPin?: boolean;
  iconOnly?: boolean;
};

export default function BoardPinButton({
  boardId,
  boardTitle,
  redirectOnPin = true,
  iconOnly = true,
}: BoardPinButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const { hydrated, isPinned, pinBoard, unpinBoard } = usePinnedBoards(userId);
  const pinned = isPinned(boardId);
  const fixedPinned = Boolean(PINNABLE_BOARD_REGISTRY[boardId].fixedPinned);

  const handleClick = React.useCallback(() => {
    if (fixedPinned) {
      return;
    }

    if (pinned) {
      const changed = unpinBoard(boardId);
      if (changed) {
        toast.success(`${boardTitle} removido do painel inicial.`);
      }
      return;
    }

    const changed = pinBoard(boardId);
    if (changed) {
      toast.success(`${boardTitle} fixado no painel inicial.`);
    }

    if (redirectOnPin) {
      router.push("/dashboard");
    }
  }, [boardId, boardTitle, fixedPinned, pinBoard, pinned, redirectOnPin, router, unpinBoard]);

  if (fixedPinned) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!hydrated}
      className={`hidden lg:inline-flex items-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        iconOnly
          ? `${pinned ? "border-rose-200/80 bg-rose-50/80 text-rose-500 shadow-[0_1px_2px_rgba(244,63,94,0.06)]" : "border-zinc-200/70 bg-white/92 text-zinc-400"} relative z-[3] h-8 w-8 justify-center rounded-full border transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-700`
          : pinned
            ? "rounded-full border border-rose-200/80 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50/70"
            : "rounded-full border border-zinc-200/80 bg-white/88 text-zinc-500 hover:border-zinc-300 hover:bg-white hover:text-zinc-800"
      }`}
      aria-pressed={pinned}
      aria-label={pinned ? `Depinar ${boardTitle}` : `Pinar ${boardTitle}`}
      title={pinned ? `Depinar ${boardTitle}` : `Pinar ${boardTitle}`}
    >
      <span className={iconOnly ? "pointer-events-none flex h-full w-full items-center justify-center" : "flex h-7 items-center gap-1.5 px-2.5 py-0 text-[10px] uppercase tracking-[0.14em] leading-none"}>
        <FaThumbtack className={iconOnly ? "h-3 w-3" : "h-2.5 w-2.5"} aria-hidden="true" />
        {iconOnly ? null : pinned ? "Depinar" : "Pinar"}
      </span>
    </button>
  );
}
