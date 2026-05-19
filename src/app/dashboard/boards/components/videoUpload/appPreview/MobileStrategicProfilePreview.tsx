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
import { MobileStrategicProfileAnalyzeFlow } from "./MobileStrategicProfileAnalyzeFlow";
import { MobileStrategicProfileMediaKitModal } from "./MobileStrategicProfileMediaKitModal";

type MobileStrategicProfilePreviewProps = {
  profile: MobileStrategicProfile;
  activeState?: MobileStrategicProfilePreviewFixtureState;
  isRealShell?: boolean;
};

const CARD_TONE: Record<MobileStrategicProfileSectionCard["tone"], string> = {
  neutral: "border-zinc-200 bg-white",
  diagnosis: "border-sky-100 bg-sky-50/80",
  commercial: "border-emerald-100 bg-emerald-50/80",
  action: "border-zinc-200 bg-zinc-50",
  locked: "border-amber-100 bg-amber-50/80",
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

function isAnalyzeAction(action: MobileStrategicProfileAction): boolean {
  return action.intent === "analyze_video";
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
  fullWidth = false,
}: {
  action: MobileStrategicProfileAction;
  onAction?: (action: MobileStrategicProfileAction) => void;
  fullWidth?: boolean;
}) {
  const baseClass = fullWidth ? "w-full justify-center" : "";

  return (
    <button
      type="button"
      disabled={action.disabled}
      onClick={() => onAction?.(action)}
      className={
        action.priority === "primary"
          ? `${baseClass} inline-flex min-h-[42px] items-center rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-zinc-950/15 disabled:bg-zinc-300`
          : `${baseClass} inline-flex min-h-[42px] items-center rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:text-zinc-400`
      }
    >
      {action.label}
    </button>
  );
}

function AuthGate({ profile, isRealShell }: { profile: MobileStrategicProfile; isRealShell?: boolean }) {
  const gate = profile.authGate;

  return (
    <section className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950">
      <div className="mx-auto grid max-w-5xl gap-5">
        {!isRealShell ? (
          <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno — Perfil Estratégico</p>
            <h1 className="mt-2 text-2xl font-semibold">Perfil Estratégico mobile</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Seu Perfil Estratégico mostra o que a D2C já entendeu sobre sua narrativa e o próximo passo mais importante.
            </p>
          </header>
        ) : null}

        <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-zinc-200 bg-zinc-950 p-2 shadow-xl">
          <div className="min-h-[680px] rounded-[1.5rem] bg-[#f7f7f4] px-5 py-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-950">Perfil Estratégico</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm">D2C</span>
            </div>
            <div className="mt-20 grid place-items-center rounded-[1.75rem] bg-white p-6 text-center shadow-sm">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-zinc-950 text-2xl font-semibold text-white shadow-lg shadow-zinc-950/20">
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
  onAnalyze,
}: {
  profile: MobileStrategicProfile;
  onAction: (action: MobileStrategicProfileAction) => void;
  onAnalyze: () => void;
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
          <p className="text-xs font-medium text-zinc-500">Diagnóstico vivo do creator</p>
        </div>
        <button
          type="button"
          aria-label="Analisar vídeo"
          className="grid h-10 w-10 place-items-center rounded-full bg-zinc-950 text-xl font-semibold text-white shadow-lg shadow-zinc-950/20"
          onClick={onAnalyze}
        >
          +
        </button>
      </div>

      <div className="mt-5 rounded-[1.75rem] bg-[#f7f7f4] p-4">
        <div className="flex items-start gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-zinc-950 text-xl font-semibold text-white shadow-lg shadow-zinc-950/15">
            {identity.userImage ? <span>{initials}</span> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-zinc-950">{identity.displayName}</h2>
            {identity.displayHandle ? <p className="mt-0.5 text-sm text-zinc-500">{identity.displayHandle}</p> : null}
            {identity.bio ? <p className="mt-2 text-sm leading-6 text-zinc-700">{identity.bio}</p> : null}
          </div>
        </div>

        <p className="mt-4 rounded-2xl bg-white px-3 py-2 text-sm leading-6 text-zinc-700 shadow-sm">
          Cada vídeo analisado ajuda a atualizar seu diagnóstico como creator. Use o botão + para trazer uma nova leitura.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {profile.header.statusPills.slice(0, 4).map((pill) => (
          <span key={pill.id} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm">
            {pill.label}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        {profile.primaryActions.slice(0, 2).map((action, index) => (
          <ActionButton key={action.id} action={action} onAction={onAction} fullWidth={index === 0} />
        ))}
      </div>
    </header>
  );
}

function Tabs({
  profile,
  activeTab,
  onChange,
}: {
  profile: MobileStrategicProfile;
  activeTab: "diagnosis" | "commercial";
  onChange: (tab: "diagnosis" | "commercial") => void;
}) {
  return (
    <div className="mx-5 mt-5 grid grid-cols-2 rounded-full bg-zinc-100 p-1" role="tablist" aria-label="Abas internas do Perfil">
      {profile.tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={
            activeTab === tab.id
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
    <article className={`rounded-[1.25rem] border p-4 ${CARD_TONE[card.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-950">{card.title}</h4>
        {card.locked ? <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-zinc-500">Bloqueado</span> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{card.body}</p>
    </article>
  );
}

function ProfileSection({ section }: { section: MobileStrategicProfileSection }) {
  const visibleCards = section.cards.slice(0, section.id === "diagnosis" ? 3 : 4);

  return (
    <section className="px-5" aria-label={section.title}>
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
        {visibleCards.map((card) => (
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
    <section className="mx-5 rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">{bridge.title}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{bridge.description}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {bridge.state === "available" ? "Mídia Kit ativo" : "Instagram"}
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
          className="mt-4 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800"
          onClick={onOpen}
        >
          Ativar Mídia Kit
        </button>
      ) : null}
    </section>
  );
}

function BottomNav({
  profile,
  onAnalyze,
}: {
  profile: MobileStrategicProfile;
  onAnalyze: () => void;
}) {
  return (
    <nav className="sticky bottom-0 mt-6 grid grid-cols-3 items-center border-t border-zinc-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur" aria-label="Navegação mobile futura">
      {profile.navigation.items.map((item) =>
        item.role === "central_action" ? (
          <button
            key={item.id}
            type="button"
            aria-label="Analisar vídeo pela ação central"
            className="mx-auto -mt-7 grid h-14 w-14 place-items-center rounded-full border-4 border-white bg-zinc-950 text-xl font-semibold text-white shadow-xl shadow-zinc-950/25"
            onClick={onAnalyze}
          >
            {item.label}
          </button>
        ) : (
          <a
            key={item.id}
            href={item.href ?? "#"}
            className={item.active ? "text-center text-xs font-semibold text-zinc-950" : "text-center text-xs font-semibold text-zinc-500"}
          >
            {item.label}
          </a>
        ),
      )}
    </nav>
  );
}

export function MobileStrategicProfilePreview({
  profile,
  activeState,
  isRealShell,
}: MobileStrategicProfilePreviewProps) {
  const [mediaKitModalOpen, setMediaKitModalOpen] = useState(false);
  const [analyzeFlowOpen, setAnalyzeFlowOpen] = useState(false);
  const [profileUpdated, setProfileUpdated] = useState(false);
  const [activeTab, setActiveTab] = useState<"diagnosis" | "commercial">("diagnosis");

  if (profile.authGate.visible) return <AuthGate profile={profile} isRealShell={isRealShell} />;

  const handleAction = (action: MobileStrategicProfileAction) => {
    if (isMediaKitAction(action)) {
      setMediaKitModalOpen(true);
      return;
    }

    if (isAnalyzeAction(action)) {
      setAnalyzeFlowOpen(true);
    }
  };

  const handleAnalyzeComplete = () => {
    setAnalyzeFlowOpen(false);
    setProfileUpdated(true);
    setActiveTab("diagnosis");
  };

  const activeSection = profile.sections.find((section) => section.id === activeTab);

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950">
      <div className="mx-auto grid max-w-5xl gap-5">
        {!isRealShell ? (
          <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno — Perfil Estratégico</p>
            <h1 className="mt-2 text-2xl font-semibold">Perfil Estratégico mobile</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Seu Perfil Estratégico mostra sua leitura atual, seus próximos passos e seu potencial comercial.
            </p>
            <div className="mt-4">
              <StateSwitcher activeState={activeState} />
            </div>
          </header>
        ) : null}

        <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-zinc-200 bg-zinc-950 p-2 shadow-xl">
          <div className="relative min-h-[720px] overflow-hidden rounded-[1.5rem] bg-white">
            <ProfileHeader profile={profile} onAction={handleAction} onAnalyze={() => setAnalyzeFlowOpen(true)} />
            <Tabs profile={profile} activeTab={activeTab} onChange={setActiveTab} />

            <div className="mt-5 grid gap-5 pb-2">
              {profileUpdated ? (
                <section className="mx-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-zinc-950">Diagnóstico atualizado</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">Seu Perfil foi atualizado nesta simulação.</p>
                </section>
              ) : null}

              {profile.constructionState.visible ? (
                <section className="mx-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-base font-semibold text-zinc-950">{profile.constructionState.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{profile.constructionState.description}</p>
                  {profile.constructionState.recommendedActionLabel ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
                      onClick={() => setAnalyzeFlowOpen(true)}
                    >
                      {profile.constructionState.recommendedActionLabel}
                    </button>
                  ) : null}
                </section>
              ) : null}

              {activeSection ? <ProfileSection section={activeSection} /> : null}

              <MediaKitBridge profile={profile} onOpen={() => setMediaKitModalOpen(true)} />

              {profile.communityBridge.visible ? (
                <section className="mx-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-base font-semibold text-zinc-950">{profile.communityBridge.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{profile.communityBridge.description}</p>
                </section>
              ) : null}
            </div>

            <BottomNav profile={profile} onAnalyze={() => setAnalyzeFlowOpen(true)} />
            <MobileStrategicProfileAnalyzeFlow
              open={analyzeFlowOpen}
              onClose={() => setAnalyzeFlowOpen(false)}
              onComplete={handleAnalyzeComplete}
            />
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
