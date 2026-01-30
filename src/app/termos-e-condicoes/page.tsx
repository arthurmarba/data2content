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
              Bem-vindo(a) ao Data2Content! Estes Termos e Condições de Uso (&quot;Termos&quot;) regem o seu acesso e uso da plataforma Data2Content (&quot;Serviço&quot;, &quot;Plataforma&quot;), oferecida por <strong>Mobi Media Produtores de Conteúdo LTDA</strong> (&quot;nós&quot;, &quot;nosso&quot;). Ao criar uma conta ou utilizar o Serviço, você (&quot;utilizador&quot;, &quot;você&quot;) concorda em cumprir estes Termos e nossa <a href="/politica-de-privacidade" className="text-brand-pink hover:underline">Política de Privacidade</a>, que faz parte integrante deste acordo. Se não concordar com qualquer parte destes Termos, não utilize o Serviço.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">1. Aceitação dos Termos</h2>
            <p className="mb-6">
              Ao criar uma conta, acessar ou usar a Plataforma, você declara que leu, entendeu e concorda em estar legalmente vinculado por estes Termos e pela nossa Política de Privacidade. Se estiver utilizando o Serviço em nome de uma entidade, garante ter autoridade para vinculá-la a estes Termos.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">2. Descrição do Serviço Data2Content</h2>
            <p className="mb-2">
              O Data2Content é uma plataforma online projetada para auxiliar criadores de conteúdo a:
            </p>
            <ul className="list-disc list-inside mb-6 space-y-2 pl-2">
              <li>Conectar sua conta profissional do Instagram para coleta e análise de métricas e insights.</li>
              <li>Analisar dados de desempenho de posts, alcance, engajamento e demografia da audiência.</li>
              <li>Receber consultoria estratégica e personalizada via WhatsApp através do nosso Consultor IA.</li>
              <li>Participar e beneficiar-se da <strong>Comunidade de Inspiração Data2Content</strong>, onde exemplos de posts públicos são compartilhados para inspiração e aprendizado mútuo.</li>
              <li>Utilizar ferramentas para geração de <strong>Media Kits Públicos</strong> apresentando métricas a marcas e parceiros comerciais.</li>
              <li>Acessar <strong>Dashboards exclusivos para gestores</strong> autorizados, permitindo visualizar métricas de criadores sob sua gestão.</li>
              <li>Gerenciar parcerias publicitárias por meio de ferramentas de registro e análise.</li>
            </ul>
            <p className="mb-6">
              Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer aspecto do Serviço a qualquer momento, com ou sem aviso prévio, embora nos esforcemos para comunicar alterações significativas com antecedência.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">3. Elegibilidade e Gestão da Sua Conta</h2>
            <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
              <li><strong>Idade Mínima:</strong> Deve ter pelo menos 18 anos, ou maioridade legal na sua jurisdição.</li>
              <li><strong>Conta Profissional no Instagram:</strong> Necessário possuir uma conta profissional ativa (Comercial ou Criador) e autorizar o acesso via API da Meta.</li>
              <li><strong>Informações de Registro:</strong> Deve fornecer dados verdadeiros, precisos e atualizados, mantendo-os sempre atualizados.</li>
              <li><strong>Segurança da Conta:</strong> Você é responsável pela confidencialidade das credenciais e por todas as atividades em sua conta. Notifique-nos sobre uso não autorizado.
            </li></ul>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">4. Uso de Dados e Permissões da Meta (Instagram/Facebook)</h2>
            <p className="mb-2">
              Ao conectar sua conta do Instagram (e Página do Facebook, se aplicável), você nos autoriza a acessar, coletar, armazenar e processar dados conforme nossa Política de Privacidade e as Políticas da Meta. Inclui informações básicas do perfil, métricas de desempenho, dados demográficos agregados e comentários.
            </p>
            <p className="mb-2">Estes dados são exclusivamente utilizados para:</p>
            <ul className="list-disc list-inside mb-4 space-y-2 pl-2">
              <li>Fornecer, operar, manter e melhorar o Serviço.</li>
              <li>Alimentar análises do Consultor IA.</li>
              <li>Habilitar a funcionalidade da Comunidade de Inspiração, geração de Media Kits e Dashboards de gestores.</li>
            </ul>
            <p className="mb-6">
              Você pode revogar nosso acesso a qualquer momento nas configurações do Facebook/Instagram, mas isso interromperá funcionalidades dependentes desse acesso.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">5. Comunidade de Inspiração Data2Content</h2>
            <p className="mb-2">
              A Comunidade de Inspiração é uma funcionalidade central, onde posts públicos dos usuários são exibidos para outros criadores como exemplos inspiradores.
            </p>
            <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
              <li><strong>Participação Automática:</strong> Ao aceitar estes Termos, você participa automaticamente. Para não participar, exclua sua conta.</li>
              <li><strong>Dados Compartilhados:</strong>
                <ul className="list-circle list-inside mt-2 mb-2 pl-4">
                  <li>Link direto ao post no Instagram.</li>
                  <li>Conteúdo visual e textual conforme exibido publicamente.</li>
                  <li>Classificações de Proposta e Contexto atribuídas por você.</li>
                  <li>Resumo estratégico/criativo gerado por IA.</li>
                  <li>Destaques qualitativos de desempenho, sem exposição de números exatos.</li>
                </ul>
              </li>
              <li><strong>Identificação:</strong> Nome de usuário e perfil acessível ao clicar no link.</li>
              <li><strong>Privacidade:</strong> Métricas numéricas individuais NUNCA são compartilhadas.</li>
              <li><strong>Objetivo:</strong> Fomentar criatividade e aprendizado colaborativo.</li>
              <li><strong>Controle:</strong> Participação condicionada ao uso do serviço; exclusão de conta é única forma de opt-out.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">6. Propriedade Intelectual</h2>
            <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
              <li><strong>Plataforma e Conteúdo:</strong> Serviço, tecnologia e todo conteúdo original (textos, gráficos, logotipos, software) são de propriedade da Mobi Media Produtores de Conteúdo LTDA e licenciadores.</li>
              <li><strong>Seu Conteúdo:</strong> Você mantém direitos sobre o conteúdo criado e publicado no Instagram.</li>
              <li><strong>Licença:</strong> Ao usar o Serviço, concede-nos licença global, não exclusiva e isenta de royalties para usar, reproduzir, processar e exibir seus dados públicos na Plataforma. A licença termina ao desvincular ou excluir sua conta.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">7. Conduta do Usuário e Usos Proibidos</h2>
            <p className="mb-2">Ao usar o Serviço, você concorda em não:</p>
            <ul className="list-disc list-inside mb-6 space-y-2 pl-2">
              <li>Violar leis, regulamentos ou direitos de terceiros.</li>
              <li>Usar para fins ilegais, fraudulentos ou não autorizados.</li>
              <li>Tentar obter acesso não autorizado a sistemas ou dados.</li>
              <li>Interferir no funcionamento ou sobrecarregar nossa infraestrutura.</li>
              <li>Transmitir vírus, malware ou código destrutivo.</li>
              <li>Usar dados do Serviço para violar políticas da Meta ou prejudicar terceiros.</li>
            </ul>
            <p className="mb-6">Reservamo-nos o direito de suspender ou encerrar contas em caso de violação.</p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">8. Isenção de Garantias (Disclaimer)</h2>
            <p className="mb-6">
              O SERVIÇO É FORNECIDO “COMO ESTÁ” E “CONFORME DISPONÍVEL”. NÃO OFERECEMOS GARANTIAS, EXPRESSAS OU IMPLÍCITAS, INCLUINDO COMERCIALIZAÇÃO, ADEQUAÇÃO A UM FIM ESPECÍFICO OU NÃO INFRAÇÃO.
              NÃO GARANTIMOS QUE O SERVIÇO SERÁ ININTERRUPTO, SEGURO OU LIVRE DE ERROS. SEU SUCESSO COMO CRIADOR DEPENDE DE VÁRIOS FATORES, COMO DEDICAÇÃO E EXECUÇÃO.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">9. Limitação de Responsabilidade</h2>
            <p className="mb-6">
              NA MÁXIMA EXTENSÃO PERMITIDA, NÃO SEREMOS RESPONSÁVEIS POR DANOS INDIRETOS, INCIDENTAIS, ESPECIAIS, CONSEQUENCIAIS OU PUNITIVOS, INCLUINDO PERDA DE LUCROS, DADOS OU BOA VONTADE, DECORRENTES DO USO OU DISPONIBILIDADE DO SERVIÇO.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">10. Modificações aos Termos</h2>
            <p className="mb-6">
              Podemos modificar estes Termos a qualquer momento. Se alterações forem materiais, notificaremos com 30 dias de antecedência por e-mail ou notificação na Plataforma. O uso contínuo após as alterações constitui aceitação.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">11. Rescisão</h2>
            <p className="mb-6">
              Podemos encerrar ou suspender seu acesso imediatamente em caso de violação. Você pode encerrar sua conta a qualquer momento. Seções que por natureza devam sobreviver (Propriedade Intelectual, Isenção de Garantias, Limitação de Responsabilidade, Lei Aplicável) permanecerão em vigor.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">12. Lei Aplicável e Jurisdição</h2>
            <p className="mb-6">
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca da Cidade do Rio de Janeiro/RJ para qualquer disputa.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">13. Disposições Gerais</h2>
            <ul className="list-disc list-inside mb-6 space-y-3 pl-2">
              <li><strong>Integralidade do Acordo:</strong> Estes Termos e a Política de Privacidade constituem o acordo completo.</li>
              <li><strong>Renúncia:</strong> A falha em exercer qualquer direito não implica renúncia futura.</li>
              <li><strong>Divisibilidade:</strong> Se qualquer disposição for inválida, as demais permanecem em vigor.</li>
              <li><strong>Títulos:</strong> São apenas para organização e não têm efeito legal.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-800 mt-10 mb-5 border-t border-gray-200 pt-6">14. Contato</h2>
            <p className="mb-6">
              Para dúvidas ou solicitações, envie e-mail para <strong>arthur@data2content.ai</strong>.
            </p>

            <p className="mt-8 font-medium">
              Ao usar o Data2Content, você reconhece que leu, compreendeu e concorda integralmente com estes Termos de Uso.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
