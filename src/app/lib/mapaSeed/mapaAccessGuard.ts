// src/app/lib/mapaSeed/mapaAccessGuard.ts
// Regras de acesso centralizadas para as features do mapa narrativo.
//
// Hierarquia:
//   Gratuito → mapa seed visível + 1 análise de vídeo (free trial)
//   Pro       → pautas, análises adicionais, botão de consultoria

import { isActiveLike } from "@/app/lib/planGuard";
import type { IMapaSeed } from "@/app/models/MapaSeed";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface MapaAccessContext {
  planStatus: unknown;
  mapaDoc: IMapaSeed | null;
  freeTrialUsado: boolean;
}

export interface MapaAccessResult {
  /** Usuário tem plano Pro ativo */
  isPro: boolean;
  /** Pode ver o mapa seed (sempre true se mapa existir) */
  podeVerMapa: boolean;
  /** Pode fazer análise de vídeo (free trial disponível ou é Pro) */
  podeAnalisarVideo: boolean;
  /** Pode ver pautas completas (Pro only) */
  podeVerPautas: boolean;
  /** Botão de consultoria deve aparecer na UI */
  mostrarConsultoria: boolean;
  /** Botão de consultoria está desbloqueado */
  consultoriaDesbloqueada: boolean;
  /** Paywall deve ser apresentado agora */
  mostrarPaywall: boolean;
  /** Motivo do paywall (para copy da UI) */
  paywallMotivo: PaywallMotivo | null;
}

export type PaywallMotivo =
  | "sem_mapa"           // nunca deve mostrar paywall sem mapa
  | "free_trial_usado"   // usou o teste, quer mais análises
  | "pautas_bloqueadas"; // quer ver pautas mas não é Pro

// ─── Guard principal ──────────────────────────────────────────────────────────

/**
 * Avalia o acesso do usuário às features do mapa narrativo.
 *
 * Regras:
 * - Paywall só aparece depois de uma leitura ter sido entregue
 * - Consultoria só aparece se mapa seed existir
 * - Pautas são Pro only
 * - 1 análise de vídeo gratuita por usuário
 */
export function evaluateMapaAccess(ctx: MapaAccessContext): MapaAccessResult {
  const { planStatus, mapaDoc, freeTrialUsado } = ctx;

  const isPro = isActiveLike(planStatus);
  const temMapa = mapaDoc !== null;

  // ── Acesso ao mapa seed ────────────────────────────────────────────────────
  const podeVerMapa = temMapa;

  // ── Análise de vídeo ───────────────────────────────────────────────────────
  // Free: 1 análise gratuita (enquanto free trial não foi usado)
  // Pro: análises ilimitadas
  const podeAnalisarVideo = isPro || !freeTrialUsado;

  // ── Pautas ────────────────────────────────────────────────────────────────
  const podeVerPautas = isPro;

  // ── Consultoria / WhatsApp ────────────────────────────────────────────────
  // Botão aparece APENAS se o mapa seed existir (não no perfil vazio)
  // Desbloqueado apenas para Pro
  const mostrarConsultoria = temMapa;
  const consultoriaDesbloqueada = isPro && temMapa;

  // ── Paywall ───────────────────────────────────────────────────────────────
  // Só mostra se o criador já recebeu pelo menos uma leitura (temMapa)
  // Nunca mostra sem prova de valor
  let mostrarPaywall = false;
  let paywallMotivo: PaywallMotivo | null = null;

  if (!isPro && temMapa) {
    if (freeTrialUsado) {
      mostrarPaywall = true;
      paywallMotivo = "free_trial_usado";
    }
    // Paywall de pautas é acionado no momento em que o criador tenta ver pautas
    // (não proativamente aqui — evita empurrar o paywall antes da hora)
  }

  return {
    isPro,
    podeVerMapa,
    podeAnalisarVideo,
    podeVerPautas,
    mostrarConsultoria,
    consultoriaDesbloqueada,
    mostrarPaywall,
    paywallMotivo,
  };
}

// ─── Helper para rotas de API ─────────────────────────────────────────────────

/**
 * Retorna resposta 403 padronizada quando o criador tenta acessar
 * uma feature Pro sem assinatura.
 */
export function buildPaywallResponse(motivo: PaywallMotivo) {
  const mensagens: Record<PaywallMotivo, string> = {
    sem_mapa:          "Complete o onboarding para desbloquear este recurso.",
    free_trial_usado:  "Você já usou sua análise gratuita. Assine para continuar.",
    pautas_bloqueadas: "Pautas completas estão disponíveis no plano Pro.",
  };

  return {
    paywallAtivo: true,
    motivo,
    mensagem: mensagens[motivo],
  };
}
