import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 md:p-10 shadow-xl rounded-lg">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-brand-dark mb-2">
            Política de Privacidade
          </h1>
          <p className="text-sm text-gray-500">
            Data2Content
          </p>
        </header>

        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="mb-4 text-sm">
            <strong>Última Atualização:</strong> 10 de Maio de 2025
          </p>

          <p className="mb-4">
            Bem-vindo(a) ao Data2Content! Esta Política de Privacidade descreve como <strong>Mobi Media Produtores de Conteúdo LTDA</strong> (“Data2Content”, “nós”) coleta, usa, armazena, compartilha e protege as informações sobre você (“utilizador”, “você”, “criador”) quando você utiliza nosso serviço Data2Content (a “Plataforma”). Isso inclui dados obtidos das APIs da Meta (Facebook e Instagram) mediante a sua autorização, informações fornecidas diretamente por você e como esses dados são utilizados em funcionalidades como o nosso Consultor IA, a Comunidade de Inspiração, o Media Kit Público e os Dashboards para Agências.
          </p>

          <p className="mb-6">
            Nosso compromisso é garantir transparência e proteção de seus dados, em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018), o Regulamento Geral de Proteção de Dados da União Europeia (GDPR – Regulamento 2016/679) e as Políticas da Meta Platforms, Inc. (Termos da Plataforma e Políticas do Desenvolvedor). Ao usar a Plataforma, você concorda com esta Política de Privacidade e com os nossos Termos de Serviço.
          </p>

          <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">1. Quais Dados Coletamos</h2>
          <p className="mb-4">Para fornecer as funcionalidades da Plataforma, coletamos os seguintes tipos de dados:</p>

          <h3 className="text-xl font-medium text-gray-800 mt-6 mb-3">1.1 Dados Obtidos da Meta (mediante autorização)</h3>
          <ul className="list-disc list-inside mb-6 pl-4 space-y-2">
            <li><strong>Email (`email`):</strong> Endereço de e-mail principal associado à sua conta Facebook ou Google utilizada para login.</li>
            <li><strong>Informações Básicas do Perfil (`public_profile`):</strong> Seu nome, @username e URL da foto de perfil do Instagram comercial ou de criador.</li>
            <li><strong>Lista de Páginas do Facebook (`pages_show_list`):</strong> Acesso temporário à lista de Páginas do Facebook que você administra, apenas para seleção da Página vinculada à conta Instagram.</li>
            <li><strong>Dados de Engajamento de Páginas (`pages_read_engagement`):</strong> Dados relacionados a posts, comentários, reações, alcance e impressões da sua Página do Facebook conectada.</li>
            <li><strong>Informações Básicas da Conta Instagram (`instagram_basic`):</strong> ID numérico, @username, número de seguidores, contagem de posts e biografia pública.</li>
            <li><strong>Insights do Instagram (`instagram_manage_insights`):</strong> Métricas de desempenho (alcance, impressões, visualizações de perfil, cliques em links, dados demográficos anônimos e engajamento por mídia).</li>
            <li><strong>Comentários do Instagram (`instagram_manage_comments`):</strong> Acesso para leitura de comentários das suas publicações para análise de sentimento e futuras funcionalidades de gerenciamento.</li>
          </ul>

          <h3 className="text-xl font-medium text-gray-800 mt-6 mb-3">1.2 Dados Fornecidos Diretamente por Você</h3>
          <ul className="list-disc list-inside mb-6 pl-4 space-y-2">
            <li><strong>Número de WhatsApp:</strong> Coletado apenas se fornecido voluntariamente, para envio de comunicações do Consultor IA.</li>
            <li><strong>Informações de Posts (Proposta e Contexto):</strong> Classificações que você atribui aos seus posts dentro da plataforma.</li>
            <li><strong>Preferências e Objetivos:</strong> Quaisquer outras informações que você insere, como metas de conteúdo e preferências de uso.</li>
          </ul>

          <h3 className="text-xl font-medium text-gray-800 mt-6 mb-3">1.3 Dados Utilizados na Comunidade de Inspiração</h3>
          <ul className="list-disc list-inside mb-6 pl-4 space-y-2">
            <li>Link do post público, conteúdo visual/textual, Proposta, Contexto e resumo estratégico gerado por IA, somente mediante consentimento nos Termos. Para sair da Comunidade, é necessário excluir a conta.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">2. Como Utilizamos Seus Dados</h2>
          <ul className="list-disc list-inside mb-6 pl-4 space-y-2">
            <li><strong>Fornecer, Operar e Manter o Serviço:</strong> Autenticação, criação de conta e gerenciamento de assinatura.</li>
            <li><strong>Exibição de Métricas e Análise de Performance:</strong> Dashboards, gráficos e relatórios de desempenho.</li>
            <li><strong>Consultor IA:</strong> Geração e envio de dicas personalizadas via WhatsApp.</li>
            <li><strong>Media Kit Público:</strong> Apresentação de métricas de desempenho ao público e parceiros comerciais, com seu consentimento.</li>
            <li><strong>Dashboards para Agências:</strong> Permitir que agências autorizadas visualizem métricas de criadores sob sua gestão.</li>
            <li><strong>Comunicação de Oportunidades:</strong> Notificações sobre campanhas e oportunidades relevantes.</li>
            <li><strong>Comunidade de Inspiração:</strong> Disponibilização de exemplos qualitativos para inspiração de outros usuários.</li>
            <li><strong>Personalização da Experiência:</strong> Uso de nome e foto de perfil para personalizar a interface.</li>
            <li><strong>Melhoria e Desenvolvimento do Serviço:</strong> Testes, monitoramento e melhorias contínuas.</li>
            <li><strong>Cumprimento de Obrigações Legais:</strong> Atendimento a LGPD, GDPR e políticas da Meta.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">3. Armazenamento e Segurança dos Dados</h2>
          <p className="mb-4">Empregamos medidas técnicas e administrativas razoáveis, como TLS/SSL e criptografia em repouso. Seus dados são armazenados em servidores seguros (Vercel e MongoDB Atlas, possivelmente fora do Brasil). Apesar disso, nenhum sistema é totalmente invulnerável.</p>

          <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">4. Compartilhamento de Dados</h2>
          <p className="mb-4">Não vendemos ou alugamos seus dados pessoais identificáveis. Compartilhamos apenas:</p>
          <ul className="list-disc list-inside mb-6 pl-4 space-y-2">
            <li><strong>Media Kit Público:</strong> Métricas de desempenho compartilhadas publicamente com seu consentimento.</li>
            <li><strong>Marcas Parceiras:</strong> Informações de perfil e métricas agregadas (seguidores, engajamento, demografia) para seleção de campanhas.</li>
            <li><strong>Agências Autorizadas:</strong> Acesso às métricas de criadores sob sua gestão.</li>
            <li><strong>Comunidade de Inspiração:</strong> Dados públicos consentidos.</li>
            <li><strong>Compartilhamento de Contato:</strong> Seu WhatsApp ou e-mail somente com consentimento específico para oportunidades de campanha.</li>
            <li><strong>Provedores de Serviço:</strong> Vercel, MongoDB Atlas e APIs da Meta/WhatsApp.</li>
            <li><strong>Por Obrigações Legais:</strong> Para cumprir ordens judiciais ou regulamentares.</li>
            <li><strong>Transferência de Negócios:</strong> Em caso de fusão, aquisição ou reestruturação.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">5. Seus Direitos</h2>
          <ul className="list-disc list-inside mb-6 pl-4 space-y-2">
            <li><strong>Acessar e Corrigir:</strong> Visualizar e atualizar suas informações na plataforma.</li>
            <li><strong>Portabilidade:</strong> Solicitar exportação de seus dados.</li>
            <li><strong>Excluir Conta:</strong> Dados removidos imediatamente ao solicitar pelo e-mail <strong>arthur@data2content.ai</strong>.</li>
            <li><strong>Opor-se ou Restringir o Processamento:</strong> Conforme LGPD/GDPR.</li>
            <li><strong>Revogar Consentimento da Comunidade:</strong> Somente por exclusão de conta.</li>
            <li><strong>Desvincular Meta:</strong> Revogação de acesso pelo Meta Business/Instagram.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">6. Retenção de Dados</h2>
          <p className="mb-6">Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para obrigações legais. Posts na Comunidade permanecem enquanto o post original for público, salvo exclusão de conta ou do post específico.</p>

          <h2 className="text-2xl	font-semibold text-gray-800 mt-10 mb-5	border-t	border-gray-200 pt-6">7. Atualizações</h2>
          <p className="mb-6">Mudanças materiais nesta Política serão comunicadas com 30 dias de antecedência via e-mail ou notificação na plataforma. O uso continuado após atualização constitui aceite.</p>

          <h2 className="text-2xl	font-semibold text-gray-800 mt-10 mb-5	border-t	border-gray-200 pt-6">8. Informações de Contato</h2>
          <p className="mb-4">Dúvidas ou solicitações: <strong>arthur@data2content.ai</strong></p>

          <h2 className="text-2xl	font-semibold text-gray-800 mt-10 mb-5	border-t	border-gray-200 pt-6">9. Foro</h2>
          <p className="mb-6">Fica eleito o foro da Comarca da Cidade do Rio de Janeiro/RJ para qualquer disputa relativa a esta Política.</p>

          <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">10. Políticas da Meta</h2>
          <p className="mb-6">Aderimos estritamente às Políticas da Meta Platforms, Inc. para uso das APIs de Facebook e Instagram, garantindo uso responsável e transparente.</p>
        </div>
      </div>
    </div>
  );
}
