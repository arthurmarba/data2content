import React from 'react';

type Density = 'compact' | 'comfortable';

type Variant = 'default' | 'brand';

interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  density?: Density;
  variant?: Variant;
  className?: string;
  children?: React.ReactNode;
}

export default function Card({ title, subtitle, actions, density = 'comfortable', variant = 'default', className = '', children }: CardProps) {
  const padBase = density === 'compact' ? 'p-3.5' : 'p-4 md:p-5';
  const padBrand = density === 'compact' ? 'p-4' : 'p-5 sm:p-6';
  const pad = variant === 'brand' ? padBrand : padBase;
  const base = 'relative overflow-hidden text-zinc-900';
  const shell =
    variant === 'brand'
      ? 'dashboard-panel rounded-[1.75rem] before:pointer-events-none before:absolute before:inset-x-10 before:top-0 before:h-20 before:rounded-full before:bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.12),transparent_72%)]'
      : 'dashboard-panel-subtle rounded-[1.4rem]';
  return (
    <section className={`${base} ${shell} ${pad} ${className}`}>
      {(title || actions || subtitle) && (
        <header className="relative z-[1] mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold tracking-[-0.02em] text-zinc-950">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs leading-5 text-zinc-500">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}
