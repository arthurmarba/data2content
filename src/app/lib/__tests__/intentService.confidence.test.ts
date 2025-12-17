import { determineIntent, normalizeText } from '../intentService';
import { getDefaultDialogueState } from '../stateService';

const mockUser = {
  _id: 'user1',
  name: 'Teste',
  email: 'teste@example.com',
} as any;

describe('determineIntent confidence', () => {
  it('retorna confiança alta para confirmação de ação pendente', async () => {
    const dialogueState = getDefaultDialogueState();
    dialogueState.lastAIQuestionType = 'confirm_fetch_day_stats';
    dialogueState.pendingActionContext = { foo: 'bar' };

    const res = await determineIntent(
      normalizeText('sim pode seguir'),
      mockUser,
      'sim pode seguir',
      dialogueState,
      'Oi',
      'user1',
    );

    expect(res.type).toBe('intent_determined');
    expect(res.intent).toBe('user_confirms_pending_action');
    expect(res.confidence).toBeDefined();
    expect(res.confidence).toBeGreaterThan(0.5);
    expect(res.confidence).toBeLessThanOrEqual(1);
  });

  it('retorna confiança definida para intents gerais', async () => {
    const dialogueState = getDefaultDialogueState();

    const res = await determineIntent(
      normalizeText('quero ideias de post'),
      mockUser,
      'quero ideias de post',
      dialogueState,
      'Oi',
      'user1',
    );

    expect(res.type).toBe('intent_determined');
    expect(res.confidence).toBeDefined();
    expect(res.confidence ?? 0).toBeGreaterThanOrEqual(0);
    expect(res.confidence ?? 0).toBeLessThanOrEqual(1);
  });
});
