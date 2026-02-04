const streamFromText = (text) => ({
  getReader: () => {
    let yielded = false;
    return {
      read: async () => {
        if (yielded) return { value: undefined, done: true };
        yielded = true;
        return { value: text, done: false };
      },
    };
  },
});

module.exports = {
  __esModule: true,
  askLLMWithEnrichedContext: jest.fn(async () => ({
    stream: streamFromText('mocked'),
    historyPromise: Promise.resolve([]),
  })),
  buildSurveyProfileSnippet: jest.fn(() => 'profile-snippet'),
};
