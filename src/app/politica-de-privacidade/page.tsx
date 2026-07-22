import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPolicyPage() {
  return (
    <>
      <Head>
        <title>Política de Privacidade - Data2Content</title>
        <meta name="description" content="Política de Privacidade do Data2Content, detalhando como coletamos, usamos e protegemos seus dados." />
      </Head>
      <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 md:p-12 shadow-lg rounded-2xl">
          <header className="mb-10 text-center">
            <Link href="/" className="inline-flex items-center gap-2 mb-4 font-bold text-3xl text-brand-dark">
              <span className="relative inline-block h-8 w-8 overflow-hidden align-middle">
                <Image
                  src="/images/Colorido-Simbolo.png"
                  alt="Data2Content"
                  fill
                  className="object-contain object-center scale-[2.4]"
                  priority
                />
              </span>
              <span>Data2Content</span>
            </Link>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-dark tracking-tight">
              Política de Privacidade
            </h1>
            <p className="mt-4 text-md text-gray-500">
              <strong>Última Atualização:</strong> 21 de julho de 2026
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-gray-800">

            {/* ── 1. Introdução ─────────────────────────────────────────── */}
            <h2 className="text-2xl font-semibold text-gray-900">1. Introdução</h2>
            <p>
              Bem-vindo(a) ao Data2Content! Esta Política de Privacidade descreve como <strong>Mobi Media Produtores de Conteúdo LTDA</strong> (&quot;Data2Content&quot;, &quot;nós&quot;) coleta, usa, armazena, partilha e protege as suas informações quando você utiliza a nossa plataforma e serviços, incluindo o nosso assistente de IA (o &quot;Serviço&quot;).
            </p>
            <p>
              O nosso compromisso é garantir a transparência e a proteção dos seus dados, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018)</strong> e as Políticas da Meta Platforms, Inc. Ao criar uma conta e utilizar o nosso Serviço, você concorda com a coleta e uso de informações de acordo com esta política e com os nossos{' '}
              <Link href="/termos-e-condicoes" className="text-brand-pink hover:underline">Termos de Serviço</Link>.
            </p>

            {/* ── 2. Quais Dados Coletamos ──────────────────────────────── */}
            <h2 className="text-2xl font-semibold text-gray-900 mt-12">2. Quais Dados Coletamos</h2>
            <p>Para fornecer as funcionalidades do nosso Serviço, coletamos os seguintes tipos de dados:</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6">2.1. Dados via APIs da Meta (com a sua autorização)</h3>
            <p>Quando você conecta a sua conta do Instagram ao Data2Content, solicitamos permissão para coletar:</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li><strong>Perfil Público do Facebook (<code>public_profile</code>):</strong> Identificador, nome e foto pública usados exclusivamente para reconhecer a conta Facebook autorizada e associar com segurança a conexão do Instagram à conta Data2Content já autenticada.</li>
              <li><strong>Lista de Páginas do Facebook (<code>pages_show_list</code>):</strong> Acesso temporário para selecionar a Página vinculada à sua conta profissional do Instagram.</li>
              <li><strong>Informações Básicas da Conta Instagram (<code>instagram_basic</code>):</strong> ID de usuário, @username, foto de perfil, número de seguidores e contagem de mídias.</li>
              <li><strong>Insights do Instagram (<code>instagram_manage_insights</code>):</strong> Métricas de desempenho agregadas (alcance, impressões, curtidas, comentários, salvamentos, visualizações, dados demográficos da audiência). Estes dados são a base para as análises do nosso assistente de IA.</li>
              <li><strong>Gestão de Ativos de Negócios (<code>business_management</code>):</strong> Permissão para facilitar a conexão segura de ativos geridos via Meta Business Manager.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6">2.2. Dados via API do WhatsApp (com a sua autorização)</h3>
            <p>Quando você vincula o seu número de WhatsApp, usamos as permissões <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code> para:</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>Receber o código enviado voluntariamente pelo usuário e confirmar o vínculo do número à conta Data2Content.</li>
              <li>Enviar confirmações, alertas e notificações de serviço após o opt-in, além de processar pedidos de ajuda ou cancelamento de mensagens.</li>
              <li>Gerir a conexão técnica do número comercial, webhooks e modelos de mensagem usados nesses alertas.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6">2.3. Dados Fornecidos Diretamente por Você</h3>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li><strong>Informações de Pagamento e Assinatura:</strong> Dados processados pelo nosso provedor de pagamentos.</li>
              <li><strong>Preferências e Objetivos:</strong> Informações fornecidas voluntariamente para personalizar a sua experiência.</li>
              <li><strong>Consentimento para a Comunidade de Inspiração:</strong> Registramos separadamente o seu opt-in opcional para essa funcionalidade.</li>
            </ul>

            {/* ── 3. Como e Por Que Utilizamos Seus Dados (Bases Legais) ── */}
            <h2 className="text-2xl font-semibold text-gray-900 mt-12">3. Como e Por Que Utilizamos Seus Dados — Bases Legais</h2>
            <p>
              Em conformidade com o Art. 9º, I e o Art. 7º da LGPD, indicamos a seguir a <strong>finalidade</strong>, os <strong>dados envolvidos</strong> e a <strong>base legal</strong> que ampara cada tratamento:
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-2/5">Finalidade</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-2/5">Dados envolvidos</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-1/5">Base legal (Art. 7º LGPD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Fornecer análises personalizadas via IA</td>
                    <td className="border border-gray-300 px-4 py-3">Perfil, posts, legendas, capas de posts e insights do Instagram</td>
                    <td className="border border-gray-300 px-4 py-3">Execução de contrato (inciso V) + Consentimento (inciso I)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Autenticar login e gerenciar conta</td>
                    <td className="border border-gray-300 px-4 py-3">E-mail, nome, foto de perfil</td>
                    <td className="border border-gray-300 px-4 py-3">Execução de contrato (inciso V)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Processar pagamento de assinatura</td>
                    <td className="border border-gray-300 px-4 py-3">Dados de pagamento</td>
                    <td className="border border-gray-300 px-4 py-3">Execução de contrato (inciso V) + Obrigação legal (inciso II)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Comunicação sobre o serviço (alertas, atualizações)</td>
                    <td className="border border-gray-300 px-4 py-3">E-mail, WhatsApp</td>
                    <td className="border border-gray-300 px-4 py-3">Execução de contrato (inciso V)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Comunicação de marketing (com consentimento)</td>
                    <td className="border border-gray-300 px-4 py-3">E-mail</td>
                    <td className="border border-gray-300 px-4 py-3">Consentimento (inciso I)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Melhoria da plataforma (dados agregados e anônimos)</td>
                    <td className="border border-gray-300 px-4 py-3">Métricas de uso agregadas</td>
                    <td className="border border-gray-300 px-4 py-3">Legítimo interesse (inciso IX)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Comunidade de Inspiração (opt-in opcional)</td>
                    <td className="border border-gray-300 px-4 py-3">Posts públicos, classificações, resumo gerado por IA</td>
                    <td className="border border-gray-300 px-4 py-3">Consentimento específico e granular (inciso I)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Cumprimento de obrigações legais e regulatórias</td>
                    <td className="border border-gray-300 px-4 py-3">Dados necessários por lei</td>
                    <td className="border border-gray-300 px-4 py-3">Obrigação legal (inciso II)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── 4. Partilha de Dados ──────────────────────────────────── */}
            <h2 className="text-2xl font-semibold text-gray-900 mt-12">4. Partilha de Dados</h2>
            <p>A sua privacidade é fundamental. <strong>Nós não vendemos os seus dados pessoais.</strong> A partilha ocorre apenas nas seguintes circunstâncias:</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li><strong>Com Provedores de Serviço:</strong> Partilhamos dados com empresas terceiras que nos ajudam a operar a plataforma (ver subseção abaixo).</li>
              <li><strong>Por Obrigações Legais:</strong> Se formos obrigados por lei ou ordem judicial.</li>
              <li><strong>Transferência de Negócios:</strong> Em caso de fusão, aquisição ou venda de ativos, os seus dados podem ser transferidos.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6">4.1. Transferências Internacionais de Dados</h3>
            <p>
              Utilizamos provedores de infraestrutura com servidores nos Estados Unidos. Nos termos dos Arts. 33 e 34 da LGPD, as transferências internacionais realizadas estão amparadas pelos mecanismos a seguir:
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Provedor</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Finalidade</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Mecanismo (Art. 33 LGPD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Vercel Inc.</td>
                    <td className="border border-gray-300 px-4 py-3">Hospedagem e CDN</td>
                    <td className="border border-gray-300 px-4 py-3">DPA com cláusulas contratuais-padrão (inciso II)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">MongoDB Atlas (MongoDB, Inc.)</td>
                    <td className="border border-gray-300 px-4 py-3">Banco de dados</td>
                    <td className="border border-gray-300 px-4 py-3">DPA com cláusulas contratuais-padrão (inciso II)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Upstash, Inc.</td>
                    <td className="border border-gray-300 px-4 py-3">Cache de dados</td>
                    <td className="border border-gray-300 px-4 py-3">DPA com cláusulas contratuais-padrão (inciso II)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">OpenAI, L.L.C.</td>
                    <td className="border border-gray-300 px-4 py-3">Processamento de IA para gerar análises e recomendações, quando este provedor estiver habilitado</td>
                    <td className="border border-gray-300 px-4 py-3">DPA com cláusulas contratuais-padrão (inciso II)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Google LLC (Google Gemini API)</td>
                    <td className="border border-gray-300 px-4 py-3">Processamento de IA de conteúdo e imagens de posts para gerar análises e recomendações, quando este provedor estiver habilitado</td>
                    <td className="border border-gray-300 px-4 py-3">DPA com cláusulas contratuais-padrão (inciso II)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Meta Platforms, Inc.</td>
                    <td className="border border-gray-300 px-4 py-3">APIs do Instagram e WhatsApp</td>
                    <td className="border border-gray-300 px-4 py-3">Consentimento do titular (inciso I) + políticas da Meta</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Mantemos contratos de processamento de dados (DPAs) com cada um desses provedores, que incluem obrigações de segurança e confidencialidade equivalentes às exigidas pela LGPD. Você pode solicitar cópia dos mecanismos de proteção adotados enviando e-mail para <strong>arthur@data2content.ai</strong>.
            </p>

            {/* ── 5. Os Seus Direitos ───────────────────────────────────── */}
            <h2 className="text-2xl font-semibold text-gray-900 mt-12">5. Os Seus Direitos sobre os Seus Dados</h2>
            <p>
              Em conformidade com o Art. 18 da LGPD, você tem os seguintes <strong>9 direitos</strong> como titular dos seus dados. Para exercer qualquer deles, envie e-mail para <strong>arthur@data2content.ai</strong> — respondemos em até <strong>15 dias úteis</strong>.
            </p>
            <ol className="list-decimal list-inside mt-4 space-y-3">
              <li>
                <strong>Confirmação da existência de tratamento:</strong> Você pode solicitar a confirmação de que seus dados pessoais estão sendo tratados por nós.
              </li>
              <li>
                <strong>Acesso aos dados:</strong> Você pode solicitar uma cópia dos dados pessoais que mantemos sobre você.
              </li>
              <li>
                <strong>Correção:</strong> Você pode solicitar a correção de dados incompletos, inexatos ou desatualizados.
              </li>
              <li>
                <strong>Anonimização, bloqueio ou eliminação:</strong> De dados desnecessários, excessivos ou tratados em desconformidade com a LGPD.
              </li>
              <li>
                <strong>Portabilidade:</strong> Você pode solicitar os seus dados em formato estruturado e interoperável para transferência a outro fornecedor de serviço.
              </li>
              <li>
                <strong>Eliminação dos dados tratados com consentimento:</strong> Você pode solicitar a eliminação dos dados cujo tratamento se baseou no seu consentimento, salvo exceções legais (ex.: obrigações fiscais).
              </li>
              <li>
                <strong>Informação sobre compartilhamento:</strong> Você pode saber com quais entidades públicas e privadas compartilhamos os seus dados.
              </li>
              <li>
                <strong>Informação sobre a possibilidade de não fornecer consentimento:</strong> Você tem o direito de ser informado sobre as consequências de não fornecer consentimento para um determinado tratamento.
              </li>
              <li>
                <strong>Revogação do consentimento:</strong> Você pode revogar o seu consentimento a qualquer momento, inclusive para a participação na Comunidade de Inspiração, sem que isso afete a legalidade do tratamento realizado anteriormente. A revogação pode ser feita diretamente nas configurações do seu perfil.
              </li>
            </ol>
            <div className="mt-6 p-4 bg-gray-100 rounded-md">
              <h4 className="font-semibold text-gray-800">Como exercer seus direitos:</h4>
              <p className="mt-2">Envie um e-mail para <strong>arthur@data2content.ai</strong> com o assunto &quot;Direitos LGPD&quot; e descreva a sua solicitação. Processaremos em até 15 dias úteis e confirmaremos por e-mail. Você também pode gerir as permissões concedidas ao nosso aplicativo diretamente nas configurações da sua conta do Facebook.</p>
            </div>

            {/* ── 6. Segurança e Retenção de Dados ─────────────────────── */}
            <h2 className="text-2xl font-semibold text-gray-900 mt-12">6. Segurança e Retenção de Dados</h2>
            <p>
              Utilizamos medidas de segurança técnicas e organizacionais para proteger os seus dados, como criptografia em trânsito (TLS/SSL) e em repouso. Os dados são retidos apenas pelo tempo necessário para cada finalidade, conforme a tabela abaixo (Art. 9º, III da LGPD):
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Categoria de dado</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Período de retenção</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Dados da conta (e-mail, nome, perfil)</td>
                    <td className="border border-gray-300 px-4 py-3">Enquanto a conta estiver ativa + 5 anos (obrigações legais)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Métricas e insights do Instagram</td>
                    <td className="border border-gray-300 px-4 py-3">Pelo período da assinatura ativa; excluídos em 30 dias após cancelamento</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Logs de conversa com IA / WhatsApp</td>
                    <td className="border border-gray-300 px-4 py-3">90 dias após cada interação</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Dados de pagamento</td>
                    <td className="border border-gray-300 px-4 py-3">5 anos (legislação fiscal brasileira)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Registros de consentimento legal</td>
                    <td className="border border-gray-300 px-4 py-3">5 anos após revogação (comprovação de conformidade)</td>
                  </tr>
                  <tr className="even:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3">Cookies de analytics</td>
                    <td className="border border-gray-300 px-4 py-3">13 meses</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">Se você excluir a sua conta, os dados pessoais que não estejam sujeitos a obrigação legal de retenção serão eliminados de forma permanente.</p>

            {/* ── 7. Decisões Automatizadas por IA ─────────────────────── */}
            <h2 className="text-2xl font-semibold text-gray-900 mt-12">7. Decisões Automatizadas e Inteligência Artificial</h2>
            <p>
              O serviço central do Data2Content utiliza modelos de inteligência artificial para gerar análises de desempenho, relatórios e recomendações estratégicas personalizadas com base nos seus dados do Instagram e WhatsApp. Em conformidade com o Art. 20 da LGPD, informamos:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li><strong>Critérios gerais utilizados:</strong> Os modelos de IA consideram métricas de engajamento, tendências temporais, dados demográficos da audiência e padrões históricos de desempenho dos seus conteúdos.</li>
              <li><strong>Finalidade das análises:</strong> As recomendações têm caráter consultivo e não geram decisões automatizadas com efeitos jurídicos ou que afetem significativamente seus direitos de forma definitiva.</li>
              <li><strong>Revisão humana:</strong> Você tem o direito de solicitar revisão de qualquer análise automatizada que considere imprecisa ou inadequada, enviando e-mail para <strong>arthur@data2content.ai</strong> com o assunto &quot;Revisão de análise IA&quot;.</li>
            </ul>

            {/* ── 8. Notificação de Incidentes de Segurança ────────────── */}
            <h2 className="text-2xl font-semibold text-gray-900 mt-12">8. Notificação de Incidentes de Segurança</h2>
            <p>
              Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares dos dados (ex.: acesso não autorizado, vazamento), adotaremos os seguintes procedimentos em conformidade com o Art. 48 da LGPD e a Resolução CD/ANPD nº 2/2022:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>Comunicaremos à <strong>ANPD</strong> em até <strong>2 dias úteis</strong> a partir da confirmação do incidente, informando a natureza dos dados afetados, as medidas adotadas e o canal de contato.</li>
              <li>Notificaremos os <strong>titulares afetados</strong> em prazo razoável por e-mail, com informações claras sobre o incidente e as ações de mitigação tomadas.</li>
              <li>Manteremos registro interno do incidente e das medidas corretivas aplicadas.</li>
            </ul>

            {/* ── 9. Contato ───────────────────────────────────────────── */}
            <h2 className="text-2xl font-semibold text-gray-900 mt-12">9. Contato</h2>
            <p>Se tiver alguma dúvida sobre esta Política de Privacidade ou sobre as nossas práticas de dados, entre em contato com o nosso Encarregado de Proteção de Dados (DPO):</p>
            <ul className="list-none mt-4 pl-0">
              <li><strong>Encarregado da Proteção dos Dados (DPO):</strong> Arthur Marbá</li>
              <li><strong>Email:</strong> arthur@data2content.ai</li>
              <li><strong>Empresa:</strong> Mobi Media Produtores de Conteúdo LTDA</li>
            </ul>
            <p className="mt-4 text-sm text-gray-600">
              Você também pode exercer reclamações perante a <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">www.gov.br/anpd</a>.
            </p>

          </div>
        </div>
      </div>
    </>
  );
}
