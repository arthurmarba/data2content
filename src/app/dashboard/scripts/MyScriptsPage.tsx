"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Save, Trash2, Sparkles, Plus, Undo2, Redo2 } from "lucide-react";
import CreatorQuickSearch from "@/app/admin/creator-dashboard/components/CreatorQuickSearch";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY,
  LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY,
} from "@/app/dashboard/hooks/useScriptRecommendationsNotifications";

type ScriptOrigin = "manual" | "ai" | "planner";
type ScriptLinkType = "standalone" | "planner_slot";

type ScriptPlannerRef = {
  weekStart?: string;
  slotId?: string;
  dayOfWeek?: number;
  blockStartHour?: number;
};

type ScriptItem = {
  id: string;
  title: string;
  content: string;
  source: ScriptOrigin;
  linkType: ScriptLinkType;
  plannerRef?: ScriptPlannerRef | null;
  aiVersionId?: string | null;
  recommendation?: {
    isRecommended: boolean;
    recommendedByAdminName?: string | null;
    recommendedAt?: string | null;
  } | null;
  adminAnnotation?: {
    notes?: string | null;
    updatedByName?: string | null;
    updatedAt?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type PlannerSlotOption = {
  slotId: string;
  dayOfWeek: number;
  blockStartHour: number;
};

type EditorState = {
  id: string | null;
  title: string;
  content: string;
  slotId: string;
  recommendation: ScriptItem["recommendation"];
  adminAnnotation: ScriptItem["adminAnnotation"];
  adminAnnotationDraft: string;
  aiPrompt: string;
  saving: boolean;
  saved: boolean;
  deleting: boolean;
  adjusting: boolean;
  error: string | null;
};

type DraftSnapshot = {
  title: string;
  content: string;
};

type DraftHistoryState = {
  past: DraftSnapshot[];
  present: DraftSnapshot;
  future: DraftSnapshot[];
};

type ViewerInfo = {
  id: string;
  role?: string | null;
  name?: string | null;
};

type AdminTargetUser = {
  id: string;
  name: string;
  profilePictureUrl?: string | null;
};

const PAGE_LIMIT = 12;
const CARD_PREVIEW_MAX_CHARS = 210;
const HISTORY_LIMIT = 80;
const HISTORY_TYPING_DELAY_MS = 450;
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getDayLabel(dayOfWeek?: number) {
  if (typeof dayOfWeek !== "number") return "Dia";
  if (dayOfWeek === 7) return DAYS_SHORT[0];
  return DAYS_SHORT[dayOfWeek] || "Dia";
}

function getBlockLabel(hour?: number) {
  if (typeof hour !== "number") return "Horário";
  const end = (hour + 3) % 24;
  return `${String(hour).padStart(2, "0")}h-${String(end).padStart(2, "0")}h`;
}

function getSourceLabel(source: ScriptOrigin) {
  if (source === "manual") return "Manual";
  if (source === "ai") return "IA";
  return "Planner";
}

function getSourceCardTone(source: ScriptOrigin) {
  if (source === "ai") {
    return {
      header: "bg-violet-50 border-violet-100",
      text: "text-violet-700",
      ring: "hover:ring-violet-200",
    };
  }
  if (source === "planner") {
    return {
      header: "bg-emerald-50 border-emerald-100",
      text: "text-emerald-700",
      ring: "hover:ring-emerald-200",
    };
  }
  return {
    header: "bg-slate-50 border-slate-100",
    text: "text-slate-700",
    ring: "hover:ring-slate-200",
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getCardTitle(script: ScriptItem) {
  const title = script.title?.trim();
  if (title) return title;
  return "Roteiro sem título";
}

function getCardPreview(script: ScriptItem) {
  const content = script.content?.trim();
  if (!content) return "Sem conteúdo ainda.";
  const normalized = content.replace(/\s+/g, " ");
  if (normalized.length <= CARD_PREVIEW_MAX_CHARS) return normalized;

  const sliced = normalized.slice(0, CARD_PREVIEW_MAX_CHARS).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  const safeCut = lastSpace > CARD_PREVIEW_MAX_CHARS * 0.7 ? sliced.slice(0, lastSpace) : sliced;
  return `${safeCut}...`;
}

function createInitialEditorState(): EditorState {
  return {
    id: null,
    title: "",
    content: "",
    slotId: "",
    recommendation: null,
    adminAnnotation: null,
    adminAnnotationDraft: "",
    aiPrompt: "",
    saving: false,
    saved: false,
    deleting: false,
    adjusting: false,
    error: null,
  };
}

export default function MyScriptsPage({ viewer }: { viewer?: ViewerInfo }) {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [plannerWeekStart, setPlannerWeekStart] = useState<string | null>(null);
  const [plannerSlots, setPlannerSlots] = useState<PlannerSlotOption[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(createInitialEditorState());
  const [adminTargetUser, setAdminTargetUser] = useState<AdminTargetUser | null>(null);
  const { toast } = useToast();
  const [, setLastViewedScriptsRecommendationsAt] = useLocalStorage<string>(
    LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY,
    ""
  );
  const [lastViewedScriptsFeedbackAt, setLastViewedScriptsFeedbackAt] = useLocalStorage<string>(
    LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY,
    ""
  );
  const [history, setHistory] = useState<DraftHistoryState>({
    past: [],
    present: { title: "", content: "" },
    future: [],
  });
  const historyRef = useRef<DraftHistoryState>({
    past: [],
    present: { title: "", content: "" },
    future: [],
  });
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapshotRef = useRef<DraftSnapshot | null>(null);
  const latestFeedbackToastRef = useRef<string>("");

  const isAdminViewer = viewer?.role === "admin";
  const isActingOnBehalf = Boolean(
    isAdminViewer &&
      adminTargetUser?.id &&
      viewer?.id &&
      adminTargetUser.id !== viewer.id
  );
  const targetUserId = isActingOnBehalf ? adminTargetUser?.id ?? null : null;

  const slotOptions = useMemo(() => {
    return plannerSlots
      .filter((slot) => Boolean(slot.slotId))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.blockStartHour - b.blockStartHour);
  }, [plannerSlots]);

  const unreadFeedbackScriptIds = useMemo(() => {
    const ids = new Set<string>();
    if (!scripts.length) return ids;

    const lastViewedTs = lastViewedScriptsFeedbackAt
      ? new Date(lastViewedScriptsFeedbackAt).getTime()
      : null;
    const hasValidLastViewed = Number.isFinite(lastViewedTs);

    scripts.forEach((script) => {
      const notes = script.adminAnnotation?.notes?.trim();
      if (!notes) return;
      const sourceTime = script.adminAnnotation?.updatedAt || script.updatedAt;
      const ts = new Date(sourceTime).getTime();
      if (!Number.isFinite(ts)) return;
      if (!hasValidLastViewed || !lastViewedTs || ts > lastViewedTs) {
        ids.add(script.id);
      }
    });

    return ids;
  }, [lastViewedScriptsFeedbackAt, scripts]);

  const fetchScripts = useCallback(
    async (opts?: { reset?: boolean }) => {
      const reset = Boolean(opts?.reset);
      setGlobalError(null);

      if (reset) setLoadingList(true);
      else setLoadingMore(true);

      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      if (!reset && nextCursor) params.set("cursor", nextCursor);
      if (targetUserId) params.set("targetUserId", targetUserId);

      try {
        const res = await fetch(`/api/scripts?${params.toString()}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível carregar os roteiros.");
        }

        const incoming = Array.isArray(data?.items) ? (data.items as ScriptItem[]) : [];
        const cursor = data?.pagination?.nextCursor ?? null;
        const more = Boolean(data?.pagination?.hasMore);

        setScripts((prev) => {
          if (reset) return incoming;
          const map = new Map<string, ScriptItem>();
          [...prev, ...incoming].forEach((item) => map.set(item.id, item));
          return Array.from(map.values());
        });
        setNextCursor(cursor);
        setHasMore(more);
      } catch (err: any) {
        setGlobalError(err?.message || "Erro inesperado ao carregar roteiros.");
      } finally {
        if (reset) setLoadingList(false);
        else setLoadingMore(false);
      }
    },
    [nextCursor, targetUserId]
  );

  const fetchPlannerSlots = useCallback(async () => {
    try {
      const res = await fetch("/api/planner/plan", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) return;
      const weekStart = typeof data?.weekStart === "string" ? data.weekStart : null;
      const slots = Array.isArray(data?.plan?.slots) ? data.plan.slots : [];
      setPlannerWeekStart(weekStart);
      setPlannerSlots(
        slots
          .filter((slot: any) => typeof slot?.slotId === "string")
          .map((slot: any) => ({
            slotId: slot.slotId,
            dayOfWeek: Number(slot.dayOfWeek || 0),
            blockStartHour: Number(slot.blockStartHour || 0),
          }))
      );
    } catch {
      // Falha silenciosa (vínculo é opcional).
    }
  }, []);

  useEffect(() => {
    fetchScripts({ reset: true });
  }, [fetchScripts, targetUserId]);

  useEffect(() => {
    if (loadingList) return;
    if (isActingOnBehalf) return;
    if (!scripts.length) return;

    const hasRecommendations = scripts.some((script) => script.recommendation?.isRecommended);
    if (!hasRecommendations) return;

    setLastViewedScriptsRecommendationsAt(new Date().toISOString());
  }, [isActingOnBehalf, loadingList, scripts, setLastViewedScriptsRecommendationsAt]);

  useEffect(() => {
    if (loadingList) return;
    if (isActingOnBehalf) return;
    if (isAdminViewer) return;
    if (!scripts.length) return;

    const unreadFeedbackScripts = scripts.filter((script) => unreadFeedbackScriptIds.has(script.id));
    if (!unreadFeedbackScripts.length) return;

    const newestFeedbackAt = unreadFeedbackScripts.reduce((latest, script) => {
      const sourceTime = script.adminAnnotation?.updatedAt || script.updatedAt;
      const ts = new Date(sourceTime).getTime();
      if (!Number.isFinite(ts)) return latest;
      return Math.max(latest, ts);
    }, 0);

    const feedbackSignature = `${unreadFeedbackScripts.length}-${newestFeedbackAt}`;
    if (latestFeedbackToastRef.current !== feedbackSignature) {
      toast({
        variant: "info",
        title:
          unreadFeedbackScripts.length === 1
            ? "Você recebeu um novo feedback em roteiro."
            : `Você recebeu ${unreadFeedbackScripts.length} novos feedbacks em roteiros.`,
      });
      latestFeedbackToastRef.current = feedbackSignature;
    }

    setLastViewedScriptsFeedbackAt(new Date().toISOString());
  }, [
    isActingOnBehalf,
    isAdminViewer,
    loadingList,
    scripts,
    setLastViewedScriptsFeedbackAt,
    toast,
    unreadFeedbackScriptIds,
  ]);

  useEffect(() => {
    fetchPlannerSlots();
  }, [fetchPlannerSlots]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const mainScroller = document.querySelector("#dashboard-main > div") as HTMLElement | null;
    if (!mainScroller || !editorOpen) return;

    const prevOverflow = mainScroller.style.overflow;
    const prevOverflowY = mainScroller.style.overflowY;
    mainScroller.style.overflow = "hidden";
    mainScroller.style.overflowY = "hidden";

    return () => {
      mainScroller.style.overflow = prevOverflow;
      mainScroller.style.overflowY = prevOverflowY;
    };
  }, [editorOpen]);

  const patchEditor = useCallback((patch: Partial<EditorState>) => {
    setEditor((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearHistoryTimer = useCallback(() => {
    if (!historyTimerRef.current) return;
    clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
  }, []);

  const resetDraftHistory = useCallback(
    (snapshot: DraftSnapshot) => {
      pendingSnapshotRef.current = null;
      clearHistoryTimer();
      const nextHistory: DraftHistoryState = {
        past: [],
        present: snapshot,
        future: [],
      };
      historyRef.current = nextHistory;
      setHistory(nextHistory);
    },
    [clearHistoryTimer]
  );

  useEffect(() => {
    setEditorOpen(false);
    setEditor(createInitialEditorState());
    resetDraftHistory({ title: "", content: "" });
    setNextCursor(null);
    setHasMore(false);
  }, [targetUserId, resetDraftHistory]);

  const commitDraftSnapshot = useCallback((snapshot: DraftSnapshot) => {
    const current = historyRef.current;
    if (snapshot.title === current.present.title && snapshot.content === current.present.content) {
      return;
    }

    const nextPast = [...current.past, current.present];
    const trimmedPast = nextPast.length > HISTORY_LIMIT ? nextPast.slice(nextPast.length - HISTORY_LIMIT) : nextPast;
    const nextHistory: DraftHistoryState = {
      past: trimmedPast,
      present: snapshot,
      future: [],
    };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
  }, []);

  const flushPendingDraftSnapshot = useCallback(() => {
    const pending = pendingSnapshotRef.current;
    if (!pending) return;
    pendingSnapshotRef.current = null;
    clearHistoryTimer();
    commitDraftSnapshot(pending);
  }, [clearHistoryTimer, commitDraftSnapshot]);

  const scheduleDraftSnapshot = useCallback(
    (snapshot: DraftSnapshot) => {
      pendingSnapshotRef.current = snapshot;
      clearHistoryTimer();
      historyTimerRef.current = setTimeout(() => {
        const pending = pendingSnapshotRef.current;
        pendingSnapshotRef.current = null;
        historyTimerRef.current = null;
        if (!pending) return;
        commitDraftSnapshot(pending);
      }, HISTORY_TYPING_DELAY_MS);
    },
    [clearHistoryTimer, commitDraftSnapshot]
  );

  const applyUndo = useCallback(() => {
    flushPendingDraftSnapshot();
    const current = historyRef.current;
    if (current.past.length === 0) return;

    const previous = current.past[current.past.length - 1]!;
    const nextHistory: DraftHistoryState = {
      past: current.past.slice(0, -1),
      present: previous,
      future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
    };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    patchEditor({ title: previous.title, content: previous.content, saved: false, error: null });
  }, [flushPendingDraftSnapshot, patchEditor]);

  const applyRedo = useCallback(() => {
    flushPendingDraftSnapshot();
    const current = historyRef.current;
    if (current.future.length === 0) return;

    const next = current.future[0]!;
    const nextHistory: DraftHistoryState = {
      past: [...current.past, current.present].slice(-HISTORY_LIMIT),
      present: next,
      future: current.future.slice(1),
    };
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    patchEditor({ title: next.title, content: next.content, saved: false, error: null });
  }, [flushPendingDraftSnapshot, patchEditor]);

  const handleTitleChange = useCallback(
    (value: string) => {
      patchEditor({ title: value, saved: false });
      scheduleDraftSnapshot({ title: value, content: editor.content });
    },
    [editor.content, patchEditor, scheduleDraftSnapshot]
  );

  const handleContentChange = useCallback(
    (value: string) => {
      patchEditor({ content: value, saved: false });
      scheduleDraftSnapshot({ title: editor.title, content: value });
    },
    [editor.title, patchEditor, scheduleDraftSnapshot]
  );

  const handleDraftKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) applyRedo();
      else applyUndo();
    },
    [applyRedo, applyUndo]
  );

  useEffect(() => {
    return () => clearHistoryTimer();
  }, [clearHistoryTimer]);

  const openCreateEditor = useCallback(() => {
    setEditor(createInitialEditorState());
    resetDraftHistory({ title: "", content: "" });
    setEditorOpen(true);
  }, [resetDraftHistory]);

  const openExistingEditor = useCallback((script: ScriptItem) => {
    const initialTitle = script.title || "";
    const initialContent = script.content || "";
    setEditor({
      id: script.id,
      title: initialTitle,
      content: initialContent,
      slotId: script.plannerRef?.slotId || "",
      recommendation: script.recommendation || null,
      adminAnnotation: script.adminAnnotation || null,
      adminAnnotationDraft: script.adminAnnotation?.notes || "",
      aiPrompt: "",
      saving: false,
      saved: false,
      deleting: false,
      adjusting: false,
      error: null,
    });
    resetDraftHistory({ title: initialTitle, content: initialContent });
    setEditorOpen(true);
  }, [resetDraftHistory]);

  const patchScriptList = useCallback((updated: ScriptItem) => {
    setScripts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const handleSave = useCallback(async () => {
    flushPendingDraftSnapshot();
    const title = editor.title.trim();
    const content = editor.content.trim();

    if (!title && !content) {
      patchEditor({ error: "Escreva um título ou conteúdo para salvar o roteiro." });
      return;
    }

    if (!content) {
      patchEditor({ error: "O conteúdo do roteiro não pode ficar vazio." });
      return;
    }

    patchEditor({ saving: true, saved: false, error: null });

    try {
      if (editor.id) {
        const patchBody: Record<string, unknown> = {
          title: title || "Roteiro sem título",
          content,
          targetUserId: targetUserId || undefined,
        };
        if (isAdminViewer) {
          patchBody.adminAnnotation = editor.adminAnnotationDraft;
        }

        const res = await fetch(`/api/scripts/${editor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível salvar o roteiro.");
        }
        const updated = data.item as ScriptItem;
        patchScriptList(updated);
        patchEditor({
          id: updated.id,
          title: updated.title,
          content: updated.content,
          recommendation: updated.recommendation || null,
          adminAnnotation: updated.adminAnnotation || null,
          adminAnnotationDraft: updated.adminAnnotation?.notes || "",
          saving: false,
          saved: true,
          error: null,
        });
      } else {
        const body: any = {
          mode: "manual",
          title: title || "Roteiro sem título",
          content,
          targetUserId: targetUserId || undefined,
        };
        if (isAdminViewer) {
          body.adminAnnotation = editor.adminAnnotationDraft;
        }

        if (editor.slotId && plannerWeekStart) {
          const slot = slotOptions.find((option) => option.slotId === editor.slotId);
          if (slot) {
            body.linkToSlot = {
              slotId: slot.slotId,
              weekStart: plannerWeekStart,
              dayOfWeek: slot.dayOfWeek,
              blockStartHour: slot.blockStartHour,
            };
          }
        }

        const res = await fetch("/api/scripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível criar o roteiro.");
        }

        const created = data.item as ScriptItem;
        setScripts((prev) => [created, ...prev]);
        patchEditor({
          id: created.id,
          title: created.title,
          content: created.content,
          recommendation: created.recommendation || null,
          adminAnnotation: created.adminAnnotation || null,
          adminAnnotationDraft: created.adminAnnotation?.notes || "",
          saving: false,
          saved: true,
          error: null,
        });
      }
    } catch (err: any) {
      patchEditor({
        saving: false,
        saved: false,
        error: err?.message || "Erro ao salvar roteiro.",
      });
    }
  }, [editor, flushPendingDraftSnapshot, isAdminViewer, patchEditor, patchScriptList, plannerWeekStart, slotOptions, targetUserId]);

  const handleDelete = useCallback(async () => {
    if (!editor.id) {
      setEditorOpen(false);
      setEditor(createInitialEditorState());
      resetDraftHistory({ title: "", content: "" });
      return;
    }

    patchEditor({ deleting: true, error: null });
    try {
      const params = new URLSearchParams();
      if (targetUserId) params.set("targetUserId", targetUserId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/scripts/${editor.id}${suffix}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Não foi possível excluir o roteiro.");
      }

      setScripts((prev) => prev.filter((item) => item.id !== editor.id));
      setEditorOpen(false);
      setEditor(createInitialEditorState());
      resetDraftHistory({ title: "", content: "" });
      await fetchPlannerSlots();
    } catch (err: any) {
      patchEditor({ deleting: false, error: err?.message || "Erro ao excluir roteiro." });
    }
  }, [editor.id, fetchPlannerSlots, patchEditor, resetDraftHistory, targetUserId]);

  const handleAiAdjust = useCallback(async () => {
    const prompt = editor.aiPrompt.trim();
    if (!prompt) {
      patchEditor({ error: "Digite um pedido para a IA." });
      return;
    }

    flushPendingDraftSnapshot();
    patchEditor({ adjusting: true, error: null });
    try {
      if (editor.id) {
        const res = await fetch(`/api/scripts/${editor.id}/ai-adjust`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, targetUserId: targetUserId || undefined }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível ajustar com IA.");
        }

        const updated = data.item as ScriptItem;
        patchScriptList(updated);
        patchEditor({
          title: updated.title,
          content: updated.content,
          recommendation: updated.recommendation || null,
          adminAnnotation: updated.adminAnnotation || null,
          adminAnnotationDraft: updated.adminAnnotation?.notes || editor.adminAnnotationDraft,
          aiPrompt: "",
          adjusting: false,
          error: null,
        });
        commitDraftSnapshot({ title: updated.title, content: updated.content });
      } else {
        const res = await fetch("/api/scripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "ai",
            prompt,
            title: editor.title.trim() || undefined,
            targetUserId: targetUserId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Não foi possível gerar roteiro com IA.");
        }

        const created = data.item as ScriptItem;
        setScripts((prev) => [created, ...prev]);
        patchEditor({
          id: created.id,
          title: created.title,
          content: created.content,
          recommendation: created.recommendation || null,
          adminAnnotation: created.adminAnnotation || null,
          adminAnnotationDraft: created.adminAnnotation?.notes || editor.adminAnnotationDraft,
          aiPrompt: "",
          adjusting: false,
          error: null,
        });
        commitDraftSnapshot({ title: created.title, content: created.content });
      }
    } catch (err: any) {
      patchEditor({
        adjusting: false,
        error: err?.message || "Erro ao processar pedido com IA.",
      });
    }
  }, [
    commitDraftSnapshot,
    editor.adminAnnotationDraft,
    editor.aiPrompt,
    editor.id,
    editor.title,
    flushPendingDraftSnapshot,
    patchEditor,
    patchScriptList,
    targetUserId,
  ]);

  const handleAiPromptKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      if ((event.nativeEvent as any)?.isComposing) return;
      event.preventDefault();
      if (editor.adjusting) return;
      void handleAiAdjust();
    },
    [editor.adjusting, handleAiAdjust]
  );

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  if (editorOpen) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--header-h,56px))] flex-col overflow-hidden bg-white [-webkit-tap-highlight-color:transparent]">
        <header className="shrink-0 border-b border-slate-100 bg-white">
          <div className="dashboard-page-shell py-3 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full min-w-0 items-center gap-2 sm:flex-1 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    flushPendingDraftSnapshot();
                    setEditorOpen(false);
                    setEditor(createInitialEditorState());
                    resetDraftHistory({ title: "", content: "" });
                  }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
                  aria-label="Voltar para Meus Roteiros"
                >
                  <ArrowLeft size={18} />
                </button>
                <input
                  type="text"
                  value={editor.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  placeholder="Roteiro sem título"
                  className="min-w-0 w-full flex-1 border-0 bg-transparent p-0 text-base font-medium text-slate-900 outline-none ring-0 ring-transparent placeholder:text-slate-300 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 sm:max-w-[520px] sm:min-w-[220px] sm:text-lg"
                />
              </div>

              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                <button
                  type="button"
                  onClick={applyUndo}
                  disabled={!canUndo}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Desfazer edição"
                >
                  <Undo2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={applyRedo}
                  disabled={!canRedo}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Refazer edição"
                >
                  <Redo2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={editor.saving}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                    editor.saved
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <Save size={15} />
                  {editor.saving ? "Salvando..." : editor.saved ? "Salvo" : "Salvar"}
                </button>
                {editor.id ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={editor.deleting}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                  >
                    <Trash2 size={15} />
                    {editor.deleting ? "Excluindo..." : "Excluir"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-page-shell flex-1 min-h-0 py-2">
          <div className="mx-auto flex h-full w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 sm:px-6">
            {editor.recommendation?.isRecommended ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:text-sm">
                Recomendação especial
                {editor.recommendation.recommendedByAdminName
                  ? ` de ${editor.recommendation.recommendedByAdminName}`
                  : " do time"}{" "}
                {editor.recommendation.recommendedAt
                  ? `(${formatDate(editor.recommendation.recommendedAt)})`
                  : ""}.
              </div>
            ) : null}
            {editor.adminAnnotation?.notes?.trim() ? (
              <div className="mt-3 rounded-xl border border-[#FFDEE9] bg-[#FFF6F9] px-3 py-2 text-xs text-slate-700 sm:text-sm">
                <p className="font-semibold text-slate-800">Feedback do admin</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{editor.adminAnnotation.notes}</p>
                {editor.adminAnnotation.updatedAt ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex-1 min-h-[62vh]">
              <textarea
                value={editor.content}
                onChange={(e) => handleContentChange(e.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Escreva seu roteiro aqui..."
                className="h-full min-h-[62vh] w-full resize-none overflow-y-auto border-0 bg-transparent py-7 text-[17px] leading-9 text-slate-800 outline-none ring-0 ring-transparent placeholder:text-slate-300 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
              />
            </div>

            {isAdminViewer ? (
              <div className="shrink-0 border-t border-slate-100 py-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-500">Feedback para creator (admin)</p>
                  {editor.adminAnnotation?.updatedAt ? (
                    <p className="text-[11px] text-slate-400">
                      {editor.adminAnnotation.updatedByName || "Admin"} · {formatDate(editor.adminAnnotation.updatedAt)}
                    </p>
                  ) : null}
                </div>
                <textarea
                  value={editor.adminAnnotationDraft}
                  onChange={(e) =>
                    patchEditor({
                      adminAnnotationDraft: e.target.value,
                      saved: false,
                    })
                  }
                  placeholder="Esse feedback aparece para o dono do roteiro."
                  className="h-24 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                />
              </div>
            ) : null}

            <div className="shrink-0 border-t border-slate-100 py-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Assistente IA</p>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                <input
                  type="text"
                  value={editor.aiPrompt}
                  onChange={(e) => patchEditor({ aiPrompt: e.target.value })}
                  onKeyDown={handleAiPromptKeyDown}
                  placeholder="Peça um roteiro novo ou ajuste no roteiro atual..."
                  className="flex-1 border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none ring-0 ring-transparent placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  onClick={handleAiAdjust}
                  disabled={editor.adjusting}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <Sparkles size={14} />
                  {editor.adjusting ? "Processando..." : "Enviar"}
                </button>
              </div>
            </div>
            {editor.error ? <p className="shrink-0 pb-4 text-sm text-rose-600">{editor.error}</p> : null}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="dashboard-page-shell py-8">
        {isAdminViewer ? (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="w-full sm:max-w-md">
              <CreatorQuickSearch
                onSelect={(creator) =>
                  setAdminTargetUser({
                    id: creator.id,
                    name: creator.name,
                    profilePictureUrl: creator.profilePictureUrl,
                  })
                }
                selectedCreatorName={adminTargetUser?.name || null}
                selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                onClear={() => setAdminTargetUser(null)}
                apiPrefix="/api/admin"
              />
            </div>
          </div>
        ) : null}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Meus Roteiros</h1>
          {!isActingOnBehalf ? (
            <p className="mt-1 text-slate-500">Escolha um roteiro salvo ou comece um novo.</p>
          ) : null}
        </div>

        {globalError ? <p className="mb-4 text-sm text-rose-600">{globalError}</p> : null}

        {loadingList ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={`loading-${idx}`}
                className="h-64 animate-pulse rounded-[1.5rem] border border-slate-200 bg-white shadow-sm sm:h-72 sm:rounded-[2rem]"
              >
                <div className="h-11 border-b border-slate-100 bg-slate-50" />
                <div className="p-5">
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="mt-3 h-3 w-full rounded bg-slate-100/80" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-slate-100/70" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-slate-100/60" />
                </div>
                <div className="mx-5 mt-6 h-10 rounded-xl bg-slate-50" />
              </div>
            ))}
          </div>
        ) : scripts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="mb-4 text-slate-700">
              {isActingOnBehalf
                ? `${adminTargetUser?.name} ainda não tem roteiros salvos.`
                : "Você ainda não tem roteiros salvos."}
            </p>
            <button
              type="button"
              onClick={openCreateEditor}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              Criar meu primeiro roteiro
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              <button
                type="button"
                onClick={openCreateEditor}
                className="group flex h-64 flex-col overflow-hidden rounded-[1.5rem] border border-slate-300 bg-white text-left shadow-sm ring-1 ring-transparent transition hover:-translate-y-1 hover:border-slate-400 hover:shadow-xl hover:ring-slate-200 sm:h-72 sm:rounded-[2rem]"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Novo</span>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
                    <Plus size={18} />
                  </span>
                  <span className="text-sm font-semibold text-slate-800">Novo Roteiro</span>
                  <span className="text-xs text-slate-500">Começar em branco</span>
                </div>
              </button>

              {scripts.map((script) => {
                const tone = getSourceCardTone(script.source);
                const hasAdminAnnotation = Boolean(script.adminAnnotation?.notes?.trim());
                const hasUnreadFeedback = unreadFeedbackScriptIds.has(script.id);
                return (
                  <button
                    type="button"
                    key={script.id}
                    onClick={() => openExistingEditor(script)}
                    className={`group relative flex h-64 flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white text-left shadow-sm ring-1 ring-transparent transition hover:-translate-y-1 hover:shadow-xl ${tone.ring} sm:h-72 sm:rounded-[2rem]`}
                  >
                    <div className={`flex items-center justify-between gap-2 border-b px-5 py-3 ${tone.header}`}>
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${tone.text}`}>
                        {getSourceLabel(script.source)}
                      </span>
                      {script.recommendation?.isRecommended ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Recomendação
                        </span>
                      ) : null}
                      {hasAdminAnnotation ? (
                        <span className="rounded-full bg-[#FFE7EF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C3265C]">
                          {hasUnreadFeedback ? "Novo feedback" : isAdminViewer ? "Feedback ativo" : "Feedback"}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col p-5">
                      <p className="line-clamp-2 text-base font-semibold leading-tight text-slate-900">
                        {getCardTitle(script)}
                      </p>

                      <div className="mt-3 flex-1 overflow-hidden">
                        <p className="line-clamp-7 overflow-hidden break-words text-sm leading-relaxed text-slate-500">
                          {getCardPreview(script)}
                        </p>
                      </div>

                      <p className="mt-auto pt-4 text-[11px] font-medium text-slate-400">
                        Atualizado em {formatDate(script.updatedAt)}
                      </p>
                      {script.recommendation?.isRecommended ? (
                        <p className="pt-1 text-[11px] font-medium text-amber-700">
                          Recomendado por{" "}
                          {script.recommendation.recommendedByAdminName || "Admin"}
                        </p>
                      ) : null}
                      {hasAdminAnnotation ? (
                        <p className="line-clamp-1 pt-1 text-[11px] font-medium text-slate-600">
                          {hasUnreadFeedback ? "Novo: " : ""}Feedback: {script.adminAnnotation?.notes}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {hasMore ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchScripts()}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
