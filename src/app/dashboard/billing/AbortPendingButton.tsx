"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { event } from "@/lib/gtag";

export default function AbortPendingButton() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  if (session?.user?.planStatus !== "pending") return null;

  async function handleAbortPending() {
    event("select_content", {
      content_type: "button",
      item_id: "abort_pending",
    });
    try {
      setSubmitting(true);
      await fetch("/api/billing/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await update?.();
      router.refresh();
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-4">
      <button
        onClick={handleAbortPending}
        disabled={submitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {submitting ? "Cancelando..." : "Cancelar tentativa de assinatura"}
      </button>
    </div>
  );
}

