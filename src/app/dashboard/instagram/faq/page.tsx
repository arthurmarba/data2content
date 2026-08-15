"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ProfileSettingsPage } from "@/app/dashboard/boards/components/videoUpload/appPreview/ProfileSettingsPage";

export default function InstagramFacebookFAQPage() {
  const router = useRouter();

  return (
    <ProfileSettingsPage title="Ajuda do Instagram" onBack={() => router.back()} backLabel="Voltar">
      <section className="ds-notebook-section ds-notebook-section--first" id="ajuda">
        <p className="ds-notebook-label">Conexão com a Meta</p>
        <h2 className="mt-2 max-w-[18ch] font-display text-[1.8rem] font-bold leading-[1.02] tracking-[-0.04em] text-[var(--ds-color-ink)]">Facebook e Instagram</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ds-color-text-secondary)]">
          Respostas e passos para resolver os problemas mais comuns ao conectar seu Instagram via Facebook.
        </p>
      </section>

      {/* Sumário de navegação */}
      <nav className="ds-notebook-section">
        <p className="ds-notebook-label">Nesta página</p>
        <ul className="mt-3 space-y-2 text-sm text-[var(--ds-color-brand-strong)]">
          <li><a className="underline underline-offset-2" href="#permissoes">Permissões (o que e por quê)</a></li>
          <li><a className="underline underline-offset-2" href="#ig-profissional">IG Profissional/Creator</a></li>
          <li><a className="underline underline-offset-2" href="#criar-pagina">Criar Página no Facebook</a></li>
          <li><a className="underline underline-offset-2" href="#vincular-ig-pagina">Vincular Instagram à Página</a></li>
          <li><a className="underline underline-offset-2" href="#erros-permissoes">Erros de permissão</a></li>
          <li><a className="underline underline-offset-2" href="#token-expirado">Token expirado ou inválido</a></li>
          <li><a className="underline underline-offset-2" href="#conta-vinculada">Conta já vinculada</a></li>
          <li><a className="underline underline-offset-2" href="#conta-restrita">Conta temporariamente restringida</a></li>
          <li><a className="underline underline-offset-2" href="#quanto-tempo">Quanto tempo leva?</a></li>
          <li><a className="underline underline-offset-2" href="#acesso">O que o D2C acessa?</a></li>
          <li><a className="underline underline-offset-2" href="#revogar">Como revogar?</a></li>
        </ul>
      </nav>

      <section className="space-y-3 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-[-0.025em] [&_h2]:text-[var(--ds-color-ink)] [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-[var(--ds-color-text-secondary)] [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-[var(--ds-color-text-secondary)]">
        <div className="ds-notebook-section scroll-mt-20" id="permissoes">
          <h2>1) Que permissões o D2C pede e por quê?</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><b>pages_show_list</b>: localizar suas Páginas do Facebook e a conta Instagram Profissional/Creator conectada.</li>
            <li><b>instagram_basic</b> e <b>instagram_manage_insights</b>: ler posts públicos e métricas (somente leitura).</li>
            <li><b>business_management</b>: quando necessário, listar ativos do Business Manager para encontrar sua conta.</li>
          </ul>
          <p className="mt-3">Não publicamos em seu nome. O acesso é apenas de leitura.</p>
        </div>

        <div className="ds-notebook-section scroll-mt-20" id="ig-profissional">
          <h2>2) Minha conta Instagram precisa ser Profissional/Creator?</h2>
          <p className="mt-3">
            Sim. Para ler métricas, o Instagram exige conta Profissional (Business/Creator) conectada a uma Página do Facebook.
            No app do Instagram: Configurações → Conta → Mudar para conta profissional.
          </p>
          <p className="mt-2 !text-xs">Ajuda oficial: procure por &quot;Mudar para conta profissional Instagram&quot; no centro de ajuda do Instagram.</p>
        </div>

        <div className="ds-notebook-section scroll-mt-20" id="criar-pagina">
          <h2>2.1) Como criar uma Página no Facebook</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Acesse o Facebook no navegador (conta que você usa para trabalho).</li>
            <li>Abra o menu e selecione “Páginas” → “Criar nova Página”.</li>
            <li>Defina nome, categoria e finalize a criação.</li>
          </ol>
          <p className="mt-2 !text-xs">Dica: você precisa ser administrador dessa Página para conectá-la ao Instagram.</p>
        </div>

        <div className="ds-notebook-section scroll-mt-20" id="vincular-ig-pagina">
          <h2>2.2) Vincular seu Instagram à Página do Facebook</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>No app do Instagram: Configurações → Conta → Compartilhar em outros apps → Facebook → Conectar e escolha a Página.</li>
            <li>Ou no Facebook: Configurações da Página → Instagram → Conectar conta e siga o passo a passo.</li>
            <li>Depois volte ao D2C e refaça a conexão.</li>
          </ul>
        </div>

        <div className="ds-notebook-section scroll-mt-20" id="nao-encontro">
          <h2>3) Não encontro minha conta após conectar</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Confirme que seu IG é Profissional/Creator e está vinculado a uma Página do Facebook.</li>
            <li>Faça login no Facebook com o usuário que administra essa Página.</li>
            <li>Revise permissões no Facebook e garanta que todas foram aprovadas.</li>
            <li>Se usa Business Manager, confirme acesso a ativos (Página/IG) com a mesma conta.</li>
          </ul>
        </div>

        <div className="ds-notebook-section scroll-mt-20" id="erros-permissoes">
          <h2>4) Erros de permissão e outros</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <b>Permissão negada</b> (ex.: códigos #10, #200):
              Refaça a conexão e aceite todas as permissões solicitadas. Se usar Business Manager, verifique que sua conta tem permissão para acessar a Página/IG.
            </li>
            <li>
              <b id="token-expirado">Token expirado/Inválido</b>: refaça a conexão a partir do D2C (Dashboard → Conectar Instagram). Evite recarregar a tela do Facebook durante o login.
            </li>
            <li>
              <b id="conta-vinculada">Conta já vinculada</b>: a mesma conta do Facebook/IG já foi conectada a outro usuário no D2C. Desvincule lá ou contate o suporte para migrar.
            </li>
            <li>
              <b id="conta-restrita">Conta temporariamente restringida</b>: quando a Meta exibe mensagens como “Sua conta foi restringida”, a ação fica bloqueada por segurança do próprio Instagram/Facebook.
              Conclua as verificações de segurança no app oficial, aguarde o prazo da restrição e tente novamente depois.
            </li>
            <li>
              <b>Sem contas encontradas</b>: confirme que o IG é Profissional/Creator e está associado a uma Página que você administra.
            </li>
          </ul>
        </div>

        <div className="ds-notebook-section scroll-mt-20" id="revogar">
          <h2>5) Como revogar e reconectar</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>No Facebook, acesse Configurações → Apps e Sites e remova o D2C.</li>
            <li>Volte ao D2C: Dashboard → Conectar Instagram, e faça a conexão novamente.</li>
          </ol>
        </div>

        <div className="ds-notebook-section scroll-mt-20" id="boas-praticas">
          <h2>6) Boas práticas</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Não atualize a página do Facebook durante o login.</li>
            <li>Use sempre a conta do Facebook que administra a Página vinculada ao IG.</li>
            <li>Se aparecer uma lista de contas IG, escolha a correta (aquela usada para trabalho).</li>
          </ul>
        </div>

        <div className="ds-notebook-section scroll-mt-20" id="quanto-tempo">
          <h2>7) Quanto tempo leva?</h2>
          <p className="mt-3">A autorização leva menos de 2 minutos. A primeira sincronização costuma concluir em até 30–60 segundos.</p>
        </div>

        <div className="ds-notebook-section scroll-mt-20" id="acesso">
          <h2>8) O que o D2C acessa exatamente?</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Posts e métricas públicas para gerar relatórios e o seu Mídia Kit.</li>
            <li>Nunca acessamos mensagens ou conteúdo privado.</li>
            <li>Nunca publicamos em seu nome.</li>
          </ul>
        </div>

        <div className="grid gap-2 pt-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/instagram/connect")}
            className="ds-button ds-button--primary ds-button--block"
          >
            Conectar agora
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="ds-button ds-button--secondary ds-button--block"
          >
            Voltar
          </button>
        </div>
      </section>
    </ProfileSettingsPage>
  );
}
