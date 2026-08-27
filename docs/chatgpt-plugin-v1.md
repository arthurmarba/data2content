# Data2Content no ChatGPT — implementação V1

## Objetivo

Transformar o MCP existente em um plugin público com uma experiência útil para contas gratuitas e uma camada mais profunda para contas que já possuem esse recurso. O plugin não vende assinatura, promove upgrade ou inicia checkout dentro do ChatGPT: ele entrega valor e informa objetivamente quando um recurso solicitado não está disponível.

## Endpoint e autenticação

- MCP: `https://data2content.ai/api/mcp`
- Health check: `https://data2content.ai/api/mcp/health`
- OAuth 2.1 com PKCE: descoberta em `/.well-known/oauth-authorization-server`
- Protected Resource Metadata: `/.well-known/oauth-protected-resource`
- Login da conta: fluxo existente da Data2Content, incluindo Google

O OAuth aceita contas gratuitas. A assinatura não é mais um requisito para autorizar o plugin; ela é avaliada por ferramenta, junto com a conexão do Instagram.

## Estados de experiência

| Estado | Contexto disponível no ChatGPT | Próxima ação funcional |
|---|---|---|
| Gratuito sem Norte | Padrões agregados da comunidade | Declarar o Norte no ChatGPT |
| Gratuito com Norte | Norte + padrões agregados | Responder ao pedido sem lembrete comercial |
| PRO sem Instagram | Benefícios PRO + contexto gratuito | Oferecer conexão opcional do Instagram |
| PRO com Instagram | Norte + inteligência privada + comunidade agregada | Usar a profundidade completa |

## Ferramentas principais da aquisição

- `get_account_state`: deve ser chamada no início da conversa.
- `set_creator_north`: registra o Norte na conta e semeia o mapa narrativo existente.
- `build_creator_radar`: correlaciona o Norte com uma amostra agregada de conteúdos autorizados da comunidade, sem identidades ou métricas privadas.
- `research_inspiration_content`: pesquisa padrões agregados. O modo `similar_to_me` exige PRO + Instagram.
- `generate_script_draft`: funciona em profundidade gratuita ou PRO; nunca salva automaticamente.
- `save_script`: exige confirmação explícita, mas não exige Instagram.

As ferramentas privadas de métricas, performance, posts e inteligência individual exigem PRO + Instagram. Recursos de participação na comunidade, como recomendações nominais de collab, exigem PRO.

## Mensagens no ChatGPT

- Não adicionar lembretes comerciais ou links em todas as respostas.
- Se o usuário pedir um recurso indisponível, explicar a limitação e oferecer somente a página informativa `/chatgpt/recursos`.
- Nunca mostrar planos, preço, checkout ou pedido de assinatura.
- Para contas que já incluem comunidade, `get_account_state` pode informar uma única vez o benefício disponível e o link de entrada.

## Fluxo web vindo do ChatGPT

1. Quando uma ferramenta solicitada não estiver disponível, o link informativo abre `/chatgpt/recursos`.
2. A página explica os níveis de contexto sem preço, checkout ou início de assinatura.
3. O usuário pode abrir a própria conta Data2Content para gerenciar recursos por iniciativa própria.
4. Para uma conta que já possui o recurso, a conexão opcional do Instagram usa `/dashboard/instagram/connect?source=chatgpt&next=chatgpt-plugin`.
5. Conexão ou “Agora não” terminam em `/dashboard/chatgpt/ready`.
6. A tela confirma o contexto disponível e oferece retorno ao ChatGPT.

Para retornar diretamente à página publicada do plugin, configurar:

```env
NEXT_PUBLIC_CHATGPT_PLUGIN_URL=https://chatgpt.com/...
```

Sem essa variável, o botão usa `https://chatgpt.com/`.

## Cadastro no painel de Plugins

Campos recomendados para a primeira submissão:

- Nome: `Data2Content`
- Descrição curta: `Planeje e crie conteúdos usando seu Norte, padrões agregados de creators e, quando disponível, a inteligência dos seus próprios conteúdos.`
- Região inicial: Brasil
- Idioma principal: português do Brasil
- Categoria: produtividade/criação de conteúdo
- URL MCP: `https://data2content.ai/api/mcp`
- Política de privacidade: `https://data2content.ai/politica-de-privacidade`
- Suporte: `https://data2content.ai/suporte-plugin`

Sugestões de prompts:

1. `Quero definir meu Norte e receber minhas primeiras pautas.`
2. `Crie uma estratégia de conteúdo para o meu posicionamento.`
3. `Quais padrões de gancho combinam com o que eu quero comunicar?`
4. `Crie um roteiro usando o contexto disponível na minha Data2Content.`

## Checklist antes da submissão

- Configurar a URL publicada do plugin em `NEXT_PUBLIC_CHATGPT_PLUGIN_URL`.
- Preparar conta de demonstração/revisão sem MFA e com dados fictícios suficientes.
- Validar OAuth completo partindo de uma conta gratuita nova.
- Validar Norte → radar → pautas → roteiro.
- Validar gratuito → perfil → PRO → Instagram opcional → retorno ao ChatGPT.
- Validar PRO com e sem Instagram.
- Confirmar que nenhuma mensagem dentro do ChatGPT mostra preço, checkout, convite para assinar ou lembrete comercial repetitivo.
- Confirmar que a política de privacidade cita explicitamente o uso via ChatGPT e as categorias de dados retornadas.
- Usar o ícone de listagem em `public/plugin/data2content-logo-512.png` e não enviar screenshots, pois a V1 não possui UI própria no ChatGPT.
- Usar `docs/chatgpt-plugin-submission.md` para preencher todos os campos e testes do portal.
