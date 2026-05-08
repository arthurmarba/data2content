"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

type BrandReportActionsProps = {
  approachMessage: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function BrandReportActions({ approachMessage }: BrandReportActionsProps) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  const copyText = useCallback(async (type: "link" | "message", text: string) => {
    try {
      const textToCopy = type === "link" ? window.location.href : text;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(type);
      window.setTimeout(() => setCopied(null), 2600);
    } catch {
      setCopied(null);
    }
  }, []);

  const actions = [
    {
      id: "link" as const,
      label: copied === "link" ? "Link copiado" : "Copiar link",
      text: "",
    },
    {
      id: "message" as const,
      label: copied === "message" ? "Mensagem copiada" : "Copiar mensagem de abordagem",
      text: approachMessage,
    },
  ];

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {actions.map((action) => {
        const isCopied = copied === action.id;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => copyText(action.id, action.text)}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition duration-200",
              isCopied
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-zinc-900 bg-zinc-950 text-white hover:bg-zinc-800"
            )}
          >
            {isCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
