---
tipo: armadilha
custo: credibilidade
resolvido: não
---

# Padrão que o produto mostra e não prevê nada

## O sintoma

O relatório semanal, a Galileia, a recomendação de ganchos e o MCP mostram ao criador "o gancho que funciona pra você", "seu melhor dia", "seu melhor horário", "seu cenário". Soa como diagnóstico. Medido, quase tudo isso é cara ou coroa.

## A medição (26/09/2026)

`npx tsx --env-file=.env.local ./scripts/auditSignalPredictiveness.ts` — somente leitura.

Para cada sinal e cada criador, os 70% posts mais antigos ensinam quanto cada valor rende contra a mediana do criador; os 30% mais novos testam. O número é uma AUC só com pares do **mesmo** criador: 0,50 é cara ou coroa. 246 criadores, 36.414 posts, 18 meses.

| Sinal | Cobre | Alcance | Compart. |
|---|---|---|---|
| Tipo de gancho (7 tipos) | 7% | 0,49 | 0,51 |
| Cenário | 8% | 0,48 | 0,53 |
| Faixa de horário | 100% | 0,51 | 0,52 |
| Dia da semana | 100% | 0,51 | 0,53 |
| Formato | 100% | 0,51 | 0,51 |
| Realiza o mapa (lido do vídeo) | 10% | 0,51 | 0,51 |
| Legenda cai num território do mapa | 24% | 0,53 | 0,55 |
| Duração do reel | 52% | 0,54 | 0,55 |
| Forma narrativa (legenda) | 50% | 0,53 | 0,55 |
| Proposta (legenda) | 48% | 0,55 | 0,56 |
| Tom (legenda) | 82% | 0,55 | 0,55 |

Nenhum sinal passa de 0,56. Os de 0,53–0,56 têm intervalo acima de 0,50 — existem, mas são fracos: servem para falar da base, não para aconselhar um post.

Dentro × fora do mapa, lido do vídeo: 1,11x × 0,91x da mediana do criador. Parece a tese confirmada, mas só 135 posts saíram "fora" contra 3.206 "dentro" — o leitor de cena quase nunca marca fora, então o sinal não varia o bastante para ensinar nada.

Um teste anterior, só com a primeira fala dos reels, deu o mesmo para o gancho (0,50) e mostrou que abrir com "Oi, gente!" não derruba reel (0,95x). 59% dos ganchos caem em "afirmação direta", a gaveta de "não reconheci".

## O que isso muda

- **Não apresentar dia, horário, cenário e tipo de gancho como padrão do criador.** Se aparecerem, é como descrição do que ele fez, não do que funciona.
- **Território da legenda é o único sinal do mapa com algum efeito**, e pequeno. A tese "post no seu território rende mais" tem evidência fraca a favor, não prova.
- **O leitor de cena precisa marcar "fora do mapa" de verdade** antes de a tese poder ser testada pelo vídeo.
- Conferir de novo depois de mudar classificador ou leitor: o script é a régua.

## Limites

Métrica atual de post antigo não é retrato do passado. A comparação é sempre dentro do criador, o que atenua isso sem zerar. AUC com cobertura baixa (gancho, cena) vale para quem tem leitura, não para a base.
