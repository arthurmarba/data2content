// src/components/ui/SkeletonRow.tsx (CORRIGIDO)

interface SkeletonRowProps {
  count?: number; // Tornamos a propriedade opcional, com valor padrão 1
}

export default function SkeletonRow({ count = 1 }: SkeletonRowProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
}