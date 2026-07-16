# Raio X de conteúdo

O Raio X avalia sinais estruturais de um vídeo antes da publicação. Ele não prevê viralização e não expõe uma nota numérica. O resultado usa quatro faixas: sinais fortes, promissor com ajuste, incerto e poucos sinais.

## Contrato de mídia

- Formatos: MP4, MOV ou WEBM.
- Limite: até 300 MiB (`314572800` bytes), inclusive.
- Duração: até 90 segundos, inclusive.
- O navegador mede duração e tamanho para feedback imediato.
- O servidor confere `ContentLength`, bytes baixados e duração real com FFmpeg; metadados enviados pelo cliente não são fonte de verdade.
- Arquivos acima de 300 MiB são recusados antes de serem carregados em memória.

## Sinais usados

1. Clareza inicial: o tema é compreensível nos primeiros três segundos, inclusive sem depender do áudio.
2. Arquitetura de atenção: progressão, cortes, gestos, texto, zoom ou mudanças relevantes nos primeiros dez segundos. O FFmpeg fornece a contagem de mudanças visuais como evidência auxiliar; não existe regra rígida de “três cortes”.
3. Impulso de compartilhamento: utilidade, identificação ou tensão que justifique enviar o conteúdo a outra pessoa.
4. Entrega da promessa: o final cumpre a expectativa criada na abertura.
5. Aderência narrativa: coerência com mapa, territórios e objetivo do creator.

Cada dimensão precisa trazer evidência observável e, quando necessário, um ajuste. A faixa é recalculada no servidor a partir das dimensões; o modelo não controla sozinho o veredito.

## Relatório orientado à ação

O relatório não abre com nota. A ordem de leitura é fixa:

1. decisão editorial: postar, ajustar antes ou revisar;
2. uma única mudança de maior impacto, com texto copiável quando houver exemplo;
3. no máximo dois pontos fortes e dois riscos, priorizados pelo objetivo escolhido;
4. decisão do creator: ajustar, postar assim ou não postar;
5. evidências por abertura, desenvolvimento e fechamento em expansão secundária.

O creator pode marcar o ajuste como feito e iniciar outro scan. Enquanto o modal estiver aberto, a nova leitura compara as dimensões com a versão anterior e separa o que melhorou, regrediu ou permaneceu forte. Essa comparação é estrutural; não é promessa de desempenho.

As correções “útil”, “não entendeu a intenção” e “viu algo que não existe” são persistidas como vocabulário estruturado, sem texto livre e sem reenviar mídia. O histórico é limitado às 20 correções mais recentes por diagnóstico. Ações do relatório geram telemetria sem conteúdo, nome de arquivo, transcrição ou ID de diagnóstico.

## Calibração com histórico

- Com menos de cinco posts analisados, a base é somente a estrutura do vídeo.
- A partir de cinco posts, o resultado pode informar que considera o histórico do creator.
- A confiança só chega a alta após pelo menos oito resultados pós-publicação vinculados.
- Uma intenção “Vou postar” é reconciliada somente quando existe um único Reel/vídeo elegível nos sete dias seguintes. Casos ambíguos permanecem pendentes.
- Alcance e intenção relativa (salvamentos + compartilhamentos) calibram faixas futuras de forma conservadora; nunca produzem garantia.

## Privacidade e operação

- O vídeo temporário continua seguindo a rotina existente de descarte após sucesso ou falha.
- A resposta pública não inclui URL assinada, chave de storage, caminho local, transcrição extensa ou identificador técnico.
- Falha na inspeção real do arquivo bloqueia a análise com mensagem segura.
- O mock usa o mesmo contrato visual e de dados do fluxo real para QA consistente.

## Checklist de rollout

- Confirmar FFmpeg disponível no runtime de análise.
- Monitorar rejeições `video_too_large`, `video_too_long`, `invalid_media` e `media_probe_unavailable`.
- Auditar semanalmente vínculos pós-publicação ambíguos e taxas por faixa.
- Validar em 390 × 844, com vídeo real, movimento reduzido e conexão lenta.
- Revisar os limiares de calibração apenas depois de volume suficiente de resultados vinculados.
