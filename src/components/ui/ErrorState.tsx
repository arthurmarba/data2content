import { ReactNode } from 'react';

interface Props {
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
  icon?: ReactNode;
}

export default function ErrorState({ message, onRetry, actionLabel = 'Tentar novamente', icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-red-600">
      {icon && <div className="mb-2">{icon}</div>}
      <p className="mb-2">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded bg-red-600 px-3 py-1 text-white text-xs">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
