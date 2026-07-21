# Landing — Fase 1: narrativa e hierarquia

Status: **concluída e validada localmente**

## Tese visual

Uma experiência editorial, humana e calma, com a reunião semanal como ritual central; pessoas e repertório ganham mais peso que interfaces e ferramentas.

## Nova ordem da página

1. Hero: dor de conteúdo sem identidade e convite para assistir à reunião.
2. Ritual semanal: gratuito assiste; assinante que confirma presença é analisado.
3. Arthur e Ronaldo: autoridade e repertório de quem conduz.
4. Plataforma: Mapa, pautas e análise como continuidade entre reuniões.
5. Prova de dados e contexto.
6. Collabs e creators da comunidade.
7. Grupo exclusivo de assinantes no WhatsApp.
8. D2C Pro por R$ 97/mês.
9. FAQ e convite final.

## O que foi reaproveitado

- composição editorial e imagens do hero;
- narrativa visual da reunião;
- retratos e biografias dos fundadores;
- ciclo interativo do produto;
- experiência de match;
- creators reais e Media Kits;
- simulação do grupo de WhatsApp;
- estrutura de preço, FAQ e CTA mobile.

O manifesto e a calculadora deixaram de ser seções independentes para não competir com a reunião. A Calculadora de Publi continua comunicada como benefício do Pro.

## Mensagens principais

- **Toda quinta, às 19h, ao vivo.**
- **Visitantes podem assistir gratuitamente todas as semanas.**
- **Assinantes que confirmam presença no grupo são analisados.**
- **O D2C Pro entrega a experiência completa: reunião, grupo e plataforma.**

## Validação realizada

- testes direcionados de CTA mobile, ciclo do produto e SEO;
- build de produção;
- inspeção visual em desktop e mobile;
- revisão das seções de reunião, plataforma e preço;
- nenhum erro de runtime ou overlay do Next.js no navegador.

## Guarda de publicação

A nova landing não deve ser publicada isoladamente. O CTA “Assista à próxima reunião” depende da próxima fase entregar o fluxo real para usuários gratuitos: login, onboarding, agenda e área dedicada da reunião dentro do app.

## Próxima fase

Implementar a experiência da reunião no produto:

1. fonte canônica da agenda, com quinta das 19h às 21h como fallback;
2. etapa final do onboarding com próxima data e “Salvar na minha agenda”;
3. página autenticada `/reuniao` para visitantes e assinantes;
4. acesso contínuo do usuário gratuito à transmissão;
5. diferenciação de benefícios do D2C Pro e acesso ao grupo de assinantes;
6. link da sala protegido por uma página autenticada, sem exposição direta no calendário.
