"use client";

import React, { useEffect, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { motion, useAnimation, Variants } from "framer-motion";
import { useInView } from "react-intersection-observer";
// Importando React Icons
import { FaArrowRight, FaGift, FaWhatsapp, FaBrain, FaGoogle, FaStar, FaFileUpload, FaQuestionCircle, FaBell, FaLink, FaLightbulb, FaComments, FaBullseye, FaChartLine, FaUsers, FaFileSignature, FaScroll, FaTags, FaClock } from 'react-icons/fa';

// --- Variantes de Animação (Framer Motion) ---
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: "easeOut"
    }
  }
};

interface AnimatedSectionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
  amount?: number;
}

const AnimatedSection = React.memo(({ children, delay = 0, className = "", once = true, amount = 0.1 }: AnimatedSectionProps) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: once,
    threshold: amount,
  });

  useEffect(() => {
    if (inView) {
      const visibleVariant = fadeInUp.visible;

      // Correção: Verificar se visibleVariant é definido e é um objeto
      if (visibleVariant && typeof visibleVariant === 'object') {
        const baseTransition = visibleVariant.transition || {}; // Default para objeto vazio se transition não estiver definido
        const initialDelay = typeof baseTransition.delay === 'number' ? baseTransition.delay : 0;

        controls.start(i => ({
          ...visibleVariant, // Espalha propriedades como opacity, y
          transition: {
            ...baseTransition, // Espalha propriedades base da transição
            delay: (i as number) * 0.12 + initialDelay, // Adiciona o delay calculado
          },
        }));
      } else {
        // Fallback caso visibleVariant não seja como esperado (ex: undefined ou string)
        // Isso não deve acontecer com a constante fadeInUp atual, mas adiciona robustez
        controls.start({ opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } });
      }
    } else if (!once) {
       controls.start("hidden");
    }
  }, [controls, inView, once]);


  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={fadeInUp}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
});
AnimatedSection.displayName = "AnimatedSection";

export default function HomePage() {
  const { data: session } = useSession();

  const faqItems = useMemo(() => [
       {
           q: "Qual a diferença do Tuca para outros assistentes virtuais ou ferramentas de análise?",
           a: "Ótima pergunta! O Tuca é revolucionário por combinar vários superpoderes em um só lugar, com foco total nos SEUS resultados:\n\n1. **Conexão Direta e Análise Profunda do SEU Instagram:** Diferente de IAs genéricas, você <strong class='font-semibold text-brand-dark'>conecta sua conta do Instagram</strong>. O Tuca não dá conselhos vagos; ele <strong class='font-semibold text-brand-dark'>analisa suas métricas e conteúdos REAIS</strong> (posts, reels, stories). E para posts muito antigos, você pode <strong class='font-semibold text-brand-dark'>enviar prints das métricas e descrever o conteúdo</strong> para uma análise histórica completa!\n\n2. **Entendimento Semântico e Categorização do Conteúdo:** O Tuca vai além dos números! Ele <strong class='font-semibold text-brand-dark'>lê e categoriza as descrições dos seus posts por Formato (Reel, Foto, etc.), Propósito (ex: Dica, Humor) e Contexto (ex: Fitness, Viagem)</strong>. Isso permite identificar padrões valiosos.\n\n3. **Otimização de Horários de Postagem:** O Tuca cruza dados de <strong class='font-semibold text-brand-dark'>horário de postagem, duração do conteúdo, formato, propósito e contexto</strong> para revelar os momentos exatos em que seu público está mais receptivo a cada tipo de post, maximizando seu alcance e engajamento.\n\n4. **Inteligência de um Expert + Proatividade da IA:** O Tuca foi treinado com os 40 anos de experiência de Arthur Marbá. Mas ele vai além: <strong class='font-semibold text-brand-dark'>monitora seu perfil 24/7 e envia alertas e dicas proativas</strong> sobre oportunidades, riscos ou mudanças importantes no seu desempenho, considerando a categoria e o timing do seu conteúdo.\n\n5. **Tudo no WhatsApp, de Forma Conversacional:** Chega de dashboards complicados! Você interage com o Tuca de forma natural, <strong class='font-semibold text-brand-dark'>como uma conversa no WhatsApp</strong>.\n\n6. **Foco em Transformar Dados em Ação e Resultados:** O Tuca não te afoga em dados. Ele te ajuda a <strong class='font-semibold text-brand-dark'>entender o que funciona PARA VOCÊ</strong>, o que precisa ser ajustado, e te dá o 'como fazer', desde ideias de conteúdo, <strong class='font-semibold text-brand-dark'>geração de roteiros para posts de sucesso</strong>, até o melhor formato e dia/hora para postar, considerando seus <strong class='font-semibold text-brand-dark'>objetivos de longo prazo</strong>.\n\n7. **Aprendizado Contínuo e Adaptação Constante:** O Tuca não é uma ferramenta estática. Ele <strong class='font-semibold text-brand-dark'>aprende com cada conversa, registra suas preferências e evolui com você</strong>.\n\n8. **Inspiração da Comunidade (Privacidade em Primeiro Lugar):** O Tuca te conecta a uma <strong class='font-semibold text-brand-dark'>Comunidade de Inspiração</strong>, com exemplos de posts de sucesso de outros criadores (sempre respeitando a privacidade).\n\n9. **Gestão Inteligente de Publicidade:** Registre suas parcerias e <strong class='font-semibold text-brand-dark'>peça ajuda ao Tuca para criar posts para suas 'publis'</strong> e otimizar suas campanhas.\n\nResumindo: o Tuca é seu <strong class='font-semibold text-brand-dark'>consultor estratégico e criativo pessoal para Instagram</strong>, conectado aos seus dados, que <strong class='font-semibold text-brand-dark'>entende profundamente seu conteúdo e o melhor momento para postá-lo</strong>, é proativo, especialista, <strong class='font-semibold text-brand-dark'>que aprende com você, te inspira com a comunidade, te ajuda com suas publis e até gera roteiros</strong>, tudo acessível no WhatsApp."
       },
       {
           q: "Como o Tuca me ajuda a definir o melhor horário e dia para postar?",
           a: "O Tuca vai muito além de dizer 'poste às 18h'! Ele realiza uma <strong class='font-semibold text-brand-dark'>análise combinatória profunda</strong> para te ajudar a encontrar o momento ideal para CADA tipo de conteúdo, visando SEUS objetivos específicos:\n\n1. **Registro de Horários e Datas:** Ao conectar seu Instagram (e ao cadastrar posts antigos via print), o Tuca registra o dia e a hora exata de cada postagem.\n\n2. **Cruzamento com Categorias de Conteúdo:** Ele combina essa informação de horário com a <strong class='font-semibold text-brand-dark'>categorização do seu conteúdo (Formato, Propósito, Contexto)</strong> e também com a <strong class='font-semibold text-brand-dark'>duração do conteúdo</strong> (especialmente para vídeos/Reels).\n\n3. **Análise de Performance por Janela de Tempo:** O Tuca analisa como diferentes combinações performam em diferentes horários e dias da semana. Por exemplo, ele pode identificar que:\n    * Seus <strong class='text-brand-pink'>Reels de Dicas sobre Finanças</strong> têm mais visualizações e salvamentos quando postados às <strong class='text-brand-pink'>terças-feiras, entre 19h e 20h</strong>.\n    * <strong class='text-brand-pink'>Fotos de LifeStyle</strong> geram mais comentários aos <strong class='text-brand-pink'>sábados pela manhã</strong>.\n    * Conteúdos com <strong class='text-brand-pink'>propósito de Chamada para Ação</strong> são mais eficazes nas <strong class='text-brand-pink'>quartas à noite</strong>.\n\n4. **Insights para Seus Objetivos:** Você pode perguntar ao Tuca: 'Qual o melhor horário para postar um Reel de humor para ter mais compartilhamentos?' ou 'Em que dia da semana meus carrosséis educativos costumam ter mais engajamento?'. O Tuca investigará seus dados para te dar respostas personalizadas.\n\n5. **Libere Sua Investigação:** Como o Tuca é uma IA conversacional, você pode <strong class='font-semibold text-brand-dark'>se aprofundar nas perguntas</strong>, explorando diferentes cenários e entendendo os nuances do comportamento da sua audiência para saber exatamente o que postar e quando postar para maximizar seus resultados."
       },
       {
           q: "Como o Tuca me ajuda a criar conteúdo e roteiros?",
           a: "O Tuca é uma ferramenta poderosa para impulsionar sua criatividade e produção de conteúdo! Veja como:\n\n1. **Identificação de Sucessos (Atuais e Antigos):** Ao analisar suas métricas e <strong class='font-semibold text-brand-dark'>categorizar seu conteúdo por formato, propósito e contexto (e horário de postagem)</strong>, o Tuca identifica quais dos <strong class='font-semibold text-brand-dark'>seus próprios posts e tipos de conteúdo tiveram melhor desempenho</strong> e porquê.\n\n2. **Geração de Roteiros e Estruturas com Base em Padrões:** Com base nesses posts de sucesso e nos padrões identificados (ex: 'Reels de Dicas sobre Finanças performam bem às terças, 19h'), você pode pedir ao Tuca: 'Tuca, meu post sobre [tema X] bombou! Me ajuda com um roteiro para um Reel explorando mais isso?' ou 'Qual a estrutura daquele Carrossel de [propósito Y] que teve tantos salvamentos?'. O Tuca pode te fornecer:\n    * <strong class='font-semibold text-brand-dark'>Estruturas de Roteiro:</strong> Tópicos principais, sequência de informações, call-to-actions, adaptados ao formato, propósito e melhor horário.\n    * <strong class='font-semibold text-brand-dark'>Ideias para Variações:</strong> Como abordar o mesmo tema de sucesso sob novos ângulos ou em diferentes formatos que também costumam funcionar para aquele contexto e timing.\n    * <strong class='font-semibold text-brand-dark'>Pontos Chave para Destacar:</strong> Elementos (descrição, tipo de chamada, etc.) que provavelmente contribuíram para o sucesso do post original.\n\n3. **Superando o Bloqueio Criativo:** Em vez de começar do zero, você usa o que <strong class='font-semibold text-brand-dark'>já funcionou para o SEU público e para combinações específicas de conteúdo e horário</strong> como ponto de partida.\n\n4. **Criatividade Direcionada por Dados e Contexto:** Não é só sobre ter ideias, mas ter <strong class='font-semibold text-brand-dark'>ideias com maior probabilidade de sucesso</strong>, porque são baseadas na análise do seu próprio desempenho, na categorização do seu conteúdo e nas preferências da sua audiência que o Tuca aprendeu.\n\nO Tuca, portanto, não é apenas um analista, mas um <strong class='font-semibold text-brand-dark'>parceiro criativo</strong> que te ajuda a replicar seus melhores momentos e a otimizar seu processo de criação de conteúdo de forma inteligente e direcionada."
       },
       {
           q: "Como funcionam os alertas proativos do Tuca? Ele me avisa sobre o quê exatamente?",
           a: "Sim, o Tuca é seu <strong class='font-semibold text-brand-dark'>assistente proativo e vigilante que aprende com você</strong>! Ao conectar seu Instagram (e opcionalmente <strong class='font-semibold text-brand-dark'>cadastrar métricas de posts antigos via print e ter suas descrições analisadas</strong>), ele passa a monitorar seu desempenho continuamente. Usando um motor de regras inteligente, treinado com a expertise de Arthur Marbá e <strong class='font-semibold text-brand-dark'>refinado pelas suas interações, preferências e pela categorização do seu conteúdo (incluindo horários)</strong>, o Tuca detecta automaticamente uma variedade de situações, por exemplo:\n\n* <strong class='font-semibold text-brand-dark'>Picos de Performance Inesperados (com contexto e timing):</strong> 'Uau! Seu <strong class='text-brand-pink'>Reel</strong> com propósito <strong class='text-brand-pink'>Dica</strong> sobre <strong class='text-brand-pink'>[tema]</strong>, postado <strong class='text-brand-pink'>[dia/hora]</strong>, teve <strong class='text-brand-pink'>X compartilhamentos</strong> no 3º dia, muito acima da sua média para esse tipo de conteúdo nesse horário. Considere explorar mais esse assunto! <strong class='text-brand-pink'>Quer ajuda para criar um roteiro com base nele?</strong>'\n* <strong class='font-semibold text-brand-dark'>Quedas Preocupantes (por categoria e horário):</strong> 'Atenção: o tempo médio de visualização dos seus <strong class='text-brand-pink'>Reels</strong> com propósito <strong class='text-brand-pink'>Humor</strong> postados <strong class='text-brand-pink'>[dia/hora]</strong> caiu para <strong class='text-brand-pink'>Y segundos</strong>, enquanto sua média histórica para esse tipo e horário era Z. Vamos analisar o que pode ter mudado?'\n* <strong class='font-semibold text-brand-dark'>Melhor Dia, Horário, Formato e Propósito:</strong> 'Lembrete: <strong class='text-brand-pink'>[Formato]</strong> com propósito <strong class='text-brand-pink'>[Propósito]</strong> sobre <strong class='text-brand-pink'>[Contexto] às [Horas] de [Dia da Semana]</strong> costuma ter um engajamento <strong class='text-brand-pink'>X% maior</strong> para você. Que tal programar algo especial?'\n\nEsses são apenas alguns exemplos! Os alertas e insights são enviados <strong class='font-semibold text-brand-dark'>diretamente para o seu WhatsApp</strong>, de forma clara e com sugestões cada vez mais alinhadas ao que você precisa e aos seus <strong class='font-semibold text-brand-dark'>objetivos de longo prazo</strong>. As dicas diárias também podem incluir <strong class='font-semibold text-brand-dark'>inspirações relevantes da Comunidade Tuca</strong>."
       },
       {
           q: "O que é a Comunidade de Inspiração Tuca e como ela funciona?",
           a: "A <strong class='font-semibold text-brand-dark'>Comunidade de Inspiração Tuca</strong> é um recurso poderoso para destravar sua criatividade! Funciona assim:\n\n1. **Base de Exemplos Reais:** O Tuca tem acesso a uma base de posts de sucesso (com resumos estratégicos e destaques qualitativos, <strong class='font-semibold text-brand-dark'>categorizados por formato, propósito e contexto</strong>) de outros criadores da plataforma Data2Content que consentiram em compartilhar.\n\n2. **Você Pede, o Tuca Busca:** Precisa de ideias para um Reel sobre 'receitas rápidas para o jantar'? Ou quer ver exemplos de posts de 'viagem econômica' que tiveram bom engajamento qualitativo? Basta pedir ao Tuca no WhatsApp! Você pode especificar o <strong class='font-semibold text-brand-dark'>formato, proposta (tema) e contexto</strong>.\n\n3. **Inspiração com Foco na Estratégia (e Privacidade Total):** O Tuca te apresentará exemplos relevantes, mostrando o <strong class='font-semibold text-brand-dark'>resumo do conteúdo, os destaques de performance qualitativa</strong> e um <strong class='font-semibold text-brand-dark'>link para o post original no Instagram</strong>. <strong class='font-semibold text-brand-pink'>Importante: O Tuca NUNCA compartilha métricas numéricas de posts de outros usuários.</strong> O foco é na inspiração estratégica e criativa.\n\n4. **Inspiração nas Dicas Diárias:** Além de pedir sob demanda, o Tuca também pode incluir uma inspiração relevante da comunidade nas suas dicas diárias de conteúdo, para te dar aquele empurrãozinho criativo!\n\nÉ uma forma de aprender com exemplos reais, ver o que outros criadores estão fazendo bem e superar bloqueios criativos, tudo com a curadoria inteligente do Tuca e o respeito à privacidade dos dados."
       },
       {
           q: "Como o Tuca me ajuda com minhas parcerias publicitárias ('publis')?",
           a: "O Tuca é seu aliado estratégico também na hora de monetizar com publicidade! Veja como:\n\n1. **Registro Centralizado de Parcerias:** Dentro da plataforma Data2Content, você terá um espaço para <strong class='font-semibold text-brand-dark'>registrar todos os detalhes das suas parcerias publicitárias</strong>.\n\n2. **Brainstorm de Conteúdo para 'Publis':** Uma vez que uma parceria está registrada, você pode pedir ajuda ao Tuca: 'Tuca, me dê ideias de Reels para a campanha com a <strong class='text-brand-pink'>[Nome da Marca]</strong> sobre <strong class='text-brand-pink'>[Produto/Serviço]</strong>, focando em <strong class='text-brand-pink'>[Objetivo da Campanha da Marca]</strong>'. O Tuca usará as informações da parceria, seu conhecimento sobre seu perfil e <strong class='font-semibold text-brand-dark'>os tipos de conteúdo (formato, propósito, contexto, melhor horário) que melhor performam para você</strong> para sugerir posts criativos e eficazes.\n\n3. **Análise e Otimização (Potencial Futuro):** Com os dados das suas parcerias registrados, o Tuca poderá, no futuro, te ajudar a <strong class='font-semibold text-brand-dark'>analisar propostas e entender melhor o retorno</strong> das suas 'publis'.\n\n4. **Histórico para Negociações:** Ter um histórico detalhado das suas parcerias te dá mais embasamento para futuras negociações com marcas.\n\nO objetivo é que você não apenas feche parcerias, mas também crie conteúdo patrocinado que seja autêntico, engajador e que traga resultados tanto para você quanto para a marca, tudo com o suporte inteligente do Tuca."
       },
       {
           q: "Como funciona o programa de afiliados? Todos podem participar?",
           a: "Sim, todos os usuários do Data2Content, mesmo os que utilizam o plano gratuito, se tornam afiliados automaticamente ao criar a conta! Funciona assim:\n\n1. **Você Recebe um Cupom:** Ao se cadastrar, você ganha um cupom de desconto exclusivo para compartilhar.\n2. **Seu Amigo Ganha Desconto:** Quando alguém utiliza o seu cupom para assinar um plano pago do Tuca, essa pessoa recebe 10% de desconto na assinatura.\n3. **Você Ganha Comissão:** Você recebe 10% de comissão recorrente sobre o valor da assinatura paga pelo seu amigo, enquanto ele mantiver a assinatura ativa.\n\nÉ uma forma de você lucrar ajudando seus amigos a também terem acesso à consultoria inteligente, proativa e <strong class='font-semibold text-brand-dark'>personalizada pelo aprendizado contínuo e inspirada pela comunidade</strong> do Tuca!"
       },
       { q: "O Data2Content é realmente gratuito para começar?", a: "Sim! Você pode criar sua conta gratuitamente e já se torna um afiliado com acesso ao seu cupom. Funcionalidades básicas da plataforma também estão disponíveis. O poder completo do Tuca, incluindo a <strong class='font-semibold text-brand-dark'>análise profunda conectada ao seu Instagram (e via prints), a categorização de conteúdo, a otimização de horários, os alertas proativos, o aprendizado contínuo, o acesso à Comunidade de Inspiração, a geração de roteiros e as ferramentas de gestão de publicidade</strong>, são parte do nosso plano premium." },
       { q: "Como o Tuca acessa meus resultados do Instagram e aprende comigo? É seguro?", a: "A segurança e privacidade dos seus dados são nossa prioridade máxima. Para uma análise profunda, personalizada e que evolui com você, o Tuca <strong class='font-semibold text-brand-dark'>precisa acessar os dados diretamente do seu perfil do Instagram e aprender com suas interações</strong>. Isso acontece de forma segura e com sua permissão:\n\n1.  **Login e Conexão Segura com Instagram:** Ao se cadastrar, você <strong class='font-semibold text-brand-dark'>conecta sua conta profissional do Instagram</strong>. Isso permite ao Tuca buscar seus resultados de performance, métricas de posts (incluindo horários), insights da conta e <strong class='font-semibold text-brand-dark'>analisar as descrições para categorizar seu conteúdo</strong> automaticamente.\n\n2.  **Envio de Prints e Descrições para Conteúdo Antigo:** Para posts muito antigos ou que não podem ser sincronizados automaticamente, você pode <strong class='font-semibold text-brand-dark'>enviar um print das métricas (incluindo data/hora se disponível) e descrever o conteúdo</strong>. O Tuca então cadastra essas informações e <strong class='font-semibold text-brand-dark'>também categoriza essa descrição</strong>, enriquecendo seu histórico e as análises futuras.\n\n3.  **Aprendizado com Interações e Preferências:** Durante suas conversas com o Tuca no WhatsApp, ele <strong class='font-semibold text-brand-dark'>registra suas preferências, objetivos de longo prazo e fatos chave sobre seu negócio</strong>. Esses dados são usados para refinar as análises futuras, tornando o Tuca cada vez mais um especialista no SEU perfil e nos SEUS objetivos.\n\nTodos os dados são tratados com confidencialidade, seguindo as diretrizes do Instagram e a LGPD. Você tem total controle sobre a conexão e pode solicitar a exclusão dos seus dados a qualquer momento." },
       { q: "Preciso ter uma conta profissional do Instagram?", a: "Sim, para que o Tuca possa <strong class='font-semibold text-brand-dark'>analisar seus dados e conteúdos diretamente do seu perfil</strong> (via conexão direta ou prints que você envia), <strong class='font-semibold text-brand-dark'>categorizar suas descrições, otimizar horários de postagem</strong>, oferecendo insights personalizados, alertas proativos e <strong class='font-semibold text-brand-dark'>aprendendo com você</strong> através da conexão segura, é necessário ter uma conta Profissional (Comercial ou Criador de Conteúdo) no Instagram vinculada a uma Página do Facebook." },
   ], []);


  return (
    <>
      <Head>
        <title>Data2Content: Tuca, sua IA que otimiza horários, analisa conteúdo, cria roteiros, aprende com você, te inspira e otimiza suas publis, conectada ao Instagram, direto no WhatsApp</title> {/* Título Atualizado */}
        <meta
          name="description"
          content="Conecte seu Instagram ao Tuca (ou envie prints antigos!), sua IA que otimiza horários, analisa e categoriza seu conteúdo, gera roteiros, te dá consultoria, alertas proativos, aprende com você, te inspira com a comunidade e ajuda com suas publis, tudo no WhatsApp. Indispensável para criadores!" /* Descrição Atualizada */
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="bg-white text-brand-dark font-sans">

        <header className="fixed top-0 left-0 w-full py-3 px-4 md:px-6 z-50 bg-white/90 backdrop-blur-md shadow-sm transition-all duration-300">
             <div className="max-w-7xl mx-auto flex justify-between items-center h-12 md:h-14">
                <Link href="/" className="font-bold text-xl md:text-2xl text-brand-dark">Data2Content</Link>
                <nav className="hidden md:flex space-x-5 lg:space-x-8">
                    <a href="#tuca-ia" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">O Poder do Tuca</a>
                    <a href="#tuca-proativo" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Tuca Proativo</a>
                    <a href="#comunidade-inspiracao" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Comunidade</a>
                    <a href="#tuca-parcerias" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Tuca & Publis</a>
                    <a href="#monetizacao" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Monetização</a>
                    <a href="#arthur-marba" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Arthur Marbá</a>
                    <a href="#como-funciona" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Como Funciona</a>
                    <a href="#faq" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">FAQ</a>
                </nav>
                {!session ? (
                     <button
                        onClick={() => signIn("google", { callbackUrl: "/auth/complete-signup" })}
                        className="px-5 py-2 md:px-6 md:py-2.5 text-xs md:text-sm font-medium text-brand-dark border border-gray-300 rounded-full hover:bg-gray-100 transition-colors duration-150"
                    >
                        Entrar com Google
                    </button>
                ) : (
                     <Link
                        href="/dashboard"
                        className="px-5 py-2 md:px-6 md:py-2.5 text-xs md:text-sm font-medium text-white bg-brand-pink rounded-full hover:opacity-90 transition-opacity duration-150"
                    >
                        Meu Painel
                    </Link>
                )}
            </div>
        </header>

        <section id="hero" className="relative flex flex-col items-center justify-center text-center px-4 min-h-screen pt-20 md:pt-24 pb-16 md:pb-24 bg-brand-light overflow-hidden">
            <div className="absolute -top-20 -left-20 w-72 h-72 md:w-96 md:h-96 bg-brand-pink/5 rounded-full filter blur-3xl opacity-60 md:opacity-70 animate-pulse-slow"></div>
            <div className="absolute -bottom-20 -right-20 w-72 h-72 md:w-96 md:h-96 bg-brand-red/5 rounded-full filter blur-3xl opacity-60 md:opacity-70 animate-pulse-slow animation-delay-2000"></div>

            <div className="relative z-10 max-w-4xl mx-auto">
                <AnimatedSection delay={0} className="mb-6">
                    <span className="inline-flex flex-wrap items-center justify-center px-3 py-2 bg-white border border-gray-200 text-brand-pink text-sm font-semibold rounded-full shadow-sm gap-x-2 gap-y-1">
                        <span className="inline-flex items-center"><FaLink className="mr-1 mb-0.5 text-blue-500"/>Instagram Conectado</span>
                        <span className="inline-flex items-center"><FaFileUpload className="mr-1 mb-0.5 text-gray-500"/>Métricas via Print</span>
                        <span className="inline-flex items-center"><FaTags className="mr-1 mb-0.5 text-indigo-500"/>Conteúdo Categorizado</span>
                        <span className="inline-flex items-center"><FaClock className="mr-1 mb-0.5 text-cyan-500"/>Horários Otimizados</span> {/* NOVO BADGE */}
                        <span className="inline-flex items-center"><FaComments className="mr-1 mb-0.5"/>IA que Aprende</span>
                        <span className="inline-flex items-center"><FaScroll className="mr-1 mb-0.5 text-teal-500"/>Roteiros Inteligentes</span>
                        <span className="inline-flex items-center"><FaUsers className="mr-1 mb-0.5 text-purple-500"/>Inspiração da Comunidade</span>
                        <span className="inline-flex items-center"><FaFileSignature className="mr-1 mb-0.5 text-orange-500"/>Gestor de Publis</span>
                        <span className="inline-flex items-center"><FaWhatsapp className="mr-1 mb-0.5 text-green-500"/>Consultor</span>
                        <span className="inline-flex items-center"><FaGift className="mr-1 mb-0.5"/>Ganhe Indicando</span>
                    </span>
                </AnimatedSection>
                <AnimatedSection delay={0.1}>
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-brand-dark mb-8 leading-[1.1] tracking-tighter">
                         Decole seu Instagram com Tuca: <span className="text-brand-pink">Sua IA que Otimiza Horários, Entende Seu Conteúdo, Cria Roteiros, Aprende com Você, te Inspira e Otimiza suas Publis.</span>
                    </h1>
                </AnimatedSection>
                <AnimatedSection delay={0.2}>
                    <p className="text-lg md:text-xl lg:text-2xl text-gray-700 mb-12 max-w-3xl mx-auto font-light leading-relaxed md:leading-loose">
                        Cansado de postar no escuro? <strong className="font-semibold text-brand-dark">Conecte seu Instagram (ou envie prints de posts antigos!)</strong> e deixe o Tuca, sua IA especialista, <strong className="font-semibold text-brand-dark">analisar suas métricas, entender o tema, propósito e formato de cada post, e descobrir a hora certa de postar cada tipo de conteúdo</strong>. Receba estratégias personalizadas, dicas diárias, <strong className="font-semibold text-brand-dark">alertas proativos</strong>, <strong className="font-semibold text-brand-dark">roteiros para replicar seus sucessos</strong>, <strong className="font-semibold text-brand-dark">inspiração da comunidade</strong> e <strong className="font-semibold text-brand-dark">suporte para suas parcerias publicitárias</strong>. O Tuca <strong className="font-semibold text-brand-dark">aprende com você, seus objetivos e preferências</strong>, tornando-se cada vez mais seu parceiro estratégico ideal. Tudo <strong className="font-semibold text-brand-dark">direto no seu WhatsApp</strong>. Transforme seus resultados e ganhe dinheiro indicando amigos!
                    </p>
                </AnimatedSection>
                <AnimatedSection delay={0.3}>
                    {!session ? (
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/auth/complete-signup" })}
                            className="shimmer-button inline-flex items-center gap-3 px-8 py-4 md:px-10 md:py-4 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base md:text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                            <FaLink className="w-5 h-5" />
                            Conectar Instagram Grátis e Decolar
                        </button>
                     ) : (
                         <Link
                            href="/dashboard"
                            className="shimmer-button inline-block px-8 py-4 md:px-10 md:py-4 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base md:text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                         >
                            Acessar meu Painel
                         </Link>
                     )}
                    <p className="text-sm text-gray-500 mt-6 font-light">
                        Conexão segura e gratuita. Afiliação instantânea. Resultados transformadores.
                    </p>
                </AnimatedSection>
            </div>
            <AnimatedSection delay={0.4} className="mt-20 md:mt-24 w-full max-w-4xl lg:max-w-5xl mx-auto">
                 <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden p-2 md:p-4">
                     <span className="text-gray-400 text-center text-base md:text-lg font-light p-4">[Vídeo de Demonstração: Veja o Tuca analisando horários e conteúdo, gerando um roteiro, mostrando inspirações, ajudando com publis e enviando insights no WhatsApp]</span>
                 </div>
            </AnimatedSection>
        </section>

        <section className="py-16 md:py-24 px-4 bg-white">
            <div className="max-w-3xl mx-auto text-center">
                <AnimatedSection delay={0}>
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-6">Posta, posta e nada acontece? Confuso com o algoritmo, perdido nas 'publis', sem ideias e sem saber a melhor hora? O Tuca é a solução completa.</h2>
                    <p className="text-lg text-gray-700 font-light leading-relaxed">
                        Pare de adivinhar o que funciona! Entender o que realmente engaja, <strong className="font-semibold text-brand-pink">saber quando postar cada tipo de conteúdo</strong>, criar de forma consistente, gerenciar suas parcerias de forma eficaz e transformar seguidores em resultados exige <strong className="font-semibold text-brand-pink">estratégia baseada em dados REAIS do SEU perfil (atuais e históricos!), que analisa a fundo o TIPO de conteúdo e o TIMING, se adapta a VOCÊ, se inspira no SUCESSO COLETIVO e te ajuda a PRODUZIR</strong>. O Data2Content te entrega exatamente isso com o Tuca: seu consultor e assistente criativo IA <strong className="font-semibold text-brand-dark">conectado ao seu Instagram (e aos seus prints)</strong>, analisando suas métricas, <strong className="font-semibold text-brand-dark">categorizando suas descrições e horários</strong>, <strong className="font-semibold text-brand-dark">aprendendo com suas preferências e objetivos</strong>, te oferecendo <strong className="font-semibold text-brand-dark">exemplos da comunidade</strong>, te ajudando a <strong className="font-semibold text-brand-dark">otimizar suas 'publis'</strong>, <strong className="font-semibold text-brand-dark">gerando roteiros</strong> e te guiando no WhatsApp. É a clareza, a direção, a <strong className="font-semibold text-brand-pink">personalização contínua, a inspiração e o impulso criativo</strong> que faltavam para você decolar.
                    </p>
                </AnimatedSection>
            </div>
        </section>

        <section id="depoimentos" className="py-16 md:py-24 px-4 bg-brand-light">
              <div className="max-w-5xl mx-auto text-center">
                 <AnimatedSection delay={0}>
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-6">Criadores como Você Estão Transformando Seus Resultados com o Tuca:</h2>
                    <p className="text-lg text-gray-700 mb-16 md:mb-20 max-w-xl mx-auto font-light leading-relaxed">Veja o que eles dizem sobre ter o Tuca <strong className="font-semibold text-brand-dark">analisando e categorizando seus dados reais (incluindo prints antigos e horários!)</strong>, enviando <strong className="font-semibold text-brand-dark">alertas, dicas cada vez mais personalizadas, inspirações da comunidade, ajudando com parcerias e até criando roteiros</strong> no WhatsApp:</p>
                 </AnimatedSection>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
                     <AnimatedSection delay={0.1} className="bg-white p-6 md:p-8 rounded-2xl shadow-lg text-left flex flex-col items-center sm:flex-row sm:items-start sm:text-left gap-6">
                         <div className="w-16 h-16 md:w-[72px] md:h-[72px] bg-pink-200 rounded-full flex-shrink-0 border-4 border-white shadow-md flex items-center justify-center text-pink-600 font-semibold text-lg" aria-label="Avatar Criador 1">C1</div>
                         <div>
                            <p className="text-brand-dark italic mb-4 font-light leading-relaxed text-base">"Finalmente entendi o que funciona para MIM e QUANDO postar! O Tuca <strong className='font-semibold'>analisa meu perfil, categoriza meus posts, descobre meus melhores horários, aprende o que eu gosto, meus objetivos, e me dá o caminho das pedras no WhatsApp</strong>. Os alertas de posts bombando, as <strong className='font-semibold'>inspirações da comunidade</strong>, a ajuda para <strong className='font-semibold'>planejar minhas 'publis'</strong> e os <strong className='font-semibold'>roteiros que ele gera</strong> são incríveis! E já ganhei uma grana indicando, super recomendo!"</p>
                            <p className="font-semibold text-base text-brand-dark">- Nome do Criador 1</p>
                            <p className="text-sm text-brand-pink font-medium">Criador de Conteúdo Instagram - Nicho Viagem</p>
                         </div>
                     </AnimatedSection>
                     <AnimatedSection delay={0.2} className="bg-white p-6 md:p-8 rounded-2xl shadow-lg text-left flex flex-col items-center sm:flex-row sm:items-start sm:text-left gap-6">
                          <div className="w-16 h-16 md:w-[72px] md:h-[72px] bg-green-200 rounded-full flex-shrink-0 border-4 border-white shadow-md flex items-center justify-center text-green-600 font-semibold text-lg" aria-label="Avatar Criador 2">C2</div>
                         <div>
                            <p className="text-brand-dark italic mb-4 font-light leading-relaxed text-base">"Ter uma IA que <strong className='font-semibold'>realmente entende meu Instagram (até meus posts antigos com prints e suas descrições e horários!), aprende comigo, me mostra exemplos de outros criadores, me ajuda com as 'publis', cria roteiros para mim e me avisa sobre tudo</strong> no WhatsApp é revolucionário. O Tuca me mostra oportunidades que eu nem via e as dicas ficam melhores e mais alinhadas com o que busco a cada semana. Indispensável!"</p>
                            <p className="font-semibold text-base text-brand-dark">- Nome do Criador 2</p>
                            <p className="text-sm text-brand-pink font-medium">Afiliado e Criador Instagram - Nicho Fitness</p>
                         </div>
                     </AnimatedSection>
                 </div>
            </div>
        </section>

        <section id="tuca-ia" className="py-16 md:py-24 px-4 bg-white overflow-hidden"> {/* Seção Principal do Tuca */}
              <div className="max-w-6xl mx-auto space-y-10">
                <AnimatedSection delay={0} className="text-center">
                   <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-brand-dark mb-6 leading-tight">O Poder do Tuca: Sua Inteligência Estratégica e Criativa para o Instagram, <span className="text-brand-pink">Completa e Sempre Evoluindo com Você</span></h2>
                   <p className="text-xl text-gray-700 font-light leading-relaxed max-w-3xl mx-auto">
                       O Tuca não é apenas um chatbot. É seu <strong className="font-semibold text-brand-dark">consultor pessoal, analista dedicado, roteirista inteligente, curador de inspirações e assistente de parcerias</strong>, treinado por um dos maiores especialistas do mercado, <strong className="font-semibold text-brand-dark">conectado diretamente aos dados do SEU Instagram (e aos seus prints antigos), que analisa e categoriza seu conteúdo e horários</strong> e <strong className="font-semibold text-brand-dark">que aprende continuamente com suas interações, preferências e objetivos para se tornar seu especialista particular</strong>. Ele trabalha para você 24/7, direto no WhatsApp.
                   </p>
                </AnimatedSection>

                <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                     <AnimatedSection delay={0.1} className="aspect-w-1 aspect-h-1 bg-gradient-to-br from-red-50 to-purple-50 rounded-3xl shadow-lg flex items-center justify-center p-6 order-last md:order-first">
                        <span className="text-purple-700 text-center text-xl p-4">[Ilustração: Tuca no WhatsApp mostrando análise categorizada de conteúdo e horários, um roteiro gerado, um exemplo da comunidade, uma sugestão para 'publi' e um ícone de cérebro evoluindo]</span>
                    </AnimatedSection>
                    <AnimatedSection delay={0} className="order-first md:order-last">
                         <div className="mb-4 flex items-center space-x-2 md:space-x-3 flex-wrap justify-center md:justify-start"> {/* Ajustado para wrap e centralizar em mobile */}
                            <span className="inline-flex items-center m-1"><FaLink className="w-8 h-8 md:w-10 text-blue-500" /></span>
                            <span className="inline-flex items-center m-1"><FaFileUpload className="w-7 h-7 md:w-9 text-gray-500" /></span>
                            <span className="inline-flex items-center m-1"><FaTags className="w-7 h-7 md:w-9 text-indigo-500" /></span>
                            <span className="inline-flex items-center m-1"><FaClock className="w-7 h-7 md:w-9 text-cyan-500" /></span> {/* Ícone para Horários */}
                            <span className="inline-flex items-center m-1"><FaBrain className="w-8 h-8 md:w-10 text-brand-red" /></span>
                            <span className="inline-flex items-center m-1"><FaScroll className="w-7 h-7 md:w-9 text-teal-500" /></span>
                            <span className="inline-flex items-center m-1"><FaComments className="w-7 h-7 md:w-9 text-brand-pink" /></span>
                            <span className="inline-flex items-center m-1"><FaBullseye className="w-7 h-7 md:w-9 text-green-500" /></span>
                            <span className="inline-flex items-center m-1"><FaUsers className="w-8 h-8 md:w-10 text-purple-500" /></span>
                            <span className="inline-flex items-center m-1"><FaFileSignature className="w-7 h-7 md:w-9 text-orange-500" /></span>
                            <span className="inline-flex items-center m-1"><FaWhatsapp className="w-8 h-8 md:w-10 text-green-600" /></span>
                         </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-brand-dark mb-4 leading-tight">Análise Profunda (Atual, Histórica, Categorizada e Temporal), Geração de Roteiros, Inspiração, Estratégia para Publis e Evolução Contínua</h3>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-4">
                            Chega de achismos e bloqueios criativos! <strong className="font-semibold text-brand-dark">Conecte seu Instagram</strong> e deixe o Tuca mergulhar nas suas <strong className="font-semibold text-brand-dark">métricas e conteúdos reais</strong>. Ele te ajuda a:
                        </p>
                        <ul className="list-disc list-inside text-lg text-gray-700 font-light leading-relaxed space-y-2 mb-6">
                            <li><strong className="font-medium text-brand-dark">Entender o que Realmente Funciona para SEU Público:</strong> Descubra seus posts de maior impacto, melhores formatos, temas e horários.</li>
                            <li><strong className="font-medium text-brand-dark">Visão Histórica Completa com Prints <FaFileUpload className="inline ml-1.5 mb-0.5 text-gray-500"/>:</strong> Envie prints de posts antigos, descreva o conteúdo e o Tuca incorpora essas métricas e <strong className="font-medium">categorizações</strong> na análise.</li>
                            <li><strong className="font-medium text-brand-dark">Análise Profunda de Descrições e Conteúdo <FaTags className="inline ml-1.5 mb-0.5 text-indigo-500"/>:</strong> O Tuca lê e <strong className="font-medium">categoriza seus posts por Formato, Propósito e Contexto</strong>.</li>
                            <li><strong className="font-medium text-brand-dark">Descubra o Momento Perfeito para Cada Conteúdo <FaClock className="inline ml-1.5 mb-0.5 text-cyan-500"/>:</strong> O Tuca cruza dados de <strong className="font-medium">horário de postagem, duração do conteúdo, formato, propósito e contexto</strong> para revelar os momentos exatos em que seu público está mais receptivo.</li>
                            <li><strong className="font-medium text-brand-dark">Transformar Sucesso em Mais Sucesso com Roteiros Inteligentes <FaScroll className="inline ml-1.5 mb-0.5 text-teal-500"/>:</strong> Seu conteúdo (ou uma combinação específica de formato/propósito/contexto/horário) engajou? O Tuca pode <strong className="font-medium">gerar roteiros e estruturas</strong> para você replicar esse sucesso.</li>
                            <li><strong className="font-medium text-brand-dark">Receber Recomendações Estratégicas Alinhadas aos Seus Objetivos <FaBullseye className="inline ml-1.5 mb-0.5 text-green-500"/>:</strong> Ideias de conteúdo e planejamento de Stories que te ajudam a alcançar suas <strong className="font-medium">metas de longo prazo</strong>.</li>
                            <li><strong className="font-medium text-brand-dark">Aprender com um Expert (Aplicado a Você):</strong> Conselhos de Arthur Marbá, interpretados pela IA sobre o seu desempenho real e específico.</li>
                            <li><strong className="font-medium text-brand-dark">Evolução Contínua com Você <FaComments className="inline ml-1.5 mb-0.5 text-brand-pink"/>:</strong> O Tuca registra suas <strong className="font-medium">preferências</strong> e aprende com suas conversas, refinando as análises.</li>
                            <li><strong className="font-medium text-brand-dark">Inspirar-se com a Comunidade <FaUsers className="inline ml-1.5 mb-0.5 text-purple-500"/>:</strong> Peça e receba exemplos de posts de sucesso de outros criadores.</li>
                            <li><strong className="font-medium text-brand-dark">Otimizar Suas Parcerias Publicitárias <FaFileSignature className="inline ml-1.5 mb-0.5 text-orange-500"/>:</strong> Registre suas 'publis' e peça ajuda ao Tuca para criar posts patrocinados autênticos e eficazes.</li>
                        </ul>
                        <p className="text-lg text-gray-700 font-light leading-relaxed">
                           Tenha um especialista que não só te entende hoje, mas <strong className="font-semibold text-brand-dark">evolui junto com você, seu perfil, seus objetivos, te conecta à inteligência coletiva, te ajuda a criar e a monetizar melhor</strong>, tudo com a facilidade do WhatsApp e insights tirados diretamente do seu Instagram (e dos seus prints!).
                        </p>
                    </AnimatedSection>
                </div>
               </div>
        </section>

        {/* Seção Tuca Proativo */}
        <section id="tuca-proativo" className="py-16 md:py-24 px-4 bg-brand-light overflow-hidden">
            <div className="max-w-6xl mx-auto">
                <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                    <AnimatedSection delay={0.1} className="aspect-w-1 aspect-h-1 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl shadow-lg flex items-center justify-center p-6">
                        <span className="text-indigo-700 text-center text-xl p-4">[Ilustração: Celular com WhatsApp mostrando um alerta do Tuca sobre um tipo de conteúdo (ex: Reel de Dicas sobre Finanças) performando bem em um dia e horário específico, com sugestão de roteiro]</span>
                    </AnimatedSection>
                    <AnimatedSection delay={0}>
                        <div className="mb-4 flex items-center space-x-3">
                            <FaBell className="w-11 h-11 md:w-12 md:h-12 text-brand-pink" />
                            <FaChartLine className="w-10 h-10 md:w-11 md:h-11 text-blue-500" />
                            <FaClock className="w-10 h-10 md:w-11 md:h-11 text-cyan-500" />
                            <FaScroll className="w-10 h-10 md:w-11 md:h-11 text-teal-500" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-brand-dark mb-4 leading-tight">Tuca Proativo: Alertas, Insights e Sugestões Criativas Baseadas na Análise Profunda do Seu Conteúdo e Timing</h3>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-4">
                            O Tuca não espera você perguntar. Ele <strong className="font-semibold text-brand-dark">monitora seu Instagram conectado (e considera seus prints antigos, a categorização do seu conteúdo e os horários de postagem) 24/7</strong> e te avisa sobre o que realmente importa para SEU perfil. E o melhor: <strong className="font-semibold text-brand-dark">quanto mais você interage e informa suas preferências e objetivos, mais precisos e relevantes se tornam esses alertas</strong>. Veja exemplos:
                        </p>
                        <ul className="list-disc list-inside text-lg text-gray-700 font-light leading-relaxed space-y-2 mb-6">
                            <li><strong className="font-medium text-brand-dark">Picos de Performance por Categoria e Horário:</strong> "Seus <strong className='text-brand-pink'>Reels</strong> com propósito <strong className='text-brand-pink'>Dica</strong> sobre <strong className='text-brand-pink'>Finanças</strong>, postados <strong className='text-brand-pink'>Quinta às 18h</strong>, tiveram um pico de <strong className="text-brand-pink">[Nº] compartilhamentos</strong>! Que tal um novo roteiro explorando mais isso nesse horário?"</li>
                            <li><strong className="font-medium text-brand-dark">Queda no Desempenho de um Tipo de Conteúdo em Horário Específico:</strong> "O tempo médio de visualização dos seus <strong className='text-brand-pink'>Carrosséis</strong> com propósito <strong className='text-brand-pink'>Review</strong> postados <strong className='text-brand-pink'>Sábado à tarde</strong> caiu para <strong className="text-brand-pink">[Tempo]</strong>. Vamos analisar o que mudou?"</li>
                            <li><strong className="font-medium text-brand-dark">Melhor Combinação (Dia, Horário, Formato, Propósito, Contexto):</strong> "Lembrete: <strong className="text-brand-pink">Fotos</strong> com propósito <strong className="text-brand-pink">LifeStyle</strong> sobre <strong className="text-brand-pink">Viagem às Sextas-feiras, 10h</strong>, costumam ter ótimo engajamento para você. Já pensou no próximo?"</li>
                        </ul>
                        <p className="text-lg text-gray-700 font-light leading-relaxed">
                           Com os alertas e a proatividade do Tuca, <strong className="font-semibold text-brand-dark">que se aprimoram com seu uso, feedback e objetivos informados</strong>, você está sempre um passo à frente, com mais estratégia e criatividade.
                        </p>
                    </AnimatedSection>
                </div>
            </div>
        </section>

       {/* Seção Comunidade de Inspiração Tuca */}
       <section id="comunidade-inspiracao" className="py-16 md:py-24 px-4 bg-white overflow-hidden">
           <div className="max-w-6xl mx-auto">
               <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                   <AnimatedSection delay={0} className="order-first md:order-last">
                       <div className="mb-4 flex items-center space-x-3">
                           <FaUsers className="w-11 h-11 md:w-12 md:h-12 text-purple-500" />
                           <FaLightbulb className="w-10 h-10 md:w-11 md:h-11 text-yellow-400" />
                       </div>
                       <h3 className="text-2xl md:text-3xl font-bold text-brand-dark mb-4 leading-tight">Comunidade de Inspiração Tuca: Aprenda e Inspire-se com Criadores como Você!</h3>
                       <p className="text-lg text-gray-700 font-light leading-relaxed mb-4">
                           Bloqueio criativo? Quer ver o que outros criadores estão fazendo de bom? O Tuca te conecta à <strong className="font-semibold text-brand-dark">Comunidade de Inspiração</strong>!
                       </p>
                       <ul className="list-disc list-inside text-lg text-gray-700 font-light leading-relaxed space-y-2 mb-6">
                           <li><strong className="font-medium text-brand-dark">Peça Inspiração Sob Demanda (com filtros!):</strong> Precisa de ideias para um Reel sobre "viagem econômica" com propósito de "Dica"? Basta pedir ao Tuca, especificando <strong className="font-medium">tema, formato, propósito e contexto</strong>.</li>
                           <li><strong className="font-medium text-brand-dark">Exemplos Reais, Foco Qualitativo:</strong> O Tuca apresenta posts de sucesso de outros usuários da plataforma, com <strong className="font-medium">resumos estratégicos e destaques de performance qualitativa</strong>.</li>
                           <li><strong className="font-medium text-brand-dark">Privacidade em Primeiro Lugar:</strong> Suas métricas numéricas são suas. O Tuca <strong className="font-semibold text-brand-pink">NUNCA compartilha dados quantitativos de posts de outros usuários</strong>.</li>
                           <li><strong className="font-medium text-brand-dark">Inspiração nas Dicas Diárias:</strong> Além de pedir, o Tuca também pode incluir uma inspiração relevante da comunidade nas suas dicas diárias de conteúdo.</li>
                       </ul>
                       <p className="text-lg text-gray-700 font-light leading-relaxed">
                          Com a Comunidade de Inspiração, você aprende com exemplos práticos, supera bloqueios e eleva o nível do seu conteúdo, tudo com a curadoria inteligente do Tuca.
                       </p>
                   </AnimatedSection>
                   <AnimatedSection delay={0.1} className="aspect-w-1 aspect-h-1 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl shadow-lg flex items-center justify-center p-6 order-last md:order-first">
                       <span className="text-purple-700 text-center text-xl p-4">[Ilustração: Rede de avatares de criadores conectados, com Tuca no centro mostrando exemplos de posts inspiradores (com tags de formato/propósito/contexto) em telas de celular]</span>
                   </AnimatedSection>
               </div>
           </div>
       </section>

       {/* Seção Tuca & Suas Publis */}
       <section id="tuca-parcerias" className="py-16 md:py-24 px-4 bg-brand-light overflow-hidden"> {/* Alternando BG */}
           <div className="max-w-6xl mx-auto">
               <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                    <AnimatedSection delay={0.1} className="aspect-w-1 aspect-h-1 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-3xl shadow-lg flex items-center justify-center p-6 order-last md:order-first">
                       <span className="text-orange-700 text-center text-xl p-4">[Ilustração: Criador de conteúdo usando o Tuca no celular para planejar uma 'publi', com elementos de contrato, calendário e sugestões de roteiro do Tuca baseadas no formato/propósito/horário da campanha]</span>
                   </AnimatedSection>
                   <AnimatedSection delay={0} className="order-first md:order-last">
                       <div className="mb-4 flex items-center space-x-3">
                           <FaFileSignature className="w-11 h-11 md:w-12 md:h-12 text-orange-500" />
                           <FaBrain className="w-10 h-10 md:w-11 md:h-11 text-brand-red" />
                           <FaScroll className="w-10 h-10 md:w-11 md:h-11 text-teal-500" />
                           <FaClock className="w-10 h-10 md:w-11 md:h-11 text-cyan-500" />
                       </div>
                       <h3 className="text-2xl md:text-3xl font-bold text-brand-dark mb-4 leading-tight">Tuca & Suas Publis: Gestão, Criação Inteligente, Roteiros e Timing para Parcerias de Sucesso</h3>
                       <p className="text-lg text-gray-700 font-light leading-relaxed mb-4">
                           Gerenciar parcerias publicitárias, criar posts que realmente convertem para a marca (e para seu público!) e negociar valores justos pode ser um desafio. O Tuca te ajuda a <strong className="font-semibold text-brand-dark">transformar suas 'publis' em grandes sucessos</strong>:
                       </p>
                       <ul className="list-disc list-inside text-lg text-gray-700 font-light leading-relaxed space-y-2 mb-6">
                           <li><strong className="font-medium text-brand-dark">Organize Suas Parcerias:</strong> Registre todos os detalhes dos seus acordos (marcas, entregas, prazos, valores) em um só lugar na plataforma Data2Content.</li>
                           <li><strong className="font-medium text-brand-dark">Conteúdo Patrocinado Sob Medida com Geração de Roteiro e Melhor Horário:</strong> Após registrar uma 'publi', peça ajuda ao Tuca: "Tuca, me dê ideias, um <strong className="text-brand-pink">roteiro</strong> e o <strong className="text-brand-pink">melhor horário</strong> para <strong className="text-brand-pink">[Formato da Publi]</strong> da campanha da <strong className="text-brand-pink">[Marca X]</strong> sobre <strong className="text-brand-pink">[Produto]</strong>, focando em <strong className="text-brand-pink">[Objetivo da Campanha]</strong>." Ele usará os detalhes da parceria, o conhecimento sobre seu perfil e os <strong className="font-medium">tipos de conteúdo e horários que melhor se alinham à marca e ao seu público</strong> para criar sugestões e estruturas de conteúdo autênticas e eficazes.</li>
                           <li><strong className="font-medium text-brand-dark">Análise Inteligente de Propostas (Em Breve):</strong> No futuro, com base nos dados registrados e no mercado, o Tuca poderá te ajudar a analisar propostas de parcerias e a entender melhor o valor das suas entregas.</li>
                           <li><strong className="font-medium text-brand-dark">Histórico para Decisões Estratégicas:</strong> Mantenha um histórico completo de suas 'publis' para embasar futuras negociações e otimizar suas estratégias de monetização.</li>
                       </ul>
                       <p className="text-lg text-gray-700 font-light leading-relaxed">
                          Com o Tuca, suas parcerias publicitárias se tornam mais organizadas, criativas, estrategicamente embasadas e potencialmente mais lucrativas.
                       </p>
                   </AnimatedSection>
               </div>
           </div>
       </section>


        <section id="monetizacao" className="py-16 md:py-24 px-4 bg-white overflow-hidden"> {/* Ajustado BG */}
              <div className="max-w-6xl mx-auto space-y-20 md:space-y-24">
                <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                    <AnimatedSection delay={0}>
                         <div className="mb-4"><FaGift className="w-10 h-10 md:w-11 md:h-11 text-brand-pink" /></div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-dark mb-6 leading-tight">Indique Amigos, Ganhe Dinheiro (Todos Saem Ganhando!)</h2>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-4">
                            No Data2Content, <strong className="font-semibold text-brand-dark">todo mundo pode lucrar, até no plano grátis!</strong> Ao se cadastrar, você já vira afiliado e recebe seu cupom exclusivo.
                        </p>
                        <ul className="list-disc list-inside text-lg text-gray-700 font-light leading-relaxed space-y-2 mb-6">
                             <li>Seu amigo usa seu cupom? <strong className="font-medium text-brand-dark">Ele ganha 10% de desconto</strong> na assinatura do Tuca.</li>
                             <li>E você? <strong className="font-medium text-brand-dark">Ganha 10% de comissão</strong> todo mês enquanto ele for assinante.</li>
                        </ul>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-8">Ajude outros criadores a crescer e seja recompensado por isso!</p>
                        <a href="#faq" className="inline-flex items-center font-semibold text-brand-pink hover:underline text-base md:text-lg">
                            Ver detalhes da afiliação <FaArrowRight className="w-4 h-4 ml-2" />
                        </a>
                    </AnimatedSection>
                    <AnimatedSection delay={0.1} className="aspect-w-1 aspect-h-1 bg-gradient-to-br from-pink-50 to-red-50 rounded-3xl shadow-lg flex items-center justify-center p-6">
                        <span className="text-pink-700 text-center text-xl p-4">[Ilustração: Programa de Afiliados Data2Content com pessoas felizes]</span>
                    </AnimatedSection>
                </div>

                <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                    <AnimatedSection delay={0.1} className="aspect-w-1 aspect-h-1 bg-gradient-to-br from-yellow-50 to-green-50 rounded-3xl shadow-lg flex items-center justify-center p-6 order-last md:order-first">
                         <span className="text-yellow-700 text-center text-xl p-4">[Ilustração: Criador de conteúdo interagindo com marcas em um laptop, com o Tuca auxiliando]</span>
                    </AnimatedSection>
                    <AnimatedSection delay={0} className="order-first md:order-last">
                         <div className="mb-4"><FaStar className="w-10 h-10 md:w-11 md:h-11 text-yellow-500" /></div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-dark mb-6 leading-tight">Conecte-se a Marcas e Oportunidades Reais</h2>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-8">Use o Tuca, melhore seus resultados <strong className="font-semibold text-brand-dark">com base em dados reais do seu perfil e insights que evoluem com você e seus objetivos</strong>, e chame a atenção de marcas parceiras que buscam criadores autênticos e com performance comprovada. Além disso, destaque-se e seja considerado para agenciamento exclusivo por Arthur Marbá.</p>
                         <a href="#arthur-marba" className="inline-flex items-center font-semibold text-yellow-600 hover:underline text-base md:text-lg">
                            Como funciona o agenciamento? <FaArrowRight className="w-4 h-4 ml-2" />
                        </a>
                    </AnimatedSection>
                </div>
            </div>
        </section>


        <section id="como-funciona" className="py-16 md:py-24 px-4 bg-brand-light"> {/* Ajustado bg */}
            <div className="max-w-5xl mx-auto text-center">
                <AnimatedSection delay={0}>
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-6">Comece a Transformar seu Instagram em 4 Passos Simples:</h2>
                    <p className="text-lg text-gray-700 mb-16 md:mb-20 max-w-xl mx-auto font-light leading-relaxed">É rápido e fácil ter seu especialista inteligente e criativo <strong className="font-semibold text-brand-dark">conectado ao seu Instagram, analisando e categorizando seu conteúdo e horários, aprendendo com você, seus objetivos, te inspirando com a comunidade, otimizando suas 'publis' e gerando roteiros</strong>, trabalhando para seu sucesso no WhatsApp:</p>
                </AnimatedSection>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <AnimatedSection delay={0.1} className="bg-white p-6 md:p-8 rounded-xl shadow-md flex flex-col text-center items-center"> {/* Ajustado bg */}
                        <div className="flex items-center justify-center w-14 h-14 bg-brand-pink text-white rounded-full mb-5 text-2xl font-semibold">1</div>
                        <h3 className="text-xl font-semibold text-brand-dark mb-3">Crie sua Conta Grátis</h3>
                        <p className="text-base text-gray-600 font-light">Use sua conta Google. Rápido e seguro.</p>
                    </AnimatedSection>
                    <AnimatedSection delay={0.2} className="bg-white p-6 md:p-8 rounded-xl shadow-md flex flex-col text-center items-center"> {/* Ajustado bg */}
                        <div className="flex items-center justify-center w-14 h-14 bg-brand-pink text-white rounded-full mb-5 text-2xl font-semibold">2</div>
                        <h3 className="text-xl font-semibold text-brand-dark mb-3">Conecte seu Instagram <FaLink className="inline ml-1 text-blue-500"/></h3>
                        <p className="text-base text-gray-600 font-light">Autorize para o Tuca <strong className="font-medium">analisar seus dados, descrições e horários</strong>.</p>
                    </AnimatedSection>
                    <AnimatedSection delay={0.3} className="bg-white p-6 md:p-8 rounded-xl shadow-md flex flex-col text-center items-center"> {/* Ajustado bg */}
                         <div className="flex items-center justify-center w-14 h-14 bg-brand-pink text-white rounded-full mb-5 text-2xl font-semibold">3</div>
                        <h3 className="text-xl font-semibold text-brand-dark mb-3">Interaja, Ensine, Crie, Registre e Envie Prints <FaComments className="inline ml-1 text-brand-pink"/><FaScroll className="inline ml-1 text-teal-500"/><FaFileSignature className="inline ml-1 text-orange-500"/><FaFileUpload className="inline ml-1 text-gray-500"/></h3>
                        <p className="text-base text-gray-600 font-light">Converse, informe <strong className="font-medium">objetivos</strong>, peça <strong className="font-medium">roteiros e inspirações</strong>, registre <strong className="font-medium">suas 'publis'</strong>, envie <strong className="font-medium">prints de posts antigos</strong> e veja o Tuca aprender.</p>
                    </AnimatedSection>
                    <AnimatedSection delay={0.4} className="bg-white p-6 md:p-8 rounded-xl shadow-md flex flex-col text-center items-center"> {/* Ajustado bg */}
                        <div className="flex items-center justify-center w-14 h-14 bg-brand-pink text-white rounded-full mb-5 text-2xl font-semibold">4</div>
                        <h3 className="text-xl font-semibold text-brand-dark mb-3">Receba Insights e Ganhe!</h3>
                        <p className="text-base text-gray-600 font-light">Aproveite as dicas cada vez mais personalizadas no WhatsApp <FaWhatsapp className="inline ml-1 text-green-500"/> e indique amigos <FaGift className="inline ml-1"/>.</p>
                    </AnimatedSection>
                </div>
            </div>
        </section>

         <section id="arthur-marba" className="py-16 md:py-24 px-4 bg-white"> {/* Ajustado bg */}
              <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-10 md:gap-16 items-center">
                <AnimatedSection delay={0} className="md:col-span-2">
                     <div className="aspect-w-4 aspect-h-5 bg-gray-300 rounded-3xl shadow-lg overflow-hidden flex items-center justify-center">
                         <span className="text-gray-500 text-center text-xl p-4">[Foto de Arthur Marbá]</span>
                     </div>
                </AnimatedSection>
                <AnimatedSection delay={0.1} className="md:col-span-3">
                     <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-dark mb-6 leading-tight">A Mente por Trás da Inteligência <strong className="text-brand-pink">Completa, Criativa e Adaptável</strong> do Tuca</h2>
                     <p className="text-lg text-gray-700 mb-6 leading-relaxed font-light">
                         O Tuca é disruptivo porque combina a <strong className="text-brand-pink">experiência de 40 anos de Arthur Marbá</strong> com o poder da IA que <strong className="font-semibold text-brand-dark">analisa profundamente seu conteúdo e horários, aprende, se adapta a você, seus objetivos, se inspira na força da comunidade, te ajuda a gerenciar suas parcerias e a criar roteiros</strong>. Todo o conhecimento dele sobre algoritmos e estratégias foi ensinado ao Tuca, que aplica essa sabedoria diretamente aos dados do seu perfil conectado (e aos seus prints), de forma proativa e <strong className="font-semibold text-brand-dark">cada vez mais personalizada às suas metas e preferências</strong>.
                     </p>
                     <blockquote className="mt-8 pl-6 border-l-4 border-brand-pink italic text-gray-700 font-light text-lg md:text-xl leading-relaxed">
                         "Com o Tuca, meu objetivo foi escalar e democratizar o tipo de consultoria estratégica que ofereço há décadas, tornando-a acessível, <strong className='font-semibold'>profundamente personalizada para cada criador</strong>, proativa, <strong className='font-semibold'>capaz de evoluir com o usuário, seus objetivos específicos, de fomentar a inspiração coletiva, de auxiliar na monetização inteligente e de potencializar a produção de conteúdo com roteiros, análise semântica e otimização de timing</strong>. O Tuca analisa o Instagram, aprende com as interações, se conecta à comunidade, ajuda com 'publis', gera roteiros e entrega insights acionáveis através da tecnologia inteligente, com a praticidade do WhatsApp."
                         <cite className="mt-4 block text-base font-semibold text-brand-dark not-italic">- Arthur Marbá, Fundador e Mentor da IA Tuca</cite>
                     </blockquote>
                </AnimatedSection>
            </div>
         </section>

         <section id="cta-final" className="py-20 md:py-32 px-4 bg-brand-dark text-white">
              <div className="max-w-2xl mx-auto text-center">
                 <AnimatedSection delay={0}>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tighter">Sua Vez de Ter uma Estratégia Completa, Inteligente, Proativa, Criativa, Inspiradora e que Aprende com Você (e Lucrar com Isso!)</h2>
                 </AnimatedSection>
                 <AnimatedSection delay={0.1}>
                    <p className="text-xl text-gray-300 mb-10 font-light leading-relaxed">Conecte sua conta, deixe o Tuca ser seus olhos, cérebro estratégico, roteirista, parceiro de aprendizado, sua fonte de inspiração e seu assistente de 'publis' no Instagram, e comece a ganhar comissões indicando amigos agora mesmo!</p>
                 </AnimatedSection>
                  {!session ? (
                    <AnimatedSection delay={0.2}>
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/auth/complete-signup" })}
                            className="shimmer-button inline-flex items-center gap-3 px-10 py-4 md:px-12 md:py-5 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-lg md:text-xl hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                           <FaLink className="w-5 h-5" />
                           Conectar Instagram Grátis e Decolar Agora
                        </button>
                    </AnimatedSection>
                    ) : (
                         <AnimatedSection delay={0.2}>
                            <Link
                                href="/dashboard"
                                className="shimmer-button inline-block px-10 py-4 md:px-12 md:py-5 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-lg md:text-xl hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                            >
                                Ir para Meu Painel <FaArrowRight className="inline ml-2.5 w-5 h-5"/>
                            </Link>
                        </AnimatedSection>
                    )}
             </div>
         </section>

        <section id="faq" className="py-16 md:py-24 px-4 bg-white">
            <div className="max-w-3xl mx-auto">
                <AnimatedSection delay={0} className="text-center mb-16 md:mb-20">
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-6">Ainda tem Dúvidas sobre o Poder do Tuca?</h2>
                </AnimatedSection>
                <div className="space-y-8">
                    {faqItems.map((item, index) => (
                        <AnimatedSection delay={0.1 * (index + 1)} key={index}>
                            <details className="group bg-brand-light p-5 md:p-6 rounded-lg shadow hover:shadow-md transition-shadow duration-200">
                                <summary className="flex justify-between items-center font-semibold text-brand-dark text-base md:text-lg cursor-pointer hover:text-brand-pink list-none">
                                    {item.q}
                                    <FaQuestionCircle className="text-brand-pink group-open:rotate-180 transition-transform duration-200 ml-3 flex-shrink-0 w-5 h-5"/>
                                </summary>
                                <p className="text-gray-700 mt-4 font-light leading-relaxed text-sm md:text-base whitespace-pre-line"
                                   dangerouslySetInnerHTML={{ __html: item.a.replace(/\n\n\*/g, '<br /><br />&#8226; ').replace(/\n\*/g, '<br />&#8226; ').replace(/\n/g, '<br />') }}
                                >
                                </p>
                            </details>
                        </AnimatedSection>
                    ))}
                </div>
            </div>
        </section>

         <footer className="text-center py-10 md:py-12 bg-brand-light text-sm text-gray-600 font-light">
             <div className="mb-4 text-brand-dark font-bold text-2xl">Data2Content</div>
             <p className="mb-2">© {new Date().getFullYear()} Data2Content. Todos os direitos reservados por Marbá.</p>
             <div className="mt-3 space-x-5">
                 <Link href="/politica-de-privacidade" className="underline hover:text-brand-pink transition-colors">
                    Política de Privacidade
                 </Link>
                 <Link href="/termos-e-condicoes" className="underline hover:text-brand-pink transition-colors">
                    Termos e Condições
                 </Link>
             </div>
         </footer>

      </div>

      <style jsx global>{`
        .shimmer-button::before {
          content: "";
          position: absolute;
          top: 0;
          left: -150%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-20deg);
          will-change: left;
        }
        .shimmer-button:hover::before {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% {
            left: -150%;
          }
          70% {
            left: 150%;
          }
          100% {
            left: 150%;
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.02);
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          will-change: opacity, transform;
        }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
    </>
  );
}
