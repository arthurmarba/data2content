# Landing — Fase 0: contrato da oferta

Status: **concluída**  
Objetivo: impedir que a nova landing prometa algo que o produto ainda não entrega.

## Norte da oferta

**Hoje a D2C se vende pela reunião e se sustenta pela plataforma.**

A reunião semanal é o motivo para entrar. O Mapa e as demais ferramentas mantêm o valor entre as reuniões e ajudam quem não participa ao vivo.

## O que já está confirmado

### Produto e promessa

- O produto atual é uma assinatura consultiva em grupo, não uma ferramenta de ideias por IA.
- A entrega central é a reunião semanal ao vivo de análise de conteúdo e estratégia de imagem.
- O Mapa, as pautas, as collabs e o Media Kit são benefícios de continuidade, não heróis independentes.
- A linguagem deve preservar o território emocional de autenticidade: conteúdo com a sua cara.

### Preço vigente

- Mensal: **R$ 97,00**.
- Anual: **R$ 890,00**.
- Os dois preços foram conferidos na configuração do projeto e nos preços ativos do Stripe em modo live.
- A landing não deve usar R$ 97,90.

### Acesso que o produto entrega hoje

- O acesso à comunidade VIP e à reunião está condicionado ao plano Pro ativo.
- Usuários gratuitos entram na comunidade gratuita, mas não recebem hoje um fluxo de reserva ou acesso à reunião.
- Não existe atualmente um fluxo implementado para o assinante enviar conteúdo e acompanhar sua seleção para análise ao vivo.

### Regra de produto aprovada para a nova experiência

- Depois do login, o usuário gratuito passa pelo onboarding e recebe acesso contínuo às reuniões semanais.
- Ele pode assistir a todas as reuniões, mas não entra no grupo exclusivo de assinantes e não pode ter o conteúdo analisado.
- O onboarding deve mostrar data, horário e ação para salvar a reunião na agenda do celular.
- Depois do onboarding, o app deve manter uma área dedicada à reunião semanal, com próxima data, tema, acesso e opção de agenda.
- As reuniões acontecem às **quintas-feiras, às 19h**, no horário de Brasília, e costumam durar **2 horas**.
- Todo assinante que confirma presença na reunião dentro do grupo exclusivo do WhatsApp é analisado naquela reunião.
- A assinatura não vende somente a análise: entrega a experiência completa da D2C — grupo de assinantes, análise ao vivo, Mapa e ferramentas de conteúdo, collabs e monetização entre as reuniões.

## Contrato seguro para a primeira versão da copy

Depois que o fluxo de reunião gratuita for implementado, a landing pode afirmar:

> Toda semana, a comunidade se reúne ao vivo para analisar conteúdo e estratégia de imagem, criador a criador. Você pode assistir à próxima reunião gratuitamente. No D2C Pro, você também pode participar das análises, entra no grupo de assinantes e leva o Mapa e as ferramentas que continuam trabalhando entre um encontro e outro.

Ela pode afirmar, de forma precisa:

- **Reuniões ao vivo toda quinta, às 19h.**
- **Assinantes que confirmam presença no grupo são analisados.**
- **Visitantes podem assistir gratuitamente, todas as semanas.**

Ela não deve reduzir o plano a “pague para ser analisado”. A análise é o benefício mais concreto da reunião, mas o plano reúne acompanhamento ao vivo, comunidade exclusiva e plataforma para dar continuidade ao trabalho durante a semana.

### CTAs aprovados

- Primário da landing: **Assista à próxima reunião**.
- Pós-login/onboarding: **Salvar na minha agenda**.
- No dia da reunião: **Entrar na reunião**.
- Conversão na seção de preço: **Assinar o D2C Pro**.
- Upgrade contextual dentro do app: **Quero a experiência completa**.

O CTA primário só deve ser publicado junto com o fluxo funcional de login, onboarding, agenda e acesso no app.

## Experiência mínima da reunião

### No onboarding

Ao concluir o onboarding, o usuário encontra uma etapa curta, sem formulário adicional:

1. próxima data e horário;
2. explicação clara: “Você pode assistir toda semana. Assinantes que confirmam presença no grupo também são analisados”;
3. ação principal **Salvar na minha agenda**;
4. confirmação de que o link também ficará disponível dentro do app.

### Dentro do app

A reunião deve ganhar uma página canônica própria, por exemplo `/reuniao`, com entrada destacada na Home — não ficar escondida dentro do card da comunidade nem disputar espaço permanente na navegação principal. Essa superfície mostra:

- estado da reunião: próxima, hoje, ao vivo ou encerrada;
- data, horário, duração e tema;
- **Salvar na agenda** antes do evento;
- **Entrar na reunião** quando o acesso estiver liberado;
- distinção contextual entre visitante e assinante;
- para o gratuito, uma chamada secundária: **Quero a experiência completa**;
- para o assinante, acesso ao grupo e confirmação de presença para análise.

### Agenda do celular

O produto já gera um arquivo de calendário compatível com o celular. Ele deve ser reaproveitado no onboarding e na área da reunião. Por padrão, o compromisso deve ser salvo para quinta-feira, das 19h às 21h, com nome e link de acesso corretos. Uma ocorrência específica cadastrada na agenda sempre prevalece sobre esse padrão.

Por segurança, o calendário deve apontar para a página autenticada da reunião no app, e não diretamente para uma sala reutilizável de Zoom ou Meet. A página libera o botão externo conforme a conta e o horário do evento; assim, o link da sala pode ser alterado ou revogado sem invalidar o compromisso salvo pelo usuário.

## Arquitetura da oferta aprovada

### Camada gratuita

- Login e onboarding.
- Acesso contínuo para assistir às reuniões semanais.
- Próxima reunião disponível no app.
- Salvar na agenda do celular.
- Acesso às funcionalidades gratuitas que forem mantidas na plataforma.
- Sem grupo exclusivo e sem análise do próprio conteúdo.

### D2C Pro — R$ 97/mês

- Tudo da camada gratuita.
- Grupo exclusivo de assinantes no WhatsApp.
- Análise garantida na reunião em que o assinante confirmar presença no grupo.
- Mapa e ferramentas da plataforma para continuar o trabalho entre as reuniões.
- Experiência de comunidade, conteúdo, collabs e monetização.

### Agenda canônica

- Recorrência padrão: quinta-feira.
- Início: 19h, horário de Brasília.
- Duração típica: 2 horas.
- Término padrão no calendário: 21h.
- Eventos específicos podem sobrescrever data e duração em feriados ou reagendamentos.

O código ainda contém referências conflitantes a segunda às 19h, quinta às 19h e quinta às 20h. Na implementação, todas devem ser substituídas por uma fonte canônica única, usando o próximo evento cadastrado e quinta das 19h às 21h apenas como fallback.

### Confirmação e análise

- A confirmação acontece dentro do grupo de assinantes no WhatsApp.
- Todo assinante que confirmar presença é incluído nas análises da reunião correspondente.
- Quem não confirmar pode assistir, mas não recebe garantia de análise naquela semana.
- A landing deve comunicar a condição “confirmando presença no grupo” junto da garantia, sem escondê-la em FAQ.

### Nome comercial

Manter **Plano Pro** no checkout e usar **D2C Pro** na comunicação, evitando criar uma nova categoria de plano durante a mudança da landing.

## Critério de saída da Fase 0

A Fase 0 está concluída porque foram definidos:

1. o acesso gratuito contínuo para assistir;
2. a confirmação dos assinantes pelo grupo e a garantia de análise;
3. a agenda oficial de quinta, das 19h às 21h;
4. o conjunto de valor da assinatura e seus CTAs.

A Fase 1 já pode reorganizar a landing e reescrever a copy sem criar promessa falsa ou retrabalho de UX.
