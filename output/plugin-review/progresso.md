# Revisão Data2Content — 09/09/2026

## Concluído em 08/09

- Correções publicadas: `ee0a6cfe` em main, produção Ready em data2content.ai.
- Build e typecheck do MCP passaram. 221 testes passaram, três pulados; aviso preexistente de ESLint no build.
- Ensaio de integração: 31 verificações aprovadas com contas fictícias; detalhes em `verification.json`.
- OAuth real autorizado por Arthur e concluído na conexão privada Data2Content Revisão. Catálogo de 26 ferramentas atualizado no ChatGPT.
- Conversa real: https://chatgpt.com/c/6aa0c16a-de0c-83e9-bafb-9e5f08467ca6 — Revisão de pauta declaratória.
- Portal: mesma versão 1.0.0 voltou de Review para Draft. Scan capturou 26 ferramentas. 78 justificativas, 5 casos positivos, 3 negativos, 3 prompts e notas preenchidos.
- Override OAuth antigo de nove escopos removido; consentimento novo usa os atuais, incluindo `campaigns:read`.

## Concluído em 09/09

- `profile:write` confirmado no metadata público: `/.well-known/oauth-authorization-server` e `/.well-known/oauth-protected-resource` anunciam as 11 permissões. Uma conexão nova de revisor já nasce com `profile:write`; a conexão privada criada em 08/09 tem 10 e por isso pedia reconexão para `set_creator_north`.
- Gravação de tela: `screencapture -v` pela linha de comando falha por falta de permissão de Gravação de Tela; `screencaptureui` recusou o spawn. As duas gravações feitas com a barra aberta manualmente ficaram nesta pasta.
- Vídeo da submissão montado com ffmpeg a partir de `Gravação de Tela 2026-09-09 às 00.17.01.mov`: três trechos (abertura + rolagem), sem áudio, com o corte dos ~2s em que uma janela de editor de vídeo aparece na frente. Varredura a 1 fps confirmou que só a conversa do ChatGPT aparece nos 112 quadros.
- `public/plugin/data2content-chatgpt-demo-v2.mp4` (1366x768, 1min52, 3,2 MB), commit `f9647d06` em main. Build local passou antes do push.

## Enviado

- Reenvio concluído em 09/09/2026. `Demo Recording URL` trocado para o vídeo v2, wizard percorrido até o fim e `Submit for Review` confirmado. A versão 1.0.0 aparece como **Review** no portal.

## Pendente

1. Regularizar créditos do Gemini. O gerador principal devolve `RESOURCE_EXHAUSTED`; o fallback local é transparente, mas é um esqueleto genérico. O caso de teste 3 já prevê a ressalva, mas o revisor verá o fallback.
2. Restaurar o login habitual de Arthur no site Data2Content: o Chrome ficou na conta fictícia PRO em 08/09.
3. Se a revisão pedir regravação, o caminho é: Shift+Cmd+5 aberto por Arthur, gravar, cortar com ffmpeg, conferir quadro a quadro, trocar o arquivo em `public/plugin/` e atualizar Demo Recording URL.

## Portal

- Rascunho: https://platform.openai.com/plugins/edit/asdk_app_6a90fd3796988191b213da76eca2417e/asdk_app_v_6a90fd3897c48191b04ed9fad182f19c
- Aviso amarelo na aba MCP sobre restrições de domínio Enterprise (pede OIDC) é informativo, não bloqueia.
- Seis ferramentas legadas sem `outputSchema` exibem recomendações, não erros.
