interface Props {
  onClick: () => void;
  disabled: boolean; // 1. Adicionamos a propriedade aqui
}

// 2. Recebemos a propriedade 'disabled' na função
export default function ReactivateBanner({ onClick, disabled }: Props) {
  return (
    <div className="mb-3 sm:mb-4 rounded border border-blue-300 bg-blue-50 p-2 sm:p-3 text-xs sm:text-sm text-blue-800 flex items-center justify-between">
      <span className="pr-2">Sua assinatura será cancelada ao fim do período atual.</span>
      <button
        onClick={onClick}
        disabled={disabled}
        className="ml-2 rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0 text-xs sm:text-sm"
      >
        {disabled ? 'Reativando...' : 'Reativar assinatura'}
      </button>
    </div>
  );
}
