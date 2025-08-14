import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  text: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, text, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-gray-500">
      {icon && <div className="mb-2">{icon}</div>}
      <p>{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
