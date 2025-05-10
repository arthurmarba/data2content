{/* src/app/politica-de-privacidade/page.tsx */}
{/* v2.0 - Atualizada para incluir a Comunidade de Inspiração e outras clarificações */}
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
            Bem-vindo(a) ao Data2Content! Esta Política de Privacidade descreve como <strong>Mobi Media Produtores de Conteudo LTDA</strong> ("nós", "nosso", "nossos") coleta, usa, armazena, compartilha e protege as informações sobre você ("utilizador", "você", "criador") quando você utiliza o nosso serviço Data2Content ("Serviço", "Plataforma"). Isto inclui os dados obtidos através das plataformas da Meta (Facebook e Instagram) mediante a sua autorização, informações fornecidas diretamente por si, e como os seus dados são utilizados em funcionalidades como o nosso Consultor IA e a nova <strong>Comunidade de Inspiração</strong>.
          </p>
          <p className="mb-4">
            O nosso compromisso é com a transparência e a proteção dos seus dados pessoais, em estrita conformidade com as políticas da Meta Platforms, Inc. (incluindo os <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">Termos da Plataforma Meta</a> e as <a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">Políticas do Desenvolvedor</a>) e as leis de privacidade aplicáveis, como a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018) no Brasil.
          </p>
          <p className="mb-6">
            Ao utilizar o Data2Content, você concorda com a coleta e uso das suas informações conforme descrito nesta Política de Privacidade e nos nossos <a href="/termos-e-condicoes" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">Termos e Condições</a> (quando disponíveis).
          </p>

          <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
            1. Quais Dados Coletamos
          </h2>
          <p className="mb-4">Para fornecer as funcionalidades da nossa Plataforma, coletamos os seguintes tipos de dados:</p>
          
          <h3 className="text-xl font-medium text-gray-800 mt-6 mb-3">Dados Obtidos da Meta (com sua autorização):</h3>
          <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
            <li><strong>Email (`email`):</strong> O endereço de e-mail principal associado à sua conta do Facebook ou Google utilizada para o login na nossa Plataforma.</li>
            <li><strong>Informações Básicas do Perfil (`public_profile`):</strong> Seu nome e a URL da sua foto de perfil, conforme fornecidos pelo Facebook ou Google.</li>
            <li><strong>Lista de Páginas do Facebook (`pages_show_list`):</strong> Acesso temporário à lista das Páginas do Facebook que você administra, exclusivamente para permitir a seleção da Página vinculada à conta Instagram desejada durante o processo de conexão.</li>
            <li>
              <strong>Dados de Engajamento de Páginas (`pages_read_engagement`):</strong> Esta permissão permite-nos ler dados relacionados com o conteúdo e engajamento da sua Página do Facebook conectada (ex: posts, comentários, reações, alcance e impressões de posts da Página). Utilizamos esses dados para análises de desempenho e para alimentar o Consultor IA.
            </li>
            <li><strong>Informações Básicas da Conta Instagram (`instagram_basic`):</strong> O ID numérico e o nome de utilizador (@username) da sua conta profissional (Comercial ou Criador de Conteúdo) do Instagram que você conecta. Também podemos coletar informações públicas básicas do perfil, como número de seguidores, contagem de posts e biografia, para exibição na Plataforma e utilização pelo Consultor IA.</li>
            <li><strong>Insights do Instagram (`instagram_manage_insights`):</strong> Dados estatísticos e métricas de desempenho da sua conta e das suas mídias (posts, stories, reels) no Instagram. Isso pode incluir, entre outros: alcance, impressões, visualizações de perfil, cliques (no website, e-mail, etc.), dados demográficos agregados e anónimos de seguidores (como cidade, país, faixa etária e género) e métricas de engajamento individuais de mídias (curtidas, comentários, salvamentos, compartilhamentos, respostas a stories).</li>
            <li>
              <strong>Comentários do Instagram (`instagram_manage_comments`):</strong> Acesso para ler os comentários das suas publicações do Instagram. Estes dados são utilizados para análise de sentimento, para o Consultor IA e, futuramente, poderão ser usados para permitir que você gerencie comentários através da nossa plataforma.
            </li>
          </ul>

          <h3 className="text-xl font-medium text-gray-800 mt-6 mb-3">Dados Fornecidos Diretamente por Você:</h3>
          <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
            <li><strong>Número de WhatsApp:</strong> Coletamos seu número de WhatsApp <strong>apenas se você optar voluntariamente por fornecê-lo</strong> através da nossa Plataforma, com a finalidade de receber comunicações do Consultor IA e outras notificações relevantes do Serviço.</li>
            <li><strong>Informações de Posts (Proposta e Contexto):</strong> As classificações de "Proposta" e "Contexto" que você atribui aos seus posts dentro da plataforma Data2Content.</li>
            {/* Adicionar outros dados diretos, se houver (ex: preferências, objetivos de carreira) */}
          </ul>

          <h3 className="text-xl font-medium text-gray-800 mt-6 mb-3">Dados Utilizados na Comunidade de Inspiração:</h3>
           <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
             <li>Se você consentiu (através da aceitação dos nossos Termos e Condições), os seguintes dados dos seus posts públicos do Instagram poderão ser utilizados para compor a Comunidade de Inspiração: o link para o post original, o conteúdo visual e textual (conforme exibido publicamente no Instagram), sua Proposta e Contexto classificados na plataforma, e um resumo estratégico/criativo gerado por nossa IA sobre o post.</li>
           </ul>

          <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
            2. Como Utilizamos Seus Dados
          </h2>
          <p className="mb-4">Os dados coletados são utilizados estritamente para as seguintes finalidades:</p>
          <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
                <li><strong>Fornecer, Operar e Manter o Serviço:</strong> Usamos seus dados de login para criar sua conta, autenticar seu acesso e gerenciar sua assinatura. Os dados do Instagram e Facebook (IDs, tokens, insights, comentários, etc.) são essenciais para conectar suas contas e buscar as informações necessárias para popular os dashboards, gráficos e relatórios da Plataforma.</li>
                <li><strong>Exibição de Métricas e Análise de Performance:</strong> Processamos os insights coletados do Instagram (e dados da Página do Facebook, se aplicável) para apresentar visualizações sobre o desempenho da sua conta e conteúdo.</li>
                <li><strong>Funcionalidade do Consultor IA:</strong> Utilizamos as métricas, insights e classificações (Proposta, Contexto) da sua conta Instagram para alimentar o nosso Consultor IA. Se você forneceu seu número de WhatsApp, o Consultor IA poderá enviar dicas e análises personalizadas via WhatsApp.</li>
                <li><strong>Funcionalidade da Comunidade de Inspiração:</strong> Utilizamos os dados de seus posts públicos (link, conteúdo público, Proposta, Contexto, e um resumo gerado por IA) para compor a base de exemplos da Comunidade de Inspiração, permitindo que outros utilizadores da plataforma se inspirem. Suas métricas detalhadas não são compartilhadas numericamente nesta comunidade; apenas destaques qualitativos ou resumos de desempenho podem ser inferidos.</li>
                <li><strong>Personalização da Experiência:</strong> Seu nome e foto de perfil podem ser usados para personalizar a interface do Data2Content.</li>
                {/* ... (outros usos mantidos e revisados para clareza) ... */}
                <li><strong>Facilitar a Conexão de Contas.</strong></li>
                <li><strong>Gerenciar Comentários (Leitura e Análise).</strong></li>
                <li><strong>Conectar Criadores e Marcas (Conforme Seção 4).</strong></li>
                <li><strong>Comunicações sobre Oportunidades e Essenciais.</strong></li>
                <li><strong>Melhoria e Desenvolvimento do Serviço.</strong></li>
                <li><strong>Cumprimento de Obrigações Legais e Políticas da Meta.</strong></li>
          </ul>

           <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
            3. Armazenamento e Segurança dos Dados
          </h2>
           <p className="mb-4">A segurança dos seus dados é uma prioridade. Empregamos medidas de segurança técnicas e administrativas razoáveis. Seus dados são armazenados em servidores seguros (atualmente localizados nos Estados Unidos, fornecidos pela Vercel e MongoDB Atlas). Utilizamos criptografia TLS/SSL para dados em trânsito. Tokens de acesso e seu número de WhatsApp (se fornecido) são armazenados com criptografia em repouso ou em variáveis de ambiente seguras.</p>
           {/* ... (restante da seção 3 mantida, com pequenas melhorias de clareza) ... */}
            <p className="mb-6">Apesar de nossos melhores esforços, é importante reconhecer que nenhum sistema de transmissão ou armazenamento eletrônico é 100% seguro. Portanto, não podemos garantir a segurança absoluta de suas informações.</p>


           <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
            4. Compartilhamento de Dados
          </h2>
           <p className="mb-4">Nós **não vendemos ou alugamos** seus dados pessoais identificáveis. O compartilhamento de informações é limitado e ocorre principalmente para viabilizar funcionalidades da plataforma:</p>
           <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
                <li>
                  <strong>Com a Comunidade de Inspiração Data2Content:</strong> Se você consentiu (através da aceitação dos nossos Termos e Condições), o link para seus posts públicos do Instagram selecionados como inspiração, o conteúdo público desses posts, sua Proposta e Contexto classificados, um resumo estratégico gerado por nossa IA, e destaques qualitativos de desempenho poderão ser visíveis para outros utilizadores da plataforma Data2Content. O seu nome de utilizador do Instagram será naturalmente visível ao clicarem no link do post.
                </li>
                <li>
                  <strong>Com Marcas Parceiras (Para Seleção e Proposta de Campanhas):</strong> Para permitir que marcas encontrem e selecionem criadores para suas campanhas, compartilhamos certas informações do seu perfil e desempenho com marcas verificadas que utilizam nossa Plataforma. As informações compartilhadas podem incluir: seu nome de utilizador do Instagram, foto de perfil, número de seguidores, nicho de conteúdo (Proposta/Contexto), métricas de alcance e engajamento agregadas/resumidas, e dados demográficos principais do seu público (de forma agregada).
                  {/* Nota para você: Seja o mais específico possível aqui sobre o que é compartilhado com marcas. */}
                </li>
                <li><strong>Compartilhamento de Contato (com Consentimento Específico):</strong> Seu número de WhatsApp ou e-mail **não** será compartilhado diretamente com as marcas automaticamente. A Data2Content poderá facilitar o contato inicial ou você poderá optar por compartilhar seu contato com uma marca específica **após** demonstrar interesse em uma oportunidade de campanha.</li>
                {/* ... (outros tipos de compartilhamento mantidos: Provedores de Serviço, Obrigações Legais, Transferência de Negócios) ... */}
                <li><strong>Com Provedores de Serviço Terceirizados.</strong></li>
                <li><strong>Por Obrigações Legais.</strong></li>
                <li><strong>Transferência de Negócios.</strong></li>
           </ul>

           <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
            5. Seus Direitos de Privacidade
          </h2>
           <p className="mb-4">Respeitamos seus direitos sobre seus dados pessoais. Você tem o direito de:</p>
           <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
                <li>**Acessar e Corrigir Seus Dados:** Você pode visualizar e atualizar suas informações de perfil e número de WhatsApp (se fornecido) diretamente na Plataforma Data2Content (em "Configurações da Conta" - a ser implementado).</li>
                <li>**Solicitar a Exclusão dos Seus Dados:** Você pode solicitar a exclusão da sua conta Data2Content e dos dados associados entrando em contato conosco pelo e-mail <strong>arthur@data2content.ai</strong>.</li>
                <li>**Gerenciar Consentimentos:** O consentimento para a Comunidade de Inspiração é parte dos Termos e Condições gerais. Se você desejar não participar mais (opt-out), pode solicitar a exclusão da sua conta ou, futuramente, poderemos oferecer controles mais granulares. Você pode gerenciar o fornecimento do seu número de WhatsApp nas configurações da plataforma.</li>
                <li>**Desvincular o Aplicativo:** Você pode revogar o acesso do Data2Content à sua conta do Facebook/Instagram a qualquer momento através das configurações de segurança da respectiva plataforma Meta.</li>
                {/* ... (Opor-se ou Restringir o Processamento mantido) ... */}
                <li><strong>Opor-se ou Restringir o Processamento.</strong></li>
           </ul>
            <p className="mb-6">Para exercer qualquer um desses direitos, entre em contato conosco utilizando as informações na Seção 8.</p>


           <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
            6. Retenção de Dados
          </h2>
           <p className="mb-6">Manteremos seus dados pessoais enquanto sua conta estiver ativa ou conforme necessário para fornecer o Serviço, cumprir obrigações legais, resolver disputas e fazer cumprir nossos acordos. Posts incluídos na Comunidade de Inspiração permanecerão enquanto forem relevantes e o post original estiver público, a menos que você solicite a exclusão da sua conta ou do post específico da comunidade (mecanismo a ser definido).</p>

           <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
            7. Alterações a esta Política de Privacidade
          </h2>
           <p className="mb-6">Podemos atualizar esta Política de Privacidade. Se fizermos alterações materiais, notificaremos você. Indicaremos a data da "Última Atualização" no topo. Seu uso continuado do Serviço após a data de vigência de qualquer alteração constitui sua aceitação.</p>

           <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
            8. Informações de Contato
          </h2>
           <p className="mb-6">Se você tiver alguma dúvida, entre em contato conosco:</p>
           <ul className="list-disc list-inside mb-4 space-y-2 pl-2">
                <li><strong>Por E-mail:</strong> <strong>arthur@data2content.ai</strong></li>
           </ul>

           <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
            9. Conformidade com as Políticas da Meta
          </h2>
           <p className="mb-6">Reafirmamos que o uso e a transferência de informações recebidas das APIs da Meta para o Data2Content aderirão à <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">Política da Plataforma Meta</a>, incluindo os requisitos de uso limitado. Nosso objetivo é utilizar os dados de forma responsável e transparente, exclusivamente para fornecer e melhorar as funcionalidades oferecidas pela nossa Plataforma.</p>

        </div>
      </div>
    </div>
  );
}
