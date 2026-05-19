import type { MobileStrategicProfile } from "../../../videoUpload/mobileStrategicProfileMapping";

type MobileStrategicProfileMediaKitModalProps = {
  profile: MobileStrategicProfile;
  open: boolean;
  onClose: () => void;
};

function safeMediaKitHref(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return null;
  if (/(api[_-]?key|signature|signed|token=|x-amz|base64|data:)/i.test(trimmed)) return null;
  if (/[a-z0-9+/=]{80,}/i.test(trimmed)) return null;
  return trimmed;
}

export function MobileStrategicProfileMediaKitModal({
  profile,
  open,
  onClose,
}: MobileStrategicProfileMediaKitModalProps) {
  if (!open) return null;

  const bridge = profile.mediaKitBridge;
  const identity = profile.header.identity;
  const mediaKitHref = safeMediaKitHref(bridge.href);
  const isAvailable = bridge.state === "available";
  const title = isAvailable ? "Compartilhar Mídia Kit" : "Ativar Mídia Kit";
  const description = isAvailable
    ? "Use o Mídia Kit existente para apresentar seu perfil para marcas."
    : "Conectar Instagram é o próximo passo para ativar o Mídia Kit existente.";
  const linkActionsDisabled = !isAvailable || !mediaKitHref;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-zinc-950/55 px-4 py-5 sm:place-items-center"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-strategic-profile-media-kit-modal-title"
        className="w-full max-w-sm rounded-[1.75rem] bg-white p-5 text-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Mídia Kit existente</p>
            <h2 id="mobile-strategic-profile-media-kit-modal-title" className="mt-1 text-xl font-semibold">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Fechar modal de Mídia Kit"
            className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-lg font-semibold text-zinc-700"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-zinc-950">{identity.displayName}</h3>
              {identity.displayHandle ? (
                <p className="mt-0.5 text-sm text-zinc-500">{identity.displayHandle}</p>
              ) : null}
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-700">
              {isAvailable ? "Mídia Kit ativo" : "Instagram"}
            </span>
          </div>

          {isAvailable ? (
            mediaKitHref ? (
              <p className="mt-4 break-all rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-600">
                {mediaKitHref}
              </p>
            ) : (
              <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm leading-6 text-zinc-600">
                O link do Mídia Kit existente ainda não está disponível nesta preview.
              </p>
            )
          ) : (
            <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm leading-6 text-zinc-600">
              Esta preview não conecta Instagram de verdade; ela só mostra a ponte visual para o recurso existente.
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={linkActionsDisabled}
            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 disabled:text-zinc-400"
          >
            Copiar link
          </button>
          <button
            type="button"
            disabled={linkActionsDisabled}
            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 disabled:text-zinc-400"
          >
            Compartilhar
          </button>
          <button
            type="button"
            disabled={linkActionsDisabled}
            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 disabled:text-zinc-400"
          >
            Ver como marca
          </button>
          <button
            type="button"
            disabled={linkActionsDisabled}
            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 disabled:text-zinc-400"
          >
            Abrir Mídia Kit
          </button>
        </div>

        <button
          type="button"
          className="mt-5 w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white"
          onClick={onClose}
        >
          Fechar
        </button>
      </section>
    </div>
  );
}
