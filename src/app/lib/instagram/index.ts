// src/app/lib/instagram/index.ts

// --- Funções de Configuração e Tipos (geralmente não exportadas diretamente aqui, mas usadas internamente) ---
// export * from './config/instagramApiConfig'; // Geralmente não é necessário exportar todas as configs
// export * from './types'; // Tipos são importados diretamente onde necessário

// --- Funções de API ---
// Cliente da API (geralmente usado internamente pelos fetchers, pode não precisar ser público)
// export * from './api/client';
export * from './api/fetchers'; // Funções como fetchInstagramMedia, fetchMediaInsights, etc.
export * from './api/accountDiscovery'; // Função fetchAvailableInstagramAccounts

// --- Funções de Banco de Dados (DB) ---
export * from './db/userActions'; // Funções como getInstagramConnectionDetails, updateUserBasicInstagramProfile
export * from './db/connectionManagement'; // Funções como connectInstagramAccount, clearInstagramConnection
export * from './db/metricActions'; // Função saveMetricData (createOrUpdateDailySnapshot é interna a este módulo)
export * from './db/accountInsightActions'; // Função saveAccountInsightData

// --- Funções de Webhook ---
export * from './webhooks/storyWebhookHandler'; // Funções processStoryWebhookPayload, handleInstagramWebhook

// --- Serviço de Sincronização ---
export * from './sync/dataSyncService'; // Função principal triggerDataRefresh

// --- Utilitários (geralmente usados internamente, mas podem ser exportados se necessário) ---
// export * from './utils/tokenUtils';
// export * from './utils/helpers';

// Exemplo de como você importaria na sua aplicação:
// import { triggerDataRefresh, connectInstagramAccount } from '@/app/lib/instagram';
// import { fetchInstagramMedia } from '@/app/lib/instagram'; // Se precisar de acesso direto
