"use client";

import { useState } from "react";
import type {
  MobileStrategicProfile,
  MobileStrategicProfileAction,
  MobileStrategicProfileSection,
  MobileStrategicProfileSectionCard,
} from "../../../videoUpload/mobileStrategicProfileMapping";
import {
  MOBILE_STRATEGIC_PROFILE_PREVIEW_STATES,
  type MobileStrategicProfilePreviewFixtureState,
} from "./buildMobileStrategicProfilePreviewFixture";
import { MobileStrategicProfileMediaKitModal } from "./MobileStrategicProfileMediaKitModal";

type MobileStrategicProfilePreviewProps = {
  profile: MobileStrategicProfile;
  activeState?: MobileStrategicProfilePreviewFixtureState;
};

const CARD_TONE: Record<MobileStrategicProfileSectionCard["tone"], string> = {
  neutral: "border-zinc-200 bg-white",
  diagnosis: "border-sky-100 bg-sky-50/70",
  commercial: "border-emerald-100 bg-emerald-50/70",
  action: "border-zinc-200 bg-zinc-50",
  locked: "border-amber-100 bg-amber-50/70",
};

const MEDIA_KIT_ACTION_INTENTS = new Set<MobileStrategicProfileAction["intent"]>([
  "share_media_kit",
  "copy_link",
  "view_as_brand",
  "edit_or_open_media_kit",
]);

function isMediaKitAction(action: MobileStrategicProfileAction): boolean {
  return MEDIA_KIT_ACTION_INTENTS.has(action.intent);
}

function StateSwitcher({ activeState }: { activeState?: MobileStrategicProfilePreviewFixtureState }) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Estados do Perfil Estratégico">
      {MOBILE_STRATEGIC_PROFILE_PREVIEW_STATES.map((state) => (
        <a
          key={state}
          href={`/dashboard/boards/mobile-strategic-profile-preview?state=${state}`}
          className={
            state === activeState
              ? "shrink-0 rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white"
              : "shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700"
          }
        >
          {state.replaceAll("_", " ")}
        </a>
      ))}
    </nav>
  );
}

function ActionButton({
  action,
  onAction,
}: {
  action: MobileStrategicProfileAction;
  onAction?: (action: MobileStrategicProfileAction) => void;
}) {
  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={() => onAction?.(action)}
      className={
        action.priority === "primary"
          ? "rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-300"
          : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:text-zinc-400"
      }
    >
      {action.label}
    </button>
  );
}

function AuthGate({ profile }: { profile: MobileStrategicProfile }) {
  const gate = profile.authGate;

  return (
    <section className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950">
      <div className="mx-auto grid max-w-5xl gap-5">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno — Perfil Estratégico</p>
          <h1 className="mt-2 text-2xl font-semibold">Perfil Estratégico mobile</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            O Perfil da D2C é o diagnóstico vivo do creator. Cada vídeo analisado atualiza esse perfil.
          </p>
        </header>

        <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-zinc-200 bg-zinc-950 p-2 shadow-xl">
          <div className="min-h-[680px] rounded-[1.5rem] bg-white px-5 py-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-950">Perfil Estratégico</span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">D2C</span>
            </div>
            <div className="mt-24 grid place-items-center text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-zinc-950 text-2xl font-semibold text-white">
                D2C
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-zinc-950">{gate.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{gate.description}</p>
              {gate.action ? (
                <div className="mt-6">
                  <ActionButton action={gate.action} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileHeader({
  profile,
  onAction,
}: {
  profile: MobileStrategicProfile;
  onAction: (action: MobileStrategicProfileAction) => void;
}) {
  const identity = profile.header.identity;
  const initials = identity.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "D2";

  return (
    <header className="px-5 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-950">{identity.displayHandle ?? "Perfil Estratégico"}</p>
          <p className="text-xs text-zinc-500">Diagnóstico vivo</p>
        </div>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-zinc-950 text-xl font-semibold text-white">
          +
        </button>
      </div>

      <div className="mt-6 flex items-start gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-zinc-950 text-xl font-semibold text-white">
          {identity.userImage ? <span>{initials}</span> : initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-zinc-950">{identity.displayName}</h2>
          {identity.displayHandle ? <p className="mt-0.5 text-sm text-zinc-500">{identity.displayHandle}</p> : null}
          {identity.bio ? <p className="mt-2 text-sm leading-6 text-zinc-700">{identity.bio}</p> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {profile.header.statusPills.map((pill) => (
          <span key={pill.id} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            {pill.label}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {profile.primaryActions.slice(0, 2).map((action) => (
          <ActionButton key={action.id} action={action} onAction={onAction} />
        ))}
      </div>
    </header>
  );
}

function Tabs({ profile }: { profile: MobileStrategicProfile }) {
  return (
    <div className="mx-5 mt-5 grid grid-cols-2 rounded-full bg-zinc-100 p-1">
      {profile.tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={
            tab.active
              ? "rounded-full bg-white px-3 py-2 text-sm font-semibold text-zinc-950 shadow-sm"
              : "rounded-full px-3 py-2 text-sm font-semibold text-zinc-500"
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ card }: { card: MobileStrategicProfileSectionCard }) {
  return (
    <article className={`rounded-2xl border p-4 ${CARD_TONE[card.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-950">{card.title}</h4>
        {card.locked ? <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-zinc-500">Bloqueado</span> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{card.body}</p>
    </article>
  );
}

function ProfileSection({ section }: { section: MobileStrategicProfileSection }) {
  return (
    <section className="px-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">{section.title}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{section.description}</p>
        </div>
        {section.state === "limited" || section.state === "construction" ? (
          <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500">
            {section.state === "construction" ? "Em construção" : "Inicial"}
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-3">
        {section.cards.slice(0, 5).map((card) => (
          <SectionCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function MediaKitBridge({
  profile,
  onOpen,
}: {
  profile: MobileStrategicProfile;
  onOpen: () => void;
}) {
  const bridge = profile.mediaKitBridge;
  if (bridge.state === "hidden" || bridge.state === "unavailable" || !bridge.title || !bridge.description) return null;

  return (
    <section className="mx-5 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">{bridge.title}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{bridge.description}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
          {bridge.state === "available" ? "Ativo" : "Instagram"}
        </span>
      </div>
      {bridge.actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {bridge.actions.map((action) => (
            <ActionButton key={action.id} action={action} onAction={onOpen} />
          ))}
        </div>
      ) : bridge.state === "connect_instagram_required" ? (
        <button
          type="button"
          className="mt-4 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800"
          onClick={onOpen}
        >
          Ativar Mídia Kit
        </button>
      ) : null}
    </section>
  );
}

function BottomNav({ profile }: { profile: MobileStrategicProfile }) {
  return (
    <nav className="sticky bottom-0 mt-6 grid grid-cols-3 border-t border-zinc-200 bg-white px-4 py-3" aria-label="Navegação mobile futura">
      {profile.navigation.items.map((item) => (
        <a
          key={item.id}
          href={item.href ?? "#"}
          className={
            item.role === "central_action"
              ? "mx-auto grid h-12 w-12 place-items-center rounded-full bg-zinc-950 text-lg font-semibold text-white"
              : item.active
                ? "text-center text-xs font-semibold text-zinc-950"
                : "text-center text-xs font-semibold text-zinc-500"
          }
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function MobileStrategicProfilePreview({
  profile,
  activeState,
}: MobileStrategicProfilePreviewProps) {
  const [mediaKitModalOpen, setMediaKitModalOpen] = useState(false);

  if (profile.authGate.visible) return <AuthGate profile={profile} />;

  const handleAction = (action: MobileStrategicProfileAction) => {
    if (isMediaKitAction(action)) {
      setMediaKitModalOpen(true);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950">
      <div className="mx-auto grid max-w-5xl gap-5">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno — Perfil Estratégico</p>
          <h1 className="mt-2 text-2xl font-semibold">Perfil Estratégico mobile</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            O Perfil da D2C é o diagnóstico vivo do creator. Cada vídeo analisado atualiza esse perfil.
          </p>
          <div className="mt-4">
            <StateSwitcher activeState={activeState} />
          </div>
        </header>

        <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-zinc-200 bg-zinc-950 p-2 shadow-xl">
          <div className="min-h-[720px] overflow-hidden rounded-[1.5rem] bg-white">
            <ProfileHeader profile={profile} onAction={handleAction} />
            <Tabs profile={profile} />

            <div className="mt-5 grid gap-5 pb-2">
              {profile.constructionState.visible ? (
                <section className="mx-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-base font-semibold text-zinc-950">{profile.constructionState.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{profile.constructionState.description}</p>
                  {profile.constructionState.recommendedActionLabel ? (
                    <span className="mt-3 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">
                      {profile.constructionState.recommendedActionLabel}
                    </span>
                  ) : null}
                </section>
              ) : null}

              {profile.sections.map((section) => (
                <ProfileSection key={section.id} section={section} />
              ))}

              <MediaKitBridge profile={profile} onOpen={() => setMediaKitModalOpen(true)} />

              {profile.communityBridge.visible ? (
                <section className="mx-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-base font-semibold text-zinc-950">{profile.communityBridge.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{profile.communityBridge.description}</p>
                </section>
              ) : null}
            </div>

            <BottomNav profile={profile} />
          </div>
        </div>
      </div>
      <MobileStrategicProfileMediaKitModal
        profile={profile}
        open={mediaKitModalOpen}
        onClose={() => setMediaKitModalOpen(false)}
      />
    </main>
  );
}
