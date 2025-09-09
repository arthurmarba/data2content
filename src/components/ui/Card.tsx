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
  const padBase = density === 'compact' ? 'p-3' : 'p-4 md:p-5';
  const padBrand = density === 'compact' ? 'p-3.5' : 'p-6 sm:p-8';
  const pad = variant === 'brand' ? padBrand : padBase;
  const base = 'rounded-xl bg-white';
  const shadow = variant === 'brand' ? 'shadow-lg' : 'shadow-sm';
  const border = variant === 'brand' ? 'border border-gray-200 border-t-4 border-pink-500' : 'border border-gray-200';
  return (
    <section className={`${base} ${border} ${shadow} ${pad} ${className}`}> 
      {(title || actions || subtitle) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}
