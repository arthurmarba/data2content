// src/app/termos-e-condicoes/page.tsx
// Página para exibir os Termos e Condições da Data2Content

import React from 'react';
import Head from 'next/head'; // Para o título da página

// Componente funcional para a página de Termos e Condições
export default function TermsAndConditionsPage() {
  return (
    <>
      <Head>
        <title>Termos e Condições - Data2Content</title>
        <meta name="description" content="Termos e Condições de Uso da plataforma Data2Content." />
      </Head>
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 md:p-10 shadow-xl rounded-lg">
          <header className="mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-dark mb-2">
              Termos e Condições de Uso
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
              Bem-vindo(a) ao Data2Content! Estes Termos e Condições de Uso ("Termos") regem o seu acesso e uso da plataforma Data2Content ("Serviço", "Plataforma"), oferecida por <strong>Mobi Media Produtores de Conteudo LTDA</strong> ("nós", "nosso", "nossos"). Ao aceder ou utilizar o nosso Serviço, você ("utilizador", "você", "criador") concorda em cumprir e estar vinculado a estes Termos e à nossa <a href="https://data2content.vercel.app/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">Política de Privacidade</a>, que é parte integrante deste acordo. Se você não concordar com qualquer parte destes Termos, não deverá aceder ou utilizar o Serviço.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              1. Aceitação dos Termos
            </h2>
            <p className="mb-6">
              Ao criar uma conta, aceder ou utilizar a Plataforma Data2Content, você declara que leu, entendeu e concorda em estar legalmente vinculado por estes Termos e pela nossa Política de Privacidade. Se você estiver a utilizar o Serviço em nome de uma entidade (por exemplo, uma empresa), você declara e garante que tem autoridade legal para vincular essa entidade a estes Termos.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              2. Descrição do Serviço Data2Content
            </h2>
            <p className="mb-2">
              O Data2Content é uma plataforma online projetada para auxiliar criadores de conteúdo a:
            </p>
            <ul className="list-disc list-inside mb-6 space-y-2 pl-2">
              <li>Conectar a sua conta profissional do Instagram para coleta e análise de métricas e insights.</li>
              <li>Analisar dados de desempenho de posts, alcance, engajamento e demografia da audiência.</li>
              <li>Receber consultoria estratégica e personalizada via WhatsApp através do nosso Consultor IA (Tuca).</li>
              <li>Participar e beneficiar-se da <strong>Comunidade de Inspiração Data2Content</strong>, uma funcionalidade central onde exemplos de posts públicos de utilizadores participantes (incluindo os seus, conforme descrito na Secção 5) são partilhados para fins de inspiração e aprendizado mútuo.</li>
              <li>Utilizar ferramentas para registo e análise de parcerias publicitárias.</li>
            </ul>
            <p className="mb-6">
              Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer aspeto do Serviço a qualquer momento, com ou sem aviso prévio, embora nos esforcemos para comunicar alterações significativas.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              3. Elegibilidade e Gestão da Sua Conta
            </h2>
            <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
              <li><strong>Idade Mínima:</strong> Você deve ter pelo menos 18 anos de idade, ou a idade da maioridade legal na sua jurisdição, para criar uma conta e utilizar o Serviço.</li>
              <li><strong>Conta Profissional do Instagram:</strong> Para utilizar as funcionalidades principais da Plataforma, é necessário possuir uma conta profissional (Comercial ou Criador de Conteúdo) ativa no Instagram e autorizar a Data2Content a aceder aos dados necessários através da API da Meta.</li>
              <li><strong>Informações de Registo:</strong> Você concorda em fornecer informações verdadeiras, precisas, atuais e completas durante o processo de registo e em manter essas informações sempre atualizadas na sua conta.</li>
              <li><strong>Segurança da Sua Conta:</strong> Você é o único responsável por manter a confidencialidade das suas credenciais de acesso (incluindo a segurança da sua conta Google utilizada para login na Data2Content) e por todas as atividades que ocorram sob a sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado ou suspeita de violação de segurança da sua conta.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              4. Uso de Dados e Permissões da Meta (Instagram/Facebook)
            </h2>
            <p className="mb-2">
              Ao conectar a sua conta do Instagram à Data2Content, você concede-nos permissão para aceder, coletar, armazenar e processar os dados da sua conta do Instagram e, se aplicável, da Página do Facebook associada. Este processo é realizado em estrita conformidade com a nossa <a href="https://data2content.vercel.app/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">Política de Privacidade</a> e com os Termos da Plataforma Meta e Políticas do Desenvolvedor. Os dados incluem, mas não se limitam a:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 pl-2">
                <li>Informações básicas do seu perfil público.</li>
                <li>Métricas de desempenho dos seus posts, stories e reels.</li>
                <li>Insights gerais da sua conta e dados demográficos da sua audiência (de forma agregada).</li>
                <li>Comentários das suas publicações.</li>
            </ul>
            <p className="mb-2">Estes dados são utilizados exclusivamente para:</p>
            <ul className="list-disc list-inside mb-4 space-y-2 pl-2">
                <li>Fornecer, operar, manter e melhorar o Serviço.</li>
                <li>Alimentar as análises do Consultor IA.</li>
                <li>Possibilitar a funcionalidade da Comunidade de Inspiração (conforme detalhado na Secção 5).</li>
            </ul>
            <p className="mb-6">
              Você pode revogar o nosso acesso aos seus dados da Meta a qualquer momento, diretamente nas configurações de segurança da sua conta no Facebook ou Instagram. A revogação do acesso impedirá o funcionamento das funcionalidades do Data2Content que dependem dessa conexão.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              5. Comunidade de Inspiração Data2Content
            </h2>
            <p className="mb-2">
              A Comunidade de Inspiração é uma funcionalidade central do Data2Content, projetada para o benefício mútuo dos nossos criadores.
            </p>
            <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
              <li><strong>Participação e Consentimento Automático:</strong> Ao aceitar estes Termos e Condições e utilizar a Plataforma Data2Content, <strong>você automaticamente concorda em participar da Comunidade de Inspiração.</strong></li>
              <li><strong>O que é Partilhado:</strong> A sua participação implica que os seus <strong>posts públicos do Instagram</strong> poderão ser selecionados para serem exibidos a outros utilizadores da Data2Content como exemplos inspiradores. As informações partilhadas incluem:
                <ul className="list-circle list-inside mt-2 mb-2 space-y-1 pl-4">
                  <li>O link direto para o seu post original no Instagram.</li>
                  <li>O conteúdo visual e textual do seu post, conforme ele é exibido publicamente no Instagram.</li>
                  <li>A classificação de "Proposta" e "Contexto" que você atribuiu ao post na plataforma Data2Content.</li>
                  <li>Um resumo estratégico/criativo sobre o post, gerado pela nossa Inteligência Artificial.</li>
                  <li>Destaques qualitativos de desempenho (por exemplo, "ótimo para gerar salvamentos", "alto engajamento nos comentários"), que são derivados das suas métricas, mas apresentados de forma descritiva e <strong>nunca como números exatos de outros utilizadores.</strong></li>
                </ul>
              </li>
              <li><strong>Identificação do Criador:</strong> Ao partilhar o link direto para o seu post no Instagram, o seu nome de utilizador do Instagram e o seu perfil serão naturalmente acessíveis a quem clicar no link.</li>
              <li><strong>Privacidade das Suas Métricas Detalhadas:</strong> Reiteramos que <strong>as suas métricas numéricas detalhadas e individuais (como número exato de curtidas, alcance específico de um post, etc.) NUNCA serão partilhadas ou visíveis para outros utilizadores na Comunidade de Inspiração.</strong></li>
              <li><strong>Objetivo da Comunidade:</strong> Fomentar a criatividade, o aprendizado e a troca de ideias entre os criadores de conteúdo da plataforma.</li>
              <li><strong>Seu Controlo:</strong> A participação na Comunidade de Inspiração é uma condição para o uso do Serviço Data2Content. Se, a qualquer momento, você desejar não ter mais os seus posts considerados para a Comunidade de Inspiração, a sua opção é descontinuar o uso do Serviço e solicitar a exclusão da sua conta, conforme descrito na nossa Política de Privacidade. Estamos a explorar formas de oferecer controlos mais granulares no futuro.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              6. Propriedade Intelectual
            </h2>
            <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
              <li><strong>Nosso Conteúdo e Plataforma:</strong> O Serviço Data2Content, incluindo todo o seu conteúdo original (textos, gráficos, logotipos, software, etc., excluindo os seus dados e conteúdos do Instagram), funcionalidades e tecnologia, são e continuarão a ser propriedade exclusiva da Mobi Media Produtores de Conteudo LTDA e dos seus licenciadores. Estes são protegidos por direitos autorais, marcas registadas e outras leis.</li>
              <li><strong>Seu Conteúdo do Instagram:</strong> Você retém todos os direitos de propriedade intelectual sobre o conteúdo que você cria e publica no Instagram e noutras plataformas.</li>
              <li><strong>Licença para o Data2Content:</strong> Ao conectar a sua conta e utilizar o nosso Serviço (incluindo a participação na Comunidade de Inspiração), você concede à Data2Content uma licença mundial, não exclusiva, isenta de royalties, para aceder, usar, reproduzir, processar, adaptar, modificar (para fins de formatação, análise e exibição dentro da Plataforma), publicar (dentro da plataforma Data2Content, incluindo a exibição de posts selecionados na Comunidade de Inspiração conforme descrito) e distribuir os dados e conteúdos públicos da sua conta do Instagram. Esta licença é concedida estritamente para os fins de operar, desenvolver, fornecer, promover e melhorar o Serviço Data2Content. Esta licença termina quando você desvincula a sua conta do Instagram do nosso Serviço ou solicita a exclusão dos seus dados da nossa Plataforma.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              7. Conduta do Utilizador e Usos Proibidos
            </h2>
            <p className="mb-2">Ao utilizar o Serviço Data2Content, você concorda em não:</p>
            <ul className="list-disc list-inside mb-6 space-y-2 pl-2">
              <li>Violar quaisquer leis, regulamentos ou direitos de terceiros.</li>
              <li>Utilizar o Serviço para fins ilegais, fraudulentos, maliciosos ou não autorizados.</li>
              <li>Tentar obter acesso não autorizado aos nossos sistemas, redes ou dados de outros utilizadores.</li>
              <li>Interferir no funcionamento normal do Serviço ou sobrecarregar a nossa infraestrutura.</li>
              <li>Transmitir vírus, malware ou qualquer código de natureza destrutiva.</li>
              <li>Utilizar os dados ou insights obtidos através do Serviço de forma a violar as políticas das plataformas da Meta ou prejudicar terceiros.</li>
            </ul>
            <p className="mb-6">Reservamo-nos o direito de suspender ou encerrar a sua conta e o seu acesso ao Serviço, a nosso critério, se você violar estes Termos.</p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              8. Isenção de Garantias (Disclaimer)
            </h2>
            <p className="mb-6">
              O SERVIÇO DATA2CONTENT É FORNECIDO "COMO ESTÁ" E "CONFORME DISPONÍVEL". NÃO OFERECEMOS GARANTIAS DE QUALQUER TIPO, SEJAM EXPRESSAS OU IMPLÍCITAS, INCLUINDO, MAS NÃO SE LIMITANDO A, GARANTIAS DE COMERCIALIZAÇÃO, ADEQUAÇÃO A UM FIM ESPECÍFICO, NÃO INFRAÇÃO OU DESEMPENHO CONTÍNUO.
              NÃO GARANTIMOS QUE O SERVIÇO SERÁ ININTERRUPTO, SEGURO, LIVRE DE ERROS OU VÍRUS, OU QUE OS RESULTADOS OBTIDOS COM O USO DO SERVIÇO (INCLUINDO AS SUGESTÕES DO CONSULTOR IA E AS INSPIRAÇÕES DA COMUNIDADE) ATENDERÃO ÀS SUAS NECESSIDADES OU GARANTIRÃO QUALQUER RESULTADO ESPECÍFICO. O SEU SUCESSO COMO CRIADOR DE CONTEÚDO DEPENDE DE DIVERSOS FATORES, INCLUINDO A SUA PRÓPRIA DEDICAÇÃO, CRIATIVIDADE E EXECUÇÃO.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              9. Limitação de Responsabilidade
            </h2>
            <p className="mb-6">
              NA MÁXIMA EXTENSÃO PERMITIDA PELA LEI APLICÁVEL, EM NENHUMA CIRCUNSTÂNCIA A MOBI MEDIA PRODUTORES DE CONTEUDO LTDA, SEUS DIRETORES, FUNCIONÁRIOS, PARCEIROS OU AFILIADOS SERÃO RESPONSÁVEIS POR QUAISQUER DANOS INDIRETOS, INCIDENTAIS, ESPECIAIS, CONSEQUENCIAIS OU PUNITIVOS (INCLUINDO PERDA DE LUCROS, DADOS, USO OU BOA VONTADE) DECORRENTES DO SEU ACESSO OU USO (OU INCAPACIDADE DE ACESSO OU USO) DO SERVIÇO, MESMO QUE TENHAMOS SIDO AVISADOS DA POSSIBILIDADE DE TAIS DANOS.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              10. Modificações aos Termos
            </h2>
            <p className="mb-6">
              Reservamo-nos o direito de modificar ou substituir estes Termos a qualquer momento, a nosso exclusivo critério. Se uma revisão for considerada material (significativa), faremos esforços razoáveis para notificá-lo com antecedência (por exemplo, através de um aviso na Plataforma ou por e-mail para o endereço associado à sua conta) antes que os novos termos entrem em vigor. A notificação indicará um prazo de, pelo menos, **[PREENCHER: ex: 15 ou 30] dias** para a sua revisão.
              Ao continuar a aceder ou utilizar o nosso Serviço após essas revisões se tornarem efetivas, você concorda em estar vinculado aos termos revistos. Se você não concordar com os novos termos, deverá parar de utilizar o Serviço.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              11. Rescisão
            </h2>
            <p className="mb-6">
              Podemos rescindir ou suspender o seu acesso ao nosso Serviço imediatamente, sem aviso prévio ou responsabilidade, por qualquer motivo, incluindo, mas não se limitando a, uma violação destes Termos por si.
              Após a rescisão, o seu direito de utilizar o Serviço cessará imediatamente. Se desejar encerrar a sua conta, você pode descontinuar o uso do Serviço e/ou solicitar a exclusão da sua conta conforme detalhado na nossa Política de Privacidade. As secções que, pela sua natureza, devam sobreviver à rescisão (como Propriedade Intelectual, Isenção de Garantias, Limitação de Responsabilidade, Lei Aplicável) permanecerão em vigor.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              12. Lei Aplicável e Jurisdição
            </h2>
            <p className="mb-6">
              Estes Termos serão regidos e interpretados de acordo com as leis da República Federativa do Brasil, independentemente de conflitos de disposições legais.
              Você concorda que qualquer disputa, reclamação ou controvérsia legal decorrente ou relacionada a estes Termos ou ao Serviço será submetida à jurisdição exclusiva dos tribunais localizados em **[PREENCHER: SUA CIDADE/ESTADO DE JURISDIÇÃO, ex: Foro da Comarca da Capital do Estado do Rio de Janeiro, RJ, Brasil]**.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              13. Disposições Gerais
            </h2>
            <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
              <li><strong>Integralidade do Acordo:</strong> Estes Termos, juntamente com a nossa Política de Privacidade, constituem o acordo integral entre você e a Mobi Media Produtores de Conteudo LTDA em relação ao Serviço e substituem todos os acordos e entendimentos anteriores.</li>
              <li><strong>Renúncia:</strong> A nossa falha em exercer ou fazer cumprir qualquer direito ou disposição destes Termos não constituirá uma renúncia a tal direito ou disposição.</li>
              <li><strong>Divisibilidade:</strong> Se qualquer disposição destes Termos for considerada por um tribunal de jurisdição competente como inválida, ilegal ou inexequível, tal disposição será modificada para refletir a intenção das partes ou eliminada na medida mínima necessária para que as demais disposições destes Termos permaneçam em pleno vigor e efeito.</li>
              <li><strong>Títulos:</strong> Os títulos das secções nestes Termos são apenas para conveniência e não têm efeito legal ou contratual.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">
              14. Contato
            </h2>
            <p className="mb-6">
              Se você tiver alguma dúvida sobre estes Termos e Condições, entre em contato conosco:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 pl-2">
                  <li><strong>Por E-mail:</strong> arthur@data2content.ai</li>
            </ul>
            <p className="mt-8 font-medium">
              Ao criar uma conta e utilizar a plataforma Data2Content, você reconhece que leu, compreendeu e concorda integralmente com estes Termos e Condições de Uso.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
