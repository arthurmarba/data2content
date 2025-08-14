interface Props {
  onClick: () => void;
}

export default function ReactivateBanner({ onClick }: Props) {
  return (
    <div className="mb-4 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
      Sua assinatura será cancelada ao fim do período atual.
      <button
        onClick={onClick}
        className="ml-2 rounded bg-blue-600 px-2 py-1 text-white"
      >
        Reativar assinatura
      </button>
    </div>
  );
}
