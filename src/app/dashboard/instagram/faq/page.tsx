"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function InstagramFacebookFAQPage() {
  const router = useRouter();

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900" id="ajuda">Ajuda: Conexão com Facebook/Instagram</h1>
      <p className="text-gray-600 mt-2">
        Aqui estão respostas e passos para resolver os problemas mais comuns ao conectar seu Instagram via Facebook.
      </p>

      {/* Sumário de navegação */}
      <nav className="mt-4 p-3 border border-gray-200 rounded bg-white">
        <p className="text-sm font-medium text-gray-900">Sumário</p>
        <ul className="list-disc pl-5 text-sm text-blue-700 mt-2 space-y-1">
          <li><a className="underline hover:text-blue-800" href="#permissoes">Permissões (o que e por quê)</a></li>
          <li><a className="underline hover:text-blue-800" href="#ig-profissional">IG Profissional/Creator</a></li>
          <li><a className="underline hover:text-blue-800" href="#criar-pagina">Criar Página no Facebook</a></li>
          <li><a className="underline hover:text-blue-800" href="#vincular-ig-pagina">Vincular Instagram à Página</a></li>
          <li><a className="underline hover:text-blue-800" href="#erros-permissoes">Erros #10/#200 (Permissão negada)</a></li>
          <li><a className="underline hover:text-blue-800" href="#token-expirado">Token expirado/inválido</a></li>
          <li><a className="underline hover:text-blue-800" href="#conta-vinculada">Conta já vinculada</a></li>
          <li><a className="underline hover:text-blue-800" href="#quanto-tempo">Quanto tempo leva?</a></li>
          <li><a className="underline hover:text-blue-800" href="#acesso">O que o D2C acessa exatamente?</a></li>
          <li><a className="underline hover:text-blue-800" href="#revogar">Posso revogar depois?</a></li>
        </ul>
      </nav>

      <section className="mt-6 space-y-6">
        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="permissoes">
          <h2 className="text-lg font-medium text-gray-900">1) Que permissões o D2C pede e por quê?</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
            <li><b>pages_show_list</b>: localizar suas Páginas do Facebook e a conta Instagram Profissional/Creator conectada.</li>
            <li><b>instagram_basic</b> e <b>instagram_manage_insights</b>: ler posts públicos e métricas (somente leitura).</li>
            <li><b>business_management</b>: quando necessário, listar ativos do Business Manager para encontrar sua conta.</li>
          </ul>
          <p className="text-sm text-gray-600 mt-2">Não publicamos em seu nome. Acesso é apenas de leitura.</p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="ig-profissional">
          <h2 className="text-lg font-medium text-gray-900">2) Minha conta Instagram precisa ser Profissional/Creator?</h2>
          <p className="text-sm text-gray-700 mt-2">
            Sim. Para ler métricas, o Instagram exige conta Profissional (Business/Creator) conectada a uma Página do Facebook.
            No app do Instagram: Configurações → Conta → Mudar para conta profissional.
          </p>
          <p className="text-xs text-gray-500 mt-2">Ajuda oficial: procure por &quot;Mudar para conta profissional Instagram&quot; no centro de ajuda do Instagram.</p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="criar-pagina">
          <h2 className="text-lg font-medium text-gray-900">2.1) Como criar uma Página no Facebook</h2>
          <ol className="list-decimal pl-5 text-sm text-gray-700 mt-2 space-y-1">
            <li>Acesse o Facebook no navegador (conta que você usa para trabalho).</li>
            <li>Abra o menu e selecione “Páginas” → “Criar nova Página”.</li>
            <li>Defina nome, categoria e finalize a criação.</li>
          </ol>
          <p className="text-xs text-gray-500 mt-2">Dica: você precisa ser administrador dessa Página para conectá-la ao Instagram.</p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="vincular-ig-pagina">
          <h2 className="text-lg font-medium text-gray-900">2.2) Vincular seu Instagram à Página do Facebook</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
            <li>No app do Instagram: Configurações → Conta → Compartilhar em outros apps → Facebook → Conectar e escolha a Página.</li>
            <li>Ou no Facebook: Configurações da Página → Instagram → Conectar conta e siga o passo a passo.</li>
            <li>Depois volte ao D2C e refaça a conexão.</li>
          </ul>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="nao-encontro">
          <h2 className="text-lg font-medium text-gray-900">3) Não encontro minha conta após conectar</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
            <li>Confirme que seu IG é Profissional/Creator e está vinculado a uma Página do Facebook.</li>
            <li>Faça login no Facebook com o usuário que administra essa Página.</li>
            <li>Revise permissões no Facebook e garanta que todas foram aprovadas.</li>
            <li>Se usa Business Manager, confirme acesso a ativos (Página/IG) com a mesma conta.</li>
          </ul>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="erros-permissoes">
          <h2 className="text-lg font-medium text-gray-900">4) Erros #10/#200 (Permissão negada) e outros</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-2">
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
              <b>Sem contas encontradas</b>: confirme que o IG é Profissional/Creator e está associado a uma Página que você administra.
            </li>
          </ul>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="revogar">
          <h2 className="text-lg font-medium text-gray-900">5) Como revogar e reconectar</h2>
          <ol className="list-decimal pl-5 text-sm text-gray-700 mt-2 space-y-1">
            <li>No Facebook, acesse Configurações → Apps e Sites e remova o D2C.</li>
            <li>Volte ao D2C: Dashboard → Conectar Instagram, e faça a conexão novamente.</li>
          </ol>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="boas-praticas">
          <h2 className="text-lg font-medium text-gray-900">6) Boas práticas</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
            <li>Não atualize a página do Facebook durante o login.</li>
            <li>Use sempre a conta do Facebook que administra a Página vinculada ao IG.</li>
            <li>Se aparecer uma lista de contas IG, escolha a correta (aquela usada para trabalho).</li>
          </ul>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="quanto-tempo">
          <h2 className="text-lg font-medium text-gray-900">7) Quanto tempo leva?</h2>
          <p className="text-sm text-gray-700 mt-2">A autorização leva menos de 2 minutos. A primeira sincronização costuma concluir em até 30–60 segundos.</p>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg" id="acesso">
          <h2 className="text-lg font-medium text-gray-900">8) O que o D2C acessa exatamente?</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
            <li>Posts e métricas públicas para gerar relatórios e o seu Mídia Kit.</li>
            <li>Nunca acessamos mensagens ou conteúdo privado.</li>
            <li>Nunca publicamos em seu nome.</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/dashboard/instagram/connect")}
            className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Conectar agora
          </button>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
          >
            Voltar
          </button>
        </div>
      </section>
    </main>
  );
}
