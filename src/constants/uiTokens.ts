// Lightweight UI tokens to keep spacing, radii and semantic colors consistent

export const space = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
} as const;

export const radii = {
  sm: '0.375rem', // rounded-md
  md: '0.5rem',   // rounded-lg
  lg: '0.75rem',  // rounded-xl
  xl: '1rem',     // rounded-2xl
} as const;

export const semantic = {
  success: { fg: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  warning: { fg: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  danger:  { fg: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  info:    { fg: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  muted:   { fg: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
} as const;

