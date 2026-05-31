"use client";

import { MOBILE_MEDIA_KIT_ROUTE, MOBILE_INSTAGRAM_CONNECT_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { DiagnosticoCardShell, Chevron } from "./DiagnosticoCardShell";

interface Props {
  instagramConnected: boolean;
  onConnectInstagram?: () => void;
  onOpenMediaKit?: () => void;
}

export function DiagnosticoMediaKitCard({ instagramConnected, onConnectInstagram, onOpenMediaKit }: Props) {
  if (instagramConnected) {
    return (
      <DiagnosticoCardShell
        onClick={onOpenMediaKit || (() => { window.location.href = MOBILE_MEDIA_KIT_ROUTE; })}
      >
        <div className="flex items-center gap-4 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-zinc-800 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)]" aria-hidden="true">
            <MediaKitIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold leading-tight text-zinc-950">Mídia Kit</p>
            <p className="mt-0.5 truncate text-[14px] font-medium leading-snug text-zinc-500">
              Pronto para marcas
            </p>
          </div>
          <Chevron />
        </div>
      </DiagnosticoCardShell>
    );
  }

  return (
    <DiagnosticoCardShell>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-zinc-300" aria-hidden="true">
            <MediaKitIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold leading-tight text-zinc-950">Mídia Kit</p>
            <p className="mt-0.5 text-[14px] font-medium leading-snug text-zinc-500">
              Conecte o Instagram para liberar seu perfil comercial.
            </p>
          </div>
        </div>
        <button
          onClick={
            onConnectInstagram ??
            (() => { window.location.href = MOBILE_INSTAGRAM_CONNECT_ROUTE; })
          }
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2.5 text-[14px] font-semibold text-white"
        >
          <InstagramIcon />
          Conectar Instagram
        </button>
      </div>
    </DiagnosticoCardShell>
  );
}

function InstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="white" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
    </svg>
  );
}

function MediaKitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <line x1="16" y1="13" x2="8" y2="13" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="16" y1="17" x2="8" y2="17" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
