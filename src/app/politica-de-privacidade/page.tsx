// src/app/politica-de-privacidade/page.tsx
import React from 'react';

// Componente funcional para a página da Política de Privacidade
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 shadow-md rounded-lg">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">
          Política de Privacidade - Data2Content
        </h1>

        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="mb-4">
            <strong>Última Atualização:</strong> 02 de Maio de 2025
          </p>
          <p className="mb-4">
            Bem-vindo(a) ao Data2Content! Esta Política de Privacidade descreve como <strong>Mobi Media Produtores de Conteudo LTDA</strong> ("nós", "nosso", "nossos") coleta, usa, armazena, compartilha e protege as informações sobre você ("usuário", "você", "criador") quando você utiliza nosso serviço Data2Content ("Serviço", "Plataforma"), incluindo os dados obtidos através das plataformas da Meta (Facebook e Instagram) mediante sua autorização, e informações fornecidas diretamente por você.
          </p>
          <p className="mb-4">
            Nosso compromisso é com a transparência e a proteção dos seus dados pessoais, em estrita conformidade com as políticas da Meta Platforms, Inc. (incluindo os <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Termos da Plataforma Meta</a> e as <a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Políticas do Desenvolvedor</a>) e as leis de privacidade aplicáveis, como a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018) no Brasil.
          </p>
          <p className="mb-6">
            Ao utilizar o Data2Content, você concorda com a coleta e uso das suas informações conforme descrito nesta Política de Privacidade.
          </p>

          <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-t pt-4">
            1. Quais Dados Coletamos
          </h2>
          <p className="mb-4">Para fornecer as funcionalidades da nossa Plataforma, coletamos os seguintes tipos de dados:</p>
          <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">Dados Obtidos da Meta (com sua autorização):</h3>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li><strong>Email (`email`):</strong> O endereço de e-mail principal associado à sua conta do Facebook ou Google utilizada para o login na nossa Plataforma.</li>
            <li><strong>Informações Básicas do Perfil (`public_profile`):</strong> Seu nome e a URL da sua foto de perfil, conforme fornecidos pelo Facebook ou Google.</li>
            <li><strong>Lista de Páginas do Facebook (`pages_show_list`):</strong> Acesso temporário à lista das Páginas do Facebook que você administra, exclusivamente para permitir a seleção da Página vinculada à conta Instagram desejada durante o processo de conexão.</li>
            <li>
              <strong>Dados de Engajamento de Páginas (`pages_read_engagement`):</strong> Esta permissão nos permite ler dados relacionados ao engajamento da sua Página do Facebook conectada (`[ESPECIFICAR QUAIS DADOS DA PÁGINA FB SÃO REALMENTE LIDOS, ex: posts, comentários, menções]`). Utilizamos esses dados com a finalidade de realizar análises, alimentar o Consultor IA e facilitar a conexão entre marcas e criadores, conforme detalhado na Seção 2.
            </li>
            <li><strong>Informações Básicas da Conta Instagram (`instagram_basic`):</strong> O ID numérico e o nome de usuário (@username) da sua conta profissional (Comercial ou Criador de Conteúdo) do Instagram que você conecta. Também podemos coletar informações públicas básicas do perfil, como número de seguidores, contagem de posts e biografia, para exibição na Plataforma.</li>
            <li><strong>Insights do Instagram (`instagram_manage_insights`):</strong> Dados estatísticos e métricas de desempenho da sua conta e das suas mídias (posts, stories, reels) no Instagram. Isso pode incluir, entre outros: alcance, impressões, visualizações de perfil, cliques (no site, e-mail, etc.), dados demográficos agregados e anônimos de seguidores (como cidade, país, faixa etária e gênero) e métricas de engajamento individuais de mídias (curtidas, comentários, salvamentos, compartilhamentos, respostas a stories).</li>
            <li>
              <strong>Comentários do Instagram (`instagram_manage_comments`):</strong> Acesso para ler os comentários das suas publicações do Instagram e permitir que você visualize e `[ESPECIFICAR AS AÇÕES REALMENTE PERMITIDAS, ex: responda a]` esses comentários diretamente através da interface do Data2Content. Estes dados também são utilizados para análise, para o Consultor IA e para facilitar a conexão marca-criador.
            </li>
          </ul>
          <h3 className="text-xl font-medium text-gray-800 mt-4 mb-2">Dados Fornecidos Diretamente por Você:</h3>
          <ul className="list-disc list-inside mb-4 space-y-2">
            <li><strong>Número de WhatsApp:</strong> Coletamos seu número de WhatsApp <strong>apenas se você optar voluntariamente por fornecê-lo</strong> através da nossa Plataforma, com a finalidade de receber comunicações específicas, conforme detalhado na Seção 2.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-t pt-4">
            2. Como Utilizamos Seus Dados
          </h2>
          <p className="mb-4">Os dados coletados são utilizados estritamente para as seguintes finalidades:</p>
          <ul className="list-disc list-inside mb-4 space-y-2">
                <li>**Fornecer, Operar e Manter o Serviço:** Usamos seus dados de login (email, nome, foto) para criar sua conta, autenticar seu acesso e gerenciar sua assinatura. Os dados do Instagram e Facebook (IDs, tokens, insights, comentários, etc.) são essenciais para conectar suas contas e buscar as informações necessárias para popular os dashboards, gráficos e relatórios da Plataforma Data2Content.</li>
                <li>**Exibição de Métricas e Análise de Performance:** Processamos os insights coletados do Instagram (e os dados de engajamento da Página do Facebook, se aplicável) para apresentar visualizações claras e úteis sobre o desempenho da sua conta e do seu conteúdo, ajudando você a tomar decisões informadas.</li>
                <li>**Funcionalidade do Consultor IA (Uso Principal do WhatsApp e Métricas):** Utilizamos as métricas e insights coletados da sua conta Instagram conectada (e potencialmente dados de engajamento e comentários) para alimentar nosso recurso de consultoria baseado em Inteligência Artificial ("Consultor IA"). Se você optou por fornecer seu número de WhatsApp, o Consultor IA poderá enviar dicas, análises e recomendações personalizadas sobre seu desempenho e conteúdo diretamente para você via WhatsApp, visando auxiliar no seu crescimento como criador de conteúdo.</li>
                <li>**Personalização da Experiência:** Seu nome e foto de perfil podem ser usados para personalizar a interface do usuário dentro do Data2Content.</li>
                <li>**Facilitar a Conexão de Contas:** Utilizar a lista de Páginas do Facebook para que você possa identificar e selecionar a conta correta do Instagram a ser conectada.</li>
                <li>**Gerenciar Comentários:** Permitir a visualização e as ações de `[listar as ações especificadas na Seção 1, ex: responder]` comentários do Instagram através da nossa plataforma, além de utilizar esses dados para análise e para o Consultor IA.</li>
                <li>**Conectar Criadores e Marcas:** Utilizamos as métricas e insights da sua conta Instagram (como dados demográficos do público, alcance, nicho de conteúdo e engajamento) para **permitir que marcas parceiras identifiquem e selecionem criadores de conteúdo** adequados para suas campanhas publicitárias através da nossa Plataforma. Facilitamos essa conexão conforme detalhado na Seção 4 (Compartilhamento de Dados).</li>
                <li>**Comunicações sobre Oportunidades (Via Data2Content/WhatsApp):** Poderemos usar seu e-mail ou número de WhatsApp (se fornecido) para informá-lo sobre o interesse de marcas ou oportunidades de campanha identificadas através da Plataforma.</li>
                <li>**Comunicações Essenciais:** Podemos usar seu endereço de e-mail para enviar informações importantes sobre sua conta, atualizações do Serviço, alterações nesta Política de Privacidade, questões de segurança, faturamento ou para fornecer suporte técnico.</li>
                <li>**Melhoria e Desenvolvimento:** Podemos analisar dados de uso da plataforma (de forma agregada e/ou anonimizada, sempre que tecnicamente viável) para entender tendências de uso, identificar áreas para melhoria, corrigir erros e desenvolver novas funcionalidades.</li>
                <li>**Cumprimento de Obrigações:** Utilizamos os dados conforme necessário para cumprir nossas obrigações legais, resolver disputas, fazer cumprir nossos Termos de Serviço e proteger nossos direitos e a segurança da Plataforma e de nossos usuários, bem como para garantir a conformidade com os Termos e Políticas da Meta.</li>
          </ul>

           <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-t pt-4">
            3. Armazenamento e Segurança dos Dados
          </h2>
           <p className="mb-4">A segurança dos seus dados é uma prioridade. Empregamos medidas de segurança técnicas e administrativas razoáveis para proteger as informações que coletamos contra acesso não autorizado, alteração, divulgação ou destruição. Essas medidas incluem:</p>
           <ul className="list-disc list-inside mb-4 space-y-2">
                <li>**Infraestrutura Segura:** Armazenamos seus dados em servidores seguros, utilizando provedores de infraestrutura de nuvem reconhecidos que implementam robustas práticas de segurança. `[É RECOMENDADO VERIFICAR E INFORMAR A REGIÃO GERAL ONDE OS SERVIDORES ESTÃO HOSPEDADOS, ex: América do Sul, EUA]`.</li>
                <li>**Criptografia:** Utilizamos criptografia TLS/SSL para proteger os dados transmitidos entre seu navegador e nossos servidores. Dados sensíveis, como tokens de acesso às APIs da Meta e seu número de WhatsApp (se fornecido), são armazenados utilizando `[DESCREVER BREVEMENTE A MEDIDA DE SEGURANÇA, ex: criptografia em repouso, armazenamento em variáveis de ambiente seguras, hashing seguro]`.</li>
                <li>**Controle de Acesso:** O acesso interno aos dados dos usuários é restrito a funcionários ou contratados autorizados que necessitam dessas informações para desempenhar suas funções (ex: suporte técnico, manutenção, moderação da plataforma) e estão sujeitos a obrigações de confidencialidade. O acesso das marcas aos dados dos criadores é controlado conforme descrito na Seção 4.</li>
                <li>**Backups:** Realizamos backups periódicos dos dados para ajudar a garantir a continuidade do serviço e a recuperação em caso de incidentes.</li>
           </ul>
           <p className="mb-6">Apesar de nossos melhores esforços, é importante reconhecer que nenhum sistema de transmissão ou armazenamento eletrônico é 100% seguro. Portanto, não podemos garantir a segurança absoluta de suas informações.</p>

           <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-t pt-4">
            4. Compartilhamento de Dados
          </h2>
           <p className="mb-4">Nós **não vendemos ou alugamos** seus dados pessoais identificáveis. O compartilhamento de informações é limitado e ocorre principalmente para viabilizar a conexão entre criadores e marcas, sempre em conformidade com as políticas da Meta e a legislação aplicável:</p>
           <ul className="list-disc list-inside mb-4 space-y-2">
                <li>**Com Marcas Parceiras (Para Seleção e Proposta de Campanhas):** Para permitir que marcas encontrem e selecionem criadores para suas campanhas, **compartilhamos certas informações do seu perfil e desempenho com marcas verificadas que utilizam nossa Plataforma.** As informações compartilhadas podem incluir: `[LISTAR EXATAMENTE QUAIS DADOS SÃO VISÍVEIS PARA AS MARCAS. Exemplos: Seu nome de usuário do Instagram, foto de perfil, número de seguidores, nicho de conteúdo (se classificado), métricas de alcance e engajamento agregadas/resumidas, dados demográficos principais do seu público (ex: faixa etária, gênero, localização principal - sempre de forma agregada). SEJA O MAIS ESPECÍFICO POSSÍVEL PARA A REVISÃO DA META]`. Não compartilhamos seus insights brutos ou dados de posts individuais com as marcas nesta fase de descoberta.</li>
                <li>**Compartilhamento de Contato (com Consentimento):** Seu número de WhatsApp ou e-mail **não** será compartilhado diretamente com as marcas automaticamente. A Data2Content poderá facilitar o contato inicial ou você poderá optar por compartilhar seu contato com uma marca específica **após** demonstrar interesse em uma oportunidade de campanha apresentada. `[CONFIRMAR SE HÁ OPÇÃO PARA O CRIADOR TORNAR O CONTATO VISÍVEL OU SE É SEMPRE INTERMEDIADO/PÓS-CONSENTIMENTO ESPECÍFICO]`.</li>
                <li>**Com Provedores de Serviço Terceirizados:** Podemos contratar outras empresas ou indivíduos para realizar funções em nosso nome (ex: provedores de hospedagem de servidor). Esses provedores terão acesso às informações estritamente necessárias para desempenhar suas funções, são contratualmente obrigados a manter a confidencialidade e segurança dos dados e a utilizá-los apenas para os fins para os quais foram contratados. Atualmente, não utilizamos serviços de terceiros para envio de e-mails transacionais ou análise de uso externo.</li>
                <li>**Por Obrigações Legais:** Poderemos divulgar suas informações se formos obrigados por lei, processo legal, intimação, ordem judicial ou solicitação governamental válida, ou se acreditarmos de boa fé que a divulgação é necessária para proteger nossos direitos, propriedade ou segurança, ou a segurança de nossos usuários ou do público, ou para investigar ou prevenir fraudes.</li>
                <li>**Transferência de Negócios:** No caso de uma fusão, aquisição, venda de ativos, falência ou outra transação empresarial, as informações dos usuários podem ser um dos ativos transferidos. Notificaremos você (por exemplo, via e-mail ou aviso destacado na Plataforma) antes que suas informações se tornem sujeitas a uma política de privacidade diferente.</li>
                <li>**Outros Compartilhamentos:** Atualmente, não compartilhamos seus dados com outros tipos de parceiros ou serviços além dos mencionados acima.</li>
           </ul>

           <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-t pt-4">
            5. Seus Direitos de Privacidade
          </h2>
           <p className="mb-4">Respeitamos seus direitos sobre seus dados pessoais, em conformidade com a LGPD e outras leis aplicáveis. Você tem o direito de:</p>
           <ul className="list-disc list-inside mb-4 space-y-2">
                <li>**Acessar Seus Dados:** Você pode visualizar grande parte dos seus dados diretamente na Plataforma Data2Content, na seção `[Nome da Seção, ex: 'Minha Conta' ou 'Configurações']` `(A SER IMPLEMENTADO)`. Para solicitar acesso a outras informações que possamos ter sobre você, entre em contato conosco.</li>
                <li>**Corrigir Seus Dados:** Você poderá atualizar suas informações de perfil (nome, email, foto) e seu número de WhatsApp (se fornecido) diretamente na Plataforma na seção `[Nome da Seção, ex: 'Minha Conta' ou 'Configurações']` `(A SER IMPLEMENTADO)`. Se encontrar outras informações incorretas, entre em contato para solicitar a correção.</li>
                <li>**Solicitar a Exclusão dos Seus Dados:** Você pode solicitar a exclusão da sua conta Data2Content e dos dados que armazenamos sobre você, entrando em contato conosco pelo e-mail **arthur@data2content.ai**. Processaremos sua solicitação de acordo com os prazos e requisitos legais. A exclusão da sua conta no Data2Content não afetará seus dados nas plataformas originais (Facebook, Instagram, Google).</li>
                <li>**Gerenciar Consentimentos:** Você poderá gerenciar suas preferências sobre o fornecimento e uso do seu número de WhatsApp para receber dicas do Consultor IA e notificações sobre oportunidades de marca, bem como gerenciar a visibilidade das suas informações para marcas (se aplicável), na seção `[Nome da Seção, ex: 'Configurações de Notificações' ou 'Preferências de Privacidade']` da Plataforma `(A SER IMPLEMENTADO)`.</li>
                {/* CORREÇÃO APLICADA ABAIXO: Substituído '>' por '&gt;' */}
                <li>**Desvincular o Aplicativo:** Você tem o controle total para revogar o acesso do Data2Content à sua conta do Facebook ou Instagram a qualquer momento. Você pode fazer isso diretamente nas configurações de segurança da sua conta no Facebook (geralmente em "Configurações e privacidade" &gt; "Configurações" &gt; "Aplicativos e sites" ou "Integrações comerciais") ou nas configurações do Instagram ("Configurações e privacidade" &gt; "Permissões do site" &gt; "Aplicativos e sites"). Ao desvincular, pararemos de coletar novos dados através das APIs da Meta e não poderemos mais fornecer os serviços que dependem dessa conexão, incluindo as análises do Consultor IA e a visibilidade para marcas.</li>
                <li>**Opor-se ou Restringir o Processamento:** Em certas circunstâncias previstas em lei, você pode ter o direito de se opor ou solicitar a restrição do processamento de seus dados pessoais. Entre em contato para discutir essas opções.</li>
           </ul>
            <p className="mb-6">Para exercer qualquer um desses direitos, entre em contato conosco utilizando as informações na Seção 8.</p>


           <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-t pt-4">
            6. Retenção de Dados
          </h2>
           <p className="mb-6">Manteremos seus dados pessoais coletados através da Meta e fornecidos por você enquanto sua conta no Data2Content estiver ativa e você mantiver a conexão com o Facebook/Instagram ativa, ou conforme necessário para fornecer o Serviço a você (incluindo a funcionalidade do Consultor IA e a conexão com marcas). Também podemos reter certas informações pelo tempo necessário para cumprir nossas obrigações legais (ex: registros fiscais ou de auditoria), resolver disputas, fazer cumprir nossos acordos ou para outros fins comerciais legítimos (ex: análise agregada e anônima). Quando sua conta for excluída ou a conexão com a Meta for revogada por você, iniciaremos o processo de exclusão ou anonimização dos seus dados pessoais associados ao Data2Content dos nossos sistemas ativos, de acordo com nossas políticas internas e os requisitos legais e da plataforma Meta.</p>

           <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-t pt-4">
            7. Alterações a esta Política de Privacidade
          </h2>
           <p className="mb-6">Podemos atualizar esta Política de Privacidade de tempos em tempos para refletir mudanças em nossas práticas, no Serviço ou nas exigências legais ou da plataforma Meta. Se fizermos alterações materiais, notificaremos você publicando a política atualizada na nossa Plataforma e/ou enviando uma notificação para o seu endereço de e-mail registrado, com uma antecedência razoável antes que as alterações entrem em vigor. Indicaremos a data da "Última Atualização" no topo desta política. Recomendamos que você revise esta página periodicamente para se manter informado sobre nossas práticas de privacidade. Seu uso continuado do Serviço após a data de vigência de qualquer alteração constitui sua aceitação da política revisada.</p>

           <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-t pt-4">
            8. Informações de Contato
          </h2>
           <p className="mb-6">Se você tiver alguma dúvida, comentário ou preocupação sobre esta Política de Privacidade, sobre nossas práticas de dados, ou se desejar exercer seus direitos de privacidade, entre em contato conosco:</p>
           <ul className="list-disc list-inside mb-4 space-y-2">
                <li>**Por E-mail:** **arthur@data2content.ai**</li>
           </ul>

           <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-4 border-t pt-4">
            9. Conformidade com as Políticas da Meta
          </h2>
           <p className="mb-6">Reafirmamos que o uso e a transferência de informações recebidas das APIs da Meta para o Data2Content aderirão à <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Política da Plataforma Meta</a>, incluindo os requisitos de uso limitado. Nosso objetivo é utilizar os dados de forma responsável e transparente, exclusivamente para fornecer e melhorar as funcionalidades oferecidas pela nossa Plataforma, conforme descrito nesta política e autorizado por você.</p>

        </div>
      </div>
    </div>
  );
}
