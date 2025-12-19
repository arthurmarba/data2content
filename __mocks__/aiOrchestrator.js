module.exports = {
  askLLMWithEnrichedContext: jest.fn(async () => ({ content: 'mocked' })),
  buildSurveyProfileSnippet: jest.fn(() => 'profile-snippet'),
};
