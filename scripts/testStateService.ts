// scripts/testStateService.ts
import dotenv from 'dotenv';
// Garante que o path está correto para a raiz do projeto onde o script é executado
dotenv.config({ path: '.env.local', debug: process.env.DOTENV_DEBUG === 'true' }); 

// --- INÍCIO DOS LOGS DE DEBUG PARA DOTENV ---
console.log('[DEBUG DOTENV] Tentando carregar .env.local');
console.log(`[DEBUG DOTENV] UPSTASH_REDIS_REST_URL carregada: ${process.env.UPSTASH_REDIS_REST_URL ? 'ENCONTRADA (' + process.env.UPSTASH_REDIS_REST_URL.substring(0,15) + '...)' : 'NÃO ENCONTRADA'}`);
console.log(`[DEBUG DOTENV] UPSTASH_REDIS_REST_TOKEN carregada: ${process.env.UPSTASH_REDIS_REST_TOKEN ? 'ENCONTRADA (' + process.env.UPSTASH_REDIS_REST_TOKEN.substring(0,15) + '...)' : 'NÃO ENCONTRADA'}`);
console.log(`[DEBUG DOTENV] OPENAI_API_KEY carregada (exemplo): ${process.env.OPENAI_API_KEY ? 'ENCONTRADA' : 'NÃO ENCONTRADA'}`);
// --- FIM DOS LOGS DE DEBUG PARA DOTENV ---

// CORREÇÃO: Usando caminhos relativos diretos COM extensão .js, para ser usado com o loader ESM do ts-node.
import * as stateService from '../src/app/lib/stateService.js';
import { IDialogueState, ILastResponseContext } from '../src/app/lib/stateService.js';

// --- CONFIGURAÇÕES DO TESTE ---
const TEST_USER_ID = 'test-user-state-script-003'; // ID de teste atualizado para clareza
const LOG_PREFIX = '[StateServiceTestScript]';

// Função auxiliar para logar com prefixo
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`${LOG_PREFIX} [${timestamp}] ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
};

// Função de asserção simples
const assert = (condition: boolean, message: string, details?: any) => {
  if (!condition) {
    console.error(`${LOG_PREFIX} FALHA NA ASSERÇÃO: ${message}`, details !== undefined ? JSON.stringify(details, null, 2) : '');
    // Opcional: Lançar um erro para parar a execução em caso de falha
    // throw new Error(`Falha na asserção: ${message}`);
  } else {
    console.log(`${LOG_PREFIX} SUCESSO NA ASSERÇÃO: ${message}`);
  }
};

// Função para comparar dois lastResponseContext
const compareLrc = (lrc1: ILastResponseContext | null | undefined, lrc2: ILastResponseContext | null | undefined, messagePrefix: string): boolean => {
    if (lrc1 === null && lrc2 === null) return true;
    if (lrc1 === undefined && lrc2 === undefined) return true;
    if (!lrc1 || !lrc2) {
        log(`${messagePrefix} Falha na comparação: Um dos LRCs é nulo/indefinido. LRC1: ${JSON.stringify(lrc1)}, LRC2: ${JSON.stringify(lrc2)}`);
        return false;
    }

    const topicsMatch = lrc1.topic === lrc2.topic;
    const wasQuestionMatch = lrc1.wasQuestion === lrc2.wasQuestion;
    const timestampsMatch = lrc1.timestamp === lrc2.timestamp;
    const entitiesMatch = JSON.stringify(lrc1.entities?.sort()) === JSON.stringify(lrc2.entities?.sort());

    if (!topicsMatch) log(`${messagePrefix} Falha na comparação: Topics não batem. "${lrc1.topic}" vs "${lrc2.topic}"`);
    if (!wasQuestionMatch) log(`${messagePrefix} Falha na comparação: WasQuestion não bate. ${lrc1.wasQuestion} vs ${lrc2.wasQuestion}`);
    if (!timestampsMatch) log(`${messagePrefix} Falha na comparação: Timestamps não batem. ${lrc1.timestamp} vs ${lrc2.timestamp}`);
    if (!entitiesMatch) log(`${messagePrefix} Falha na comparação: Entities não batem. ${JSON.stringify(lrc1.entities)} vs ${JSON.stringify(lrc2.entities)}`);

    return topicsMatch && wasQuestionMatch && timestampsMatch && entitiesMatch;
};

async function runStateServiceTests() {
  log(`Iniciando testes para o stateService com userId: ${TEST_USER_ID}`);
  log('----------------------------------------------------');

  try {
    log('Limpando estado de teste anterior (se existir)...');
    const initialDefaultState = stateService.getDefaultDialogueState();
    await stateService.updateDialogueState(TEST_USER_ID, initialDefaultState);
    log('Estado de teste inicializado/limpo.');
    log('----------------------------------------------------');

    // Teste 1: Salvar e recuperar estado inicial com lastResponseContext
    log('--- Teste 1: Salvar e Recuperar Estado Inicial ---');
    const initialTimestamp1 = Date.now();
    const initialLrc1: ILastResponseContext = {
      topic: 'Tópico de Teste Inicial',
      entities: ['entidadeA', 'teste1'],
      timestamp: initialTimestamp1,
      wasQuestion: false,
    };
    const initialStatePart1: Partial<IDialogueState> = {
        lastResponseContext: initialLrc1,
        lastInteraction: initialTimestamp1,
        conversationSummary: "Resumo inicial para teste 1"
    };
    await stateService.updateDialogueState(TEST_USER_ID, initialStatePart1);
    log('Estado inicial com lastResponseContext salvo:', initialStatePart1);

    const retrievedState1 = await stateService.getDialogueState(TEST_USER_ID);
    log('Estado recuperado (1):', {
        lastInteraction: retrievedState1.lastInteraction,
        lastResponseContext: retrievedState1.lastResponseContext,
        conversationSummary: retrievedState1.conversationSummary
    });

    assert(compareLrc(retrievedState1.lastResponseContext, initialLrc1, "Teste 1.1 (LRC)"), `Teste 1.1: lastResponseContext deve corresponder ao inicial.`);
    assert(retrievedState1.lastInteraction === initialTimestamp1, `Teste 1.2: lastInteraction deve ser ${initialTimestamp1}`);
    assert(retrievedState1.conversationSummary === "Resumo inicial para teste 1", `Teste 1.3: conversationSummary deve ser "Resumo inicial para teste 1"`);
    log('--- Teste 1 Concluído ---');
    log('----------------------------------------------------');

    // Teste 2: Atualizar o lastResponseContext
    log('--- Teste 2: Atualizar lastResponseContext ---');
    await new Promise(resolve => setTimeout(resolve, 50));
    const updatedTimestamp2 = Date.now();
    const updatedLrc2: ILastResponseContext = {
      topic: 'Tópico Atualizado via Teste',
      entities: ['entidadeB', 'update'],
      timestamp: updatedTimestamp2,
      wasQuestion: true,
    };
    const updateStatePart2: Partial<IDialogueState> = {
        lastResponseContext: updatedLrc2,
        lastInteraction: updatedTimestamp2
    };
    await stateService.updateDialogueState(TEST_USER_ID, updateStatePart2);
    log('lastResponseContext atualizado:', updateStatePart2);

    const retrievedState2 = await stateService.getDialogueState(TEST_USER_ID);
    log('Estado recuperado (2) após atualização do LRC:', {
        lastInteraction: retrievedState2.lastInteraction,
        lastResponseContext: retrievedState2.lastResponseContext,
        conversationSummary: retrievedState2.conversationSummary
    });

    assert(compareLrc(retrievedState2.lastResponseContext, updatedLrc2, "Teste 2.1 (LRC)"), `Teste 2.1: lastResponseContext deve corresponder ao atualizado.`);
    assert(retrievedState2.lastInteraction === updatedTimestamp2, `Teste 2.2: lastInteraction deve ser ${updatedTimestamp2}`);
    assert(retrievedState2.conversationSummary === "Resumo inicial para teste 1", `Teste 2.3: conversationSummary do Teste 1 deve ser preservado.`);
    log('--- Teste 2 Concluído ---');
    log('----------------------------------------------------');

    // Teste 3: Atualizar outra parte do estado, preservando o lastResponseContext anterior
    log('--- Teste 3: Atualizar Apenas summary, Preservar LRC ---');
    await new Promise(resolve => setTimeout(resolve, 50));
    const summaryForTest3 = "Este é um novo resumo de conversa para o Teste 3.";
    const updateStatePart3: Partial<IDialogueState> = {
        conversationSummary: summaryForTest3
    };
    await stateService.updateDialogueState(TEST_USER_ID, updateStatePart3);
    log('Apenas conversationSummary fornecido para atualização:', updateStatePart3);

    const retrievedState3 = await stateService.getDialogueState(TEST_USER_ID);
    log('Estado recuperado (3) após atualização de outra parte:', {
        lastInteraction: retrievedState3.lastInteraction,
        conversationSummary: retrievedState3.conversationSummary,
        lastResponseContext: retrievedState3.lastResponseContext
    });

    assert(compareLrc(retrievedState3.lastResponseContext, updatedLrc2, "Teste 3.1 (LRC)"), `Teste 3.1: lastResponseContext do Teste 2 deve ser preservado.`);
    assert(retrievedState3.conversationSummary === summaryForTest3, `Teste 3.2: conversationSummary deve ser "${summaryForTest3}"`);
    assert(retrievedState3.lastInteraction !== undefined && retrievedState3.lastInteraction > updatedTimestamp2, `Teste 3.3: lastInteraction deve ter sido atualizado automaticamente.`);
    log('--- Teste 3 Concluído ---');
    log('----------------------------------------------------');

    // Teste 4: Limpar lastResponseContext (definindo como null)
    log('--- Teste 4: Limpar lastResponseContext ---');
    await new Promise(resolve => setTimeout(resolve, 50));
    const interactionTime4 = Date.now();
    const updateStatePart4: Partial<IDialogueState> = {
        lastResponseContext: null,
        lastInteraction: interactionTime4
    };
    await stateService.updateDialogueState(TEST_USER_ID, updateStatePart4);
    log('lastResponseContext definido como null:', updateStatePart4);

    const retrievedState4 = await stateService.getDialogueState(TEST_USER_ID);
    log('Estado recuperado (4) após limpar LRC:', {
        lastInteraction: retrievedState4.lastInteraction,
        lastResponseContext: retrievedState4.lastResponseContext,
        conversationSummary: retrievedState4.conversationSummary
    });

    assert(retrievedState4.lastResponseContext === null, 'Teste 4.1: lastResponseContext deve ser null');
    assert(retrievedState4.lastInteraction === interactionTime4, `Teste 4.2: lastInteraction deve ser ${interactionTime4}`);
    assert(retrievedState4.conversationSummary === summaryForTest3, `Teste 4.3: conversationSummary do Teste 3 deve ser preservado.`);
    log('--- Teste 4 Concluído ---');
    log('----------------------------------------------------');

    // Teste 5: Obter estado para usuário inexistente (deve retornar estado padrão)
    log('--- Teste 5: Estado para Usuário Inexistente ---');
    const NON_EXISTENT_USER_ID = `user-que-nao-existe-${Date.now()}`;
    const defaultStateForNewUser = await stateService.getDialogueState(NON_EXISTENT_USER_ID);
    log('Estado recuperado para usuário inexistente:', defaultStateForNewUser);

    const expectedDefault = stateService.getDefaultDialogueState();
    assert(defaultStateForNewUser.lastResponseContext === expectedDefault.lastResponseContext, 'Teste 5.1: lastResponseContext para novo usuário deve ser o padrão (null)');
    assert(defaultStateForNewUser.conversationSummary === expectedDefault.conversationSummary, 'Teste 5.2: conversationSummary para novo usuário deve ser o padrão (undefined)');
    assert(defaultStateForNewUser.summaryTurnCounter === expectedDefault.summaryTurnCounter, `Teste 5.3: summaryTurnCounter para novo usuário deve ser o padrão (${expectedDefault.summaryTurnCounter})`);
    log('--- Teste 5 Concluído ---');
    log('----------------------------------------------------');

    log('Todos os testes do stateService concluídos.');

  } catch (error) {
    console.error(`${LOG_PREFIX} ERRO GERAL DURANTE OS TESTES:`, error);
  } finally {
    log('----------------------------------------------------');
    log('Script de teste finalizado.');
  }
}

runStateServiceTests();
