---
tipo: domínio
---

# Collabs — o encontro entre criadores

Uma pauta nasce de narrativa + território. A dupla precisa acrescentar contribuição concreta, não apenas compartilhar palavras. A experiência continua sendo um baralho com Salvas e Combinadas.

## Caminho atual (implementação local de setembro de 2026)

- Página dedicada e aba do Perfil usam `CollabsPinnedBoard` + `useCollabsController`.
- Regras novas estão em `src/app/lib/collabs/`; `boards/videoUpload` contém adaptadores e o gerador histórico.
- `CollabProposal` é a identidade da proposta: dupla, versão e plano imutáveis. Aceites transacionais confirmam **a mesma proposta**, com responsabilidades invertidas na perspectiva correta. Intenção unilateral nunca é devolvida ao outro.
- `CollabJob` prepara pautas e matching em fila. `ContentIdeaQuota` reserva e consome rodadas, não documentos/3. `/api/worker/collabs` usa assinatura QStash; `recover-content-intelligence` recupera pedidos sem entrega.
- `CollabSettings` controla piloto, pausa e configuração dos avisos. Sem documento, produção não inicia geração. Não há env nova.
- `CollabInterest`, `CollabMatch` e `PerPautaCollabCache` são legados. Leitura conserva histórico; novas escritas exigem proposta. Cache antigo não define pessoa ou versão de interesse já registrado.
- MCP e `/collabs/suggestions` leem propostas comuns prontas. Consulta não gera IA.

## Invariantes

Disponibilidade precisa de opt-in e data; pausa prevalece mesmo contra histórico de interesse. Aceitar revalida plano, modalidade e disponibilidade dos dois. A transação escreve uma revisão nos usuários para conflitar com pausas concorrentes. Foto não é obrigatória; contato utilizável é.

Evidência visual vem de conteúdo lido em 28 dias, com fontes e cobertura. Muitas métricas sem cenas não sustentam confiança forte. A política pública de padrão consistente continua desativada até validação. Ideias baseadas apenas no Mapa são exploração. Nunca passar diagnóstico privado do parceiro para a sugestão.

O tipo de oportunidade persistido é `opportunityBrief.kind`, não `opportunityKind` na raiz. `audit:collabs` foi corrigido para esse contrato e para elegibilidade real.

A pilha tem cartões posicionados absolutamente: precisa de altura mínima no contêiner. Ao unificar shells, uma altura só herdada de `100%` pode colapsar o cartão sem erro JavaScript. Verificação visual deve incluir essa condição.

## Liberação

`migrate:collabs` é dry-run por padrão. Com `--apply`, cria índices aditivos e protege matches legados com expiração indevida. Não presume consentimento. `configure:collabs` habilita um piloto ou pausa geração sem apagar leitura/histórico.

WhatsApp requer template aprovado, versão da Graph API configurada, credenciais, vínculo e ausência de opt-out. Avisos nascem na transação do match. Envio ambíguo vira `delivery_needs_review`; não reenviar cegamente. A confirmação permanece no app mesmo sem aviso externo.

Detalhes e limites de verificação em `docs/implementacao-collabs-2026-09-08.md`; decisões e rubrica em `docs/plano-melhorias-collabs-2026-09-08.md`. Liberação em produção e avaliação humana de pautas reais ainda não foram executadas.

## Ligações

[[Seu Mapa]] · [[Pautas e Roteiros]] · [[Filas e rotinas]]

## WhatsApp oculto na interface

Em 08/09/2026, Arthur pediu para ocultar a funcionalidade visualmente. `src/app/lib/productFeatures.ts` centraliza `WHATSAPP_ALERTS_VISIBLE = false`: vinculação, alertas em Collabs, chat, conexões e ofertas deixam de aparecer. A comunidade e os contatos comerciais são independentes. O vínculo existente não é apagado e os outros envios de WhatsApp não são desligados por uma decisão de interface. Avisos de Collabs continuam sem ativação operacional.
