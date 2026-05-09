"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

type BrandReportActionsProps = {
  approachMessage: string;
  size?: "default" | "large";
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function BrandReportActions({ approachMessage, size = "default" }: BrandReportActionsProps) {
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
      shortLabel: copied === "link" ? "Copiado" : "Link",
      text: "",
    },
    {
      id: "message" as const,
      label: copied === "message" ? "Mensagem copiada" : "Copiar mensagem de abordagem",
      shortLabel: copied === "message" ? "Copiada" : "Mensagem",
      text: approachMessage,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
      {actions.map((action) => {
        const isCopied = copied === action.id;
        return (
          <button
            key={action.id}
            type="button"
            aria-label={action.label}
            onClick={() => copyText(action.id, action.text)}
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border font-semibold transition duration-200 sm:gap-2",
              size === "large"
                ? "h-12 px-4 text-sm sm:h-12 sm:px-5 sm:text-sm"
                : "h-9 px-3 text-xs sm:h-11 sm:px-4 sm:text-sm",
              isCopied
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-[#2d3442] bg-[#202633] text-white shadow-[0_12px_30px_rgba(15,23,42,0.14)] hover:bg-[#151a23]"
            )}
          >
            {isCopied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            <span className="sm:hidden">{action.shortLabel}</span>
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
