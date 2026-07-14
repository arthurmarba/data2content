"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AppScreen({ fixed = false, className, ...props }: HTMLAttributes<HTMLDivElement> & { fixed?: boolean }) {
  return <div className={cx("ds-screen", fixed && "ds-screen--fixed", className)} {...props} />;
}

export function ScreenTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cx("ds-screen-title", className)} {...props} />;
}

export function SectionTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cx("ds-section-title", className)} {...props} />;
}

type ButtonVariant = "primary" | "secondary" | "quiet" | "ghost" | "danger";

export function Button({
  variant = "primary",
  block = false,
  size = "default",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  block?: boolean;
  size?: "default" | "small";
}) {
  return (
    <button
      type={type}
      className={cx(
        "ds-button",
        `ds-button--${variant}`,
        block && "ds-button--block",
        size === "small" && "ds-button--small",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({ label, ghost = false, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; ghost?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx("ds-icon-button", ghost && "ds-icon-button--ghost", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("ds-field", className)} {...props} />;
}

export function Surface({ raised = false, subtle = false, className, ...props }: HTMLAttributes<HTMLDivElement> & { raised?: boolean; subtle?: boolean }) {
  return <div className={cx("ds-surface", raised && "ds-surface--raised", subtle && "ds-surface--subtle", className)} {...props} />;
}

export function Badge({ tone = "brand", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "brand" | "neutral" | "success" | "warning" | "danger" }) {
  return <span className={cx("ds-badge", tone !== "brand" && `ds-badge--${tone}`, className)} {...props} />;
}

export function AppHeader({ title, onBack, action, className }: { title: string; onBack?: () => void; action?: ReactNode; className?: string }) {
  return (
    <header className={cx("ds-app-header", className)}>
      {onBack ? (
        <IconButton label="Voltar" ghost onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15.5 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
      ) : null}
      <p className="ds-app-header__title">{title}</p>
      {action ? <div className="ml-auto flex shrink-0 items-center">{action}</div> : null}
    </header>
  );
}

export function BottomSheet({ open, title, onClose, children, className }: { open: boolean; title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => panelRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[270] flex items-end justify-center ds-scrim" role="presentation" onMouseDown={onClose}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx("ds-sheet ds-enter-sheet", className)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ds-sheet__handle" aria-hidden="true" />
        <div className="flex items-center gap-3 px-5 pb-4 pt-2">
          <h2 className="min-w-0 flex-1 text-[1.35rem] font-bold leading-tight">{title}</h2>
          <IconButton label="Fechar" onClick={onClose}><X size={18} aria-hidden="true" /></IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}
