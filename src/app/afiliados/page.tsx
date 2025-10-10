// src/app/afiliados/page.tsx (ou o caminho que você preferir para esta nova rota)
"use client";

import React from 'react';
import Head from 'next/head';
// Usaremos ícones para ilustrar as seções
import { FaInfoCircle, FaLink, FaDollarSign, FaTrophy, FaQuestionCircle, FaHandshake, FaBullhorn, FaMoneyBillWave } from 'react-icons/fa'; // <<< FaMoneyBillWave ADICIONADO AQUI >>>
import { motion } from 'framer-motion';
import { MONTHLY_PRICE } from '@/config/pricing.config';

// Componente para um Card de Informação
const InfoCard = ({
  icon,
  title,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <motion.div
    className={`bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300 ${className}`}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.5 }}
  >
    <div className="flex items-center text-brand-pink mb-3">
      <span className="text-2xl mr-3">{icon}</span>
      <h3 className="text-xl font-semibold text-brand-dark">{title}</h3>
    </div>
    <div className="text-gray-700 text-sm leading-relaxed space-y-2">
      {children}
    </div>
  </motion.div>
);

export default function AffiliateProgramPage() {
  // Base URL do seu site - idealmente viria de uma variável de ambiente
  const siteBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://seusite.com.br';

  return (
    <>
      <Head>
        <title>Programa de Afiliados - Data2Content</title>
        <meta
          name="description"
          content="Entenda como funciona o programa de afiliados da Data2Content e comece a ganhar indicando novos criadores para o Mobi."
        />
      </Head>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-brand-pink to-pink-600 text-white py-16 sm:py-24">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <FaHandshake className="text-6xl mx-auto mb-6 opacity-80" />
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Programa de Afiliados Data2Content
            </h1>
            <p className="text-lg sm:text-xl max-w-2xl mx-auto opacity-90">
              Indique o Mobi para outros criadores de conteúdo e seja recompensado!
              Transforme sua rede de contatos em uma fonte de renda.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 sm:py-16 space-y-12">
        {/* Seção: Como Funciona? */}
        <InfoCard icon={<FaInfoCircle />} title="Como Funciona o Programa?">
          <p>
            O nosso programa de afiliados é simples e direto. Ao registar-se na plataforma Data2Content, recebe automaticamente um <strong>código de afiliado</strong> e um <strong>link de indicação exclusivo</strong>.
          </p>
          <ol className="list-decimal list-inside space-y-2 mt-3 pl-2">
            <li>
              <strong>Partilhe o seu Código ou Link:</strong> Divulgue o seu código ou link de afiliado com criadores de conteúdo que possam beneficiar do Mobi.
            </li>
            <li>
              <strong>O seu Indicado Assina:</strong> Quando um novo utilizador assina um plano do Mobi utilizando o seu código de afiliado (ou vindo através do seu link de indicação), você ganha uma comissão.
            </li>
            <li>
              <strong>Receba a sua Comissão:</strong> A comissão é creditada no seu saldo de afiliado na plataforma após a confirmação do pagamento da assinatura do seu indicado.
            </li>
            <li>
              <strong>Resgate os seus Ganhos:</strong> Ao atingir o saldo mínimo, pode solicitar o resgate dos seus ganhos.
            </li>
          </ol>
        </InfoCard>

        {/* Seção: Seu Código e Link de Afiliado */}
        <InfoCard icon={<FaLink />} title="O seu Código e Link de Indicação">
          <p>
            Encontra o seu código de afiliado e o seu link de indicação completo diretamente em <a href="/dashboard/chat" className="text-brand-pink hover:underline font-medium">Conversar com IA</a>.
          </p>
          <p className="mt-2">
            <strong>Código de Afiliado:</strong> É um código curto e fácil de memorizar (ex: <code>JOAO123</code>). O seu indicado pode inseri-lo no momento da compra do plano.
          </p>
          <p className="mt-2">
            <strong>Link de Indicação:</strong> É um link direto para o nosso site que já contém o seu código de referência (ex: <code>{siteBaseUrl}/?ref=JOAO123</code>). Quando alguém clica neste link e assina, o sistema reconhece automaticamente a sua indicação e aplica o desconto para o novo utilizador. Recomendamos usar o link completo sempre que possível, pois facilita para o seu indicado!
          </p>
        </InfoCard>

        {/* Seção: Comissão */}
        <InfoCard icon={<FaDollarSign />} title="A sua Comissão">
          <p>
            Você recebe uma comissão de <strong>10% sobre o valor da primeira assinatura</strong> de cada novo cliente que utilizar o seu código ou link de afiliado.
          </p>
          <p className="mt-2">
            Por exemplo, se o plano mensal é R$ {MONTHLY_PRICE.toFixed(2).replace('.', ',')}, a sua comissão por uma nova assinatura mensal indicada por você será de R$ {(MONTHLY_PRICE * 0.1).toFixed(2).replace('.', ',')}.
          </p>
          <p className="mt-2">
            <strong>Importante:</strong> A comissão é válida apenas para a primeira assinatura do novo cliente. Não há comissões recorrentes sobre renovações neste momento.
          </p>
        </InfoCard>

        {/* Seção: Ranking de Afiliados */}
        <InfoCard icon={<FaTrophy />} title="Ranking de Afiliados">
          <p>
            A cada <strong>5 indicações convertidas</strong> (novos assinantes), o seu <strong>Rank de Afiliado</strong> aumenta em 1 nível!
          </p>
          <p className="mt-2">
            Atualmente, o sistema de ranking serve para acompanhar o seu progresso e destacar os afiliados mais empenhados.
          </p>
          <p className="mt-2">
            <em>Estamos a planear benefícios e recompensas exclusivas para os diferentes níveis de rank no futuro. Fique atento às novidades!</em>
          </p>
        </InfoCard>

        {/* Seção: Resgate de Ganhos */}
        <InfoCard icon={<FaMoneyBillWave />} title="Resgate dos Ganhos">
          <p>
            Pode solicitar o resgate do seu saldo de comissões acumulado assim que atingir o valor mínimo de <strong>R$ 50,00</strong>.
          </p>
          <p className="mt-2">
            Para solicitar o resgate:
          </p>
          <ol className="list-decimal list-inside space-y-1 mt-2 pl-2">
            <li>Aceda a <a href="/dashboard/chat" className="text-brand-pink hover:underline font-medium">Conversar com IA</a>.</li>
            <li>Verifique se os seus dados de pagamento (PIX ou conta bancária) estão corretamente preenchidos na secção &quot;Dados de Pagamento&quot;.</li>
            <li>Clique no botão &quot;Resgatar Saldo&quot;.</li>
          </ol>
          <p className="mt-2">
            As solicitações de resgate são processadas manualmente pela nossa equipa. O pagamento será efetuado na sua conta informada em até <strong>7 dias úteis</strong> após a solicitação.
          </p>
        </InfoCard>

        {/* Seção: Dicas para Divulgação */}
        <InfoCard icon={<FaBullhorn />} title="Dicas para Divulgar">
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>Partilhe o seu link de afiliado nas suas redes sociais, biografia do Instagram, grupos de WhatsApp ou Telegram com outros criadores.</li>
            <li>Crie conteúdo mostrando como o Mobi o ajuda e inclua o seu código/link na descrição.</li>
            <li>Explique os benefícios do Mobi e como ele pode impulsionar a carreira de outros criadores.</li>
            <li>Lembre os seus indicados de usarem o seu código para garantir o desconto de 10% na primeira assinatura deles!</li>
          </ul>
        </InfoCard>

        {/* Seção: Termos e Condições (Simplificado) */}
        <InfoCard icon={<FaQuestionCircle />} title="Termos e Condições Importantes">
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>A Data2Content reserva-se o direito de alterar os termos do programa de afiliados a qualquer momento, com aviso prévio.</li>
            <li>Práticas consideradas spam, fraudulentas ou que violem os termos de uso da plataforma resultarão na desqualificação do programa e possível perda de comissões.</li>
            <li>É responsabilidade do afiliado garantir que os seus dados de pagamento estejam corretos para o recebimento das comissões.</li>
            <li>A comissão é aplicada sobre o valor líquido da assinatura, após eventuais impostos ou taxas de processamento de pagamento. (Nota: Atualmente o webhook calcula sobre `transaction_amount` total, podemos refinar isso se necessário).</li>
            <li>Dúvidas? Entre em contacto com o nosso suporte.</li>
          </ul>
        </InfoCard>
      </div>

      {/* Footer (Reutilize seu componente Footer se tiver um global) */}
      {/* <Footer /> */}
    </>
  );
}
