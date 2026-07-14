"use client";

import { useState } from "react";
import { ArrowRight, Check, Heart, Settings, Upload } from "lucide-react";
import {
  AppHeader,
  Badge,
  BottomSheet,
  Button,
  IconButton,
  ScreenTitle,
  SectionTitle,
  Surface,
  TextArea,
} from "@/design-system";
import { MobileStrategicProfileAnalyzeFlow } from "@/app/dashboard/boards/components/videoUpload/appPreview/MobileStrategicProfileAnalyzeFlow";

const SWATCHES = [
  ["Marca", "var(--ds-color-brand)"],
  ["Mapa", "var(--ds-color-map)"],
  ["Tinta", "var(--ds-color-ink)"],
  ["Papel", "var(--ds-color-paper)"],
  ["Neutro", "var(--ds-color-neutral)"],
  ["Sucesso", "var(--ds-color-success)"],
] as const;

export function DesignSystemCatalog() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  return (
    <main className="d2c-mobile-app ds-screen min-h-screen pb-16">
      <AppHeader title="Creator Studio" action={<IconButton label="Configurações"><Settings size={18} /></IconButton>} />

      <div className="mx-auto grid w-full max-w-3xl gap-12 px-5 py-10">
        <section>
          <p className="ds-eyebrow">Design system</p>
          <ScreenTitle className="mt-3">Uma linguagem humana para criar e decidir.</ScreenTitle>
          <p className="ds-body mt-4 max-w-xl">Bricolage orienta. Instrument Sans sustenta o trabalho. Rosa é ação; cor semântica explica estado.</p>
        </section>

        <section>
          <SectionTitle>Cores</SectionTitle>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SWATCHES.map(([label, value]) => (
              <div key={label} className="flex items-center gap-3 border-b py-3">
                <span className="h-10 w-10 rounded-full border" style={{ background: value }} />
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>Ações</SectionTitle>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button>Continuar <ArrowRight size={17} /></Button>
            <Button variant="secondary">Ver resultado</Button>
            <Button variant="quiet">Agora não</Button>
            <Button variant="ghost">Saber mais</Button>
            <Button variant="danger">Remover</Button>
            <IconButton label="Favoritar"><Heart size={18} /></IconButton>
          </div>
        </section>

        <section>
          <SectionTitle>Estados</SectionTitle>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge>Creator Studio</Badge>
            <Badge tone="neutral">Rascunho</Badge>
            <Badge tone="success">Confirmado</Badge>
            <Badge tone="warning">Revisar</Badge>
            <Badge tone="danger">Falhou</Badge>
          </div>
        </section>

        <section>
          <SectionTitle>Superfícies</SectionTitle>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Surface className="p-5">
              <p className="ds-eyebrow">Plano</p>
              <h3 className="mt-2 text-xl font-bold">Superfície plana</h3>
              <p className="ds-body mt-2">Use quando a borda já comunica agrupamento.</p>
            </Surface>
            <Surface raised className="p-5">
              <p className="ds-eyebrow">Interação</p>
              <h3 className="mt-2 text-xl font-bold">Superfície elevada</h3>
              <p className="ds-body mt-2">Reservada para algo que abre, move ou responde.</p>
            </Surface>
          </div>
        </section>

        <section>
          <SectionTitle>Espaço editorial do Perfil</SectionTitle>
          <div className="ds-editorial-panel mt-5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="ds-eyebrow">Seu Mapa</p>
                <h3 className="ds-editorial-heading mt-2">O território que você já ocupa</h3>
              </div>
              <button type="button" className="ds-inline-action">Aprimorar</button>
            </div>
            <div className="ds-editorial-section mt-5">
              <p className="ds-eyebrow">Assuntos recorrentes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="ds-chip ds-chip--active">Bastidores</span>
                <span className="ds-chip">Criatividade</span>
                <span className="ds-chip">Rotina real</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle>Entrada de vídeo</SectionTitle>
          <label className="ds-upload-dropzone mt-5 block cursor-pointer">
            <span className="ds-upload-dropzone__icon"><Upload size={22} /></span>
            <span className="mt-4 block font-display text-xl font-bold tracking-[-0.035em]">Escolher vídeo</span>
            <span className="ds-body mt-2 block">MP4, MOV ou WebM. Seu arquivo é usado somente durante a leitura.</span>
          </label>
          <Button className="mt-4" onClick={() => setScanOpen(true)}>Testar Raio X</Button>
        </section>

        <section>
          <SectionTitle>Decisão de assinatura</SectionTitle>
          <div className="ds-paywall mt-5 max-h-none p-5">
            <p className="ds-eyebrow">Data2Content Pro</p>
            <h3 className="ds-editorial-heading mt-2">Continue usando seu mapa para decidir melhor.</h3>
            <div className="ds-paywall__toggle mt-5" aria-label="Período de exemplo">
              <button type="button" className="ds-paywall__toggle-option" aria-pressed="true">Anual</button>
              <button type="button" className="ds-paywall__toggle-option" aria-pressed="false">Mensal</button>
            </div>
            <div className="mt-5 divide-y divide-[var(--ds-color-line)] border-y border-[var(--ds-color-line)]">
              {["Leituras de vídeo sem limite", "Mapa atualizado com seus conteúdos", "Decisões de pauta e marca em um só lugar"].map((benefit) => (
                <p key={benefit} className="flex gap-3 py-3 text-sm font-semibold">
                  <Check size={17} className="shrink-0 text-[var(--ds-color-brand)]" /> {benefit}
                </p>
              ))}
            </div>
            <Button block className="mt-5">Continuar com Pro</Button>
          </div>
        </section>

        <section>
          <SectionTitle>Campo e sheet</SectionTitle>
          <TextArea className="mt-5" rows={4} placeholder="Escreva com suas palavras…" />
          <Button className="mt-4" onClick={() => setSheetOpen(true)}>Abrir sheet</Button>
        </section>
      </div>

      <BottomSheet open={sheetOpen} title="Pauta para gravar" onClose={() => setSheetOpen(false)}>
        <div className="px-5 pb-[calc(var(--ds-safe-bottom)+1.5rem)]">
          <p className="ds-body">A mesma estrutura atende conta, WhatsApp, pautas, calculadora e detalhes rápidos.</p>
          <Button block className="mt-5" onClick={() => setSheetOpen(false)}>Entendi</Button>
        </div>
      </BottomSheet>
      <MobileStrategicProfileAnalyzeFlow
        open={scanOpen}
        enableRealAnalysis
        onClose={() => setScanOpen(false)}
        onComplete={() => setScanOpen(false)}
        onCreateUploadSession={async () => ({
          ok: true,
          status: "signed_upload_session_created",
          uploadSession: {
            id: "design-system-scan-preview",
            providerMode: "debug",
            storageProvider: "debug",
            uploadUrl: "https://debug.invalid/upload",
            method: "PUT",
            headers: {},
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            retentionTtlMinutes: 1,
            objectKey: "debug/content-scan-preview.mp4",
            shouldDeleteAfterAnalysis: true,
            shouldPersistVideo: false,
            shouldPersistThumbnail: false,
          },
        })}
        onUploadToTemporarySignedUrl={async ({ file }) => ({
          ok: true,
          status: "uploaded",
          uploadedAt: new Date().toISOString(),
          bytesSent: file.size,
        })}
        onSubmitAnalysis={async () => ({
          savedDiagnosisId: "design-system-scan-preview",
          confirmationData: {
            diagnosisSummary: "A estrutura já sustenta a ideia; a abertura pode ficar mais legível sem som.",
            directAnswer: "Vale testar depois de tornar a promessa visível na primeira cena.",
            coherenceVerdict: "confirms_top_pattern",
            coherenceReasoning: "O tema confirma seu território de bastidores aplicáveis.",
            audienceCoherence: { verdict: "aligned", reading: "Entrega uma conclusão útil para quem já acompanha seu processo." },
            brandCoherence: { verdict: "aligned", reading: "Mantém um território comercial coerente sem depender de produto." },
            contentPotentialScan: {
              band: "promising_with_adjustment",
              confidence: "medium",
              basis: "video_only",
              objective: "complete_reading",
              historyPostsAnalyzed: 0,
              dimensions: {
                openingClarity: { status: "mixed", evidence: "O tema aparece, mas depende do áudio.", adjustment: "Escrever o gancho na tela.", window: "0-3s" },
                attentionArchitecture: { status: "strong", evidence: "Há progressão e uma virada visual nos primeiros 10 segundos.", adjustment: null, window: "0-10s" },
                shareImpulse: { status: "mixed", evidence: "A utilidade está implícita.", adjustment: "Fechar com uma síntese encaminhável.", window: "full_video" },
                promiseDelivery: { status: "strong", evidence: "O final cumpre a promessa inicial.", adjustment: null, window: "full_video" },
                narrativeFit: { status: "strong", evidence: "O conteúdo conversa com o mapa atual.", adjustment: null, window: "creator_history" },
              },
              watchedMoments: [
                {
                  moment: "opening",
                  observation: "Você abre dizendo que uma boa ideia ainda pode travar antes de virar pauta.",
                  impact: "A tensão é clara no áudio, mas ainda depende do som para ser entendida.",
                },
                {
                  moment: "development",
                  observation: "No segundo enquadramento, você mostra a ideia sendo organizada em três blocos.",
                  impact: "A mudança visual comprova que o vídeo avança para uma solução prática.",
                },
                {
                  moment: "closing",
                  observation: "O vídeo termina com a pauta pronta na tela, enquanto a fala resume o processo.",
                  impact: "A promessa é entregue, mas a frase final ainda pode ser mais fácil de compartilhar.",
                },
              ],
              practicalDirection: {
                title: "Leve a tensão para o primeiro frame",
                action: "Mantenha a abertura falada e escreva a dúvida central na tela já na primeira cena.",
                example: "Sua ideia trava antes de virar pauta?",
              },
              highestImpactAdjustment: "Escrever a promessa principal na primeira cena.",
              disclaimer: "Leitura estrutural do vídeo — não é garantia de alcance.",
            },
          },
        })}
      />
    </main>
  );
}
