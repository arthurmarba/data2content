"use client";

const COMMUNITY_VIP_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ||
  "https://chat.whatsapp.com/BAeBQZ8zuhQJOxXXJJaTnH";

/**
 * Community card — Calm Edition.
 * Subtle, no pressure. Just an invitation, not a CTA banner.
 */
export function DiagnosticoCommunityCard() {
  return (
    <a
      href={COMMUNITY_VIP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full overflow-hidden rounded-[32px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.025),0_18px_42px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.025] no-underline active:opacity-80"
    >
      <div className="p-5 flex items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-emerald-500 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)]">
          <WhatsAppIcon fill="white" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[18px] font-bold leading-tight text-zinc-950">
            Comunidade D2C
          </p>
          <p className="mt-0.5 truncate text-[14px] font-medium leading-snug text-zinc-500">
            Troque com criadores no WhatsApp
          </p>
        </div>
        <svg
          width="10"
          height="16"
          viewBox="0 0 10 16"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-zinc-300"
        >
          <path
            d="M2 2l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </a>
  );
}

function WhatsAppIcon({ fill, size }: { fill: string; size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={fill}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M11.994 2C6.477 2 2 6.477 2 11.994c0 1.858.506 3.6 1.387 5.098L2 22l5.047-1.368A9.94 9.94 0 0 0 11.994 22C17.511 22 22 17.511 22 11.994 22 6.477 17.511 2 11.994 2zm0 18.16a8.154 8.154 0 0 1-4.157-1.138l-.298-.177-3.093.838.857-3.007-.194-.31A8.162 8.162 0 0 1 3.84 11.994c0-4.499 3.66-8.16 8.154-8.16 4.494 0 8.155 3.661 8.155 8.16s-3.661 8.166-8.155 8.166z" />
    </svg>
  );
}
