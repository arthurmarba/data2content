"use client";

export type PostCreationAdaptivePromptContextCardProps = {
  prompt: string | null | undefined;
  variant?: "quiz" | "final";
};

function normalizePrompt(prompt: string | null | undefined): string | null {
  const normalized = typeof prompt === "string" ? prompt.replace(/\s+/g, " ").trim() : "";
  return normalized || null;
}

export default function PostCreationAdaptivePromptContextCard({
  prompt,
  variant = "quiz",
}: PostCreationAdaptivePromptContextCardProps) {
  const normalizedPrompt = normalizePrompt(prompt);
  if (!normalizedPrompt) return null;

  const label = variant === "final" ? "A partir da sua pergunta" : "Você perguntou";

  return (
    <aside className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-3 text-sm font-medium leading-6 text-slate-900">
        “{normalizedPrompt}”
      </p>
    </aside>
  );
}
