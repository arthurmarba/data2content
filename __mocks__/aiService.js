module.exports = {
  callOpenAIForQuestion: jest.fn(async () => ({ reply: 'mocked-answer' })),
  generateConversationSummary: jest.fn(async () => 'mocked-summary'),
  callOpenAIForTips: jest.fn(async () => ({ titulo: 'Dicas', dicas: [] })),
};
