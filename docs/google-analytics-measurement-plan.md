# Plano de medição — Google Analytics 4

## Pageviews

A aplicação envia `page_view` manualmente em cada mudança de rota do Next.js.
Na propriedade GA4, mantenha **desativada** a opção de pageviews por mudanças no
histórico do navegador para evitar contagem duplicada.

## Cliques

O evento global `button_click` cobre botões, links, inputs de ação e elementos com
`role="button"`. Seus parâmetros são:

- `button_name`: identificador normalizado do controle;
- `button_section`: seção mais próxima da página;
- `page_path`: rota sem query string;
- `destination`: caminho interno ou domínio externo, sem parâmetros de URL;
- `element_type`: `button`, `link`, `input` ou `role_button`.

Para controles importantes, use `data-analytics-name="identificador_estavel"` e,
no container, `data-analytics-section="nome_da_secao"`. Use
`data-analytics-ignore="true"` em regiões que não devem ser medidas.

## Dimensões personalizadas no GA4

Criar dimensões personalizadas com escopo **Evento**:

| Nome exibido | Parâmetro do evento |
| --- | --- |
| Botão | `button_name` |
| Seção do botão | `button_section` |
| Destino do botão | `destination` |
| Tipo de elemento | `element_type` |
| Ambiente | `environment` |

`page_path` já possui dimensões nativas no GA4 e não precisa ser duplicado.

## Eventos principais

Marcar como eventos principais:

- `subscription_activated` — assinatura confirmada;
- `proposal_submitted` — proposta enviada por uma marca;
- `ig_account_connected` — Instagram conectado;
- `affiliate_signup_converted` — cadastro atribuído a afiliado;
- `calculator_submit_succeeded` — cálculo concluído com sucesso.

## Exploração recomendada

Criar uma exploração livre chamada **Páginas e botões**:

- Linhas: caminho da página, `button_section`, `button_name`;
- Colunas: tipo do dispositivo;
- Valores: contagem de eventos, usuários ativos e eventos principais;
- Filtro: nome do evento corresponde exatamente a `button_click`.

Uma segunda exploração de funil pode usar:

1. `page_view`;
2. `button_click` para o CTA desejado;
3. evento principal correspondente.
