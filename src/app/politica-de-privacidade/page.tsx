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
              <strong>Última Atualização:</strong> 18 de Julho de 2025
            </p>
          </header>

          <div className="prose prose-lg max-w-none text-gray-800">
            
            <h2 className="text-2xl font-semibold text-gray-900">1. Introdução</h2>
            <p>
              Bem-vindo(a) ao Data2Content! Esta Política de Privacidade descreve como <strong>Mobi Media Produtores de Conteúdo LTDA</strong> (“Data2Content”, “nós”) coleta, usa, armazena, partilha e protege as suas informações quando você utiliza a nossa plataforma e serviços, incluindo o nosso assistente de IA (o "Serviço").
            </p>
            <p>
              O nosso compromisso é garantir a transparência e a proteção dos seus dados, em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018) do Brasil e as Políticas da Meta Platforms, Inc. (Termos da Plataforma e Políticas do Desenvolvedor). Ao criar uma conta e utilizar o nosso Serviço, você concorda com a coleta e uso de informações de acordo com esta política e com os nossos <Link href="/termos-e-condicoes" className="text-brand-pink hover:underline">Termos de Serviço</Link>.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-12">2. Quais Dados Coletamos</h2>
            <p>Para fornecer as funcionalidades do nosso Serviço, coletamos os seguintes tipos de dados:</p>

            <h3 className="text-xl font-semibold text-gray-800 mt-6">2.1. Dados Coletados Através das APIs da Meta (com a sua autorização)</h3>
            <p>Quando você conecta a sua conta do Instagram ao Data2Content, nós solicitamos a sua permissão para coletar os seguintes dados através das APIs da Meta:</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li><strong>Informações Básicas do Perfil (`public_profile`, `email`):</strong> O seu nome, endereço de e-mail principal e foto de perfil associados à sua conta do Facebook, usados para criar e gerir a sua conta no Data2Content.</li>
              <li><strong>Lista de Páginas do Facebook (`pages_show_list`):</strong> Acesso temporário à lista de Páginas do Facebook que você administra, exclusivamente para que você possa selecionar a Página que está vinculada à sua conta profissional do Instagram.</li>
              <li><strong>Informações Básicas da Conta Instagram (`instagram_basic`):</strong> O seu ID de usuário do Instagram, @username, foto de perfil, número de seguidores e contagem de mídias. Usamos isto para confirmar que a conta correta foi conectada.</li>
              <li><strong>Insights do Instagram (`instagram_manage_insights`):</strong> Métricas de desempenho agregadas e anónimas da sua conta e das suas mídias (posts, reels, stories). Isto inclui dados como alcance, impressões, visualizações, curtidas, comentários, partilhas, salvamentos, visualizações de perfil, cliques em links e dados demográficos da sua audiência (como idade, género e localização). <strong>Estes dados são a base para as análises que o nosso assistente de IA fornece.</strong></li>
              <li><strong>Gestão de Ativos de Negócios (`business_management`):</strong> Permissão necessária para facilitar a conexão segura da sua conta, especialmente se os seus ativos (Página do Facebook e Conta do Instagram) forem geridos através de uma Conta de Negócios da Meta (Business Manager).</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6">2.2. Dados Coletados Através da API do WhatsApp (com a sua autorização)</h3>
            <p>Quando você vincula o seu número de WhatsApp ao nosso Serviço, nós usamos as permissões `whatsapp_business_messaging` e `whatsapp_business_management` para:</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
                <li>Enviar e receber mensagens, permitindo a sua interação com o nosso assistente de IA.</li>
                <li>Gerir a conexão técnica do seu número e os modelos de mensagem que usamos para enviar relatórios e alertas proativos.</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mt-6">2.3. Dados Fornecidos Diretamente por Você</h3>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li><strong>Informações de Pagamento e Assinatura:</strong> Dados necessários para processar pagamentos de planos, geridos pelo nosso provedor de pagamentos.</li>
              <li><strong>Preferências e Objetivos:</strong> Quaisquer informações que você nos forneça voluntariamente para personalizar a sua experiência.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-12">3. Como e Por Que Utilizamos Seus Dados</h2>
            <p>Utilizamos os dados coletados para as seguintes finalidades:</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li><strong>Para Fornecer o Serviço Principal:</strong> A principal utilização dos seus Insights do Instagram e das interações do WhatsApp é para que o nosso assistente de IA possa gerar e entregar análises de desempenho, relatórios e recomendações estratégicas personalizadas para você.</li>
              <li><strong>Para Operar a Plataforma:</strong> Para autenticar o seu login, gerir a sua conta e assinatura, e garantir o funcionamento técnico da plataforma.</li>
              <li><strong>Para Comunicação:</strong> Para enviar informações importantes sobre o serviço, atualizações e, com o seu consentimento, materiais de marketing.</li>
              <li><strong>Para Melhoria do Serviço:</strong> Para analisar como os nossos utilizadores interagem com a plataforma, de forma agregada e anónima, com o objetivo de melhorar as nossas funcionalidades.</li>
              <li><strong>Para Cumprir Obrigações Legais:</strong> Para atender a requisitos legais, regulatórios e as políticas da Meta.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-12">4. Partilha de Dados</h2>
            <p>A sua privacidade é fundamental. Nós não vendemos os seus dados pessoais. A partilha de dados ocorre apenas nas seguintes circunstâncias:</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li><strong>Com Provedores de Serviço:</strong> Partilhamos dados com empresas terceiras que nos ajudam a operar a nossa plataforma, como Vercel (hospedagem), MongoDB Atlas (base de dados), Upstash (cache) e as próprias APIs da Meta.</li>
              <li><strong>Por Obrigações Legais:</strong> Se formos obrigados por lei ou por uma ordem judicial a partilhar informações.</li>
              <li><strong>Transferência de Negócios:</strong> Em caso de fusão, aquisição ou venda de ativos, os seus dados podem ser transferidos.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-12">5. Os Seus Direitos e Controlo Sobre os Seus Dados</h2>
            <p>Você tem controlo sobre os seus dados. De acordo com a LGPD e o GDPR, você tem os seguintes direitos:</p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li><strong>Acesso e Correção:</strong> Você pode aceder e atualizar as informações do seu perfil diretamente no nosso painel.</li>
              <li><strong>Portabilidade:</strong> Você pode solicitar uma cópia dos seus dados num formato eletrónico.</li>
              <li><strong>Exclusão de Dados:</strong> Você tem o direito de solicitar a exclusão da sua conta e de todos os seus dados.</li>
            </ul>
            <div className="mt-4 p-4 bg-gray-100 rounded-md">
                <h4 className="font-semibold text-gray-800">Como solicitar a exclusão dos seus dados:</h4>
                <p className="mt-2">Você pode solicitar a exclusão permanente da sua conta e dos seus dados a qualquer momento. Para isso, basta enviar um e-mail com a sua solicitação para <strong>arthur@data2content.ai</strong>. Iremos processar o seu pedido e confirmar a exclusão. Você também pode gerir as permissões concedidas ao nosso aplicativo diretamente nas configurações da sua conta do Facebook.</p>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mt-12">6. Segurança e Retenção de Dados</h2>
            <p>Utilizamos medidas de segurança técnicas e organizacionais para proteger os seus dados, como criptografia em trânsito (TLS/SSL) e em repouso. Reteremos os seus dados apenas pelo tempo necessário para fornecer o Serviço a você e para cumprir as nossas obrigações legais. Se você excluir a sua conta, os seus dados pessoais serão eliminados de forma permanente.</p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-12">7. Contato</h2>
            <p>Se tiver alguma dúvida sobre esta Política de Privacidade ou sobre as nossas práticas de dados, por favor, entre em contato connosco.</p>
            <ul className="list-none mt-4 pl-0">
                <li><strong>Encarregado da Proteção dos Dados (DPO):</strong> Arthur Marbá</li>
                <li><strong>Email:</strong> arthur@data2content.ai</li>
            </ul>

          </div>
        </div>
      </div>
    </>
  );
}
