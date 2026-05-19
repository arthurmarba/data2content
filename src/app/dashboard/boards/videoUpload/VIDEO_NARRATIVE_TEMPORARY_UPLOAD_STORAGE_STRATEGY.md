# Estratégia de Upload e Armazenamento Temporário de Vídeo

## 📋 Introdução & Objetivo
O Perfil Estratégico da Data2Content (D2C) atua como o **diagnóstico vivo do creator**. Cada vídeo analisado enriquece e atualiza esse perfil com novos aprendizados, signals e padrões narrativos.

Para habilitar a análise de vídeos reais no futuro mantendo **privacidade máxima, segurança e economia de custos**, estabelecemos uma arquitetura baseada em **Upload Temporário com Descarte Seguro**. Sob esta abordagem, o vídeo bruto funciona apenas como uma pauta efêmera de processamento: **o vídeo é carregado temporariamente, analisado pelo modelo multimodal, e deletado imediatamente após a conclusão da análise estratégica.**

---

## 🔒 Princípios de Segurança (O que nunca salvar)
Para evitar riscos jurídicos, de privacidade e custos astronômicos de armazenamento, as seguintes restrições são absolutas:
1. **Sem Histórico Visual de Vídeos**: A D2C **nunca** exibirá uma galeria de vídeos enviados, lista de vídeos analisados ou player para assistir vídeos antigos. O único artefato permanente é o diagnóstico atualizado no Perfil.
2. **Descarte Imediato**: Todo arquivo físico enviado deve ser excluído assim que o processamento do pipeline da IA for concluído (seja em caso de sucesso ou de falha irrecuperável).
3. **Persistência Proibida**:
   - Nunca salvar o vídeo bruto ou compactado de forma permanente.
   - Nunca persistir assinaturas de URLs (signed URLs) ou tokens temporários no banco de dados.
   - Nunca expor URLs de buckets públicos.
   - Nunca salvar ou reter imagens de thumbnails do vídeo.

---

## 📊 Limites de Arquivo & Quotas (Políticas de Quota)

A política de limites visa assegurar excelente desempenho na rede e evitar abusos maliciosos:

| Métrica | Limite Padrão | Justificativa de Produto / Técnica |
| :--- | :--- | :--- |
| **maxFileSizeBytes** | 100 MB | Suficiente para vídeos comprimidos de celular. Evita consumo excessivo de banda de upload no servidor. |
| **maxDurationSeconds** | 300s (5 min) | Cobre com folga o limite padrão de vídeos verticais (Reels/Shorts/TikTok), mantendo foco em micro-narrativas. |
| **retentionTtlMinutes** | 60 minutos | Tempo ótimo para processamento assíncrono e resiliência na fila sem manter mídias em repouso por mais tempo que o necessário. |

---

## 🛡️ Validação Rigorosa de Metadados & Arquivos
Antes que qualquer requisição de upload seja autorizada ou processada pelo storage provider:
- **MimeType & Extensões Coerentes**: Permitidos apenas `video/mp4`, `video/quicktime` (MOV) e `video/webm`.
- **Prevenção contra Executáveis**: Bloqueio ativo contra dupla extensão (ex: `video.mp4.exe`) e assinaturas restritas de extensões como `.exe`, `.sh`, `.bat`, `.js`, etc.
- **Sanitização estrita de Nomes**: Eliminação de caracteres de escape de diretórios (ex: `../`), substituição de espaços por sublinhados (`_`) e restrição a caracteres seguros (`a-zA-Z0-9.\-_`).
- **Bloqueio de Injeções**: Rejeição imediata de strings em Base64 ou URLs externas passadas como nome do arquivo.

---

## ⚙️ Feature Flags Propostas

Para garantir a ativação gradual, o controle do sistema de upload e storage temporário será regido pelas seguintes flags:

```bash
# Habilita o upload real e bypassa o mock local
VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED=false

# Define o provedor ativo ('disabled', 'local_mock', 's3', 'r2', 'gcs', 'cloudinary')
VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER=disabled

# Define o tamanho máximo de upload permitido por payload (em MB)
VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB=100

# Tempo limite para descarte forçado do arquivo temporário
VIDEO_NARRATIVE_TEMP_UPLOAD_TTL_MINUTES=60
```

---

## 🌩️ Provedores de Storage Avaliados (Abstração)

Embora a implementação atual mantenha o provider como `disabled`, projetamos a interface para ser compatível com os principais players do mercado:

1. **Cloudflare R2**:
   - *Prós*: Sem tarifas de egress (saída de dados), o que zera o custo de leitura de grandes volumes de vídeo pelas APIs de IA. Suporta API S3 perfeitamente.
   - *Recomendação*: **Candidato preferencial** devido ao custo-benefício de transferência e compatibilidade nativa com Next.js.
2. **AWS S3**:
   - *Prós*: Robustez, SLA extremamente alto e ecossistema maduro.
   - *Contras*: Custos de transferência e egress significativamente elevados para arquivos de vídeo.
3. **Google Cloud Storage (GCS)**:
   - *Prós*: Excelente latência em infraestruturas hospedadas no Google Cloud e integração de alta performance com a suíte Gemini API (Vertex AI).
4. **Cloudinary**:
   - *Prós*: Ferramentas automáticas de compressão e conversão de vídeo na borda.
   - *Contras*: Limites de créditos e custo por transformação muito altos para pipelines puramente estratégicos/estatísticos.

---

## 🔄 Fluxo de Processamento Futuro (Ciclo de Vida)

```mermaid
sequenceDiagram
  autonumber
  actor Creator as Aplicativo (Cliente)
  participant Servidor as Next.js API
  participant Storage as Storage Temporário (R2)
  participant IA as Pipeline Gemini Multimodal
  participant DB as Banco Mongoose

  Creator->>Servidor: 1. Solicita sessão de upload (fileName, sizeBytes, consentAccepted)
  Note over Servidor: Valida sessão, quota, consentimento e metadados
  Servidor-->>Creator: 2. Retorna Signed Upload URL curta (válida por 5 minutos)
  Creator->>Storage: 3. Faz upload direto do vídeo bruto via PUT
  Creator->>Servidor: 4. Notifica upload concluído
  Note over Servidor: Registra status 'uploaded' e trava lock de processamento
  Servidor->>IA: 5. Dispara análise narrativa da IA passando o vídeo temporário
  IA-->>Servidor: 6. Retorna diagnóstico estratégico estruturado
  Servidor->>Storage: 7. Solicita deleção imediata do arquivo físico do vídeo
  Servidor->>DB: 8. Salva o Snapshot Estratégico (Sem armazenar o vídeo)
  Servidor-->>Creator: 9. Diagnóstico atualizado renderizado no Perfil
```

---

## ⚖️ Consentimento Ativo do Creator
O envio só é habilitado após o consentimento explícito em uma caixa de diálogo antes de selecionar a mídia. O consentimento contém:
- **Finalidade**: `"video_narrative_analysis"` para diagnóstico no perfil estratégico.
- **Transparência**: Alerta claro de que o vídeo físico **não é mantido** e será permanentemente descartado em até 1 hora ou imediatamente após o processamento.
