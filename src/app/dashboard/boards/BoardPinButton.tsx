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
  iconOnly = false,
}: BoardPinButtonProps) {
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const shown = window.localStorage.getItem("d2c_pinned_onboarding_shown");
    if (!shown) {
      setShowOnboarding(true);
    }
  }, []);

  const dismissOnboarding = React.useCallback(() => {
    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("d2c_pinned_onboarding_shown", "true");
    }
  }, []);
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
      router.push(`/?highlight=${boardId}`);
    }
    
    dismissOnboarding();
  }, [boardId, boardTitle, fixedPinned, pinBoard, pinned, redirectOnPin, router, unpinBoard, dismissOnboarding]);

  if (fixedPinned) {
    return null;
  }

  return (
    <div className="relative inline-flex z-[60]">
      {showOnboarding && !pinned && (
        <div className="absolute -top-[3.75rem] left-1/2 z-[100] hidden w-48 -translate-x-1/2 animate-bounce lg:block">
          <div className="relative rounded-lg bg-indigo-600 px-3 py-2 text-center text-[11px] font-bold text-white shadow-xl">
            Clique aqui para fixar este board no seu início!
            <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-indigo-600" />
            <button 
              onClick={(e) => { e.stopPropagation(); dismissOnboarding(); }}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 border border-white/20 text-[8px] text-white hover:bg-black"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={!hydrated}
        className={`hidden lg:inline-flex items-center font-bold tracking-tight transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 hover:scale-[1.03] active:scale-[0.97] ${
          iconOnly
            ? `${pinned ? "border-indigo-200 bg-indigo-50 text-indigo-600 shadow-sm" : "border-zinc-200 bg-white text-zinc-400"} h-8 w-8 justify-center rounded-full border hover:border-indigo-300 hover:text-indigo-700`
            : pinned
              ? "rounded-full border border-indigo-600 bg-indigo-600 px-4 py-1.5 text-[11px] text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:bg-indigo-700 uppercase"
              : "rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-[11px] text-zinc-600 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 uppercase"
        }`}
        aria-pressed={pinned}
        aria-label={pinned ? `Remover ${boardTitle} do início` : `Fixar ${boardTitle} no início`}
        title={pinned ? `Remover ${boardTitle} do início` : `Fixar ${boardTitle} no início`}
      >
        <span className="flex items-center gap-2">
          <FaThumbtack className={iconOnly ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} aria-hidden="true" />
          {!iconOnly && (pinned ? "Fixado" : "Fixar no Início")}
        </span>
      </button>
    </div>
  );
}
