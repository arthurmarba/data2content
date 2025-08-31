# QA - Tabela de Rankings no ChatPanel

## Cenário: Exibir ranking em tabela
1. Abrir `/dashboard/chat`.
2. Enviar a mensagem abaixo no campo de texto:

```
| Rank | Criador | Pontos |
| --- | --- | --- |
| 1 | Alice | 98 |
| 2 | Bob | 87 |
| 3 | Carol | 75 |
```

3. Verificar que a resposta renderiza uma tabela com rolagem horizontal (`overflow-x-auto`).
4. Confirmar que o texto das colunas utiliza a classe `text-xs` e está legível em telas móveis.

## Cenário: Tabela com muitas colunas
1. Enviar a mensagem:

```
| Rank | Criador | Pontos | Seguidores | Engajamento |
| --- | --- | --- | --- | --- |
| 1 | Alice | 98 | 120k | 5% |
| 2 | Bob | 87 | 90k | 4% |
```

2. Validar que é possível rolar horizontalmente e todas as colunas são exibidas corretamente.
